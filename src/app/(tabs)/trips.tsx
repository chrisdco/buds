import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorText, Label, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { getRecentRooms, pruneRecentRoom, setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";

// Trips tab: every room this device created or joined, newest first.
// Rejoin re-validates membership through join_room (idempotent) and prunes
// dead rooms inline — the list never shows a room you can't enter.
export default function TripsScreen() {
  const router = useRouter();
  const [recents, setRecents] = useState<ActiveRoomRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getRecentRooms().then(setRecents);
    }, []),
  );

  const openTrip = (ref: ActiveRoomRef) => {
    void (async () => {
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
        if (result.error === "room_ended" || result.error === "bad_code" || result.error === "kicked") {
          await pruneRecentRoom(ref.id);
          setRecents(await getRecentRooms());
        }
        setError(
          result.error === "room_ended" || result.error === "bad_code"
            ? "That room has ended."
            : "Couldn't rejoin the room.",
        );
      }
    })();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Trips</Title>
        <Text style={styles.caption}>Pick up where you left off — rooms you create or join show up here.</Text>

        <Label>Recent trips</Label>
        {recents.length === 0 ? (
          <Text style={styles.caption} testID="trips-empty">
            No trips yet — create or join a room first.
          </Text>
        ) : (
          recents.map((r) => (
            <Pressable
              key={r.id}
              style={styles.tripRow}
              accessibilityRole="button"
              accessibilityLabel={`Rejoin ${r.name}`}
              testID={`trips-rejoin-${r.code}`}
              onPress={() => openTrip(r)}
            >
              <Text style={styles.tripName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.tripCode}>{r.code}</Text>
            </Pressable>
          ))
        )}
        <ErrorText>{error}</ErrorText>
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripName: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold, flexShrink: 1 },
  tripCode: { color: colors.accent, fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 1 },
});
