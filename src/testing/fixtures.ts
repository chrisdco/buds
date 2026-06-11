import type { ClientSnapshot } from "@/modes/types";
import type {
  DestRow,
  MemberLive,
  RoomRow,
  RouteResult,
} from "@/types/contracts";

export function makeRoom(partial: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "room-1",
    code: "ABC234",
    name: "Test trip",
    mode: "converge",
    host_id: "alice",
    leader_id: null,
    traveler_limit: 10,
    locked: false,
    status: "active",
    settings: {},
    expires_at: null,
    created_at: "2026-06-12T10:00:00Z",
    ended_at: null,
    ...partial,
  };
}

export function makeMember(
  userId: string,
  partial: Partial<MemberLive> = {},
): MemberLive {
  return {
    userId,
    memberId: `m-${userId}`,
    name: userId,
    role: "traveler",
    sharing: true,
    arrivedAt: null,
    online: true,
    moving: false,
    ...partial,
  };
}

export function at(lat: number, lng: number): MemberLive["pos"] {
  return { lat, lng, atMs: 1_000_000, source: "tick" };
}

export function makeRoomDest(lat: number, lng: number): DestRow {
  return {
    id: "dest-room",
    room_id: "room-1",
    member_id: null,
    label: "Meet point",
    lat,
    lng,
    created_by: "alice",
    created_at: "2026-06-12T10:00:00Z",
  };
}

export function makeMemberDest(memberId: string, lat: number, lng: number): DestRow {
  return {
    id: `dest-${memberId}`,
    room_id: "room-1",
    member_id: memberId,
    label: "Destination",
    lat,
    lng,
    created_by: "alice",
    created_at: "2026-06-12T10:00:00Z",
  };
}

export function makeRoute(
  coords: [number, number][],
  partial: Partial<RouteResult> = {},
): RouteResult {
  return {
    coords,
    distanceM: 1_000,
    durationS: 300,
    source: "osrm",
    fetchedAt: 1_000_000,
    ...partial,
  };
}

export function makeSnap(partial: Partial<ClientSnapshot> = {}): ClientSnapshot {
  return {
    room: makeRoom(),
    members: {},
    destRoom: null,
    destByMember: {},
    routes: {},
    nowMs: 1_000_000,
    ...partial,
  };
}
