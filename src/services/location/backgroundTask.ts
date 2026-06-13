import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { clearActiveRoom, getActiveRoom } from "@/lib/activeRoom";
import { supabase } from "@/lib/supabaseClient";
import { disposePublisher, getPublisher } from "@/services/location/publisher";
import { toFix } from "@/services/location/tick";
import { activeRoomId } from "@/services/realtime/roomChannel";
import { useSessionStore } from "@/stores/sessionStore";

// Headless background location task. Must be defined at module scope and the
// module imported once at app entry (src/app/_layout.tsx) so the OS can run it
// when the app is backgrounded. Feeds the SAME shared publisher as the
// foreground watcher, so jitter/throttle state is shared and the lanes can't
// double-send. When the socket isn't live (typical in background) the
// publisher falls back to the update_last_seen HTTPS lane.

export const BG_LOCATION_TASK = "buds-bg-location";

interface LocationTaskData {
  locations: Location.LocationObject[];
}

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as LocationTaskData;
  if (!locations?.length) return;

  // Resolve room + identity, tolerating a cold background relaunch where the
  // in-memory stores/channel are empty (read durable storage / persisted auth).
  const roomId = activeRoomId() ?? (await getActiveRoom())?.id ?? null;
  if (!roomId) return;

  let userId = useSessionStore.getState().userId;
  if (!userId) {
    const { data: sessionData } = await supabase.auth.getSession();
    userId = sessionData.session?.user.id ?? null;
  }
  if (!userId) return;

  const publisher = getPublisher(roomId, {
    isBackground: () => true,
    userId,
    // The server says we no longer have a sharing lease (room ended / kicked /
    // left) — tear the service down from inside the headless task so the
    // sticky notification + GPS don't outlive the room while the app is
    // suspended.
    onLeaseLost: () => {
      clearActiveRoom();
      disposePublisher();
      void stopBackgroundUpdates();
    },
  });
  if (!publisher) return;

  for (const loc of locations) {
    publisher.publish(toFix(loc));
  }
});

/**
 * Starts the Android foreground-service location lane. Returns false (without
 * starting) when background permission isn't actually granted, so callers can
 * surface that instead of a silent no-op.
 */
export async function startBackgroundUpdates(): Promise<boolean> {
  const perm = await Location.getBackgroundPermissionsAsync();
  if (!perm.granted) return false;
  if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 3_000,
    distanceInterval: 8,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false, // iOS
    activityType: Location.ActivityType.OtherNavigation, // iOS
    showsBackgroundLocationIndicator: true, // iOS
    foregroundService: {
      // Android: required for reliable background updates.
      notificationTitle: "Buds is sharing your location",
      notificationBody: "Your group can see you during this trip.",
      notificationColor: "#208AEF",
    },
  });
  return true;
}

export async function stopBackgroundUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    }
  } catch {
    // task may not be registered yet; nothing to stop
  }
}
