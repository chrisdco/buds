import { create } from "zustand";

import type {
  LocTick,
  MemberLive,
  MemberRow,
  PresenceMeta,
  PresenceState,
} from "@/types/contracts";

const TICK_FRESH_MS = 45_000;
const RECONNECTING_WINDOW_MS = 2 * 60_000;

function fromRow(row: MemberRow, prev?: MemberLive): MemberLive {
  const dbPos =
    row.last_lat != null && row.last_lng != null
      ? {
          lat: row.last_lat,
          lng: row.last_lng,
          heading: row.last_heading ?? undefined,
          speed: row.last_speed ?? undefined,
          atMs: row.last_seen_at ? Date.parse(row.last_seen_at) : 0,
          source: "last_seen" as const,
        }
      : undefined;

  // A live tick always beats the low-frequency DB recovery snapshot.
  const pos =
    prev?.pos && prev.pos.source === "tick" && (!dbPos || prev.pos.atMs >= dbPos.atMs)
      ? prev.pos
      : dbPos;

  return {
    userId: row.user_id,
    memberId: row.id,
    name: row.display_name,
    role: row.role,
    sharing: row.sharing,
    arrivedAt: row.arrived_at,
    online: prev?.online ?? false,
    appState: prev?.appState,
    moving: prev?.moving ?? false,
    pos,
  };
}

interface MembersState {
  members: Record<string, MemberLive>;
  applySnapshot: (rows: MemberRow[]) => void;
  applyMemberRow: (row: MemberRow) => void;
  applyTick: (tick: LocTick) => void;
  syncPresence: (state: Record<string, PresenceMeta[]>) => void;
  reset: () => void;
}

export const useMembersStore = create<MembersState>()((set, get) => ({
  members: {},

  applySnapshot: (rows) => {
    const prev = get().members;
    const next: Record<string, MemberLive> = {};
    for (const row of rows) {
      if (row.left_at) continue;
      next[row.user_id] = fromRow(row, prev[row.user_id]);
    }
    set({ members: next });
  },

  applyMemberRow: (row) => {
    const members = { ...get().members };
    if (row.left_at) {
      delete members[row.user_id];
    } else {
      members[row.user_id] = fromRow(row, members[row.user_id]);
    }
    set({ members });
  },

  applyTick: (tick) => {
    const members = get().members;
    const m = members[tick.u];
    // Unknown sender: membership row hasn't arrived yet; the member_change /
    // snapshot path will introduce them.
    if (!m) return;
    if (m.role === "spectator") return; // spectators never broadcast locations
    set({
      members: {
        ...members,
        [tick.u]: {
          ...m,
          moving: tick.st === "mv",
          pos: {
            lat: tick.la,
            lng: tick.ln,
            heading: tick.h,
            speed: tick.s,
            accuracy: tick.a,
            atMs: Date.now(), // receive time — never trust sender clocks for staleness
            source: "tick",
          },
        },
      },
    });
  },

  syncPresence: (state) => {
    const members = { ...get().members };
    const onlineIds = new Set(Object.keys(state));
    for (const [userId, m] of Object.entries(members)) {
      const metas = state[userId];
      const meta = metas?.[metas.length - 1];
      members[userId] = {
        ...m,
        online: onlineIds.has(userId),
        appState: meta?.appState ?? m.appState,
      };
    }
    set({ members });
  },

  reset: () => set({ members: {} }),
}));

/** Derives the display presence state; pure so every viewer computes it locally. */
export function presenceOf(m: MemberLive, nowMs: number): PresenceState {
  if (m.arrivedAt) return "arrived";
  if (m.online) {
    if (m.moving && m.pos?.source === "tick" && nowMs - m.pos.atMs < TICK_FRESH_MS) {
      return "moving";
    }
    return "stationary";
  }
  const lastMs = m.pos?.atMs ?? 0;
  return nowMs - lastMs < RECONNECTING_WINDOW_MS ? "reconnecting" : "offline";
}

export function presenceLabel(state: PresenceState, m: MemberLive, nowMs: number): string {
  switch (state) {
    case "arrived":
      return "Arrived";
    case "moving":
      return "Moving";
    case "stationary":
      return m.sharing ? "Online" : "Sharing paused";
    case "reconnecting":
      return "Reconnecting…";
    case "offline": {
      const lastMs = m.pos?.atMs;
      if (!lastMs) return "Offline";
      const delta = nowMs - lastMs;
      if (delta < 60_000) return "Offline";
      return `Last seen ${Math.round(delta / 60_000)}m ago`;
    }
  }
}
