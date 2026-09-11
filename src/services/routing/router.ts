import { haversineMeters, round5 } from "@/lib/geo";
import { fetchOrsRoute, orsApiKey } from "@/services/routing/ors";
import { fetchOsrmRoute } from "@/services/routing/osrm";
import type { LatLng, RouteFetcher } from "@/services/routing/types";
import type { RouteResult } from "@/types/contracts";

const FETCH_TIMEOUT_MS = 8_000;
const ASSUMED_SPEED_MS = 11; // ~40 km/h for the straight-line ETA estimate
// Identical origin/destination pairs share one fetch: convoy members usually
// route to the same point from ~the same place, and rooms re-resolve on
// every insight tick. 5-decimal rounding (~1m) keeps near-identical requests
// on one key without blurring real moves. Failures cache too (as dashed
// straight lines), capping retry storms at 1/min per O/D while a provider
// is down. Deviation refetches may wait out the TTL — bounded staleness for
// a quieter demo server.
const ROUTE_CACHE_TTL_MS = 60_000;
const routeCache = new Map<string, { route: RouteResult; atMs: number }>();

/** Test seam: the cache is module-global by design (shared across ticks). */
export function clearRouteCache(): void {
  routeCache.clear();
}

function cacheKey(from: LatLng, to: LatLng): string {
  return `${round5(from.lat)},${round5(from.lng)}>${round5(to.lat)},${round5(to.lng)}`;
}

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
  const key = cacheKey(from, to);
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.atMs < ROUTE_CACHE_TTL_MS) {
    return { ...hit.route, fetchedAt: Date.now() };
  }

  const hasKey = deps.hasOrsKey ?? orsApiKey() != null;
  const chain: { fetcher: RouteFetcher; source: "ors" | "osrm" }[] = [];
  if (hasKey) chain.push({ fetcher: deps.ors ?? fetchOrsRoute, source: "ors" });
  chain.push({ fetcher: deps.osrm ?? fetchOsrmRoute, source: "osrm" });

  for (const { fetcher, source } of chain) {
    try {
      const result = await withTimeout(fetcher, from, to);
      if (!isValidRoutePayload(result)) throw new Error("invalid route payload");
      const routed = { ...result, source, fetchedAt: Date.now() };
      routeCache.set(key, { route: routed, atMs: Date.now() });
      return routed;
    } catch {
      // fall through to the next provider
    }
  }
  const fallback = straightLineRoute(from, to);
  routeCache.set(key, { route: fallback, atMs: Date.now() });
  return fallback;
}

/** Guards the turf/ETA pipeline against malformed provider payloads. */
function isValidRoutePayload(
  result: Omit<RouteResult, "source" | "fetchedAt">,
): boolean {
  if (!result || !Array.isArray(result.coords) || result.coords.length < 2) {
    return false;
  }
  if (!Number.isFinite(result.distanceM) || !Number.isFinite(result.durationS)) {
    return false;
  }
  return result.coords.every(
    (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]),
  );
}
