import { create } from "zustand";

import type { LocalAlert } from "@/events/alertEngine";
import type { Lens } from "@/modes/lenses";

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
  /** Route-view lens picked in this room; null = the mode default. */
  lens: Lens | null;
  /** When the user last dragged the map (0 = never): a lens switch inside
  the hold window leaves the camera alone (docs/route-view.md 5.2). */
  lastPanAtMs: number;
  /** A lens switch skipped the camera move; show the Re-center pill. */
  recenterHint: boolean;
  /** Long-press member menu ("Only them", ...); null when closed. */
  memberActionsFor: string | null;
  /** Active native confirm dialog (ConfirmSheet); null when closed. */
  confirm: ConfirmRequest | null;
  /** Search/long-press pick waiting for adjust + confirm; null when idle. */
  destDraft: DestDraft | null;
  setDestDraft: (draft: DestDraft | null) => void;
  pushAlerts: (alerts: LocalAlert[]) => void;
  dismissToast: (key: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setFocusUserIds: (userIds: string[]) => void;
  setLens: (lens: Lens | null) => void;
  /** User dragged the map: manual camera, stamp the pan time. */
  markUserPan: () => void;
  /**
   * Pick a lens (clears focus). The camera re-frames for it unless the
   * user panned within PAN_HOLD_MS; then the Re-center pill shows instead.
   */
  pickLens: (lens: Lens) => void;
  setRecenterHint: (on: boolean) => void;
  setMemberActionsFor: (userId: string | null) => void;
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

/** How long after a pan a lens switch keeps its hands off the camera. */
export const PAN_HOLD_MS = 10_000;

let confirmResolve: ((confirmed: boolean) => void) | null = null;

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  cameraMode: "auto",
  focusUserIds: [],
  lens: null,
  lastPanAtMs: 0,
  recenterHint: false,
  memberActionsFor: null,
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

  // Back to auto clears the pill: the camera is following again.
  setCameraMode: (cameraMode) =>
    set(cameraMode === "auto" ? { cameraMode, recenterHint: false } : { cameraMode }),

  setFocusUserIds: (focusUserIds) => set({ focusUserIds }),

  setLens: (lens) => set({ lens }),

  markUserPan: () => set({ cameraMode: "manual", lastPanAtMs: Date.now() }),

  pickLens: (lens) => {
    const panned = get().cameraMode === "manual" && Date.now() - get().lastPanAtMs < PAN_HOLD_MS;
    set(
      panned
        ? { lens, focusUserIds: [], recenterHint: true }
        : { lens, focusUserIds: [], cameraMode: "auto", recenterHint: false },
    );
  },

  setRecenterHint: (recenterHint) => set({ recenterHint }),

  setMemberActionsFor: (memberActionsFor) => set({ memberActionsFor }),

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
    set({
      toasts: [],
      cameraMode: "auto",
      focusUserIds: [],
      lens: null,
      lastPanAtMs: 0,
      recenterHint: false,
      memberActionsFor: null,
      confirm: null,
      destDraft: null,
    });
  },
}));
