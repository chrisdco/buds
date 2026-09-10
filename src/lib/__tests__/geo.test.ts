import {
  bearingDeg,
  distToPolylineM,
  formatDistanceM,
  haversineMeters,
  round5,
} from "@/lib/geo";

describe("haversineMeters", () => {
  it("measures ~1112m for 0.01° of latitude", () => {
    const d = haversineMeters(48.2082, 16.3738, 48.2182, 16.3738);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters(10, 10, 10, 10)).toBe(0);
  });
});

describe("bearingDeg", () => {
  it("points north for due-north movement", () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 0);
  });

  it("points east for due-east movement on the equator", () => {
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 0);
  });
});

describe("formatDistanceM", () => {
  it("uses meters under 1km and km above", () => {
    expect(formatDistanceM(420)).toBe("420 m");
    expect(formatDistanceM(4_200)).toBe("4.2 km");
    expect(formatDistanceM(42_000)).toBe("42 km");
  });
});

describe("round5", () => {
  it("rounds to 5 decimals (~1m precision)", () => {
    expect(round5(48.20823456789)).toBe(48.20823);
  });
});

describe("distToPolylineM", () => {
  // Equator: 0.001° lng ≈ 111m.
  const line: [number, number][] = [
    [0, 0],
    [0.01, 0],
  ];

  it("is ~0 for a point on the line", () => {
    expect(distToPolylineM(0, 0.005, line)).toBeLessThan(1);
  });

  it("measures perpendicular distance (~111m for 0.001°)", () => {
    const d = distToPolylineM(0.001, 0.005, line);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it("clamps to endpoints past the ends", () => {
    const d = distToPolylineM(0, 0.02, line);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1130);
  });

  it("returns Infinity for degenerate or malformed input", () => {
    expect(distToPolylineM(0, 0, [])).toBe(Infinity);
    expect(distToPolylineM(0, 0, [[0, 0]])).toBe(Infinity);
    expect(distToPolylineM(NaN, 0, line)).toBe(Infinity);
    expect(
      distToPolylineM(0, 0, [
        [0, 0],
        [NaN, NaN],
      ]),
    ).toBe(Infinity);
  });

  it("agrees with haversine for a mid-segment point", () => {
    const d = distToPolylineM(0.0005, 0.005, line);
    expect(d).toBeCloseTo(haversineMeters(0.0005, 0.005, 0, 0.005), -1);
  });
});
