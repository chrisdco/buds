import type { CameraRef } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { guidance, type Guidance } from "@/features/guidance/guidance";
import { haversineMeters } from "@/lib/geo";
import { openExternalNavigation } from "@/lib/nav";
import { fetchRoute } from "@/services/routing/router";
import type { RouteResult } from "@/types/contracts";
import { useUiStore, type NavTarget } from "@/stores/uiStore";

// In-app navigation (the default for every "Navigate" in a room): your own
// road route to the target on our map, a heading-up follow camera, and the
// next maneuver for the banner. Google/Apple Maps stays one tap away in the
// banner for voice guidance.

/** Off the line by more than this: fetch a fresh route from here. */
const REROUTE_OFF_M = 45;
/** A bud you're heading to moved this far from the route's end: reroute. */
const TARGET_MOVED_M = 120;
/** Never refetch more often than this, whatever the triggers say. */
const MIN_REFETCH_MS = 8_000;
/** Close enough: guidance ends with an arrival note. */
const ARRIVED_M = 30;
const NAV_ZOOM = 16.5;
const NAV_PITCH = 50;

export interface GuidanceTarget {
  lat: number;
  lng: number;
  label: string;
}

export function useGuidance(args: {
  cameraRef: RefObject<CameraRef | null>;
  nav: NavTarget | null;
  target: GuidanceTarget | null;
  me: { lat: number; lng: number } | null;
  cameraMode: "auto" | "manual";
  /** Map padding so your arrow sits low in the strip between banner and sheet. */
  padTop: number;
  padBottom: number;
}) {
  const { cameraRef, nav, target, me, cameraMode, padTop, padBottom } = args;
  const active = nav != null && target != null;
  const navKey = nav ? (nav.kind === "member" ? `m:${nav.userId}` : "dest") : "";
  // Routes are stored with their target, so a new target starts from scratch.
  const [fetched, setFetched] = useState<{ key: string; route: RouteResult } | null>(null);
  const route = fetched?.key === navKey ? fetched.route : null;
  const lastFetch = useRef({ key: "", atMs: 0 });
  const inFlight = useRef(false);

  const g: Guidance | null = useMemo(
    () => (active && route && me ? guidance(route, me) : null),
    [active, route, me],
  );

  // Fetch / reroute: no route yet, drifted off it, or the bud moved on.
  useEffect(() => {
    if (!active || !me || !target || inFlight.current) return;
    const end = route?.coords[route.coords.length - 1];
    const stale =
      route == null ||
      (g != null && g.offRouteM > REROUTE_OFF_M) ||
      (end != null && haversineMeters(end[1], end[0], target.lat, target.lng) > TARGET_MOVED_M);
    if (!stale) return;
    if (lastFetch.current.key === navKey && Date.now() - lastFetch.current.atMs < MIN_REFETCH_MS) return;
    inFlight.current = true;
    lastFetch.current = { key: navKey, atMs: Date.now() };
    const key = navKey;
    void fetchRoute(me, target)
      .then((r) => {
        // Ended or switched target while fetching: drop it.
        const now = useUiStore.getState().nav;
        const nowKey = now ? (now.kind === "member" ? `m:${now.userId}` : "dest") : "";
        if (nowKey === key) setFetched({ key, route: r });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [active, me, target, route, g, navKey]);

  // Arrived: end guidance with a quiet note.
  useEffect(() => {
    if (!active || !me || !target) return;
    if (haversineMeters(me.lat, me.lng, target.lat, target.lng) > ARRIVED_M) return;
    const ui = useUiStore.getState();
    ui.setNav(null);
    ui.pushAlerts([
      {
        id: "nav-arrived",
        severity: "info",
        title: nav?.kind === "member" ? `You're with ${target.label}` : "You've arrived",
      },
    ]);
  }, [active, me, target, nav]);

  // Heading-up follow while the camera is ours; a pan hands it to you until
  // you tap re-center. Ending hands back to the room camera, which flattens.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && me && cameraMode === "auto") {
      cameraRef.current?.easeTo({
        center: [me.lng, me.lat],
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
        bearing: g?.bearing ?? 0,
        padding: { top: padTop, bottom: padBottom, left: 0, right: 0 },
        duration: wasActive.current ? 900 : 700,
      });
    }
    wasActive.current = active;
    // g.bearing changes with me; keyed on position + mode only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, me?.lat, me?.lng, cameraMode, padTop, padBottom]);

  const end = useCallback(() => useUiStore.getState().setNav(null), []);
  const openInMaps = useCallback(() => {
    if (target) void openExternalNavigation(target.lat, target.lng);
  }, [target]);

  return { active, route: active ? route : null, guidance: g, end, openInMaps };
}
