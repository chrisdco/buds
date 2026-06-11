// Shared contracts: database row shapes, realtime payloads, and client state.
// Realtime payload keys are deliberately compact — every byte fans out to up
// to 9 other participants.

export type RoomMode = "solo" | "converge" | "multitrack" | "leader" | "formation";
export type MemberRole = "traveler" | "spectator";

export interface RoomSettings {
  formation_radius_m?: number;
  separation_alert_m?: number;
  arrival_radius_m?: number;
  /** Remote-tweakable throttle floor; lets the host degrade send cadence without an app release. */
  min_send_interval_ms?: number;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  mode: RoomMode;
  host_id: string;
  leader_id: string | null;
  traveler_limit: number;
  locked: boolean;
  status: "active" | "ended";
  settings: RoomSettings;
  expires_at: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface MemberRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  sharing: boolean;
  arrived_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_heading: number | null;
  last_speed: number | null;
  last_seen_at: string | null;
  joined_at: string;
  left_at: string | null;
  kicked: boolean;
}

export interface DestRow {
  id: string;
  room_id: string;
  member_id: string | null; // null => room-level destination
  label: string;
  lat: number;
  lng: number;
  created_by: string;
  created_at: string;
}

// --------------------------------------------------------------------------
// Realtime payloads (broadcast events on the "room:<uuid>" channel)
// --------------------------------------------------------------------------

/** Broadcast event 'loc' — sent by travelers only, never persisted. */
export interface LocTick {
  u: string; // user_id
  t: number; // skew-corrected epoch ms
  la: number; // lat, rounded to 5 decimals (~1m)
  ln: number; // lng
  h?: number; // heading deg
  s?: number; // speed m/s
  a?: number; // accuracy m
  st: "mv" | "st"; // moving | stationary (sender-computed)
}

/** Broadcast event 'evt' — low-frequency, self-reported room events. */
export type RoomEvt =
  | { k: "arrived"; u: string; t: number }
  | { k: "deviated"; u: string; t: number; offM: number }
  | { k: "rejoined"; u: string; t: number };

/** Presence meta — tracked once per connection, updated only on state transitions. */
export interface PresenceMeta {
  name: string;
  role: MemberRole;
  sharing: boolean;
  appState: "fg" | "bg";
  dev: string; // device instance id, disambiguates one account on two devices
}

/** Payload shape produced by realtime.broadcast_changes() triggers. */
export interface DbChangePayload<T> {
  id?: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  record: T | null;
  old_record: T | null;
}

// --------------------------------------------------------------------------
// RPC results
// --------------------------------------------------------------------------

export type RpcError =
  | "not_authenticated"
  | "bad_code"
  | "bad_mode"
  | "bad_role"
  | "room_full"
  | "room_locked"
  | "room_ended"
  | "kicked"
  | "not_member"
  | "not_host"
  | "forbidden"
  | "network";

export type RpcResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: RpcError; message?: string };

export interface SnapshotPayload {
  room: RoomRow;
  members: MemberRow[];
  destinations: DestRow[];
  server_now_ms: number;
}

// --------------------------------------------------------------------------
// Client-side live state
// --------------------------------------------------------------------------

export interface RouteResult {
  coords: [number, number][]; // GeoJSON lnglat order
  distanceM: number;
  durationS: number;
  source: "ors" | "osrm" | "straightline";
  fetchedAt: number;
}

export interface LivePosition {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  atMs: number;
  source: "tick" | "last_seen";
}

export type PresenceState = "moving" | "stationary" | "reconnecting" | "offline" | "arrived";

/** Merged truth for one participant: DB row + latest tick + channel presence. */
export interface MemberLive {
  userId: string;
  memberId: string;
  name: string;
  role: MemberRole;
  sharing: boolean;
  arrivedAt: string | null;
  online: boolean;
  appState?: "fg" | "bg";
  moving: boolean;
  pos?: LivePosition;
}
