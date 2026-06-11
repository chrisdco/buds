import { bearingDeg, formatDistanceM, haversineMeters, round5 } from "@/lib/geo";

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
