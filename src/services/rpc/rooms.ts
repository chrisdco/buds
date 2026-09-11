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
import type { Database, Json } from "@/types/supabase";

type RpcName = keyof Database["public"]["Functions"];

// Result shapes per RPC, in one place: call sites no longer repeat (or drift
// from) the payload type, and adding an RPC forces a conscious entry here.
interface RpcResults {
  create_room: RoomAndMember;
  join_room: RoomAndMember;
  set_mode: { room: RoomRow };
  set_destination: { destination: DestRow };
  mark_arrived: { member?: MemberRow; already?: boolean };
  get_room_snapshot: SnapshotPayload;
}

/**
 * RoomSettings is all-optional JSON-safe data; the cast bridges its missing
 * index signature at the PostgREST boundary (kept out of contracts.ts so
 * object literals there keep full typo checking).
 */
function settingsJson(s: RoomSettings | undefined | null): Json | undefined {
  return (s ?? undefined) as unknown as Json | undefined;
}

// All server mutations go through SECURITY DEFINER RPCs that return
// { ok: true, ... } | { ok: false, error } â€” see supabase/migrations/0002_rpcs.sql.
// Function names AND args are checked against the generated schema, so a
// migration that renames/reshapes an RPC breaks the build here, not on-device.
async function call<Fn extends RpcName>(
  fn: Fn,
  args: Database["public"]["Functions"][Fn]["Args"],
): Promise<RpcResult<Fn extends keyof RpcResults ? RpcResults[Fn] : unknown>> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      return { ok: false, error: "network", message: error.message };
    }
    return data as RpcResult<Fn extends keyof RpcResults ? RpcResults[Fn] : unknown>;
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
    return call("create_room", {
      p_name: args.name,
      p_display_name: args.displayName,
      p_mode: args.mode ?? "solo",
      p_traveler_limit: args.travelerLimit ?? 10,
      // Omitted => SQL DEFAULT NULL (no expiry); identical to explicit null.
      p_expires_at: args.expiresAt ?? undefined,
      p_settings: settingsJson(args.settings),
    });
  },

  joinRoom(args: { code: string; displayName: string; role?: MemberRole }) {
    return call("join_room", {
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
    return call("set_mode", {
      p_room_id: roomId,
      p_mode: mode,
      p_settings: settingsJson(settings),
    });
  },

  setLeader(roomId: string, userId: string) {
    return call("set_leader", { p_room_id: roomId, p_user_id: userId });
  },

  setExpiry(roomId: string, expiresAt: string | null) {
    // Null clears the limit; the parameter DEFAULT NULL means omitting the
    // key is identical to passing null — and satisfies the generated type.
    return call("set_expiry", { p_room_id: roomId, p_expires_at: expiresAt ?? undefined });
  },

  setDestination(args: {
    roomId: string;
    lat: number;
    lng: number;
    label?: string;
    memberId?: string | null;
  }) {
    return call("set_destination", {
      p_room_id: args.roomId,
      p_lat: args.lat,
      p_lng: args.lng,
      p_label: args.label ?? "Destination",
      // Room-level destination when omitted (SQL DEFAULT NULL).
      p_member_id: args.memberId ?? undefined,
    });
  },

  clearDestination(roomId: string, memberId?: string | null) {
    return call("clear_destination", {
      p_room_id: roomId,
      p_member_id: memberId ?? undefined,
    });
  },

  markArrived(roomId: string) {
    return call("mark_arrived", {
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
      p_heading: args.heading ?? undefined,
      p_speed: args.speed ?? undefined,
    });
  },

  getRoomSnapshot(roomId: string) {
    return call("get_room_snapshot", { p_room_id: roomId });
  },
};
