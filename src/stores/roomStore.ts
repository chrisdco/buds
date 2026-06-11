import { create } from "zustand";

import type { DestRow, RoomRow, SnapshotPayload } from "@/types/contracts";

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";
export type ExitReason = "ended" | "kicked" | "not_member" | null;

interface RoomState {
  room: RoomRow | null;
  myMemberId: string | null;
  destRoom: DestRow | null;
  destByMember: Record<string, DestRow>;
  connection: ConnectionState;
  exitReason: ExitReason;
  setRoom: (room: RoomRow) => void;
  applySnapshot: (snap: SnapshotPayload, myUserId: string | null) => void;
  applyDestChange: (operation: string, record: DestRow | null, oldRecord: DestRow | null) => void;
  setConnection: (c: ConnectionState) => void;
  setExitReason: (r: ExitReason) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>()((set, get) => ({
  room: null,
  myMemberId: null,
  destRoom: null,
  destByMember: {},
  connection: "idle",
  exitReason: null,

  setRoom: (room) => {
    set({ room });
    if (room.status === "ended") set({ exitReason: "ended" });
  },

  applySnapshot: (snap, myUserId) => {
    const destByMember: Record<string, DestRow> = {};
    let destRoom: DestRow | null = null;
    for (const d of snap.destinations) {
      if (d.member_id) destByMember[d.member_id] = d;
      else destRoom = d;
    }
    set({
      room: snap.room,
      destRoom,
      destByMember,
      myMemberId:
        snap.members.find((m) => m.user_id === myUserId)?.id ?? get().myMemberId,
    });
    if (snap.room.status === "ended") set({ exitReason: "ended" });
  },

  applyDestChange: (operation, record, oldRecord) => {
    const target = operation === "DELETE" ? oldRecord : record;
    if (!target) return;
    if (target.member_id) {
      const destByMember = { ...get().destByMember };
      if (operation === "DELETE") delete destByMember[target.member_id];
      else destByMember[target.member_id] = target;
      set({ destByMember });
    } else {
      set({ destRoom: operation === "DELETE" ? null : target });
    }
  },

  setConnection: (connection) => set({ connection }),
  setExitReason: (exitReason) => set({ exitReason }),

  reset: () =>
    set({
      room: null,
      myMemberId: null,
      destRoom: null,
      destByMember: {},
      connection: "idle",
      exitReason: null,
    }),
}));
