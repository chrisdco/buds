import * as Location from "expo-location";

/**
 * Already allowed? Never prompts. Priming sheets check this first so a
 * phone that already granted access is never asked again (in any wording).
 * Errors read as "not granted": the caller's normal path still works.
 */
export async function hasLocationPermission(kind: "foreground" | "background"): Promise<boolean> {
  try {
    const p =
      kind === "foreground"
        ? await Location.getForegroundPermissionsAsync()
        : await Location.getBackgroundPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

export async function ensureForegroundLocation(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

// Background location requires foreground first (the OS enforces this). On
// Android 11+, requestBackgroundPermissionsAsync() sends the user to the system
// Settings page rather than showing an in-app dialog, so callers should explain
// why before invoking this.
export async function ensureBackgroundLocation(): Promise<boolean> {
  if (!(await ensureForegroundLocation())) return false;
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Location.requestBackgroundPermissionsAsync();
  return requested.granted;
}
