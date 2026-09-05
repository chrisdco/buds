import type { RealtimeChannel } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabaseClient";
import { serverNowMs, setServerNowMs } from "@/lib/time";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
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

/** Fire-and-forget a promise without tripping unhandled-rejection warnings. */
function ignoreRejection(p: Promise<unknown> | null | undefined): void {
  if (p && typeof (p as Promise<unknown>).catch === "function") {
    void (p as Promise<unknown>).catch(() => {});
  }
}

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
    } else if (result.error === "room_ended") {
      useRoomStore.getState().setExitReason("ended");
    } else if (result.error === "kicked") {
      useRoomStore.getState().setExitReason("kicked");
    } else {
      // Transient (network/auth) failure: show reconnecting, keep the last
      // snapshot so the map doesn't blank on a blip.
      useRoomStore.getState().setConnection("reconnecting");
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
  // Arrivals are announced via the alert engine off persisted arrived_at
  // (member_change path) — only transient, non-DB events surface here.
  // Shape-guard: a malformed/malicious peer broadcast must not crash us.
  if (!evt || typeof evt.u !== "string") return;
  if (evt.k !== "deviated" && evt.k !== "rejoined" && evt.k !== "arrived") return;
  const myId = useSessionStore.getState().userId;
  if (evt.u === myId) return;
  const name = useMembersStore.getState().members[evt.u]?.name ?? "A bud";
  if (evt.k === "deviated") {
    useUiStore.getState().pushAlerts([
      {
        id: `evt-dev-${evt.u}-${evt.t}`,
        severity: "info",
        title: `${name} took a detour`,
        body: `${Math.round(evt.offM)} m off route`,
      },
    ]);
  } else if (evt.k === "rejoined") {
    useUiStore.getState().pushAlerts([
      { id: `evt-rejoin-${evt.u}-${evt.t}`, severity: "info", title: `${name} reconnected` },
    ]);
  }
}

export async function connectRoomChannel(roomId: string): Promise<void> {
  await disconnectRoomChannel();
  currentRoomId = roomId;
  // disconnectRoomChannel() resets the stores, but clear explicitly so a
  // stale exit reason can never eject the new room if reset semantics change.
  useRoomStore.getState().setExitReason(null);
  useRoomStore.getState().setConnection("connecting");

  // Private channels are authorized via RLS on realtime.messages; make sure
  // the realtime socket carries the current access token before joining.
  // setAuth can reject (expired session, offline) — surface reconnecting
  // instead of leaving the pipeline stuck at "connecting" via an unhandled
  // rejection (callers invoke this fire-and-forget).
  try {
    await supabase.realtime.setAuth();
  } catch {
    useRoomStore.getState().setConnection("reconnecting");
    return;
  }

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
      const tick = payload as LocTick;
      // Shape-guard: a malformed peer broadcast must not crash the map.
      if (
        !tick ||
        typeof tick.u !== "string" ||
        !Number.isFinite(tick.la) ||
        !Number.isFinite(tick.ln)
      ) {
        return;
      }
      useMembersStore.getState().applyTick(tick);
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
        const wasReconnecting =
          useRoomStore.getState().connection === "reconnecting";
        useRoomStore.getState().setConnection("connected");
        ignoreRejection(channel?.track(presenceMeta()));
        ignoreRejection(refreshSnapshot(roomId));
        if (wasReconnecting && userId) {
          sendEvt({ k: "rejoined", u: userId, t: serverNowMs() });
        }
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        useRoomStore.getState().setConnection("reconnecting");
      }
    });

  // Presence meta changes on app-state transitions only (not per tick).
  appStateSub = AppState.addEventListener("change", () => {
    if (channel) ignoreRejection(channel.track(presenceMeta()));
  });
}

export function sendLoc(tick: LocTick): void {
  void channel?.send({ type: "broadcast", event: "loc", payload: tick });
}

/**
 * True only when a broadcast 'loc' tick will actually reach peers. Drives the
 * publisher's broadcast-vs-HTTPS lane decision. More reliable than the
 * roomStore connection flag, which is set from the subscribe callback and can
 * lag the real socket when the app is backgrounded.
 */
export function isRoomChannelLive(): boolean {
  return supabase.realtime.isConnected() && channel?.state === "joined";
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
  useRouteStore.getState().reset();
  useUiStore.getState().reset();
}
