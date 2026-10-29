import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  GroupedCard,
  IconTile,
  ListRow,
  SectionHeader,
  TabBarClearance,
} from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button, ErrorText, Screen } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { PresetCircles } from "@/features/trips/PresetCircles";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { isTerminalJoinError, rejoinErrorMessage } from "@/lib/joinErrors";
import { countdownLabel } from "@/lib/planned";
import { TRIP_PRESETS, destCreateParams, presetCreateParams, type TripPresetId } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { usePlacesStore } from "@/stores/placesStore";
import { usePlannedStore } from "@/stores/plannedStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// Uber home grammar (ref: Uber Home): the "Where to?" box is the one primary
// entry with Later nested inside it; one grouped card holds the live room +
// recent places + planned trips; "For you" is a circle grid of trip presets
// and shortcuts (join, scan, new room). No form fields here — your name is
// asked where it's needed (create / join).
export default function HomeScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const sessionError = useSessionStore((s) => s.error);
  const recentPlaces = usePlacesStore((s) => s.recents);
  const planned = usePlannedStore((s) => s.planned);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomRef | null>(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  // Double-tap guard: priming awaits a sheet + user decision, so two rapid
  // taps would otherwise push duplicate routes.
  const navBusy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void getActiveRoom().then(setActiveRoom);
      void usePlacesStore.getState().refresh();
      void usePlannedStore.getState().refresh();
      setNowMs(Date.now());
    }, []),
  );

  // Location priming (double-prompt): our sheet explains the exchange at the
  // moment of intent; the OS dialog follows later at room join. Either button
  // proceeds — "Not now" is harmless, never a block.
  const primeLocation = async (): Promise<void> => {
    const session = useSessionStore.getState();
    if (session.primedLocation) return;
    session.setPrimed("location");
    await useUiStore.getState().requestConfirm({
      title: "Share your live location?",
      body: "Buds shares your position with members of rooms you join — nothing leaves the room.",
      confirmLabel: "Continue",
      cancelLabel: "Not now",
      destructive: false,
    });
  };

  const guardedPush = (go: () => void) => {
    if (navBusy.current) return;
    navBusy.current = true;
    void (async () => {
      try {
        await primeLocation();
        go();
      } finally {
        navBusy.current = false;
      }
    })();
  };

  const pressCreate = () => guardedPush(() => router.push("/create"));
  const pressJoin = (scan = false) =>
    guardedPush(() => router.push(scan ? { pathname: "/join", params: { scan: "1" } } : "/join"));

  const startFromPreset = (presetId: TripPresetId) => {
    const preset = TRIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    router.push({ pathname: "/create", params: presetCreateParams(preset, displayName) });
  };

  const planToPlace = (place: { lat: number; lng: number; name: string }) => {
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

  const rejoin = async () => {
    // Same double-tap guard as create/join: the RPC round-trip outlives the
    // busy render, and two taps would push the room twice.
    if (!activeRoom || navBusy.current) return;
    navBusy.current = true;
    setRejoinBusy(true);
    setRejoinError(null);
    try {
      // Re-validate membership through join_room (idempotent for active members).
      const result = await roomsRpc.joinRoom({
        code: activeRoom.code,
        displayName: displayName.trim() || "Anonymous",
        role: activeRoom.role,
      });
      if (result.ok) {
        router.push(`/room/${result.room.id}`);
        return;
      }
      // Only forget the room when it can never be rejoined; a network blip
      // keeps the card so the next tap can retry.
      if (isTerminalJoinError(result.error)) {
        clearActiveRoom();
        setActiveRoom(null);
      }
      setRejoinError(rejoinErrorMessage(result.error));
    } finally {
      navBusy.current = false;
      setRejoinBusy(false);
    }
  };

  const recentShown = (recentPlaces ?? []).slice(0, 2);
  const plannedShown = planned ?? [];
  const hasGroup = activeRoom != null || recentShown.length > 0 || plannedShown.length > 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Uber home: the search box IS the screen's one primary action,
        with "Later" nested inside it (two pressables side by side in one
        container, never nested, so both taps stay isolated). */}
        <View style={styles.searchBox}>
          <Pressable
            style={({ pressed }) => [styles.searchMain, pressed && styles.pressed]}
            accessibilityRole="search"
            accessibilityLabel="Where to? Search for a destination"
            accessibilityHint="Searches places, then creates a room around the pick"
            testID="home-search"
            onPress={() => router.push("/search")}
          >
            <AppSymbol name={icons.search} fallback={icons.search.fallback} size={24} tintColor={colors.text} />
            <Text style={styles.searchPlaceholder}>Where to?</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.laterPill, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Schedule for later"
            accessibilityHint="Pick a place and a reminder time"
            testID="home-later"
            onPress={() => router.push({ pathname: "/search", params: { when: "later" } })}
          >
            <AppSymbol name={icons.calendar} fallback={icons.calendar.fallback} size={18} tintColor={colors.text} />
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>

        {/* One grouped card (Uber's recents block): the live room first,
        then recent places, then planned trips — one row anatomy. */}
        {hasGroup && (
          <GroupedCard style={styles.group}>
            {activeRoom && (
              <ListRow
                leading={
                  <IconTile>
                    {rejoinBusy ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <AppSymbol name={icons.group} fallback={icons.group.fallback} size={20} tintColor={colors.text} />
                    )}
                  </IconTile>
                }
                title={activeRoom.name}
                sub={`Rejoin · ${activeRoom.role === "traveler" ? "Traveler" : "Spectator"}`}
                chevron
                divider={recentShown.length > 0 || plannedShown.length > 0}
                a11yLabel={`Rejoin ${activeRoom.name}`}
                a11yHint={`Code ${activeRoom.code}, joined as ${activeRoom.role}`}
                testID="home-rejoin"
                onPress={() => void rejoin()}
              />
            )}
            {recentShown.map((p, i) => (
              <ListRow
                key={`${p.lat}-${p.lng}-${i}`}
                icon={icons.clock}
                title={p.name}
                sub={p.address || null}
                chevron
                divider={i < recentShown.length - 1 || plannedShown.length > 0}
                a11yLabel={`Plan a trip to ${p.name}`}
                testID={`home-recent-place-${i}`}
                onPress={() => planToPlace(p)}
              />
            ))}
            {plannedShown.map((t, i) => (
              <ListRow
                key={t.id}
                icon={icons.calendar}
                title={t.place.name}
                sub={`${nowMs === 0 ? "Scheduled" : countdownLabel(t.atMs, nowMs)}${t.notifId ? "" : " · no reminder"}`}
                divider={i < plannedShown.length - 1}
                a11yLabel={`Start trip to ${t.place.name} now`}
                testID={`home-planned-start-${t.id}`}
                onPress={() => planToPlace({ lat: t.place.lat, lng: t.place.lng, name: t.place.name })}
                trailing={
                  <Pressable
                    style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel planned trip to ${t.place.name}`}
                    testID={`home-planned-cancel-${t.id}`}
                    hitSlop={8}
                    onPress={() => void usePlannedStore.getState().cancel(t.id)}
                  >
                    <AppSymbol name={icons.close} fallback={icons.close.fallback} size={18} tintColor={colors.textDim} />
                  </Pressable>
                }
              />
            ))}
          </GroupedCard>
        )}
        <ErrorText>{rejoinError}</ErrorText>

        <SectionHeader title="For you" />
        <PresetCircles
          onSelect={startFromPreset}
          extras={[
            {
              key: "join",
              title: "Join",
              icon: icons.code,
              a11yHint: "Enter a 6-letter room code",
              testID: "home-join",
              onPress: () => pressJoin(),
            },
            {
              key: "scan",
              title: "Scan QR",
              icon: icons.qr,
              a11yHint: "Join by scanning an invite code",
              testID: "home-scan",
              onPress: () => pressJoin(true),
            },
            {
              key: "new",
              title: "New room",
              icon: icons.plus,
              a11yHint: "Start a blank room and pick everything yourself",
              testID: "home-create",
              onPress: () => pressCreate(),
            },
            {
              key: "later",
              title: "Plan later",
              icon: icons.clock,
              a11yHint: "Pick a place and get a reminder",
              testID: "home-plan-later",
              onPress: () => router.push({ pathname: "/search", params: { when: "later" } }),
            },
          ]}
        />

        {sessionError && (
          <View style={styles.sessionError}>
            <ErrorText>{sessionError}</ErrorText>
            <Button
              label="Retry connection"
              variant="ghost"
              size="compact"
              onPress={() => void useSessionStore.getState().init()}
            />
          </View>
        )}
        <TabBarClearance />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    minHeight: 64,
    paddingLeft: space.lg,
    paddingRight: space.sm,
  },
  searchMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64 },
  searchPlaceholder: { color: colors.text, fontSize: 20, fontFamily: fontFamily.medium },
  laterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  laterText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  group: { marginTop: space.lg },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sessionError: { marginTop: space.lg },
});
