import { formatDistanceM, haversineMeters } from "@/lib/geo";
import { arrivalConditions, positionedTravelers, roomDest, travelers } from "@/modes/shared";
import {
  DEFAULT_FORMATION_RADIUS_M,
  type AlertCondition,
  type ClientSnapshot,
  type MemberInsight,
  type ModeStrategy,
} from "@/modes/types";

const BREAKAWAY_SUSTAIN_MS = 60_000;

/** Mean of all positioned travelers; fine at city scale, exported for tests. */
export function formationCentroid(
  snap: ClientSnapshot,
): { lat: number; lng: number } | null {
  const positioned = positionedTravelers(snap);
  if (positioned.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const m of positioned) {
    lat += m.pos!.lat;
    lng += m.pos!.lng;
  }
  return { lat: lat / positioned.length, lng: lng / positioned.length };
}

function radiusM(snap: ClientSnapshot): number {
  return snap.room.settings.formation_radius_m ?? DEFAULT_FORMATION_RADIUS_M;
}

export const formationStrategy: ModeStrategy = {
  id: "formation",
  label: "Formation",
  destinationPolicy: "room",

  effectiveDestinationFor: (snap, userId) => {
    const m = snap.members[userId];
    if (!m || m.role !== "traveler") return null;
    return roomDest(snap); // optional shared destination
  },

  computeInsights: (snap) => {
    const centroid = formationCentroid(snap);
    const radius = radiusM(snap);
    const perMember: Record<string, MemberInsight> = {};
    let outside = 0;

    for (const m of travelers(snap)) {
      const insight: MemberInsight = { userId: m.userId };
      if (centroid && m.pos) {
        const d = haversineMeters(m.pos.lat, m.pos.lng, centroid.lat, centroid.lng);
        insight.distanceFromCentroidM = d;
        insight.outsideRadius = d > radius;
        if (insight.outsideRadius) outside++;
      }
      perMember[m.userId] = insight;
    }

    const headline =
      centroid == null
        ? null
        : outside === 0
          ? `Formation tight · radius ${formatDistanceM(radius)}`
          : `${outside} outside the ${formatDistanceM(radius)} radius`;

    return { headline, perMember };
  },

  alertConditions: (snap, viewerId) => {
    const centroid = formationCentroid(snap);
    const radius = radiusM(snap);
    const conditions: AlertCondition[] = arrivalConditions(snap, viewerId);
    if (!centroid) return conditions;

    for (const m of travelers(snap)) {
      const d = m.pos
        ? haversineMeters(m.pos.lat, m.pos.lng, centroid.lat, centroid.lng)
        : null;
      const isSelf = m.userId === viewerId;
      conditions.push({
        id: isSelf ? "breakaway:self" : `breakaway:${m.userId}`,
        active: d != null && d > radius,
        sustainMs: BREAKAWAY_SUSTAIN_MS,
        severity: "warn",
        title: isSelf ? "You've left the formation" : `${m.name} broke away`,
        body: d != null ? `${formatDistanceM(d)} from the group` : undefined,
      });
    }
    return conditions;
  },

  cameraTarget: () => ({ kind: "fitAll" }),
};
