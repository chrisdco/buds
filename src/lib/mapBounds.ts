// Pure helpers for camera framing: which points the map should fit.
// Kept pure (and unit-tested) so framing policy never hides inside UI code.

export interface FitPoint {
  lng: number;
  lat: number;
}

interface FitScene {
  /** Member positions to frame. */
  members: FitPoint[];
  /** Shared destination, when set. */
  dest?: FitPoint | null;
  /** Rendered route polylines (GeoJSON lnglat order) — a long detour leg
  must pull the frame, not run off-screen while members+dest fit. */
  routeLines?: [number, number][][];
}

/** Flattened [lng, lat] pool for fitBounds-style framing. */
export function collectFitPoints({ members, dest, routeLines }: FitScene): [number, number][] {
  const points = members.map((p) => [p.lng, p.lat] as [number, number]);
  if (dest) points.push([dest.lng, dest.lat]);
  for (const line of routeLines ?? []) {
    for (const c of line) points.push([c[0], c[1]]);
  }
  return points;
}

/** [minLng, minLat, maxLng, maxLat], or null when there is nothing to frame. */
export function boundsOf(points: [number, number][]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}
