import type { RealtimeChannel } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabaseClient";
import { setServerNowMs } from "@/lib/time";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import type {
  DbChangePayload,
  DestRow,
  LocTick,
  MemberRow,
  PresenceMeta,
  RoomEvt,
  RoomRow,
} from "@/types/contracts";

// One private channel per room carries all three planes:
//   - client broadcast: 'loc' ticks and self-reported 'evt' events
//   - presence: who is connected and their fg/bg state
//   - DB-change broadcasts from triggers: 'room_change' | 'member_change' | 'dest_change'
// supabase-js reconnects the socket with backoff and rejoins channels by
// itself; we re-track presence and refetch a snapshot on every (re)subscribe.

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let appStateSub: { remove: () => void } | null = null;

function presenceMeta(): PresenceMeta {
  const session = useSessionStore.getState();
  const me = session.userId
    ? useMembersStore.getState().members[session.userId]
    : undefined;
  return {
    name: session.displayName || "Anonymous",
    role: me?.role ?? "traveler",
    sharing: me?.sharing ?? true,
    appState: AppState.currentState === "active" ? "fg" : "bg",
    dev: session.deviceId,
  };
}

async function refreshSnapshot(roomId: string): Promise<void> {
  const result = await roomsRpc.getRoomSnapshot(roomId);
  if (!result.ok) {
    if (result.error === "not_member") {
      useRoomStore.getState().setExitReason("not_member");
    }
    return;
  }
  setServerNowMs(result.server_now_ms);
  useRoomStore.getState().applySnapshot(result, useSessionStore.getState().userId);
  useMembersStore.getState().applySnapshot(result.members);
}

function handleMemberChange(payload: DbChangePayload<MemberRow>): void {
  const record = payload.record;
  if (!record) return;
  const myUserId = useSessionStore.getState().userId;
  if (record.user_id === myUserId && record.kicked) {
    useRoomStore.getState().setExitReason("kicked");
    return;
  }
  useMembersStore.getState().applyMemberRow(record);
}

function handleRoomEvt(evt: RoomEvt): void {
  // M2+: arrival / deviation toasts. Joins and leaves already flow through
  // member_change; nothing to do at the walking-skeleton stage.
  void evt;
}

export async function connectRoomChannel(roomId: string): Promise<void> {
  await disconnectRoomChannel();
  currentRoomId = roomId;
  useRoomStore.getState().setConnection("connecting");

  // Private channels are authorized via RLS on realtime.messages; make sure
  // the realtime socket carries the current access token before joining.
  await supabase.realtime.setAuth();

  const userId = useSessionStore.getState().userId;
  channel = supabase.channel(`room:${roomId}`, {
    config: {
      private: true,
      broadcast: { self: false, ack: false },
      presence: { key: userId ?? "anonymous" },
    },
  });

  channel
    .on("broadcast", { event: "loc" }, ({ payload }) => {
      useMembersStore.getState().applyTick(payload as LocTick);
    })
    .on("broadcast", { event: "evt" }, ({ payload }) => {
      handleRoomEvt(payload as RoomEvt);
    })
    .on("broadcast", { event: "room_change" }, ({ payload }) => {
      const record = (payload as DbChangePayload<RoomRow>).record;
      if (record) useRoomStore.getState().setRoom(record);
    })
    .on("broadcast", { event: "member_change" }, ({ payload }) => {
      handleMemberChange(payload as DbChangePayload<MemberRow>);
    })
    .on("broadcast", { event: "dest_change" }, ({ payload }) => {
      const p = payload as DbChangePayload<DestRow>;
      useRoomStore.getState().applyDestChange(p.operation, p.record, p.old_record);
    })
    .on("presence", { event: "sync" }, () => {
      if (!channel) return;
      useMembersStore
        .getState()
        .syncPresence(channel.presenceState<PresenceMeta>());
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        useRoomStore.getState().setConnection("connected");
        void channel?.track(presenceMeta());
        void refreshSnapshot(roomId);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        useRoomStore.getState().setConnection("reconnecting");
      }
    });

  // Presence meta changes on app-state transitions only (not per tick).
  appStateSub = AppState.addEventListener("change", () => {
    if (channel) void channel.track(presenceMeta());
  });
}

export function sendLoc(tick: LocTick): void {
  void channel?.send({ type: "broadcast", event: "loc", payload: tick });
}

export function sendEvt(evt: RoomEvt): void {
  void channel?.send({ type: "broadcast", event: "evt", payload: evt });
}

export function activeRoomId(): string | null {
  return currentRoomId;
}

export async function disconnectRoomChannel(): Promise<void> {
  appStateSub?.remove();
  appStateSub = null;
  currentRoomId = null;
  if (channel) {
    const ch = channel;
    channel = null;
    await supabase.removeChannel(ch);
  }
  useRoomStore.getState().reset();
  useMembersStore.getState().reset();
}
