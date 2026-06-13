import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
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
      <Text style={styles.text}>⏳ {info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
  },
  text: { color: "#1A1300", fontWeight: "700", fontSize: 12 },
});
