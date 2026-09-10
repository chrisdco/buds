import { OfflineManager } from "@maplibre/maplibre-react-native";

// Offline trip pack: caches map tiles around the active destination so the
// map keeps rendering through dead zones (GPS + realtime still need their own
// signal — this covers tiles only). One small pack per trip, replaced when
// the destination moves, deleted on room teardown.
//
// Boundaries (deliberately conservative — tile hosts are free, not infinite):
// ~13km box, zooms 10-16, single pack. Never throws: offline is best-effort,
// the live map must work identically without it.

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const HALF_SPAN_DEG = 0.06;
const MIN_ZOOM = 10;
const MAX_ZOOM = 16;
const TRIP_MARKER = "buds-trip";

let activePackId: string | null = null;
let activeKey: string | null = null;

function regionKey(lat: number, lng: number): string {
  return `${Math.round(lat * 50) / 50},${Math.round(lng * 50) / 50}`;
}

async function deleteStaleTripPacks(): Promise<void> {
  try {
    const packs = await OfflineManager.getPacks();
    if (!Array.isArray(packs)) return;
    for (const pack of packs) {
      try {
        const meta = (pack as { metadata?: unknown }).metadata;
        const marker =
          meta != null && typeof meta === "object"
            ? (meta as Record<string, unknown>).budsPack
            : undefined;
        if (marker === TRIP_MARKER && pack.id !== activePackId) {
          await OfflineManager.deletePack(pack.id);
        }
      } catch {
        // One bad pack must not block the rest.
      }
    }
  } catch {
    // Offline storage unavailable (private mode, full disk) — live map only.
  }
}

/** Cache tiles around a destination; no-op when unchanged. Never throws. */
export async function ensureTripPack(lat: number, lng: number): Promise<void> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = regionKey(lat, lng);
    if (key === activeKey) return;
    if (activePackId) {
      try {
        await OfflineManager.deletePack(activePackId);
      } catch {
        // Stale pack lingers; the sweep below still bounds growth to ~1.
      }
      activePackId = null;
    }
    await deleteStaleTripPacks();
    const pack = await OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE_URL,
        // Flat [west, south, east, north] per the LngLatBounds type.
        bounds: [lng - HALF_SPAN_DEG, lat - HALF_SPAN_DEG, lng + HALF_SPAN_DEG, lat + HALF_SPAN_DEG],
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        metadata: { budsPack: TRIP_MARKER },
      },
      () => {},
      () => {},
    );
    activePackId = pack?.id ?? null;
    activeKey = key;
  } catch {
    // Best-effort only.
  }
}

/** Drop the trip pack (room teardown). Never throws. */
export async function clearTripPack(): Promise<void> {
  activeKey = null;
  if (!activePackId) return;
  const id = activePackId;
  activePackId = null;
  try {
    await OfflineManager.deletePack(id);
  } catch {
    // Reclaimed by the next ensureTripPack sweep.
  }
}
