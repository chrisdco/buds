import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import {
  TRIP_PRESETS,
  type TripPreset,
  type TripPresetId,
} from "@/lib/tripPresets";

// Uber "For you" grid, shared by Home and Trips: one row of circular art
// tiles (scene zoomed to a focal window, badge overlapping the top edge,
// label below). Bitmaps are preloaded at startup, so the row paints complete
// in a single commit. testIDs stable for Maestro.
const CIRCLE = 92;

function PresetArtInner({ preset }: { preset: TripPreset }) {
  const { Art, vbW, vbH, fx, fy, window } = preset.image;
  const scale = CIRCLE / window;
  const w = vbW * scale;
  const h = vbH * scale;
  return (
    <View style={styles.circleArt}>
      <View
        style={{
          width: w,
          height: h,
          marginLeft: CIRCLE / 2 - fx * vbW * scale,
          marginTop: CIRCLE / 2 - fy * vbH * scale,
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

export function PresetCircles({ onSelect }: { onSelect: (id: TripPresetId) => void }) {
  return (
    <View style={styles.circles}>
      {TRIP_PRESETS.map((preset) => (
        <Pressable
          key={preset.id}
          style={({ pressed }) => [styles.circleCell, pressed && styles.circleCellPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Start a ${preset.title} trip`}
          accessibilityHint={preset.blurb}
          testID={`trips-template-${preset.id}`}
          hitSlop={8}
          onPress={() => onSelect(preset.id)}
        >
          <View>
            <PresetArt preset={preset} />
            {/* Badge overlaps the art's top edge like Uber's Promo pill
            (functional color only: danger = promo/popular). */}
            {preset.badge && (
              <View style={styles.circleBadge}>
                <Text style={styles.circleBadgeText}>{preset.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.circleLabel} numberOfLines={1}>
            {preset.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circles: { flexDirection: "row", gap: 12, marginTop: 4 },
  circleCell: { flex: 1, alignItems: "center" },
  circleCellPressed: { opacity: 0.75 },
  // Fixed circular window; the scene inside renders larger and
  // focal-cropped (PresetArt math). Paint is static per mount — no Fabric
  // radius hazard.
  circleArt: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circleBadge: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  circleBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.3,
  },
  circleLabel: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    marginTop: 8,
    textAlign: "center",
  },
});
