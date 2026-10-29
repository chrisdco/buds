import { memberMeta, memberValue, primaryAction, sortMembers } from "@/features/room/sheetLogic";
import type { MemberInsight } from "@/modes/types";
import type { MemberLive } from "@/types/contracts";

function m(userId: string, overrides: Partial<MemberLive> = {}): MemberLive {
  return {
    userId,
    memberId: `m-${userId}`,
    name: userId.toUpperCase(),
    role: "traveler",
    sharing: true,
    arrivedAt: null,
    online: true,
    appState: "fg",
    moving: true,
    ...overrides,
  };
}

const base = { isTraveler: true, hasDest: false, canSetDest: false, canCheckIn: false, nearDest: false };

describe("primaryAction (pinned CTA)", () => {
  it("prefers check-in when close, then navigate, then set, then invite", () => {
    expect(primaryAction({ ...base, hasDest: true, canCheckIn: true, nearDest: true })).toBe("checkin");
    expect(primaryAction({ ...base, hasDest: true, canCheckIn: true, nearDest: false })).toBe("navigate");
    expect(primaryAction({ ...base, canSetDest: true })).toBe("setDest");
    expect(primaryAction(base)).toBe("invite");
  });

  it("gives spectators navigate only when there's somewhere to go", () => {
    expect(primaryAction({ ...base, isTraveler: false, hasDest: true })).toBe("navigate");
    expect(primaryAction({ ...base, isTraveler: false })).toBeNull();
  });
});

describe("member rows", () => {
  const insights: Record<string, MemberInsight> = {
    slow: { userId: "slow", etaS: 900, remainingM: 8000 },
    fast: { userId: "fast", etaS: 120, remainingM: 900 },
    done: { userId: "done", arrivedRank: 1 },
  };

  it("sorts SOS first, then soonest ETA, unknowns, arrived, spectators", () => {
    const sorted = sortMembers(
      [m("watch", { role: "spectator" }), m("done"), m("slow"), m("none"), m("fast"), m("help")],
      insights,
      new Set(["help"]),
    ).map((x) => x.userId);
    expect(sorted).toEqual(["help", "fast", "slow", "none", "done", "watch"]);
  });

  it("puts the deciding number on the right", () => {
    expect(memberValue(insights.fast, "km")).toMatch(/2\s*min/);
    expect(memberValue(insights.done, "km")).toBe("#1");
    expect(memberValue(undefined, "km")).toBeNull();
  });

  it("writes a status line with role, presence and distance left", () => {
    const tags = { isMe: false, isHost: true, isLeader: false, sos: false };
    expect(memberMeta(m("fast"), insights.fast, "km", Date.now(), tags)).toMatch(/^Host · .+ · 900 m left$/);
    expect(memberMeta(m("x"), undefined, "km", Date.now(), { ...tags, sos: true })).toBe(
      "SOS — needs help",
    );
    expect(memberMeta(m("w", { role: "spectator" }), undefined, "km", Date.now(), { ...tags, isHost: false })).toBe(
      "Watching",
    );
  });
});
