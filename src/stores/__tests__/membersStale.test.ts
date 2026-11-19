import { STALE_POS_MS, formatAgo, presenceLabel, presenceOf, staleAge } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

const NOW = 10_000_000;
const member = (over: Partial<MemberLive>): MemberLive => ({
  userId: "u",
  memberId: "m",
  name: "Asha",
  role: "traveler",
  sharing: true,
  arrivedAt: null,
  online: true,
  moving: false,
  pos: { lat: 1, lng: 1, atMs: NOW - 10_000, source: "tick" },
  ...over,
});

describe("formatAgo", () => {
  it.each([
    [30_000, "just now"],
    [4 * 60_000, "4 min ago"],
    [65 * 60_000, "1 h 5 min ago"],
    [3 * 3_600_000 + 60_000, "3 h ago"],
  ])("%d ms -> %s", (ms, label) => expect(formatAgo(ms)).toBe(label));
});

describe("stale positions", () => {
  it("a current dot is not stale", () => {
    expect(staleAge(member({}), NOW)).toBeNull();
    expect(presenceLabel("stationary", member({}), NOW)).toBe("Online");
  });

  it("online and sharing but frozen says how old the spot is", () => {
    const m = member({ pos: { lat: 1, lng: 1, atMs: NOW - STALE_POS_MS - 3 * 60_000, source: "tick" } });
    expect(presenceOf(m, NOW)).toBe("stationary");
    expect(presenceLabel("stationary", m, NOW)).toBe("Location updated 5 min ago");
  });

  it("paused sharing is not called stale", () => {
    const m = member({ sharing: false, pos: { lat: 1, lng: 1, atMs: NOW - 10 * 60_000, source: "tick" } });
    expect(staleAge(m, NOW)).toBeNull();
    expect(presenceLabel("stationary", m, NOW)).toBe("Sharing paused");
  });

  it("offline uses the readable age", () => {
    const m = member({ online: false, pos: { lat: 1, lng: 1, atMs: NOW - 90 * 60_000, source: "last_seen" } });
    expect(presenceLabel(presenceOf(m, NOW), m, NOW)).toBe("Last seen 1 h 30 min ago");
  });

  it("arrived members are never stale", () => {
    expect(staleAge(member({ arrivedAt: "x", pos: { lat: 1, lng: 1, atMs: 0, source: "tick" } }), NOW)).toBeNull();
  });
});
