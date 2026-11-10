import { createContext, useContext } from "react";

import type { Scheme } from "@/constants/theme";

// The scheme context alone, with no store import, so pure modules (art,
// presets) can read the theme without pulling AsyncStorage into tests.
export const SchemeContext = createContext<Scheme>("dark");

export function useScheme(): Scheme {
  return useContext(SchemeContext);
}
