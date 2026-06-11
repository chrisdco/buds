import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { randomId } from "@/lib/ids";
import { supabase } from "@/lib/supabaseClient";

const NAME_KEY = "buds.displayName";
const DEVICE_KEY = "buds.deviceId";

interface SessionState {
  userId: string | null;
  displayName: string;
  deviceId: string;
  ready: boolean;
  error: string | null;
  init: () => Promise<void>;
  setDisplayName: (name: string) => void;
}

// Zero-friction identity: anonymous Supabase session + a display name typed
// at join time. No accounts, no passwords.
export const useSessionStore = create<SessionState>()((set, get) => ({
  userId: null,
  displayName: "",
  deviceId: randomId(),
  ready: false,
  error: null,

  init: async () => {
    if (get().ready && get().userId) return;
    set({ error: null });
    try {
      const [storedName, storedDevice] = await Promise.all([
        AsyncStorage.getItem(NAME_KEY),
        AsyncStorage.getItem(DEVICE_KEY),
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

      set({
        userId: session?.user.id ?? null,
        displayName: storedName ?? "",
        deviceId,
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
}));
