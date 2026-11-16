import { haversineMeters } from "@/lib/geo";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { isAbortError, rankPlaces, searchPlaces as searchPhoton, type PlaceResult } from "@/services/places/photon";

// Place search: Mapbox (through our `places` function, which keeps the
// token server-side) for Google-like POI coverage, Photon/OSM as the
// keyless fallback. Same signature and result shape as the Photon search,
// so screens don't care which one answered.

/** Mapbox gets this long before Photon takes over (typing must stay snappy). */
export const PROXY_TIMEOUT_MS = 3_500;
/** After "not configured" (no token on the server), skip the proxy this long. */
const UNCONFIGURED_BACKOFF_MS = 5 * 60_000;
let proxyOffUntil = 0;

/** Test seam. */
export function resetPlaceSearch(): void {
  proxyOffUntil = 0;
}

interface ProxyRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string | null;
}

/** Pure: proxy rows -> app results with distances. */
export function fromProxyRows(rows: ProxyRow[], origin?: { lat: number; lng: number }): PlaceResult[] {
  return rows
    .filter((r) => r && Number.isFinite(r.lat) && Number.isFinite(r.lng) && typeof r.name === "string")
    .map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address ?? "",
      lat: r.lat,
      lng: r.lng,
      kind: r.kind ?? null,
      distanceM: origin ? Math.round(haversineMeters(origin.lat, origin.lng, r.lat, r.lng)) : null,
    }));
}

async function viaProxy(
  query: string,
  origin: { lat: number; lng: number } | undefined,
  limit: number,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  if (signal?.aborted) controller.abort();
  try {
    const { data, error } = await supabase.functions.invoke<{ results: ProxyRow[] }>("places", {
      body: { q: query, lat: origin?.lat, lng: origin?.lng, limit },
      signal: controller.signal,
    });
    if (error) {
      // 503 = no token configured: don't keep paying a round trip for it.
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 503) proxyOffUntil = Date.now() + UNCONFIGURED_BACKOFF_MS;
      throw new Error(`places proxy: ${error.message}`);
    }
    if (!data || !Array.isArray(data.results)) throw new Error("places proxy: no data");
    return rankPlaces(fromProxyRows(data.results, origin)).slice(0, limit);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Search places near `origin`. Mapbox first; on any failure (or an empty
 * answer) Photon. Rejects only when the caller aborts or Photon fails too;
 * callers swallow aborts via isAbortError, as before.
 */
export async function searchPlaces(
  query: string,
  origin?: { lat: number; lng: number },
  limit = 6,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  if (supabaseConfigured && Date.now() >= proxyOffUntil) {
    try {
      const results = await viaProxy(query, origin, limit, signal);
      if (results.length > 0) return results;
    } catch (e) {
      if (signal?.aborted) throw e;
      // fall through to Photon
    }
  }
  return searchPhoton(query, origin, limit, signal);
}

export { isAbortError, type PlaceResult };
