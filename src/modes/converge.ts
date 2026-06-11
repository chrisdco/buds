import { formatDurationS } from "@/lib/time";
import { arrivalConditions, roomDest, routeInsight, travelers } from "@/modes/shared";
import type { MemberInsight, ModeStrategy } from "@/modes/types";

// Everyone heads to ONE shared destination. Ranking is read from the
// persisted arrived_at ordering (DB truth), never from broadcasts.
export const convergeStrategy: ModeStrategy = {
  id: "converge",
  label: "Converge",
  destinationPolicy: "room",

  effectiveDestinationFor: (snap, userId) => {
    const m = snap.members[userId];
    if (!m || m.role !== "traveler") return null;
    return roomDest(snap);
  },

  computeInsights: (snap) => {
    const all = travelers(snap);
    const perMember: Record<string, MemberInsight> = {};

    const arrived = all
      .filter((m) => m.arrivedAt != null)
      .sort((a, b) => Date.parse(a.arrivedAt!) - Date.parse(b.arrivedAt!));
    arrived.forEach((m, i) => {
      perMember[m.userId] = { userId: m.userId, arrivedRank: i + 1 };
    });

    let slowestEtaS: number | undefined;
    for (const m of all) {
      if (m.arrivedAt != null) continue;
      const insight = routeInsight(snap, m.userId);
      perMember[m.userId] = insight;
      if (insight.etaS != null && (slowestEtaS == null || insight.etaS > slowestEtaS)) {
        slowestEtaS = insight.etaS;
      }
    }

    let headline: string | null = null;
    if (!snap.destRoom) {
      headline = "No destination yet — the host long-presses the map to set one";
    } else if (all.length > 0 && arrived.length === all.length) {
      headline = "Everyone has arrived 🎉";
    } else if (slowestEtaS != null) {
      headline = `${arrived.length}/${all.length} arrived · last ETA ${formatDurationS(slowestEtaS)}`;
    } else if (all.length > 0) {
      headline = `${arrived.length}/${all.length} arrived`;
    }

    return { headline, perMember };
  },

  alertConditions: (snap, viewerId) => arrivalConditions(snap, viewerId),

  cameraTarget: () => ({ kind: "fitAll" }),
};
