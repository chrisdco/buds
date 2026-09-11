import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

const HOW_IT_WORKS = [
  "Name yourself",
  "Create or join with a code",
  "See each other live",
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const sessionError = useSessionStore((s) => s.error);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomRef | null>(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getActiveRoom().then(setActiveRoom);
    }, []),
  );

  const nameValid = displayName.trim().length > 0;
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";

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
    void (async () => {
      await primeLocation();
      router.push("/create");
    })();
  };

  const pressJoin = () => {
    void (async () => {
      await primeLocation();
      router.push("/join");
    })();
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
      <View style={styles.heroRow}>
        <View style={styles.hero}>
          <Title>Buds</Title>
          <Text style={styles.tagline}>
            Live maps for small groups — see your buds, converge, convoy.
          </Text>
        </View>
        <Pressable
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="App settings"
          testID="home-settings"
          hitSlop={12}
          onPress={() => router.replace("/profile")}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </View>

      <View style={styles.strip} accessibilityLabel="How it works">
        {HOW_IT_WORKS.map((step, i) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Label>Your name</Label>
      <TextField
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="e.g. Chris"
        maxLength={24}
        autoCapitalize="words"
        testID="home-name"
      />

      {activeRoom && (
        <>
          <Label>Pick up where you left off</Label>
          <Pressable
            style={styles.rejoinCard}
            accessibilityRole="button"
            accessibilityLabel={`Rejoin ${activeRoom.name}`}
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
                {activeRoom.code}
              </Text>
            </View>
            <Text style={styles.rejoinChev}>›</Text>
          </Pressable>
          <ErrorText>{rejoinError}</ErrorText>
        </>
      )}

      <View style={styles.actions}>
        <Button
          label="Create a room"
          disabled={!nameValid}
          testID="home-create"
          onPress={pressCreate}
        />
        <Button
          label="Join with code"
          variant="ghost"
          disabled={!nameValid}
          testID="home-join"
          onPress={pressJoin}
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
  heroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  hero: { marginTop: 24, marginBottom: 12, flexShrink: 1, marginRight: 12 },
  avatar: {
    marginTop: 52,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontSize: 18, fontFamily: fontFamily.bold },
  strip: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 8 },
  step: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 6 },
  stepNum: {
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
  },
  stepText: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, flexShrink: 1 },
  tagline: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
  },
  actions: { marginTop: 28 },
  rejoinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  rejoinIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rejoinBody: { flex: 1, flexShrink: 1 },
  rejoinName: { color: colors.text, fontSize: 17, fontFamily: fontFamily.semiBold },
  rejoinSub: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  rejoinChev: { color: colors.textDim, fontSize: 22, fontFamily: fontFamily.regular },
  hint: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    fontFamily: fontFamily.regular,
  },
});
