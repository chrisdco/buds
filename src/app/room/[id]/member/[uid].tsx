import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Label, Screen, Title } from "@/components/ui";
import { colorForUser, colors, space } from "@/constants/theme";
import { formatDistanceM } from "@/lib/geo";
import { openExternalNavigation } from "@/lib/nav";
import { formatDurationS } from "@/lib/time";
import { presenceLabel, presenceOf, useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useUiStore } from "@/stores/uiStore";

// Per-member detail + focus sheet (issue #16): live presence, route ETA /
// remaining distance, navigate-to-them, and camera follow. Pure reads off the
// existing stores — no backend changes. Unverified on device (blind build):
// confirm marker/list taps land here and the follow camera feels right.
export default function MemberDetailScreen() {
  const router = useRouter();
  const { uid: rawUid } = useLocalSearchParams<{ uid: string }>();
  const uid = Array.isArray(rawUid) ? (rawUid[0] ?? "") : (rawUid ?? "");

  const room = useRoomStore((s) => s.room);
  const member = useMembersStore((s) => (uid ? s.members[uid] : undefined));
  const route = useRouteStore((s) => (uid ? s.routes[uid] : undefined));
  const focusedMemberId = useUiStore((s) => s.focusedMemberId);
  // Slow clock for presence/updated labels (matches the room screen tick).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  if (!member) {
    return (
      <Screen>
        <View style={styles.center}>
          <Title>Member not found</Title>
          <Text style={styles.sub}>They may have left the room.</Text>
          <Button label="Back to map" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const state = presenceOf(member, nowMs);
  const isFocused = focusedMemberId === member.userId;
  const isHost = room?.host_id === member.userId;
  const isLeader = room?.mode === "leader" && room?.leader_id === member.userId;

  const toggleFollow = () => {
    if (isFocused) {
      useUiStore.getState().setFocusedMemberId(null);
    } else {
      useUiStore.getState().setFocusedMemberId(member.userId);
      useUiStore.getState().setCameraMode("auto");
      router.back();
    }
  };

  return (
    <Screen>
      <View style={styles.body}>
        <View>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colorForUser(member.userId) }]}>
              <Text style={styles.initial}>{member.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Title>{member.name}</Title>
            <Text style={styles.sub}>
              {[
                member.role === "spectator" ? "Spectator" : presenceLabel(state, member, nowMs),
                isHost ? "host" : null,
                isLeader ? "leader" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          <Label>Route</Label>
          {route ? (
            <Text style={styles.stat}>
              {formatDistanceM(route.distanceM)} · ETA {formatDurationS(route.durationS)}
              {route.source === "straightline" ? " (estimate)" : ""}
            </Text>
          ) : (
            <Text style={styles.dim}>
              {member.arrivedAt
                ? "Arrived — no active route."
                : "No route yet — waiting for a destination or position."}
            </Text>
          )}

          <Label>Position</Label>
          {member.pos ? (
            <Text style={styles.stat}>
              Updated {Math.max(0, Math.round((nowMs - member.pos.atMs) / 1000))}s ago
              {member.pos.speed != null ? ` · ${(member.pos.speed * 3.6).toFixed(0)} km/h` : ""}
            </Text>
          ) : (
            <Text style={styles.dim}>No position shared yet.</Text>
          )}
        </View>

        {/* Bottom-anchored: primary action lands in the thumb zone and the
            layout stays balanced instead of top-packing into a void. */}
        <View style={styles.actions}>
          {member.pos && (
            <Button
              label="Navigate to them"
              a11yLabel={`Navigate to ${member.name} in external maps`}
              onPress={() =>
                void openExternalNavigation(member.pos!.lat, member.pos!.lng)
              }
            />
          )}
          <Button
            label={isFocused ? "Unfollow" : "Follow on map"}
            variant="ghost"
            onPress={toggleFollow}
          />
          <Button label="Back to map" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  body: { flex: 1 },
  header: { marginTop: space.lg, alignItems: "center" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    marginBottom: 8,
  },
  initial: { color: "#FFFFFF", fontWeight: "700", fontSize: 26 },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 4, textAlign: "center" },
  stat: { color: colors.text, fontSize: 15, fontWeight: "600" },
  dim: { color: colors.textDim, fontSize: 14 },
  actions: { marginTop: "auto", paddingTop: space.md },
});
