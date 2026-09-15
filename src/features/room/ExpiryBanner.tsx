import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { expiryInfo } from "@/lib/expiry";

interface ExpiryBannerProps {
  expiresAt: string | null;
  nowMs: number;
}

// Only renders during the warning window (T-10min) so it stays out of the way
// for the rest of the trip.
export function ExpiryBanner({ expiresAt, nowMs }: ExpiryBannerProps) {
  const info = expiryInfo(expiresAt, nowMs);
  if (!info || !info.warning) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
  },
  // Ticking mm:ss countdown: tabular numerals stop the width jitter.
  text: {
    color: colors.onWarning,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
