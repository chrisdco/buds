import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearActiveRoom } from "@/lib/activeRoom";
import { expiryInfo } from "@/lib/expiry";
import { haversineMeters } from "@/lib/geo";
import { LoadingView } from "@/components/ui";
import { openExternalNavigation } from "@/lib/nav";
import { DestinationMarkers } from "@/features/map/DestinationMarkers";
import { MemberMarkers } from "@/features/map/MemberMarkers";
import { RoomMap } from "@/features/map/RoomMap";
import { RouteLines } from "@/features/map/RouteLines";
import { ExpiryBanner } from "@/features/room/ExpiryBanner";
import { MemberList } from "@/features/room/MemberList";
import { AdjustPin, BackCircle, RoomFabs } from "@/features/room/RoomOverlays";
import { RoomSheet, sheetVisibleHeight, type SheetDetent } from "@/features/room/RoomSheet";
import {
  DestinationRow,
  RoomFacts,
  SheetFooter,
  SheetHeader,
  primaryAction,
} from "@/features/room/RoomSheetContent";
import { roomScreenStyles as styles } from "@/features/room/roomScreenStyles";
import { SosBanner } from "@/features/room/SosBanner";
import { Toasts } from "@/features/room/Toasts";
import { useDestinationPicker } from "@/features/room/useDestinationPicker";
import { useRoomCamera } from "@/features/room/useRoomCamera";
import { useRoomSos } from "@/features/room/useRoomSos";
import { modeRegistry } from "@/modes/registry";
import { travelers } from "@/modes/shared";
import { DEFAULT_ARRIVAL_RADIUS_M, type ClientSnapshot } from "@/modes/types";
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
  const [peekH, setPeekH] = useState(160);
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
    padBottom: Math.round(sheetVisibleHeight(detent, H, peekH) + 40),
    nowMs,
    suspended: adjust != null,
  });
  const sos = useRoomSos({ roomId: room?.id, myUserId, isTraveler, membersMap, nowMs });

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
  const expiry = expiryInfo(room?.expires_at ?? null, nowMs);
  const expiryLabel = expiry && !expiry.expired ? expiry.label : null;
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

  // Who may set the destination under this mode (the sheet hides the search
  // row otherwise — Uber hides what you can't do).
  const policy = strategy.destinationPolicy;
  const canSetDest =
    isTraveler &&
    (policy === "room" ? isHost : policy !== "leader-position" || room?.leader_id === myUserId);
  const destLabel =
    policy === "room" ? (destRoom?.label ?? null) : myDest && myDest.kind !== "leader" ? myDest.label : null;

  // "I'm here" takes over the CTA once you're close to where you're going.
  const radiusM = room?.settings.arrival_radius_m ?? DEFAULT_ARRIVAL_RADIUS_M;
  const nearDest =
    myDest != null && me?.pos != null
      ? haversineMeters(me.pos.lat, me.pos.lng, myDest.lat, myDest.lng) <= Math.max(300, radiusM * 3)
      : false;
  const action = adjust
    ? null
    : primaryAction({
        isTraveler,
        hasDest: myDest != null,
        canSetDest,
        canCheckIn,
        nearDest,
      });
  const runAction = () => {
    if (action === "checkin") checkIn();
    else if (action === "navigate") onNavigateToDest();
    else if (action === "setDest") onSearchDest();
    else if (action === "invite") onInvite();
  };

  const travelerCount = tripProgress?.total ?? 0;
  const spectatorCount = members.filter((m) => m.role === "spectator").length;
  const status = insights.headline;
  const meta = [strategy.label, expiryLabel, `${members.length} in room`].filter(Boolean).join(" · ");
  const etaByUser = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [uid, i] of Object.entries(insights.perMember)) {
      if (i.etaS != null && i.arrivedRank == null) out[uid] = i.etaS;
    }
    return out;
  }, [insights]);

  // Top stack, Uber-minimal: back circle on its own row, then banners,
  // then the adjust card, then toasts — each starts below the last.
  let y = insets.top + 68;
  const connTop = y;
  if (showConnBanner) y += 40;
  const sosTop = y;
  y += sos.items.length * 44;
  const waitingTop = y;
  const showWaiting = room != null && positioned.length === 0 && connection === "connected";
  if (showWaiting) y += 36;
  const adjustTop = y;
  if (adjust) y += 124;
  const toastTop = y;

  const visibleSheet = sheetVisibleHeight(detent, H, peekH);
  const fabBottom = visibleSheet + 12;

  return (
    <View style={styles.container}>
      <RoomMap
        cameraRef={cameraRef}
        mapRef={mapRef}
        onLongPress={picker.onLongPress}
        onUserPan={() => useUiStore.getState().setCameraMode("manual")}
        onRegionChange={picker.onRegionChange}
        ornamentPosition={{ top: insets.top + 12, right: 12 }}
      >
        <RouteLines routes={routes} myUserId={myUserId} />
        <DestinationMarkers destRoom={destRoom} destByMember={destByMember} members={membersMap} />
        <MemberMarkers
          members={positioned}
          nowMs={nowMs}
          myUserId={myUserId}
          selectedIds={focusUserIds}
          etaByUser={etaByUser}
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

      <BackCircle top={insets.top + 8} onPress={leave} />

      {showConnBanner && (
        <View style={[styles.connBanner, { top: connTop }]}>
          <Text style={styles.connBannerText}>
            {connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </Text>
        </View>
      )}

      {sos.items.length > 0 && (
        <SosBanner
          items={sos.items}
          nowMs={sos.sosNowMs}
          top={sosTop}
          onNavigate={(lat, lng) => void openExternalNavigation(lat, lng)}
        />
      )}

      {/* Connected but nobody has shared a position yet. */}
      {showWaiting && (
        <View style={[styles.waitingPill, { top: waitingTop }]}>
          <Text style={styles.waitingText}>Waiting for locations…</Text>
        </View>
      )}

      {adjust && (
        <AdjustPin top={adjustTop} adjust={adjust} onCancel={picker.cancel} onConfirm={picker.confirm} />
      )}

      <Toasts topOffset={toastTop} />

      {detent !== "full" && (
        <RoomFabs
          bottom={fabBottom}
          focusLabel={focusLabel}
          focusA11y={
            focusUserIds.length > 1
              ? `Clear focus on ${focusUserIds.length} members`
              : `Unfollow ${focusedName}`
          }
          onClearFocus={() => useUiStore.getState().setFocusUserIds([])}
          autoCamera={cameraMode === "auto"}
          onRecenter={recenter}
          sos={isTraveler ? { active: sos.mySosActive, onPress: sos.mySosActive ? sos.cancel : sos.send } : null}
        />
      )}

      {/* Uber "Choose a trip" sheet: title + status, destination, the member
      list (ETA right), and one pinned CTA that follows the trip's state. */}
      <RoomSheet
        detent={detent}
        onDetentChange={setDetent}
        onPeekHeight={setPeekH}
        renderHeader={() => (
          <SheetHeader
            title={room?.name ?? "…"}
            status={status}
            meta={meta}
            progress={tripProgress && tripProgress.total > 1 ? tripProgress : null}
            onInvite={onInvite}
            onSettings={onSettings}
          />
        )}
        renderBody={(d) => (
          <>
            <ExpiryBanner expiresAt={room?.expires_at ?? null} nowMs={nowMs} />
            <DestinationRow label={destLabel} canSet={canSetDest} onSearch={onSearchDest} />
            <MemberList
              members={members}
              myUserId={myUserId}
              hostId={room?.host_id ?? null}
              leaderId={room?.mode === "leader" ? (room?.leader_id ?? null) : null}
              insights={insights.perMember}
              sosUserIds={sos.activeUserIds}
              nowMs={nowMs}
              units={units}
              onSelectMember={onSelectMember}
              selectedIds={focusUserIds}
            />
            {d === "full" && room && (
              <RoomFacts
                code={room.code}
                copied={copied}
                travelerCount={travelerCount}
                spectatorCount={spectatorCount}
                onCopyCode={() => void copyCode()}
                onInvite={onInvite}
                onSettings={onSettings}
                onLeave={leave}
              />
            )}
          </>
        )}
        renderFooter={
          action
            ? () => (
                <SheetFooter
                  action={action}
                  onAction={runAction}
                  secondary={action !== "invite" ? { label: "Invite buds", onPress: onInvite } : null}
                />
              )
            : undefined
        }
      />
    </View>
  );
}
