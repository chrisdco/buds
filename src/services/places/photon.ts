import { haversineMeters } from "@/lib/geo";

// Keyless OSM place search (Komoot Photon). No API key, fair-use friendly at
// our scale; the ORS-keyed geocoder stays the #9 upgrade path, not the default.

export const PHOTON_URL = "https://photon.komoot.io/api/";

export interface PlaceResult {
  /** Stable per-query id (osm_type/osm_id counter). */
  id: string;
  /** Display name: POI/place name or street + number fallback. */
  name: string;
  /** Dim second line: street, city, country as available. */
  address: string;
  lat: number;
  lng: number;
  /** Meters from the bias point, when one was given. */
  distanceM: number | null;
}

interface PhotonProperties {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  city?: string;
  country?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

/** Pure parser: raw Photon GeoJSON -> app results. Network-free, unit-tested. */
export function parsePhoton(
  payload: { features?: PhotonFeature[] },
  origin?: { lat: number; lng: number },
): PlaceResult[] {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.flatMap((f, i) => {
    const coords = f?.geometry?.coordinates;
    const props = f?.properties ?? {};
    if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") {
      return [];
    }
    const [lng, lat] = coords;
    const street = [props.street, props.housenumber].filter(Boolean).join(" ");
    const name = props.name || street || props.locality || props.city || "Dropped pin";
    const address = [street === name ? null : street, props.city ?? props.locality, props.country]
      .filter(Boolean)
      .join(", ");
    return [
      {
        id: `${props.osm_type ?? "n"}${props.osm_id ?? i}`,
        name,
        address,
        lat,
        lng,
        distanceM: origin ? Math.round(haversineMeters(origin.lat, origin.lng, lat, lng)) : null,
      },
    ];
  });
}

/** True for fetch rejections caused by an AbortController (timeout or caller cancel). */
export function isAbortError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

/** Photon request budget, shared with tests. Matches the routing chain's 8s. */
export const SEARCH_TIMEOUT_MS = 8_000;

/**
 * Thin fetch wrapper: bias + limit, parser does the rest. Throws on HTTP
 * error. Aborts after SEARCH_TIMEOUT_MS or when `signal` fires (the routing
 * chain's fetchers take a signal the same way) — callers must swallow
 * aborts via isAbortError, every other error is a real failure.
 */
export async function searchPlaces(
  query: string,
  origin?: { lat: number; lng: number },
  limit = 6,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lon", String(origin.lng));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  // Note: a listener added to an already-aborted signal never fires, so the
  // explicit aborted check below is required — it is not redundant.
  signal?.addEventListener("abort", onCallerAbort);
  if (signal?.aborted) controller.abort();
  try {
    // A pre-aborted caller signal must not still dispatch the request:
    // without this the fetch below runs to completion on an answer nobody
    // wants. signal.reason is the platform's own AbortError — no
    // hand-rolled error shapes.
    if (controller.signal.aborted) throw controller.signal.reason;
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`photon:${res.status}`);
    return parsePhoton((await res.json()) as { features?: PhotonFeature[] }, origin);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
