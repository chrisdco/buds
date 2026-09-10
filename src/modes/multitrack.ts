import { distToPolylineM } from "@/lib/geo";
import { arrivalConditions, personalDest, routeInsight, travelers } from "@/modes/shared";
import type { ClientSnapshot, MemberInsight, ModeStrategy } from "@/modes/types";
import type { RouteResult } from "@/types/contracts";

const OVERLAP_TOLERANCE_M = 150;
const MAX_SAMPLES = 25;

/**
 * Share of `mine`'s sampled route points lying within tolerance of `other`'s
 * route — the "common segment" signal for convoys with different end points.
 * Exported for tests.
 */
export function computeOverlapPct(mine: RouteResult, other: RouteResult): number {
  if (mine.coords.length < 2 || other.coords.length < 2) return 0;
  const step = Math.max(1, Math.floor(mine.coords.length / MAX_SAMPLES));
  let samples = 0;
  let near = 0;
  for (let i = 0; i < mine.coords.length; i += step) {
    const s = mine.coords[i];
    // Skip malformed sample points (old turf path threw and aborted the
    // whole insight pass on one bad point).
    if (!Array.isArray(s) || !Number.isFinite(s[0]) || !Number.isFinite(s[1])) {
      continue;
    }
    samples++;
    // Local equirectangular math (lib/geo): same 150m semantics as before,
    // without a turf scan per sample per pair per tick.
    const distM = distToPolylineM(s[1], s[0], other.coords);
    if (distM <= OVERLAP_TOLERANCE_M) near++;
  }
  return samples === 0 ? 0 : Math.round((near / samples) * 100);
}

function insightsFor(snap: ClientSnapshot, viewerId: string) {
  const perMember: Record<string, MemberInsight> = {};
  const myRoute = snap.routes[viewerId];
  for (const m of travelers(snap)) {
    const insight = routeInsight(snap, m.userId);
    if (m.userId !== viewerId && myRoute) {
      const theirRoute = snap.routes[m.userId];
      if (theirRoute) insight.overlapPct = computeOverlapPct(myRoute, theirRoute);
    }
    perMember[m.userId] = insight;
  }
  return perMember;
}

export const multitrackStrategy: ModeStrategy = {
  id: "multitrack",
  label: "Multi-track",
  destinationPolicy: "per-member",

  effectiveDestinationFor: (snap, userId) => personalDest(snap, userId),

  computeInsights: (snap, viewerId) => {
    const perMember = insightsFor(snap, viewerId);
    const shared = Object.values(perMember).filter(
      (i) => i.userId !== viewerId && (i.overlapPct ?? 0) >= 30,
    ).length;
    return {
      headline: shared > 0 ? `${shared} of your buds share part of your route` : null,
      perMember,
    };
  },

  alertConditions: (snap, viewerId) => arrivalConditions(snap, viewerId),

  cameraTarget: (snap, viewerId) =>
    snap.members[viewerId]?.pos
      ? { kind: "follow", userId: viewerId }
      : { kind: "fitAll" },
};
