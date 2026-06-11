export const colors = {
  bg: "#0F1115",
  surface: "#1A1D24",
  surfaceAlt: "#242833",
  border: "#2E3340",
  text: "#F2F4F8",
  textDim: "#9AA3B2",
  accent: "#4F8EF7",
  danger: "#E5484D",
  success: "#46A758",
  warning: "#F5A623",
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
