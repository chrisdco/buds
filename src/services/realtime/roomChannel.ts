import { AppState } from "react-native";

import { serverNowMs, setServerNowMs } from "@/lib/time";
import { roomsRpc } from "@/services/rpc/rooms";
import {
  dispatchControl,
  dispatchPeer,
  dispatchPresence,
} from "@/services/realtime/roomDispatch";
import { createSupabaseTransport } from "@/services/realtime/supabaseTransport";
import type { RoomTransport, RoomTransportFactory } from "@/services/realtime/transport";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useRouteStore } from "@/stores/routeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import type { LocTick, PresenceMeta, RoomEvt } from "@/types/contracts";
import { PROTOCOL_VERSION } from "@/types/contracts";

export { isSupportedVersion } from "@/services/realtime/roomDispatch";

// Room connection lifecycle, on top of a RoomTransport (see transport.ts):
// connect/disconnect, connection state, snapshot refresh on every (re)join,
// presence re-tracking, and the outbound API (version-stamped). Inbound
// payloads go to roomDispatch. Nothing here knows which backend carries
// the bytes.

let transport: RoomTransport | null = null;
let transportFactory: RoomTransportFactory = createSupabaseTransport;
let currentRoomId: string | null = null;
let appStateSub: { remove: () => void } | null = null;
// Bumped on every connect/disconnect. Async steps (open, snapshot fetch)
// compare their captured generation against this and bail: leaving a room
// mid-connect must not resurrect a connection for it or write its snapshot
// into the next room. (Transports also go silent after close().)
let generation = 0;

/** Selects the backend for subsequent connects (tests; R3 edge transport). */
export function setRoomTransportFactory(factory: RoomTransportFactory): void {
  transportFactory = factory;
}

function presenceMeta(): PresenceMeta {
  const session = useSessionStore.getState();
  const me = session.userId
    ? useMembersStore.getState().members[session.userId]
    : undefined;
  return {
    v: PROTOCOL_VERSION,
    name: session.displayName || "Anonymous",
    role: me?.role ?? "traveler",
    sharing: me?.sharing ?? true,
    appState: AppState.currentState === "active" ? "fg" : "bg",
    dev: session.deviceId,
  };
}

async function refreshSnapshot(roomId: string, gen: number): Promise<void> {
  const result = await roomsRpc.getRoomSnapshot(roomId);
  if (gen !== generation) return; // left (or switched rooms) mid-fetch
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

export async function connectRoomChannel(roomId: string): Promise<void> {
  await disconnectRoomChannel();
  const gen = ++generation;
  currentRoomId = roomId;
  // disconnectRoomChannel() resets the stores, but clear explicitly so a
  // stale exit reason can never eject the new room if reset semantics change.
  useRoomStore.getState().setExitReason(null);
  useRoomStore.getState().setConnection("connecting");

  const t = transportFactory();
  transport = t;
  const userId = useSessionStore.getState().userId;

  // open() can reject (expired session, offline) — surface reconnecting
  // instead of leaving the pipeline stuck at "connecting" via an unhandled
  // rejection (callers invoke this fire-and-forget).
  try {
    await t.open(roomId, userId ?? "anonymous", {
      onPeer: dispatchPeer,
      onControl: dispatchControl,
      onPresence: (state) => {
        if (gen === generation) dispatchPresence(state);
      },
      onStatus: (status) => {
        if (gen !== generation) return;
        if (status === "connected") {
          const wasReconnecting = useRoomStore.getState().connection === "reconnecting";
          useRoomStore.getState().setConnection("connected");
          t.track(presenceMeta());
          void refreshSnapshot(roomId, gen).catch(() => {});
          if (wasReconnecting && userId) {
            sendEvt({ k: "rejoined", u: userId, t: serverNowMs() });
          }
        } else {
          useRoomStore.getState().setConnection("reconnecting");
        }
      },
    });
  } catch {
    if (gen === generation) useRoomStore.getState().setConnection("reconnecting");
    return;
  }
  if (gen !== generation) return; // disconnected (or reconnected) during open

  // Presence meta changes on app-state transitions only (not per tick).
  appStateSub = AppState.addEventListener("change", () => {
    if (gen === generation) t.track(presenceMeta());
  });
}

export function sendLoc(tick: LocTick): void {
  transport?.send("loc", { ...tick, v: PROTOCOL_VERSION });
}

export function sendEvt(evt: RoomEvt): void {
  transport?.send("evt", { ...evt, v: PROTOCOL_VERSION });
}

/**
 * True only when a broadcast 'loc' tick will actually reach peers. Drives the
 * publisher's broadcast-vs-HTTPS lane decision. More reliable than the
 * roomStore connection flag, which is set from the status callback and can
 * lag the real socket when the app is backgrounded.
 */
export function isRoomChannelLive(): boolean {
  return transport?.isLive() ?? false;
}

export function activeRoomId(): string | null {
  return currentRoomId;
}

export async function disconnectRoomChannel(): Promise<void> {
  generation++;
  appStateSub?.remove();
  appStateSub = null;
  currentRoomId = null;
  const t = transport;
  transport = null;
  // Reset first: if teardown hangs or fails (dead socket), stale room state
  // must still not leak into the next room.
  useRoomStore.getState().reset();
  useMembersStore.getState().reset();
  useRouteStore.getState().reset();
  useUiStore.getState().reset();
  if (t) await t.close();
}
