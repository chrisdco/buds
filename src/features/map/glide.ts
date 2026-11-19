import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { haversineMeters, nearestOnPolyline } from "@/lib/geo";

export type LngLat = [number, number];

/** A fix this close to the member's own route is drawn on it (GPS drift off the road). */
export const SNAP_M = 25;
/** Fixes worse than this are too vague to place on a specific road. */
const SNAP_MAX_ACCURACY_M = 40;
/** Farther than this between fixes is a jump (reconnect, teleport): no glide. */
export const JUMP_M = 1_000;
const MIN_GLIDE_MS = 300;
const MAX_GLIDE_MS = 3_000;
/** ~30 fps is smooth for a marker and halves the work of 60. */
const FRAME_MS = 33;

/**
 * Where to draw a fix: on the member's route when it's within SNAP_M of it
 * and accurate enough, otherwise where it was reported.
 */
export function placeOnRoute(
  lat: number,
  lng: number,
  accuracyM: number | undefined,
  route: LngLat[] | undefined,
): LngLat {
  if (!route || route.length < 2) return [lng, lat];
  if (accuracyM != null && accuracyM > SNAP_MAX_ACCURACY_M) return [lng, lat];
  const near = nearestOnPolyline(lat, lng, route);
  return near && near.distM <= SNAP_M ? [near.lng, near.lat] : [lng, lat];
}

/** Glide length for the gap between two fixes: about one update interval. */
export function glideMs(prevAtMs: number | null, atMs: number): number {
  if (prevAtMs == null) return 0;
  return Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, atMs - prevAtMs));
}

export function lerpLngLat(from: LngLat, to: LngLat, t: number): LngLat {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/**
 * The position to draw for a moving member: glides from where the marker is
 * now to each new fix at constant speed over roughly the time between fixes
 * (Uber-style): it arrives about when the next fix lands, so a steadily
 * moving member never visibly stops or hops. Jumps and
 * reduced-motion users get the new position straight away.
 */
export function useGlidingPosition(target: LngLat, atMs: number): LngLat {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState<LngLat>(target);
  const shownRef = useRef<LngLat>(target);
  const lastAt = useRef<number | null>(null);
  const [lng, lat] = target;

  useEffect(() => {
    const to: LngLat = [lng, lat];
    const from = shownRef.current;
    const duration = glideMs(lastAt.current, atMs);
    lastAt.current = atMs;
    const set = (p: LngLat) => {
      shownRef.current = p;
      setShown(p);
    };
    if (
      reduceMotion ||
      duration === 0 ||
      haversineMeters(from[1], from[0], lat, lng) > JUMP_M ||
      (from[0] === lng && from[1] === lat)
    ) {
      set(to);
      return;
    }
    const start = Date.now();
    let lastFrame = 0;
    let raf = 0;
    const step = () => {
      const now = Date.now();
      const t = (now - start) / duration;
      if (t >= 1) {
        set(to);
        return;
      }
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        set(lerpLngLat(from, to, t));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lng, lat, atMs, reduceMotion]);

  return shown;
}
