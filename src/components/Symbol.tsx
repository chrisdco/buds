import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { Text } from "react-native";

// Native platform icons with a guaranteed text fallback: SF Symbols on iOS,
// Material Symbols on Android. Every usage passes explicit per-platform
// names (validated by tsc against both catalogs) plus the text glyph it
// replaces, so no platform ever renders blank.
export interface AppSymbolName {
  ios: SFSymbol;
  android: AndroidSymbol;
}

interface AppSymbolProps {
  name: AppSymbolName;
  size?: number;
  tintColor?: string;
  /** Text rendered when the symbol is unavailable. Defaults to "?". */
  fallback?: string;
  testID?: string;
}

// NOTE: named AppSymbol (not Symbol) on purpose: a top-level `function
// Symbol` would shadow the global Symbol constructor for the whole module,
// which breaks compiler-generated code referencing Symbol.for.
export function AppSymbol({ name, size = 20, tintColor, fallback = "?", testID }: AppSymbolProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tintColor}
      fallback={<Text>{fallback}</Text>}
      testID={testID}
    />
  );
}

/** Shared chrome symbols (single source so both platforms stay in sync). */
export const icons = {
  back: { ios: "chevron.left", android: "arrow_back", fallback: "←" },
  invite: { ios: "plus", android: "add", fallback: "+" },
  // Fallbacks reuse the proven monochrome-forced glyphs (U+FE0E).
  settings: { ios: "gearshape", android: "settings", fallback: "⚙︎" },
  home: { ios: "house.fill", android: "home", fallback: "⌂" },
  trips: { ios: "map.fill", android: "map", fallback: "▤" },
  profile: { ios: "person.fill", android: "person", fallback: "●" },
  navigate: { ios: "arrow.up.right", android: "arrow_outward", fallback: "›" },
  search: { ios: "magnifyingglass", android: "search", fallback: "⌕" },
  history: { ios: "clock", android: "history", fallback: "↻" },
  recenter: { ios: "location", android: "my_location", fallback: "⊕" },
  star: { ios: "star.fill", android: "star", fallback: "★" },
  flag: { ios: "flag.fill", android: "flag", fallback: "⚑︎" },
  warning: { ios: "exclamationmark.triangle.fill", android: "warning", fallback: "⚠︎" },
  chevron: { ios: "chevron.right", android: "chevron_right", fallback: "›" },
  close: { ios: "xmark", android: "close", fallback: "×" },
  plus: { ios: "plus", android: "add", fallback: "+" },
  minus: { ios: "minus", android: "remove", fallback: "−" },
  arrowForward: { ios: "arrow.right", android: "arrow_forward", fallback: "→" },
  calendar: { ios: "calendar", android: "calendar_today", fallback: "▦" },
  clock: { ios: "clock", android: "schedule", fallback: "◷" },
  work: { ios: "briefcase.fill", android: "work", fallback: "▣" },
  pin: { ios: "mappin.and.ellipse", android: "location_on", fallback: "⌖" },
  globe: { ios: "globe", android: "public", fallback: "○" },
  qr: { ios: "qrcode.viewfinder", android: "qr_code_scanner", fallback: "▩" },
  paste: { ios: "doc.on.clipboard", android: "content_paste", fallback: "⎘" },
  share: { ios: "square.and.arrow.up", android: "share", fallback: "⇪" },
  group: { ios: "person.2.fill", android: "group", fallback: "◎" },
  code: { ios: "number", android: "tag", fallback: "#" },
  check: { ios: "checkmark", android: "check", fallback: "✓" },
  expand: { ios: "chevron.down", android: "expand_more", fallback: "▾" },
  collapse: { ios: "chevron.up", android: "expand_less", fallback: "▴" },
} as const;

export type IconName = keyof typeof icons;
