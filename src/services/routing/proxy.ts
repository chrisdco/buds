import { supabase } from "@/lib/supabaseClient";
import type { RouteFetcher } from "@/services/routing/types";
import type { RouteStep } from "@/types/contracts";

/**
 * Our `route` Edge Function: provider keys, shared cache and rate limits
 * live server-side (docs/route-view.md phase 0). Any failure throws so the
 * router falls through to the direct providers.
 */
export const fetchProxyRoute: RouteFetcher = async (from, to, signal) => {
  const { data, error } = await supabase.functions.invoke<{
    coords: [number, number][];
    distanceM: number;
    durationS: number;
    provider: "ors" | "osrm";
    steps?: RouteStep[];
  }>("route", { body: { from, to, profile: "drive" }, signal });
  if (error || !data) throw new Error(`route proxy: ${error?.message ?? "no data"}`);
  return {
    coords: data.coords,
    distanceM: data.distanceM,
    durationS: data.durationS,
    steps: Array.isArray(data.steps) ? data.steps : undefined,
  };
};
