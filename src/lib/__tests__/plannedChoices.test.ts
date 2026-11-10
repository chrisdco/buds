import { dayChoices, dayStart, MIN_LEAD_MS, timeChoices } from "@/lib/planned";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("custom when choices", () => {
  const now = new Date("2026-10-01T18:10:00").getTime();

  it("offers today's remaining half hours, at least the lead time out", () => {
    const today = timeChoices(dayStart(now), now);
    expect(today[0].atMs).toBe(new Date("2026-10-01T18:30:00").getTime());
    expect(today[today.length - 1].atMs).toBe(new Date("2026-10-01T23:30:00").getTime());
    expect(today.every((t) => t.atMs >= now + MIN_LEAD_MS)).toBe(true);
  });

  it("offers a full day tomorrow", () => {
    expect(timeChoices(dayStart(now + 86_400_000), now)).toHaveLength(48);
  });

  it("labels days Today / Tomorrow, then by date, and spans the 30-day window", () => {
    const days = dayChoices(now);
    expect(days[0].label).toBe("Today");
    expect(days[1].label).toBe("Tomorrow");
    expect(days[2].label).not.toMatch(/Today|Tomorrow/);
    expect(days.length).toBeGreaterThanOrEqual(30);
    expect(days.length).toBeLessThanOrEqual(31);
  });

  it("drops today once no slot is left", () => {
    const late = new Date("2026-10-01T23:50:00").getTime();
    expect(dayChoices(late)[0].label).toBe("Tomorrow");
  });
});
