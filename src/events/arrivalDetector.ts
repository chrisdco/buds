// Arrival is SELF-reported: only the arriving client fires (plan §6), via the
// idempotent mark_arrived RPC. Requires being within the arrival radius for a
// sustained window so driving past the destination doesn't count. Re-arms only
// after moving well clear of the radius (2x), so GPS wobble at the destination
// can't re-trigger.

export interface ArrivalDetector {
  /** Feed with the current distance to the effective destination. */
  update(distM: number, nowMs: number): void;
  reset(): void;
}

const DEFAULT_SUSTAIN_MS = 10_000;
// Fallback when the room setting is missing/invalid — matches
// DEFAULT_ARRIVAL_RADIUS_M in src/modes/types.ts (kept literal to avoid a
// modes import in this otherwise dependency-free module).
const FALLBACK_RADIUS_M = 75;

export function createArrivalDetector(options: {
  radiusM: () => number;
  onArrive: () => void;
  sustainMs?: number;
}): ArrivalDetector {
  const sustainMs = options.sustainMs ?? DEFAULT_SUSTAIN_MS;
  let withinSince: number | null = null;
  let armed = true;

  return {
    update(distM, nowMs) {
      const rawRadius = options.radiusM();
      const radius =
        Number.isFinite(rawRadius) && rawRadius > 0 ? rawRadius : FALLBACK_RADIUS_M;
      if (!Number.isFinite(distM)) {
        withinSince = null;
        return;
      }
      if (!armed) {
        if (distM > radius * 2) armed = true;
        return;
      }
      if (distM <= radius) {
        withinSince ??= nowMs;
        if (nowMs - withinSince >= sustainMs) {
          armed = false;
          withinSince = null;
          // A synchronous throw must not wedge the detector disarmed: re-arm
          // so presence inside the radius retries. Async (server-confirm)
          // failures are handled by the caller via reset().
          try {
            options.onArrive();
          } catch {
            armed = true;
          }
        }
      } else {
        withinSince = null;
      }
    },
    reset() {
      withinSince = null;
      armed = true;
    },
  };
}
