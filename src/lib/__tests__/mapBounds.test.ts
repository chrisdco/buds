import { boundsOf, collectFitPoints } from "@/lib/mapBounds";

describe("collectFitPoints", () => {
  it("returns empty for an empty scene", () => {
    expect(collectFitPoints({ members: [] })).toEqual([]);
  });

  it("frames members + destination", () => {
    expect(
      collectFitPoints({
        members: [{ lng: 16.37, lat: 48.2 }],
        dest: { lng: 16.4, lat: 48.22 },
      }),
    ).toEqual([
      [16.37, 48.2],
      [16.4, 48.22],
    ]);
  });

  it("pulls the frame out to a detouring route leg", () => {
    const points = collectFitPoints({
      members: [{ lng: 16.37, lat: 48.2 }],
      dest: { lng: 16.38, lat: 48.21 },
      routeLines: [
        [
          [16.37, 48.2],
          [16.5, 48.3],
          [16.38, 48.21],
        ],
      ],
    });
    expect(boundsOf(points)).toEqual([16.37, 48.2, 16.5, 48.3]);
  });
});

describe("boundsOf", () => {
  it("returns null with no points", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("collapses to a point for a single position", () => {
    expect(boundsOf([[16.37, 48.2]])).toEqual([16.37, 48.2, 16.37, 48.2]);
  });
});
