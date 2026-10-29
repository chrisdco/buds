import { formatDistanceM, type DistanceUnit } from "@/lib/geo";
import { formatDurationS } from "@/lib/time";
import type { MemberInsight } from "@/modes/types";
import { presenceLabel, presenceOf } from "@/stores/membersStore";
import type { MemberLive } from "@/types/contracts";

// Pure decisions behind the room sheet (no React, no native modules), so
// they're unit-testable: which CTA is pinned, how members sort, and what
// each member row says.

export type PrimaryAction = "checkin" | "navigate" | "setDest" | "invite";

/**
 * Picks the pinned CTA: the single thing this person most likely wants now.
 * Arriving beats navigating beats setting a destination beats inviting.
 * Exported for tests.
 */
export function primaryAction(s: {
  isTraveler: boolean;
  hasDest: boolean;
  canSetDest: boolean;
  canCheckIn: boolean;
  nearDest: boolean;
}): PrimaryAction | null {
  if (!s.isTraveler) return s.hasDest ? "navigate" : null;
  if (s.canCheckIn && s.nearDest) return "checkin";
  if (s.hasDest) return "navigate";
  if (s.canSetDest) return "setDest";
  return "invite";
}

/** The right-aligned value: what you'd scan the list for. Exported for tests. */
export function memberValue(insight: MemberInsight | undefined, units: DistanceUnit): string | null {
  if (!insight) return null;
  if (insight.arrivedRank != null) return `#${insight.arrivedRank}`;
  if (insight.etaS != null) return formatDurationS(insight.etaS);
  if (insight.distanceToLeaderM != null) return formatDistanceM(insight.distanceToLeaderM, units);
  if (insight.distanceFromCentroidM != null) {
    return formatDistanceM(insight.distanceFromCentroidM, units);
  }
  return null;
}

/** The status line under the name. Exported for tests. */
export function memberMeta(
  m: MemberLive,
  insight: MemberInsight | undefined,
  units: DistanceUnit,
  nowMs: number,
  tags: { isMe: boolean; isHost: boolean; isLeader: boolean; sos: boolean },
): string {
  if (tags.sos) return "SOS — needs help";
  const parts: string[] = [];
  if (tags.isLeader) parts.push("Leader");
  else if (tags.isHost) parts.push("Host");
  if (m.role === "spectator") {
    parts.push("Watching");
    return parts.join(" · ");
  }
  if (insight?.arrivedRank != null) {
    parts.push("Arrived");
    return parts.join(" · ");
  }
  parts.push(presenceLabel(presenceOf(m, nowMs), m, nowMs));
  if (insight?.etaS != null && insight.remainingM != null) {
    parts.push(`${formatDistanceM(insight.remainingM, units)} left`);
  } else if (insight?.distanceToLeaderM != null) {
    parts.push("behind leader");
  } else if (insight?.distanceFromCentroidM != null) {
    parts.push(insight.outsideRadius ? "outside the group" : "from center");
  }
  if (insight?.overlapPct != null && insight.overlapPct >= 30) {
    parts.push(`${insight.overlapPct}% shared route`);
  }
  return parts.join(" · ");
}

/** Attention order. Exported for tests. */
export function sortMembers(
  members: MemberLive[],
  insights: Record<string, MemberInsight>,
  sos: Set<string>,
): MemberLive[] {
  const rank = (m: MemberLive): [number, number, string] => {
    const i = insights[m.userId];
    if (sos.has(m.userId)) return [0, 0, m.name];
    if (m.role === "spectator") return [4, 0, m.name];
    if (i?.arrivedRank != null) return [3, i.arrivedRank, m.name];
    if (i?.etaS != null) return [1, i.etaS, m.name];
    return [2, 0, m.name];
  };
  return [...members].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
  });
}
