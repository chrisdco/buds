import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";

import { colors } from "@/constants/theme";
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
import { ensureNotificationPermission } from "@/services/notifications";
import {
  connectRoomChannel,
  disconnectRoomChannel,
} from "@/services/realtime/roomChannel";
import { resetRouteManager } from "@/services/routing/routeManager";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";

const EXIT_MESSAGES = {
  ended: "This room has ended.",
  kicked: "The host removed you from this room.",
  not_member: "You're no longer a member of this room.",
} as const;

// Owns the room channel and location pipeline lifecycle: connect on mount,
// tear down on unmount, exit gracefully when the room ends or we get kicked.
export default function RoomLayout() {
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

  useEffect(() => {
    if (!id) return;
    if (typeof id !== "string") return;
    void connectRoomChannel(id).catch(() => {
      // connectRoomChannel maps its own failures to connection state; this
      // guards against any unexpected throw leaving an unhandled rejection.
    });
    return () => {
      stopForegroundPipeline();
      void stopBackgroundUpdates().catch(() => {});
      pipelineRunning.current = false;
      disposePublisher();
      resetRouteManager();
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
          Alert.alert(
            "Location is off",
            "Without location access your buds can't see you on the map. You can still watch the room.",
          );
          return;
        }
        await startForegroundPipeline(id);
        // Lets backgrounded arrival/separation alerts reach the user.
        await ensureNotificationPermission();
      } catch {
        // watchPosition / permission plumbing can reject on OEM skins or
        // revoked permissions — release the gate so a connection flap retries
        // instead of wedging the pipeline permanently on.
        pipelineRunning.current = false;
      }
    })();
  }, [id, connection, myRole]);

  // Hand off to the background location service when the app is backgrounded,
  // but only for travelers who opted in (settings) and granted permission.
  // The foreground watcher stops delivering in background without this; the
  // shared publisher means there's no double-send across the transition.
  useEffect(() => {
    if (!id || myRole !== "traveler" || !backgroundSharing) return;
    let warnedNoPermission = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void stopBackgroundUpdates();
      } else {
        void startBackgroundUpdates().then((started) => {
          // started === false => the OS "Always" permission lapsed; warn once
          // rather than silently failing to share with the screen off.
          if (!started && !warnedNoPermission) {
            warnedNoPermission = true;
            Alert.alert(
              "Background sharing is off",
              "Android revoked the always-on location permission, so your buds won't see you with the screen off. Re-enable it from the room's privacy settings.",
            );
          }
        });
      }
    });
    return () => {
      sub.remove();
      void stopBackgroundUpdates();
    };
  }, [id, myRole, backgroundSharing]);

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
