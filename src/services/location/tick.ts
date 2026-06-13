import { round5 } from "@/lib/geo";
import type { Fix } from "@/services/location/jitterFilter";
import type { LocTick } from "@/types/contracts";

// Pure GPS-reading <-> broadcast-tick conversion. Kept free of any
// side-effecting imports (supabase, stores) so it stays trivially testable and
// usable from the headless background task.

/** Minimal shape both expo-location's LocationObject and tests satisfy. */
export interface RawLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

/** Maps a raw GPS reading to our Fix, dropping the GPS "unknown" sentinels. */
export function toFix(location: RawLocation): Fix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    heading:
      location.coords.heading != null && location.coords.heading >= 0
        ? location.coords.heading
        : undefined,
    speed:
      location.coords.speed != null && location.coords.speed >= 0
        ? location.coords.speed
        : undefined,
    atMs: location.timestamp,
  };
}

/** Builds the compact broadcast tick from an accepted fix. */
export function buildTick(
  userId: string,
  fix: Fix,
  moving: boolean,
  nowMs: number,
): LocTick {
  return {
    u: userId,
    t: nowMs,
    la: round5(fix.lat),
    ln: round5(fix.lng),
    h: fix.heading != null ? Math.round(fix.heading) : undefined,
    s: fix.speed != null ? Math.round(fix.speed * 10) / 10 : undefined,
    a: fix.accuracy != null ? Math.round(fix.accuracy) : undefined,
    st: moving ? "mv" : "st",
  };
}
