import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  GroupedCard,
  IconTile,
  ListRow,
  SectionHeader,
  TabBarClearance,
} from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { ErrorText, Screen } from "@/components/ui";
import { radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { IdeaCarousel, PrivacyRow } from "@/features/home/HomeSections";
import { ideaCreateParams, type TripIdea } from "@/features/home/tripIdeas";
import { PresetCircles } from "@/features/trips/PresetCircles";
import { TabScrollView } from "@/features/nav/TabScrollView";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { isTerminalJoinError, rejoinErrorMessage } from "@/lib/joinErrors";
import { countdownLabel } from "@/lib/planned";
import { TRIP_PRESETS, placeCreateParams, presetCreateParams, type TripPresetId } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { usePlacesStore } from "@/stores/placesStore";
import { usePlannedStore } from "@/stores/plannedStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { makeStyles, useColors } from "@/theme";
import { hasLocationPermission } from "@/services/location/permissions";

// Uber home grammar (ref: Uber Home): the "Where to?" box is the one primary
// entry with Later nested inside it; one grouped card holds the live room +
// recent places + planned trips; "For you" is a circle grid of trip presets
// and shortcuts (join, new room, share live); each action has one home
// here (Later only in the box, scanning inside Join). No form fields; your name is
// asked where it's needed (create / join).
export default function HomeScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const sessionError = useSessionStore((s) => s.error);
  const recentPlaces = usePlacesStore((s) => s.recents);
  const saved = usePlacesStore((s) => s.saved);
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
  // proceeds — "Not now" is harmless, never a block. Skipped outright when
  // the phone already allows location: nothing left to explain.
  const primeLocation = async (): Promise<void> => {
    const session = useSessionStore.getState();
    if (session.primedLocation) return;
    if (await hasLocationPermission("foreground")) {
      session.setPrimed("location");
      return;
    }
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
  const pressJoin = () => guardedPush(() => router.push("/join"));

  const startFromPreset = (presetId: TripPresetId) => {
    const preset = TRIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    router.push({ pathname: "/create", params: presetCreateParams(preset, displayName) });
  };

  const startFromIdea = (idea: TripIdea) =>
    guardedPush(() => router.push({ pathname: "/create", params: ideaCreateParams(idea, displayName) }));

  const planToPlace = (place: { lat: number; lng: number; name: string }) =>
    router.push({ pathname: "/create", params: placeCreateParams(place) });

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

  // Saved Home/Work lead the card (Uber's pinned places), then recents
  // that aren't already one of them, then planned trips.
  const savedShown = (
    [
      ["home", saved.home],
      ["work", saved.work],
    ] as const
  ).flatMap(([slot, ref]) => (ref ? [{ slot, ref }] : []));
  const isSaved = (p: { lat: number; lng: number }) =>
    savedShown.some(({ ref }) => ref.lat === p.lat && ref.lng === p.lng);
  const recentShown = (recentPlaces ?? []).filter((p) => !isSaved(p)).slice(0, 3);
  const plannedShown = planned ?? [];
  const placeRows = savedShown.length + recentShown.length + plannedShown.length;
  const hasGroup = activeRoom != null || placeRows > 0;

  return (
    <Screen>
      <TabScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* No session = nothing works (rooms, joins), so the failure sits
        first, as one tappable row, not below the fold. */}
        {sessionError && (
          <GroupedCard style={styles.sessionError}>
            <ListRow
              icon={icons.warning}
              title="Not connected"
              sub={sessionError}
              value="Retry"
              a11yLabel={`Not connected. ${sessionError} Tap to retry.`}
              testID="home-session-retry"
              onPress={() => void useSessionStore.getState().init()}
            />
          </GroupedCard>
        )}
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
                divider={placeRows > 0}
                a11yLabel={`Rejoin ${activeRoom.name}`}
                a11yHint={`Code ${activeRoom.code}, joined as ${activeRoom.role}`}
                testID="home-rejoin"
                onPress={() => void rejoin()}
              />
            )}
            {savedShown.map(({ slot, ref }, i) => (
              <ListRow
                key={slot}
                icon={slot === "home" ? icons.home : icons.work}
                title={slot === "home" ? "Home" : "Work"}
                sub={ref.name}
                chevron
                divider={i < savedShown.length - 1 || recentShown.length > 0 || plannedShown.length > 0}
                a11yLabel={`Plan a trip to ${slot}, ${ref.name}`}
                testID={`home-saved-${slot}`}
                onPress={() => planToPlace(ref)}
              />
            ))}
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
                chevron
                divider={i < plannedShown.length - 1}
                a11yLabel={`Planned trip to ${t.place.name}`}
                a11yHint="Change the time, start now or cancel"
                testID={`home-planned-${t.id}`}
                onPress={() => router.push(`/planned/${t.id}`)}
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
              a11yHint: "Enter a room code or scan an invite",
              testID: "home-join",
              onPress: () => pressJoin(),
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
              key: "share",
              title: "Share live",
              icon: icons.navigate,
              a11yHint: "Start a room that only shares your location",
              testID: "home-share-live",
              onPress: () =>
                guardedPush(() =>
                  router.push({
                    pathname: "/create",
                    params: { mode: "solo", limit: "10", duration: "4" },
                  }),
                ),
            },
          ]}
        />

        <SectionHeader title="Ideas for your next trip" />
        <IdeaCarousel onSelect={startFromIdea} />

        <SectionHeader title="Private by design" />
        <PrivacyRow />

        <TabBarClearance />
      </TabScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  pressed: { opacity: 0.75 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    minHeight: 56,
    paddingLeft: 20,
    paddingRight: space.sm,
  },
  searchMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  searchPlaceholder: { color: colors.text, fontSize: 18, fontFamily: fontFamily.medium },
  laterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  laterText: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold },
  group: { marginTop: space.lg },
  sessionError: { marginTop: space.sm, marginBottom: space.md },
}));
