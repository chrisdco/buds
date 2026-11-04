import { TRIP_IDEAS, ideaCreateParams } from "@/features/home/tripIdeas";
import { parseCreateParams } from "@/lib/tripPresets";

describe("trip ideas", () => {
  it.each(TRIP_IDEAS.map((i) => [i.id, i] as const))("%s survives /create param parsing", (_id, idea) => {
    const parsed = parseCreateParams(ideaCreateParams(idea, "Chris"));
    expect(parsed.mode).toBe(idea.mode);
    expect(parsed.durationHours).toBe(idea.durationHours);
    expect(parsed.name).toBe(idea.nameFor("Chris"));
  });

  it("names rooms without a display name", () => {
    for (const idea of TRIP_IDEAS) {
      expect(parseCreateParams(ideaCreateParams(idea, "  ")).name).toBe(idea.nameFor(""));
    }
  });

  it("has unique ids (testIDs)", () => {
    expect(new Set(TRIP_IDEAS.map((i) => i.id)).size).toBe(TRIP_IDEAS.length);
  });
});
