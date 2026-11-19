import { arrivalBody, arrivalMoment, ordinal, SELF_CARD_MS } from "@/features/room/arrival";

const T0 = Date.parse("2026-11-19T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const none = new Set<string>();

describe("arrivalMoment", () => {
  const base = { roomId: "r1", myUserId: "me", dismissed: none };

  it("shows your card right after you arrive, with your place", () => {
    const m = arrivalMoment({
      ...base,
      nowMs: T0 + 30_000,
      travelers: [
        { userId: "a", arrivedAt: iso(T0 - 60_000) },
        { userId: "me", arrivedAt: iso(T0) },
        { userId: "b", arrivedAt: null },
      ],
    });
    expect(m).toMatchObject({ kind: "self", rank: 2, total: 3, remaining: 1 });
    expect(arrivalBody(m!, "traveler")).toBe("2nd of 3 · 1 still on the way");
  });

  it("goes quiet after the moment passes, before you arrive, or once dismissed", () => {
    const travelers = [
      { userId: "me", arrivedAt: iso(T0) },
      { userId: "b", arrivedAt: null },
    ];
    expect(arrivalMoment({ ...base, travelers, nowMs: T0 + SELF_CARD_MS + 1 })).toBeNull();
    expect(
      arrivalMoment({ ...base, travelers: [{ userId: "me", arrivedAt: null }, travelers[1]], nowMs: T0 }),
    ).toBeNull();
    const key = arrivalMoment({ ...base, travelers, nowMs: T0 })!.key;
    expect(arrivalMoment({ ...base, travelers, nowMs: T0, dismissed: new Set([key]) })).toBeNull();
  });

  it("nudges to wrap up once the whole group is in, for anyone in the room", () => {
    const travelers = [
      { userId: "a", arrivedAt: iso(T0 - 3_600_000) },
      { userId: "b", arrivedAt: iso(T0 - 3_000_000) },
    ];
    // Spectator / late opener: no self card, but the group nudge still shows.
    const m = arrivalMoment({ ...base, travelers, nowMs: T0 });
    expect(m).toEqual({ kind: "all", key: "r1:all", total: 2 });
    expect(arrivalBody(m!, "watcher")).toBe("The host can end the trip.");
    expect(arrivalMoment({ ...base, travelers, nowMs: T0, dismissed: new Set(["r1:all"]) })).toBeNull();
  });

  it("treats a solo trip as yours, with its own wrap-up line", () => {
    const m = arrivalMoment({ ...base, travelers: [{ userId: "me", arrivedAt: iso(T0) }], nowMs: T0 });
    expect(m).toMatchObject({ kind: "self", total: 1, remaining: 0 });
    expect(arrivalBody(m!, "host")).toBe("Trip done. End the trip so everyone stops sharing their location.");
    expect(arrivalBody(m!, "traveler")).toBe("Trip done. Leave the room to stop sharing your location.");
  });

  it("words the first arrival naturally", () => {
    expect(arrivalBody({ kind: "self", key: "k", rank: 1, total: 4, remaining: 3 }, "traveler")).toBe(
      "First one here · 3 still on the way",
    );
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [112, "112th"],
  ])("%i -> %s", (n, s) => expect(ordinal(n)).toBe(s));
});
