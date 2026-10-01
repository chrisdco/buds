import { memo } from "react";

import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { colorForUser } from "@/constants/theme";
import type { RouteResult } from "@/types/contracts";

function lineFeature(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

interface RouteLinesProps {
  routes: Record<string, RouteResult>;
  myUserId: string | null;
}

// Memoized: the routes record only changes identity on fetch/clear, so map
// re-renders from the presence tick or camera moves skip all route layers.
export const RouteLines = memo(function RouteLines({ routes, myUserId }: RouteLinesProps) {
  return (
    <>
      {Object.entries(routes).map(([userId, route]) => {
        if (route.coords.length < 2) return null;
        const self = userId === myUserId;
        const coreWidth = self ? 5 : 3;
        const dashed =
          route.source === "straightline" ? { "line-dasharray": [1.5, 2] } : {};
        return (
          <GeoJSONSource
            key={userId}
            id={`route-${userId}`}
            data={lineFeature(route.coords)}
          >
            {/* Uber-style casing: a soft light halo under the route so it
            reads on the dark tiles at a glance. Same dash as the core. */}
            <Layer
              type="line"
              id={`route-casing-${userId}`}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#FFFFFF",
                "line-width": coreWidth + 4.5,
                "line-opacity": self ? 0.32 : 0.18,
                ...dashed,
              }}
            />
            <Layer
              type="line"
              id={`route-line-${userId}`}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": colorForUser(userId),
                "line-width": coreWidth,
                "line-opacity": self ? 0.9 : 0.55,
                // dashed = straight-line estimate, not a road route
                ...dashed,
              }}
            />
          </GeoJSONSource>
        );
      })}
    </>
  );
});
