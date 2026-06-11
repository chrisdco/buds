import * as Location from "expo-location";
import { AppState } from "react-native";

import { round5 } from "@/lib/geo";
import { serverNowMs } from "@/lib/time";
import { createJitterFilter, type Fix } from "@/services/location/jitterFilter";
import { createSendThrottle } from "@/services/location/throttle";
import { sendLoc } from "@/services/realtime/roomChannel";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { LocTick } from "@/types/contracts";

// The product's core loop: GPS fix -> jitter filter -> adaptive throttle ->
// broadcast 'loc' tick (DB untouched) + a ~60s last_seen upsert so late
// joiners and reconnecting peers can paint "last known" markers.
// Foreground watcher only for now; the background task lane is milestone M4.

const LAST_SEEN_INTERVAL_MS = 60_000;

let subscription: Location.LocationSubscription | null = null;
let lastSeenSentAt = 0;

function toFix(location: Location.LocationObject): Fix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    heading:
      location.coords.heading != null && location.coords.heading >= 0
        ? location.coords.heading
        : undefined,
    speed:
      location.coords.speed != null && location.coords.speed >= 0
        ? location.coords.speed
        : undefined,
    atMs: location.timestamp,
  };
}

export async function startForegroundPipeline(roomId: string): Promise<void> {
  stopForegroundPipeline();

  const filter = createJitterFilter();
  const throttle = createSendThrottle({
    floorMs: () => useRoomStore.getState().room?.settings.min_send_interval_ms ?? 0,
    isBackground: () => AppState.currentState !== "active",
  });

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 2_000,
      distanceInterval: 5,
    },
    (location) => {
      const userId = useSessionStore.getState().userId;
      if (!userId) return;

      const me = useMembersStore.getState().members[userId];
      if (me && (me.role !== "traveler" || !me.sharing)) return;

      const fix = filter(toFix(location));
      if (!fix) return;

      const { send, moving } = throttle(fix);
      if (!send) return;

      const tick: LocTick = {
        u: userId,
        t: serverNowMs(),
        la: round5(fix.lat),
        ln: round5(fix.lng),
        h: fix.heading != null ? Math.round(fix.heading) : undefined,
        s: fix.speed != null ? Math.round(fix.speed * 10) / 10 : undefined,
        a: fix.accuracy != null ? Math.round(fix.accuracy) : undefined,
        st: moving ? "mv" : "st",
      };

      sendLoc(tick);
      // broadcast.self is off, so paint our own marker locally.
      useMembersStore.getState().applyTick(tick);

      if (Date.now() - lastSeenSentAt > LAST_SEEN_INTERVAL_MS) {
        lastSeenSentAt = Date.now();
        void roomsRpc.updateLastSeen({
          roomId,
          lat: tick.la,
          lng: tick.ln,
          heading: tick.h ?? null,
          speed: tick.s ?? null,
        });
      }
    },
  );
}

export function stopForegroundPipeline(): void {
  subscription?.remove();
  subscription = null;
  lastSeenSentAt = 0;
}
