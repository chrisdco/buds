import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { LENS_LABEL, type Lens } from "@/modes/lenses";

// Depth-1 control for the route view (docs/route-view.md 5.2): one tap
// switches who's emphasized. Floats just above the sheet, left of the FAB
// column, over the live map. A Focus chip appears while faces are picked
// and clears with one tap. The legend underneath says what you're seeing.

export function LensChips({
  bottom,
  lenses,
  lens,
  onLens,
  focusLabel,
  onClearFocus,
  legend,
}: {
  bottom: number;
  lenses: Lens[];
  lens: Lens;
  onLens: (lens: Lens) => void;
  /** "Ana" / "3 people" while focus is on; null otherwise. */
  focusLabel: string | null;
  onClearFocus: () => void;
  /** "Showing 3 of 8"; null hides the line. */
  legend: string | null;
}) {
  if (lenses.length < 2 && !focusLabel) return null;
  const focusing = focusLabel != null;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {legend ? (
        <View style={styles.legend} pointerEvents="none">
          <Text style={styles.legendText} testID="lens-legend">
            {legend}
          </Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {focusing && (
          <Pressable
            style={({ pressed }) => [styles.chip, styles.chipOn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Stop focusing on ${focusLabel}`}
            testID="lens-focus"
            hitSlop={6}
            onPress={onClearFocus}
          >
            <Text style={[styles.text, styles.textOn]} numberOfLines={1}>
              {focusLabel}
            </Text>
            <Text style={[styles.text, styles.textOn, styles.close]}>{"✕"}</Text>
          </Pressable>
        )}
        {lenses.length >= 2 &&
          lenses.map((l) => {
            const on = !focusing && l === lens;
            return (
              <Pressable
                key={l}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show ${LENS_LABEL[l]}`}
                testID={`lens-${l}`}
                hitSlop={6}
                onPress={() => onLens(l)}
              >
                <Text style={[styles.text, on && styles.textOn]}>{LENS_LABEL[l]}</Text>
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Right inset leaves the FAB column (48 + 16 margin) clear.
  wrap: { position: "absolute", left: 0, right: 76, gap: 6 },
  row: { paddingHorizontal: 16, gap: 8 },
  legend: {
    alignSelf: "flex-start",
    marginLeft: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    elevation: 4,
  },
  legendText: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.medium },
  chip: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    elevation: 6,
  },
  chipOn: { backgroundColor: colors.text },
  text: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semiBold },
  textOn: { color: colors.bg },
  close: { fontSize: 12 },
  pressed: { opacity: 0.75 },
});
