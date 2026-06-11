import { createJitterFilter, type Fix } from "@/services/location/jitterFilter";

function fix(partial: Partial<Fix>): Fix {
  return { lat: 48.2, lng: 16.37, accuracy: 10, atMs: 0, ...partial };
}

describe("createJitterFilter", () => {
  it("accepts a normal sequence", () => {
    const filter = createJitterFilter();
    expect(filter(fix({ atMs: 0 }))).not.toBeNull();
    expect(filter(fix({ lat: 48.2001, atMs: 2000 }))).not.toBeNull();
  });

  it("rejects fixes with poor accuracy", () => {
    const filter = createJitterFilter();
    expect(filter(fix({ accuracy: 150 }))).toBeNull();
  });

  it("rejects GPS teleports (implied speed > 70 m/s)", () => {
    const filter = createJitterFilter();
    filter(fix({ atMs: 0 }));
    // ~1.1km in one second
    expect(filter(fix({ lat: 48.21, atMs: 1000 }))).toBeNull();
  });

  it("rejects out-of-order timestamps", () => {
    const filter = createJitterFilter();
    filter(fix({ atMs: 5000 }));
    expect(filter(fix({ atMs: 4000 }))).toBeNull();
  });
});
