import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GroupedCard, ListRow, SectionHeader, TabBarClearance } from "@/components/layout";
import { Button, ErrorText, Screen } from "@/components/ui";
import { WaitingPeepArt } from "@/components/illustrations/WaitingPeepArt";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, space } from "@/constants/theme";
import { typeScale } from "@/constants/typography";
import { countdownLabel } from "@/lib/planned";
import { destCreateParams } from "@/lib/tripPresets";
import { usePlannedStore } from "@/stores/plannedStore";
import { setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { isTerminalJoinError, rejoinErrorMessage } from "@/lib/joinErrors";
import { useRecentsStore } from "@/stores/recentsStore";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import { TabScrollView } from "@/features/nav/TabScrollView";
import { AvatarStack } from "@/features/trips/AvatarStack";
import { StatTiles } from "@/features/trips/StatTiles";
import { budsLabel, groupByRecency, shortDate, tripStats } from "@/lib/tripHistory";
import { MODE_OPTIONS } from "@/modes/modeOptions";

// Trips tab (Uber Activity): counts at a glance, upcoming planned trips,
// then every room this device created or joined, bucketed by recency, each
// row saying where it went, with whom and when.
// Rejoin re-validates membership through join_room (idempotent) and prunes
// dead rooms inline — the list never shows a room you can't enter.
export default function TripsScreen() {
  const router = useRouter();
  // Resident recents (loaded once at startup): rows paint on first commit,
  // and focus refetches that change nothing don't re-render at all.
  const recents = useRecentsStore((s) => s.recents);
  const [error, setError] = useState<string | null>(null);
  // Double-tap guard: joinRoom awaits the network, so two rapid taps would
  // otherwise fire duplicate joins and competing replaces.
  const openBusy = useRef(false);

  const planned = usePlannedStore((s) => s.planned);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void useRecentsStore.getState().refresh();
      void usePlannedStore.getState().refresh();
      setNowMs(Date.now());
    }, []),
  );

  // A planned trip starts like a search pick: create around its place.
  const startPlanned = (place: { lat: number; lng: number; name: string }) => {
    router.push({
      pathname: "/create",
      params: {
        mode: "converge",
        limit: "10",
        duration: "12",
        name: place.name.slice(0, 60),
        ...destCreateParams({ lat: place.lat, lng: place.lng, label: place.name }),
      },
    });
  };

  const forgetTrip = (ref: ActiveRoomRef) => {
    void useRecentsStore.getState().remove(ref.id);
  };

  const openTrip = (ref: ActiveRoomRef) => {
    void (async () => {
      if (openBusy.current) return;
      openBusy.current = true;
      try {
        setError(null);
        const name = useSessionStore.getState().displayName.trim() || "Anonymous";
        const result = await roomsRpc.joinRoom({ code: ref.code, displayName: name, role: ref.role });
        if (result.ok) {
          setActiveRoom({
            id: result.room.id,
            code: result.room.code,
            name: result.room.name,
            role: result.member.role,
          });
          router.replace(`/room/${result.room.id}`);
        } else {
          if (isTerminalJoinError(result.error)) {
            void useRecentsStore.getState().remove(ref.id);
          }
          setError(rejoinErrorMessage(result.error));
        }
      } finally {
        openBusy.current = false;
      }
    })();
  };

  const upcoming = planned ?? [];
  const past = recents ?? [];
  const stats = tripStats(past);
  const sections = groupByRecency(past, nowMs);

  return (
    <Screen>
      <TabScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typeScale.display, styles.title]} accessibilityRole="header">
          Trips
        </Text>

        {past.length > 0 && (
          <View style={styles.stats}>
            <StatTiles
              stats={[
                { key: "trips", value: stats.trips, label: stats.trips === 1 ? "Trip" : "Trips" },
                { key: "buds", value: stats.buds, label: stats.buds === 1 ? "Bud" : "Buds" },
                { key: "places", value: stats.places, label: stats.places === 1 ? "Place" : "Places" },
              ]}
            />
          </View>
        )}

        {/* Uber Activity: Upcoming first (scheduled reminders), then Past. */}
        {upcoming.length > 0 && (
          <>
            <SectionHeader title="Upcoming" style={past.length > 0 ? undefined : styles.firstSection} />
            <GroupedCard>
              {upcoming.map((t, i) => (
                <ListRow
                  key={t.id}
                  icon={icons.calendar}
                  title={t.place.name}
                  sub={`${countdownLabel(t.atMs, nowMs)}${t.notifId ? "" : " · no reminder"}`}
                  divider={i < upcoming.length - 1}
                  a11yLabel={`Start trip to ${t.place.name} now`}
                  testID={`trips-planned-${t.id}`}
                  onPress={() => startPlanned(t.place)}
                  trailing={
                    <CloseButton
                      label={`Cancel planned trip to ${t.place.name}`}
                      testID={`trips-planned-cancel-${t.id}`}
                      onPress={() => void usePlannedStore.getState().cancel(t.id)}
                    />
                  }
                />
              ))}
            </GroupedCard>
          </>
        )}

        {/* recents === null only before the startup preload resolves: render
        nothing (same black) rather than flashing the empty state. */}
        {recents === null ? null : past.length === 0 ? (
          <>
            <SectionHeader title="Past" style={upcoming.length === 0 ? styles.firstSection : undefined} />
            <View style={styles.empty} testID="trips-empty">
              <WaitingPeepArt width={120} />
              <Text style={typeScale.rowTitle}>No trips yet</Text>
              <Text style={[typeScale.rowSub, styles.emptySub]}>
                Rooms you create or join show up here so you can jump back in.
              </Text>
              <View style={styles.emptyActions}>
                <View style={styles.emptyBtn}>
                  <Button
                    label="New room"
                    size="compact"
                    testID="trips-empty-create"
                    onPress={() => router.push("/create")}
                  />
                </View>
                <View style={styles.emptyBtn}>
                  <Button
                    label="Join"
                    size="compact"
                    variant="ghost"
                    testID="trips-empty-join"
                    onPress={() => router.push("/join")}
                  />
                </View>
              </View>
            </View>
          </>
        ) : (
          sections.map((section) => (
            <View key={section.title}>
              <SectionHeader title={section.title} />
              <GroupedCard>
                {section.rooms.map((r, i) => {
                  const mode = MODE_OPTIONS.find((m) => m.id === r.mode);
                  const when = shortDate(r.lastAtMs, nowMs);
                  const where = r.destLabel ? `to ${r.destLabel}` : (mode?.label ?? null);
                  const who = budsLabel(r.buds);
                  return (
                    <ListRow
                      key={r.id}
                      icon={mode?.icon ?? icons.group}
                      title={r.name}
                      sub={[when, where].filter(Boolean).join(" · ") || "Tap to rejoin"}
                      divider={i < section.rooms.length - 1}
                      a11yLabel={`Rejoin ${r.name}${who ? `, ${who}` : ""}`}
                      a11yHint={`Code ${r.code}, joined as ${r.role}`}
                      testID={`trips-rejoin-${r.code}`}
                      onPress={() => openTrip(r)}
                      trailing={
                        <View style={styles.trailing}>
                          <AvatarStack buds={r.buds ?? []} size={24} />
                          {/* Local forget only: the room is untouched,
                          rejoin-by-code keeps working. */}
                          <CloseButton
                            label={`Remove ${r.name} from recents`}
                            testID={`trips-forget-${r.code}`}
                            onPress={() => forgetTrip(r)}
                          />
                        </View>
                      }
                    />
                  );
                })}
              </GroupedCard>
            </View>
          ))
        )}
        <ErrorText>{error}</ErrorText>

        {past.length > 0 && (
          <>
            <SectionHeader title="Plan your next" />
            <GroupedCard>
              <ListRow
                icon={icons.plus}
                title="New room"
                sub="Pick a mode and share the code"
                chevron
                divider
                testID="trips-new"
                onPress={() => router.push("/create")}
              />
              <ListRow
                icon={icons.code}
                title="Join with a code"
                sub="Six letters from a friend"
                chevron
                divider
                testID="trips-join"
                onPress={() => router.push("/join")}
              />
              <ListRow
                icon={icons.calendar}
                title="Plan for later"
                sub="Pick a place, get a reminder"
                chevron
                testID="trips-later"
                onPress={() => router.push({ pathname: "/search", params: { when: "later" } })}
              />
            </GroupedCard>
          </>
        )}
        <TabBarClearance />
      </TabScrollView>
    </Screen>
  );
}

function CloseButton({ label, testID, onPress }: { label: string; testID: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      onPress={onPress}
    >
      <AppSymbol name={icons.close} fallback={icons.close.fallback} size={18} tintColor={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.lg },
  firstSection: { marginTop: space.lg },
  stats: { marginTop: space.lg },
  trailing: { flexDirection: "row", alignItems: "center", gap: space.xs },
  pressed: { opacity: 0.75 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
  emptySub: { textAlign: "center", paddingHorizontal: space.lg },
  emptyActions: { flexDirection: "row", gap: space.sm, alignSelf: "stretch", marginTop: space.sm },
  emptyBtn: { flex: 1 },
});
