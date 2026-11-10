import { guidance, guidanceDistance, remainingLine, stepText } from "@/features/guidance/guidance";
import type { RouteResult } from "@/types/contracts";

// An L-shaped route at the equator: ~1.11 km east, then ~1.11 km north.
const route: RouteResult = {
  coords: [
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
  ],
  distanceM: 2224,
  durationS: 400,
  source: "osrm",
  fetchedAt: 0,
  steps: [
    { type: "depart", name: "First Ave", location: [0, 0] },
    { type: "turn", modifier: "left", name: "Second St", location: [0.01, 0] },
    { type: "arrive", name: "", location: [0.01, 0.01] },
  ],
};

describe("guidance", () => {
  it("points at the next turn with the distance along the road", () => {
    const g = guidance(route, { lat: 0, lng: 0.005 });
    expect(g.step?.type).toBe("turn");
    expect(g.toStepM).toBeGreaterThan(540);
    expect(g.toStepM).toBeLessThan(575);
    expect(g.remainingM).toBeGreaterThan(1640);
    expect(g.remainingM).toBeLessThan(1700);
    expect(g.remainingS).toBeCloseTo(300, -1);
    expect(g.offRouteM).toBeLessThan(1);
    expect(g.bearing).toBeCloseTo(90, 0);
  });

  it("moves on to arrive after the turn and faces north", () => {
    const g = guidance(route, { lat: 0.004, lng: 0.01 });
    expect(g.step?.type).toBe("arrive");
    expect(g.bearing).toBeCloseTo(0, 0);
  });

  it("reports how far off the line you are", () => {
    const g = guidance(route, { lat: 0.001, lng: 0.005 });
    expect(g.offRouteM).toBeGreaterThan(100);
    expect(g.offRouteM).toBeLessThan(120);
  });

  it("works without steps", () => {
    const g = guidance({ ...route, steps: undefined }, { lat: 0, lng: 0.005 });
    expect(g.step).toBeNull();
    expect(g.toStepM).toBeNull();
  });
});

describe("stepText", () => {
  it("words maneuvers like a nav app", () => {
    expect(stepText({ type: "turn", modifier: "left", name: "Main St", location: [0, 0] })).toBe(
      "Turn left onto Main St",
    );
    expect(stepText({ type: "turn", modifier: "slight right", name: "", location: [0, 0] })).toBe("Turn slight right");
    expect(stepText({ type: "fork", modifier: "slight left", name: "A1", location: [0, 0] })).toBe("Keep left onto A1");
    expect(stepText({ type: "turn", modifier: "uturn", name: "", location: [0, 0] })).toBe("Make a U-turn");
    expect(stepText({ type: "arrive", name: "", location: [0, 0] })).toBe("Arrive");
  });
});

describe("guidanceDistance", () => {
  it("rounds like a nav app", () => {
    expect(guidanceDistance(234, "km")).toBe("230 m");
    expect(guidanceDistance(3, "km")).toBe("10 m");
    expect(guidanceDistance(2345, "km")).toBe("2.3 km");
    expect(guidanceDistance(100, "mi")).toBe("350 ft");
    expect(guidanceDistance(3219, "mi")).toBe("2.0 mi");
  });
});

describe("remainingLine", () => {
  it("starts at your snapped point and keeps what's ahead", () => {
    const line = remainingLine(route.coords, { lat: 0.0001, lng: 0.005 });
    expect(line[0][0]).toBeCloseTo(0.005, 6);
    expect(line[0][1]).toBeCloseTo(0, 6);
    expect(line.slice(1)).toEqual([
      [0.01, 0],
      [0.01, 0.01],
    ]);
  });
});
