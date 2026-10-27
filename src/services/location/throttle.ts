import { haversineMeters } from "@/lib/geo";
import type { Fix } from "@/services/location/jitterFilter";

// Adaptive send throttle (plan §3): driving 2.5s, walking 4s, stationary 20s,
// doubled in background; gated on actual movement with a 30s heartbeat so
// parked travelers still emit an occasional "I'm alive" tick. When no peer
// is watching (nobody else foreground), every rate drops to the heartbeat:
// recipients are billed per message, and pocketed phones don't render. The
// first fix after a watcher appears is already past the normal interval, so
// the rate snaps back with no extra delay.
const DRIVING_SPEED_MS = 7;
const WALKING_SPEED_MS = 0.7;
const DRIVING_INTERVAL_MS = 2_500;
const WALKING_INTERVAL_MS = 4_000;
const STATIONARY_INTERVAL_MS = 20_000;
const HEARTBEAT_MS = 30_000;
const MIN_MOVE_M = 8;
const MIN_HEADING_DELTA_DEG = 20;

export interface ThrottleOptions {
  /** Remote-tweakable floor from rooms.settings.min_send_interval_ms. */
  floorMs?: () => number;
  isBackground?: () => boolean;
  /** False when no other member could be looking (see membersStore.hasWatchers). */
  hasWatchers?: () => boolean;
}

export interface ThrottleVerdict {
  send: boolean;
  moving: boolean;
}

export function createSendThrottle(
  options: ThrottleOptions = {},
): (fix: Fix) => ThrottleVerdict {
  let lastSent: Fix | null = null;

  return (fix) => {
    let speed = fix.speed ?? Number.NaN;
    if (!Number.isFinite(speed) && lastSent) {
      const dtS = (fix.atMs - lastSent.atMs) / 1000;
      if (dtS > 0) {
        speed = haversineMeters(lastSent.lat, lastSent.lng, fix.lat, fix.lng) / dtS;
      }
    }
    const moving = Number.isFinite(speed) && speed >= WALKING_SPEED_MS;

    let interval =
      Number.isFinite(speed) && speed >= DRIVING_SPEED_MS
        ? DRIVING_INTERVAL_MS
        : moving
          ? WALKING_INTERVAL_MS
          : STATIONARY_INTERVAL_MS;
    if (options.isBackground?.()) interval *= 2;
    if (options.hasWatchers && !options.hasWatchers()) {
      interval = Math.max(interval, HEARTBEAT_MS);
    }
    interval = Math.max(interval, options.floorMs?.() ?? 0);

    if (!lastSent) {
      lastSent = fix;
      return { send: true, moving };
    }

    const sinceLastSend = fix.atMs - lastSent.atMs;
    if (sinceLastSend < interval) return { send: false, moving };

    const distM = haversineMeters(lastSent.lat, lastSent.lng, fix.lat, fix.lng);
    const headingDelta =
      fix.heading != null && lastSent.heading != null
        ? Math.abs(((fix.heading - lastSent.heading + 540) % 360) - 180)
        : 0;

    const send =
      distM > Math.max(MIN_MOVE_M, (fix.accuracy ?? 0) / 2) ||
      headingDelta > MIN_HEADING_DELTA_DEG ||
      sinceLastSend > HEARTBEAT_MS;

    if (send) lastSent = fix;
    return { send, moving };
  };
}
