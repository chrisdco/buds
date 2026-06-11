import { supabase } from "@/lib/supabaseClient";
import type {
  DestRow,
  MemberRole,
  MemberRow,
  RoomMode,
  RoomRow,
  RoomSettings,
  RpcResult,
  SnapshotPayload,
} from "@/types/contracts";

// All server mutations go through SECURITY DEFINER RPCs that return
// { ok: true, ... } | { ok: false, error } — see supabase/migrations/0002_rpcs.sql.
async function call<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      return { ok: false, error: "network", message: error.message };
    }
    return data as RpcResult<T>;
  } catch (e) {
    return {
      ok: false,
      error: "network",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface RoomAndMember {
  room: RoomRow;
  member: MemberRow;
}

export const roomsRpc = {
  createRoom(args: {
    name: string;
    displayName: string;
    mode?: RoomMode;
    travelerLimit?: number;
    expiresAt?: string | null;
    settings?: RoomSettings;
  }) {
    return call<RoomAndMember>("create_room", {
      p_name: args.name,
      p_display_name: args.displayName,
      p_mode: args.mode ?? "solo",
      p_traveler_limit: args.travelerLimit ?? 10,
      p_expires_at: args.expiresAt ?? null,
      p_settings: args.settings ?? {},
    });
  },

  joinRoom(args: { code: string; displayName: string; role?: MemberRole }) {
    return call<RoomAndMember>("join_room", {
      p_code: args.code,
      p_display_name: args.displayName,
      p_role: args.role ?? "traveler",
    });
  },

  leaveRoom(roomId: string) {
    return call("leave_room", { p_room_id: roomId });
  },

  endRoom(roomId: string) {
    return call("end_room", { p_room_id: roomId });
  },

  kickMember(roomId: string, userId: string) {
    return call("kick_member", { p_room_id: roomId, p_user_id: userId });
  },

  lockRoom(roomId: string, locked: boolean) {
    return call("lock_room", { p_room_id: roomId, p_locked: locked });
  },

  setMode(roomId: string, mode: RoomMode, settings?: RoomSettings) {
    return call<{ room: RoomRow }>("set_mode", {
      p_room_id: roomId,
      p_mode: mode,
      p_settings: settings ?? null,
    });
  },

  setLeader(roomId: string, userId: string) {
    return call("set_leader", { p_room_id: roomId, p_user_id: userId });
  },

  setExpiry(roomId: string, expiresAt: string | null) {
    return call("set_expiry", { p_room_id: roomId, p_expires_at: expiresAt });
  },

  setDestination(args: {
    roomId: string;
    lat: number;
    lng: number;
    label?: string;
    memberId?: string | null;
  }) {
    return call<{ destination: DestRow }>("set_destination", {
      p_room_id: args.roomId,
      p_lat: args.lat,
      p_lng: args.lng,
      p_label: args.label ?? "Destination",
      p_member_id: args.memberId ?? null,
    });
  },

  clearDestination(roomId: string, memberId?: string | null) {
    return call("clear_destination", {
      p_room_id: roomId,
      p_member_id: memberId ?? null,
    });
  },

  markArrived(roomId: string) {
    return call<{ member?: MemberRow; already?: boolean }>("mark_arrived", {
      p_room_id: roomId,
    });
  },

  setSharing(roomId: string, sharing: boolean) {
    return call("set_sharing", { p_room_id: roomId, p_sharing: sharing });
  },

  updateLastSeen(args: {
    roomId: string;
    lat: number;
    lng: number;
    heading?: number | null;
    speed?: number | null;
  }) {
    return call("update_last_seen", {
      p_room_id: args.roomId,
      p_lat: args.lat,
      p_lng: args.lng,
      p_heading: args.heading ?? null,
      p_speed: args.speed ?? null,
    });
  },

  getRoomSnapshot(roomId: string) {
    return call<SnapshotPayload>("get_room_snapshot", { p_room_id: roomId });
  },
};
