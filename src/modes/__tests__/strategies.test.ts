import { convergeStrategy } from "@/modes/converge";
import { formationCentroid, formationStrategy } from "@/modes/formation";
import { leaderStrategy } from "@/modes/leader";
import { computeOverlapPct, multitrackStrategy } from "@/modes/multitrack";
import { soloStrategy } from "@/modes/solo";
import {
  at,
  makeMember,
  makeMemberDest,
  makeRoom,
  makeRoomDest,
  makeRoute,
  makeSnap,
} from "@/testing/fixtures";

// ~0.001° lat ≈ 111m
const LAT_111M = 0.001;
const BASE = { lat: 48.2, lng: 16.37 };

describe("converge", () => {
  const snap = makeSnap({
    room: makeRoom({ mode: "converge" }),
    destRoom: makeRoomDest(48.25, 16.4),
    members: {
      alice: makeMember("alice", { pos: at(BASE.lat, BASE.lng) }),
      bob: makeMember("bob", {
        pos: at(48.25, 16.4),
        arrivedAt: "2026-06-12T10:30:00Z",
      }),
      carol: makeMember("carol", { role: "spectator" }),
    },
    routes: { alice: makeRoute([[16.37, 48.2], [16.4, 48.25]], { durationS: 600 }) },
  });

  it("routes every traveler to the room destination; spectators get none", () => {
    expect(convergeStrategy.effectiveDestinationFor(snap, "alice")?.kind).toBe("room");
    expect(convergeStrategy.effectiveDestinationFor(snap, "carol")).toBeNull();
  });

  it("ranks arrivals from persisted arrived_at and reports the slowest ETA", () => {
    const insights = convergeStrategy.computeInsights(snap, "alice");
    expect(insights.perMember.bob.arrivedRank).toBe(1);
    expect(insights.perMember.alice.etaS).toBe(600);
    expect(insights.headline).toContain("1/2 arrived");
    expect(insights.headline).toContain("10 min");
  });

  it("announces arrivals through alert conditions keyed by user", () => {
    const conditions = convergeStrategy.alertConditions(snap, "alice");
    const bobArrive = conditions.find((c) => c.id === "arrive:bob");
    expect(bobArrive?.active).toBe(true);
    expect(conditions.find((c) => c.id === "arrive:alice")?.active).toBe(false);
  });
});

describe("solo", () => {
  it("uses the member's personal destination", () => {
    const snap = makeSnap({
      room: makeRoom({ mode: "solo" }),
      members: { alice: makeMember("alice", { pos: at(BASE.lat, BASE.lng) }) },
      destByMember: { "m-alice": makeMemberDest("m-alice", 48.3, 16.5) },
    });
    const dest = soloStrategy.effectiveDestinationFor(snap, "alice");
    expect(dest?.kind).toBe("personal");
    expect(dest?.lat).toBe(48.3);
  });
});

describe("leader", () => {
  const room = makeRoom({ mode: "leader", leader_id: "alice", settings: { separation_alert_m: 500 } });
  // bob is ~666m behind alice
  const snap = makeSnap({
    room,
    members: {
      alice: makeMember("alice", { pos: at(BASE.lat, BASE.lng) }),
      bob: makeMember("bob", { pos: at(BASE.lat - 6 * LAT_111M, BASE.lng) }),
    },
  });

  it("followers chase the leader's live position", () => {
    const dest = leaderStrategy.effectiveDestinationFor(snap, "bob");
    expect(dest?.kind).toBe("leader");
    expect(dest?.lat).toBe(BASE.lat);
  });

  it("measures separation per follower", () => {
    const insights = leaderStrategy.computeInsights(snap, "bob");
    expect(insights.perMember.bob.distanceToLeaderM).toBeGreaterThan(600);
    expect(insights.perMember.bob.distanceToLeaderM).toBeLessThan(720);
    expect(insights.perMember.alice.distanceToLeaderM).toBeUndefined();
  });

  it("alerts the lagging follower about THEMSELVES only", () => {
    const conditions = leaderStrategy.alertConditions(snap, "bob");
    const self = conditions.find((c) => c.id === "sep:self");
    expect(self?.active).toBe(true);
    expect(conditions.find((c) => c.id === "sep:bob")).toBeUndefined();
  });

  it("alerts the leader about each lagging follower", () => {
    const conditions = leaderStrategy.alertConditions(snap, "alice");
    expect(conditions.find((c) => c.id === "sep:bob")?.active).toBe(true);
  });

  it("stays quiet when the follower is within range", () => {
    const close = makeSnap({
      room,
      members: {
        alice: makeMember("alice", { pos: at(BASE.lat, BASE.lng) }),
        bob: makeMember("bob", { pos: at(BASE.lat - LAT_111M, BASE.lng) }),
      },
    });
    expect(
      leaderStrategy.alertConditions(close, "bob").find((c) => c.id === "sep:self")
        ?.active,
    ).toBe(false);
  });
});

describe("formation", () => {
  const room = makeRoom({ mode: "formation", settings: { formation_radius_m: 200 } });
  // alice & bob together; dave ~888m away
  const snap = makeSnap({
    room,
    members: {
      alice: makeMember("alice", { pos: at(BASE.lat, BASE.lng) }),
      bob: makeMember("bob", { pos: at(BASE.lat + LAT_111M, BASE.lng) }),
      dave: makeMember("dave", { pos: at(BASE.lat + 8 * LAT_111M, BASE.lng) }),
    },
  });

  it("computes the centroid of positioned travelers", () => {
    const centroid = formationCentroid(snap);
    expect(centroid?.lat).toBeCloseTo(BASE.lat + 3 * LAT_111M, 5);
  });

  it("flags members outside the radius", () => {
    const insights = formationStrategy.computeInsights(snap, "alice");
    expect(insights.perMember.dave.outsideRadius).toBe(true);
    expect(insights.perMember.alice.outsideRadius).toBe(true); // 333m from centroid
    expect(insights.headline).toContain("outside");
  });

  it("raises a self breakaway condition for the viewer", () => {
    const conditions = formationStrategy.alertConditions(snap, "dave");
    expect(conditions.find((c) => c.id === "breakaway:self")?.active).toBe(true);
  });
});

describe("multitrack overlap", () => {
  const path: [number, number][] = Array.from({ length: 20 }, (_, i) => [
    16.37 + i * 0.001,
    48.2,
  ]);
  const farPath: [number, number][] = path.map(([lng, lat]) => [lng, lat + 1]); // ~111km away

  it("is 100% for identical routes and 0% for distant ones", () => {
    expect(computeOverlapPct(makeRoute(path), makeRoute(path))).toBe(100);
    expect(computeOverlapPct(makeRoute(path), makeRoute(farPath))).toBe(0);
  });

  it("reports partial overlap for partially-shared corridors", () => {
    // second half of the path veers ~1.1km north
    const split: [number, number][] = path.map(([lng, lat], i) =>
      i < 10 ? [lng, lat] : [lng, lat + 0.01],
    );
    const pct = computeOverlapPct(makeRoute(path), makeRoute(split));
    expect(pct).toBeGreaterThan(20);
    expect(pct).toBeLessThan(80);
  });

  it("feeds per-member overlap into insights", () => {
    const snap = makeSnap({
      room: makeRoom({ mode: "multitrack" }),
      members: {
        alice: makeMember("alice", { pos: at(48.2, 16.37) }),
        bob: makeMember("bob", { pos: at(48.2, 16.371) }),
      },
      routes: { alice: makeRoute(path), bob: makeRoute(path) },
    });
    const insights = multitrackStrategy.computeInsights(snap, "alice");
    expect(insights.perMember.bob.overlapPct).toBe(100);
    expect(insights.headline).toContain("share part of your route");
  });
});
