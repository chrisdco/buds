import { Stack } from "expo-router/stack";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { startRoomSession } from "@/features/room/session/roomSession";
import { clearActiveRoom } from "@/lib/activeRoom";
import {
  startBackgroundUpdates,
  stopBackgroundUpdates,
} from "@/services/location/backgroundTask";
import { ensureForegroundLocation } from "@/services/location/permissions";
import {
  startForegroundPipeline,
  stopForegroundPipeline,
} from "@/services/location/pipeline";
import { disposePublisher } from "@/services/location/publisher";
import { clearTripPack } from "@/services/map/offlinePacks";
import { ensureNotificationPermission } from "@/services/notifications";
import {
  connectRoomChannel,
  disconnectRoomChannel,
} from "@/services/realtime/roomChannel";
import { resetRouteManager } from "@/services/routing/routeManager";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useColors } from "@/theme";

const EXIT_MESSAGES = {
  ended: "This room has ended.",
  kicked: "The host removed you from this room.",
  not_member: "You're no longer a member of this room.",
} as const;

// Location problems we've already explained, per room ("<id>:fg" etc.).
// The room reconnects often (network flaps, app switches); each reconnect
// re-runs the sharing setup, and re-asking every time is a nag loop.
const explained = new Set<string>();

/** True the first time `key` is seen while the app is on screen. */
function explainOnce(key: string): boolean {
  if (AppState.currentState !== "active" || explained.has(key)) return false;
  explained.add(key);
  return true;
}

// Owns the room channel and location pipeline lifecycle: connect on mount,
// tear down on unmount, exit gracefully when the room ends or we get kicked.
export default function RoomLayout() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exitReason = useRoomStore((s) => s.exitReason);
  const connection = useRoomStore((s) => s.connection);
  const myUserId = useSessionStore((s) => s.userId);
  const myRole = useMembersStore((s) =>
    myUserId ? s.members[myUserId]?.role : undefined,
  );
  const backgroundSharing = useSessionStore((s) => s.backgroundSharing);
  const pipelineRunning = useRef(false);
  // Bumped on return to the app while not sharing: granting location in
  // Settings starts sharing at once, without leaving and re-entering.
  const [retry, setRetry] = useState(0);
  // Bumped once the on-screen watcher is sharing: the screen-off service
  // starts from there.
  const [sharingReady, setSharingReady] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !pipelineRunning.current) setRetry((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!id) return;
    if (typeof id !== "string") return;
    void connectRoomChannel(id).catch(() => {
      // connectRoomChannel maps its own failures to connection state; this
      // guards against any unexpected throw leaving an unhandled rejection.
    });
    // Alerts, routes and arrival run for the whole room stack (map, settings,
    // member detail), not just while the map screen is mounted.
    const stopSession = startRoomSession();
    return () => {
      stopSession();
      stopForegroundPipeline();
      void stopBackgroundUpdates().catch(() => {});
      pipelineRunning.current = false;
      disposePublisher();
      resetRouteManager();
      void clearTripPack();
      void disconnectRoomChannel().catch(() => {});
    };
  }, [id]);

  // Release the foreground GPS watcher if we're demoted to spectator
  // mid-session (otherwise it keeps running, draining battery, even though the
  // publisher no longer broadcasts).
  useEffect(() => {
    if (myRole && myRole !== "traveler" && pipelineRunning.current) {
      stopForegroundPipeline();
      pipelineRunning.current = false;
      void stopBackgroundUpdates();
    }
  }, [myRole]);

  // Start sharing once we're connected and confirmed as a traveler.
  useEffect(() => {
    if (!id || typeof id !== "string" || pipelineRunning.current) return;
    if (connection !== "connected" || myRole !== "traveler") return;
    pipelineRunning.current = true;
    void (async () => {
      try {
        const granted = await ensureForegroundLocation();
        if (!granted) {
          pipelineRunning.current = false;
          // Deny recovery: the banner names the breakage and offers the
          // one-tap Settings path instead of a dead end. Once per room.
          if (!explainOnce(`${id}:fg`)) return;
          void useUiStore
            .getState()
            .requestConfirm({
              title: "Location is off",
              body: "Without location access your buds can't see you on the map. You can still watch the room.",
              confirmLabel: "Open Settings",
              cancelLabel: "Not now",
              destructive: false,
            })
            .then((open) => open && void Linking.openSettings());
          return;
        }
        // Device-wide location services off is a separate failure: permission
        // grants succeed, startLocationUpdates succeeds, the notification
        // shows — and zero fixes ever arrive. Gate it honestly up front.
        const servicesOn = await Location.hasServicesEnabledAsync();
        if (!servicesOn) {
          pipelineRunning.current = false;
          if (!explainOnce(`${id}:services`)) return;
          void useUiStore
            .getState()
            .requestConfirm({
              title: "Location services are off",
              body: "Turn on location on this device so your buds can see you on the map. You can still watch the room.",
              confirmLabel: "Open Settings",
              cancelLabel: "Not now",
              destructive: false,
            })
            .then((open) => open && void Linking.openSettings());
          return;
        }
        await startForegroundPipeline(id);
        // Lets backgrounded arrival/separation alerts reach the user, and
        // shows the sharing notification on Android 13+.
        await ensureNotificationPermission();
        setSharingReady((n) => n + 1);
      } catch {
        // watchPosition / permission plumbing can reject on OEM skins or
        // revoked permissions — release the gate so a connection flap retries
        // instead of wedging the pipeline permanently on.
        pipelineRunning.current = false;
      }
    })();
  }, [id, connection, myRole, retry]);

  // Screen-off sharing: the location service starts as soon as sharing does,
  // while Buds is on screen (Android only allows it from the open app), and
  // runs for the whole trip, so locking the phone or switching apps never
  // stops your buds seeing you. It feeds the same publisher as the on-screen
  // watcher, so there's no double-send. Re-tried each time the app comes
  // back if it couldn't start; stopped when the setting goes off or the room
  // closes (cleanup above).
  useEffect(() => {
    if (!id || myRole !== "traveler" || sharingReady === 0) return;
    if (!backgroundSharing) {
      void stopBackgroundUpdates();
      return;
    }
    const start = () =>
      void startBackgroundUpdates().catch(() => {
        // Can reject on OEM skins or a just-revoked permission: the on-screen
        // watcher still shares, and the next return to the app retries.
      });
    start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && pipelineRunning.current) start();
    });
    return () => sub.remove();
  }, [id, myRole, backgroundSharing, sharingReady]);

  useEffect(() => {
    if (!exitReason) return;
    stopForegroundPipeline();
    void stopBackgroundUpdates();
    pipelineRunning.current = false;
    clearActiveRoom();
    Alert.alert("Room closed", EXIT_MESSAGES[exitReason]);
    router.replace("/");
  }, [exitReason, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
