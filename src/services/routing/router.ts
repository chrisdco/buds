import { haversineMeters } from "@/lib/geo";
import { fetchOrsRoute, orsApiKey } from "@/services/routing/ors";
import { fetchOsrmRoute } from "@/services/routing/osrm";
import type { LatLng, RouteFetcher } from "@/services/routing/types";
import type { RouteResult } from "@/types/contracts";

const FETCH_TIMEOUT_MS = 8_000;
const ASSUMED_SPEED_MS = 11; // ~40 km/h for the straight-line ETA estimate

export function straightLineRoute(from: LatLng, to: LatLng): RouteResult {
  const distanceM = haversineMeters(from.lat, from.lng, to.lat, to.lng);
  return {
    coords: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    distanceM,
    durationS: distanceM / ASSUMED_SPEED_MS,
    source: "straightline",
    fetchedAt: Date.now(),
  };
}

async function withTimeout(
  fetcher: RouteFetcher,
  from: LatLng,
  to: LatLng,
): Promise<Omit<RouteResult, "source" | "fetchedAt">> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetcher(from, to, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The routing chain: ORS (if a key is configured) -> OSRM demo ->
 * straight-line estimate. Never rejects — the worst case is a dashed
 * straight line labeled as an estimate.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  deps: { ors?: RouteFetcher; osrm?: RouteFetcher; hasOrsKey?: boolean } = {},
): Promise<RouteResult> {
  const hasKey = deps.hasOrsKey ?? orsApiKey() != null;
  const chain: { fetcher: RouteFetcher; source: "ors" | "osrm" }[] = [];
  if (hasKey) chain.push({ fetcher: deps.ors ?? fetchOrsRoute, source: "ors" });
  chain.push({ fetcher: deps.osrm ?? fetchOsrmRoute, source: "osrm" });

  for (const { fetcher, source } of chain) {
    try {
      const result = await withTimeout(fetcher, from, to);
      return { ...result, source, fetchedAt: Date.now() };
    } catch {
      // fall through to the next provider
    }
  }
  return straightLineRoute(from, to);
}
