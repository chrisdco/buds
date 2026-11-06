import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

/**
 * Settings we can change without a release (Supabase `app_config`, one row
 * per top-level key). Every section is parsed on its own with defaults, so
 * a bad or missing row only falls back that section; the app never depends
 * on this loading. Read sync via getAppConfig(); refreshed once at launch,
 * last good copy cached for offline starts.
 */
const RoutingSchema = z.object({
  /** Route through the `route` Edge Function before the direct chain. */
  proxy: z.boolean().catch(true),
});

const RouteViewSchema = z.object({
  /** Phase 1 lenses: chips, tiers by lens, lens camera (route-view 10). */
  lenses: z.boolean().catch(true),
});

const AppConfigSchema = z.object({
  routing: RoutingSchema.catch({ proxy: true }),
  routeView: RouteViewSchema.catch({ lenses: true }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

const CACHE_KEY = "app_config_v1";

export function parseAppConfig(raw: unknown): AppConfig {
  const obj = raw && typeof raw === "object" ? raw : {};
  return AppConfigSchema.parse({ routing: {}, routeView: {}, ...obj });
}

let current: AppConfig = parseAppConfig({});

export function getAppConfig(): AppConfig {
  return current;
}

/** Test seam. */
export function setAppConfigForTest(cfg: unknown): void {
  current = parseAppConfig(cfg);
}

export async function loadAppConfig(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) current = parseAppConfig(JSON.parse(cached));
  } catch {
    // corrupt cache: keep defaults
  }
  if (!supabaseConfigured) return;
  try {
    const { data, error } = await supabase.from("app_config").select("key, value");
    if (error || !data) return;
    const raw = Object.fromEntries(data.map((r) => [r.key, r.value]));
    current = parseAppConfig(raw);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  } catch {
    // offline: cached or default config stays
  }
}
