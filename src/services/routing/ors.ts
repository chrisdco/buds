import type { RouteFetcher } from "@/services/routing/types";

// OpenRouteService: free key, ~2,000 directions/day, 40/min.
// Key is optional — without one the chain skips straight to OSRM.
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

export function orsApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_ORS_API_KEY || undefined;
}

export const fetchOrsRoute: RouteFetcher = async (from, to, signal) => {
  const key = orsApiKey();
  if (!key) throw new Error("no ORS key configured");

  const response = await fetch(ORS_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
  });
  if (!response.ok) throw new Error(`ORS HTTP ${response.status}`);

  const json = (await response.json()) as {
    features?: {
      geometry: { coordinates: [number, number][] };
      properties: { summary: { distance: number; duration: number } };
    }[];
  };
  const feature = json.features?.[0];
  if (!feature) throw new Error("ORS returned no route");

  return {
    coords: feature.geometry.coordinates,
    distanceM: feature.properties.summary.distance,
    durationS: feature.properties.summary.duration,
  };
};
