import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { create } from "zustand";

// Appearance preference (Profile > Appearance): follow the phone, or pin
// light / dark. Pinning also tells the OS (Appearance.setColorScheme), so
// native surfaces (sheets, pickers, dialogs) match the JS theme; "system"
// hands control back, which also overrides a build-time dark lock.

export type ThemePref = "system" | "light" | "dark";

const KEY = "buds.theme";
const PREFS: readonly ThemePref[] = ["system", "light", "dark"];

function applyNative(pref: ThemePref) {
  try {
    Appearance.setColorScheme(pref === "system" ? "unspecified" : pref);
  } catch {
    // Older native shells without the override still follow the JS theme.
  }
}

interface ThemeState {
  pref: ThemePref;
  ready: boolean;
  hydrate: () => Promise<void>;
  setPref: (pref: ThemePref) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  pref: "system",
  ready: false,
  hydrate: async () => {
    let pref: ThemePref = "system";
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw && (PREFS as readonly string[]).includes(raw)) pref = raw as ThemePref;
    } catch {
      // Unreadable storage: follow the phone.
    }
    applyNative(pref);
    set({ pref, ready: true });
  },
  setPref: (pref) => {
    applyNative(pref);
    set({ pref });
    void AsyncStorage.setItem(KEY, pref).catch(() => {});
  },
}));
