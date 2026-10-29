import { memo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AppSymbol, type AppSymbolName } from "@/components/Symbol";
import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { TRIP_PRESETS, type TripPreset, type TripPresetId } from "@/lib/tripPresets";

// Uber "For you" grid: four circles per row, wrapping, one-word label under
// each and an optional badge overlapping the top edge. Trip presets render
// their art; shortcut tiles (join, scan, new room…) render an icon. Circles
// size to the screen so four always fit. testIDs stable for Maestro.

const GUTTER = 20; // Screen's horizontal padding
const GAP = 12;
const COLUMNS = 4;

export interface ForYouTile {
  key: string;
  title: string;
  icon: AppSymbolName & { fallback: string };
  badge?: string;
  a11yHint?: string;
  testID: string;
  onPress: () => void;
}

function PresetArtInner({ preset, size }: { preset: TripPreset; size: number }) {
  const { Art, vbW, vbH, fx, fy, window } = preset.image;
  const scale = size / window;
  const w = vbW * scale;
  const h = vbH * scale;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={{
          width: w,
          height: h,
          marginLeft: size / 2 - fx * vbW * scale,
          marginTop: size / 2 - fy * vbH * scale,
        }}
      >
        <Art width={w} />
      </View>
    </View>
  );
}

// Presets are module constants (stable identity), so memo holds across
// refetches — the art mounts once and never re-executes.
const PresetArt = memo(PresetArtInner);

function Cell({
  size,
  title,
  badge,
  a11yLabel,
  a11yHint,
  testID,
  onPress,
  children,
}: {
  size: number;
  title: string;
  badge?: string;
  a11yLabel: string;
  a11yHint?: string;
  testID: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, { width: size }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      testID={testID}
      hitSlop={4}
      onPress={onPress}
    >
      <View>
        {children}
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function PresetCircles({
  onSelect,
  extras = [],
}: {
  onSelect: (id: TripPresetId) => void;
  /** Shortcut tiles appended after the presets (Uber's Reserve / Rentals). */
  extras?: ForYouTile[];
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  return (
    <View style={styles.grid}>
      {TRIP_PRESETS.map((preset) => (
        <Cell
          key={preset.id}
          size={size}
          title={preset.title}
          badge={preset.badge}
          a11yLabel={`Start a ${preset.title} trip`}
          a11yHint={preset.blurb}
          testID={`trips-template-${preset.id}`}
          onPress={() => onSelect(preset.id)}
        >
          <PresetArt preset={preset} size={size} />
        </Cell>
      ))}
      {extras.map((t) => (
        <Cell
          key={t.key}
          size={size}
          title={t.title}
          badge={t.badge}
          a11yLabel={t.title}
          a11yHint={t.a11yHint}
          testID={t.testID}
          onPress={t.onPress}
        >
          <View style={[styles.circle, styles.iconCircle, { width: size, height: size, borderRadius: size / 2 }]}>
            <AppSymbol name={t.icon} fallback={t.icon.fallback} size={Math.round(size * 0.36)} tintColor={colors.text} />
          </View>
        </Cell>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: space.lg },
  cell: { alignItems: "center" },
  pressed: { opacity: 0.75 },
  // Fixed circular window; preset scenes render larger and focal-cropped.
  circle: { overflow: "hidden", backgroundColor: colors.surfaceAlt },
  iconCircle: { alignItems: "center", justifyContent: "center" },
  // Uber's Promo pill: overlaps the circle's top edge, functional red.
  badge: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: colors.text, fontSize: 12, fontFamily: fontFamily.semiBold },
  label: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.medium,
    marginTop: space.sm,
    textAlign: "center",
  },
});
