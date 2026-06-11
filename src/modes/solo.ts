import { arrivalConditions, personalDest, routeInsight } from "@/modes/shared";
import type { ModeStrategy } from "@/modes/types";
import { formatDurationS } from "@/lib/time";

export const soloStrategy: ModeStrategy = {
  id: "solo",
  label: "Solo",
  destinationPolicy: "optional-personal",

  effectiveDestinationFor: (snap, userId) => personalDest(snap, userId),

  computeInsights: (snap, viewerId) => {
    const mine = routeInsight(snap, viewerId);
    return {
      headline: mine.etaS != null ? `ETA ${formatDurationS(mine.etaS)}` : null,
      perMember: { [viewerId]: mine },
    };
  },

  alertConditions: (snap, viewerId) => arrivalConditions(snap, viewerId),

  cameraTarget: (snap, viewerId) =>
    snap.members[viewerId]?.pos
      ? { kind: "follow", userId: viewerId }
      : { kind: "fitAll" },
};
