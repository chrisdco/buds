import { create } from "zustand";

import type { Tier } from "@/modes/lenses";
import type { RouteResult } from "@/types/contracts";

interface RoutesState {
  routes: Record<string, RouteResult>; // keyed by user_id
  /** How strongly the viewer's map draws each route (set by the room
  screen); paces refetches: emphasized routes stay fresher. */
  tiers: Record<string, Tier>;
  setTiers: (tiers: Record<string, Tier>) => void;
  setRoute: (userId: string, route: RouteResult) => void;
  clearRoute: (userId: string) => void;
  reset: () => void;
}

export const useRouteStore = create<RoutesState>()((set, get) => ({
  routes: {},
  tiers: {},
  setTiers: (tiers) => {
    const prev = get().tiers;
    const keys = Object.keys(tiers);
    if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === tiers[k])) return;
    set({ tiers });
  },
  setRoute: (userId, route) =>
    set({ routes: { ...get().routes, [userId]: route } }),
  clearRoute: (userId) => {
    if (!(userId in get().routes)) return;
    const routes = { ...get().routes };
    delete routes[userId];
    set({ routes });
  },
  reset: () => set({ routes: {}, tiers: {} }),
}));
