import type {
  AlertCondition,
  ClientSnapshot,
  EffectiveDest,
  MemberInsight,
} from "@/modes/types";
import type { MemberLive } from "@/types/contracts";

export function travelers(snap: ClientSnapshot): MemberLive[] {
  return Object.values(snap.members).filter((m) => m.role === "traveler");
}

export function positionedTravelers(snap: ClientSnapshot): MemberLive[] {
  return travelers(snap).filter((m) => m.pos);
}

/** ETA/remaining-distance insight from this member's cached route, if any. */
export function routeInsight(snap: ClientSnapshot, userId: string): MemberInsight {
  const route = snap.routes[userId];
  if (!route) return { userId };
  return { userId, etaS: route.durationS, remainingM: route.distanceM };
}

export function personalDest(
  snap: ClientSnapshot,
  userId: string,
): EffectiveDest | null {
  const member = snap.members[userId];
  if (!member) return null;
  const d = snap.destByMember[member.memberId];
  return d ? { lat: d.lat, lng: d.lng, label: d.label, kind: "personal" } : null;
}

export function roomDest(snap: ClientSnapshot): EffectiveDest | null {
  const d = snap.destRoom;
  return d ? { lat: d.lat, lng: d.lng, label: d.label, kind: "room" } : null;
}

/**
 * Arrival announcements are shared by every destination-driven mode. They key
 * off the persisted arrived_at (DB truth, set idempotently by the arriving
 * client) so all viewers agree; the alert engine's priming pass keeps old
 * arrivals from re-announcing to late joiners.
 */
export function arrivalConditions(
  snap: ClientSnapshot,
  viewerId: string,
): AlertCondition[] {
  return travelers(snap).map((m) => ({
    id: `arrive:${m.userId}`,
    active: m.arrivedAt != null,
    sustainMs: 0,
    severity: "info" as const,
    title: m.userId === viewerId ? "You arrived 🎉" : `${m.name} arrived 🎉`,
  }));
}
