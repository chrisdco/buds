import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { randomId } from "@/lib/ids";
import { ACTIVE_ROOM_KEY, RECENTS_KEY, getRecentRooms } from "@/lib/activeRoom";
import { supabase } from "@/lib/supabaseClient";
import type { DistanceUnit } from "@/lib/geo";
import type { NotifyCategory } from "@/events/notifyPrefs";

const NAME_KEY = "buds.displayName";
const DEVICE_KEY = "buds.deviceId";
const BG_SHARING_KEY = "buds.backgroundSharing";
const PRIMED_LOCATION_KEY = "buds.primedLocation";
const PRIMED_NOTIFICATIONS_KEY = "buds.primedNotifications";
const PRIMED_BACKGROUND_KEY = "buds.primedBackground";
const UNITS_KEY = "buds.units";
const NOTIFY_PREFS_KEY = "buds.notifyPrefs";

export const ALL_NOTIFY_CATEGORIES: Exclude<NotifyCategory, "other">[] = [
  "arrivals",
  "separation",
  "detours",
  "reconnections",
];

interface SessionState {
  userId: string | null;
  displayName: string;
  deviceId: string;
  /** User opted in to sharing location with the screen off. */
  backgroundSharing: boolean;
  /** Permission priming sheets seen (double-prompt pattern). */
  primedLocation: boolean;
  primedNotifications: boolean;
  primedBackground: boolean;
  units: DistanceUnit;
  /** Background OS notifications per alert category (foreground toasts always show). */
  notifyPrefs: Record<Exclude<NotifyCategory, "other">, boolean>;
  ready: boolean;
  error: string | null;
  init: () => Promise<void>;
  setDisplayName: (name: string) => void;
  setBackgroundSharing: (enabled: boolean) => void;
  setPrimed: (key: "location" | "notifications" | "background") => void;
  setUnits: (units: DistanceUnit) => void;
  setNotifyPref: (category: NotifyCategory, enabled: boolean) => void;
  /** Fresh anonymous identity, keeps name + prefs. */
  resetIdentity: () => Promise<void>;
  /** Leave all known rooms, wipe local data, fresh identity. */
  wipeAllData: (leaveRooms: (roomId: string) => Promise<unknown>) => Promise<void>;
}

// Zero-friction identity: anonymous Supabase session + a display name typed
// at join time. No accounts, no passwords.
export const useSessionStore = create<SessionState>()((set, get) => ({
  userId: null,
  displayName: "",
  deviceId: randomId(),
  backgroundSharing: false,
  primedLocation: false,
  primedNotifications: false,
  primedBackground: false,
  units: "km",
  notifyPrefs: { arrivals: true, separation: true, detours: true, reconnections: true },
  ready: false,
  error: null,

  init: async () => {
    if (get().ready && get().userId) return;
    set({ error: null });
    try {
      const [storedName, storedDevice, storedBg, primedLoc, primedNotif, primedBg, units, prefs] =
        await Promise.all([
          AsyncStorage.getItem(NAME_KEY),
          AsyncStorage.getItem(DEVICE_KEY),
          AsyncStorage.getItem(BG_SHARING_KEY),
          AsyncStorage.getItem(PRIMED_LOCATION_KEY),
          AsyncStorage.getItem(PRIMED_NOTIFICATIONS_KEY),
          AsyncStorage.getItem(PRIMED_BACKGROUND_KEY),
          AsyncStorage.getItem(UNITS_KEY),
          AsyncStorage.getItem(NOTIFY_PREFS_KEY),
        ]);

      let deviceId = storedDevice;
      if (!deviceId) {
        deviceId = randomId();
        await AsyncStorage.setItem(DEVICE_KEY, deviceId);
      }

      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }

      let notifyPrefs = get().notifyPrefs;
      try {
        const parsed = prefs
          ? (JSON.parse(prefs) as Partial<Record<Exclude<NotifyCategory, "other">, boolean>>)
          : null;
        if (parsed) {
          notifyPrefs = { ...notifyPrefs };
          for (const c of ALL_NOTIFY_CATEGORIES) {
            if (typeof parsed[c] === "boolean") notifyPrefs[c] = parsed[c] as boolean;
          }
        }
      } catch {
        // Corrupt prefs fall back to all-on.
      }

      set({
        userId: session?.user.id ?? null,
        displayName: storedName ?? "",
        deviceId,
        backgroundSharing: storedBg === "1",
        primedLocation: primedLoc === "1",
        primedNotifications: primedNotif === "1",
        primedBackground: primedBg === "1",
        units: units === "mi" ? "mi" : "km",
        notifyPrefs,
        ready: true,
        error: session ? null : "Could not start a session.",
      });
    } catch (e) {
      set({
        ready: true,
        error:
          e instanceof Error
            ? e.message
            : "Could not reach the server. Check your connection and retry.",
      });
    }
  },

  setDisplayName: (name) => {
    set({ displayName: name });
    void AsyncStorage.setItem(NAME_KEY, name);
  },

  setBackgroundSharing: (enabled) => {
    set({ backgroundSharing: enabled });
    void AsyncStorage.setItem(BG_SHARING_KEY, enabled ? "1" : "0");
  },

  setPrimed: (key) => {
    const storageKey =
      key === "location"
        ? PRIMED_LOCATION_KEY
        : key === "notifications"
          ? PRIMED_NOTIFICATIONS_KEY
          : PRIMED_BACKGROUND_KEY;
    const stateKey =
      key === "location" ? "primedLocation" : key === "notifications" ? "primedNotifications" : "primedBackground";
    set({ [stateKey]: true });
    void AsyncStorage.setItem(storageKey, "1");
  },

  setUnits: (units) => {
    set({ units });
    void AsyncStorage.setItem(UNITS_KEY, units);
  },

  setNotifyPref: (category, enabled) => {
    const notifyPrefs = { ...get().notifyPrefs, [category]: enabled };
    set({ notifyPrefs });
    void AsyncStorage.setItem(NOTIFY_PREFS_KEY, JSON.stringify(notifyPrefs));
  },

  resetIdentity: async () => {
    await supabase.auth.signOut();
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    set({ userId: data.session?.user.id ?? null });
  },

  wipeAllData: async (leaveRooms) => {
    const recents = await getRecentRooms();
    for (const r of recents) {
      try {
        await leaveRooms(r.id);
      } catch {
        // Best-effort: rooms may be ended or unreachable.
      }
    }
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove([
      NAME_KEY,
      DEVICE_KEY,
      BG_SHARING_KEY,
      PRIMED_LOCATION_KEY,
      PRIMED_NOTIFICATIONS_KEY,
      PRIMED_BACKGROUND_KEY,
      NOTIFY_PREFS_KEY,
      ACTIVE_ROOM_KEY,
      RECENTS_KEY,
    ]);
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    set({
      userId: data.session?.user.id ?? null,
      displayName: "",
      deviceId: randomId(),
      backgroundSharing: false,
      primedLocation: false,
      primedNotifications: false,
      primedBackground: false,
      units: "km",
      notifyPrefs: { arrivals: true, separation: true, detours: true, reconnections: true },
    });
    await AsyncStorage.setItem(DEVICE_KEY, get().deviceId);
  },
}));
