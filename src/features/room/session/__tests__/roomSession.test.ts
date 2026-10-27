import { startRoomSession } from "@/features/room/session/roomSession";
import { sendEvt } from "@/services/realtime/roomChannel";
import { ensureRoutes } from "@/services/routing/routeManager";
import { roomsRpc } from "@/services/rpc/rooms";
import { useMembersStore } from "@/stores/membersStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { DestRow, MemberLive, RoomRow } from "@/types/contracts";

jest.mock("@/services/rpc/rooms", () => ({
  roomsRpc: { markArrived: jest.fn(async () => ({ ok: true })) },
}));
jest.mock("@/services/realtime/roomChannel", () => ({ sendEvt: jest.fn() }));
jest.mock("@/services/routing/routeManager", () => ({ ensureRoutes: jest.fn(async () => {}) }));
jest.mock("@/services/notifications", () => ({
  notifyAlert: jest.fn(async () => {}),
  ensureNotificationPermission: jest.fn(async () => true),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

const ME = "u-me";
const DEST = { lat: 48.2, lng: 16.37 };
const markArrived = roomsRpc.markArrived as jest.Mock;
const sendEvtMock = sendEvt as jest.Mock;
const ensureRoutesMock = ensureRoutes as jest.Mock;

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function room(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "room-1",
    code: "ABC234",
    name: "Trip",
    mode: "converge",
    host_id: ME,
    leader_id: null,
    traveler_limit: 8,
    locked: false,
    status: "active",
    settings: {},
    expires_at: null,
    created_at: new Date().toISOString(),
    ended_at: null,
    ...overrides,
  };
}

function me(pos: { lat: number; lng: number } | null): MemberLive {
  return {
    userId: ME,
    memberId: "m-me",
    name: "Me",
    role: "traveler",
    sharing: true,
    arrivedAt: null,
    online: true,
    appState: "fg",
    moving: false,
    ...(pos ? { pos: { ...pos, atMs: Date.now(), source: "tick" as const } } : {}),
  };
}

const destRow: DestRow = {
  id: "d-1",
  room_id: "room-1",
  member_id: null,
  label: "Meet",
  lat: DEST.lat,
  lng: DEST.lng,
  created_by: ME,
  created_at: new Date().toISOString(),
};

let clock = 0;
let stop: (() => void) | null = null;

beforeEach(() => {
  clock = 0;
  jest.clearAllMocks();
  useSessionStore.setState({ userId: ME });
  useRoomStore.setState({ room: room(), destRoom: destRow, destByMember: {} });
  useMembersStore.setState({ members: { [ME]: me(null) }, sosByUser: {} });
});

afterEach(() => {
  stop?.();
  stop = null;
});

/** Any store write re-triggers the controller (coalesced to one pass). */
async function poke(at: number) {
  clock = at;
  useMembersStore.setState({ members: { ...useMembersStore.getState().members } });
  await flush();
}

describe("room session controller", () => {
  it("reconciles routes on start and on data changes", async () => {
    stop = startRoomSession({ now: () => clock });
    await flush();
    expect(ensureRoutesMock).toHaveBeenCalledTimes(1);
    await poke(1);
    expect(ensureRoutesMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces a burst of store writes into one pass", async () => {
    stop = startRoomSession({ now: () => clock });
    await flush();
    ensureRoutesMock.mockClear();
    useMembersStore.setState({ members: { ...useMembersStore.getState().members } });
    useRoomStore.setState({ room: room() });
    useSessionStore.setState({ userId: ME });
    await flush();
    expect(ensureRoutesMock).toHaveBeenCalledTimes(1);
  });

  it("reports arrival after a sustained stay inside the radius, then broadcasts", async () => {
    stop = startRoomSession({ now: () => clock });
    useMembersStore.setState({ members: { [ME]: me(DEST) } });
    await flush();
    await poke(5_000);
    expect(markArrived).not.toHaveBeenCalled(); // not sustained yet (10s)
    await poke(11_000);
    expect(markArrived).toHaveBeenCalledWith("room-1");
    await flush();
    expect(sendEvtMock).toHaveBeenCalledWith(expect.objectContaining({ k: "arrived", u: ME }));
  });

  it("does nothing before the room loads or after stop", async () => {
    useRoomStore.setState({ room: null });
    stop = startRoomSession({ now: () => clock });
    await flush();
    expect(ensureRoutesMock).not.toHaveBeenCalled();

    useRoomStore.setState({ room: room() });
    await flush();
    expect(ensureRoutesMock).toHaveBeenCalledTimes(1);

    stop();
    stop = null;
    await poke(2);
    expect(ensureRoutesMock).toHaveBeenCalledTimes(1);
  });
});
