// The arrival moment, as pure data: which card (if any) the room screen
// shows once you get there, and once everyone has. No React, so it's
// unit-tested directly.

export interface ArrivalPerson {
  userId: string;
  arrivedAt: string | null;
}

export type ArrivalMoment =
  | {
      kind: "self";
      /** Dedupe key: one card per arrival. */
      key: string;
      /** 1-based order you arrived in. */
      rank: number;
      total: number;
      /** Travelers still on the way. */
      remaining: number;
    }
  | { kind: "all"; key: string; total: number };

/** Your own "You've arrived" card stays up this long after arrival. */
export const SELF_CARD_MS = 2 * 60_000;

export function arrivalMoment(args: {
  roomId: string;
  travelers: ArrivalPerson[];
  myUserId: string | null;
  nowMs: number;
  dismissed: ReadonlySet<string>;
}): ArrivalMoment | null {
  const { roomId, travelers, myUserId, nowMs, dismissed } = args;
  const total = travelers.length;
  if (total === 0) return null;
  const arrived = travelers
    .filter((t) => t.arrivedAt != null)
    .sort((a, b) => Date.parse(a.arrivedAt!) - Date.parse(b.arrivedAt!));

  // A group trip that's done: suggest wrapping up (stops everyone sharing).
  // Solo trips fall through to the self card, which carries the same action.
  if (total >= 2 && arrived.length === total) {
    const key = `${roomId}:all`;
    return dismissed.has(key) ? null : { kind: "all", key, total };
  }

  const mine = myUserId ? arrived.findIndex((t) => t.userId === myUserId) : -1;
  if (mine < 0) return null;
  const at = Date.parse(arrived[mine].arrivedAt!);
  // Only right after arriving: reopening the room an hour later isn't a moment.
  if (!Number.isFinite(at) || nowMs - at > SELF_CARD_MS) return null;
  const key = `${roomId}:self:${arrived[mine].arrivedAt}`;
  if (dismissed.has(key)) return null;
  return { kind: "self", key, rank: mine + 1, total, remaining: total - arrived.length };
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Who's reading: decides which wrap-up the card can offer. */
export type ArrivalViewer = "host" | "traveler" | "watcher";

/** The card's second line, matching the button it offers (if any). */
export function arrivalBody(m: ArrivalMoment, viewer: ArrivalViewer): string {
  if (m.kind === "all" || m.total === 1) {
    const lead = m.kind === "all" ? "" : "Trip done. ";
    if (viewer === "host") return `${lead}End the trip so everyone stops sharing their location.`;
    if (viewer === "traveler") return `${lead}Leave the room to stop sharing your location.`;
    return `${lead}The host can end the trip.`;
  }
  const still = `${m.remaining} still on the way`;
  return m.rank === 1 ? `First one here · ${still}` : `${ordinal(m.rank)} of ${m.total} · ${still}`;
}
