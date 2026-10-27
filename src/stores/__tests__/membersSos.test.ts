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
    sos_at: null,
    ...overrides,
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  useMembersStore.getState().reset();
});

describe("SOS state (mirrors room_members.sos_at)", () => {
  it("raises from a member row, reads back fresh, clears on a null row", () => {
    const now = Date.now();
    useMembersStore.getState().applyMemberRow(row(A, { sos_at: iso(now) }));
    expect(useMembersStore.getState().sosByUser[A]).toBe(now);
    expect(activeSos(useMembersStore.getState().sosByUser, now + 1_000)).toEqual([
      { userId: A, atMs: now },
    ]);
    useMembersStore.getState().applyMemberRow(row(A, { sos_at: null }));
    expect(useMembersStore.getState().sosByUser).toEqual({});
  });

  it("restores active SOS from a snapshot (late joiners see it)", () => {
    const now = Date.now();
    useMembersStore.getState().applySnapshot([row(A, { sos_at: iso(now) }), row(B)]);
    expect(useMembersStore.getState().sosByUser).toEqual({ [A]: now });
  });

  it("expires entries past the TTL at read time", () => {
    const now = Date.now();
    useMembersStore
      .getState()
      .applySnapshot([
        row(A, { sos_at: iso(now - SOS_TTL_MS - 1) }),
        row(B, { sos_at: iso(now) }),
      ]);
    expect(activeSos(useMembersStore.getState().sosByUser, now)).toEqual([
      { userId: B, atMs: now },
    ]);
  });

  it("ignores garbage and pre-0009 rows, prunes leavers, clears on reset", () => {
    useMembersStore
      .getState()
      .applySnapshot([row(A, { sos_at: "not a date" }), row(B, { sos_at: undefined })]);
    expect(useMembersStore.getState().sosByUser).toEqual({});
    useMembersStore.getState().applyMemberRow(row(A, { sos_at: iso(Date.now()) }));
    useMembersStore
      .getState()
      .applyMemberRow(row(A, { sos_at: iso(Date.now()), left_at: iso(Date.now()) }));
    expect(useMembersStore.getState().sosByUser[A]).toBeUndefined();
    useMembersStore.getState().applyMemberRow(row(B, { sos_at: iso(Date.now()) }));
    useMembersStore.getState().reset();
    expect(useMembersStore.getState().sosByUser).toEqual({});
  });
});
