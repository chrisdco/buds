import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { setActiveRoom } from "@/lib/activeRoom";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { RoomMode } from "@/types/contracts";

const MODES: { id: RoomMode; label: string; blurb: string }[] = [
  { id: "solo", label: "Solo", blurb: "Just share where you are. Others can watch." },
  { id: "converge", label: "Converge", blurb: "Everyone heads to one shared destination." },
  { id: "multitrack", label: "Multi-track", blurb: "Each traveler has their own destination." },
  { id: "leader", label: "Follow leader", blurb: "One leader, everyone keeps up." },
  { id: "formation", label: "Formation", blurb: "Stay within a set radius of the group." },
];

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "No limit", hours: null },
  { label: "4h", hours: 4 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const [name, setName] = useState(
    displayName.trim() ? `${displayName.trim()}'s trip` : "Our trip",
  );
  const [mode, setMode] = useState<RoomMode>("converge");
  const [limit, setLimit] = useState(10);
  const [durationHours, setDurationHours] = useState<number | null>(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const expiresAt =
      durationHours != null
        ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
        : null;
    const result = await roomsRpc.createRoom({
      name: name.trim() || "Our trip",
      displayName: displayName.trim() || "Anonymous",
      mode,
      travelerLimit: limit,
      expiresAt,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? `Could not create the room (${result.error}).`);
      return;
    }
    setActiveRoom({
      id: result.room.id,
      code: result.room.code,
      name: result.room.name,
      role: "traveler",
    });
    router.replace(`/room/${result.room.id}`);
  };

  const selectedMode = MODES.find((m) => m.id === mode)!;

  return (
    <Screen>
      <View style={styles.header}>
        <Title>New room</Title>
      </View>

      <Label>Room name</Label>
      <TextField value={name} onChangeText={setName} maxLength={60} />

      <Label>Mode</Label>
      <View style={styles.chips}>
        {MODES.map((m) => (
          <Chip key={m.id} label={m.label} selected={m.id === mode} onPress={() => setMode(m.id)} />
        ))}
      </View>
      <Text style={styles.blurb}>{selectedMode.blurb}</Text>

      <Label>Traveler limit</Label>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setLimit((v) => Math.max(1, v - 1))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{limit}</Text>
        <Pressable style={styles.stepBtn} onPress={() => setLimit((v) => Math.min(10, v + 1))}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Label>Room expires after</Label>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Chip
            key={d.label}
            label={d.label}
            selected={d.hours === durationHours}
            onPress={() => setDurationHours(d.hours)}
          />
        ))}
      </View>

      <ErrorText>{error}</ErrorText>
      <Button label="Create room" busy={busy} onPress={() => void create()} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  blurb: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 18 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.text, fontSize: 22, fontWeight: "600" },
  stepValue: { color: colors.text, fontSize: 20, fontWeight: "700", minWidth: 28, textAlign: "center" },
});
