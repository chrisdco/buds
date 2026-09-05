import { fetchRoute, straightLineRoute } from "@/services/routing/router";
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

describe("straightLineRoute", () => {
  it("estimates distance and duration from haversine", () => {
    const route = straightLineRoute(A, B);
    expect(route.distanceM).toBeGreaterThan(1_000);
    expect(route.distanceM).toBeLessThan(1_600);
    expect(route.source).toBe("straightline");
  });
});
