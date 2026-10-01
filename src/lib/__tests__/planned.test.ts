import { countdownLabel, timeSlots } from "@/lib/planned";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("timeSlots", () => {
  it("returns four strictly-future slots", () => {
    const now = new Date("2026-10-01T10:00:00").getTime();
    const slots = timeSlots(now);
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.id)).toEqual(["1h", "3h", "tomorrow-am", "tomorrow-pm"]);
    for (const s of slots) expect(s.atMs).toBeGreaterThan(now);
  });

  it("rolls morning slots past their time to tomorrow", () => {
    const morning = new Date("2026-10-01T09:00:00").getTime();
    const am = timeSlots(morning).find((s) => s.id === "tomorrow-am")!;
    expect(am.label).toBe("Tomorrow 8 AM");
    expect(new Date(am.atMs).getDate()).toBe(2);
  });
});

describe("countdownLabel", () => {
  it("counts minutes, hours, then clock time", () => {
    const now = new Date("2026-10-01T10:00:00").getTime();
    expect(countdownLabel(now + 45 * 60_000, now)).toBe("In 45m");
    expect(countdownLabel(now + 3 * 3_600_000, now)).toBe("In 3h");
    expect(countdownLabel(now - 1000, now)).toBe("Due now");
  });
});
