import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  addPlannedTrip,
  countdownLabel,
  planTimeError,
  timeSlots,
  whenLabel,
  type PlannedTrip,
} from "@/lib/planned";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("timeSlots", () => {
  it("offers soon, tonight, morning and weekend on a weekday morning", () => {
    const now = new Date("2026-10-01T10:00:00").getTime(); // Thursday
    const slots = timeSlots(now);
    expect(slots.map((s) => s.id)).toEqual(["30m", "1h", "tonight", "morning", "weekend"]);
    for (const s of slots) expect(s.atMs).toBeGreaterThan(now);
    expect(new Date(slots.find((s) => s.id === "weekend")!.atMs).getDay()).toBe(6);
  });

  it("drops tonight once evening is near and skips weekend on weekends", () => {
    const satEvening = new Date("2026-10-03T18:30:00").getTime();
    expect(timeSlots(satEvening).map((s) => s.id)).toEqual(["30m", "1h", "morning"]);
  });
});

describe("whenLabel / planTimeError", () => {
  const now = new Date("2026-10-01T10:00:00").getTime();

  it("labels by calendar day, then by date", () => {
    expect(whenLabel(new Date("2026-10-02T09:00:00").getTime(), now)).toMatch(/^Tomorrow /);
    expect(whenLabel(new Date("2026-10-05T09:00:00").getTime(), now)).toMatch(/Oct/);
  });

  it("rejects too soon and too far, accepts in between", () => {
    expect(planTimeError(now + 60_000, now)).toMatch(/5 minutes/);
    expect(planTimeError(now + 40 * 86_400_000, now)).toMatch(/30 days/);
    expect(planTimeError(now + 3_600_000, now)).toBeNull();
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

describe("slot day labels", () => {
  it("labels the morning slot by calendar day", () => {
    expect(timeSlots(new Date("2026-10-01T21:00:00").getTime()).find((s) => s.id === "morning")!.label).toBe(
      "Tomorrow 9 AM",
    );
    expect(timeSlots(new Date("2026-10-01T06:00:00").getTime()).find((s) => s.id === "morning")!.label).toBe(
      "Today 9 AM",
    );
  });

  it("names the day on far countdowns", () => {
    const now = new Date("2026-10-01T10:00:00").getTime();
    const tomorrow = new Date("2026-10-02T08:00:00").getTime();
    expect(countdownLabel(tomorrow, now)).toMatch(/^Tomorrow /);
  });
});

describe("addPlannedTrip cap", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns the trips the cap evicted so their reminders can be cancelled", async () => {
    const base = Date.now() + 3_600_000;
    const mk = (i: number): PlannedTrip => ({
      id: `t${i}`,
      place: { name: `P${i}`, address: "", lat: 0, lng: 0 },
      atMs: base + i,
      notifId: `n${i}`,
    });
    for (let i = 0; i < 5; i++) {
      expect((await addPlannedTrip(mk(i))).evicted).toEqual([]);
    }
    const { trips, evicted } = await addPlannedTrip(mk(5));
    expect(trips).toHaveLength(5);
    expect(trips[0].id).toBe("t5");
    expect(evicted.map((t) => t.id)).toEqual(["t0"]);
  });
});
