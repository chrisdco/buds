import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { PresetCircles } from "@/features/trips/PresetCircles";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { TRIP_PRESETS, destCreateParams, presetCreateParams, type TripPresetId } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { usePlacesStore } from "@/stores/placesStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// Uber home grammar: search box as primary entry (real place search here,
// not the code gate), one rejoin card max, "For you" grid, name + join as
// the secondary row. Join-with-code is a button, not a search impersonator.
export default function HomeScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const sessionError = useSessionStore((s) => s.error);
  const recentPlaces = usePlacesStore((s) => s.recents);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomRef | null>(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [nameNudge, setNameNudge] = useState(false);
  const nameRef = useRef<TextInput>(null);
  // Double-tap guard: priming awaits a sheet + user decision, so two rapid
  // taps would otherwise push duplicate routes.
  const navBusy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void getActiveRoom().then(setActiveRoom);
      void usePlacesStore.getState().refresh();
    }, []),
  );

  const nameValid = displayName.trim().length > 0;

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

  const pressCreate = () => {
    if (navBusy.current) return;
    navBusy.current = true;
    void (async () => {
      try {
        await primeLocation();
        router.push("/create");
      } finally {
        navBusy.current = false;
      }
    })();
  };

  const pressJoin = () => {
    if (navBusy.current) return;
    navBusy.current = true;
    void (async () => {
      try {
        await primeLocation();
        router.push("/join");
      } finally {
        navBusy.current = false;
      }
    })();
  };

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
    if (!activeRoom) return;
    setRejoinBusy(true);
    setRejoinError(null);
    // Re-validate membership through join_room (idempotent for active members).
    const result = await roomsRpc.joinRoom({
      code: activeRoom.code,
      displayName: displayName.trim() || "Anonymous",
      role: activeRoom.role,
    });
    setRejoinBusy(false);
    if (result.ok) {
      router.push(`/room/${result.room.id}`);
    } else {
      clearActiveRoom();
      setActiveRoom(null);
      setRejoinError(
        result.error === "room_ended" || result.error === "bad_code"
          ? "That room has ended."
          : "Couldn't rejoin the room.",
      );
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Title>Buds</Title>
        <Text style={styles.tagline}>
          Live maps for small groups — see your buds, converge, convoy.
        </Text>
      </View>

      {/* Real search: places (Photon), not the code gate. Needs no name —
      identity is asked at create/join time, never blocks exploring. */}
      <Pressable
        style={({ pressed }) => [styles.searchEntry, pressed && styles.pressed]}
        accessibilityRole="search"
        accessibilityLabel="Search for a destination"
        accessibilityHint="Searches places, then creates a room around the pick"
        testID="home-search"
        onPress={() => router.push("/search")}
      >
        <AppSymbol
          name={icons.search}
          fallback={icons.search.fallback}
          size={20}
          tintColor={colors.textDim}
        />
        <Text style={styles.searchPlaceholder}>Where to?</Text>
        <Text style={styles.searchChev}>›</Text>
      </Pressable>

      <Label>Your name</Label>
      <TextField
        inputRef={nameRef}
        value={displayName}
        onChangeText={(t) => {
          setDisplayName(t);
          if (t.trim().length > 0) setNameNudge(false);
        }}
        placeholder="e.g. Chris"
        maxLength={24}
        autoCapitalize="words"
        returnKeyType="done"
        testID="home-name"
      />
      {nameNudge && !nameValid && (
        <Text style={styles.hint}>Enter your name first.</Text>
      )}

      {activeRoom && (
        <>
          <Label>Pick up where you left off</Label>
          <Pressable
            style={({ pressed }) => [styles.rejoinCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Rejoin ${activeRoom.name}`}
            accessibilityHint={`Code ${activeRoom.code}, joined as ${activeRoom.role}`}
            testID="home-rejoin"
            onPress={() => void rejoin()}
          >
            <View style={styles.rejoinIcon}>
              {rejoinBusy ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <AppSymbol
                  name={icons.history}
                  fallback={icons.history.fallback}
                  size={22}
                  tintColor={colors.textDim}
                />
              )}
            </View>
            <View style={styles.rejoinBody}>
              <Text style={styles.rejoinName} numberOfLines={1}>
                {activeRoom.name}
              </Text>
              <Text style={styles.rejoinSub} numberOfLines={1}>
                {activeRoom.code} · {activeRoom.role === "traveler" ? "Traveler" : "Spectator"}
              </Text>
            </View>
            <Text style={styles.rejoinChev}>›</Text>
          </Pressable>
          <ErrorText>{rejoinError}</ErrorText>
        </>
      )}

      {(recentPlaces ?? []).length > 0 && (
        <>
          <Label>Recent places</Label>
          {(recentPlaces ?? []).slice(0, 2).map((p, i) => (
            <Pressable
              key={`${p.lat}-${p.lng}-${i}`}
              style={({ pressed }) => [styles.placeRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Plan a trip to ${p.name}`}
              testID={`home-recent-place-${i}`}
              onPress={() => planToPlace(p)}
            >
              <View style={styles.rejoinIcon}>
                <AppSymbol
                  name={icons.history}
                  fallback={icons.history.fallback}
                  size={20}
                  tintColor={colors.textDim}
                />
              </View>
              <View style={styles.rejoinBody}>
                <Text style={styles.rejoinName} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.address !== "" && (
                  <Text style={styles.placeSub} numberOfLines={1}>
                    {p.address}
                  </Text>
                )}
              </View>
              <Text style={styles.rejoinChev}>›</Text>
            </Pressable>
          ))}
        </>
      )}

      <View style={styles.forYouHeader}>
        <Label>For you</Label>
        <Pressable
          style={({ pressed }) => [styles.forYouArrow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="See all trip options"
          testID="home-foryou-all"
          hitSlop={8}
          onPress={() => router.push("/trips")}
        >
          <Text style={styles.forYouArrowGlyph}>›</Text>
        </Pressable>
      </View>
      <PresetCircles onSelect={startFromPreset} />

      <View style={styles.actions}>
        <Button
          label="Create a room"
          testID="home-create"
          onPress={() => {
            if (!nameValid) {
              setNameNudge(true);
              nameRef.current?.focus();
              return;
            }
            pressCreate();
          }}
        />
        <Button
          label="Join with code"
          variant="ghost"
          testID="home-join"
          onPress={() => {
            if (!nameValid) {
              setNameNudge(true);
              nameRef.current?.focus();
              return;
            }
            setNameNudge(false);
            pressJoin();
          }}
        />
        {!nameValid && (
          <Text style={styles.hint}>Enter your name to create or join a room.</Text>
        )}
        <ErrorText>{sessionError}</ErrorText>
        {sessionError && (
          <Button
            label="Retry connection"
            variant="ghost"
            onPress={() => void useSessionStore.getState().init()}
          />
        )}
      </View>
      {/* Clearance above the floating tab pill. */}
      <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 24, marginBottom: 12 },
  tagline: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
  },
  actions: { marginTop: 28 },
  searchEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 12,
  },
  searchPlaceholder: {
    color: colors.textDim,
    fontSize: 16,
    fontFamily: fontFamily.regular,
    flex: 1,
    flexShrink: 1,
  },
  searchChev: { color: colors.textDim, fontSize: 22, fontFamily: fontFamily.regular },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeSub: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  forYouHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  forYouArrow: { padding: 8 },
  forYouArrowGlyph: { color: colors.textDim, fontSize: 22, fontFamily: fontFamily.regular },
  rejoinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
  },
  rejoinIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rejoinBody: { flex: 1, flexShrink: 1 },
  rejoinName: { color: colors.text, fontSize: 17, fontFamily: fontFamily.semiBold },
  rejoinSub: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  rejoinChev: { color: colors.textDim, fontSize: 22, fontFamily: fontFamily.regular },
  pressed: { opacity: 0.75 },
  hint: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    fontFamily: fontFamily.regular,
  },
});
