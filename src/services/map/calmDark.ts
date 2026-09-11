import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

// Pure calm pass over OpenFreeMap dark (muted minor roads, softened
// casings, deferred far labels). Zero imports — unit-tested without native
// modules. Fetching/caching lives in calmStyle.ts.

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

interface StyleLayer {
  id: string;
  type?: string;
  minzoom?: number;
  paint?: Record<string, JsonValue>;
  layout?: Record<string, JsonValue>;
}

/** line-width factor + line-opacity factor per road layer. */
const LINE_CALM: Record<string, { width?: number; opacity?: number }> = {
  highway_minor: { width: 0.4, opacity: 0.45 },
  highway_path: { opacity: 0.5 },
  highway_major_casing: { opacity: 0.35 },
  highway_motorway_casing: { opacity: 0.35 },
  railway_minor: { opacity: 0.5 },
  railway: { opacity: 0.65 },
};

/**
 * Wide glow underlays beneath major roads — the biggest "bold" contributor.
 * Hidden outright; the inner lines carry the structure.
 */
const LAYER_HIDE = ["highway_major_subtle", "highway_motorway_subtle"];

/** Defer far labels; shrink neighbourhood ones (plain-number sizes only). */
const LABEL_CALM: Record<string, { minzoom: number; textScale?: number }> = {
  highway_name_other: { minzoom: 14 },
  road_oneway: { minzoom: 16 },
  road_oneway_opposite: { minzoom: 16 },
  place_other: { minzoom: 14, textScale: 0.9 },
  place_suburb: { minzoom: 14, textScale: 0.9 },
  place_village: { minzoom: 14, textScale: 0.9 },
};

/**
 * Scale a paint value: plain numbers multiply directly; interpolate
 * expressions scale their numeric outputs (stops sit at even indices >= 4:
 * ["interpolate", interp, input, z1, v1, z2, v2, ...]). Anything else passes
 * through untouched so unknown shapes never corrupt the style.
 */
function scaleValue(value: JsonValue | undefined, factor: number): JsonValue | undefined {
  if (typeof value === "number") return value * factor;
  if (
    Array.isArray(value) &&
    value[0] === "interpolate" &&
    value.length >= 5 &&
    typeof value[2] !== "undefined"
  ) {
    return value.map((entry, i) =>
      i >= 4 && i % 2 === 0 && typeof entry === "number" ? entry * factor : entry,
    );
  }
  return value;
}

function calmLayer(layer: StyleLayer): void {
  if (LAYER_HIDE.includes(layer.id)) {
    layer.layout = { ...(layer.layout ?? {}), visibility: "none" };
    return;
  }
  const line = LINE_CALM[layer.id];
  if (line && layer.paint) {
    if (line.width !== undefined && "line-width" in layer.paint) {
      const scaled = scaleValue(layer.paint["line-width"], line.width);
      if (scaled !== undefined) layer.paint["line-width"] = scaled;
    }
    if (line.opacity !== undefined && "line-opacity" in layer.paint) {
      const scaled = scaleValue(layer.paint["line-opacity"], line.opacity);
      if (scaled !== undefined) layer.paint["line-opacity"] = scaled;
    }
  }
  const label = LABEL_CALM[layer.id];
  if (label) {
    if (typeof layer.minzoom !== "number" || layer.minzoom < label.minzoom) {
      layer.minzoom = label.minzoom;
    }
    if (
      label.textScale !== undefined &&
      layer.layout &&
      typeof layer.layout["text-size"] === "number"
    ) {
      layer.layout["text-size"] = layer.layout["text-size"] * label.textScale;
    }
  }
}

/** Cloned calm style; the input is never mutated. */
export function calmDarkStyle(style: StyleSpecification): StyleSpecification {
  const clone = JSON.parse(JSON.stringify(style)) as { layers?: StyleLayer[] };
  for (const layer of clone.layers ?? []) {
    if (layer && typeof layer.id === "string") calmLayer(layer);
  }
  return clone as unknown as StyleSpecification;
}
