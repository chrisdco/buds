import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PlaceRef {
  name: string;
  address: string;
  lat: number;
  lng: number;
  atMs: number;
}

export interface SavedPlaces {
  home: PlaceRef | null;
  work: PlaceRef | null;
}

const RECENTS_KEY = "buds.recentPlaces";
const SAVED_KEY = "buds.savedPlaces";
const MAX_RECENTS = 8;

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isPlaceRef(r: unknown): r is PlaceRef {
  if (typeof r !== "object" || r === null) return false;
  const p = r as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.address === "string" &&
    isFiniteNum(p.lat) &&
    isFiniteNum(p.lng)
  );
}

function normalize(r: PlaceRef): PlaceRef {
  return {
    name: r.name.slice(0, 80),
    address: r.address.slice(0, 120),
    lat: r.lat,
    lng: r.lng,
    atMs: typeof r.atMs === "number" && Number.isFinite(r.atMs) ? r.atMs : Date.now(),
  };
}

/** Recent place searches, most-recent-first, capped. History only — never blocks. */
export async function getRecentPlaces(): Promise<PlaceRef[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlaceRef).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export async function pushRecentPlace(ref: PlaceRef): Promise<void> {
  try {
    const recents = await getRecentPlaces();
    const next = [
      normalize(ref),
      // Same coords = same place (names/addresses vary per query).
      ...recents.filter((r) => r.lat !== ref.lat || r.lng !== ref.lng),
    ].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // History is convenience only; never block picking.
  }
}

export async function getSavedPlaces(): Promise<SavedPlaces> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== "object" || parsed === null) return { home: null, work: null };
    const p = parsed as Record<string, unknown>;
    return {
      home: isPlaceRef(p.home) ? (p.home as PlaceRef) : null,
      work: isPlaceRef(p.work) ? (p.work as PlaceRef) : null,
    };
  } catch {
    return { home: null, work: null };
  }
}

export async function setSavedPlace(
  slot: "home" | "work",
  ref: PlaceRef | null,
): Promise<void> {
  try {
    const saved = await getSavedPlaces();
    saved[slot] = ref ? normalize(ref) : null;
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Best-effort like the rest of local convenience state.
  }
}
