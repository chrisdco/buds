import { memo, useEffect, useMemo, useState } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useReducedMotion } from "react-native-reanimated";

import { colorForUser } from "@/constants/theme";
import { useColors } from "@/theme";

export interface PendingRoute {
  userId: string;
  /** [lng, lat] */
  from: [number, number];
  /** [lng, lat] */
  to: [number, number];
}

/** One trip of the travelling dot, ms. */
const LOOP_MS = 1_400;
/** ~15 fps: smooth enough for a small dot, and it only runs while a route loads. */
const FRAME_MS = 66;

/** Position along the line for loop phase t in [0, 1): ease in and out. */
export function pendingDotAt(from: [number, number], to: [number, number], t: number): [number, number] {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
}

/**
 * While someone's road route is being fetched: a faint dashed line from them
 * to where they're going, with a dot running along it, so the map shows
 * "working on it" instead of nothing. Replaced by the real route as soon as
 * it arrives (the caller stops listing them).
 */
export const PendingRoutes = memo(function PendingRoutes({ pending }: { pending: PendingRoute[] }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const active = pending.length > 0 && !reduceMotion;

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const id = setInterval(() => setPhase(((Date.now() - start) % LOOP_MS) / LOOP_MS), FRAME_MS);
    return () => clearInterval(id);
  }, [active]);

  const lines = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: pending.map((p) => ({
        type: "Feature" as const,
        properties: { color: colorForUser(p.userId) },
        geometry: { type: "LineString" as const, coordinates: [p.from, p.to] },
      })),
    }),
    [pending],
  );

  const dots = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: active
        ? pending.map((p) => ({
            type: "Feature" as const,
            properties: { color: colorForUser(p.userId) },
            geometry: { type: "Point" as const, coordinates: pendingDotAt(p.from, p.to, phase) },
          }))
        : [],
    }),
    [pending, phase, active],
  );

  return (
    <>
      <GeoJSONSource id="pending-routes" data={lines}>
        <Layer
          type="line"
          id="pending-route-line"
          layout={{ "line-cap": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": 3,
            "line-opacity": 0.35,
            "line-dasharray": [0.5, 2],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="pending-route-dots" data={dots}>
        <Layer
          type="circle"
          id="pending-route-dot"
          paint={{
            "circle-radius": 4.5,
            "circle-color": ["get", "color"],
            "circle-stroke-color": colors.text,
            "circle-stroke-width": 1.5,
          }}
        />
      </GeoJSONSource>
    </>
  );
});
