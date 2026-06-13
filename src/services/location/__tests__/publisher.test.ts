import { buildTick, toFix, type RawLocation } from "@/services/location/tick";

function raw(partial: Partial<RawLocation["coords"]> & { timestamp?: number }): RawLocation {
  const { timestamp, ...coords } = partial;
  return {
    coords: {
      latitude: 48.2,
      longitude: 16.37,
      accuracy: 8,
      heading: 90,
      speed: 5,
      ...coords,
    },
    timestamp: timestamp ?? 1_000,
  };
}

describe("toFix", () => {
  it("maps a normal reading", () => {
    const fix = toFix(raw({}));
    expect(fix).toEqual({
      lat: 48.2,
      lng: 16.37,
      accuracy: 8,
      heading: 90,
      speed: 5,
      atMs: 1_000,
    });
  });

  it("drops negative heading/speed (the GPS 'unknown' sentinel)", () => {
    const fix = toFix(raw({ heading: -1, speed: -1 }));
    expect(fix.heading).toBeUndefined();
    expect(fix.speed).toBeUndefined();
  });

  it("treats null accuracy/heading/speed as undefined", () => {
    const fix = toFix(raw({ accuracy: null, heading: null, speed: null }));
    expect(fix.accuracy).toBeUndefined();
    expect(fix.heading).toBeUndefined();
    expect(fix.speed).toBeUndefined();
  });
});

describe("buildTick", () => {
  const fix = { lat: 48.208234, lng: 16.373812, accuracy: 7.6, heading: 92.4, speed: 4.27, atMs: 5 };

  it("rounds coordinates to 5 decimals and compacts the payload", () => {
    const tick = buildTick("user-1", fix, true, 999);
    expect(tick).toEqual({
      u: "user-1",
      t: 999,
      la: 48.20823,
      ln: 16.37381,
      h: 92,
      s: 4.3,
      a: 8,
      st: "mv",
    });
  });

  it("marks stationary ticks and omits absent fields", () => {
    const tick = buildTick("user-1", { lat: 1, lng: 2, atMs: 0 }, false, 10);
    expect(tick.st).toBe("st");
    expect(tick.h).toBeUndefined();
    expect(tick.s).toBeUndefined();
    expect(tick.a).toBeUndefined();
  });
});
