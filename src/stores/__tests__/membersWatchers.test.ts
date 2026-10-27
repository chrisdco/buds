import { hasWatchers } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

const ME = "u-me";

function member(userId: string, overrides: Partial<MemberLive> = {}): MemberLive {
  return {
    userId,
    memberId: `m-${userId}`,
    name: userId,
    role: "traveler",
    sharing: true,
    arrivedAt: null,
    online: true,
    appState: "fg",
    moving: false,
    ...overrides,
  };
}

function roster(...ms: MemberLive[]): Record<string, MemberLive> {
  return Object.fromEntries(ms.map((m) => [m.userId, m]));
}

describe("hasWatchers", () => {
  it("is true when another online member is foreground", () => {
    expect(hasWatchers(roster(member(ME), member("a", { appState: "fg" })), ME)).toBe(true);
  });

  it("ignores self, backgrounded peers and offline peers", () => {
    const r = roster(
      member(ME, { appState: "fg" }),
      member("a", { appState: "bg" }),
      member("b", { online: false, appState: "fg" }),
    );
    expect(hasWatchers(r, ME)).toBe(false);
  });

  it("treats an unknown roster or missing presence meta as watched", () => {
    expect(hasWatchers({}, ME)).toBe(true);
    expect(hasWatchers(roster(member(ME)), ME)).toBe(true);
    expect(hasWatchers(roster(member(ME), member("a", { appState: undefined })), ME)).toBe(
      true,
    );
  });
});
