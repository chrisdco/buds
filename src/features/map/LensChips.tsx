import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { LENS_LABEL, type Lens } from "@/modes/lenses";

// Depth-1 control for the route view (docs/route-view.md 5.2): one tap
// switches who's emphasized. Floats just above the sheet, left of the FAB
// column, over the live map. The selected chip carries its count
// ("Everyone 8"); a Focus chip appears while faces are picked and clears
// with one tap; a Re-center pill leads the row when a lens switch left the
// camera alone because you had just panned. The legend line lives in the
// sheet header.

export function LensChips({
  bottom,
  lenses,
  lens,
  onLens,
  count,
  suggest,
  focusLabel,
  onClearFocus,
  recenter,
  scrollToStartKey,
}: {
  bottom: number;
  lenses: Lens[];
  lens: Lens;
  onLens: (lens: Lens) => void;
  /** Routes the selected lens shows; null hides the count. */
  count: number | null;
  /** A lens to nudge toward with a dot (big groups -> Stragglers). */
  suggest: Lens | null;
  /** "Ana" / "3 people" while focus is on; null otherwise. */
  focusLabel: string | null;
  onClearFocus: () => void;
  /** Shown when non-null: the Re-center pill. */
  recenter: (() => void) | null;
  /** Bumped by the legend tap: scroll the row back to its start. */
  scrollToStartKey: number;
}) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollToStartKey > 0) scroll.current?.scrollTo({ x: 0, animated: true });
  }, [scrollToStartKey]);

  if (lenses.length < 2 && !focusLabel && !recenter) return null;
  const focusing = focusLabel != null;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {recenter && (
          <Pressable
            style={({ pressed }) => [styles.chip, styles.chipAccent, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Re-center the map for this view"
            testID="lens-recenter"
            hitSlop={6}
            onPress={recenter}
          >
            <Text style={[styles.text, styles.textAccent]}>Re-center</Text>
          </Pressable>
        )}
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
            const dot = l === suggest;
            const label = on && count != null ? `${LENS_LABEL[l]} ${count}` : LENS_LABEL[l];
            return (
              <Pressable
                key={l}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show ${LENS_LABEL[l]}${on && count != null ? `, ${count} routes` : ""}${dot ? ", suggested" : ""}`}
                testID={`lens-${l}`}
                hitSlop={6}
                onPress={() => onLens(l)}
              >
                <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
                {dot && <View style={styles.dot} testID={`lens-${l}-suggested`} />}
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Right inset leaves the FAB column (48 + 16 margin) clear.
  wrap: { position: "absolute", left: 0, right: 76 },
  row: { paddingHorizontal: 16, gap: 8 },
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
  chipAccent: { backgroundColor: colors.accent },
  text: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semiBold },
  textOn: { color: colors.bg },
  textAccent: { color: colors.onPrimary },
  close: { fontSize: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  pressed: { opacity: 0.75 },
});
