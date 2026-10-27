import { AppState } from "react-native";

import { createAlertEngine, type LocalAlert } from "@/events/alertEngine";
import { createArrivalDetector, type ArrivalDetector } from "@/events/arrivalDetector";
import { alertCategory } from "@/events/notifyPrefs";
import { haversineMeters } from "@/lib/geo";
import { serverNowMs } from "@/lib/time";
import { modeRegistry } from "@/modes/registry";
import { DEFAULT_ARRIVAL_RADIUS_M, type ClientSnapshot } from "@/modes/types";
import { ensureNotificationPermission, notifyAlert } from "@/services/notifications";
import { sendEvt } from "@/services/realtime/roomChannel";
import { ensureRoutes } from "@/services/routing/routeManager";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// The room's non-visual brain: local alerts, route reconciliation and
// self-reported arrival. It used to live in the room screen's effects, which
// tied it to that one screen being mounted; it now runs for as long as the
// room connection does (started/stopped by app/room/[id]/_layout.tsx), and is
// testable without rendering anything.
//
// Cadence matches the old effects: re-evaluate when room data changes (store
// subscriptions, coalesced to one pass per microtask) and on a slow 5s clock
// (alert sustain timing and route staleness are time-based).

const TICK_MS = 5_000;

/** Builds the strategy snapshot from the stores, or null before the room loads. */
export function snapshotFromStores(): ClientSnapshot | null {
  const { room, destRoom, destByMember } = useRoomStore.getState();
  if (!room) return null;
  return {
    room,
    members: useMembersStore.getState().members,
    destRoom,
    destByMember,
    routes: useRouteStore.getState().routes,
    units: useSessionStore.getState().units,
  };
}

function maybePrimeNotifications(): void {
  const session = useSessionStore.getState();
  if (session.primedNotifications) return;
  session.setPrimed("notifications");
  // Double-prompt: our sheet explains the value, the OS dialog follows only
  // on Continue. Either way the moment was already alert-worthy.
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
}

function deliver(alerts: LocalAlert[]): void {
  if (AppState.currentState === "active") {
    // Foreground toasts always show; the first alert-worthy moment also
    // primes notifications (our sheet first, OS dialog second).
    maybePrimeNotifications();
    useUiStore.getState().pushAlerts(alerts);
    return;
  }
  // Backgrounded: OS notifications only for enabled categories. "other"
  // (internal errors) always notifies — it's never toggled off.
  const prefs = useSessionStore.getState().notifyPrefs;
  for (const alert of alerts) {
    const category = alertCategory(alert.id);
    if (category === "other" || prefs[category] !== false) void notifyAlert(alert);
  }
}

export interface RoomSessionOptions {
  /** Test seam: clock for alert/arrival timing. */
  now?: () => number;
}

/** Starts the controller; returns its stop function. Idempotent stops. */
export function startRoomSession(options: RoomSessionOptions = {}): () => void {
  const now = options.now ?? Date.now;
  const engine = createAlertEngine();
  let engineKey: string | null = null; // room id + mode: identity for alert state
  let arrival: ArrivalDetector | null = null;
  let arrivalRoomId: string | null = null;
  let scheduled = false;
  let stopped = false;

  const ensureArrivalDetector = (roomId: string) => {
    if (arrivalRoomId === roomId && arrival) return arrival;
    arrivalRoomId = roomId;
    const detector = createArrivalDetector({
      radiusM: () => {
        const r = useRoomStore.getState().room?.settings.arrival_radius_m;
        return Number.isFinite(r) && (r as number) > 0 ? (r as number) : DEFAULT_ARRIVAL_RADIUS_M;
      },
      onArrive: () => {
        // Confirm with the server before announcing: a transient failure
        // re-arms the detector so staying inside the radius retries after a
        // fresh sustain window. The 'arrived' broadcast only goes out on
        // confirmation.
        void (async () => {
          try {
            const res = await roomsRpc.markArrived(roomId);
            const userId = useSessionStore.getState().userId;
            if (res.ok) {
              if (userId) sendEvt({ k: "arrived", u: userId, t: serverNowMs() });
            } else {
              detector.reset();
            }
          } catch {
            detector.reset();
          }
        })();
      },
    });
    arrival = detector;
    return detector;
  };

  const evaluate = () => {
    if (stopped) return;
    const snap = snapshotFromStores();
    const myUserId = useSessionStore.getState().userId;
    if (!snap || !myUserId) return;
    const strategy = modeRegistry[snap.room.mode] ?? modeRegistry.solo;

    // Alert state belongs to one room + mode: switching either re-arms it.
    const key = `${snap.room.id}:${snap.room.mode}`;
    if (key !== engineKey) {
      engine.reset();
      engineKey = key;
    }
    const alerts = engine.evaluate(strategy.alertConditions(snap, myUserId), now());
    if (alerts.length > 0) deliver(alerts);

    // Route reconciliation (staleness / deviation / moved destinations);
    // cheap early-outs when nothing is stale.
    void ensureRoutes(snap, strategy, myUserId);

    // Self-reported arrival: within radius, sustained.
    const detector = ensureArrivalDetector(snap.room.id);
    const myDest = strategy.effectiveDestinationFor(snap, myUserId);
    const me = snap.members[myUserId];
    if (myDest && myDest.kind !== "leader" && me?.pos && me.arrivedAt == null) {
      detector.update(haversineMeters(me.pos.lat, me.pos.lng, myDest.lat, myDest.lng), now());
    }
  };

  // Coalesce bursts (one tick touches several stores) into a single pass.
  const schedule = () => {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      evaluate();
    });
  };

  const unsubs = [
    useRoomStore.subscribe(schedule),
    useMembersStore.subscribe(schedule),
    useRouteStore.subscribe(schedule),
    useSessionStore.subscribe(schedule),
  ];
  const timer = setInterval(evaluate, TICK_MS);
  schedule();

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    for (const unsub of unsubs) unsub();
    arrival = null;
  };
}
