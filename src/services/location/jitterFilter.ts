import { haversineMeters } from "@/lib/geo";

export interface Fix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  atMs: number;
}

const MAX_ACCURACY_M = 100;
const MAX_PLAUSIBLE_SPEED_MS = 70; // ~250 km/h: anything faster is GPS teleport

/**
 * Rejects implausible fixes: poor accuracy, out-of-order timestamps, and
 * teleports (implied speed beyond anything a road vehicle does).
 */
export function createJitterFilter(): (fix: Fix) => Fix | null {
  let lastAccepted: Fix | null = null;

  return (fix) => {
    if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return null;

    if (lastAccepted) {
      const dtS = (fix.atMs - lastAccepted.atMs) / 1000;
      if (dtS <= 0) return null;
      const distM = haversineMeters(lastAccepted.lat, lastAccepted.lng, fix.lat, fix.lng);
      if (distM / dtS > MAX_PLAUSIBLE_SPEED_MS) return null;
    }

    lastAccepted = fix;
    return fix;
  };
}
