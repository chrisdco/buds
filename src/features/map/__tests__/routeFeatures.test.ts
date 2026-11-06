import {
  buildRouteFeatures,
  buildRouteLabels,
  colorsClash,
  midpointByDistance,
  nearestIndex,
  splitFinalLeg,
  type RouteFeatureCollection,
} from "@/features/map/routeFeatures";
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

const mains = (fc: RouteFeatureCollection) => fc.features.filter((f) => f.properties.leg === "main");

describe("buildRouteFeatures", () => {
  it("drops hidden routes and keeps tier, color and draw order", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line), b: route(line), c: route(line) },
      tiers: { a: "primary", b: "context", c: "hidden" },
      myUserId: "a",
      colorFor: (u) => `#${u}`,
    });
    const m = mains(fc);
    expect(m.map((f) => f.properties.userId)).toEqual(["a", "b"]);
    expect(m[0].properties.color).toBe("#a");
    expect(m[0].properties.sortKey).toBeGreaterThan(m[1].properties.sortKey);
  });

  it("offsets visible routes symmetrically so shared roads show side by side", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line), b: route(line), c: route(line) },
      tiers: { a: "secondary", b: "secondary", c: "secondary" },
      myUserId: null,
      colorFor: () => "#fff",
    });
    expect(mains(fc).map((f) => f.properties.offset)).toEqual([-1.5, 0, 1.5]);
    // Chevrons follow the lane: offset in icon units (icon-size 0.5).
    expect(mains(fc).map((f) => f.properties.chevronOffset)).toEqual([
      [0, -3],
      [0, 0],
      [0, 3],
    ]);
  });

  it("marks straight-line estimates dashed and late people amber", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line, "straightline") },
      tiers: { a: "primary" },
      myUserId: null,
      colorFor: () => "#fff",
      late: new Set(["a"]),
    });
    // Estimates stay one dashed feature: no dotted final leg.
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toMatchObject({ dashed: true, late: true, offset: 0, leg: "main" });
  });

  it("trims the travelled part but always keeps a drawable segment", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line) },
      tiers: { a: "primary" },
      myUserId: null,
      colorFor: () => "#fff",
      trimFrom: { a: 3 },
    });
    const [main, final] = fc.features;
    expect(main.geometry.coordinates[0]).toEqual([0, 2]);
    expect(final.properties.leg).toBe("final");
    expect(final.geometry.coordinates.at(-1)).toEqual([0, 3]);
  });

  it("gives a second route of the same color the dash-dot style", () => {
    const fc = buildRouteFeatures({
      routes: { a: route(line), b: route(line), c: route(line) },
      tiers: { a: "secondary", b: "secondary", c: "secondary" },
      myUserId: null,
      colorFor: (u) => (u === "c" ? "#00ff00" : "#ff0000"),
    });
    expect(mains(fc).map((f) => f.properties.altDash)).toEqual([false, true, false]);
  });
});

describe("splitFinalLeg", () => {
  // ~111 m per 0.001 deg of latitude.
  const short: [number, number][] = [
    [0, 0],
    [0, 0.001],
    [0, 0.002],
    [0, 0.003],
  ];

  it("cuts the last 200 m off at an interpolated point", () => {
    const { main, final } = splitFinalLeg(short, 200);
    expect(main).not.toBeNull();
    expect(main!.at(-1)).toEqual(final[0]);
    expect(final.at(-1)).toEqual([0, 0.003]);
    // the cut lands 200 m before the end: 333 m - 200 m = ~133 m in
    expect(final[0][1]).toBeCloseTo(0.0012, 4);
  });

  it("treats a route shorter than the final leg as all final", () => {
    const { main, final } = splitFinalLeg(short.slice(0, 2), 200);
    expect(main).toBeNull();
    expect(final).toHaveLength(2);
  });
});

describe("colorsClash", () => {
  it("flags equal and near colors, not distinct ones", () => {
    expect(colorsClash("#FF0000", "#ff0000")).toBe(true);
    expect(colorsClash("#ff0000", "#f01010")).toBe(true);
    expect(colorsClash("#ff0000", "#00ff00")).toBe(false);
  });
});

describe("route time bubbles", () => {
  it("places one label mid-route for primary routes only", () => {
    const fc = buildRouteLabels({
      routes: { a: route(line), b: route(line) },
      tiers: { a: "primary", b: "secondary" },
      etaByUser: { a: 1080, b: 600 },
      colorFor: () => "#123456",
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toEqual({ userId: "a", color: "#123456", label: "18 min" });
    expect(fc.features[0].geometry.coordinates[1]).toBeCloseTo(1.5, 5);
  });

  it("finds the midpoint by distance, not by vertex count", () => {
    const uneven: [number, number][] = [
      [0, 0],
      [0, 0.1],
      [0, 0.2],
      [0, 1],
    ];
    expect(midpointByDistance(uneven)![1]).toBeCloseTo(0.5, 5);
  });
});

describe("nearestIndex", () => {
  it("finds the closest vertex", () => {
    expect(nearestIndex(line, 0.1, 1.9)).toBe(2);
  });
});
