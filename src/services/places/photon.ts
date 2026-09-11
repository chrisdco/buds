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

/** Thin fetch wrapper: bias + limit, parser does the rest. Throws on HTTP error. */
export async function searchPlaces(
  query: string,
  origin?: { lat: number; lng: number },
  limit = 6,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lon", String(origin.lng));
  }
  const res = await fetch(`${PHOTON_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`photon:${res.status}`);
  return parsePhoton((await res.json()) as { features?: PhotonFeature[] }, origin);
}
