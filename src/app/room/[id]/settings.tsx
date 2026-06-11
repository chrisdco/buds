import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, Title } from "@/components/ui";
import { colorForUser, colors } from "@/constants/theme";
import { modeRegistry } from "@/modes/registry";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { RoomMode } from "@/types/contracts";

const MODES = Object.values(modeRegistry);

export default function RoomSettingsScreen() {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const myMemberId = useRoomStore((s) => s.myMemberId);
  const destRoom = useRoomStore((s) => s.destRoom);
  const destByMember = useRoomStore((s) => s.destByMember);
  const membersMap = useMembersStore((s) => s.members);
  const myUserId = useSessionStore((s) => s.userId);
  const [error, setError] = useState<string | null>(null);

  if (!room) return null;
  const isHost = room.host_id === myUserId;
  const me = myUserId ? membersMap[myUserId] : undefined;
  const travelers = Object.values(membersMap).filter((m) => m.role === "traveler");
  const myDest = myMemberId ? destByMember[myMemberId] : undefined;

  const guard = async (action: () => Promise<{ ok: boolean }>) => {
    setError(null);
    const result = await action();
    if (!result.ok) setError("That didn't work — only the host can change this.");
  };

  const setMode = (mode: RoomMode) => {
    if (!isHost || mode === room.mode) return;
    void guard(() => roomsRpc.setMode(room.id, mode));
  };

  const kick = (userId: string, name: string) => {
    Alert.alert(`Remove ${name}?`, "They won't be able to rejoin this room.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void guard(() => roomsRpc.kickMember(room.id, userId)),
      },
    ]);
  };

  const endRoom = () => {
    Alert.alert("End room for everyone?", "This closes the room for all members.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End room",
        style: "destructive",
        onPress: () => void roomsRpc.endRoom(room.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Title>Room settings</Title>
          <Text style={styles.sub}>
            {room.name} · code {room.code}
            {isHost ? "" : " · host controls are read-only"}
          </Text>
        </View>

        <Label>Mode</Label>
        <View style={styles.chips}>
          {MODES.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              selected={m.id === room.mode}
              onPress={() => setMode(m.id)}
            />
          ))}
        </View>

        {room.mode === "leader" && (
          <>
            <Label>Leader</Label>
            <View style={styles.chips}>
              {travelers.map((m) => (
                <Chip
                  key={m.userId}
                  label={m.name}
                  selected={m.userId === room.leader_id}
                  onPress={() =>
                    isHost && void guard(() => roomsRpc.setLeader(room.id, m.userId))
                  }
                />
              ))}
            </View>
          </>
        )}

        {me?.role === "traveler" && (
          <>
            <Label>Privacy</Label>
            <View style={styles.lockRow}>
              <Text style={styles.lockText}>
                {me.sharing
                  ? "Sharing your live location"
                  : "Paused — buds see your last position"}
              </Text>
              <Switch
                value={me.sharing}
                onValueChange={(sharing) => void roomsRpc.setSharing(room.id, sharing)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>
          </>
        )}

        <Label>Access</Label>
        <View style={styles.lockRow}>
          <Text style={styles.lockText}>
            {room.locked ? "Room locked — nobody new can join" : "Open to joiners with the code"}
          </Text>
          <Switch
            value={room.locked}
            disabled={!isHost}
            onValueChange={(locked) => void guard(() => roomsRpc.lockRoom(room.id, locked))}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
          />
        </View>

        {(destRoom || myDest) && <Label>Destinations</Label>}
        {destRoom && isHost && (
          <Button
            label={`Clear room destination (${destRoom.label})`}
            variant="ghost"
            onPress={() => void guard(() => roomsRpc.clearDestination(room.id))}
          />
        )}
        {myDest && (
          <Button
            label="Clear my destination"
            variant="ghost"
            onPress={() => void roomsRpc.clearDestination(room.id, myMemberId)}
          />
        )}

        <Label>Members</Label>
        {Object.values(membersMap).map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            <View style={[styles.dot, { backgroundColor: colorForUser(m.userId) }]} />
            <Text style={styles.memberName} numberOfLines={1}>
              {m.name}
              {m.userId === room.host_id ? "  (host)" : ""}
              {m.role === "spectator" ? "  👀" : ""}
            </Text>
            {isHost && m.userId !== myUserId && (
              <Text style={styles.kick} onPress={() => kick(m.userId, m.name)}>
                Remove
              </Text>
            )}
          </View>
        ))}

        <ErrorText>{error}</ErrorText>
        {isHost && <Button label="End room for everyone" variant="danger" onPress={endRoom} />}
        <Button label="Back to map" variant="ghost" onPress={() => router.back()} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 16, marginBottom: 4 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockText: { color: colors.text, fontSize: 14, flexShrink: 1, marginRight: 10 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberName: { color: colors.text, fontSize: 15, flex: 1 },
  kick: { color: colors.danger, fontWeight: "600", fontSize: 13, padding: 4 },
});
