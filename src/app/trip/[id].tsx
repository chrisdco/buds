import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { GroupedCard, IconTile, ListRow, NavHeader, SectionHeader, StickyFooter } from "@/components/layout";
import { PeepAvatar } from "@/components/PeepAvatar";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button, ErrorText, Screen } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
import { useRejoin } from "@/features/trips/useRejoin";
import { goAgainParams, shortDate } from "@/lib/tripHistory";
import { MODE_OPTIONS } from "@/modes/modeOptions";
import { useRecentsStore } from "@/stores/recentsStore";

// One past trip (Uber Activity's trip detail): what it was, where it went,
// who came. Rejoin if the room is still alive, or start a fresh room with
// the same mode and place. All local history: "Remove" never touches the
// server room.
export default function TripDetailScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");
  const trip = useRecentsStore((s) => s.recents?.find((r) => r.id === id));
  const [nowMs] = useState(() => Date.now());
  const { rejoin, error, busyId } = useRejoin();

  if (!trip) {
    return (
      <Screen>
        <NavHeader />
        <View style={styles.center}>
          <Text style={ts.section}>{error ? "Can't rejoin" : "Trip not found"}</Text>
          {/* A terminal rejoin error prunes the trip, which lands here: say
          why instead of silently popping. */}
          <Text style={[ts.rowSub, styles.centerSub]}>{error ?? "It may have been removed from your history."}</Text>
        </View>
      </Screen>
    );
  }

  const mode = MODE_OPTIONS.find((m) => m.id === trip.mode);
  const modeIcon = mode?.icon ?? icons.group;
  const when = shortDate(trip.lastAtMs, nowMs);
  const buds = trip.buds ?? [];

  const remove = () => {
    void useRecentsStore.getState().remove(trip.id);
    router.back();
  };

  return (
    <Screen>
      <NavHeader testID="trip-detail" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <IconTile>
            <AppSymbol name={modeIcon} fallback={modeIcon.fallback} size={22} tintColor={colors.text} />
          </IconTile>
          <Text style={[ts.display, styles.title]} accessibilityRole="header" numberOfLines={2}>
            {trip.name}
          </Text>
          <Text style={ts.rowSub}>{[mode?.label, when].filter(Boolean).join(" · ")}</Text>
        </View>

        <GroupedCard>
          {trip.destLabel ? <ListRow icon={icons.pin} title={trip.destLabel} sub="Destination" divider /> : null}
          <ListRow icon={icons.code} title="Room code" value={trip.code} divider />
          <ListRow
            icon={icons.profile}
            title="You joined as"
            value={trip.role === "traveler" ? "Traveler" : "Spectator"}
          />
        </GroupedCard>

        <SectionHeader title={buds.length > 0 ? `Who came · ${buds.length}` : "Who came"} />
        {buds.length > 0 ? (
          <GroupedCard>
            {buds.map((b, i) => (
              <ListRow
                key={b.userId}
                leading={<PeepAvatar seed={b.userId} size={36} />}
                title={b.name}
                divider={i < buds.length - 1}
              />
            ))}
          </GroupedCard>
        ) : (
          <Text style={ts.rowSub}>Just you on this one.</Text>
        )}

        <GroupedCard style={styles.removeCard}>
          <ListRow icon={icons.trash} title="Remove from history" destructive testID="trip-remove" onPress={remove} />
        </GroupedCard>
        <ErrorText>{error}</ErrorText>
      </ScrollView>

      <StickyFooter>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label="Go again"
              variant="ghost"
              testID="trip-go-again"
              onPress={() => router.push({ pathname: "/create", params: goAgainParams(trip) })}
            />
          </View>
          <View style={styles.action}>
            <Button
              label="Rejoin"
              busy={busyId === trip.id}
              testID="trip-rejoin"
              onPress={() => rejoin(trip)}
            />
          </View>
        </View>
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  hero: { gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  title: { marginTop: space.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  centerSub: { textAlign: "center" },
  removeCard: { marginTop: space.lg },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
});
