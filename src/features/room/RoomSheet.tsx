import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

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
const SPRING = { damping: 30, stiffness: 300 };

interface RoomSheetProps {
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent) => void;
  renderContent: (detent: SheetDetent) => ReactNode;
}

export function RoomSheet({ detent, onDetentChange, renderContent }: RoomSheetProps) {
  const { height: H } = useWindowDimensions();
  const topFor = (d: SheetDetent): number =>
    d === "peek" ? H - PEEK_HEIGHT : d === "half" ? H * (1 - HALF_RATIO) : H * (1 - FULL_RATIO);

  const translateY = useSharedValue(topFor(detent));
  const dragStartY = useSharedValue(topFor(detent));

  // Tap-handle / programmatic moves animate; drags drive the value directly.
  useEffect(() => {
    translateY.value = withSpring(topFor(detent), SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, H]);

  const pan = Gesture.Pan()
    // Vertical drags belong to the sheet; taps and horizontal scrolls
    // (member list) pass through to children.
    .activeOffsetY([-12, 12])
    .onStart(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      const min = topFor("full");
      const max = topFor("peek");
      // Worklet mutation is Reanimated's API; shared with JS intentionally.
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = Math.min(max, Math.max(min, dragStartY.value + e.translationY));
    })
    .onEnd((e) => {
      // Fling-aware snap: project along velocity, settle on nearest detent.
      const projected = Math.min(
        topFor("peek"),
        Math.max(topFor("full"), translateY.value + e.velocityY * 0.12),
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
      // Worklet mutation is Reanimated's API; shared with JS intentionally.
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = withSpring(topFor(best), SPRING);
      runOnJS(onDetentChange)(best);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const cycle = () => {
    onDetentChange(ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length]);
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.sheet, { height: H }, animatedStyle]}>
        <Pressable
          style={styles.handleZone}
          accessibilityRole="button"
          accessibilityLabel={`Trip panel, ${detent}. Activate to ${detent === "full" ? "collapse" : "expand"}.`}
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
