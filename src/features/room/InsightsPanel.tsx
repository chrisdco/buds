import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

export interface TripProgress {
  arrived: number;
  total: number;
}

export function InsightsPanel({
  headline,
  progress,
}: {
  headline: string | null;
  /** Uber-style trip progress (arrived / travelers). */
  progress?: TripProgress | null;
}) {
  if (!headline && !progress) return null;
  const ratio =
    progress && progress.total > 0
      ? Math.min(1, Math.max(0, progress.arrived / progress.total))
      : null;
  return (
    <View style={styles.pill}>
      {headline && (
        <Text style={styles.text} numberOfLines={2}>
          {headline}
        </Text>
      )}
      {ratio != null && (
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ now: progress!.arrived, max: progress!.total }}
        >
          <View style={[styles.fill, { flex: ratio }]} />
          <View style={{ flex: 1 - ratio }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
    maxWidth: "92%",
  },
  text: { color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
  track: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
    overflow: "hidden",
  },
  fill: { backgroundColor: colors.accent, borderRadius: 2 },
});
