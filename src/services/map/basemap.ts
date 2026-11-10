import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

import libertyBase from "@/services/map/libertyBase.json";

// Buds basemap: OpenFreeMap's Liberty layer stack (vendored in
// libertyBase.json, so the style needs no network round trip) repainted
// with our own palette per scheme. Liberty keeps every road class, landuse
// and label as its own layer; we only change colors and a few zoom gates.
// The hierarchy is the Google / Uber one: highways warm and widest,
// arterials a step lighter, streets plain, parks green, water blue,
// buildings a quiet step off the land. Pure: no native imports, unit-tested.

export type MapScheme = "light" | "dark";

export interface MapPalette {
  land: string;
  residential: string;
  park: string;
  wood: string;
  grass: string;
  ice: string;
  sand: string;
  hospital: string;
  school: string;
  water: string;
  aeroway: string;
  runway: string;
  building: string;
  buildingOutline: string;
  minor: string;
  minorCasing: string;
  path: string;
  secondary: string;
  secondaryCasing: string;
  primary: string;
  primaryCasing: string;
  motorway: string;
  motorwayCasing: string;
  rail: string;
  boundary: string;
  roadLabel: string;
  poiLabel: string;
  transitLabel: string;
  waterLabel: string;
  placeLabel: string;
  placeMajor: string;
  halo: string;
}

export const MAP_PALETTES: Record<MapScheme, MapPalette> = {
  light: {
    land: "#F4F3F0",
    residential: "#EEEDE9",
    park: "#CDEACB",
    wood: "#C3E3BF",
    grass: "#D7EDD0",
    ice: "#F1F6F8",
    sand: "#F3EBD3",
    hospital: "#F7E3E3",
    school: "#F3EFDA",
    water: "#A8D2F5",
    aeroway: "#E7E5EE",
    runway: "#FFFFFF",
    building: "#E6E4E0",
    buildingOutline: "#D9D6D1",
    minor: "#FFFFFF",
    minorCasing: "#DDDAD5",
    path: "#D3CFC8",
    secondary: "#FFFFFF",
    secondaryCasing: "#D0CCC5",
    primary: "#FFF1BF",
    primaryCasing: "#E6C978",
    motorway: "#FCD27E",
    motorwayCasing: "#DDA449",
    rail: "#C4C1BC",
    boundary: "#A9A6B0",
    roadLabel: "#5F6368",
    poiLabel: "#6B6F76",
    transitLabel: "#2F6AA6",
    waterLabel: "#3B72A8",
    placeLabel: "#3C4043",
    placeMajor: "#1F2124",
    halo: "#FFFFFF",
  },
  dark: {
    land: "#1A1C20",
    residential: "#1D2024",
    park: "#1C3125",
    wood: "#1B2E23",
    grass: "#1D2C23",
    ice: "#22262B",
    sand: "#282620",
    hospital: "#2B1F23",
    school: "#29271F",
    water: "#13293F",
    aeroway: "#23252B",
    runway: "#33363D",
    building: "#23262B",
    buildingOutline: "#2B2F35",
    minor: "#2C3038",
    minorCasing: "#1F2226",
    path: "#353940",
    secondary: "#373C45",
    secondaryCasing: "#272A30",
    primary: "#555D6A",
    primaryCasing: "#363C45",
    motorway: "#7A6544",
    motorwayCasing: "#4A3F2E",
    rail: "#3A3E45",
    boundary: "#4C5058",
    roadLabel: "#8E97A3",
    poiLabel: "#8E97A3",
    transitLabel: "#6E9BC9",
    waterLabel: "#5F87AF",
    placeLabel: "#B5BDC8",
    placeMajor: "#E3E7EC",
    halo: "#14161A",
  },
};

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Layer {
  id: string;
  type: string;
  minzoom?: number;
  paint?: Record<string, Json>;
  layout?: Record<string, Json>;
}

type ColorKey = keyof MapPalette;

/** Layers left out of the picture in both schemes. */
const HIDE = new Set([
  "park_outline",
  "building-3d", // flat footprints read cleaner under live markers
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
]);

/** Pattern fills drawn for a light canvas; noise on dark. */
const HIDE_DARK = new Set(["landcover_wetland", "road_area_pattern"]);

/** Labels deferred so the overview stays calm (min zoom). */
const DEFER: Record<string, number> = {
  label_other: 13,
  "highway-name-minor": 15.5,
  "highway-name-path": 16.5,
  poi_r1: 15.5,
  poi_transit: 16,
  poi_r7: 16.5,
  poi_r20: 17.5,
  road_one_way_arrow: 17,
  road_one_way_arrow_opposite: 17,
};

const FILL: Record<string, ColorKey> = {
  background: "land",
  park: "park",
  landuse_residential: "residential",
  landcover_wood: "wood",
  landcover_grass: "grass",
  landcover_ice: "ice",
  landcover_wetland: "grass",
  landuse_pitch: "grass",
  landuse_track: "grass",
  landuse_cemetery: "grass",
  landuse_hospital: "hospital",
  landuse_school: "school",
  water: "water",
  landcover_sand: "sand",
  aeroway_fill: "aeroway",
  building: "building",
};

/** Road role from a transportation layer id (tunnel_/road_/bridge_ x class). */
function roadRole(id: string): { fill: ColorKey; casing: ColorKey } | null {
  if (/motorway/.test(id)) return { fill: "motorway", casing: "motorwayCasing" };
  if (/trunk_primary/.test(id)) return { fill: "primary", casing: "primaryCasing" };
  if (/secondary_tertiary|_link/.test(id)) return { fill: "secondary", casing: "secondaryCasing" };
  if (/minor|street|service_track/.test(id)) return { fill: "minor", casing: "minorCasing" };
  if (/path_pedestrian/.test(id)) return { fill: "path", casing: "minorCasing" };
  if (/rail/.test(id)) return { fill: "rail", casing: "rail" };
  return null;
}

function lineColor(id: string): ColorKey | null {
  if (id.startsWith("waterway")) return "water";
  if (id === "aeroway_runway" || id === "aeroway_taxiway") return "runway";
  if (id.startsWith("boundary")) return "boundary";
  const road = roadRole(id);
  if (!road) return null;
  return id.endsWith("_casing") ? road.casing : road.fill;
}

function textColor(id: string): ColorKey | null {
  if (id.startsWith("water")) return "waterLabel";
  if (id === "poi_transit") return "transitLabel";
  if (id.startsWith("poi") || id === "airport") return "poiLabel";
  if (id.startsWith("highway-name")) return "roadLabel";
  if (/^label_(city|town|country)/.test(id)) return "placeMajor";
  if (id.startsWith("label_")) return "placeLabel";
  return null;
}

function paintLayer(layer: Layer, p: MapPalette, scheme: MapScheme): void {
  const hidden = HIDE.has(layer.id) || (scheme === "dark" && HIDE_DARK.has(layer.id));
  if (hidden) {
    layer.layout = { ...(layer.layout ?? {}), visibility: "none" };
    return;
  }
  const defer = DEFER[layer.id];
  if (defer !== undefined && (layer.minzoom ?? 0) < defer) layer.minzoom = defer;

  const paint = (layer.paint ??= {});
  if (layer.type === "background") {
    paint["background-color"] = p.land;
  } else if (layer.type === "fill") {
    const key = FILL[layer.id];
    if (key && !("fill-pattern" in paint)) {
      paint["fill-color"] = p[key];
      paint["fill-opacity"] = 1;
    }
    if (layer.id === "building") paint["fill-outline-color"] = p.buildingOutline;
    else delete paint["fill-outline-color"];
  } else if (layer.type === "line") {
    const key = lineColor(layer.id);
    if (key) paint["line-color"] = p[key];
    // Tunnels sit under the street grid: same hue, faded.
    if (layer.id.startsWith("tunnel_")) paint["line-opacity"] = 0.45;
  } else if (layer.type === "symbol") {
    const key = textColor(layer.id);
    if (key) {
      paint["text-color"] = p[key];
      paint["text-halo-color"] = p.halo;
      paint["text-halo-width"] = 1.2;
      paint["text-halo-blur"] = 0.4;
    }
    // Sprite icons are drawn for a light canvas; mute them on dark.
    if (scheme === "dark" && layer.layout && "icon-image" in layer.layout) {
      paint["icon-opacity"] = 0.7;
    }
  }
}

/** The full basemap for a scheme. Never mutates the vendored base. */
export function buildBasemap(scheme: MapScheme, base: unknown = libertyBase): StyleSpecification {
  const style = JSON.parse(JSON.stringify(base)) as { layers: Layer[] };
  const palette = MAP_PALETTES[scheme];
  for (const layer of style.layers) paintLayer(layer, palette, scheme);
  return style as unknown as StyleSpecification;
}

const cache: Partial<Record<MapScheme, StyleSpecification>> = {};

/** Memoized per scheme: MapLibre diffs styles by identity. */
export function basemapStyle(scheme: MapScheme): StyleSpecification {
  return (cache[scheme] ??= buildBasemap(scheme));
}
