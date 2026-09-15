import { activeSos, SOS_TTL_MS, useMembersStore } from "@/stores/membersStore";
import type { MemberRow } from "@/types/contracts";

const A = "u-a";
const B = "u-b";

function row(userId: string, overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: `m-${userId}`,
    room_id: "room-1",
    user_id: userId,
    display_name: userId,
    role: "traveler",
    sharing: true,
    arrived_at: null,
    last_lat: 48.2,
    last_lng: 16.37,
    last_heading: null,
    last_speed: null,
    last_seen_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
    left_at: null,
    kicked: false,
    ...overrides,
  };
}

beforeEach(() => {
  useMembersStore.getState().reset();
});

describe("SOS state", () => {
  it("sets, reads back fresh, and clears", () => {
    const now = Date.now();
    useMembersStore.getState().setSos(A, now);
    expect(useMembersStore.getState().sosByUser[A]).toBe(now);
    expect(activeSos(useMembersStore.getState().sosByUser, now + 1_000)).toEqual([
      { userId: A, atMs: now },
    ]);
    useMembersStore.getState().clearSos(A);
    expect(useMembersStore.getState().sosByUser).toEqual({});
  });

  it("expires entries past the TTL at read time", () => {
    const now = Date.now();
    useMembersStore.getState().setSos(A, now - SOS_TTL_MS - 1);
    useMembersStore.getState().setSos(B, now);
    expect(activeSos(useMembersStore.getState().sosByUser, now)).toEqual([
      { userId: B, atMs: now },
    ]);
  });

  it("prunes leavers on member rows and snapshots, clears on reset", () => {
    useMembersStore.getState().applySnapshot([row(A), row(B)]);
    useMembersStore.getState().setSos(A, Date.now());
    useMembersStore.getState().setSos(B, Date.now());
    useMembersStore.getState().applyMemberRow(row(A, { left_at: new Date().toISOString() }));
    expect(useMembersStore.getState().sosByUser[A]).toBeUndefined();
    expect(useMembersStore.getState().sosByUser[B]).toBeDefined();
    // Snapshot without B drops B's SOS too.
    useMembersStore.getState().applySnapshot([row(A)]);
    expect(useMembersStore.getState().sosByUser).toEqual({});
    useMembersStore.getState().setSos(A, Date.now());
    useMembersStore.getState().reset();
    expect(useMembersStore.getState().sosByUser).toEqual({});
  });
});
