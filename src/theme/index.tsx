import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";

import { cardTints, palettes, type CardTint, type Palette, type Scheme } from "@/constants/theme";
import { typeScales, type TypeScale } from "@/constants/typography";
import { useThemeStore } from "@/stores/themeStore";

// Live theme: one Scheme in context, resolved from the Appearance pref and
// the phone's setting. Components read colors through hooks so a switch
// repaints in place (no reload, no lost navigation state). Styles are
// built once per scheme and cached, so a hook call is a context read plus
// a lookup, never a fresh StyleSheet.

const SchemeContext = createContext<Scheme>("dark");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useThemeStore((s) => s.pref);
  const system = useColorScheme();
  const scheme: Scheme = pref === "system" ? (system === "light" ? "light" : "dark") : pref;
  return <SchemeContext.Provider value={scheme}>{children}</SchemeContext.Provider>;
}

export function useScheme(): Scheme {
  return useContext(SchemeContext);
}

export function useColors(): Palette {
  return palettes[useScheme()];
}

export function useTypeScale(): TypeScale {
  return typeScales[useScheme()];
}

export function useCardTints(): Record<CardTint, string> {
  return cardTints[useScheme()];
}

type NamedStyles<T> = { [P in keyof T]: StyleSheet.NamedStyles<T>[P] };

/**
 * `const useStyles = makeStyles((c, ts) => ({ ... }))`, then
 * `const styles = useStyles()` inside the component. Built once per scheme.
 */
export function makeStyles<T extends NamedStyles<T>>(
  factory: (colors: Palette, ts: TypeScale) => T,
): () => T {
  const cache: Partial<Record<Scheme, T>> = {};
  return function useStyles() {
    const scheme = useScheme();
    return (cache[scheme] ??= StyleSheet.create(factory(palettes[scheme], typeScales[scheme])));
  };
}
