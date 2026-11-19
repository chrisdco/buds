import { SNAP_M, glideMs, lerpLngLat, placeOnRoute } from "../glide";
import { haversineMeters, nearestOnPolyline } from "@/lib/geo";

jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));

// A straight east-west road through Bengaluru.
const ROAD: [number, number][] = [
  [77.59, 12.97],
  [77.6, 12.97],
];

describe("nearestOnPolyline", () => {
  it("projects onto the segment and reports the gap", () => {
    const near = nearestOnPolyline(12.9701, 77.595, ROAD)!;
    expect(near.lat).toBeCloseTo(12.97, 6);
    expect(near.lng).toBeCloseTo(77.595, 6);
    expect(near.distM).toBeGreaterThan(10);
    expect(near.distM).toBeLessThan(12);
  });

  it("clamps to the nearest end past the line", () => {
    const near = nearestOnPolyline(12.97, 77.61, ROAD)!;
    expect(near.lng).toBeCloseTo(77.6, 6);
  });

  it("is null without a usable line", () => {
    expect(nearestOnPolyline(12.97, 77.59, [])).toBeNull();
    expect(nearestOnPolyline(Number.NaN, 77.59, ROAD)).toBeNull();
  });
});

describe("placeOnRoute", () => {
  it("snaps GPS drift onto the road", () => {
    const [lng, lat] = placeOnRoute(12.9701, 77.595, 8, ROAD);
    expect(lat).toBeCloseTo(12.97, 6);
    expect(lng).toBeCloseTo(77.595, 6);
  });

  it("leaves someone who really left the road where they are", () => {
    // ~55 m north: past SNAP_M.
    const p = placeOnRoute(12.9705, 77.595, 8, ROAD);
    expect(haversineMeters(p[1], p[0], 12.9705, 77.595)).toBe(0);
    expect(SNAP_M).toBeLessThan(55);
  });

  it("does not snap a vague fix or without a route", () => {
    expect(placeOnRoute(12.9701, 77.595, 100, ROAD)).toEqual([77.595, 12.9701]);
    expect(placeOnRoute(12.9701, 77.595, 8, undefined)).toEqual([77.595, 12.9701]);
  });
});

describe("glide timing", () => {
  it("glides over the gap between fixes, within bounds", () => {
    expect(glideMs(null, 1000)).toBe(0);
    expect(glideMs(0, 2500)).toBe(2500);
    expect(glideMs(0, 50)).toBe(300);
    expect(glideMs(0, 60_000)).toBe(3000);
  });

  it("interpolates linearly", () => {
    expect(lerpLngLat([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });
});
