import type { CameraRef } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, type RefObject } from "react";

import { collectFitPoints } from "@/lib/mapBounds";
import type { CameraTarget, ClientSnapshot, ModeStrategy } from "@/modes/types";
import { useUiStore } from "@/stores/uiStore";

// Room map camera: the strategy's auto policy, member focus (one = follow,
// several = frame the set), recenter, and sheet-aware padding. Suspended
// while a destination pin is being adjusted (that flow owns the camera).

export function useRoomCamera(args: {
  cameraRef: RefObject<CameraRef | null>;
  snap: ClientSnapshot | null;
  strategy: ModeStrategy;
  myUserId: string | null;
  /** Visible sheet height + margin: framed content stays in the map strip. */
  padBottom: number;
  nowMs: number;
  suspended: boolean;
}) {
  const { cameraRef, snap, strategy, myUserId, padBottom, nowMs, suspended } = args;
  const cameraMode = useUiStore((s) => s.cameraMode);
  const focusUserIds = useUiStore((s) => s.focusUserIds);

  const apply = useCallback(
    (target: CameraTarget) => {
      if (!snap) return;
      const posOf = (uid: string) => snap.members[uid]?.pos;
      if (target.kind === "follow") {
        const p = posOf(target.userId);
        if (p) cameraRef.current?.easeTo({ center: [p.lng, p.lat], duration: 700 });
        return;
      }
      const pool =
        target.kind === "fitUsers"
          ? target.userIds.map(posOf).filter((p) => p != null)
          : Object.values(snap.members).flatMap((m) => (m.pos ? [m.pos] : []));
      // fitAll frames the whole trip: members + destination + every rendered
      // route leg, so a detouring road route pulls the frame instead of
      // running off-screen. fitUsers stays members-only by definition.
      const points = collectFitPoints({
        members: pool,
        dest: target.kind === "fitAll" ? snap.destRoom : null,
        routeLines:
          target.kind === "fitAll" ? Object.values(snap.routes).map((r) => r.coords) : undefined,
      });
      if (points.length === 0) return;
      if (points.length === 1) {
        cameraRef.current?.easeTo({ center: points[0], zoom: 15, duration: 700 });
        return;
      }
      const lngs = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 130, bottom: padBottom, left: 60, right: 60 }, duration: 800 },
      );
    },
    [snap, cameraRef, padBottom],
  );

  const recenter = useCallback(() => {
    useUiStore.getState().setFocusUserIds([]);
    useUiStore.getState().setCameraMode("auto");
    if (snap && myUserId) apply(strategy.cameraTarget(snap, myUserId));
  }, [snap, myUserId, strategy, apply]);

  // Auto camera follows the strategy's policy until the user pans — unless
  // members are focused (marker toggle / detail Follow). Deliberately keyed
  // on the slow clock + layout, not on every tick's data change, so the map
  // doesn't jitter per GPS fix.
  useEffect(() => {
    if (cameraMode !== "auto" || suspended || !snap || !myUserId) return;
    const focused = focusUserIds.filter((id) => snap.members[id]?.pos);
    apply(
      focused.length === 1
        ? { kind: "follow", userId: focused[0] }
        : focused.length > 1
          ? { kind: "fitUsers", userIds: focused }
          : strategy.cameraTarget(snap, myUserId),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cameraMode, suspended, snap?.room.mode, focusUserIds, padBottom]);

  return { cameraMode, focusUserIds, recenter };
}
