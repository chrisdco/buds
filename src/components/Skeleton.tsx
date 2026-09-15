import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radius } from "@/constants/theme";

// Honest loading shapes (expo-animation skill): a looping opacity pulse on
// the UI thread — opacity is a free property, so the shimmer never costs a
// layout pass. Started once in an effect, never per frame. Reduced motion
// renders the same shapes statically: the state explanation survives,
// the motion doesn't.
export function Skeleton({ style, testID }: { style?: ViewStyle; testID?: string }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.set(
      reducedMotion
        ? 1
        : withRepeat(withTiming(0.35, { duration: 900, easing: Easing.linear }), -1, true),
    );
  }, [reducedMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return <Animated.View testID={testID} style={[styles.block, style, animatedStyle]} />;
}

// Destination-search-shaped placeholder: mirrors the bold-name / dim-address
// row layout so content swaps in without reflow when results land. The
// loading announcement lives on the parent container (busy + live region) —
// rows stay silent so screen readers don't repeat it three times.
export function SearchResultSkeleton() {
  return (
    <View style={styles.row} testID="dest-search-skeleton">
      <Skeleton style={styles.icon} />
      <View style={styles.body}>
        <Skeleton style={styles.name} />
        <Skeleton style={styles.sub} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderRadius: radius.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 20, height: 20, borderRadius: 10 },
  body: { flex: 1, flexShrink: 1, gap: 6 },
  name: { height: 16, width: "62%", borderRadius: radius.sm },
  sub: { height: 13, width: "88%", borderRadius: radius.sm },
});
