import { calmDarkStyle } from "@/services/map/calmDark";

function layer(overrides: Record<string, unknown>) {
  return {
    id: "x",
    type: "line",
    paint: {},
    layout: {},
    ...overrides,
  };
}

describe("calmDarkStyle", () => {
  it("thins and fades minor roads", () => {
    const out = calmDarkStyle({
      version: 8,
      sources: {},
      layers: [
        layer({
          id: "highway_minor",
          paint: { "line-width": 4, "line-opacity": 0.9 },
        }),
      ],
    } as never);
    const paint = out.layers[0] as unknown as { paint: Record<string, number> };
    expect(paint.paint["line-width"]).toBeCloseTo(1.6);
    expect(paint.paint["line-opacity"]).toBeCloseTo(0.405);
  });

  it("scales interpolate outputs, not zoom stops", () => {
    const out = calmDarkStyle({
      version: 8,
      sources: {},
      layers: [
        layer({
          id: "highway_minor",
          paint: {
            "line-width": ["interpolate", ["exponential", 1.55], ["zoom"], 13, 1.8, 20, 20],
          },
        }),
      ],
    } as never);
    const paint = out.layers[0] as unknown as { paint: Record<string, unknown> };
    expect(paint.paint["line-width"]).toEqual([
      "interpolate",
      ["exponential", 1.55],
      ["zoom"],
      13,
      1.8 * 0.4,
      20,
      20 * 0.4,
    ]);
  });

  it("hides the wide glow underlays beneath major roads", () => {
    const out = calmDarkStyle({
      version: 8,
      sources: {},
      layers: [
        layer({ id: "highway_major_subtle", type: "line" }),
        layer({ id: "highway_motorway_subtle", type: "line" }),
        layer({ id: "highway_major_inner", type: "line" }),
      ],
    } as never);
    const [major, motorway, inner] = out.layers as unknown as {
      layout: Record<string, string>;
    }[];
    expect(major.layout.visibility).toBe("none");
    expect(motorway.layout.visibility).toBe("none");
    expect(inner.layout.visibility).toBeUndefined();
  });

  it("defers minor labels and shrinks neighbourhood text", () => {
    const out = calmDarkStyle({
      version: 8,
      sources: {},
      layers: [
        layer({ id: "highway_name_other", type: "symbol" }),
        layer({ id: "place_suburb", type: "symbol", layout: { "text-size": 10 } }),
      ],
    } as never);
    const [road, suburb] = out.layers as unknown as {
      minzoom?: number;
      layout: Record<string, number>;
    }[];
    expect(road.minzoom).toBe(14);
    expect(suburb.minzoom).toBe(14);
    expect(suburb.layout["text-size"]).toBe(9);
  });

  it("never raises an existing higher minzoom and leaves unknown layers alone", () => {
    const motorway = layer({
      id: "highway_name_motorway",
      type: "symbol",
      minzoom: 5,
      layout: { "text-size": 11 },
    });
    const out = calmDarkStyle({
      version: 8,
      sources: {},
      layers: [motorway, layer({ id: "background", type: "background" })],
    } as never);
    const [kept, bg] = out.layers as unknown as {
      minzoom?: number;
      layout: Record<string, number>;
    }[];
    expect(kept.minzoom).toBe(5);
    expect(kept.layout["text-size"]).toBe(11);
    expect(bg).toEqual({ id: "background", type: "background", paint: {}, layout: {} });
  });

  it("does not mutate the input style", () => {
    const input = {
      version: 8,
      sources: {},
      layers: [layer({ id: "highway_minor", paint: { "line-width": 4 } })],
    } as never;
    calmDarkStyle(input);
    const paint = (
      input as unknown as { layers: { paint: Record<string, number> }[] }
    ).layers[0].paint;
    expect(paint["line-width"]).toBe(4);
  });
});
