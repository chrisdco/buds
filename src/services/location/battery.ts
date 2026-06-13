import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

// Best-effort prompt to exempt Buds from Android battery optimization (Doze),
// the main cause of background location being killed on OEM skins. No-op on
// iOS; never throws. There is NO JS API to read the current exemption status,
// so callers drive UI off their own "asked" flag, not a real check.
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;

  const pkg = Constants.expoConfig?.android?.package;

  // 1) Direct allow/deny dialog for this app (needs the manifest permission +
  //    a package: data URI). May throw on OEM quirks -> fall through.
  if (pkg) {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        { data: `package:${pkg}` },
      );
      return;
    } catch {
      // fall through to the settings list
    }
  }

  // 2) Fallback: open the system battery-optimization list (no permission, no
  //    data URI); the user finds Buds manually.
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    );
  } catch {
    // non-critical: give up silently
  }
}
