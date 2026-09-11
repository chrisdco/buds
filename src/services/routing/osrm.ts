import type { LatLng, RouteFetcher } from "@/services/routing/types";

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
    `${base}/${from.lng},${from.lat};${to.lng},${to.lat}` + `?overview=full&geometries=geojson`
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
  };
};
