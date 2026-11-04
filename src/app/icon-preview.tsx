import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import { NavHeader, SectionHeader } from "@/components/layout";
import { Screen } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";

// Temporary design tool (Settings → Preview app icons): the icon candidates
// at real launcher sizes on a light and a dark wallpaper, so the pick is made
// on the phone rather than on a monitor. Delete this screen and
// assets/icon-candidates once an icon is chosen.

type Shape = "ios" | "android";

const CANDIDATES: { key: string; name: string; source: ImageSourcePropType }[] = [
  { key: "fraunces-black-b", name: "Fraunces Black b", source: require("../../assets/icon-candidates/fraunces-black-b.png") },
  { key: "fraunces-black-buds", name: "Fraunces Black buds", source: require("../../assets/icon-candidates/fraunces-black-buds.png") },
  { key: "fraunces-regular-b", name: "Fraunces Regular b", source: require("../../assets/icon-candidates/fraunces-regular-b.png") },
  { key: "fraunces-regular-buds", name: "Fraunces Regular buds", source: require("../../assets/icon-candidates/fraunces-regular-buds.png") },
  { key: "geist-serif-b", name: "Geist Serif b", source: require("../../assets/icon-candidates/geist-serif-b.png") },
  { key: "geist-serif-buds", name: "Geist Serif buds", source: require("../../assets/icon-candidates/geist-serif-buds.png") },
];

/** iOS squircle ≈ 22.4% corner radius; Android launchers default to a circle. */
function Icon({ source, size, shape }: { source: ImageSourcePropType; size: number; shape: Shape }) {
  const r = shape === "ios" ? size * 0.224 : size / 2;
  // Android adaptive icons zoom the art inside the mask; mimic that crop.
  const zoom = shape === "android" ? 1.18 : 1;
  return (
    <View style={{ width: size, height: size, borderRadius: r, overflow: "hidden", backgroundColor: "#000" }}>
      <Image
        source={source}
        style={{ width: size * zoom, height: size * zoom, marginLeft: (size - size * zoom) / 2, marginTop: (size - size * zoom) / 2 }}
      />
    </View>
  );
}

export default function IconPreviewScreen() {
  const [shape, setShape] = useState<Shape>("ios");
  const [picked, setPicked] = useState(CANDIDATES[0].key);
  const current = CANDIDATES.find((c) => c.key === picked) ?? CANDIDATES[0];

  return (
    <Screen>
      <NavHeader title="App icon" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.segment}>
          {(["ios", "android"] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.segmentItem, shape === s && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: shape === s }}
              onPress={() => setShape(s)}
            >
              <Text style={[styles.segmentText, shape === s && styles.segmentTextOn]}>
                {s === "ios" ? "iOS shape" : "Android circle"}
              </Text>
            </Pressable>
          ))}
        </View>

        {(["dark", "light"] as const).map((wall) => (
          <View key={wall} style={[styles.wallpaper, wall === "light" ? styles.wallLight : styles.wallDark]}>
            {CANDIDATES.map((c) => (
              <Pressable
                key={c.key}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                onPress={() => setPicked(c.key)}
              >
                <Icon source={c.source} size={60} shape={shape} />
                <Text style={[styles.cellLabel, wall === "light" && styles.cellLabelDark]} numberOfLines={1}>
                  Buds
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        <SectionHeader title={current.name} />
        <View style={styles.hero}>
          <Icon source={current.source} size={160} shape={shape} />
          <View style={styles.smalls}>
            <Icon source={current.source} size={60} shape={shape} />
            <Icon source={current.source} size={40} shape={shape} />
            <Icon source={current.source} size={24} shape={shape} />
          </View>
        </View>
        <Text style={[typeScale.meta, styles.hint]}>
          Tap any icon above to inspect it. Sizes: launcher (60), Settings/Spotlight (40), notification (24).
        </Text>

        <View style={styles.list}>
          {CANDIDATES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.listRow, c.key === picked && styles.listRowOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: c.key === picked }}
              onPress={() => setPicked(c.key)}
            >
              <Icon source={c.source} size={44} shape={shape} />
              <Text style={styles.listName}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: space.md,
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.raised },
  segmentText: { color: colors.textDim, fontSize: 15, fontFamily: fontFamily.medium },
  segmentTextOn: { color: colors.text, fontFamily: fontFamily.semiBold },
  wallpaper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: space.md,
    padding: space.md,
    borderRadius: 20,
    marginBottom: space.md,
  },
  wallDark: { backgroundColor: "#1F2A3A" },
  wallLight: { backgroundColor: "#D9DEE6" },
  cell: { width: "30%", alignItems: "center", gap: 6 },
  cellLabel: { color: "#FFFFFF", fontSize: 12, fontFamily: fontFamily.medium },
  cellLabelDark: { color: "#111111" },
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.sm },
  smalls: { gap: space.md, alignItems: "center" },
  hint: { marginTop: space.md },
  list: { marginTop: space.lg, gap: space.sm },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  listRowOn: { borderColor: colors.text },
  listName: { color: colors.text, fontSize: 17, fontFamily: fontFamily.semiBold },
});
