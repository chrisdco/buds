import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

// Trips tab (Uber Activity): upcoming planned trips, then every room this
// device created or joined, newest first.
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typeScale.display, styles.title]} accessibilityRole="header">
          Trips
        </Text>

        {/* Uber Activity: Upcoming first (scheduled reminders), then Past. */}
        {upcoming.length > 0 && (
          <>
            <SectionHeader title="Upcoming" style={styles.firstSection} />
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

        <SectionHeader title="Past" style={upcoming.length === 0 ? styles.firstSection : undefined} />
        {/* recents === null only before the startup preload resolves: render
        nothing (same black) rather than flashing the empty state. */}
        {recents === null ? null : past.length === 0 ? (
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
        ) : (
          <GroupedCard>
            {past.map((r, i) => (
              <ListRow
                key={r.id}
                icon={icons.group}
                title={r.name}
                sub={`${r.role === "traveler" ? "Traveler" : "Spectator"} · Tap to rejoin`}
                divider={i < past.length - 1}
                a11yLabel={`Rejoin ${r.name}`}
                a11yHint={`Code ${r.code}, joined as ${r.role}`}
                testID={`trips-rejoin-${r.code}`}
                onPress={() => openTrip(r)}
                trailing={
                  // Local forget only: the room is untouched, rejoin-by-code
                  // keeps working.
                  <CloseButton
                    label={`Remove ${r.name} from recents`}
                    testID={`trips-forget-${r.code}`}
                    onPress={() => forgetTrip(r)}
                  />
                }
              />
            ))}
          </GroupedCard>
        )}
        <ErrorText>{error}</ErrorText>
        <TabBarClearance />
      </ScrollView>
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
  pressed: { opacity: 0.75 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
  emptySub: { textAlign: "center", paddingHorizontal: space.lg },
  emptyActions: { flexDirection: "row", gap: space.sm, alignSelf: "stretch", marginTop: space.sm },
  emptyBtn: { flex: 1 },
});
