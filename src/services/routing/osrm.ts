import type { LatLng, RouteFetcher } from "@/services/routing/types";
import type { RouteStep } from "@/types/contracts";

// OSRM public demo server: no key, ~1 req/s courtesy limit, no SLA.
// Self-host seam: set EXPO_PUBLIC_OSRM_URL to your own instance
// (same /route/v1/driving API) when usage outgrows the demo — see #9.
const OSRM_DEMO_BASE = "https://router.project-osrm.org/route/v1/driving";

export function osrmBase(): string {
  const custom = process.env.EXPO_PUBLIC_OSRM_URL?.trim().replace(/\/+$/, "");
  return custom && custom.length > 0 ? custom : OSRM_DEMO_BASE;
}

/** Pure URL builder (unit-tested); the fetcher below only adds transport. */
export function buildOsrmUrl(from: LatLng, to: LatLng, base: string = osrmBase()): string {
  return (
    `${base}/${from.lng},${from.lat};${to.lng},${to.lat}` + `?overview=full&geometries=geojson&steps=true`
  );
}

export const fetchOsrmRoute: RouteFetcher = async (from, to, signal) => {
  const response = await fetch(buildOsrmUrl(from, to), { signal });
  if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

  const json = (await response.json()) as {
    code?: string;
    routes?: {
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
      legs?: OsrmLeg[];
    }[];
  };
  if (json.code !== "Ok" || !json.routes?.[0]) {
    throw new Error(`OSRM returned ${json.code ?? "no route"}`);
  }

  const route = json.routes[0];
  return {
    coords: route.geometry.coordinates,
    distanceM: route.distance,
    durationS: route.duration,
    steps: osrmSteps(route.legs),
  };
};

interface OsrmLeg {
  steps?: {
    name?: string;
    maneuver?: { type?: string; modifier?: string; location?: [number, number] };
  }[];
}

/** OSRM legs -> our maneuver list; drops malformed entries. */
export function osrmSteps(legs: OsrmLeg[] | undefined): RouteStep[] | undefined {
  const out: RouteStep[] = [];
  for (const leg of legs ?? []) {
    for (const s of leg.steps ?? []) {
      const m = s.maneuver;
      const loc = m?.location;
      if (!m?.type || !Array.isArray(loc) || !Number.isFinite(loc[0]) || !Number.isFinite(loc[1])) continue;
      out.push({ type: m.type, modifier: m.modifier, name: s.name ?? "", location: [loc[0], loc[1]] });
    }
  }
  return out.length > 0 ? out : undefined;
}
