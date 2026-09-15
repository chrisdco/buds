import { useEffect, useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import { colors, space } from "@/constants/theme";

// Google Maps / Uber grammar: full-screen map with a non-modal draggable
// sheet (peek / half / full, no scrim — the map stays interactive behind it).
// Content adapts per settled detent; while dragging, the settled content
// stays put so nothing flickers mid-gesture.
export type SheetDetent = "peek" | "half" | "full";

const ORDER: SheetDetent[] = ["peek", "half", "full"];
const PEEK_HEIGHT = 140;
const HALF_RATIO = 0.42;
const FULL_RATIO = 0.85;
// Apple designer params (expo-animation skill): sheet settle, no overshoot
// past the detent list (targets are interior, so clamping would deaden it).
const SPRING = { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;

// Apple's exponential-decay projection (expo-animation skill recipe):
// where the finger would come to rest if it kept decelerating. A fast
// short flick commits; a slow long drag doesn't — distance alone would
// make the sheet feel heavy.
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

interface RoomSheetProps {
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent) => void;
  renderContent: (detent: SheetDetent) => ReactNode;
}

/** Single light tick when a detent catches — visual leads, haptic follows. */
function settleHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function RoomSheet({ detent, onDetentChange, renderContent }: RoomSheetProps) {
  const { height: H } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Worklet-marked so gesture callbacks (UI runtime) can call it
  // synchronously. Worklets 0.10 forbids calling plain JS closures from the
  // UI runtime ("Remote Function" error) — this directive is required, not
  // optional. Calling it from JS (below) keeps working as a normal call.
  const topFor = (d: SheetDetent): number => {
    "worklet";
    return d === "peek" ? H - PEEK_HEIGHT : d === "half" ? H * (1 - HALF_RATIO) : H * (1 - FULL_RATIO);
  };

  const translateY = useSharedValue(topFor(detent));
  const dragStartY = useSharedValue(topFor(detent));

  // Tap-handle / programmatic moves animate; drags drive the value directly.
  useEffect(() => {
    translateY.set(withSpring(topFor(detent), SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, H]);

  // Memoized on screen height + callback identity so parent re-renders
  // (presence tick) never rebuild the gesture mid-drag and cancel it.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Vertical drags belong to the sheet; taps and horizontal scrolls
        // (member list) pass through to children.
        .activeOffsetY([-12, 12])
        .onStart(() => {
          dragStartY.set(translateY.get());
        })
        .onUpdate((e) => {
          const min = topFor("full");
          const max = topFor("peek");
          const next = dragStartY.get() + e.translationY;
          // Interior travel is free; past either edge the sheet resists.
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const cycle = () => {
    if (!reducedMotion) settleHaptic();
    onDetentChange(ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length]);
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.sheet, { height: H }, animatedStyle]}>
        <Pressable
          style={styles.handleZone}
          accessibilityRole="button"
          accessibilityLabel={`Trip panel, ${detent}. Activate to ${detent === "full" ? "collapse" : "expand"}.`}
          testID="room-sheet-handle"
          onPress={cycle}
        >
          <View style={styles.handle} />
        </Pressable>
        {renderContent(detent)}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    elevation: 8,
    paddingHorizontal: space.md,
  },
  handleZone: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
});
