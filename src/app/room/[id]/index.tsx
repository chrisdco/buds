import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearActiveRoom } from "@/lib/activeRoom";
import { expiryInfo } from "@/lib/expiry";
import { LoadingView } from "@/components/ui";
import { openExternalNavigation } from "@/lib/nav";
import { DestinationMarkers } from "@/features/map/DestinationMarkers";
import { MemberMarkers } from "@/features/map/MemberMarkers";
import { RoomMap } from "@/features/map/RoomMap";
import { RouteLines } from "@/features/map/RouteLines";
import { ExpiryBanner } from "@/features/room/ExpiryBanner";
import { InsightsPanel } from "@/features/room/InsightsPanel";
import { MemberList } from "@/features/room/MemberList";
import { RoomDetails } from "@/features/room/RoomDetails";
import { DestinationBar, RoomFabs, RoomTopBar } from "@/features/room/RoomOverlays";
import { RoomSheet, type SheetDetent } from "@/features/room/RoomSheet";
import { roomScreenStyles as styles } from "@/features/room/roomScreenStyles";
import { SosBanner } from "@/features/room/SosBanner";
import { Toasts } from "@/features/room/Toasts";
import { useDestinationPicker } from "@/features/room/useDestinationPicker";
import { useRoomCamera } from "@/features/room/useRoomCamera";
import { useRoomSos } from "@/features/room/useRoomSos";
import { modeRegistry } from "@/modes/registry";
import { travelers } from "@/modes/shared";
import type { ClientSnapshot } from "@/modes/types";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// The room map screen is a view: it derives what to render from the stores
// and wires gestures. Behavior lives elsewhere — alerts, routes and arrival in
// the room-session controller (features/room/session, run by the layout);
// camera, destination picking and SOS in the features/room hooks.

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
  const myUserId = useSessionStore((s) => s.userId);
  const units = useSessionStore((s) => s.units);

  const cameraRef = useRef<CameraRef | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useMemo(() => Object.values(membersMap), [membersMap]);
  const positioned = useMemo(() => members.filter((m) => m.pos), [members]);
  const isHost = room != null && room.host_id === myUserId;
  const strategy = modeRegistry[room?.mode ?? "solo"];
  const me = myUserId ? membersMap[myUserId] : undefined;
  const isTraveler = me?.role === "traveler";

  // Data snapshot WITHOUT the clock: insights recompute only when room data
  // actually changes, never on the 5s presence tick (nowMs).
  const snap: ClientSnapshot | null = useMemo(
    () => (room ? { room, members: membersMap, destRoom, destByMember, routes, units } : null),
    [room, membersMap, destRoom, destByMember, routes, units],
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
  // Uber-style trip progress + Life360-style manual check-in.
  const tripProgress = useMemo(() => {
    if (!snap) return null;
    const tv = travelers(snap);
    if (tv.length === 0) return null;
    return { arrived: tv.filter((m) => m.arrivedAt != null).length, total: tv.length };
  }, [snap]);

  // Slow clock for render-only time: presence labels, expiry countdown, SOS
  // freshness and auto-camera follow.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const picker = useDestinationPicker({
    room,
    myUserId,
    myMemberId,
    membersMap,
    strategy,
    isHost,
    cameraRef,
    mapRef,
    detent,
    setDetent,
  });
  const adjust = picker.adjust;
  const { cameraMode, focusUserIds, recenter } = useRoomCamera({
    cameraRef,
    snap,
    strategy,
    myUserId,
    detent,
    screenH: H,
    nowMs,
    suspended: adjust != null,
  });
  const sos = useRoomSos({ roomId: room?.id, myUserId, isTraveler, membersMap, nowMs });
  const showSos = sos.items.length > 0;
  // One banner row (~38px + 6px gap) per sender: overlays below stack past
  // all of them instead of assuming a single row.
  const sosStackH = sos.items.length * 44;

  const canCheckIn =
    room != null &&
    myDest != null &&
    myDest.kind !== "leader" &&
    me != null &&
    me.role === "traveler" &&
    me.arrivedAt == null;
  const checkIn = useCallback(() => {
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
  }, [room]);

  const copyCode = useCallback(async () => {
    if (!room) return;
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [room]);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const leave = () => {
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Leave room?",
        body: "Your buds will see you go offline.",
        confirmLabel: "Leave",
        destructive: true,
      });
      if (!ok || !room) return;
      void roomsRpc.leaveRoom(room.id);
      clearActiveRoom();
      router.replace("/");
    })();
  };

  const onSelectMember = useCallback(
    (userId: string) => {
      if (room) router.push(`/room/${room.id}/member/${userId}`);
    },
    [room, router],
  );
  const onInvite = useCallback(() => {
    if (room) router.push(`/room/${room.id}/invite`);
  }, [room, router]);
  const onSettings = useCallback(() => {
    if (room) router.push(`/room/${room.id}/settings`);
  }, [room, router]);
  const onSearchDest = () => {
    if (!room || !myUserId) return;
    if (me?.role === "spectator") {
      useUiStore.getState().pushAlerts([
        { id: "dest-spectator", severity: "info", title: "Spectators just watch" },
      ]);
      return;
    }
    router.push(`/room/${room.id}/dest-search`);
  };
  const onNavigateToDest = useCallback(() => {
    if (myDest) void openExternalNavigation(myDest.lat, myDest.lng);
  }, [myDest]);

  const showConnBanner = connection !== "connected";
  // Primitives (not the expiry object) feed memoized children so the 5s
  // presence tick doesn't churn their props.
  const expiry = expiryInfo(room?.expires_at ?? null, nowMs);
  const expiryLabel = expiry && !expiry.expired ? expiry.label : null;
  const expiryWarning = expiry?.warning ?? false;
  const focusedName =
    focusUserIds.length === 1 ? (membersMap[focusUserIds[0]]?.name ?? null) : null;
  const focusLabel =
    cameraMode !== "auto"
      ? null
      : focusUserIds.length > 1
        ? `Focusing ${focusUserIds.length}`
        : focusedName
          ? `Following ${focusedName}`
          : null;

  return (
    <View style={styles.container}>
      <RoomMap
        cameraRef={cameraRef}
        mapRef={mapRef}
        onLongPress={picker.onLongPress}
        onUserPan={() => useUiStore.getState().setCameraMode("manual")}
        onRegionChange={picker.onRegionChange}
        ornamentPosition={
          detent === "peek" ? { bottom: 8, right: 8 } : { top: insets.top + 76, right: 8 }
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
          selectedIds={focusUserIds}
          onToggleFocus={(userId) => {
            useUiStore.getState().toggleFocusUserId(userId);
            useUiStore.getState().setCameraMode("auto");
          }}
        />
      </RoomMap>

      {/* First paint before the snapshot: honest loading state, not a world map. */}
      {!room && (
        <View style={styles.loadingOverlay}>
          <LoadingView label="Loading room…" />
        </View>
      )}

      {/* Connected but nobody has shared a position yet. */}
      {room && positioned.length === 0 && connection === "connected" && (
        <View style={[styles.waitingPill, { top: insets.top + 108 }]}>
          <Text style={styles.waitingText}>Waiting for locations…</Text>
        </View>
      )}

      <RoomTopBar
        top={insets.top + 8}
        name={room?.name ?? null}
        subtitle={copied ? "Copied!" : `${room?.code ?? ""} · ${strategy.label}`}
        onLeave={leave}
        onCopyCode={() => void copyCode()}
        onInvite={onInvite}
        onSettings={onSettings}
      />

      {showConnBanner && (
        <View style={[styles.connBanner, { top: insets.top + 64 }]}>
          <Text style={styles.connBannerText}>
            {connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </Text>
        </View>
      )}

      {/* Peer SOS alerts stack below the connection banner when visible. */}
      {showSos && (
        <SosBanner
          items={sos.items}
          nowMs={sos.sosNowMs}
          top={insets.top + (showConnBanner ? 108 : 64)}
          onNavigate={(lat, lng) => void openExternalNavigation(lat, lng)}
        />
      )}

      <DestinationBar
        top={insets.top + (showConnBanner ? 108 : 60) + sosStackH}
        adjust={adjust}
        destLabel={destRoom?.label ?? null}
        canSearch={isTraveler}
        onSearch={onSearchDest}
        onCancel={picker.cancel}
        onConfirm={picker.confirm}
      />

      {/* Toasts sit below the connection/SOS banners when visible. */}
      <Toasts topOffset={insets.top + (showConnBanner ? 104 : 64) + sosStackH} />

      <RoomFabs
        bottom={insets.bottom + 160}
        focusLabel={focusLabel}
        focusA11y={
          focusUserIds.length > 1
            ? `Clear focus on ${focusUserIds.length} members`
            : `Unfollow ${focusedName}`
        }
        onClearFocus={() => useUiStore.getState().setFocusUserIds([])}
        onNavigate={myDest ? onNavigateToDest : null}
        autoCamera={cameraMode === "auto"}
        onRecenter={recenter}
        sos={isTraveler ? { active: sos.mySosActive, onPress: sos.mySosActive ? sos.cancel : sos.send } : null}
      />

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
                {!isHost && expiryLabel && !expiryWarning && (
                  <Text style={styles.expiryNote}>{expiryLabel} · ask the host to extend</Text>
                )}
                {canCheckIn && (
                  <Pressable
                    style={({ pressed }) => [styles.checkin, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Mark yourself arrived"
                    testID="room-checkin"
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
                  units={units}
                  onSelectMember={onSelectMember}
                  selectedIds={focusUserIds}
                />
              </>
            )}
            {d === "full" && room && (
              <RoomDetails
                code={room.code}
                travelerCount={tripProgress?.total ?? 0}
                spectatorCount={members.filter((m) => m.role === "spectator").length}
                expiryLabel={expiryLabel}
                destLabel={destRoom?.label ?? null}
                copied={copied}
                onCopyCode={copyCode}
                canNavigate={myDest != null}
                onNavigate={onNavigateToDest}
                onRecenter={recenter}
                onInvite={onInvite}
                onSettings={onSettings}
              />
            )}
          </>
        )}
      />
    </View>
  );
}
