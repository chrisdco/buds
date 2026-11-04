import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PeepAvatar } from "@/components/PeepAvatar";
import { AppSymbol, type AppSymbolName } from "@/components/Symbol";
import { colorForUser, colors, radius, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
import type { Bud } from "@/lib/tripHistory";

const GUTTER = 20; // Screen's horizontal padding

export interface QuickTile {
  key: string;
  label: string;
  icon: AppSymbolName & { fallback: string };
  testID: string;
  onPress: () => void;
}

/** Uber Account's three square shortcuts under the name (Help / Wallet / Activity). */
export function QuickTiles({ tiles }: { tiles: QuickTile[] }) {
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <Pressable
          key={t.key}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          testID={t.testID}
          onPress={t.onPress}
        >
          <AppSymbol name={t.icon} fallback={t.icon.fallback} size={24} tintColor={colors.text} />
          <Text style={[ts.meta, styles.tileLabel]} numberOfLines={1}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * People you've shared rooms with, most trips first. Faces ringed in the
 * same hue they get on the map, so a bud looks the same everywhere.
 */
export function BudsRow({ buds, onSelect }: { buds: Bud[]; onSelect: (bud: Bud) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.budsRow}
    >
      {buds.map((b) => (
        <Pressable
          key={b.userId}
          style={({ pressed }) => [styles.bud, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${b.name}, ${b.trips} ${b.trips === 1 ? "trip" : "trips"} together`}
          testID={`profile-bud-${b.userId}`}
          onPress={() => onSelect(b)}
        >
          <View style={[styles.budRing, { borderColor: colorForUser(b.userId) }]}>
            <PeepAvatar seed={b.userId} size={56} />
          </View>
          <Text style={[ts.rowSub, styles.budName]} numberOfLines={1}>
            {b.name}
          </Text>
          <Text style={ts.meta}>
            {b.trips} {b.trips === 1 ? "trip" : "trips"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  tiles: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  tile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  tileLabel: { color: colors.text },
  bleed: { marginHorizontal: -GUTTER },
  budsRow: { paddingHorizontal: GUTTER, gap: space.md },
  bud: { width: 72, alignItems: "center" },
  budRing: { borderWidth: 2, borderRadius: 32, padding: 2 },
  budName: { color: colors.text, marginTop: space.xs },
});
