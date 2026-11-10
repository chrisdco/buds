import type { TextStyle } from "react-native";

import { fontFamily } from "@/constants/fonts";
import { palettes, type Palette, type Scheme } from "@/constants/theme";

// Headings use the Geist Serif of the app icon (our identity, not Uber's
// bold grotesque); everything you read in rows stays Inter. Serif has one
// weight, so heads lean on size, not boldness. To go back to all-Inter set
// HEADING to { fontFamily: fontFamily.bold }.
const HEADING = { fontFamily: fontFamily.serif, letterSpacing: -0.3 } satisfies TextStyle;

// Named type scale (docs/ui-critique.md §4), read off the Uber references:
// bold sentence-case heads, a centered nav title on pushed screens, large
// secondary text (dimmer, not smaller), and the deciding value as the
// biggest text in a row. Nothing below 12pt off the map.
function buildTypeScale(colors: Palette) {
  return {
    /** Tab roots ("Trips", "Account"). */
    display: { color: colors.text, fontSize: 30, lineHeight: 36, ...HEADING },
    /** Centered title in NavHeader ("Plan your trip"). */
    navTitle: { color: colors.text, fontSize: 18, fontFamily: fontFamily.semiBold },
    /** Section heads ("For you", "Recent"). */
    section: { color: colors.text, fontSize: 22, lineHeight: 28, ...HEADING },
    /** Bottom-sheet title ("Choose a trip"). */
    sheetTitle: { color: colors.text, fontSize: 22, lineHeight: 28, ...HEADING },
    /** List-row primary line. */
    rowTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontFamily: fontFamily.semiBold },
    /** List-row secondary line: as large as readable, only dimmer. */
    rowSub: { color: colors.textDim, fontSize: 14, lineHeight: 19, fontFamily: fontFamily.regular },
    /** The deciding number in a row (Uber's price slot): ETA, count. */
    value: {
      color: colors.text,
      fontSize: 17,
      fontFamily: fontFamily.semiBold,
      fontVariant: ["tabular-nums"],
    },
    body: { color: colors.text, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.regular },
    meta: { color: colors.textDim, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium },
  } satisfies Record<string, TextStyle>;
}

export type TypeScale = ReturnType<typeof buildTypeScale>;

/** Per scheme; components read it through useTypeScale(). */
export const typeScales: Record<Scheme, TypeScale> = {
  dark: buildTypeScale(palettes.dark),
  light: buildTypeScale(palettes.light),
};
