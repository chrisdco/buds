import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { IconTile } from "@/components/layout";
import { icons } from "@/components/Symbol";
import { colors, radius, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
import { TRIP_IDEAS, type TripIdea } from "@/features/home/tripIdeas";

// Below-the-fold Home sections (Uber's carousels under "For you"). Both
// bleed to the screen edge: the Screen gutter is cancelled on the scroller
// and re-added as content padding, so the first card lines up with the
// rest of the page and the next one peeks in from the right.

const GUTTER = 20; // Screen's horizontal padding

/** Wide art cards, one and a bit per screen, so the scroll is discoverable. */
export function IdeaCarousel({ onSelect }: { onSelect: (idea: TripIdea) => void }) {
  const { width } = useWindowDimensions();
  const cardW = Math.round((width - GUTTER * 2) * 0.82);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
      snapToInterval={cardW + space.md}
      decelerationRate="fast"
    >
      {TRIP_IDEAS.map((idea) => (
        <Pressable
          key={idea.id}
          style={({ pressed }) => [{ width: cardW }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={idea.title}
          accessibilityHint={`${idea.sub}. Opens a new room, prefilled.`}
          testID={`home-idea-${idea.id}`}
          onPress={() => onSelect(idea)}
        >
          <View style={[styles.art, { backgroundColor: idea.tint }]}>
            <View style={styles.artInner}>
              <idea.Art width={Math.round(cardW * idea.artScale)} />
            </View>
          </View>
          <Text style={[ts.rowTitle, styles.cardTitle]} numberOfLines={1}>
            {idea.title}
          </Text>
          <Text style={ts.rowSub} numberOfLines={1}>
            {idea.sub}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const PROMISES = [
  { key: "room", icon: icons.group, title: "Only your room", sub: "Nobody outside the room sees you" },
  { key: "expire", icon: icons.clock, title: "Rooms expire", sub: "Sharing stops when the trip ends" },
  { key: "account", icon: icons.profile, title: "No account", sub: "Anonymous to this device" },
] as const;

/** Uber "Ways to save" slot: three compact promise tiles, not a wall of text. */
export function PrivacyRow() {
  const { width } = useWindowDimensions();
  const tileW = Math.round((width - GUTTER * 2) * 0.46);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
    >
      {PROMISES.map((p) => (
        <View key={p.key} style={[styles.promise, { width: tileW }]} accessible accessibilityLabel={`${p.title}. ${p.sub}`}>
          <IconTile icon={p.icon} round />
          <Text style={[ts.rowTitle, styles.promiseTitle]} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={ts.meta} numberOfLines={2}>
            {p.sub}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  bleed: { marginHorizontal: -GUTTER },
  row: { paddingHorizontal: GUTTER, gap: space.md },
  art: {
    height: 160,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  // Scenes sit bottom-right like a photo crop, leaving the left calm.
  artInner: { position: "absolute", right: space.md, bottom: 0 },
  cardTitle: { marginTop: space.sm + 2 },
  promise: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
  },
  promiseTitle: { marginTop: space.sm },
});
