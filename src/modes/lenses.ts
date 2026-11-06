import type { RoomMode } from "@/types/contracts";

// Route view lenses (docs/route-view.md section 5). A lens is a named rule
// for which people's routes are emphasized; a tier is how strongly one
// route is drawn. Everything here is pure: the map, the markers, the
// legend and the camera all read the same assignment.

export type Lens = "everyone" | "me" | "stragglers" | "arrivals";
export type Tier = "primary" | "secondary" | "context" | "hidden";

export const LENS_LABEL: Record<Lens, string> = {
  everyone: "Everyone",
  me: "Me",
  stragglers: "Stragglers",
  arrivals: "Arrivals",
};

/** Which lenses a mode offers, default first. Empty = no switcher. */
const LENSES_BY_MODE: Record<RoomMode, Lens[]> = {
  converge: ["everyone", "me", "stragglers", "arrivals"],
  leader: ["everyone", "me", "stragglers"],
  formation: ["everyone", "me"],
  // Own way: everyone heads somewhere different, so "latest" across
  // different destinations means nothing. Stragglers stays on offer, last,
  // as "Off route": it ranks by who left their route instead of by ETA.
  multitrack: ["me", "everyone", "stragglers"],
  solo: [],
};

/** How Stragglers decides who's behind: by ETA, or by who's off route. */
export type StragglerRank = "eta" | "late";

export function stragglerRank(mode: RoomMode): StragglerRank {
  return mode === "multitrack" ? "late" : "eta";
}

/** Chip / legend name; Stragglers reads "Off route" where it ranks that way. */
export function lensLabel(lens: Lens, mode: RoomMode): string {
  return lens === "stragglers" && stragglerRank(mode) === "late" ? "Off route" : LENS_LABEL[lens];
}

export function lensesFor(mode: RoomMode): Lens[] {
  return LENSES_BY_MODE[mode];
}

export function defaultLens(mode: RoomMode): Lens {
  return LENSES_BY_MODE[mode][0] ?? "everyone";
}

/** A lens that the mode doesn't offer falls back to the mode default. */
export function effectiveLens(mode: RoomMode, chosen: Lens | null): Lens {
  return chosen && LENSES_BY_MODE[mode].includes(chosen) ? chosen : defaultLens(mode);
}

export interface TierCaps {
  primary: number;
  secondary: number;
}

export const DEFAULT_CAPS: TierCaps = { primary: 3, secondary: 4 };

export interface PersonForTier {
  userId: string;
  /** Seconds to go; null when unknown (no route yet). */
  etaS: number | null;
  arrived: boolean;
}

export interface TierInput {
  people: PersonForTier[]; // travelers only
  myUserId: string | null;
  lens: Lens;
  /** Non-empty = the Focus override (tapped faces), whatever the lens. */
  focusIds: string[];
  caps?: TierCaps;
  /** Focus keeps your own route, faint (personal pref, default true). */
  focusShowsMe?: boolean;
  /** Stragglers ranking; "late" uses `late` instead of ETAs. */
  stragglerRank?: StragglerRank;
  /** Late / off-route people (modes/routeSignals). */
  late?: ReadonlySet<string>;
}

const TIER_RANK: Record<Tier, number> = { hidden: 0, context: 1, secondary: 2, primary: 3 };

export function tierRank(t: Tier): number {
  return TIER_RANK[t];
}

/** Latest first; unknown ETAs after known ones; stable by userId. */
function byLatest(a: PersonForTier, b: PersonForTier): number {
  if (a.etaS == null && b.etaS == null) return a.userId.localeCompare(b.userId);
  if (a.etaS == null) return 1;
  if (b.etaS == null) return -1;
  return b.etaS - a.etaS || a.userId.localeCompare(b.userId);
}

/**
 * How many others the Everyone lens keeps at secondary, by group size
 * (section 5.3): small groups see everyone, big ones see the latest few.
 */
function everyoneSecondaryCount(travelers: number, cap: number): number {
  if (travelers <= 4) return cap;
  if (travelers <= 7) return Math.min(cap, 4);
  return Math.min(cap, 2);
}

/** Stragglers: the latest 1-3 are primary, more as the group grows. */
function stragglersPrimaryCount(travelers: number): number {
  if (travelers <= 4) return 1;
  if (travelers <= 7) return 2;
  return 3;
}

/** Below the secondary cut, Everyone shows context lines up to 7 people. */
function everyoneRestTier(travelers: number): Tier {
  return travelers <= 7 ? "context" : "hidden";
}

export function assignTiers(input: TierInput): Record<string, Tier> {
  const caps = input.caps ?? DEFAULT_CAPS;
  const out: Record<string, Tier> = {};
  const active = input.people.filter((p) => !p.arrived);
  for (const p of input.people) out[p.userId] = "hidden"; // arrived: no line

  const self = input.myUserId;
  const others = active.filter((p) => p.userId !== self).sort(byLatest);
  const meActive = active.some((p) => p.userId === self);

  const focus = input.focusIds.filter((id) => active.some((p) => p.userId === id));
  if (focus.length > 0) {
    // Focus: the picked people, in pick order, primary up to the cap.
    focus.forEach((id, i) => {
      out[id] = i < caps.primary ? "primary" : "secondary";
    });
    // Your own line stays, faint, so you still know where you are —
    // unless you turned that off. Everyone else is hidden (faces dimmed).
    if ((input.focusShowsMe ?? true) && self && meActive && !focus.includes(self)) out[self] = "context";
    return out;
  }

  switch (input.lens) {
    case "me":
      if (self && meActive) out[self] = "primary";
      return out;
    case "arrivals":
      return out; // no lines; the list carries the order
    case "stragglers": {
      if (input.stragglerRank === "late") {
        // Off route: the people who left their route, in stable order;
        // everyone else stays as context so the picture isn't empty.
        let n = 0;
        for (const p of [...active].sort((a, b) => a.userId.localeCompare(b.userId))) {
          const isLate = input.late?.has(p.userId) ?? false;
          out[p.userId] = !isLate
            ? "context"
            : n < caps.primary
              ? "primary"
              : n < caps.primary + caps.secondary
                ? "secondary"
                : "context";
          if (isLate) n++;
        }
        return out;
      }
      const ranked = [...active].sort(byLatest);
      const primaryN = Math.min(stragglersPrimaryCount(active.length), caps.primary);
      ranked.forEach((p, i) => {
        out[p.userId] =
          i < primaryN ? "primary" : i < primaryN + Math.min(2, caps.secondary) ? "secondary" : "context";
      });
      return out;
    }
    case "everyone": {
      if (self && meActive) out[self] = "primary";
      const secondaryN = everyoneSecondaryCount(active.length, caps.secondary);
      const rest = everyoneRestTier(active.length);
      others.forEach((p, i) => {
        out[p.userId] = i < secondaryN ? "secondary" : rest;
      });
      return out;
    }
  }
}

/** "Showing 3 of 8": routes drawn at secondary or stronger vs travelers. */
export function legendCounts(tiers: Record<string, Tier>, travelers: number): { shown: number; total: number } {
  const shown = Object.values(tiers).filter((t) => t === "primary" || t === "secondary").length;
  return { shown, total: travelers };
}

/** Big groups (8+) get a nudge toward Stragglers: a dot on its chip. */
export function suggestStragglers(travelers: number, lens: Lens, focusing: boolean): boolean {
  return travelers >= 8 && lens !== "stragglers" && !focusing;
}

/** "12-31 min" across travelers still on the way; null when under two ETAs. */
export function etaRangeLabel(etas: (number | null | undefined)[]): string | null {
  const known = etas.filter((e): e is number => e != null && Number.isFinite(e));
  if (known.length < 2) return null;
  const lo = Math.max(1, Math.round(Math.min(...known) / 60));
  const hi = Math.max(1, Math.round(Math.max(...known) / 60));
  return lo === hi ? `${lo} min` : `${lo}–${hi} min`;
}
