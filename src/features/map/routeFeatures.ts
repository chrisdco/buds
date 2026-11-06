import { haversineMeters } from "@/lib/geo";
import { tierRank, type Tier } from "@/modes/lenses";
import type { RouteResult } from "@/types/contracts";

// Routes + tiers -> FeatureCollections for the single-source renderer
// (docs/route-view.md 9.1). Pure: RouteLines only hands the result to
// MapLibre, and every visual decision is a feature property read by
// data-driven layer expressions.

export interface RouteFeatureProps {
  userId: string;
  color: string;
  tier: Tier;
  /** Straight-line estimate (routing failed): drawn dashed, no casing. */
  dashed: boolean;
  /** Late or off route: amber casing. */
  late: boolean;
  /** Pixel offset so routes sharing a road sit side by side. */
  offset: number;
  /** Draw order: stronger tiers on top, you on top of your tier. */
  sortKey: number;
  /** "final" = the last stretch to the destination, drawn dotted. */
  leg: "main" | "final";
  /** Color too close to an earlier route's: drawn dash-dot (4.4). */
  altDash: boolean;
  /** Chevron shift in icon units so arrows ride their offset lane. */
  chevronOffset: [number, number];
}

export type RouteFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, RouteFeatureProps>;

export interface RouteLabelProps {
  userId: string;
  color: string;
  label: string;
}

export type RouteLabelCollection = GeoJSON.FeatureCollection<GeoJSON.Point, RouteLabelProps>;

const OFFSET_STEP_PX = 1.5;
/** The last stretch drawn dotted (4.2). */
export const FINAL_LEG_M = 200;
/** RouteLines draws chevrons at this icon-size; offsets scale by it. */
export const CHEVRON_ICON_SIZE = 0.5;
/** RGB distance under which two route colors read as the same line. */
const COLOR_CLASH = 60;

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colorsClash(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return false;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < COLOR_CLASH;
}

function segM(a: [number, number], b: [number, number]): number {
  return haversineMeters(a[1], a[0], b[1], b[0]);
}

/**
 * Index of the route vertex nearest the member, so the part already
 * travelled can be trimmed. Squared-degree distance is enough to rank
 * vertices at route scale.
 */
export function nearestIndex(coords: [number, number][], lng: number, lat: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - lng;
    const dy = coords[i][1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Split a line into [main, final] where final is the last `finalM` meters,
 * cut at an interpolated point. A line shorter than that is all final
 * (main = null).
 */
export function splitFinalLeg(
  coords: [number, number][],
  finalM: number = FINAL_LEG_M,
): { main: [number, number][] | null; final: [number, number][] } {
  let acc = 0;
  for (let i = coords.length - 1; i > 0; i--) {
    const d = segM(coords[i - 1], coords[i]);
    if (acc + d >= finalM) {
      const t = d > 0 ? (finalM - acc) / d : 0; // fraction back from coords[i]
      const a = coords[i - 1];
      const b = coords[i];
      const cut: [number, number] = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t];
      return { main: [...coords.slice(0, i), cut], final: [cut, ...coords.slice(i)] };
    }
    acc += d;
  }
  return { main: null, final: coords };
}

/** Point halfway along a line by distance. */
export function midpointByDistance(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) return coords[0];
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = segM(coords[i - 1], coords[i]);
    lens.push(d);
    total += d;
  }
  let half = total / 2;
  for (let i = 0; i < lens.length; i++) {
    if (half <= lens[i]) {
      const t = lens[i] > 0 ? half / lens[i] : 0;
      const a = coords[i];
      const b = coords[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    half -= lens[i];
  }
  return coords[coords.length - 1];
}

function trimmed(route: RouteResult, from: number | undefined): [number, number][] {
  const i = Math.min(from ?? 0, route.coords.length - 2);
  return i > 0 ? route.coords.slice(i) : route.coords;
}

export function buildRouteFeatures(args: {
  routes: Record<string, RouteResult>;
  tiers: Record<string, Tier>;
  myUserId: string | null;
  colorFor: (userId: string) => string;
  /** Vertex to start drawing from, per user (progress trim). */
  trimFrom?: Record<string, number>;
  late?: ReadonlySet<string>;
}): RouteFeatureCollection {
  const visible = Object.keys(args.routes)
    .filter((uid) => {
      const tier = args.tiers[uid] ?? "hidden";
      return tier !== "hidden" && (args.routes[uid]?.coords.length ?? 0) >= 2;
    })
    .sort(); // stable offsets: the same person keeps the same lane
  const mid = (visible.length - 1) / 2;

  // Color safety: a solid line whose color matches an earlier solid line's
  // goes dash-dot, so two people on one road never read as one.
  const solidColors: string[] = [];

  const features: RouteFeatureCollection["features"] = [];
  visible.forEach((uid, lane) => {
    const route = args.routes[uid];
    const tier = args.tiers[uid] ?? "hidden";
    const coords = trimmed(route, args.trimFrom?.[uid]);
    const self = uid === args.myUserId;
    const color = args.colorFor(uid);
    const dashed = route.source === "straightline";
    const altDash = !dashed && solidColors.some((c) => colorsClash(c, color));
    if (!dashed && !altDash) solidColors.push(color);
    const offset = visible.length > 1 ? (lane - mid) * OFFSET_STEP_PX : 0;
    const base = {
      userId: uid,
      color,
      tier,
      dashed,
      late: args.late?.has(uid) ?? false,
      offset,
      sortKey: tierRank(tier) * 2 + (self ? 1 : 0),
      altDash,
      chevronOffset: [0, offset / CHEVRON_ICON_SIZE] as [number, number],
    };
    // Estimates are already dashed end to end; road routes end dotted.
    const parts = dashed ? { main: coords, final: null } : splitFinalLeg(coords);
    if (parts.main) {
      features.push({
        type: "Feature",
        id: uid,
        properties: { ...base, leg: "main" },
        geometry: { type: "LineString", coordinates: parts.main },
      });
    }
    if (parts.final) {
      features.push({
        type: "Feature",
        id: `${uid}:final`,
        properties: { ...base, leg: "final" },
        geometry: { type: "LineString", coordinates: parts.final },
      });
    }
  });
  return { type: "FeatureCollection", features };
}

/**
 * Time bubbles (4.3): one "18 min" label at the middle of each primary
 * route's remaining part. MapLibre's symbol collision drops ones that
 * would overlap.
 */
export function buildRouteLabels(args: {
  routes: Record<string, RouteResult>;
  tiers: Record<string, Tier>;
  etaByUser: Record<string, number | undefined>;
  colorFor: (userId: string) => string;
  trimFrom?: Record<string, number>;
}): RouteLabelCollection {
  const features: RouteLabelCollection["features"] = [];
  for (const uid of Object.keys(args.routes).sort()) {
    const route = args.routes[uid];
    const eta = args.etaByUser[uid];
    if (args.tiers[uid] !== "primary" || eta == null || route.coords.length < 2) continue;
    const at = midpointByDistance(trimmed(route, args.trimFrom?.[uid]));
    if (!at) continue;
    features.push({
      type: "Feature",
      id: uid,
      properties: { userId: uid, color: args.colorFor(uid), label: `${Math.max(1, Math.round(eta / 60))} min` },
      geometry: { type: "Point", coordinates: at },
    });
  }
  return { type: "FeatureCollection", features };
}
