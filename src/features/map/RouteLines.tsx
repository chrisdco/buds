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

export function RouteLines({ routes, myUserId }: RouteLinesProps) {
  return (
    <>
      {Object.entries(routes).map(([userId, route]) => {
        if (route.coords.length < 2) return null;
        const self = userId === myUserId;
        return (
          <GeoJSONSource
            key={userId}
            id={`route-${userId}`}
            data={lineFeature(route.coords)}
          >
            <Layer
              type="line"
              id={`route-line-${userId}`}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": colorForUser(userId),
                "line-width": self ? 5 : 3,
                "line-opacity": self ? 0.9 : 0.55,
                // dashed = straight-line estimate, not a road route
                ...(route.source === "straightline"
                  ? { "line-dasharray": [1.5, 2] }
                  : {}),
              }}
            />
          </GeoJSONSource>
        );
      })}
    </>
  );
}
