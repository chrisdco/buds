import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import { colors, space } from "@/constants/theme";

// Uber "Choose a trip" grammar: full-screen map with a non-modal sheet (peek /
// half / full, no scrim — the map stays interactive behind it). Three parts:
//   - header: handle + title block. The ONLY drag area, so the body can scroll.
//   - body: scrolls within whatever the settled detent leaves visible.
//   - footer: the one pinned CTA, held at the screen bottom at every detent
//     (and while dragging), like "Choose Auto".
// Peek is sized to header + footer, so the collapsed sheet always shows the
// trip's title and its primary action.
export type SheetDetent = "peek" | "half" | "full";

const ORDER: SheetDetent[] = ["peek", "half", "full"];
const MIN_PEEK = 120;
const HALF_RATIO = 0.5;
const FULL_RATIO = 0.88;
// Apple designer params (expo-animation skill): sheet settle, no overshoot
// past the detent list (targets are interior, so clamping would deaden it).
const SPRING = { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;

// Apple's exponential-decay projection (expo-animation skill recipe):
// where the finger would come to rest if it kept decelerating. A fast
// short flick commits; a slow long drag doesn't.
function project(velocity: number, decelerationRate = 0.998): number {
  "worklet";
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// The further past the edge, the less the sheet follows — resistance
// instead of a dead clamp, so the boundary reads as physical.
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  "worklet";
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Visible sheet height at a settled detent (for map padding / FAB placement). */
export function sheetVisibleHeight(detent: SheetDetent, screenH: number, peekH: number): number {
  return detent === "peek" ? peekH : detent === "half" ? screenH * HALF_RATIO : screenH * FULL_RATIO;
}

interface RoomSheetProps {
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent) => void;
  renderHeader: (detent: SheetDetent) => ReactNode;
  renderBody: (detent: SheetDetent) => ReactNode;
  /** Pinned CTA; null hides the footer (e.g. while adjusting a pin). */
  renderFooter?: (detent: SheetDetent) => ReactNode;
  /** Reports the measured peek height so the screen can place FABs above it. */
  onPeekHeight?: (h: number) => void;
}

/** Single light tick when a detent catches — visual leads, haptic follows. */
function settleHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function RoomSheet({
  detent,
  onDetentChange,
  renderHeader,
  renderBody,
  renderFooter,
  onPeekHeight,
}: RoomSheetProps) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [headerH, setHeaderH] = useState(96);
  const [footerH, setFooterH] = useState(0);
  const footer = renderFooter?.(detent) ?? null;
  const footerHeight = footer ? footerH : 0;
  const peekH = Math.max(MIN_PEEK, headerH + footerHeight);
  const peekSV = useSharedValue(peekH);
  const footerSV = useSharedValue(footerHeight);

  useEffect(() => {
    peekSV.set(peekH);
    footerSV.set(footerHeight);
    onPeekHeight?.(peekH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peekH, footerHeight]);

  // Worklet-marked so gesture callbacks (UI runtime) can call it
  // synchronously; calling it from JS keeps working as a normal call.
  const topFor = (d: SheetDetent): number => {
    "worklet";
    return d === "peek"
      ? H - peekSV.get()
      : d === "half"
        ? H * (1 - HALF_RATIO)
        : H * (1 - FULL_RATIO);
  };

  const translateY = useSharedValue(topFor(detent));
  const dragStartY = useSharedValue(topFor(detent));

  // Tap-handle / programmatic moves (and a re-measured peek) animate.
  useEffect(() => {
    translateY.set(withSpring(topFor(detent), SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, H, peekH]);

  // Memoized on screen height + callback identity so parent re-renders
  // (presence tick) never rebuild the gesture mid-drag and cancel it.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onStart(() => {
          dragStartY.set(translateY.get());
        })
        .onUpdate((e) => {
          const min = topFor("full");
          const max = topFor("peek");
          const next = dragStartY.get() + e.translationY;
          translateY.set(
            next < min
              ? min + rubberband(next - min, H)
              : next > max
                ? max + rubberband(next - max, H)
                : next,
          );
        })
        .onEnd((e) => {
          // Fling-aware snap: project along velocity, settle on nearest detent.
          const projected = Math.min(
            topFor("peek"),
            Math.max(topFor("full"), translateY.get() + project(e.velocityY)),
          );
          let best: SheetDetent = ORDER[0];
          let bestDist = Infinity;
          for (const d of ORDER) {
            const dist = Math.abs(topFor(d) - projected);
            if (dist < bestDist) {
              bestDist = dist;
              best = d;
            }
          }
          translateY.set(withSpring(topFor(best), { ...SPRING, velocity: e.velocityY }));
          scheduleOnRN(onDetentChange, best);
          if (!reducedMotion) scheduleOnRN(settleHaptic);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [H, onDetentChange, reducedMotion],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  // Footer stays glued to the screen bottom wherever the sheet is.
  const footerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: H - translateY.get() - footerSV.get() }],
  }));

  const cycle = () => {
    if (!reducedMotion) settleHaptic();
    onDetentChange(ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length]);
  };

  // Body gets what the settled detent leaves between header and footer.
  const bodyH = Math.max(0, H - topFor(detent) - headerH - footerHeight);

  return (
    <Animated.View style={[styles.sheet, { height: H }, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setHeaderH(Math.ceil(e.nativeEvent.layout.height))}>
          <Pressable
            style={styles.handleZone}
            accessibilityRole="button"
            accessibilityLabel={`Trip panel, ${detent}. Activate to ${detent === "full" ? "collapse" : "expand"}.`}
            testID="room-sheet-handle"
            onPress={cycle}
          >
            <View style={styles.handle} />
          </Pressable>
          <View style={styles.pad}>{renderHeader(detent)}</View>
        </View>
      </GestureDetector>
      {bodyH > 24 && (
        <ScrollView
          style={{ height: bodyH }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {renderBody(detent)}
        </ScrollView>
      )}
      {footer && (
        <Animated.View
          style={[styles.footer, { paddingBottom: insets.bottom + space.sm }, footerStyle]}
          onLayout={(e) => setFooterH(Math.ceil(e.nativeEvent.layout.height))}
        >
          {footer}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    elevation: 8,
  },
  pad: { paddingHorizontal: space.md },
  body: { paddingHorizontal: space.md, paddingBottom: space.md },
  handleZone: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    opacity: 0.5,
  },
  footer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
