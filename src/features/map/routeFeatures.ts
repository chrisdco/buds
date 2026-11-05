import { tierRank, type Tier } from "@/modes/lenses";
import type { RouteResult } from "@/types/contracts";

// Routes + tiers -> one FeatureCollection for the single-source renderer
// (docs/route-view.md 9.1). Pure: RouteLines only hands the result to
// MapLibre, and every visual decision is a feature property read by
// data-driven layer expressions.

export interface RouteFeatureProps {
  userId: string;
  color: string;
  tier: Tier;
  /** Straight-line estimate (routing failed): drawn dashed, no casing. */
  dashed: boolean;
  /** Off route / outside the group: amber casing. */
  late: boolean;
  /** Pixel offset so routes sharing a road sit side by side. */
  offset: number;
  /** Draw order: stronger tiers on top, you on top of your tier. */
  sortKey: number;
}

export type RouteFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, RouteFeatureProps>;

const OFFSET_STEP_PX = 1.5;

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

  const features: RouteFeatureCollection["features"] = [];
  visible.forEach((uid, lane) => {
    const route = args.routes[uid];
    const tier = args.tiers[uid] ?? "hidden";
    const from = Math.min(args.trimFrom?.[uid] ?? 0, route.coords.length - 2);
    const coords = from > 0 ? route.coords.slice(from) : route.coords;
    const self = uid === args.myUserId;
    features.push({
      type: "Feature",
      id: uid,
      properties: {
        userId: uid,
        color: args.colorFor(uid),
        tier,
        dashed: route.source === "straightline",
        late: args.late?.has(uid) ?? false,
        offset: visible.length > 1 ? (lane - mid) * OFFSET_STEP_PX : 0,
        sortKey: tierRank(tier) * 2 + (self ? 1 : 0),
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  });
  return { type: "FeatureCollection", features };
}
