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
  destructive: boolean;
}

interface UiState {
  toasts: ToastItem[];
  cameraMode: CameraMode;
  /** Member the auto-camera is pinned to (member detail sheet "Follow"). */
  focusedMemberId: string | null;
  /** Active native confirm dialog (ConfirmSheet); null when closed. */
  confirm: ConfirmRequest | null;
  pushAlerts: (alerts: LocalAlert[]) => void;
  dismissToast: (key: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFocusedMemberId: (userId: string | null) => void;
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
  focusedMemberId: null,
  confirm: null,

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

  setFocusedMemberId: (focusedMemberId) => set({ focusedMemberId }),

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
    set({ toasts: [], cameraMode: "auto", focusedMemberId: null, confirm: null });
  },
}));
