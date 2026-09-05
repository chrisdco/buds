import { serverNowMs } from "@/lib/time";
import { createJitterFilter, type Fix } from "@/services/location/jitterFilter";
import { buildTick } from "@/services/location/tick";
import { createSendThrottle } from "@/services/location/throttle";
import { isRoomChannelLive, sendLoc } from "@/services/realtime/roomChannel";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { LocTick } from "@/types/contracts";

// The single owner of the fix -> filter -> throttle -> tick -> publish loop.
// BOTH the foreground watcher and the background TaskManager task feed the
// SAME publisher instance (keyed by room) so jitter/throttle state is shared
// and the two lanes can't double-send. Publish lane is chosen per tick:
// broadcast when the realtime channel is live, else a last_seen HTTPS upsert.

const LAST_SEEN_INTERVAL_MS = 60_000;

export interface PublishContext {
  userId: string;
  roomId: string;
  /** Background lane forces true; foreground passes a live AppState check. */
  isBackground: () => boolean;
  /**
   * Called when the server reports this user no longer has a live sharing lease
   * on the room (room ended / kicked / left). Lets the headless background task
   * self-terminate the foreground service even while the app is suspended.
   */
  onLeaseLost?: () => void;
}

export interface Publisher {
  /** Returns true if the fix passed filter + throttle and was published. */
  publish(raw: Fix): boolean;
  reset(): void;
}

export function createPublisher(ctx: PublishContext): Publisher {
  const filter = createJitterFilter();
  const throttle = createSendThrottle({
    floorMs: () => useRoomStore.getState().room?.settings.min_send_interval_ms ?? 0,
    isBackground: ctx.isBackground,
  });
  let lastSeenSentAt = 0;

  const upsertLastSeen = (tick: LocTick) => {
    roomsRpc
      .updateLastSeen({
        roomId: ctx.roomId,
        lat: tick.la,
        lng: tick.ln,
        heading: tick.h ?? null,
        speed: tick.s ?? null,
      })
      .then(
        (res) => {
          // Only back off after a confirmed write — a failed upsert must be
          // retried on the next accepted tick, not blacked out for 60s.
          if (res.ok) {
            lastSeenSentAt = Date.now();
          } else if (res.error === "room_ended" || res.error === "not_member") {
            ctx.onLeaseLost?.();
          }
        },
        () => {
          // Transport failure: keep lastSeenSentAt so the next tick retries.
        },
      );
  };

  return {
    publish(raw) {
      // role / sharing gate (skipped on a cold background start where the
      // members store is empty — we still want to publish in that case).
      const me = useMembersStore.getState().members[ctx.userId];
      if (me && (me.role !== "traveler" || !me.sharing)) return false;

      const fix = filter(raw);
      if (!fix) return false;
      if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return false;

      const { send, moving } = throttle(fix);
      if (!send) return false;

      const tick = buildTick(ctx.userId, fix, moving, serverNowMs());

      // The last_seen upsert is a coarse ~60s recovery snapshot in BOTH lanes:
      // while broadcasting it backstops late joiners; while the socket is down
      // (typical in background) it's the only lane out. Floor it either way so
      // a reconnect flap can't burst one HTTPS write per tick.
      const dueForLastSeen = Date.now() - lastSeenSentAt > LAST_SEEN_INTERVAL_MS;
      if (isRoomChannelLive()) {
        sendLoc(tick);
        if (dueForLastSeen) upsertLastSeen(tick);
      } else if (dueForLastSeen) {
        upsertLastSeen(tick);
      }

      // broadcast.self is off, so paint our own marker locally.
      useMembersStore.getState().applyTick(tick);
      return true;
    },
    reset() {
      lastSeenSentAt = 0;
    },
  };
}

// One shared instance per room, reachable from both lanes (incl. headless code).
// The filter/throttle state stays shared, but the lane-specific options are
// refreshed on every call: the foreground watcher usually registers first and
// the headless background task later (or vice versa), and the first-wins
// behavior previously dropped the background throttle multiplier + lease
// teardown. The mutable holder below is read through an indirection so the
// already-created publisher always sees the latest lane options.
let current: {
  publisher: Publisher;
  roomId: string;
  userId: string;
  lane: { isBackground: () => boolean; onLeaseLost?: () => void };
} | null = null;

/**
 * Resolves the shared publisher for a room. `userId` may be passed explicitly
 * (the headless task does this); otherwise it comes from the session store.
 * Returns null when no user identity is available (safe no-op for callers).
 */
export function getPublisher(
  roomId: string,
  opts: { isBackground: () => boolean; userId?: string; onLeaseLost?: () => void },
): Publisher | null {
  const userId = opts.userId ?? useSessionStore.getState().userId;
  if (!userId) return null;
  if (current && current.roomId === roomId && current.userId === userId) {
    // Same room + identity: keep the shared filter/throttle state, adopt the
    // latest lane options (background predicate + lease callback).
    current.lane.isBackground = opts.isBackground;
    if (opts.onLeaseLost) current.lane.onLeaseLost = opts.onLeaseLost;
    return current.publisher;
  }
  const lane: { isBackground: () => boolean; onLeaseLost?: () => void } = {
    isBackground: opts.isBackground,
    onLeaseLost: opts.onLeaseLost,
  };
  current = {
    publisher: createPublisher({
      userId,
      roomId,
      // Indirection: throttle/lease paths created now must observe lane
      // updates from later getPublisher calls for the same room.
      isBackground: () => lane.isBackground(),
      onLeaseLost: () => lane.onLeaseLost?.(),
    }),
    roomId,
    userId,
    lane,
  };
  return current.publisher;
}

export function disposePublisher(): void {
  current = null;
}
