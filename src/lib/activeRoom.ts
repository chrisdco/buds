import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MemberRole, RoomMode, SnapshotPayload } from "@/types/contracts";

const KEY = "buds.activeRoom";
const RECENTS_KEY = "buds.recentRooms";
// Enough for Trips to read as a history, small enough to stay one read.
const MAX_RECENTS = 20;
const MAX_BUDS = 10;

export { KEY as ACTIVE_ROOM_KEY, RECENTS_KEY };

export interface ActiveRoomRef {
  id: string;
  code: string;
  name: string;
  role: MemberRole;
  // Trip details, filled from the room snapshot each time it loads (see
  // recordRoomVisit). Optional: refs saved by older builds lack them.
  mode?: RoomMode;
  destLabel?: string | null;
  /** Room destination coordinates, so "Go again" can reuse the place. */
  destLat?: number | null;
  destLng?: number | null;
  /** Other members seen in the room (not you), newest snapshot wins. */
  buds?: { userId: string; name: string }[];
  /** Last time this device had the room open, ms epoch. */
  lastAtMs?: number;
}

/**
 * Pure merge of a room snapshot into its recents entry: what Trips and
 * Profile show (mode, destination, who was there, when). Members who left
 * stay listed; they were still on the trip.
 */
export function mergeVisit(
  ref: ActiveRoomRef,
  snap: SnapshotPayload,
  myUserId: string | null,
  nowMs: number,
): ActiveRoomRef {
  const roomDest = snap.destinations.find((d) => d.member_id == null);
  const buds = snap.members
    .filter((m) => m.user_id !== myUserId)
    .slice(0, MAX_BUDS)
    .map((m) => ({ userId: m.user_id, name: m.display_name }));
  return {
    ...ref,
    name: snap.room.name,
    mode: snap.room.mode,
    destLabel: roomDest?.label ?? null,
    destLat: roomDest?.lat ?? null,
    destLng: roomDest?.lng ?? null,
    buds,
    lastAtMs: nowMs,
  };
}

export async function getActiveRoom(): Promise<ActiveRoomRef | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveRoomRef) : null;
  } catch {
    return null;
  }
}

export function setActiveRoom(ref: ActiveRoomRef): void {
  void AsyncStorage.setItem(KEY, JSON.stringify(ref));
  void pushRecentRoom(ref);
}

export function clearActiveRoom(): void {
  void AsyncStorage.removeItem(KEY);
}

/** Recent trips (most-recent-first, capped) for the Trips list. Self-prunes on failed rejoins. */
export async function getRecentRooms(): Promise<ActiveRoomRef[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ActiveRoomRef =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as ActiveRoomRef).id === "string" &&
        typeof (r as ActiveRoomRef).code === "string",
    );
  } catch {
    return [];
  }
}

export async function pushRecentRoom(ref: ActiveRoomRef): Promise<void> {
  try {
    const recents = await getRecentRooms();
    const next = [ref, ...recents.filter((r) => r.id !== ref.id)].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // History is convenience only; never block joining.
  }
}

export async function pruneRecentRoom(id: string): Promise<void> {
  try {
    const recents = await getRecentRooms();
    await AsyncStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(recents.filter((r) => r.id !== id)),
    );
  } catch {
    // Best-effort.
  }
}

/** Updates an existing recents entry from a snapshot; never adds one. */
export async function recordRoomVisit(snap: SnapshotPayload, myUserId: string | null): Promise<void> {
  try {
    const recents = await getRecentRooms();
    const i = recents.findIndex((r) => r.id === snap.room.id);
    if (i < 0) return;
    recents[i] = mergeVisit(recents[i], snap, myUserId, Date.now());
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // History is convenience only.
  }
}

/**
 * Explicit local forget (Trips row delete). Recents are device-local refs,
 * so forgetting is local only: the room itself is untouched and
 * rejoin-by-code keeps working. Server-side end/kick/leave already
 * self-prunes on the next rejoin attempt; no admin propagation exists or is
 * needed (nobody can reach into another device's storage).
 */
export function removeRecentRoom(id: string): Promise<void> {
  return pruneRecentRoom(id);
}
