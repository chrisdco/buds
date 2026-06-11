import turfDistance from "@turf/distance";
import { lineString, point } from "@turf/helpers";
import turfNearestPointOnLine from "@turf/nearest-point-on-line";

import type { RouteResult } from "@/types/contracts";

/** Perpendicular-ish distance from a position to the route polyline, meters. */
export function distanceFromRouteM(
  route: RouteResult,
  lat: number,
  lng: number,
): number {
  if (route.coords.length < 2) return Infinity;
  const p = point([lng, lat]);
  const nearest = turfNearestPointOnLine(lineString(route.coords), p);
  return turfDistance(p, nearest, { units: "meters" });
}
