import { clearRouteCache, fetchRoute, straightLineRoute } from "@/services/routing/router";
import type { RouteFetcher } from "@/services/routing/types";

const A = { lat: 48.2, lng: 16.37 };
const B = { lat: 48.21, lng: 16.38 };

const ok =
  (tag: number): RouteFetcher =>
  async () => ({
    coords: [
      [16.37, 48.2],
      [16.38, 48.21],
    ],
    distanceM: tag,
    durationS: 60,
  });

const fail: RouteFetcher = async () => {
  throw new Error("provider down");
};

describe("fetchRoute chain", () => {
  beforeEach(() => clearRouteCache());

  it("uses ORS first when a key is configured", async () => {
    const route = await fetchRoute(A, B, { hasOrsKey: true, ors: ok(1), osrm: ok(2) });
    expect(route.source).toBe("ors");
    expect(route.distanceM).toBe(1);
  });

  it("falls back to OSRM when ORS fails", async () => {
    const route = await fetchRoute(A, B, { hasOrsKey: true, ors: fail, osrm: ok(2) });
    expect(route.source).toBe("osrm");
  });

  it("skips ORS entirely without a key", async () => {
    const orsSpy = jest.fn(ok(1));
    const route = await fetchRoute(A, B, { hasOrsKey: false, ors: orsSpy, osrm: ok(2) });
    expect(route.source).toBe("osrm");
    expect(orsSpy).not.toHaveBeenCalled();
  });

  it("never rejects: straight-line estimate when everything fails", async () => {
    const route = await fetchRoute(A, B, { hasOrsKey: true, ors: fail, osrm: fail });
    expect(route.source).toBe("straightline");
    expect(route.coords).toHaveLength(2);
    expect(route.durationS).toBeCloseTo(route.distanceM / 11, 5);
  });

  it("treats malformed provider payloads as failures and falls through", async () => {
    const malformed: RouteFetcher = async () => ({
      coords: [],
      distanceM: Number.NaN,
      durationS: Number.NaN,
    });
    const route = await fetchRoute(A, B, { hasOrsKey: false, osrm: malformed });
    expect(route.source).toBe("straightline");
    expect(route.coords).toHaveLength(2);
  });
});

describe("fetchRoute O/D cache", () => {
  beforeEach(() => clearRouteCache());

  it("shares one fetch across identical origin/destination pairs", async () => {
    const osrm = jest.fn(ok(2));
    const first = await fetchRoute(A, B, { hasOrsKey: false, osrm });
    const second = await fetchRoute(A, B, { hasOrsKey: false, osrm });
    expect(osrm).toHaveBeenCalledTimes(1);
    expect(second.distanceM).toBe(first.distanceM);
    expect(second.source).toBe("osrm");
  });

  it("rounds near-identical endpoints onto one key", async () => {
    const osrm = jest.fn(ok(2));
    await fetchRoute(A, B, { hasOrsKey: false, osrm });
    // ~0.5m away: same rounded key, no second fetch.
    await fetchRoute(
      { lat: 48.200004, lng: 16.370004 },
      { lat: 48.210004, lng: 16.380004 },
      { hasOrsKey: false, osrm },
    );
    expect(osrm).toHaveBeenCalledTimes(1);
    // A real move refetches.
    await fetchRoute({ lat: 48.25, lng: 16.4 }, B, { hasOrsKey: false, osrm });
    expect(osrm).toHaveBeenCalledTimes(2);
  });

  it("caches straight-line fallbacks to cap retry storms", async () => {
    const osrm = jest.fn(fail);
    const first = await fetchRoute(A, B, { hasOrsKey: false, osrm });
    const second = await fetchRoute(A, B, { hasOrsKey: false, osrm });
    expect(first.source).toBe("straightline");
    expect(second.source).toBe("straightline");
    expect(osrm).toHaveBeenCalledTimes(1);
  });
});

describe("straightLineRoute", () => {
  it("estimates distance and duration from haversine", () => {
    const route = straightLineRoute(A, B);
    expect(route.distanceM).toBeGreaterThan(1_000);
    expect(route.distanceM).toBeLessThan(1_600);
    expect(route.source).toBe("straightline");
  });
});
