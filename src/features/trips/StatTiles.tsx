import { Text, View } from "react-native";

import { radius, space } from "@/constants/theme";
import { makeStyles, useTypeScale } from "@/theme";

// Row of big-number tiles (Uber Account's quick tiles, used for counts).
// The number is the hierarchy; the label is quiet underneath.
export function StatTiles({ stats }: { stats: { key: string; value: number; label: string }[] }) {
  const styles = useStyles();
  const ts = useTypeScale();
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

const useStyles = makeStyles((colors, ts) => ({
  row: { flexDirection: "row", gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: 2,
  },
  value: { ...ts.value, fontSize: 24, lineHeight: 30 },
}));
