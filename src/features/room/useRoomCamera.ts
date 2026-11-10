import type { CameraRef } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, type RefObject } from "react";

import { collectFitPoints } from "@/lib/mapBounds";
import type { CameraTarget, ClientSnapshot, ModeStrategy } from "@/modes/types";
import { useUiStore } from "@/stores/uiStore";

// Room map camera: the strategy's auto policy, the lens's framing, member
// focus (frames the focused people and their routes), recenter, and
// sheet-aware padding. Suspended while a destination pin is being adjusted
// (that flow owns the camera). Lens switches animate in 400 ms
// (docs/route-view.md 5.2); routine follow ticks ease slower.

const LENS_SWITCH_MS = 400;
const FOLLOW_MS = 700;
const FIT_MS = 800;
// Room views are flat and north-up with no padding of their own; this also
// undoes guidance's tilted, heading-up camera when navigation ends.
const FLAT = { pitch: 0, bearing: 0 } as const;
const NO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };

export function useRoomCamera(args: {
  cameraRef: RefObject<CameraRef | null>;
  snap: ClientSnapshot | null;
  strategy: ModeStrategy;
  myUserId: string | null;
  /** Visible sheet height + margin: framed content stays in the map strip. */
  padBottom: number;
  nowMs: number;
  suspended: boolean;
  /** The lens's own framing (its primary + secondary routes); null = the
  strategy default. Focus still wins over both. */
  lensTarget: CameraTarget | null;
}) {
  const { cameraRef, snap, strategy, myUserId, padBottom, nowMs, suspended, lensTarget } = args;
  const lensKey = lensTarget ? JSON.stringify(lensTarget) : "";
  const cameraMode = useUiStore((s) => s.cameraMode);
  const focusUserIds = useUiStore((s) => s.focusUserIds);

  const apply = useCallback(
    (target: CameraTarget, fast = false) => {
      if (!snap) return;
      const posOf = (uid: string) => snap.members[uid]?.pos;
      if (target.kind === "follow") {
        const p = posOf(target.userId);
        if (p) cameraRef.current?.easeTo({ center: [p.lng, p.lat], ...FLAT, padding: NO_PAD, duration: fast ? LENS_SWITCH_MS : FOLLOW_MS });
        return;
      }
      const pool =
        target.kind === "fitUsers"
          ? target.userIds.map(posOf).filter((p) => p != null)
          : Object.values(snap.members).flatMap((m) => (m.pos ? [m.pos] : []));
      // fitAll frames the whole trip: members + destination + every rendered
      // route leg, so a detouring road route pulls the frame instead of
      // running off-screen. fitUsers frames members, plus their routes when
      // asked (focus and lenses: "fit their route").
      const routeLines =
        target.kind === "fitAll"
          ? Object.values(snap.routes).map((r) => r.coords)
          : target.withRoutes
            ? target.userIds.flatMap((uid) => (snap.routes[uid] ? [snap.routes[uid].coords] : []))
            : undefined;
      const points = collectFitPoints({
        members: pool,
        dest: target.kind === "fitAll" ? snap.destRoom : null,
        routeLines,
      });
      if (points.length === 0) return;
      if (points.length === 1) {
        cameraRef.current?.easeTo({ center: points[0], zoom: 15, ...FLAT, padding: NO_PAD, duration: fast ? LENS_SWITCH_MS : FOLLOW_MS });
        return;
      }
      const lngs = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 130, bottom: padBottom, left: 60, right: 60 }, ...FLAT, duration: fast ? LENS_SWITCH_MS : FIT_MS },
      );
    },
    [snap, cameraRef, padBottom],
  );

  const recenter = useCallback(() => {
    useUiStore.getState().setFocusUserIds([]);
    useUiStore.getState().setCameraMode("auto");
    if (snap && myUserId) apply(lensTarget ?? strategy.cameraTarget(snap, myUserId));
  }, [snap, myUserId, strategy, apply, lensTarget]);

  // Auto camera follows the strategy's policy until the user pans — unless
  // members are focused (marker toggle / detail Focus) or the lens frames
  // its own set. Deliberately keyed on the slow clock + layout, not on
  // every tick's data change, so the map doesn't jitter per GPS fix.
  const lastView = useRef("");
  useEffect(() => {
    if (cameraMode !== "auto" || suspended || !snap || !myUserId) return;
    const focused = focusUserIds.filter((id) => snap.members[id]?.pos);
    // A changed lens or focus set is a switch: animate it quickly.
    const view = `${lensKey}#${focusUserIds.join(",")}`;
    const switched = lastView.current !== "" && lastView.current !== view;
    lastView.current = view;
    apply(
      focused.length > 0
        ? { kind: "fitUsers", userIds: focused, withRoutes: true }
        : (lensTarget ?? strategy.cameraTarget(snap, myUserId)),
      switched,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cameraMode, suspended, snap?.room.mode, focusUserIds, padBottom, lensKey]);

  return { cameraMode, focusUserIds, recenter };
}
