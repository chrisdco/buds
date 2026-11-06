import { lateUserIds } from "@/modes/routeSignals";
import type { ClientSnapshot, ModeInsights } from "@/modes/types";
import type { MemberLive, RoomMode, RouteResult } from "@/types/contracts";

const member = (userId: string, lat = 0, lng = 0, extra: Partial<MemberLive> = {}): MemberLive => ({
  userId,
  memberId: `m-${userId}`,
  name: userId,
  role: "traveler",
  sharing: true,
  arrivedAt: null,
  online: true,
  moving: true,
  pos: { lat, lng, atMs: 0 } as MemberLive["pos"],
  ...extra,
});

const road = (coords: [number, number][], source: RouteResult["source"] = "osrm"): RouteResult => ({
  coords,
  distanceM: 1000,
  durationS: 600,
  source,
  fetchedAt: 0,
});

function snap(
  mode: RoomMode,
  members: MemberLive[],
  routes: Record<string, RouteResult> = {},
  settings: Record<string, number> = {},
): ClientSnapshot {
  return {
    room: { id: "r", mode, leader_id: "lead", settings } as unknown as ClientSnapshot["room"],
    members: Object.fromEntries(members.map((m) => [m.userId, m])),
    destRoom: null,
    destByMember: {},
    routes,
    units: "km",
  };
}

const insights = (perMember: ModeInsights["perMember"]): ModeInsights => ({ headline: null, perMember });

describe("lateUserIds", () => {
  it("flags someone far off their own road route, but not an estimate", () => {
    const line: [number, number][] = [
      [0, 0],
      [0, 0.01],
    ];
    // 0.005 deg of longitude is ~550 m off the line
    const s = snap("multitrack", [member("a", 0.005, 0.005), member("b", 0.005, 0.005)], {
      a: road(line),
      b: road(line, "straightline"),
    });
    expect([...lateUserIds(s, insights({}))]).toEqual(["a"]);
  });

  it("formation: outside the radius", () => {
    const s = snap("formation", [member("a"), member("b")]);
    const out = lateUserIds(s, insights({ a: { userId: "a", outsideRadius: true }, b: { userId: "b" } }));
    expect([...out]).toEqual(["a"]);
  });

  it("follow leader: farther behind than the separation alert", () => {
    const s = snap("leader", [member("lead"), member("a"), member("b")], {}, { separation_alert_m: 300 });
    const out = lateUserIds(
      s,
      insights({
        lead: { userId: "lead", distanceToLeaderM: 0 },
        a: { userId: "a", distanceToLeaderM: 450 },
        b: { userId: "b", distanceToLeaderM: 120 },
      }),
    );
    expect([...out]).toEqual(["a"]);
  });

  it("meet up: ETA well past the group median", () => {
    const s = snap("converge", [member("a"), member("b"), member("c"), member("d")]);
    const out = lateUserIds(
      s,
      insights({
        a: { userId: "a", etaS: 600 },
        b: { userId: "b", etaS: 700 },
        c: { userId: "c", etaS: 800 },
        d: { userId: "d", etaS: 2400 },
      }),
    );
    expect([...out]).toEqual(["d"]);
  });

  it("meet up needs three ETAs, and arrived people are never late", () => {
    const two = snap("converge", [member("a"), member("b")]);
    expect(lateUserIds(two, insights({ a: { userId: "a", etaS: 60 }, b: { userId: "b", etaS: 5000 } })).size).toBe(0);
    const arrived = snap("formation", [member("a", 0, 0, { arrivedAt: "2026-01-01T00:00:00Z" })]);
    expect(lateUserIds(arrived, insights({ a: { userId: "a", outsideRadius: true } })).size).toBe(0);
  });
});
