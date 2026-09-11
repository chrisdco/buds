import { TRIP_PRESETS, parseCreateParams, presetCreateParams } from "@/lib/tripPresets";

describe("presetCreateParams", () => {
  it("serializes mode, limit, duration, and a prefilled name", () => {
    const preset = TRIP_PRESETS.find((p) => p.id === "meet-up")!;
    expect(presetCreateParams(preset, "Chris")).toEqual({
      preset: "meet-up",
      mode: "converge",
      limit: "10",
      duration: "12",
      name: "Chris's meetup",
    });
  });

  it("falls back to a neutral name without a display name", () => {
    const preset = TRIP_PRESETS.find((p) => p.id === "follow-leader")!;
    expect(presetCreateParams(preset, "  ").name).toBe("Our convoy");
  });

  it("keeps experimental modes off the cards", () => {
    expect(TRIP_PRESETS.map((p) => p.mode)).toEqual(["converge", "leader", "formation"]);
  });
});

describe("parseCreateParams", () => {
  it("accepts a full valid set", () => {
    expect(
      parseCreateParams({ mode: "leader", limit: "6", duration: "4", name: "Night ride" }),
    ).toEqual({ mode: "leader", limit: 6, durationHours: 4, name: "Night ride" });
  });

  it("falls back field-by-field on garbage", () => {
    expect(
      parseCreateParams({ mode: "rocket", limit: "99", duration: "forever", name: "  " }),
    ).toEqual({ mode: "converge", limit: 10, durationHours: 12, name: undefined });
  });

  it("maps none to no-limit and caps names at 60", () => {
    expect(parseCreateParams({ duration: "none", name: "x".repeat(100) }).durationHours).toBeNull();
    expect(parseCreateParams({ name: "x".repeat(100) }).name).toHaveLength(60);
  });
});
