import { memo } from "react";

import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

import { colors } from "@/constants/theme";
import type { RouteFeatureCollection } from "@/features/map/routeFeatures";

// Single-source route renderer (docs/route-view.md 4.1, 9.1): every route
// is one feature, every visual is a data-driven expression on its tier.
// Switching lens or focus only swaps feature properties — no layers mount
// or unmount, no native view churn — so it costs one source update.

const byTier = (primary: number, secondary: number, context: number): ExpressionSpecification => [
  "match",
  ["get", "tier"],
  "primary",
  primary,
  "secondary",
  secondary,
  context,
];

// Widths thin by 30% when zoomed out to city scale so ten routes don't
// become a hairball.
const width = (primary: number, secondary: number, context: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  byTier(primary * 0.7, secondary * 0.7, context * 0.7),
  13,
  byTier(primary, secondary, context),
];

// Context lines fade out entirely below zoom 11 (section 4.1).
const coreOpacity: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10.5,
  byTier(0.95, 0.7, 0),
  11.5,
  byTier(0.95, 0.7, 0.3),
];

const solid: ExpressionSpecification = ["!", ["get", "dashed"]];
const dashed: ExpressionSpecification = ["get", "dashed"];
const cased: ExpressionSpecification = ["all", solid, ["!=", ["get", "tier"], "context"]];

const lineLayout: {
  "line-cap": "round";
  "line-join": "round";
  "line-sort-key": ExpressionSpecification;
} = {
  "line-cap": "round",
  "line-join": "round",
  "line-sort-key": ["get", "sortKey"],
};

export const RouteLines = memo(function RouteLines({ features }: { features: RouteFeatureCollection }) {
  return (
    <GeoJSONSource id="routes" data={features}>
      {/* Casing: a light halo (amber when late / off route) so a route
      reads on dark tiles. Context lines go without. */}
      <Layer
        type="line"
        id="route-casing"
        filter={cased}
        layout={lineLayout}
        paint={{
          "line-color": ["case", ["get", "late"], colors.warning, "#FFFFFF"],
          "line-width": width(9.5, 7.5, 0),
          "line-opacity": ["case", ["get", "late"], 0.85, byTier(0.3, 0.16, 0)],
          "line-offset": ["get", "offset"],
        }}
      />
      <Layer
        type="line"
        id="route-core"
        filter={solid}
        layout={lineLayout}
        paint={{
          "line-color": ["get", "color"],
          "line-width": width(5, 3.5, 2),
          "line-opacity": coreOpacity,
          "line-offset": ["get", "offset"],
        }}
      />
      {/* Dashed = straight-line estimate, never a road route. */}
      <Layer
        type="line"
        id="route-estimate"
        filter={dashed}
        layout={lineLayout}
        paint={{
          "line-color": ["get", "color"],
          "line-width": width(3.5, 2.5, 1.5),
          "line-opacity": coreOpacity,
          "line-dasharray": [1.5, 2],
          "line-offset": ["get", "offset"],
        }}
      />
    </GeoJSONSource>
  );
});
