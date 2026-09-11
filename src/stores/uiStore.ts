import { create } from "zustand";

import type { LocalAlert } from "@/events/alertEngine";

export interface ToastItem extends LocalAlert {
  key: string;
  atMs: number;
}

type CameraMode = "auto" | "manual";

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  /** Defaults to "Cancel". Priming sheets say "Not now". */
  cancelLabel?: string;
  destructive: boolean;
}

/** Destination picked in search, awaiting map adjust + confirm on the map. */
export interface DestDraft {
  lat: number;
  lng: number;
  label: string;
}

interface UiState {
  toasts: ToastItem[];
  cameraMode: CameraMode;
  /** Camera focus set: members the map frames. Empty = strategy default;
  one = follow; several = fit. Toggled from map markers, set from detail. */
  focusUserIds: string[];
  /** Active native confirm dialog (ConfirmSheet); null when closed. */
  confirm: ConfirmRequest | null;
  /** Search/long-press pick waiting for adjust + confirm; null when idle. */
  destDraft: DestDraft | null;
  setDestDraft: (draft: DestDraft | null) => void;
  pushAlerts: (alerts: LocalAlert[]) => void;
  dismissToast: (key: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFocusUserIds: (userIds: string[]) => void;
  toggleFocusUserId: (userId: string) => void;
  /**
   * Native replacement for Alert.alert confirms. Resolves true on confirm,
   * false on dismiss/cancel. A pending request is resolved false when
   * replaced or on reset, so callers never hang.
   */
  requestConfirm: (req: ConfirmRequest) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
  reset: () => void;
}

let confirmResolve: ((confirmed: boolean) => void) | null = null;

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  cameraMode: "auto",
  focusUserIds: [],
  confirm: null,
  destDraft: null,

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

  setFocusUserIds: (focusUserIds) => set({ focusUserIds }),

  toggleFocusUserId: (userId) =>
    set((state) => ({
      focusUserIds: state.focusUserIds.includes(userId)
        ? state.focusUserIds.filter((id) => id !== userId)
        : [...state.focusUserIds, userId],
    })),

  setDestDraft: (destDraft) => set({ destDraft }),

  requestConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      // Never leave a previous caller hanging.
      confirmResolve?.(false);
      confirmResolve = resolve;
      set({ confirm: req });
    }),

  resolveConfirm: (confirmed) => {
    set({ confirm: null });
    confirmResolve?.(confirmed);
    confirmResolve = null;
  },

  reset: () => {
    confirmResolve?.(false);
    confirmResolve = null;
    set({ toasts: [], cameraMode: "auto", focusUserIds: [], confirm: null, destDraft: null });
  },
}));
