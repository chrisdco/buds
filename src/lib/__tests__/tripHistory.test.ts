import { mergeVisit, type ActiveRoomRef } from "@/lib/activeRoom";
import { budsLabel, frequentBuds, goAgainParams, groupByRecency, tripStats, tripsWith } from "@/lib/tripHistory";
import type { SnapshotPayload } from "@/types/contracts";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 4);

const ref = (id: string, extra: Partial<ActiveRoomRef> = {}): ActiveRoomRef => ({
  id,
  code: id.toUpperCase(),
  name: `Room ${id}`,
  role: "traveler",
  ...extra,
});

describe("mergeVisit", () => {
  const snap = {
    room: { id: "r1", name: "Goa run", mode: "leader" },
    members: [
      { user_id: "me", display_name: "Chris" },
      { user_id: "u2", display_name: "Asha" },
    ],
    destinations: [
      { member_id: "m9", label: "Mine" },
      { member_id: null, label: "Baga Beach", lat: 15.55, lng: 73.75 },
    ],
  } as unknown as SnapshotPayload;

  it("records mode, room destination, other members and time", () => {
    expect(mergeVisit(ref("r1"), snap, "me", NOW)).toEqual({
      ...ref("r1"),
      name: "Goa run",
      mode: "leader",
      destLabel: "Baga Beach",
      destLat: 15.55,
      destLng: 73.75,
      buds: [{ userId: "u2", name: "Asha" }],
      lastAtMs: NOW,
    });
  });
});

describe("trip history", () => {
  const rooms = [
    ref("a", { lastAtMs: NOW - DAY, destLabel: "Baga Beach", buds: [{ userId: "u2", name: "Asha" }] }),
    ref("b", {
      lastAtMs: NOW - 10 * DAY,
      destLabel: "baga beach ",
      buds: [
        { userId: "u2", name: "Asha" },
        { userId: "u3", name: "Ben" },
      ],
    }),
    ref("c"),
  ];

  it("counts distinct buds and places", () => {
    expect(tripStats(rooms)).toEqual({ trips: 3, buds: 2, places: 1 });
  });

  it("ranks buds by shared trips", () => {
    expect(frequentBuds(rooms).map((b) => [b.name, b.trips])).toEqual([
      ["Asha", 2],
      ["Ben", 1],
    ]);
  });

  it("buckets by recency, undated rooms last", () => {
    expect(groupByRecency(rooms, NOW).map((s) => [s.title, s.rooms.map((r) => r.id)])).toEqual([
      ["This week", ["a"]],
      ["This month", ["b"]],
      ["Earlier", ["c"]],
    ]);
  });

  it("labels companions compactly", () => {
    expect(budsLabel(undefined)).toBeNull();
    expect(budsLabel([{ name: "Asha" }])).toBe("with Asha");
    expect(budsLabel([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }])).toBe("with A, B +2");
  });
});

describe("goAgainParams", () => {
  it("reuses mode, name and place", () => {
    expect(
      goAgainParams(ref("r1", { mode: "converge", destLabel: "Baga", destLat: 15.5, destLng: 73.7 })),
    ).toEqual({ name: "Room r1", mode: "converge", destLat: "15.5", destLng: "73.7", destLabel: "Baga" });
  });

  it("drops the place when coordinates are unknown", () => {
    expect(goAgainParams(ref("r1", { destLabel: "Baga" }))).toEqual({ name: "Room r1" });
  });
});

describe("tripsWith", () => {
  it("keeps only rooms that person was in", () => {
    const a = ref("a", { buds: [{ userId: "u2", name: "Asha" }] });
    const b = ref("b", { buds: [{ userId: "u3", name: "Ravi" }] });
    expect(tripsWith([a, b], "u2")).toEqual([a]);
  });
});
