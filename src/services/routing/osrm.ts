import type { RouteFetcher } from "@/services/routing/types";

// OSRM public demo server: no key, ~1 req/s courtesy limit, no SLA.
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export const fetchOsrmRoute: RouteFetcher = async (from, to, signal) => {
  const url =
    `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;

  const response = await fetch(url, { signal });
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
