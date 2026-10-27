import AsyncStorage from "@react-native-async-storage/async-storage";

import { addPlannedTrip, countdownLabel, timeSlots, type PlannedTrip } from "@/lib/planned";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
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

describe("slot day labels", () => {
  it("labels by calendar day, not by hours away", () => {
    // 9 PM: 8 AM is only 11h away but it is tomorrow's.
    const evening = new Date("2026-10-01T21:00:00").getTime();
    const slots = timeSlots(evening);
    expect(slots.find((s) => s.id === "tomorrow-am")!.label).toBe("Tomorrow 8 AM");
    expect(slots.find((s) => s.id === "tomorrow-pm")!.label).toBe("Tomorrow 6 PM");
  });

  it("keeps same-day slots as today", () => {
    const early = new Date("2026-10-01T06:00:00").getTime();
    const slots = timeSlots(early);
    expect(slots.find((s) => s.id === "tomorrow-am")!.label).toBe("Today 8 AM");
    expect(slots.find((s) => s.id === "tomorrow-pm")!.label).toBe("Today 6 PM");
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
