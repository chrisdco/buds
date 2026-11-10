export type Scheme = "light" | "dark";

/** Every UI color token; one palette per scheme (useColors() picks it). */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  /** Raised selected surfaces (tab pill): one step above surfaceAlt. */
  raised: string;
  /** Chips, pills and buttons floating over the map. */
  floating: string;
  /** Hairline dividers between rows. Never a box outline. */
  border: string;
  text: string;
  textDim: string;
  /** Primary CTA surface (Uber polarity: white on dark, black on light). */
  primary: string;
  onPrimary: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
  /** Dark text on the amber warning surface (banners, countdowns). */
  onWarning: string;
  /** Map chrome pills/labels floating over tiles. */
  scrim: string;
  /** Selected wash on glass (a solid fill would punch a hole). */
  wash: string;
  /** Accent-tinted backgrounds (saved-place icon, my-location halo). */
  accentWash: string;
  /** Ink and paper of the line-art people (Open Peeps / Doodles). */
  artInk: string;
  artPaper: string;
}

export const palettes: Record<Scheme, Palette> = {
  // Uber duet adapted to our dark product: ink black canvas, white primary
  // CTAs, neutral grays. Blue survives ONLY as information color (live
  // codes, ETAs, links), never decoration. Member hues are wayfinding.
  // Canvas sits just off pure black so surfaces can step up from it; each
  // step is fill, not outline (critique 1.1). Borders are hairline
  // dividers only, and 2px text color means "selected".
  dark: {
    bg: "#0B0B0C",
    surface: "#18181A",
    surfaceAlt: "#232326",
    raised: "#2E2E32",
    floating: "#18181A",
    border: "#2C2C2F",
    text: "#FFFFFF",
    textDim: "#A8A8A8",
    primary: "#FFFFFF",
    onPrimary: "#000000",
    accent: "#4F8EF7",
    danger: "#E5484D",
    success: "#46A758",
    warning: "#F5A623",
    onWarning: "#1A1300",
    scrim: "rgba(0,0,0,0.85)",
    wash: "rgba(255,255,255,0.14)",
    accentWash: "rgba(79,142,247,0.2)",
    artInk: "#FFFFFF",
    artPaper: "#1A1A1A",
  },
  // The same language on paper: white canvas, light-gray fills stepping
  // down, black primary CTAs, white pills floating over the map.
  light: {
    bg: "#FFFFFF",
    surface: "#F3F3F3",
    surfaceAlt: "#EAEAEA",
    raised: "#DEDEDE",
    floating: "#FFFFFF",
    border: "#E6E6E6",
    text: "#000000",
    textDim: "#5E5E5E",
    primary: "#000000",
    onPrimary: "#FFFFFF",
    accent: "#276EF1",
    danger: "#D92D33",
    success: "#0E8345",
    warning: "#F5A623",
    onWarning: "#1A1300",
    scrim: "rgba(255,255,255,0.94)",
    wash: "rgba(0,0,0,0.07)",
    accentWash: "rgba(39,110,241,0.14)",
    artInk: "#000000",
    artPaper: "#FFFFFF",
  },
};

export type CardTint = "blue" | "violet" | "green" | "amber" | "rose";

/**
 * Muted panels behind illustrations on Home's idea cards: hue enough to
 * tell cards apart at a glance, quiet enough that text and the art keep
 * their contrast. Decoration only; never used for state.
 */
export const cardTints: Record<Scheme, Record<CardTint, string>> = {
  dark: {
    blue: "#1B2738",
    violet: "#262036",
    green: "#1B2E26",
    amber: "#33281A",
    rose: "#33202A",
  },
  light: {
    blue: "#E4EDFB",
    violet: "#ECE7F7",
    green: "#E2F2E8",
    amber: "#FAEEDB",
    rose: "#F9E4EA",
  },
};

/**
 * Text drawn ON a member hue or the accent, same in both schemes (the hue
 * doesn't change with the theme): dark labels on ETA chips and route time
 * bubbles, white glyphs inside map pins.
 */
export const onHue = { label: "#000000", glyph: "#FFFFFF" } as const;

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
