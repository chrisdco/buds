import { Text, View } from "react-native";

import { PeepAvatar } from "@/components/PeepAvatar";

import { fontFamily } from "@/constants/fonts";
import { makeStyles } from "@/theme";

// Overlapping faces of who was on a trip (Uber's shared-ride stack). Each
// face gets a canvas-colored ring so the overlap reads as separate people.
export function AvatarStack({
  buds,
  size = 26,
  max = 3,
}: {
  buds: { userId: string }[];
  size?: number;
  max?: number;
}) {
  const styles = useStyles();
  if (buds.length === 0) return null;
  const shown = buds.slice(0, max);
  const more = buds.length - shown.length;
  const ring = { borderRadius: (size + 4) / 2, padding: 2 };
  return (
    <View style={styles.row} accessible={false}>
      {shown.map((b, i) => (
        <View key={b.userId} style={[styles.ring, ring, i > 0 && { marginLeft: -size / 3 }]}>
          <PeepAvatar seed={b.userId} size={size} />
        </View>
      ))}
      {more > 0 && (
        <View
          style={[
            styles.ring,
            styles.more,
            { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, marginLeft: -size / 3 },
          ]}
        >
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center" },
  ring: { backgroundColor: colors.surface },
  more: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt },
  moreText: { color: colors.text, fontSize: 11, fontFamily: fontFamily.semiBold },
}));
