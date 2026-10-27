import { AppState } from "react-native";

import { notifyAlert } from "@/services/notifications";
import type { ControlEvent, PeerEvent } from "@/services/realtime/transport";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
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
import { PROTOCOL_VERSION } from "@/types/contracts";

// Transport-agnostic inbound handling: every payload a transport delivers is
// untrusted (peers are other people's phones), so each is shape-guarded and
// version-checked here before it touches a store. Nothing in this module
// knows how the bytes arrived.

/**
 * True when a peer payload speaks a protocol version we can parse. Absent
 * means a pre-versioning build (= v1); a higher version is a breaking change
 * we'd misread, so it's dropped.
 */
export function isSupportedVersion(payload: { v?: unknown }): boolean {
  const v = payload.v;
  if (v === undefined) return true;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= PROTOCOL_VERSION;
}

function isObject(p: unknown): p is Record<string, unknown> {
  return typeof p === "object" && p !== null;
}

function handleLoc(payload: unknown): void {
  if (!isObject(payload)) return;
  const tick = payload as unknown as LocTick;
  // Shape-guard: a malformed peer broadcast must not crash the map.
  if (
    typeof tick.u !== "string" ||
    !isSupportedVersion(tick) ||
    !Number.isFinite(tick.la) ||
    !Number.isFinite(tick.ln)
  ) {
    return;
  }
  useMembersStore.getState().applyTick(tick);
}

function handleEvt(payload: unknown): void {
  if (!isObject(payload)) return;
  const evt = payload as unknown as RoomEvt;
  // Arrivals are announced via the alert engine off persisted arrived_at
  // (member_change path) — only transient, non-DB events surface here.
  if (typeof evt.u !== "string" || !isSupportedVersion(evt)) return;
  // Unknown kinds (incl. legacy forgeable "sos" broadcasts) are dropped.
  if (evt.k !== "deviated" && evt.k !== "rejoined" && evt.k !== "arrived") return;
  if (evt.u === useSessionStore.getState().userId) return;
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

function handleMemberChange(payload: DbChangePayload<MemberRow>): void {
  const record = payload.record;
  if (!record) return;
  const myUserId = useSessionStore.getState().userId;
  if (record.user_id === myUserId && record.kicked) {
    useRoomStore.getState().setExitReason("kicked");
    return;
  }
  const prevSos = useMembersStore.getState().sosByUser[record.user_id];
  useMembersStore.getState().applyMemberRow(record);
  const nextSos = useMembersStore.getState().sosByUser[record.user_id];
  // A newly raised (or re-raised) SOS from someone else. The sender id is
  // the row's user_id, written by set_sos() as auth.uid() — not peer-supplied.
  if (
    nextSos != null &&
    nextSos !== prevSos &&
    record.user_id !== myUserId &&
    AppState.currentState !== "active"
  ) {
    // Safety overrides preference gating: a backgrounded member must get the
    // OS notification, like "other" (internal errors) in the engine path.
    // Foreground members see the persistent banner instead.
    void notifyAlert({
      id: `sos-${record.user_id}-${nextSos}`,
      severity: "warn",
      title: `SOS — ${record.display_name || "A bud"} needs help`,
      body: "Tap to open Buds and see their live location.",
    });
  }
}

export function dispatchPeer(event: PeerEvent, payload: unknown): void {
  if (event === "loc") handleLoc(payload);
  else handleEvt(payload);
}

export function dispatchControl(event: ControlEvent, payload: unknown): void {
  // Control payloads come from our own DB triggers, not peers — still
  // guarded, since a malformed one must not take the room down.
  if (!isObject(payload)) return;
  if (event === "room_change") {
    const record = (payload as unknown as DbChangePayload<RoomRow>).record;
    if (record) useRoomStore.getState().setRoom(record);
  } else if (event === "member_change") {
    handleMemberChange(payload as unknown as DbChangePayload<MemberRow>);
  } else {
    const p = payload as unknown as DbChangePayload<DestRow>;
    useRoomStore.getState().applyDestChange(p.operation, p.record, p.old_record);
  }
}

export function dispatchPresence(state: Record<string, PresenceMeta[]>): void {
  useMembersStore.getState().syncPresence(state);
}
