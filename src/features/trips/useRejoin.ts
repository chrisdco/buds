import { useRouter } from "expo-router";
import { useRef, useState } from "react";

import { setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { isTerminalJoinError, rejoinErrorMessage } from "@/lib/joinErrors";
import { roomsRpc } from "@/services/rpc/rooms";
import { useRecentsStore } from "@/stores/recentsStore";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Rejoin a past trip: re-validates membership through join_room
 * (idempotent) and prunes rooms that can never be entered again, so a list
 * never keeps a dead room. Shared by the Trips list and trip detail.
 */
export function useRejoin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Double-tap guard: joinRoom awaits the network.
  const busy = useRef(false);

  const rejoin = (ref: ActiveRoomRef, onGone?: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setBusyId(ref.id);
    setError(null);
    void (async () => {
      try {
        const name = useSessionStore.getState().displayName.trim() || "Anonymous";
        const result = await roomsRpc.joinRoom({ code: ref.code, displayName: name, role: ref.role });
        if (result.ok) {
          setActiveRoom({
            id: result.room.id,
            code: result.room.code,
            name: result.room.name,
            role: result.member.role,
          });
          router.replace(`/room/${result.room.id}`);
          return;
        }
        if (isTerminalJoinError(result.error)) {
          void useRecentsStore.getState().remove(ref.id);
          onGone?.();
        }
        setError(rejoinErrorMessage(result.error));
      } finally {
        busy.current = false;
        setBusyId(null);
      }
    })();
  };

  return { rejoin, error, busyId };
}
