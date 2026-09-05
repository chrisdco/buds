import type { CameraRef, LngLat } from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { createAlertEngine } from "@/events/alertEngine";
import { createArrivalDetector, type ArrivalDetector } from "@/events/arrivalDetector";
import { clearActiveRoom } from "@/lib/activeRoom";
import { expiryInfo } from "@/lib/expiry";
import { haversineMeters } from "@/lib/geo";
import { openExternalNavigation } from "@/lib/nav";
import { serverNowMs } from "@/lib/time";
import { DestinationMarkers } from "@/features/map/DestinationMarkers";
import { MemberMarkers } from "@/features/map/MemberMarkers";
import { RoomMap } from "@/features/map/RoomMap";
import { RouteLines } from "@/features/map/RouteLines";
import { ExpiryBanner } from "@/features/room/ExpiryBanner";
import { InsightsPanel } from "@/features/room/InsightsPanel";
import { MemberList } from "@/features/room/MemberList";
import { RoomDetails } from "@/features/room/RoomDetails";
import { RoomSheet, type SheetDetent } from "@/features/room/RoomSheet";
import { Toasts } from "@/features/room/Toasts";
import { notifyAlert } from "@/services/notifications";
import { modeRegistry } from "@/modes/registry";
import { travelers } from "@/modes/shared";
import {
  DEFAULT_ARRIVAL_RADIUS_M,
  type CameraTarget,
  type ClientSnapshot,
} from "@/modes/types";
import { ensureRoutes } from "@/services/routing/routeManager";
import { sendEvt } from "@/services/realtime/roomChannel";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

export default function RoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const [detent, setDetent] = useState<SheetDetent>("half");
  const room = useRoomStore((s) => s.room);
  const myMemberId = useRoomStore((s) => s.myMemberId);
  const destRoom = useRoomStore((s) => s.destRoom);
  const destByMember = useRoomStore((s) => s.destByMember);
  const connection = useRoomStore((s) => s.connection);
  const membersMap = useMembersStore((s) => s.members);
  const routes = useRouteStore((s) => s.routes);
  const cameraMode = useUiStore((s) => s.cameraMode);
  const focusedMemberId = useUiStore((s) => s.focusedMemberId);
  const myUserId = useSessionStore((s) => s.userId);

  const cameraRef = useRef<CameraRef | null>(null);
  const engineRef = useRef(createAlertEngine());
  const arrivalRef = useRef<ArrivalDetector | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  const members = useMemo(() => Object.values(membersMap), [membersMap]);
  const positioned = useMemo(() => members.filter((m) => m.pos), [members]);
  const isHost = room != null && room.host_id === myUserId;
  const strategy = modeRegistry[room?.mode ?? "solo"];

  const snap: ClientSnapshot | null = useMemo(
    () =>
      room
        ? { room, members: membersMap, destRoom, destByMember, routes, nowMs }
        : null,
    [room, membersMap, destRoom, destByMember, routes, nowMs],
  );

  const insights = useMemo(
    () =>
      snap && myUserId
        ? strategy.computeInsights(snap, myUserId)
        : { headline: null, perMember: {} },
    [snap, strategy, myUserId],
  );

  const myDest = useMemo(
    () => (snap && myUserId ? strategy.effectiveDestinationFor(snap, myUserId) : null),
    [snap, strategy, myUserId],
  );

  // Uber-style trip progress + Life360-style manual check-in, both derived
  // from stores the screen already reads (no new data paths).
  const tripProgress = useMemo(() => {
    if (!snap) return null;
    const tv = travelers(snap);
    if (tv.length === 0) return null;
    return {
      arrived: tv.filter((m) => m.arrivedAt != null).length,
      total: tv.length,
    };
  }, [snap]);

  const me = myUserId ? membersMap[myUserId] : undefined;
  const canCheckIn =
    room != null &&
    myDest != null &&
    myDest.kind !== "leader" &&
    me != null &&
    me.role === "traveler" &&
    me.arrivedAt == null;
  const checkIn = () => {
    if (!room) return;
    // Idempotent server-side; the auto detector keeps trying regardless, so
    // a transient failure only needs a quiet toast, not a retry loop.
    void roomsRpc.markArrived(room.id).then((r) => {
      if (!r.ok) {
        useUiStore.getState().pushAlerts([
          {
            id: "checkin-err",
            severity: "warn",
            title: "Couldn't check in — still trying automatically",
          },
        ]);
      }
    });
  };

  // Slow clock driving presence labels, insight recompute, route reconciliation.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  // Local alert engine: strategies report conditions, engine handles
  // sustain/dedupe/re-arm; reset when the room (or mode) changes identity.
  useEffect(() => {
    engineRef.current.reset();
  }, [room?.id, room?.mode]);
  useEffect(() => {
    if (!snap || !myUserId) return;
    const alerts = engineRef.current.evaluate(
      strategy.alertConditions(snap, myUserId),
      Date.now(),
    );
    if (alerts.length === 0) return;
    if (AppState.currentState === "active") {
      useUiStore.getState().pushAlerts(alerts); // in-app toast
    } else {
      // backgrounded: surface as OS notifications instead
      for (const alert of alerts) void notifyAlert(alert);
    }
  }, [snap, strategy, myUserId]);

  // Route reconciliation (staleness / deviation / moved destinations).
  useEffect(() => {
    if (snap && myUserId) void ensureRoutes(snap, strategy, myUserId);
  }, [snap, strategy, myUserId]);

  // Self-reported arrival: within radius, sustained — see arrivalDetector.
  useEffect(() => {
    if (!room) return;
    arrivalRef.current = createArrivalDetector({
      radiusM: () => {
        const r = useRoomStore.getState().room?.settings.arrival_radius_m;
        return Number.isFinite(r) && (r as number) > 0
          ? (r as number)
          : DEFAULT_ARRIVAL_RADIUS_M;
      },
      onArrive: () => {
        // Confirm with the server before announcing: a transient failure
        // re-arms the detector so staying inside the radius retries after a
        // fresh sustain window, instead of missing arrival until a 2x
        // excursion. The 'arrived' broadcast only goes out on confirmation.
        void (async () => {
          try {
            const res = await roomsRpc.markArrived(room.id);
            if (res.ok) {
              if (myUserId) sendEvt({ k: "arrived", u: myUserId, t: serverNowMs() });
            } else {
              arrivalRef.current?.reset();
            }
          } catch {
            arrivalRef.current?.reset();
          }
        })();
      },
    });
    return () => {
      arrivalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);
  useEffect(() => {
    if (!myUserId || !myDest || myDest.kind === "leader") return;
    const me = membersMap[myUserId];
    if (!me?.pos || me.arrivedAt != null) return;
    arrivalRef.current?.update(
      haversineMeters(me.pos.lat, me.pos.lng, myDest.lat, myDest.lng),
      Date.now(),
    );
  }, [membersMap, myDest, myUserId]);

  const applyCameraTarget = (target: CameraTarget, bottomPad: number) => {
    const posOf = (uid: string) => membersMap[uid]?.pos;
    if (target.kind === "follow") {
      const p = posOf(target.userId);
      if (p) cameraRef.current?.easeTo({ center: [p.lng, p.lat], duration: 700 });
      return;
    }
    const pool =
      target.kind === "fitUsers"
        ? target.userIds.map(posOf).filter((p) => p != null)
        : positioned.map((m) => m.pos!);
    const points = pool.map((p) => [p!.lng, p!.lat] as [number, number]);
    if (destRoom && target.kind === "fitAll") points.push([destRoom.lng, destRoom.lat]);
    if (points.length === 0) return;
    if (points.length === 1) {
      cameraRef.current?.easeTo({ center: points[0], zoom: 15, duration: 700 });
      return;
    }
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 130, bottom: bottomPad, left: 60, right: 60 }, duration: 800 },
    );
  };

  // Bottom padding tracks the sheet so framed content stays in the visible
  // map strip (Maps contentPadding pattern).
  const camPadBottom = detent === "peek" ? 200 : Math.round(H * 0.42 + 60);

  const recenter = () => {
    useUiStore.getState().setFocusedMemberId(null);
    useUiStore.getState().setCameraMode("auto");
    if (snap && myUserId) applyCameraTarget(strategy.cameraTarget(snap, myUserId), camPadBottom);
  };

  // Auto camera follows the strategy's policy until the user pans — unless a
  // member is focused (detail sheet "Follow"), which pins the camera to them.
  useEffect(() => {
    if (cameraMode !== "auto" || !snap || !myUserId) return;
    const focused =
      focusedMemberId && membersMap[focusedMemberId]?.pos ? focusedMemberId : null;
    applyCameraTarget(
      focused
        ? { kind: "follow", userId: focused }
        : strategy.cameraTarget(snap, myUserId),
      camPadBottom,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cameraMode, room?.mode, focusedMemberId, detent, H]);

  const onLongPress = (lngLat: LngLat) => {
    if (!room || !myUserId) return;
    const [lng, lat] = lngLat;
    const me = membersMap[myUserId];
    const policy = strategy.destinationPolicy;
    const isLeaderMe = room.leader_id === myUserId;

    const setRoomDest = () =>
      void roomsRpc
        .setDestination({ roomId: room.id, lat, lng, label: "Meet point" })
        .then((r) => {
          if (!r.ok)
            useUiStore.getState().pushAlerts([
              { id: "dest-err", severity: "warn", title: "Couldn't set destination" },
            ]);
        });
    const setMyDest = () => {
      if (!myMemberId) return;
      void roomsRpc
        .setDestination({
          roomId: room.id,
          lat,
          lng,
          label: "Destination",
          memberId: myMemberId,
        })
        .then((r) => {
          if (!r.ok)
            useUiStore.getState().pushAlerts([
              { id: "dest-err", severity: "warn", title: "Couldn't set destination" },
            ]);
        });
    };

    if (me?.role === "spectator") {
      useUiStore.getState().pushAlerts([
        { id: "dest-spectator", severity: "info", title: "Spectators just watch" },
      ]);
      return;
    }

    if (policy === "room") {
      if (!isHost) {
        useUiStore.getState().pushAlerts([
          {
            id: "dest-host-only",
            severity: "info",
            title: "Only the host sets the destination in this mode",
          },
        ]);
        return;
      }
      Alert.alert("Set room destination?", "Everyone will head here.", [
        { text: "Cancel", style: "cancel" },
        { text: "Set destination", onPress: setRoomDest },
      ]);
      return;
    }

    if (policy === "leader-position" && !isLeaderMe) {
      const leaderName = room.leader_id
        ? (membersMap[room.leader_id]?.name ?? "the leader")
        : "the leader";
      useUiStore.getState().pushAlerts([
        { id: "dest-follow", severity: "info", title: `You're following ${leaderName}` },
      ]);
      return;
    }

    Alert.alert("Set your destination?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Set destination", onPress: setMyDest },
    ]);
  };

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

  const onSelectMember = (userId: string) => {
    if (room) router.push(`/room/${room.id}/member/${userId}`);
  };

  const showConnBanner = connection !== "connected";
  const expiry = expiryInfo(room?.expires_at ?? null, nowMs);
  const focusedName =
    focusedMemberId != null ? membersMap[focusedMemberId]?.name ?? null : null;

  return (
    <View style={styles.container}>
      <RoomMap
        cameraRef={cameraRef}
        onLongPress={onLongPress}
        onUserPan={() => useUiStore.getState().setCameraMode("manual")}
        ornamentPosition={
          detent === "peek" ? { bottom: 8, left: 8 } : { top: insets.top + 76, left: 8 }
        }
      >
        <RouteLines routes={routes} myUserId={myUserId} />
        <DestinationMarkers
          destRoom={destRoom}
          destByMember={destByMember}
          members={membersMap}
        />
        <MemberMarkers
          members={positioned}
          nowMs={nowMs}
          myUserId={myUserId}
          onSelectMember={onSelectMember}
        />
      </RoomMap>

      {/* First paint before the snapshot: honest loading state, not a world map. */}
      {!room && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading room…</Text>
        </View>
      )}

      {/* Connected but nobody has shared a position yet. */}
      {room && positioned.length === 0 && connection === "connected" && (
        <View style={[styles.waitingPill, { top: insets.top + 108 }]}>
          <Text style={styles.waitingText}>Waiting for locations…</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          style={styles.pillButton}
          accessibilityRole="button"
          accessibilityLabel="Leave room"
          onPress={leave}
        >
          <Text style={styles.pillButtonText}>←</Text>
        </Pressable>
        <Pressable
          style={styles.titlePill}
          accessibilityRole="button"
          accessibilityLabel="Copy room code"
          onPress={() => void copyCode()}
        >
          <Text style={styles.roomName} numberOfLines={1}>
            {room?.name ?? "…"}
          </Text>
          <Text style={styles.roomCode}>
            {copied ? "Copied!" : `${room?.code ?? ""} · ${strategy.label}`}
          </Text>
        </Pressable>
        <Pressable
          style={styles.pillButton}
          accessibilityRole="button"
          accessibilityLabel="Invite buds"
          onPress={() => room && router.push(`/room/${room.id}/invite`)}
        >
          <Text style={styles.pillButtonText}>+ Invite</Text>
        </Pressable>
        <Pressable
          style={styles.pillButton}
          accessibilityRole="button"
          accessibilityLabel="Room settings"
          onPress={() => room && router.push(`/room/${room.id}/settings`)}
        >
          {/* U+FE0E forces monochrome text presentation cross-platform. */}
          <Text style={styles.pillButtonText}>{"\u2699\uFE0E"}</Text>
        </Pressable>
      </View>

      {showConnBanner && (
        <View style={[styles.connBanner, { top: insets.top + 64 }]}>
          <Text style={styles.connBannerText}>
            {connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </Text>
        </View>
      )}

      {/* Toasts sit below the connection banner when it's visible. */}
      <Toasts topOffset={insets.top + (showConnBanner ? 104 : 64)} />

      {/* Floating actions */}
      <View style={[styles.fabColumn, { bottom: insets.bottom + 160 }]}>
        {focusedName && cameraMode === "auto" && (
          <View style={[styles.fab, styles.fabWide]}>
            <Text style={styles.fabText} numberOfLines={1}>
              Following {focusedName}
            </Text>
          </View>
        )}
        {myDest && (
          <Pressable
            style={[styles.fab, styles.fabWide]}
            accessibilityRole="button"
            accessibilityLabel="Navigate to destination in external maps"
            onPress={() => void openExternalNavigation(myDest.lat, myDest.lng)}
          >
            <Text style={styles.fabText}>Navigate ›</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.fab, cameraMode === "auto" && styles.fabActive]}
          accessibilityRole="button"
          accessibilityLabel="Re-center map on the group"
          onPress={recenter}
        >
          <Text style={styles.fabText}>⊕</Text>
        </Pressable>
      </View>

      {/* Maps-style non-modal sheet: peek (headline) / half (trip panel) /
          full (trip card deck). Map stays interactive behind it; FABs sit
          under the sheet when expanded, with Navigate mirrored in the deck. */}
      <RoomSheet
        detent={detent}
        onDetentChange={setDetent}
        renderContent={(d) => (
          <>
            <InsightsPanel headline={insights.headline} progress={tripProgress} />
            {d !== "peek" && (
              <>
                <ExpiryBanner expiresAt={room?.expires_at ?? null} nowMs={nowMs} />
                {/* Non-hosts otherwise never see the expiry until T-10min. */}
                {!isHost && expiry && !expiry.warning && (
                  <Text style={styles.expiryNote}>{expiry.label}</Text>
                )}
                {canCheckIn && (
                  <Pressable
                    style={styles.checkin}
                    accessibilityRole="button"
                    accessibilityLabel="Mark yourself arrived"
                    onPress={checkIn}
                  >
                    <Text style={styles.checkinText}>I&apos;m here</Text>
                  </Pressable>
                )}
                <MemberList
                  members={members}
                  hostId={room?.host_id ?? null}
                  leaderId={room?.mode === "leader" ? (room?.leader_id ?? null) : null}
                  insights={insights.perMember}
                  nowMs={nowMs}
                  onSelectMember={onSelectMember}
                />
              </>
            )}
            {d === "full" && room && (
              <RoomDetails
                code={room.code}
                travelerCount={tripProgress?.total ?? 0}
                spectatorCount={members.filter((m) => m.role === "spectator").length}
                expiryLabel={expiry && !expiry.expired ? expiry.label : null}
                destLabel={destRoom?.label ?? null}
                copied={copied}
                onCopyCode={() => void copyCode()}
                canNavigate={myDest != null}
                onNavigate={() =>
                  myDest && void openExternalNavigation(myDest.lat, myDest.lng)
                }
                onRecenter={recenter}
                onInvite={() => router.push(`/room/${room.id}/invite`)}
                onSettings={() => router.push(`/room/${room.id}/settings`)}
              />
            )}
          </>
        )}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillButtonText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  titlePill: {
    flex: 1,
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  roomName: { color: colors.text, fontWeight: "700", fontSize: 14 },
  roomCode: { color: colors.accent, fontWeight: "700", fontSize: 11, letterSpacing: 1 },
  connBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  connBannerText: { color: "#1A1300", fontWeight: "700", fontSize: 12 },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.textDim, fontSize: 14, marginTop: 12 },
  waitingPill: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  waitingText: { color: colors.textDim, fontWeight: "600", fontSize: 12 },
  expiryNote: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 2,
  },
  checkin: {
    alignSelf: "center",
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 8,
  },
  checkinText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  fabColumn: { position: "absolute", right: 16, alignItems: "flex-end", gap: 10 },
  fab: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(15,17,21,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  fabWide: { paddingHorizontal: 16 },
  fabActive: { borderColor: colors.accent },
  fabText: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
