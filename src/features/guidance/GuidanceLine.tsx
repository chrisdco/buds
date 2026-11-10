import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { memo, useMemo } from "react";

import { remainingLine } from "@/features/guidance/guidance";
import { useColors } from "@/theme";
import type { RouteResult } from "@/types/contracts";

// The route you're following, drawn over the group's lines: a wide accent
// core on a halo, dashed when it's only a straight-line estimate.

export const GuidanceLine = memo(function GuidanceLine({
  route,
  from,
}: {
  route: RouteResult | null;
  from: { lat: number; lng: number } | null;
}) {
  const colors = useColors();
  const data = useMemo(() => {
    const coords = route?.coords ?? [];
    // Straight-line estimates run from you anyway; road routes start at
    // your snapped point so the line shrinks as you go.
    const line = from && coords.length >= 2 && route?.source !== "straightline" ? remainingLine(coords, from) : coords;
    return {
      type: "FeatureCollection" as const,
      features:
        line.length >= 2
          ? [
              {
                type: "Feature" as const,
                properties: { dashed: route?.source === "straightline" },
                geometry: { type: "LineString" as const, coordinates: line },
              },
            ]
          : [],
    };
  }, [route, from]);

  return (
    <GeoJSONSource id="guidance" data={data}>
      <Layer
        type="line"
        id="guidance-casing"
        filter={["!", ["get", "dashed"]]}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": colors.text, "line-width": 13, "line-opacity": 0.25 }}
      />
      <Layer
        type="line"
        id="guidance-core"
        filter={["!", ["get", "dashed"]]}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": colors.accent, "line-width": 8 }}
      />
      <Layer
        type="line"
        id="guidance-estimate"
        filter={["get", "dashed"]}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": colors.accent, "line-width": 5, "line-dasharray": [1.5, 2] }}
      />
    </GeoJSONSource>
  );
});
