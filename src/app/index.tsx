import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { clearActiveRoom, getActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";

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

      <Label>Your name</Label>
      <TextField
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="e.g. Chris"
        maxLength={24}
        autoCapitalize="words"
      />

      {activeRoom && (
        <>
          <Label>Pick up where you left off</Label>
          <Button
            label={`Rejoin “${activeRoom.name}”`}
            variant="ghost"
            busy={rejoinBusy}
            onPress={() => void rejoin()}
          />
          <ErrorText>{rejoinError}</ErrorText>
        </>
      )}

      <View style={styles.actions}>
        <Button
          label="Create a room"
          disabled={!nameValid}
          onPress={() => router.push("/create")}
        />
        <Button
          label="Join with code"
          variant="ghost"
          disabled={!nameValid}
          onPress={() => router.push("/join")}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48, marginBottom: 12 },
  tagline: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
  actions: { marginTop: 28 },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 10, textAlign: "center" },
});
