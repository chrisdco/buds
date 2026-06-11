import { create } from "zustand";

import type { LocalAlert } from "@/events/alertEngine";

export interface ToastItem extends LocalAlert {
  key: string;
  atMs: number;
}

type CameraMode = "auto" | "manual";

interface UiState {
  toasts: ToastItem[];
  cameraMode: CameraMode;
  pushAlerts: (alerts: LocalAlert[]) => void;
  dismissToast: (key: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  cameraMode: "auto",

  pushAlerts: (alerts) => {
    if (alerts.length === 0) return;
    const atMs = Date.now();
    const items = alerts.map((a) => ({ ...a, key: `${a.id}:${atMs}`, atMs }));
    // keep at most 3 visible
    set({ toasts: [...get().toasts, ...items].slice(-3) });
  },

  dismissToast: (key) =>
    set({ toasts: get().toasts.filter((t) => t.key !== key) }),

  setCameraMode: (cameraMode) => set({ cameraMode }),

  reset: () => set({ toasts: [], cameraMode: "auto" }),
}));
