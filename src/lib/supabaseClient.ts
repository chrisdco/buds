import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "@/types/supabase";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * False when the build was made without the two env values (e.g. an EAS
 * build whose environment has no variables: .env is gitignored, so it is
 * never uploaded). The root layout then shows a setup screen instead of
 * crashing at import time, which in a release build closes the app before
 * any UI or log is visible.
 */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Locally: copy .env.example to .env and restart the dev server. " +
      "EAS: set both for the build profile's environment (eas env:create).",
  );
}

// Typed against the checked-in generated schema (src/types/supabase.ts,
// refreshed via `npx supabase gen types typescript --local`; CI fails on
// drift). RPC arg/return mismatches now break the build, not the device.
export const supabase = createClient<Database>(url ?? "https://unconfigured.invalid", anonKey ?? "unconfigured", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Token auto-refresh only needs to run while the app is foregrounded.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
