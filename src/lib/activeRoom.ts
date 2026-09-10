import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MemberRole } from "@/types/contracts";

const KEY = "buds.activeRoom";
const RECENTS_KEY = "buds.recentRooms";
const MAX_RECENTS = 5;

export { KEY as ACTIVE_ROOM_KEY, RECENTS_KEY };

export interface ActiveRoomRef {
  id: string;
  code: string;
  name: string;
  role: MemberRole;
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
