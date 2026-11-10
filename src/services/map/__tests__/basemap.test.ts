import { MAP_PALETTES, basemapStyle, buildBasemap } from "@/services/map/basemap";
import libertyBase from "@/services/map/libertyBase.json";

type L = {
  id: string;
  type: string;
  minzoom?: number;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
type Scheme = "light" | "dark";

const layers = (scheme: Scheme) => buildBasemap(scheme).layers as unknown as L[];
const byId = (scheme: Scheme, id: string) => {
  const found = layers(scheme).find((l) => l.id === id);
  if (!found) throw new Error(`no layer ${id}`);
  return found;
};
const COLOR_PROPS = ["background-color", "fill-color", "line-color", "text-color"];
const visible = (l: L) => l.layout?.visibility !== "none";

describe("basemap", () => {
  it("never mutates the vendored base", () => {
    const before = JSON.stringify(libertyBase);
    buildBasemap("dark");
    buildBasemap("light");
    expect(JSON.stringify(libertyBase)).toBe(before);
  });

  it.each(["light", "dark"] as const)("paints every visible colored layer from the %s palette", (scheme) => {
    const palette = new Set<string>(Object.values(MAP_PALETTES[scheme]));
    const strays: string[] = [];
    for (const l of layers(scheme).filter(visible)) {
      for (const prop of COLOR_PROPS) {
        const v = l.paint?.[prop];
        if (v === undefined) continue;
        // A Liberty color left on the dark map is the bug this guards.
        if (typeof v !== "string" || !palette.has(v)) strays.push(`${l.id}.${prop}`);
      }
    }
    expect(strays).toEqual([]);
  });

  it("keeps the road hierarchy distinct: motorway, primary, secondary, minor", () => {
    // Fill + casing per class (light streets share white fills, as on
    // Google, and step apart by casing and width).
    for (const scheme of ["light", "dark"] as const) {
      const color = (id: string) => byId(scheme, id).paint?.["line-color"];
      const pair = (cls: string) => `${color(`road_${cls}`)}/${color(`road_${cls}_casing`)}`;
      const set = new Set([pair("motorway"), pair("trunk_primary"), pair("secondary_tertiary"), pair("minor")]);
      expect(set.size).toBe(4);
    }
  });

  it("hides shields and 3D buildings everywhere, light-canvas patterns on dark", () => {
    for (const id of ["highway-shield-non-us", "building-3d", "park_outline"]) {
      expect(visible(byId("light", id))).toBe(false);
      expect(visible(byId("dark", id))).toBe(false);
    }
    expect(visible(byId("dark", "road_area_pattern"))).toBe(false);
    expect(visible(byId("light", "road_area_pattern"))).toBe(true);
  });

  it("defers busy labels", () => {
    expect(byId("dark", "poi_transit").minzoom).toBe(16);
    expect(byId("light", "label_other").minzoom).toBe(13);
  });

  it("memoizes per scheme", () => {
    expect(basemapStyle("dark")).toBe(basemapStyle("dark"));
    expect(basemapStyle("dark")).not.toBe(basemapStyle("light"));
  });
});
