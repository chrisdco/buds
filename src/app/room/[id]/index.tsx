import type { CameraRef } from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { clearActiveRoom } from "@/lib/activeRoom";
import { MemberMarkers } from "@/features/map/MemberMarkers";
import { RoomMap } from "@/features/map/RoomMap";
import { MemberList } from "@/features/room/MemberList";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";

export default function RoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const room = useRoomStore((s) => s.room);
  const connection = useRoomStore((s) => s.connection);
  const membersMap = useMembersStore((s) => s.members);
  const myUserId = useSessionStore((s) => s.userId);
  const cameraRef = useRef<CameraRef | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const fittedOnce = useRef(false);

  const members = useMemo(() => Object.values(membersMap), [membersMap]);
  const positioned = useMemo(() => members.filter((m) => m.pos), [members]);
  const isHost = room != null && room.host_id === myUserId;

  // Presence labels ("last seen 3m ago") need a slow clock.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const fitAll = () => {
    if (positioned.length === 0) return;
    if (positioned.length === 1) {
      cameraRef.current?.easeTo({
        center: [positioned[0].pos!.lng, positioned[0].pos!.lat],
        zoom: 15,
        duration: 600,
      });
      return;
    }
    const lngs = positioned.map((m) => m.pos!.lng);
    const lats = positioned.map((m) => m.pos!.lat);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 120, bottom: 180, left: 60, right: 60 }, duration: 800 },
    );
  };

  // Frame the group the first time anyone shows up with a position.
  useEffect(() => {
    if (!fittedOnce.current && positioned.length > 0) {
      fittedOnce.current = true;
      fitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positioned.length]);

  const copyCode = async () => {
    if (!room) return;
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = () => {
    Alert.alert("Leave room?", "Your buds will see you go offline.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          if (room) void roomsRpc.leaveRoom(room.id);
          clearActiveRoom();
          router.replace("/");
        },
      },
    ]);
  };

  const endRoom = () => {
    if (!room) return;
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
    <View style={styles.container}>
      <RoomMap cameraRef={cameraRef}>
        <MemberMarkers members={positioned} nowMs={nowMs} />
      </RoomMap>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.pillButton} onPress={leave}>
          <Text style={styles.pillButtonText}>← Leave</Text>
        </Pressable>
        <Pressable style={styles.titlePill} onPress={() => void copyCode()}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room?.name ?? "…"}
          </Text>
          <Text style={styles.roomCode}>{copied ? "Copied!" : (room?.code ?? "")}</Text>
        </Pressable>
        {isHost ? (
          <Pressable style={styles.pillButton} onPress={endRoom}>
            <Text style={[styles.pillButtonText, { color: colors.danger }]}>End</Text>
          </Pressable>
        ) : (
          <View style={styles.pillSpacer} />
        )}
      </View>

      {connection !== "connected" && (
        <View style={[styles.connBanner, { top: insets.top + 64 }]}>
          <Text style={styles.connBannerText}>
            {connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </Text>
        </View>
      )}

      {/* Fit-all floating button */}
      <Pressable
        style={[styles.fitButton, { bottom: insets.bottom + 132 }]}
        onPress={fitAll}
      >
        <Text style={styles.fitButtonText}>⊕</Text>
      </Pressable>

      {/* Bottom member strip */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 10 }]}>
        <MemberList members={members} hostId={room?.host_id ?? null} nowMs={nowMs} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillButton: {
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillButtonText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  pillSpacer: { width: 58 },
  titlePill: {
    flex: 1,
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
  },
  roomName: { color: colors.text, fontWeight: "700", fontSize: 14 },
  roomCode: { color: colors.accent, fontWeight: "700", fontSize: 12, letterSpacing: 2 },
  connBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  connBannerText: { color: "#1A1300", fontWeight: "700", fontSize: 12 },
  fitButton: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fitButtonText: { color: colors.text, fontSize: 22 },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
  },
});
