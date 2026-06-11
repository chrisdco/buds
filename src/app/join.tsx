import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { setActiveRoom } from "@/lib/activeRoom";
import { CODE_LENGTH, normalizeCode } from "@/lib/ids";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { MemberRole, RpcError } from "@/types/contracts";

function errorMessage(error: RpcError): string {
  switch (error) {
    case "bad_code":
      return "Room not found — double-check the code.";
    case "room_full":
      return "All traveler spots are taken.";
    case "room_locked":
      return "The host has locked this room.";
    case "room_ended":
      return "That room has ended.";
    case "kicked":
      return "You were removed from this room.";
    default:
      return "Couldn't join — check your connection and try again.";
  }
}

export default function JoinRoomScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const [code, setCode] = useState("");
  const [role, setRole] = useState<MemberRole>("traveler");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RpcError | null>(null);

  const join = async (joinRole: MemberRole) => {
    setBusy(true);
    setError(null);
    const result = await roomsRpc.joinRoom({
      code,
      displayName: displayName.trim() || "Anonymous",
      role: joinRole,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setActiveRoom({
      id: result.room.id,
      code: result.room.code,
      name: result.room.name,
      role: result.member.role,
    });
    router.replace(`/room/${result.room.id}`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Join a room</Title>
      </View>

      <Label>Room code</Label>
      <TextField
        value={code}
        onChangeText={(text) => setCode(normalizeCode(text))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        style={styles.codeInput}
      />

      <Label>Join as</Label>
      <View style={styles.chips}>
        <Chip label="Traveler" selected={role === "traveler"} onPress={() => setRole("traveler")} />
        <Chip
          label="Spectator"
          selected={role === "spectator"}
          onPress={() => setRole("spectator")}
        />
      </View>

      <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      {error === "room_full" && role === "traveler" && (
        <Button
          label="Join as spectator instead"
          variant="ghost"
          onPress={() => void join("spectator")}
        />
      )}

      <Button
        label="Join room"
        busy={busy}
        disabled={code.length !== CODE_LENGTH}
        onPress={() => void join(role)}
      />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    color: colors.text,
  },
});
