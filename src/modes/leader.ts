import { formatDistanceM, haversineMeters } from "@/lib/geo";
import { arrivalConditions, personalDest, travelers } from "@/modes/shared";
import {
  DEFAULT_SEPARATION_ALERT_M,
  type AlertCondition,
  type ClientSnapshot,
  type MemberInsight,
  type ModeStrategy,
} from "@/modes/types";

const SEPARATION_SUSTAIN_MS = 30_000;

function separationM(snap: ClientSnapshot, userId: string): number | undefined {
  const leaderId = snap.room.leader_id;
  if (!leaderId || userId === leaderId) return undefined;
  const me = snap.members[userId]?.pos;
  const leader = snap.members[leaderId]?.pos;
  if (!me || !leader) return undefined;
  return haversineMeters(me.lat, me.lng, leader.lat, leader.lng);
}

export const leaderStrategy: ModeStrategy = {
  id: "leader",
  label: "Follow leader",
  destinationPolicy: "leader-position",

  effectiveDestinationFor: (snap, userId) => {
    const leaderId = snap.room.leader_id;
    // The leader follows their own (optional) destination...
    if (!leaderId || userId === leaderId) return personalDest(snap, userId);
    // ...everyone else follows the leader's live position (a moving target).
    const leader = snap.members[leaderId];
    if (!leader?.pos || leader.role !== "traveler") return null;
    return {
      lat: leader.pos.lat,
      lng: leader.pos.lng,
      label: leader.name,
      kind: "leader",
    };
  },

  computeInsights: (snap, viewerId) => {
    const leaderId = snap.room.leader_id;
    const perMember: Record<string, MemberInsight> = {};
    for (const m of travelers(snap)) {
      const insight: MemberInsight = { userId: m.userId };
      const sep = separationM(snap, m.userId);
      if (sep != null) insight.distanceToLeaderM = sep;
      const route = snap.routes[m.userId];
      if (route) {
        insight.etaS = route.durationS;
        insight.remainingM = route.distanceM;
      }
      perMember[m.userId] = insight;
    }

    const mySep = separationM(snap, viewerId);
    const leaderName = leaderId ? (snap.members[leaderId]?.name ?? "the leader") : null;
    let headline: string | null = null;
    if (!leaderId || !snap.members[leaderId]) {
      headline = "No leader set — the host picks one in settings";
    } else if (viewerId === leaderId) {
      const followers = travelers(snap).filter((m) => m.userId !== leaderId);
      const farthest = Math.max(
        0,
        ...followers
          .map((m) => perMember[m.userId]?.distanceToLeaderM ?? 0)
          .filter(Number.isFinite),
      );
      headline =
        followers.length === 0
          ? "You're leading — waiting for buds"
          : `You're leading · farthest bud ${formatDistanceM(farthest)} back`;
    } else if (mySep != null && leaderName) {
      headline = `${formatDistanceM(mySep)} behind ${leaderName}`;
    }

    return { headline, perMember };
  },

  alertConditions: (snap, viewerId) => {
    const threshold =
      snap.room.settings.separation_alert_m ?? DEFAULT_SEPARATION_ALERT_M;
    const leaderId = snap.room.leader_id;
    const conditions: AlertCondition[] = arrivalConditions(snap, viewerId);
    if (!leaderId) return conditions;

    if (viewerId === leaderId) {
      // The leader hears about each follower falling behind.
      for (const m of travelers(snap)) {
        if (m.userId === leaderId) continue;
        const sep = separationM(snap, m.userId);
        conditions.push({
          id: `sep:${m.userId}`,
          active: sep != null && sep > threshold,
          sustainMs: SEPARATION_SUSTAIN_MS,
          severity: "warn",
          title: `${m.name} is falling behind`,
          body: sep != null ? `${formatDistanceM(sep)} back` : undefined,
        });
      }
    } else {
      // A follower is only alerted about THEMSELVES (plan §6: viewer-local).
      const sep = separationM(snap, viewerId);
      const leaderName = snap.members[leaderId]?.name ?? "the leader";
      conditions.push({
        id: "sep:self",
        active: sep != null && sep > threshold,
        sustainMs: SEPARATION_SUSTAIN_MS,
        severity: "warn",
        title: `You're falling behind ${leaderName}`,
        body: sep != null ? `${formatDistanceM(sep)} of separation` : undefined,
      });
    }
    return conditions;
  },

  cameraTarget: (snap, viewerId) => {
    const leaderId = snap.room.leader_id;
    if (leaderId && leaderId !== viewerId && snap.members[leaderId]?.pos) {
      return { kind: "fitUsers", userIds: [viewerId, leaderId] };
    }
    return { kind: "fitAll" };
  },
};
