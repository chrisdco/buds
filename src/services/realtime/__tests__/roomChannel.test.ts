/**
 * Integration test for the realtime room channel (#17) with a fake socket.
 *
 * First jest.mock usage in the repo — and deliberately the only wiring test
 * that needs one: everything under test here IS the socket/store wiring
 * (handlers, presence, reconnect, teardown). Pure logic stays mock-free
 * elsewhere. The fake implements just the supabase-js surface roomChannel
 * touches: channel().on().subscribe(), track/send/presenceState, setAuth,
 * removeChannel. No network, deterministic, runs in the `check` CI job.
 */
import { supabase } from "@/lib/supabaseClient";
import {
  activeRoomId,
  connectRoomChannel,
  disconnectRoomChannel,
  isRoomChannelLive,
  sendLoc,
} from "@/services/realtime/roomChannel";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import type {
  DestRow,
  LocTick,
  MemberRow,
  PresenceMeta,
  RoomRow,
} from "@/types/contracts";

interface FakeChannel {
  state: string;
  broadcastHandlers: Record<string, (msg: { payload: unknown }) => void>;
  presenceHandler: (() => void) | null;
  subscribeCb: ((status: string) => void) | null;
  sent: unknown[];
  presenceData: Record<string, PresenceMeta[]>;
  track: jest.Mock;
  send: jest.Mock;
  presenceState: jest.Mock;
  on: (type: string, filter: { event: string }, cb: (msg: { payload: unknown }) => void) => unknown;
  subscribe: (cb: (status: string) => void) => unknown;
  emitBroadcast: (event: string, payload: unknown) => void;
  emitPresenceSync: () => void;
  emitSubscribe: (status: string) => void;
}

jest.mock("@/lib/supabaseClient", () => {
  const channel: FakeChannel = {
    state: "joined",
    broadcastHandlers: {},
    presenceHandler: null,
    subscribeCb: null,
    sent: [],
    presenceData: {},
    track: jest.fn(async () => "ok"),
    send: jest.fn(async (msg: unknown) => {
      channel.sent.push(msg);
    }),
    presenceState: jest.fn(() => channel.presenceData),
    on(type: string, filter: { event: string }, cb: (msg: { payload: unknown }) => void) {
      if (type === "broadcast") channel.broadcastHandlers[filter.event] = cb;
      else channel.presenceHandler = cb as () => void;
      return channel;
    },
    subscribe(cb: (status: string) => void) {
      channel.subscribeCb = cb;
      return { unsubscribe() {} };
    },
    emitBroadcast(event: string, payload: unknown) {
      channel.broadcastHandlers[event]?.({ payload });
    },
    emitPresenceSync() {
      channel.presenceHandler?.();
    },
    emitSubscribe(status: string) {
      channel.subscribeCb?.(status);
    },
  };
  return {
    supabase: {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(async () => {}),
      realtime: {
        setAuth: jest.fn(async () => {}),
        isConnected: jest.fn(() => true),
      },
    },
    __fakeChannel: channel,
  };
});

jest.mock("@/services/rpc/rooms", () => ({
  roomsRpc: { getRoomSnapshot: jest.fn() },
}));

// In-memory AsyncStorage (official jest recipe): sessionStore imports the
// native module, which doesn't exist under jest. No persistence is exercised
// here — identity is seeded via setState.
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
      getAllKeys: jest.fn(async () => [...store.keys()]),
      multiGet: jest.fn(async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null])),
      multiSet: jest.fn(async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) store.set(k, v);
      }),
      multiRemove: jest.fn(async (ks: string[]) => {
        for (const k of ks) store.delete(k);
      }),
    },
  };
});

// Reach the fakes the factories built (no outer-scope refs allowed in factories).
const mocked = supabase as unknown as {
  channel: jest.Mock;
  removeChannel: jest.Mock;
  realtime: { setAuth: jest.Mock; isConnected: jest.Mock };
};
const fake = (
  jest.requireMock("@/lib/supabaseClient") as unknown as { __fakeChannel: FakeChannel }
).__fakeChannel;
const snapshotMock = roomsRpc.getRoomSnapshot as jest.Mock;

const ROOM_ID = "room-1";
const ME = "u-me";
const PEER = "u-peer";

function roomRow(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: ROOM_ID,
    code: "ABC123",
    name: "Test trip",
    mode: "converge",
    host_id: ME,
    leader_id: null,
    traveler_limit: 10,
    locked: false,
    status: "active",
    settings: {},
    expires_at: null,
    created_at: new Date().toISOString(),
    ended_at: null,
    ...overrides,
  };
}

function memberRow(userId: string, overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: `m-${userId}`,
    room_id: ROOM_ID,
    user_id: userId,
    display_name: userId === ME ? "Me" : "Peer",
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

function destRow(overrides: Partial<DestRow> = {}): DestRow {
  return {
    id: "d-1",
    room_id: ROOM_ID,
    member_id: null,
    label: "Meet point",
    lat: 48.21,
    lng: 16.38,
    created_by: ME,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function snapshotOk() {
  return {
    ok: true as const,
    room: roomRow(),
    members: [memberRow(ME), memberRow(PEER)],
    destinations: [],
    server_now_ms: Date.now(),
  };
}

function tick(userId: string, overrides: Partial<LocTick> = {}): LocTick {
  return { u: userId, t: Date.now(), la: 48.205, ln: 16.375, st: "mv", ...overrides };
}

function meta(name: string): PresenceMeta {
  return { name, role: "traveler", sharing: true, appState: "fg", dev: `dev-${name}` };
}

async function connectSubscribed() {
  snapshotMock.mockResolvedValue(snapshotOk());
  await connectRoomChannel(ROOM_ID);
  fake.emitSubscribe("SUBSCRIBED");
  // track + refreshSnapshot are fire-and-forget inside the module.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  useRoomStore.getState().reset();
  useMembersStore.getState().reset();
  useUiStore.getState().reset();
  useSessionStore.setState({ userId: ME, displayName: "Me", deviceId: "dev-me" });
  // Keep the real channel mock but clear cross-test traffic.
  fake.sent = [];
  fake.presenceData = {};
  fake.broadcastHandlers = {};
  fake.presenceHandler = null;
  fake.subscribeCb = null;
  fake.state = "joined";
  jest.clearAllMocks();
  snapshotMock.mockResolvedValue(snapshotOk());
});

afterEach(() => {
  void disconnectRoomChannel();
});

describe("connect + subscribe", () => {
  it("joins room:<id>, tracks presence, applies the snapshot, marks connected", async () => {
    await connectSubscribed();
    expect(mocked.channel).toHaveBeenCalledWith(`room:${ROOM_ID}`, expect.anything());
    expect(useRoomStore.getState().connection).toBe("connected");
    expect(useRoomStore.getState().room?.id).toBe(ROOM_ID);
    expect(useMembersStore.getState().members[PEER]?.name).toBe("Peer");
    expect(activeRoomId()).toBe(ROOM_ID);
  });

  it("reports the channel live only when socket joined and connected", async () => {
    await connectSubscribed();
    expect(isRoomChannelLive()).toBe(true);
    fake.state = "closed";
    expect(isRoomChannelLive()).toBe(false);
  });
});

describe("loc ticks", () => {
  it("applies a known member tick to the store", async () => {
    await connectSubscribed();
    fake.emitBroadcast("loc", tick(PEER, { la: 48.21, ln: 16.38 }));
    expect(useMembersStore.getState().members[PEER]?.pos).toMatchObject({
      lat: 48.21,
      lng: 16.38,
      source: "tick",
    });
  });

  it("ignores malformed and unknown-sender ticks without crashing", async () => {
    await connectSubscribed();
    const before = useMembersStore.getState().members[PEER]?.pos;
    fake.emitBroadcast("loc", { u: PEER, la: "nope", ln: null });
    fake.emitBroadcast("loc", tick("u-ghost"));
    fake.emitBroadcast("loc", null);
    expect(useMembersStore.getState().members[PEER]?.pos).toEqual(before);
    expect(useMembersStore.getState().members["u-ghost"]).toBeUndefined();
  });

  it("sends outbound ticks through the channel", async () => {
    await connectSubscribed();
    const t = tick(ME);
    sendLoc(t);
    expect(fake.send).toHaveBeenCalledWith({ type: "broadcast", event: "loc", payload: t });
  });
});

describe("presence", () => {
  it("marks members online/offline from presence sync", async () => {
    await connectSubscribed();
    fake.presenceData = { [ME]: [meta("Me")], [PEER]: [meta("Peer")] };
    fake.emitPresenceSync();
    expect(useMembersStore.getState().members[PEER]?.online).toBe(true);
    fake.presenceData = { [ME]: [meta("Me")] };
    fake.emitPresenceSync();
    expect(useMembersStore.getState().members[PEER]?.online).toBe(false);
  });
});

describe("db-change broadcasts", () => {
  it("applies member rows and ejects on self kick", async () => {
    await connectSubscribed();
    fake.emitBroadcast("member_change", {
      operation: "UPDATE",
      record: memberRow(PEER, { display_name: "Renamed" }),
      old_record: null,
    });
    expect(useMembersStore.getState().members[PEER]?.name).toBe("Renamed");
    fake.emitBroadcast("member_change", {
      operation: "UPDATE",
      record: memberRow(ME, { kicked: true }),
      old_record: null,
    });
    expect(useRoomStore.getState().exitReason).toBe("kicked");
  });

  it("applies room and destination changes", async () => {
    await connectSubscribed();
    fake.emitBroadcast("room_change", { operation: "UPDATE", record: roomRow({ name: "New" }) });
    expect(useRoomStore.getState().room?.name).toBe("New");
    fake.emitBroadcast("dest_change", {
      operation: "INSERT",
      record: destRow(),
      old_record: null,
    });
    expect(useRoomStore.getState().destRoom?.label).toBe("Meet point");
  });
});

describe("room events", () => {
  it("surfaces peer detours as toasts, ignores malformed and own events", async () => {
    await connectSubscribed();
    fake.emitBroadcast("evt", { k: "deviated", u: PEER, t: 1, offM: 150 });
    expect(
      useUiStore.getState().toasts.some((t) => t.title === "Peer took a detour"),
    ).toBe(true);
    const count = useUiStore.getState().toasts.length;
    fake.emitBroadcast("evt", { k: "deviated", u: ME, t: 2, offM: 150 });
    fake.emitBroadcast("evt", { nonsense: true });
    fake.emitBroadcast("evt", null);
    expect(useUiStore.getState().toasts.length).toBe(count);
  });

  it("tracks peer SOS in the store, clears it, ignores malformed and own", async () => {
    await connectSubscribed();
    const t = Date.now();
    fake.emitBroadcast("evt", { k: "sos", u: PEER, t });
    expect(useMembersStore.getState().sosByUser[PEER]).toBe(t);
    // Own + malformed SOS never lands.
    fake.emitBroadcast("evt", { k: "sos", u: ME, t: t + 1 });
    fake.emitBroadcast("evt", { k: "sos", u: PEER, t: Number.NaN });
    fake.emitBroadcast("evt", { k: "sos" });
    expect(useMembersStore.getState().sosByUser[ME]).toBeUndefined();
    expect(useMembersStore.getState().sosByUser[PEER]).toBe(t);
    fake.emitBroadcast("evt", { k: "sos_clear", u: PEER, t: t + 2 });
    expect(useMembersStore.getState().sosByUser[PEER]).toBeUndefined();
  });
});

describe("reconnect + teardown", () => {
  it("refetches the snapshot and announces rejoin after reconnecting", async () => {
    await connectSubscribed();
    const calls = snapshotMock.mock.calls.length;
    useRoomStore.getState().setConnection("reconnecting");
    fake.emitSubscribe("SUBSCRIBED");
    await Promise.resolve();
    await Promise.resolve();
    expect(snapshotMock.mock.calls.length).toBeGreaterThan(calls);
    expect(fake.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "evt",
      payload: expect.objectContaining({ k: "rejoined", u: ME }),
    });
  });

  it("maps channel errors to reconnecting", async () => {
    await connectSubscribed();
    fake.emitSubscribe("CHANNEL_ERROR");
    expect(useRoomStore.getState().connection).toBe("reconnecting");
    fake.emitSubscribe("CLOSED");
    expect(useRoomStore.getState().connection).toBe("reconnecting");
  });

  it("disconnect removes the channel, clears the room id, resets stores", async () => {
    await connectSubscribed();
    await disconnectRoomChannel();
    expect(mocked.removeChannel).toHaveBeenCalled();
    expect(activeRoomId()).toBeNull();
    expect(useRoomStore.getState().room).toBeNull();
    expect(useMembersStore.getState().members).toEqual({});
  });
});
