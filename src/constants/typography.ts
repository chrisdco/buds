import type { TextStyle } from "react-native";

import { fontFamily } from "@/constants/fonts";
import { colors } from "@/constants/theme";

// Named type scale (docs/ui-critique.md §4), read off the Uber references:
// bold sentence-case heads, a centered nav title on pushed screens, large
// secondary text (dimmer, not smaller), and the deciding value as the
// biggest text in a row. Nothing below 12pt off the map.
export const typeScale = {
  /** Tab roots ("Trips", "Account"). */
  display: { color: colors.text, fontSize: 30, lineHeight: 36, fontFamily: fontFamily.bold },
  /** Centered title in NavHeader ("Plan your trip"). */
  navTitle: { color: colors.text, fontSize: 20, fontFamily: fontFamily.semiBold },
  /** Section heads ("For you", "Recent"). */
  section: { color: colors.text, fontSize: 22, lineHeight: 28, fontFamily: fontFamily.bold },
  /** Bottom-sheet title ("Choose a trip"). */
  sheetTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontFamily: fontFamily.bold },
  /** List-row primary line. */
  rowTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontFamily: fontFamily.semiBold },
  /** List-row secondary line: as large as readable, only dimmer. */
  rowSub: { color: colors.textDim, fontSize: 15, lineHeight: 20, fontFamily: fontFamily.regular },
  /** The deciding number in a row (Uber's price slot): ETA, count. */
  value: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.semiBold,
    fontVariant: ["tabular-nums"],
  },
  body: { color: colors.text, fontSize: 16, lineHeight: 22, fontFamily: fontFamily.regular },
  meta: { color: colors.textDim, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium },
} satisfies Record<string, TextStyle>;
