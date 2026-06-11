import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MemberRole } from "@/types/contracts";

const KEY = "buds.activeRoom";

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
}

export function clearActiveRoom(): void {
  void AsyncStorage.removeItem(KEY);
}
