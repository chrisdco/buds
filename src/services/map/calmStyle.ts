import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { calmDarkStyle } from "@/services/map/calmDark";

// Fetch-then-cache loader for the calmed basemap style. Falls back to the
// raw style URL on any failure (no network, bad payload, full storage) —
// the map always renders, just louder.

export const CALM_SOURCE_URL = "https://tiles.openfreemap.org/styles/dark";
const CACHE_KEY = "buds:calm-map-style:v2";

export async function loadCalmStyle(): Promise<string | StyleSpecification> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached) as StyleSpecification;
  } catch {
    // Corrupt cache reads fall through to the network path below.
  }
  try {
    const res = await fetch(CALM_SOURCE_URL);
    if (!res.ok) return CALM_SOURCE_URL;
    const calm = calmDarkStyle((await res.json()) as StyleSpecification);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(calm));
    } catch {
      // Cache write failure is harmless — the fetched style still applies.
    }
    return calm;
  } catch {
    return CALM_SOURCE_URL;
  }
}
