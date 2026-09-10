import { alertCategory } from "@/events/notifyPrefs";

describe("alertCategory", () => {
  it("maps engine and broadcast ids to user-facing categories", () => {
    expect(alertCategory("arrive:abc")).toBe("arrivals");
    expect(alertCategory("sep:self")).toBe("separation");
    expect(alertCategory("sep:xyz")).toBe("separation");
    expect(alertCategory("breakaway:self")).toBe("separation");
    expect(alertCategory("evt-dev-abc-123")).toBe("detours");
    expect(alertCategory("evt-rejoin-abc-123")).toBe("reconnections");
  });

  it("falls back to other for internal ids", () => {
    expect(alertCategory("dest-err")).toBe("other");
    expect(alertCategory("checkin-err")).toBe("other");
    expect(alertCategory("")).toBe("other");
  });
});
