export const colors = {
  // Uber duet adapted to our dark product: ink black canvas, white primary
  // CTAs, neutral grays. Blue survives ONLY as information color (live
  // codes, ETAs, links) — never decoration. Member hues are wayfinding.
  // Canvas sits just off pure black so surfaces can step up from it; each
  // step is fill, not outline (critique §1.1). Borders are hairline
  // dividers only, and 2px white means "selected".
  bg: "#0B0B0C",
  surface: "#18181A",
  surfaceAlt: "#232326",
  /** Raised selected surfaces (tab pill) — one step above surfaceAlt so the
  focused tab reads instantly, Uber's lighter-pill language. */
  raised: "#2E2E32",
  /** Hairline dividers between rows. Never a box outline. */
  border: "#2C2C2F",
  text: "#FFFFFF",
  textDim: "#A8A8A8",
  /** Primary CTA surface (Uber polarity flip for dark mode). */
  primary: "#FFFFFF",
  onPrimary: "#000000",
  accent: "#4F8EF7",
  danger: "#E5484D",
  success: "#46A758",
  warning: "#F5A623",
  /** Dark text on the amber warning surface (banners, countdowns). */
  onWarning: "#1A1300",
  /** Map chrome pills/labels floating over tiles. */
  scrim: "rgba(0,0,0,0.85)",
};

/**
 * Muted panels behind illustrations on Home's idea cards: hue enough to
 * tell cards apart at a glance, dark enough that white text and the art
 * keep their contrast. Decoration only; never used for state.
 */
export const cardTints = {
  blue: "#1B2738",
  violet: "#262036",
  green: "#1B2E26",
  amber: "#33281A",
  rose: "#33202A",
};

const memberPalette = [
  "#F94144",
  "#F3722C",
  "#F8961E",
  "#F9C74F",
  "#90BE6D",
  "#43AA8B",
  "#577590",
  "#9B5DE5",
  "#F15BB5",
  "#00BBF9",
];

/** Stable, well-distributed color per participant. */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return memberPalette[Math.abs(hash) % memberPalette.length];
}

/** Spacing scale — the only source of layout rhythm (margins, gaps, radii-adjacent padding). */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/**
 * Radius scale — pills are always full, cards lg, banners/inputs md, small
 * bits sm. Circle radii (half of an avatar size) stay inline: they derive
 * from the size, they aren't design decisions.
 */
export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  full: 999,
};
