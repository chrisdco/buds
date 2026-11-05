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
  /** Readable kind ("Cafe", "Bus stop"), when OSM says something useful. */
  kind?: string | null;
}

// OSM values that only say "a place exists here"; showing them as a kind
// adds noise, not meaning.
const VAGUE_KINDS = new Set(["yes", "unclassified", "residential", "house", "building", "primary", "secondary", "tertiary"]);

function kindLabel(v: string | undefined): string | null {
  if (!v || VAGUE_KINDS.has(v)) return null;
  const t = v.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface PhotonProperties {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  /** OSM tag value: "cafe", "station", "residential"... */
  osm_value?: string;
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
    // Neighbourhood + city reads like a real address in Indian cities
    // ("Indiranagar, Bengaluru"), where street names are often missing.
    const area = props.district ?? props.locality;
    const city = props.city ?? props.county ?? props.state;
    const distanceM = origin ? Math.round(haversineMeters(origin.lat, origin.lng, lat, lng)) : null;
    // Country only when it tells you something: far away, or no idea where you are.
    const country = distanceM == null || distanceM > 200_000 ? props.country : null;
    const address = [street === name ? null : street, area === name ? null : area, city === area ? null : city, country]
      .filter(Boolean)
      .join(", ");
    return [
      {
        id: `${props.osm_type ?? "n"}${props.osm_id ?? i}`,
        name,
        address,
        lat,
        lng,
        distanceM,
        kind: kindLabel(props.osm_value),
      },
    ];
  });
}

/**
 * Clean up Photon's list: drop near-duplicates (same name within 150 m,
 * typical for a mall and its building outline), and when we know where you
 * are, gently prefer close results over far namesakes. Photon's own order
 * stays the tiebreak, so a far exact match still beats a near fuzzy one.
 */
export function rankPlaces(results: PlaceResult[]): PlaceResult[] {
  const kept: PlaceResult[] = [];
  for (const r of results) {
    const dup = kept.some(
      (k) => k.name.toLowerCase() === r.name.toLowerCase() && haversineMeters(k.lat, k.lng, r.lat, r.lng) < 150,
    );
    if (!dup) kept.push(r);
  }
  const score = (r: PlaceResult, i: number) => {
    if (r.distanceM == null) return i;
    // ~1 rank per order of magnitude of distance past 2 km.
    return i + Math.max(0, Math.log10(r.distanceM / 2000));
  };
  return kept
    .map((r, i) => ({ r, s: score(r, i) }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.r);
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
  // Over-fetch so dedupe + rerank still leave `limit` good rows.
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit * 2), lang: "en" });
  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lon", String(origin.lng));
    // City-level bias, weighted harder toward the point than the default.
    params.set("zoom", "12");
    params.set("location_bias_scale", "0.5");
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
    return rankPlaces(parsePhoton((await res.json()) as { features?: PhotonFeature[] }, origin)).slice(0, limit);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
