export const colors = {
  // Uber duet adapted to our dark product: ink black canvas, white primary
  // CTAs, neutral grays. Blue survives ONLY as information color (live
  // codes, ETAs, links) — never decoration. Member hues are wayfinding.
  bg: "#000000",
  surface: "#111111",
  surfaceAlt: "#1A1A1A",
  border: "#2A2A2A",
  text: "#FFFFFF",
  textDim: "#A8A8A8",
  /** Primary CTA surface (Uber polarity flip for dark mode). */
  primary: "#FFFFFF",
  onPrimary: "#000000",
  accent: "#4F8EF7",
  danger: "#E5484D",
  success: "#46A758",
  warning: "#F5A623",
  /** Map chrome pills/labels floating over tiles. */
  scrim: "rgba(0,0,0,0.85)",
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
