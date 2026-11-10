import { bearingDeg, type DistanceUnit } from "@/lib/geo";
import type { RouteResult, RouteStep } from "@/types/contracts";

// In-app guidance math (pure, unit-tested): where you are along the route,
// the next maneuver, what's left, and which way the road runs, so the map
// can turn heading-up. Equirectangular projection around the query point —
// the same city-scale tradeoff as distToPolylineM.

const EARTH_R = 6_371_000;
const RAD = Math.PI / 180;
/** A maneuver this close behind you is done; skip to the next one. */
const PASSED_M = 8;
/** How far ahead the road direction is sampled for the camera bearing. */
const LOOKAHEAD_M = 40;

export interface Guidance {
  /** Next maneuver ahead (null when the provider gave no steps). */
  step: RouteStep | null;
  /** Meters along the road to that maneuver. */
  toStepM: number | null;
  remainingM: number;
  remainingS: number;
  /** Distance from you to the route line. */
  offRouteM: number;
  /** Road direction at your position, degrees from north. */
  bearing: number;
}

interface Measured {
  cum: number[];
  stepAlong: number[];
}
const measuredCache = new WeakMap<RouteResult, Measured>();

/** Project p onto the polyline: nearest point's distance along, and offset. */
function project(coords: [number, number][], lng: number, lat: number): { along: number; off: number } {
  const kx = RAD * EARTH_R * Math.cos(lat * RAD);
  const ky = RAD * EARTH_R;
  let along = 0;
  let best = Infinity;
  let run = 0;
  for (let i = 0; i + 1 < coords.length; i++) {
    const ax = (coords[i][0] - lng) * kx;
    const ay = (coords[i][1] - lat) * ky;
    const bx = (coords[i + 1][0] - lng) * kx;
    const by = (coords[i + 1][1] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const ex = ax + t * dx;
    const ey = ay + t * dy;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < best) {
      best = d;
      along = run + t * len;
    }
    run += len;
  }
  return { along, off: best };
}

function measure(route: RouteResult): Measured {
  const hit = measuredCache.get(route);
  if (hit) return hit;
  const c = route.coords;
  const cum = [0];
  for (let i = 1; i < c.length; i++) {
    const kx = RAD * EARTH_R * Math.cos(c[i][1] * RAD);
    const dx = (c[i][0] - c[i - 1][0]) * kx;
    const dy = (c[i][1] - c[i - 1][1]) * RAD * EARTH_R;
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const stepAlong = (route.steps ?? []).map((s) => project(c, s.location[0], s.location[1]).along);
  const m = { cum, stepAlong };
  measuredCache.set(route, m);
  return m;
}

/** The point `along` meters down the line. */
function pointAt(coords: [number, number][], cum: number[], along: number): [number, number] {
  if (along <= 0) return coords[0];
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] >= along) {
      const seg = cum[i] - cum[i - 1];
      const t = seg > 0 ? (along - cum[i - 1]) / seg : 0;
      return [
        coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
        coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
      ];
    }
  }
  return coords[coords.length - 1];
}

export function guidance(route: RouteResult, pos: { lat: number; lng: number }): Guidance {
  const c = route.coords;
  const { cum, stepAlong } = measure(route);
  const total = cum[cum.length - 1] ?? 0;
  const { along, off } = project(c, pos.lng, pos.lat);
  const remainingM = Math.max(0, total - along) + off;
  const remainingS = total > 0 ? route.durationS * (Math.max(0, total - along) / total) : route.durationS;

  let step: RouteStep | null = null;
  let toStepM: number | null = null;
  const steps = route.steps ?? [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].type === "depart") continue;
    if (stepAlong[i] > along + PASSED_M || steps[i].type === "arrive") {
      step = steps[i];
      toStepM = Math.max(0, stepAlong[i] - along);
      break;
    }
  }

  const here = pointAt(c, cum, along);
  const ahead = pointAt(c, cum, Math.min(total, along + LOOKAHEAD_M));
  const bearing =
    here[0] === ahead[0] && here[1] === ahead[1]
      ? bearingDeg(pos.lat, pos.lng, c[c.length - 1][1], c[c.length - 1][0])
      : bearingDeg(here[1], here[0], ahead[1], ahead[0]);

  return { step, toStepM, remainingM, remainingS, offRouteM: off, bearing };
}

const ROAD = (name: string, verb: string) => (name ? `${verb} onto ${name}` : verb);

/** "Turn left onto Main St", Google-style wording from OSRM vocabulary. */
export function stepText(step: RouteStep): string {
  const mod = step.modifier ?? "";
  const side = mod.includes("left") ? "left" : mod.includes("right") ? "right" : "";
  switch (step.type) {
    case "arrive":
      return "Arrive";
    case "depart":
      return ROAD(step.name, "Head out");
    case "roundabout":
    case "rotary":
    case "roundabout turn":
      return step.name ? `At the roundabout, take ${step.name}` : "Enter the roundabout";
    case "exit roundabout":
    case "exit rotary":
      return ROAD(step.name, "Exit the roundabout");
    case "merge":
      return ROAD(step.name, side ? `Merge ${side}` : "Merge");
    case "on ramp":
      return ROAD(step.name, side ? `Take the ramp on the ${side}` : "Take the ramp");
    case "off ramp":
      return ROAD(step.name, side ? `Take the exit on the ${side}` : "Take the exit");
    case "fork":
      return ROAD(step.name, side ? `Keep ${side}` : "Keep straight");
    case "continue":
    case "new name":
      if (mod === "uturn") return "Make a U-turn";
      return side ? ROAD(step.name, `Keep ${side}`) : ROAD(step.name, "Continue");
    default:
      if (mod === "uturn") return "Make a U-turn";
      if (mod === "straight" || !side) return ROAD(step.name, "Continue");
      return ROAD(step.name, `Turn ${mod}`);
  }
}

/** Guidance distances: 10 m steps up close, 50 ft / 0.1 mi in miles. */
export function guidanceDistance(meters: number, unit: DistanceUnit): string {
  if (unit === "mi") {
    const feet = meters * 3.28084;
    if (feet < 1000) return `${Math.max(50, Math.round(feet / 50) * 50)} ft`;
    const mi = meters / 1609.344;
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** The part of the line still ahead of you: your snapped point onward. */
export function remainingLine(coords: [number, number][], pos: { lat: number; lng: number }): [number, number][] {
  if (coords.length < 2) return coords;
  const kx = RAD * EARTH_R * Math.cos(pos.lat * RAD);
  const ky = RAD * EARTH_R;
  let best = Infinity;
  let seg = 0;
  let snap: [number, number] = coords[0];
  for (let i = 0; i + 1 < coords.length; i++) {
    const ax = (coords[i][0] - pos.lng) * kx;
    const ay = (coords[i][1] - pos.lat) * ky;
    const dx = (coords[i + 1][0] - coords[i][0]) * kx;
    const dy = (coords[i + 1][1] - coords[i][1]) * ky;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const ex = ax + t * dx;
    const ey = ay + t * dy;
    const d = ex * ex + ey * ey;
    if (d < best) {
      best = d;
      seg = i;
      snap = [
        coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
      ];
    }
  }
  return [snap, ...coords.slice(seg + 1)];
}
