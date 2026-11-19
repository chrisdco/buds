import { haversineMeters } from "@/lib/geo";
import type { PlaceRef } from "@/lib/places";

// Quick stops mid-trip: one tap searches near you. The query is what goes in
// the field (so it reads naturally and can be edited), and it's a term both
// Mapbox's POI categories and OSM/Photon understand.
export interface PlaceCategory {
  id: string;
  label: string;
  query: string;
}

export const PLACE_CATEGORIES: readonly PlaceCategory[] = [
  { id: "petrol", label: "Petrol", query: "Petrol station" },
  { id: "food", label: "Food", query: "Restaurant" },
  { id: "coffee", label: "Coffee", query: "Cafe" },
  { id: "atm", label: "ATM", query: "ATM" },
  { id: "parking", label: "Parking", query: "Parking" },
  { id: "pharmacy", label: "Pharmacy", query: "Pharmacy" },
];

/** The category a typed query exactly matches (chip tapped, or typed in full). */
export function categoryFor(query: string): PlaceCategory | null {
  const q = query.trim().toLowerCase();
  return PLACE_CATEGORIES.find((c) => c.query.toLowerCase() === q) ?? null;
}

/** Nearest first; places with no known distance keep their order, last. */
export function byDistance<T extends { distanceM: number | null }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const da = a.r.distanceM ?? Infinity;
      const db = b.r.distanceM ?? Infinity;
      return da === db ? a.i - b.i : da - db;
    })
    .map(({ r }) => r);
}

/** Recent places with how far they are from you now (null when unknown). */
export function recentsWithDistance(
  recents: readonly PlaceRef[],
  origin: { lat: number; lng: number } | null,
): (PlaceRef & { distanceM: number | null })[] {
  return recents.map((r) => ({
    ...r,
    distanceM: origin ? Math.round(haversineMeters(origin.lat, origin.lng, r.lat, r.lng)) : null,
  }));
}
