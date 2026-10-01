import { create } from "zustand";

import {
  getRecentPlaces,
  getSavedPlaces,
  pushRecentPlace,
  setSavedPlace,
  type PlaceRef,
  type SavedPlaces,
} from "@/lib/places";

// Resident places memory (loaded once at startup like recents): recent
// searches + saved Home/Work. Search screens paint rows on first commit;
// focus refetches that change nothing don't notify.
interface PlacesState {
  /** null = not loaded yet; renderers must show blank (not empty-state). */
  recents: PlaceRef[] | null;
  saved: SavedPlaces;
  refresh: () => Promise<void>;
  /** Records a pick (fire-and-forget from screens). */
  addRecent: (ref: PlaceRef) => Promise<void>;
  save: (slot: "home" | "work", ref: PlaceRef | null) => Promise<void>;
}

export const usePlacesStore = create<PlacesState>()((set) => ({
  recents: null,
  saved: { home: null, work: null },

  refresh: async () => {
    const [recents, saved] = await Promise.all([getRecentPlaces(), getSavedPlaces()]);
    set({ recents, saved });
  },

  addRecent: async (ref) => {
    await pushRecentPlace(ref);
    set({ recents: await getRecentPlaces() });
  },

  save: async (slot, ref) => {
    await setSavedPlace(slot, ref);
    set({ saved: await getSavedPlaces() });
  },
}));
