import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { PresetCircles } from "@/features/trips/PresetCircles";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { TRIP_PRESETS, presetCreateParams, type TripPresetId } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

export default function HomeScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const sessionError = useSessionStore((s) => s.error);
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
      <View style={styles.hero}>
        <Title>Buds</Title>
        <Text style={styles.tagline}>
          Live maps for small groups — see your buds, converge, convoy.
        </Text>
      </View>

      {/* Uber "Where to?" entry: the streamlined way in. Same rules as the
      old join button — needs a name first (focuses it), otherwise runs the
      normal join flow. */}
      <Pressable
        style={({ pressed }) => [styles.searchEntry, pressed && styles.pressed]}
        accessibilityRole="search"
        accessibilityLabel="Join with code"
        accessibilityHint={nameValid ? "Opens the join screen" : "Enter your name first"}
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
      >
        <AppSymbol
          name={icons.search}
          fallback={icons.search.fallback}
          size={20}
          tintColor={colors.textDim}
        />
        <Text style={styles.searchPlaceholder}>Join with code</Text>
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
        <Text style={styles.hint}>Enter your name first, then join.</Text>
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

      <Label>For you</Label>
      <PresetCircles onSelect={startFromPreset} />

      <View style={styles.actions}>
        <Button
          label="Create a room"
          disabled={!nameValid}
          testID="home-create"
          onPress={pressCreate}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 24, marginBottom: 12, flexShrink: 1 },
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
