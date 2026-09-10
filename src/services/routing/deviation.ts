import { distToPolylineM } from "@/lib/geo";

import type { RouteResult } from "@/types/contracts";

/** Perpendicular-ish distance from a position to the route polyline, meters. */
export function distanceFromRouteM(
  route: RouteResult,
  lat: number,
  lng: number,
): number {
  if (!route || route.coords.length < 2) return Infinity;
  // Local equirectangular math (lib/geo): no turf on the per-tick path.
  return distToPolylineM(lat, lng, route.coords);
}
