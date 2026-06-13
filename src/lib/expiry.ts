// Pure room-expiry helpers. The pg_cron sweep ends expired rooms server-side
// and broadcasts it; this just drives the client-side countdown/warning UI.

export const EXPIRY_WARN_MS = 10 * 60_000; // start warning at T-10min

export interface ExpiryInfo {
  remainingMs: number;
  expired: boolean;
  warning: boolean;
  label: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** null => the room has no expiry. */
export function expiryInfo(expiresAt: string | null, nowMs: number): ExpiryInfo | null {
  if (!expiresAt) return null;
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) return null;

  const remainingMs = parsed - nowMs;
  if (remainingMs <= 0) {
    return { remainingMs: 0, expired: true, warning: true, label: "Room expired" };
  }

  const totalSec = Math.floor(remainingMs / 1000);
  let label: string;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    label = `Expires in ${m}:${pad(s)}`;
  } else {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    label = m > 0 ? `Expires in ${h} h ${m} min` : `Expires in ${h} h`;
  }

  return {
    remainingMs,
    expired: false,
    warning: remainingMs <= EXPIRY_WARN_MS,
    label,
  };
}

/**
 * New expiry timestamp when the host extends by `deltaMs`, measured from the
 * later of now or the current expiry (so extending a soon-to-expire room adds
 * time rather than resetting it backwards).
 */
export function extendedExpiryIso(
  currentExpiresAt: string | null,
  deltaMs: number,
  nowMs: number,
): string {
  const base = currentExpiresAt ? Math.max(nowMs, Date.parse(currentExpiresAt)) : nowMs;
  return new Date(base + deltaMs).toISOString();
}
