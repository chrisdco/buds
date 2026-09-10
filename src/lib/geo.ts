const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export type DistanceUnit = "km" | "mi";

const METERS_PER_MILE = 1609.344;

export function formatDistanceM(meters: number, unit: DistanceUnit = "km"): string {
  if (unit === "mi") {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * Perpendicular-ish distance from a position to a GeoJSON-order [lng,lat]
 * polyline, meters. Equirectangular projection around the query point —
 * sub-percent error at city scale (same documented tradeoff as the formation
 * centroid), dependency-free, and ~100x cheaper than a turf scan, so it can
 * run per-tick and per-route-pair on the UI thread. Skips malformed
 * segments instead of throwing (provider payloads are validated upstream,
 * but the map must never crash on one bad point).
 */
export function distToPolylineM(lat: number, lng: number, coords: [number, number][]): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  if (!Array.isArray(coords) || coords.length < 2) return Infinity;
  // Meters per degree at the query latitude; query point sits at origin.
  const kx = ((Math.PI / 180) * EARTH_RADIUS_M * Math.cos(toRad(lat))) || 0;
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  let best = Infinity;
  for (let i = 0; i + 1 < coords.length; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (
      !Array.isArray(a) ||
      !Array.isArray(b) ||
      !Number.isFinite(a[0]) ||
      !Number.isFinite(a[1]) ||
      !Number.isFinite(b[0]) ||
      !Number.isFinite(b[1])
    ) {
      continue;
    }
    const ax = (a[0] - lng) * kx;
    const ay = (a[1] - lat) * ky;
    const dx = (b[0] - a[0]) * kx;
    const dy = (b[1] - a[1]) * ky;
    const len2 = dx * dx + dy * dy;
    // Project the origin onto segment ab; degenerate segments use endpoint a.
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -((ax * dx + ay * dy) / len2)));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist < best) best = dist;
  }
  return best;
}
