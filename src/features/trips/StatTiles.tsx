import { StyleSheet, Text, View } from "react-native";

import { colors, radius, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";

// Row of big-number tiles (Uber Account's quick tiles, used for counts).
// The number is the hierarchy; the label is quiet underneath.
export function StatTiles({ stats }: { stats: { key: string; value: number; label: string }[] }) {
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View
          key={s.key}
          style={styles.tile}
          accessible
          accessibilityLabel={`${s.value} ${s.label}`}
          testID={`stat-${s.key}`}
        >
          <Text style={styles.value}>{s.value}</Text>
          <Text style={ts.meta} numberOfLines={1}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: 2,
  },
  value: { ...ts.value, fontSize: 26, lineHeight: 32 },
});
