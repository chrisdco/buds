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
    void connectRoomChannel(id);
    return () => {
      stopForegroundPipeline();
      void stopBackgroundUpdates();
      pipelineRunning.current = false;
      resetRouteManager();
      void disconnectRoomChannel();
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
    if (!id || pipelineRunning.current) return;
    if (connection !== "connected" || myRole !== "traveler") return;
    pipelineRunning.current = true;
    void (async () => {
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
      void ensureNotificationPermission();
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
