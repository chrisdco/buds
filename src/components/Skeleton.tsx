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

import { colors } from "@/constants/theme";

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
// row layout so content swaps in without reflow when results land.
export function SearchResultSkeleton() {
  return (
    <View style={styles.row} testID="dest-search-skeleton" accessibilityLabel="Searching places">
      <Skeleton style={styles.icon} />
      <View style={styles.body}>
        <Skeleton style={styles.name} />
        <Skeleton style={styles.sub} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderRadius: 6 },
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
  name: { height: 16, width: "62%", borderRadius: 6 },
  sub: { height: 13, width: "88%", borderRadius: 6 },
});
