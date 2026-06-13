import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { LocalAlert } from "@/events/alertEngine";

// Local (on-device) notifications for alerts that fire while the app is
// backgrounded. The alert engine already dedupes per episode; the gate below
// is belt-and-suspenders against the same id firing twice in quick succession
// (e.g. a foreground toast immediately followed by a backgrounded re-eval).

const CHANNEL_ID = "buds-alerts";
const DEDUP_WINDOW_MS = 30_000;

// Module-scope handler: keep OS banners suppressed while foregrounded (we show
// in-app toasts there) but allow them otherwise.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permissionReady = false;

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Trip alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 150, 200],
      });
    } catch {
      // channel setup is best-effort
    }
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      permissionReady = true;
      return true;
    }
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    permissionReady = requested.granted;
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Pure: decides whether an alert id should fire a notification now, given the
 * last-fired timestamps. Returns the updated map (immutable) so callers can
 * keep it in module state. Exported for tests.
 */
export function shouldNotify(
  fired: Record<string, number>,
  id: string,
  nowMs: number,
  windowMs: number = DEDUP_WINDOW_MS,
): { fire: boolean; fired: Record<string, number> } {
  const last = fired[id];
  if (last != null && nowMs - last < windowMs) {
    return { fire: false, fired };
  }
  return { fire: true, fired: { ...fired, [id]: nowMs } };
}

let firedAt: Record<string, number> = {};

/** Fires a local notification for an alert, honoring the dedup gate. */
export async function notifyAlert(alert: LocalAlert): Promise<void> {
  if (!permissionReady) return;
  const decision = shouldNotify(firedAt, alert.id, Date.now());
  if (!decision.fire) return;
  firedAt = decision.fired;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.body },
      trigger: null, // present immediately
    });
  } catch {
    // notifications are non-critical
  }
}
