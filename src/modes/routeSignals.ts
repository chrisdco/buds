import type { ClientSnapshot, ModeInsights } from "@/modes/types";
import { DEFAULT_SEPARATION_ALERT_M } from "@/modes/types";
import { travelers } from "@/modes/shared";
import { DEVIATION_THRESHOLD_M, distanceFromRouteM } from "@/services/routing/deviation";

// "Late or off route" (docs/route-view.md 4.2): who gets the amber casing.
// Pure and per-viewer like the rest of the mode engine. A person is flagged
// when any of these hold:
// - off route: farther than the deviation threshold from their own road
//   route (estimates are skipped — a straight line isn't a road);
// - formation: outside the group radius;
// - follow leader: farther behind the leader than the separation alert;
// - meet up: their ETA trails the group's median by 10+ min and 50%+.
// Own way and solo compare nobody to anybody, so only off route applies.

const LATE_MIN_GAP_S = 600;
const LATE_MIN_RATIO = 0.5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function lateUserIds(snap: ClientSnapshot, insights: ModeInsights): Set<string> {
  const out = new Set<string>();
  const active = travelers(snap).filter((m) => m.arrivedAt == null);

  for (const m of active) {
    const route = snap.routes[m.userId];
    if (m.pos && route && route.source !== "straightline" && route.coords.length >= 2) {
      if (distanceFromRouteM(route, m.pos.lat, m.pos.lng) > DEVIATION_THRESHOLD_M) out.add(m.userId);
    }
  }

  const mode = snap.room.mode;
  if (mode === "formation") {
    for (const m of active) if (insights.perMember[m.userId]?.outsideRadius) out.add(m.userId);
  } else if (mode === "leader") {
    const limit = snap.room.settings.separation_alert_m ?? DEFAULT_SEPARATION_ALERT_M;
    for (const m of active) {
      if (m.userId === snap.room.leader_id) continue;
      const d = insights.perMember[m.userId]?.distanceToLeaderM;
      if (d != null && d > limit) out.add(m.userId);
    }
  } else if (mode === "converge") {
    const etas = active
      .map((m) => ({ id: m.userId, eta: insights.perMember[m.userId]?.etaS }))
      .filter((e): e is { id: string; eta: number } => e.eta != null && Number.isFinite(e.eta));
    if (etas.length >= 3) {
      const med = median(etas.map((e) => e.eta));
      const bar = med + Math.max(LATE_MIN_GAP_S, med * LATE_MIN_RATIO);
      for (const e of etas) if (e.eta >= bar) out.add(e.id);
    }
  }
  return out;
}
