import { create } from "zustand";

import {
  getRecentRooms,
  removeRecentRoom,
  type ActiveRoomRef,
} from "@/lib/activeRoom";

// Recent-trips list, resident in memory: loaded once at startup (root
// layout) instead of per focus. Tab screens therefore paint rows on first
// commit — no empty-then-populated flash. Refreshes that change nothing
// don't notify (id-key compare), so focus refetches are visually free.
interface RecentsState {
  /** null = not loaded yet; renderers must show blank (not empty-state). */
  recents: ActiveRoomRef[] | null;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const idsOf = (rs: ActiveRoomRef[]): string => rs.map((r) => r.id).join(",");

export const useRecentsStore = create<RecentsState>()((set, get) => ({
  recents: null,

  refresh: async () => {
    const recents = await getRecentRooms();
    const prev = get().recents;
    if (prev === null || idsOf(recents) !== idsOf(prev)) {
      set({ recents });
    }
  },

  remove: async (id: string) => {
    await removeRecentRoom(id);
    set({ recents: (get().recents ?? []).filter((r) => r.id !== id) });
  },
}));
