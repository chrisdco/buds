import { memo } from "react";

import { GeoJSONSource, Images, Layer } from "@maplibre/maplibre-react-native";
import type { ExpressionSpecification, FilterSpecification } from "@maplibre/maplibre-gl-style-spec";

import {
  CHEVRON_ICON_SIZE,
  type RouteFeatureCollection,
  type RouteLabelCollection,
} from "@/features/map/routeFeatures";
import { onHue } from "@/constants/theme";
import { useColors } from "@/theme";

// Single-source route renderer (docs/route-view.md 4, 9.1): every route is
// one or two features (main + final leg), every visual is a data-driven
// expression on its properties. Switching lens or focus only swaps feature
// properties — the layer set is fixed, so nothing mounts or unmounts and a
// switch costs one source update.
//
// Layers, bottom to top: casing, core, core dash-dot (color clash), final
// leg dots, estimate dashes, direction chevrons; then the time bubbles on
// their own point source.

const CHEVRON = require("../../../assets/map/route-chevron.png");

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
const mainLeg: ExpressionSpecification = ["==", ["get", "leg"], "main"];
const notContext: ExpressionSpecification = ["!=", ["get", "tier"], "context"];

const casingFilter: FilterSpecification = ["all", solid, mainLeg, notContext];
const coreFilter: FilterSpecification = ["all", solid, mainLeg, ["!", ["get", "altDash"]]];
const coreAltFilter: FilterSpecification = ["all", solid, mainLeg, ["get", "altDash"]];
const finalFilter: FilterSpecification = ["==", ["get", "leg"], "final"];
const estimateFilter: FilterSpecification = ["get", "dashed"];
const chevronFilter: FilterSpecification = ["all", solid, mainLeg, ["==", ["get", "tier"], "primary"]];

const lineLayout: {
  "line-cap": "round";
  "line-join": "round";
  "line-sort-key": ExpressionSpecification;
} = {
  "line-cap": "round",
  "line-join": "round",
  "line-sort-key": ["get", "sortKey"],
};

const corePaint = {
  "line-color": ["get", "color"] as ExpressionSpecification,
  "line-width": width(5, 3.5, 2),
  "line-opacity": coreOpacity,
  "line-offset": ["get", "offset"] as ExpressionSpecification,
};

export const RouteLines = memo(function RouteLines({
  features,
  labels,
}: {
  features: RouteFeatureCollection;
  labels: RouteLabelCollection;
}) {
  const colors = useColors();
  return (
    <>
      <Images images={{ "route-chevron": CHEVRON }} />
      <GeoJSONSource id="routes" data={features}>
        {/* Casing: a halo in the text color (white on dark tiles, black on
        light), amber when late / off route. Context lines go without. */}
        <Layer
          type="line"
          id="route-casing"
          filter={casingFilter}
          layout={lineLayout}
          paint={{
            "line-color": ["case", ["get", "late"], colors.warning, colors.text],
            "line-width": width(9.5, 7.5, 0),
            "line-opacity": ["case", ["get", "late"], 0.85, byTier(0.3, 0.16, 0)],
            "line-offset": ["get", "offset"],
          }}
        />
        <Layer type="line" id="route-core" filter={coreFilter} layout={lineLayout} paint={corePaint} />
        {/* Same color as an earlier route: dash-dot so the two never merge. */}
        <Layer
          type="line"
          id="route-core-alt"
          filter={coreAltFilter}
          layout={lineLayout}
          paint={{ ...corePaint, "line-dasharray": [3, 1.2, 0.5, 1.2] }}
        />
        {/* The last 200 m: dots (round caps on zero-length dashes). */}
        <Layer
          type="line"
          id="route-final"
          filter={finalFilter}
          layout={lineLayout}
          paint={{
            "line-color": ["get", "color"],
            "line-width": width(4, 3, 2),
            "line-opacity": coreOpacity,
            "line-dasharray": [0, 1.8],
            "line-offset": ["get", "offset"],
          }}
        />
        {/* Dashed = straight-line estimate, never a road route. */}
        <Layer
          type="line"
          id="route-estimate"
          filter={estimateFilter}
          layout={lineLayout}
          paint={{
            "line-color": ["get", "color"],
            "line-width": width(3.5, 2.5, 1.5),
            "line-opacity": coreOpacity,
            "line-dasharray": [1.5, 2],
            "line-offset": ["get", "offset"],
          }}
        />
        {/* Direction: chevrons every ~150 px, primary routes only, from
        street zoom in. */}
        <Layer
          type="symbol"
          id="route-chevrons"
          filter={chevronFilter}
          minzoom={12}
          layout={{
            "symbol-placement": "line",
            "symbol-spacing": 150,
            "icon-image": "route-chevron",
            "icon-size": CHEVRON_ICON_SIZE,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-offset": ["get", "chevronOffset"],
          }}
          paint={{ "icon-opacity": 0.9 }}
        />
      </GeoJSONSource>
      {/* Time bubbles: "18 min" mid-route on primary routes; symbol
      collision hides the ones that would overlap. */}
      <GeoJSONSource id="route-labels" data={labels}>
        <Layer
          type="symbol"
          id="route-time"
          layout={{
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-padding": 4,
            "symbol-sort-key": 0,
          }}
          paint={{
            "text-color": onHue.label,
            "text-halo-color": ["get", "color"],
            "text-halo-width": 4,
          }}
        />
      </GeoJSONSource>
    </>
  );
});
