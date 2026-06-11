import { create } from "zustand";

import type { RouteResult } from "@/types/contracts";

interface RoutesState {
  routes: Record<string, RouteResult>; // keyed by user_id
  setRoute: (userId: string, route: RouteResult) => void;
  clearRoute: (userId: string) => void;
  reset: () => void;
}

export const useRouteStore = create<RoutesState>()((set, get) => ({
  routes: {},
  setRoute: (userId, route) =>
    set({ routes: { ...get().routes, [userId]: route } }),
  clearRoute: (userId) => {
    if (!(userId in get().routes)) return;
    const routes = { ...get().routes };
    delete routes[userId];
    set({ routes });
  },
  reset: () => set({ routes: {} }),
}));
