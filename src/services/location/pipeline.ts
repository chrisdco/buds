import * as Location from "expo-location";
import { AppState } from "react-native";

import { getPublisher } from "@/services/location/publisher";
import { toFix } from "@/services/location/tick";
import { useSessionStore } from "@/stores/sessionStore";

// Foreground GPS watcher. The actual filter/throttle/publish work lives in the
// shared publisher (services/location/publisher.ts), which the background task
// also feeds — so both lanes share one jitter/throttle state and can't
// double-send. Stopping the watcher intentionally KEEPS the shared publisher
// (filter/throttle continuity across restarts); the publisher is disposed only
// on room teardown (see room layout cleanup), so the lanes can't split-brain
// into two live publishers with divergent throttle state.

let subscription: Location.LocationSubscription | null = null;

export async function startForegroundPipeline(roomId: string): Promise<void> {
  stopForegroundPipeline();

  const publisher = getPublisher(roomId, {
    isBackground: () => AppState.currentState !== "active",
  });
  if (!publisher) return; // no session yet

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 2_000,
      distanceInterval: 5,
    },
    (location) => {
      if (!useSessionStore.getState().userId) return;
      publisher.publish(toFix(location));
    },
  );
}

export function stopForegroundPipeline(): void {
  subscription?.remove();
  subscription = null;
}
