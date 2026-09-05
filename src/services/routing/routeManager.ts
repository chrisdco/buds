import { haversineMeters } from "@/lib/geo";
import { serverNowMs } from "@/lib/time";
import type { ClientSnapshot, ModeStrategy } from "@/modes/types";
import { travelers } from "@/modes/shared";
import { distanceFromRouteM } from "@/services/routing/deviation";
import { fetchRoute } from "@/services/routing/router";
import { sendEvt } from "@/services/realtime/roomChannel";
import { useRouteStore } from "@/stores/routeStore";

// Route refetch policy (plan §M2): deviation or staleness, with quota care —
// my own route refreshes fastest (drives my ETA + deviation detection),
// peers' routes slower (display only), leader-chase routes in between
// (the target moves). Fetches run sequentially with a gap so the OSRM demo
// server's ~1 req/s courtesy limit is respected even with 9 peers.
const SELF_STALE_MS = 120_000;
const OTHERS_STALE_MS = 300_000;
const LEADER_TARGET_STALE_MS = 60_000;
const DEST_MOVED_REFETCH_M = 50;
const DEVIATION_THRESHOLD_M = 120;
// >1000ms keeps us under the OSRM demo ~1 req/s courtesy limit (plus jitter
// from fetch latency itself); the old 400ms could burst at 2.5 req/s on join.
const FETCH_GAP_MS = 1_100;

let running = false;
let selfDeviating = false;
let selfDeviatingRoom: string | null = null;

interface FetchTask {
  userId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

function collectTasks(
  snap: ClientSnapshot,
  strategy: ModeStrategy,
  myUserId: string | null,
): FetchTask[] {
  const tasks: FetchTask[] = [];
  const store = useRouteStore.getState();

  // The once-per-episode deviation latch is per-room: a room switch without a
  // full unmount must not suppress the first deviation in the new room.
  if (selfDeviatingRoom !== snap.room.id) {
    selfDeviatingRoom = snap.room.id;
    selfDeviating = false;
  }

  for (const m of travelers(snap)) {
    if (!m.pos) continue;

    const dest = strategy.effectiveDestinationFor(snap, m.userId);
    if (!dest || m.arrivedAt != null) {
      store.clearRoute(m.userId);
      continue;
    }

    const isSelf = m.userId === myUserId;
    const route = snap.routes[m.userId];
    const staleMs =
      dest.kind === "leader"
        ? LEADER_TARGET_STALE_MS
        : isSelf
          ? SELF_STALE_MS
          : OTHERS_STALE_MS;

    let needsFetch = false;
    if (!route || route.coords.length < 2) {
      needsFetch = true;
    } else {
      const end = route.coords[route.coords.length - 1];
      const destMoved =
        !end ||
        !Number.isFinite(end[0]) ||
        !Number.isFinite(end[1]) ||
        haversineMeters(end[1], end[0], dest.lat, dest.lng) > DEST_MOVED_REFETCH_M;
      const stale = Date.now() - route.fetchedAt > staleMs;

      let deviated = false;
      if (isSelf) {
        const offM = distanceFromRouteM(route, m.pos.lat, m.pos.lng);
        deviated = offM > DEVIATION_THRESHOLD_M;
        // Self-reported deviation event, once per episode (plan §6).
        if (deviated && !selfDeviating) {
          selfDeviating = true;
          sendEvt({ k: "deviated", u: m.userId, t: serverNowMs(), offM: Math.round(offM) });
        } else if (!deviated && selfDeviating && offM < DEVIATION_THRESHOLD_M / 2) {
          selfDeviating = false;
        }
      }

      needsFetch = destMoved || stale || deviated;
    }

    if (needsFetch) {
      tasks.push({
        userId: m.userId,
        from: { lat: m.pos.lat, lng: m.pos.lng },
        to: { lat: dest.lat, lng: dest.lng },
      });
    }
  }

  // My route first — it drives my ETA and deviation detection.
  return tasks.sort((a, b) =>
    a.userId === myUserId ? -1 : b.userId === myUserId ? 1 : 0,
  );
}

/**
 * Reconcile cached routes with the current snapshot. Cheap when nothing is
 * stale; safe to call on every insight tick. Concurrent calls coalesce.
 */
export async function ensureRoutes(
  snap: ClientSnapshot,
  strategy: ModeStrategy,
  myUserId: string | null,
): Promise<void> {
  if (running) return;
  running = true;
  try {
    const tasks = collectTasks(snap, strategy, myUserId);
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const route = await fetchRoute(task.from, task.to);
      useRouteStore.getState().setRoute(task.userId, route);
      // Pace all but the trailing fetch; don't hold `running` an extra gap
      // after the last task.
      if (i < tasks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, FETCH_GAP_MS));
      }
    }
  } finally {
    running = false;
  }
}

export function resetRouteManager(): void {
  selfDeviating = false;
  selfDeviatingRoom = null;
  useRouteStore.getState().reset();
}
