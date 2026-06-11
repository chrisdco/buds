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
      const radius = options.radiusM();
      if (!armed) {
        if (distM > radius * 2) armed = true;
        return;
      }
      if (distM <= radius) {
        withinSince ??= nowMs;
        if (nowMs - withinSince >= sustainMs) {
          armed = false;
          withinSince = null;
          options.onArrive();
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
