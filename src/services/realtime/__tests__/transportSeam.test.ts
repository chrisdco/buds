/**
 * Lifecycle tests against a fake RoomTransport — no supabase-js at all. This
 * is the contract a future backend (architecture review R3) must satisfy:
 * the app only needs open/close/isLive/send/track plus the four handlers.
 */
import {
  connectRoomChannel,
  disconnectRoomChannel,
  isRoomChannelLive,
  sendLoc,
  setRoomTransportFactory,
} from "@/services/realtime/roomChannel";
import { createSupabaseTransport } from "@/services/realtime/supabaseTransport";
import type { RoomTransport, RoomTransportHandlers } from "@/services/realtime/transport";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import { PROTOCOL_VERSION } from "@/types/contracts";

jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/services/rpc/rooms", () => ({ roomsRpc: { getRoomSnapshot: jest.fn() } }));
jest.mock("@/services/notifications", () => ({ notifyAlert: jest.fn(async () => {}) }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

const ROOM = "room-1";
const ME = "u-me";
const PEER = "u-peer";
const snapshotMock = roomsRpc.getRoomSnapshot as jest.Mock;

interface Fake extends RoomTransport {
  handlers: RoomTransportHandlers | null;
  live: boolean;
  sent: [string, object][];
  tracked: unknown[];
  closed: boolean;
  openImpl: () => Promise<void>;
}

function makeFake(): Fake {
  const fake: Fake = {
    handlers: null,
    live: false,
    sent: [],
    tracked: [],
    closed: false,
    openImpl: async () => {},
    async open(_roomId, _key, handlers) {
      await fake.openImpl();
      fake.handlers = handlers;
    },
    async close() {
      fake.closed = true;
    },
    isLive: () => fake.live && !fake.closed,
    send(event, payload) {
      fake.sent.push([event, payload]);
    },
    track(meta) {
      fake.tracked.push(meta);
    },
  };
  return fake;
}

function snapshot() {
  return {
    ok: true,
    room: { id: ROOM, name: "Trip", status: "active", settings: {}, host_id: ME },
    members: [
      {
        id: "m-peer",
        room_id: ROOM,
        user_id: PEER,
        display_name: "Peer",
        role: "traveler",
        sharing: true,
        arrived_at: null,
        last_lat: null,
        last_lng: null,
        last_heading: null,
        last_speed: null,
        last_seen_at: null,
        joined_at: new Date().toISOString(),
        left_at: null,
        kicked: false,
      },
    ],
    destinations: [],
    server_now_ms: Date.now(),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let fakes: Fake[];

beforeEach(() => {
  fakes = [];
  setRoomTransportFactory(() => {
    const f = makeFake();
    fakes.push(f);
    return f;
  });
  useSessionStore.setState({ userId: ME, displayName: "Me" });
  snapshotMock.mockReset();
  snapshotMock.mockResolvedValue(snapshot());
});

afterEach(async () => {
  await disconnectRoomChannel();
  setRoomTransportFactory(createSupabaseTransport);
});

describe("room connection over an arbitrary transport", () => {
  it("on connected: tracks versioned presence, applies the snapshot", async () => {
    await connectRoomChannel(ROOM);
    const f = fakes[0];
    expect(useRoomStore.getState().connection).toBe("connecting");
    f.handlers!.onStatus("connected");
    await flush();
    expect(useRoomStore.getState().connection).toBe("connected");
    expect(f.tracked[0]).toMatchObject({ v: PROTOCOL_VERSION, name: "Me" });
    expect(useMembersStore.getState().members[PEER]?.name).toBe("Peer");
  });

  it("routes peer and control payloads through validation", async () => {
    await connectRoomChannel(ROOM);
    const f = fakes[0];
    f.handlers!.onStatus("connected");
    await flush();
    f.handlers!.onPeer("loc", { u: PEER, t: 1, la: 48.2, ln: 16.37, st: "mv" });
    expect(useMembersStore.getState().members[PEER]?.pos).toMatchObject({ lat: 48.2 });
    f.handlers!.onPeer("loc", "garbage");
    f.handlers!.onControl("member_change", null);
    f.handlers!.onControl("room_change", { record: { ...snapshot().room, name: "Renamed" } });
    expect(useRoomStore.getState().room?.name).toBe("Renamed");
  });

  it("stamps outbound sends and reports liveness from the transport", async () => {
    await connectRoomChannel(ROOM);
    const f = fakes[0];
    expect(isRoomChannelLive()).toBe(false);
    f.live = true;
    expect(isRoomChannelLive()).toBe(true);
    sendLoc({ u: ME, t: 1, la: 1, ln: 2, st: "st" });
    expect(f.sent).toEqual([["loc", { u: ME, t: 1, la: 1, ln: 2, st: "st", v: PROTOCOL_VERSION }]]);
  });

  it("maps an open failure to reconnecting", async () => {
    setRoomTransportFactory(() => {
      const f = makeFake();
      f.openImpl = async () => {
        throw new Error("auth");
      };
      fakes.push(f);
      return f;
    });
    await connectRoomChannel(ROOM);
    expect(useRoomStore.getState().connection).toBe("reconnecting");
  });

  it("announces a rejoin after reconnecting, and closes on disconnect", async () => {
    await connectRoomChannel(ROOM);
    const f = fakes[0];
    f.handlers!.onStatus("connected");
    await flush();
    f.handlers!.onStatus("reconnecting");
    expect(useRoomStore.getState().connection).toBe("reconnecting");
    f.handlers!.onStatus("connected");
    await flush();
    expect(f.sent.some(([e, p]) => e === "evt" && (p as { k: string }).k === "rejoined")).toBe(
      true,
    );
    await disconnectRoomChannel();
    expect(f.closed).toBe(true);
    expect(isRoomChannelLive()).toBe(false);
  });

  it("ignores status from a previous room's transport after switching", async () => {
    await connectRoomChannel(ROOM);
    const old = fakes[0];
    await connectRoomChannel("room-2");
    old.handlers!.onStatus("reconnecting");
    expect(useRoomStore.getState().connection).toBe("connecting");
    expect(old.closed).toBe(true);
  });
});
