import type { CameraRef, LngLat, MapRef } from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { createAlertEngine } from "@/events/alertEngine";
import { createArrivalDetector, type ArrivalDetector } from "@/events/arrivalDetector";
import { clearActiveRoom } from "@/lib/activeRoom";
import { expiryInfo } from "@/lib/expiry";
import { haversineMeters } from "@/lib/geo";
import { collectFitPoints } from "@/lib/mapBounds";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button } from "@/components/ui";
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
import { notifyAlert, ensureNotificationPermission } from "@/services/notifications";
import { alertCategory } from "@/events/notifyPrefs";
import { ensureTripPack } from "@/services/map/offlinePacks";
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
  const focusUserIds = useUiStore((s) => s.focusUserIds);
  const destDraft = useUiStore((s) => s.destDraft);
  const myUserId = useSessionStore((s) => s.userId);

  const cameraRef = useRef<CameraRef | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const engineRef = useRef(createAlertEngine());
  const arrivalRef = useRef<ArrivalDetector | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  // Adjust-pin draft: picked via search or long-press, awaiting map adjust +
  // confirm. Coords track the live map center while active.
  const [adjust, setAdjust] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const members = useMemo(() => Object.values(membersMap), [membersMap]);
  const positioned = useMemo(() => members.filter((m) => m.pos), [members]);
  const isHost = room != null && room.host_id === myUserId;
  const strategy = modeRegistry[room?.mode ?? "solo"];

  // Data snapshot WITHOUT the clock: insights/alerts/routes recompute only
  // when room data actually changes. The 5s presence tick (nowMs) drives
  // presence labels, alert sustain timing, and route staleness checks — never
  // a full recompute (previously every tick re-ran a turf scan per pair).
  const units = useSessionStore((s) => s.units);
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

  // Slow clock driving presence labels, alert sustain timing, and route
  // staleness checks — deliberately NOT part of the data snapshot above.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  // Local alert engine: strategies report conditions, engine handles
  // sustain/dedupe/re-arm; reset when the room (or mode) changes identity.
  useEffect(() => {
    engineRef.current.reset();
  }, [room?.id, room?.mode]);
  const maybePrimeNotifications = () => {
    const session = useSessionStore.getState();
    if (session.primedNotifications) return;
    session.setPrimed("notifications");
    // Double-prompt: our sheet explains the value, the OS dialog follows
    // only on Continue. Either way the moment was already alert-worthy.
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Stay in the loop?",
        body: "Buds can notify you about arrivals and alerts even with the screen off.",
        confirmLabel: "Continue",
        cancelLabel: "Not now",
        destructive: false,
      });
      if (ok) void ensureNotificationPermission();
    })();
  };
  useEffect(() => {
    if (!snap || !myUserId) return;
    const alerts = engineRef.current.evaluate(
      strategy.alertConditions(snap, myUserId),
      Date.now(),
    );
    if (alerts.length === 0) return;
    if (AppState.currentState === "active") {
      // Foreground toasts always show; first alert-worthy moment also primes
      // notifications (double-prompt: our sheet first, OS dialog second).
      maybePrimeNotifications();
      useUiStore.getState().pushAlerts(alerts); // in-app toast
    } else {
      // Backgrounded: OS notifications only for enabled categories.
      // "other" (internal errors) always notifies — it's never toggled off.
      const prefs = useSessionStore.getState().notifyPrefs;
      for (const alert of alerts) {
        const category = alertCategory(alert.id);
        if (category === "other" || prefs[category] !== false) void notifyAlert(alert);
      }
    }
  }, [snap, strategy, myUserId, nowMs]);

  // Route reconciliation (staleness / deviation / moved destinations).
  // Runs on data change AND on the slow tick: staleness is time-based, so a
  // static scene still refetches expired routes. The reconcile itself is
  // cheap early-outs when nothing is stale.
  useEffect(() => {
    if (snap && myUserId) void ensureRoutes(snap, strategy, myUserId);
  }, [snap, strategy, myUserId, nowMs]);

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
    // fitAll frames the whole trip: members + destination + every rendered
    // route leg, so a detouring road route pulls the frame instead of
    // running off-screen. fitUsers stays members-only by definition.
    const points = collectFitPoints({
      members: pool,
      dest: target.kind === "fitAll" ? destRoom : null,
      routeLines:
        target.kind === "fitAll" ? Object.values(routes).map((r) => r.coords) : undefined,
    });
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

  const recenter = useCallback(() => {
    useUiStore.getState().setFocusUserIds([]);
    useUiStore.getState().setCameraMode("auto");
    if (snap && myUserId) applyCameraTarget(strategy.cameraTarget(snap, myUserId), camPadBottom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, myUserId, strategy, camPadBottom]);

  // Auto camera follows the strategy's policy until the user pans — unless
  // members are focused (marker toggle / detail Follow): one pins the camera
  // to them, several frames the set. Suspended while adjusting a pin.
  useEffect(() => {
    if (cameraMode !== "auto" || adjust || !snap || !myUserId) return;
    const focused = focusUserIds.filter((id) => membersMap[id]?.pos);
    applyCameraTarget(
      focused.length === 1
        ? { kind: "follow", userId: focused[0] }
        : focused.length > 1
          ? { kind: "fitUsers", userIds: focused }
          : strategy.cameraTarget(snap, myUserId),
      camPadBottom,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cameraMode, adjust, room?.mode, focusUserIds, detent, H]);

  const setRoomDest = (lat: number, lng: number, label: string) => {
    if (!room) return;
    void roomsRpc
      .setDestination({ roomId: room.id, lat, lng, label })
      .then((r) => {
        if (!r.ok)
          useUiStore.getState().pushAlerts([
            { id: "dest-err", severity: "warn", title: "Couldn't set destination" },
          ]);
        else void ensureTripPack(lat, lng);
      });
  };
  const setMyDest = (lat: number, lng: number, label: string) => {
    if (!myMemberId || !room) return;
    void roomsRpc
      .setDestination({
        roomId: room.id,
        lat,
        lng,
        label,
        memberId: myMemberId,
      })
      .then((r) => {
        if (!r.ok)
          useUiStore.getState().pushAlerts([
            { id: "dest-err", severity: "warn", title: "Couldn't set destination" },
          ]);
        else void ensureTripPack(lat, lng);
      });
  };

  const onLongPress = (lngLat: LngLat) => {
    if (!room || !myUserId) return;
    const [lng, lat] = lngLat;
    const me = membersMap[myUserId];
    const policy = strategy.destinationPolicy;
    const isLeaderMe = room.leader_id === myUserId;

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
      // Long-press seeds adjust-pin mode (drag to fine-tune, then confirm)
      // instead of setting immediately — same confirm copy as before.
      setAdjust({ lat, lng, label: "Meet point" });
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

    setAdjust({ lat, lng, label: "Destination" });
  };

  // Search picks land here via the store: fly the pin into view, then hand
  // to adjust mode so the same policy gates + confirm apply. Deferred to a
  // microtask: consuming external-store state synchronously in an effect is
  // a cascading-render hazard (zigzag: search screen set -> this effect set).
  useEffect(() => {
    if (!destDraft) return;
    const draft = destDraft;
    queueMicrotask(() => {
      useUiStore.getState().setDestDraft(null);
      cameraRef.current?.easeTo({ center: [draft.lng, draft.lat], zoom: 15, duration: 700 });
      setAdjust({ lat: draft.lat, lng: draft.lng, label: draft.label });
    });
  }, [destDraft]);

  // While adjusting, the pin stays screen-centered: track the live map center
  // as the user drags (fires on gesture end, not per frame).
  const onAdjustRegionChange = () => {
    if (!adjust) return;
    void mapRef.current?.getCenter().then(([lng, lat]) => {
      setAdjust((prev) => (prev ? { ...prev, lat, lng } : prev));
    }).catch(() => {});
  };

  const confirmAdjust = () => {
    if (!room || !myUserId || !adjust) return;
    const { lat, lng, label } = adjust;
    const policy = strategy.destinationPolicy;
    const finish = () => setAdjust(null);
    if (policy === "room") {
      void (async () => {
        const ok = await useUiStore.getState().requestConfirm({
          title: "Set room destination?",
          body: `${label} — everyone will head here.`,
          confirmLabel: "Set destination",
          destructive: false,
        });
        if (ok) setRoomDest(lat, lng, label);
        finish();
      })();
      return;
    }
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Set your destination?",
        body: label,
        confirmLabel: "Set destination",
        destructive: false,
      });
      if (ok) setMyDest(lat, lng, label);
      finish();
    })();
  };

  const copyCode = useCallback(async () => {
    if (!room) return;
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [room]);

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

  return (
    <View style={styles.container}>
      <RoomMap
        cameraRef={cameraRef}
        mapRef={mapRef}
        onLongPress={onLongPress}
        onUserPan={() => useUiStore.getState().setCameraMode("manual")}
        onRegionChange={onAdjustRegionChange}
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
          testID="room-leave"
          onPress={leave}
        >
          <AppSymbol
            name={icons.back}
            fallback={icons.back.fallback}
            size={18}
            tintColor={colors.text}
          />
        </Pressable>
        <Pressable
          style={styles.titlePill}
          accessibilityRole="button"
          accessibilityLabel="Copy room code"
          testID="room-copy-code"
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
          testID="room-invite"
          onPress={() => room && router.push(`/room/${room.id}/invite`)}
        >
          <View style={styles.pillRow}>
            <AppSymbol
              name={icons.invite}
              fallback={icons.invite.fallback}
              size={16}
              tintColor={colors.text}
            />
            <Text style={styles.pillButtonText}>Invite</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.pillButton}
          accessibilityRole="button"
          accessibilityLabel="Room settings"
          testID="room-settings"
          onPress={() => room && router.push(`/room/${room.id}/settings`)}
        >
          {/* U+FE0E forces monochrome text presentation cross-platform. */}
          <AppSymbol
            name={icons.settings}
            fallback={icons.settings.fallback}
            size={20}
            tintColor={colors.text}
          />
        </Pressable>
      </View>

      {showConnBanner && (
        <View style={[styles.connBanner, { top: insets.top + 64 }]}>
          <Text style={styles.connBannerText}>
            {connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </Text>
        </View>
      )}

      {/* Destination entry + adjust-pin card: Uber "Where to?" grammar.
      Sits below the top bar (under the conn banner when visible). */}
      {!adjust ? (
        <Pressable
          style={[styles.searchPill, { top: insets.top + (showConnBanner ? 108 : 60) }]}
          accessibilityRole="button"
          accessibilityLabel={destRoom ? `Change destination, currently ${destRoom.label}` : "Search for a destination"}
          testID="room-dest-search"
          onPress={() => {
            if (!room || !myUserId) return;
            const me = membersMap[myUserId];
            if (me?.role === "spectator") {
              useUiStore.getState().pushAlerts([
                { id: "dest-spectator", severity: "info", title: "Spectators just watch" },
              ]);
              return;
            }
            router.push(`/room/${room.id}/dest-search`);
          }}
        >
          <AppSymbol
            name={icons.search}
            fallback={icons.search.fallback}
            size={17}
            tintColor={colors.textDim}
          />
          <Text style={styles.searchText} numberOfLines={1}>
            {destRoom?.label ?? "Where to?"}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.adjustCard, { top: insets.top + (showConnBanner ? 108 : 60) }]}>
          <Text style={styles.adjustLabel} numberOfLines={1}>
            {adjust.label}
          </Text>
          <Text style={styles.adjustHint}>Drag the map to fine-tune the pin</Text>
          <View style={styles.adjustRow}>
            <View style={styles.adjustBtn}>
              <Button
                label="Cancel"
                variant="ghost"
                size="compact"
                testID="adjust-cancel"
                onPress={() => setAdjust(null)}
              />
            </View>
            <View style={styles.adjustBtn}>
              <Button
                label="Set destination"
                size="compact"
                testID="adjust-confirm"
                onPress={confirmAdjust}
              />
            </View>
          </View>
        </View>
      )}

      {/* Adjust pin: fixed at the visible map strip while the map moves under it. */}
      {adjust && (
        <View style={styles.adjustPin} pointerEvents="none">
          <View style={[styles.pinCircle, { backgroundColor: colors.accent }]}>
            <Text style={styles.pinGlyph}>{"\u2691\uFE0E"}</Text>
          </View>
          <View style={[styles.pinTip, { borderTopColor: colors.accent }]} />
        </View>
      )}

      {/* Toasts sit below the connection banner when it's visible. */}
      <Toasts topOffset={insets.top + (showConnBanner ? 104 : 64)} />

      {/* Floating actions */}
      <View style={[styles.fabColumn, { bottom: insets.bottom + 160 }]}>
        {(focusedName || focusUserIds.length > 1) && cameraMode === "auto" && (
          <Pressable
            style={[styles.fab, styles.fabWide]}
            accessibilityRole="button"
            accessibilityLabel={
              focusUserIds.length > 1 ? `Clear focus on ${focusUserIds.length} members` : `Unfollow ${focusedName}`
            }
            testID="focus-chip"
            onPress={() => useUiStore.getState().setFocusUserIds([])}
          >
            <Text style={styles.fabText} numberOfLines={1}>
              {focusUserIds.length > 1 ? `Focusing ${focusUserIds.length}` : `Following ${focusedName}`}
            </Text>
          </Pressable>
        )}
        {myDest && (
          <Pressable
            style={[styles.fab, styles.fabWide]}
            accessibilityRole="button"
            accessibilityLabel="Navigate to destination in external maps"
            testID="room-navigate"
            onPress={() => void openExternalNavigation(myDest.lat, myDest.lng)}
          >
            <View style={styles.pillRow}>
              <AppSymbol
                name={icons.navigate}
                fallback={icons.navigate.fallback}
                size={17}
                tintColor={colors.text}
              />
              <Text style={styles.fabText}>Navigate</Text>
            </View>
          </Pressable>
        )}
        <Pressable
          style={[styles.fab, cameraMode === "auto" && styles.fabActive]}
          accessibilityRole="button"
          accessibilityLabel="Re-center map on the group"
          testID="room-recenter"
          onPress={recenter}
        >
          <AppSymbol
            name={icons.recenter}
            fallback={icons.recenter.fallback}
            size={22}
            tintColor={cameraMode === "auto" ? colors.accent : colors.text}
          />
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
                {!isHost && expiryLabel && !expiryWarning && (
                  <Text style={styles.expiryNote}>{expiryLabel}</Text>
                )}
                {canCheckIn && (
                  <Pressable
                    style={styles.checkin}
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
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillButtonText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  titlePill: {
    flex: 1,
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  roomName: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 14 },
  roomCode: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  connBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.warning,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  connBannerText: { color: "#1A1300", fontFamily: fontFamily.bold, fontSize: 12 },
  searchPill: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchText: { color: colors.textDim, fontSize: 15, fontFamily: fontFamily.regular, flexShrink: 1 },
  adjustCard: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  adjustLabel: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold },
  adjustHint: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 2 },
  adjustRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  adjustBtn: { flex: 1 },
  adjustPin: { position: "absolute", top: "24%", alignSelf: "center", alignItems: "center" },
  pinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinGlyph: { color: "#FFFFFF", fontSize: 14, fontFamily: fontFamily.bold },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
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
  loadingText: {
    color: colors.textDim,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    marginTop: 12,
  },
  waitingPill: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  waitingText: { color: colors.textDim, fontFamily: fontFamily.semiBold, fontSize: 12 },
  expiryNote: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textAlign: "center",
    marginBottom: 2,
  },
  checkin: {
    alignSelf: "center",
    borderColor: colors.text,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 8,
  },
  checkinText: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 13 },
  fabColumn: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
    gap: 10,
    // Above the bottom sheet (elevation 8): FABs stay tappable at every
    // detent instead of sinking under the deck. Native modals still cover all.
    elevation: 9,
    zIndex: 9,
  },
  fab: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  fabWide: { paddingHorizontal: 16 },
  fabActive: { borderColor: colors.text },
  fabText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
});
