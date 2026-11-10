import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { GroupedCard, ListRow, NavHeader, SectionHeader, StickyFooter } from "@/components/layout";
import { PeepAvatar } from "@/components/PeepAvatar";
import { icons } from "@/components/Symbol";
import { Button, Screen } from "@/components/ui";
import { colorForUser, space } from "@/constants/theme";

import { shortDate, tripsWith } from "@/lib/tripHistory";
import { MODE_OPTIONS } from "@/modes/modeOptions";
import { useRecentsStore } from "@/stores/recentsStore";
import { makeStyles, useTypeScale } from "@/theme";

// One bud: the trips you shared, newest first, and a way to start the next
// one. There are no accounts, so we can't ping them directly; "New room"
// goes to create, and the room's invite sheet sends them the code.
export default function BudScreen() {
  const styles = useStyles();
  const ts = useTypeScale();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  const recents = useRecentsStore((s) => s.recents);
  const [nowMs] = useState(() => Date.now());
  const trips = tripsWith(recents ?? [], id);
  // Newest room carries their latest display name.
  const name = trips[0]?.buds?.find((b) => b.userId === id)?.name;

  if (!name) {
    return (
      <Screen>
        <NavHeader />
        <View style={styles.center}>
          <Text style={ts.section}>No trips together</Text>
          <Text style={[ts.rowSub, styles.centerSub]}>Rooms you share show up here.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader testID="bud-detail" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.ring, { borderColor: colorForUser(id) }]}>
            <PeepAvatar seed={id} size={88} />
          </View>
          <Text style={ts.display} accessibilityRole="header" numberOfLines={1}>
            {name}
          </Text>
          <Text style={ts.rowSub}>
            {trips.length} {trips.length === 1 ? "trip" : "trips"} together
          </Text>
        </View>

        <SectionHeader title="Trips together" />
        <GroupedCard>
          {trips.map((r, i) => {
            const mode = MODE_OPTIONS.find((m) => m.id === r.mode);
            const where = r.destLabel ? `to ${r.destLabel}` : (mode?.label ?? null);
            return (
              <ListRow
                key={r.id}
                icon={mode?.icon ?? icons.group}
                title={r.name}
                sub={[shortDate(r.lastAtMs, nowMs), where].filter(Boolean).join(" · ") || null}
                chevron
                divider={i < trips.length - 1}
                testID={`bud-trip-${r.code}`}
                onPress={() => router.push(`/trip/${r.id}`)}
              />
            );
          })}
        </GroupedCard>
      </ScrollView>

      <StickyFooter summary={`Share the code with ${name} once it's made`}>
        <Button label="New room" testID="bud-new-room" onPress={() => router.push("/create")} />
      </StickyFooter>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  scroll: { paddingBottom: space.xl },
  hero: { alignItems: "center", gap: space.sm, marginTop: space.md, marginBottom: space.md },
  ring: { borderWidth: 3, borderRadius: 50, padding: 3, marginBottom: space.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  centerSub: { textAlign: "center" },
}));
