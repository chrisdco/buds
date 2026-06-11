import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { colors } from "@/constants/theme";
import { clearActiveRoom } from "@/lib/activeRoom";
import {
  ensureForegroundLocation,
} from "@/services/location/permissions";
import {
  startForegroundPipeline,
  stopForegroundPipeline,
} from "@/services/location/pipeline";
import {
  connectRoomChannel,
  disconnectRoomChannel,
} from "@/services/realtime/roomChannel";
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
  const pipelineRunning = useRef(false);

  useEffect(() => {
    if (!id) return;
    void connectRoomChannel(id);
    return () => {
      stopForegroundPipeline();
      pipelineRunning.current = false;
      void disconnectRoomChannel();
    };
  }, [id]);

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
    })();
  }, [id, connection, myRole]);

  useEffect(() => {
    if (!exitReason) return;
    stopForegroundPipeline();
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
