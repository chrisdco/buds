import { mergeVisit, type ActiveRoomRef } from "@/lib/activeRoom";
import { budsLabel, frequentBuds, groupByRecency, tripStats } from "@/lib/tripHistory";
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
      { member_id: null, label: "Baga Beach" },
    ],
  } as unknown as SnapshotPayload;

  it("records mode, room destination, other members and time", () => {
    expect(mergeVisit(ref("r1"), snap, "me", NOW)).toEqual({
      ...ref("r1"),
      name: "Goa run",
      mode: "leader",
      destLabel: "Baga Beach",
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
