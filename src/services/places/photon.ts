import { haversineMeters } from "@/lib/geo";

// Keyless OSM place search (Komoot Photon). No API key, fair-use friendly at
// our scale; the ORS-keyed geocoder stays the #9 upgrade path, not the default.

export const PHOTON_BASE = "https://photon.komoot.io/";
/** Search endpoint. */
export const PHOTON_URL = `${PHOTON_BASE}api/`;

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

/** Generic "what" searches ("airport", "petrol near me"): the OSM tags to
 * look up around you and how far to look (km). Photon matches names, so
 * "airport" alone finds Airport Road; a nearby-by-tag lookup finds airports. */
const CATEGORIES: { words: string[]; tags: string[]; radiusKm: number }[] = [
  { words: ["airport", "airports"], tags: ["aeroway:aerodrome"], radiusKm: 60 },
  { words: ["hospital", "hospitals", "clinic", "emergency"], tags: ["amenity:hospital", "amenity:clinic"], radiusKm: 8 },
  {
    words: ["metro", "metro station", "station", "train station", "railway station", "train"],
    tags: ["railway:station"],
    radiusKm: 10,
  },
  {
    words: ["petrol", "petrol pump", "petrol bunk", "petrol station", "gas", "gas station", "fuel"],
    tags: ["amenity:fuel"],
    radiusKm: 8,
  },
  { words: ["ev charging", "charging station", "charger"], tags: ["amenity:charging_station"], radiusKm: 10 },
  { words: ["mall", "malls", "shopping mall"], tags: ["shop:mall"], radiusKm: 15 },
  { words: ["cafe", "cafes", "coffee", "coffee shop"], tags: ["amenity:cafe"], radiusKm: 3 },
  { words: ["restaurant", "restaurants", "food"], tags: ["amenity:restaurant"], radiusKm: 3 },
  { words: ["bar", "bars", "pub", "pubs"], tags: ["amenity:bar", "amenity:pub"], radiusKm: 4 },
  { words: ["atm", "atms"], tags: ["amenity:atm"], radiusKm: 3 },
  { words: ["bank", "banks"], tags: ["amenity:bank"], radiusKm: 4 },
  { words: ["pharmacy", "chemist", "medical store"], tags: ["amenity:pharmacy"], radiusKm: 4 },
  { words: ["parking", "car park"], tags: ["amenity:parking"], radiusKm: 3 },
  { words: ["bus stop", "bus stand", "bus station"], tags: ["highway:bus_stop", "amenity:bus_station"], radiusKm: 2 },
  { words: ["hotel", "hotels"], tags: ["tourism:hotel"], radiusKm: 6 },
  { words: ["park", "parks"], tags: ["leisure:park"], radiusKm: 5 },
  { words: ["police", "police station"], tags: ["amenity:police"], radiusKm: 8 },
  { words: ["toilet", "toilets", "restroom", "washroom"], tags: ["amenity:toilets"], radiusKm: 3 },
  { words: ["supermarket", "grocery"], tags: ["shop:supermarket"], radiusKm: 4 },
];

/** The category a whole query asks for, ignoring "near me" / "nearby" / "nearest". */
export function categoryFor(query: string): { tags: string[]; radiusKm: number } | null {
  const q = query
    .toLowerCase()
    .replace(/\b(near ?me|nearby|nearest|closest|around here)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return null;
  const hit = CATEGORIES.find((c) => c.words.includes(q));
  return hit ? { tags: hit.tags, radiusKm: hit.radiusKm } : null;
}

/**
 * Category hits first, nearest first (that's what "petrol" means on a map),
 * then the ranked text results not already listed.
 */
export function mergeNearby(nearby: PlaceResult[], text: PlaceResult[], limit: number): PlaceResult[] {
  const near = [...nearby].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const seen = (r: PlaceResult) =>
    near.some(
      (n) =>
        n.id === r.id ||
        (n.name.toLowerCase() === r.name.toLowerCase() && haversineMeters(n.lat, n.lng, r.lat, r.lng) < 150),
    );
  return [...near, ...text.filter((r) => !seen(r))].slice(0, limit);
}

/** Photon request budget, shared with tests. Matches the routing chain's 8s. */
export const SEARCH_TIMEOUT_MS = 8_000;

/**
 * One Photon call with our timeout, chained to the caller's signal. Throws
 * on HTTP error; aborts surface as AbortError — callers swallow those via
 * isAbortError, every other error is a real failure.
 */
async function photonGet(
  path: "api" | "reverse",
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<{ features?: PhotonFeature[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  // Note: a listener added to an already-aborted signal never fires, so the
  // explicit aborted check below is required — it is not redundant.
  signal?.addEventListener("abort", onCallerAbort);
  if (signal?.aborted) controller.abort();
  try {
    // A pre-aborted caller signal must not still dispatch the request.
    // signal.reason is the platform's own AbortError.
    if (controller.signal.aborted) throw controller.signal.reason;
    const res = await fetch(`${PHOTON_BASE}${path}/?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`photon:${res.status}`);
    return (await res.json()) as { features?: PhotonFeature[] };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

/**
 * Place search: Photon text search biased hard toward you (street-level
 * radius, prominence mostly ignored, like a ride app), plus a nearby-by-tag
 * lookup when the query names a kind of place.
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
    // Measured on Bengaluru queries: zoom 14 + scale 0.2 puts the nearest
    // Starbucks / Forum mall first, where Photon's defaults (12, 0.4) and
    // our old 0.5 (which weakened the bias) listed far namesakes first.
    params.set("zoom", "14");
    params.set("location_bias_scale", "0.2");
  }
  const category = origin ? categoryFor(query) : null;
  let nearbyReq: Promise<PlaceResult[]> = Promise.resolve([]);
  if (category && origin) {
    const p = new URLSearchParams({
      lat: String(origin.lat),
      lon: String(origin.lng),
      radius: String(category.radiusKm),
      limit: String(limit),
      lang: "en",
    });
    for (const t of category.tags) p.append("osm_tag", t);
    // Best-effort: the text search still answers if this one fails.
    nearbyReq = photonGet("reverse", p, signal)
      .then((j) => parsePhoton(j, origin))
      .catch((e: unknown) => {
        if (isAbortError(e)) throw e;
        return [];
      });
  }
  const [text, nearby] = await Promise.all([
    photonGet("api", params, signal).then((j) => rankPlaces(parsePhoton(j, origin))),
    nearbyReq,
  ]);
  return nearby.length > 0 ? mergeNearby(nearby, text, limit) : text.slice(0, limit);
}

/**
 * What's at a point, for naming a dropped or dragged pin: the nearest named
 * thing within ~60 m (a shop, a building), else the street or area within
 * 1 km. Null when Photon has nothing.
 */
export async function reversePlace(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ name: string; address: string } | null> {
  const p = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: "1", radius: "0.06", lang: "en" });
  let [hit] = parsePhoton(await photonGet("reverse", p, signal));
  if (!hit) {
    p.set("radius", "1");
    [hit] = parsePhoton(await photonGet("reverse", p, signal));
  }
  return hit && hit.name !== "Dropped pin" ? { name: hit.name, address: hit.address } : null;
}
