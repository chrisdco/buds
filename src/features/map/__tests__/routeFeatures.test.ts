import { buildRouteFeatures, nearestIndex } from "@/features/map/routeFeatures";
import type { RouteResult } from "@/types/contracts";

const route = (coords: [number, number][], source: RouteResult["source"] = "osrm"): RouteResult => ({
  coords,
  distanceM: 1000,
  durationS: 120,
  source,
  fetchedAt: 0,
});

const line: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
];

describe("buildRouteFeatures", () => {
  it("drops hidden routes and keeps tier, color and draw order", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line), b: route(line), c: route(line) },
      tiers: { a: "primary", b: "context", c: "hidden" },
      myUserId: "a",
      colorFor: (u) => `#${u}`,
    });
    expect(fc.features.map((f) => f.properties.userId)).toEqual(["a", "b"]);
    expect(fc.features[0].properties.color).toBe("#a");
    expect(fc.features[0].properties.sortKey).toBeGreaterThan(fc.features[1].properties.sortKey);
  });

  it("offsets visible routes symmetrically so shared roads show side by side", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line), b: route(line), c: route(line) },
      tiers: { a: "secondary", b: "secondary", c: "secondary" },
      myUserId: null,
      colorFor: () => "#fff",
    });
    expect(fc.features.map((f) => f.properties.offset)).toEqual([-1.5, 0, 1.5]);
  });

  it("marks straight-line estimates dashed and late people amber", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line, "straightline") },
      tiers: { a: "primary" },
      myUserId: null,
      colorFor: () => "#fff",
      late: new Set(["a"]),
    });
    expect(fc.features[0].properties).toMatchObject({ dashed: true, late: true, offset: 0 });
  });

  it("trims the travelled part but always keeps a drawable segment", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line) },
      tiers: { a: "primary" },
      myUserId: null,
      colorFor: () => "#fff",
      trimFrom: { a: 3 },
    });
    expect(fc.features[0].geometry.coordinates).toEqual([
      [0, 2],
      [0, 3],
    ]);
  });
});

describe("nearestIndex", () => {
  it("finds the closest vertex", () => {
    expect(nearestIndex(line, 0.1, 1.9)).toBe(2);
  });
});
