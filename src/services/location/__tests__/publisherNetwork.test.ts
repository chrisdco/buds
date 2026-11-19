import { disposePublisher, getPublisher } from "@/services/location/publisher";
import { useRoomStore } from "@/stores/roomStore";
import { useSessionStore } from "@/stores/sessionStore";

const mockSendLoc = jest.fn();
let mockLive = true;
jest.mock("@/services/realtime/roomChannel", () => ({
  isRoomChannelLive: () => mockLive,
  sendLoc: (t: unknown) => mockSendLoc(t),
  setReconnectedHook: jest.fn(),
}));
const mockUpdateLastSeen = jest.fn();
jest.mock("@/services/rpc/rooms", () => ({
  roomsRpc: { updateLastSeen: (a: unknown) => mockUpdateLastSeen(a) },
}));
jest.mock("@/services/location/throttle", () => ({
  createSendThrottle: () => () => ({ send: true, moving: true }),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/services/location/jitterFilter", () => ({
  createJitterFilter: () => (f: unknown) => f,
}));


// Registered once when the publisher module loads (before this file's lets run).
const reconnected = () =>
  (jest.requireMock("@/services/realtime/roomChannel").setReconnectedHook as jest.Mock).mock.calls[0][0]();

const fix = (lat: number) => ({ lat, lng: 77.6, accuracy: 5, atMs: Date.now() });
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["setImmediate"] });
  jest.setSystemTime(1_000_000);
  mockSendLoc.mockClear();
  mockUpdateLastSeen.mockReset();
  mockLive = true;
  disposePublisher();
  useRoomStore.getState().reset();
  useSessionStore.setState({ userId: "me" });
});
afterEach(() => jest.useRealTimers());

it("re-sends the latest position when the connection comes back", () => {
  mockUpdateLastSeen.mockResolvedValue({ ok: true });
  const p = getPublisher("r1", { isBackground: () => false })!;
  p.publish(fix(12.9));
  p.publish(fix(12.91));
  mockSendLoc.mockClear();
  reconnected();
  expect(mockSendLoc).toHaveBeenCalledTimes(1);
  expect(mockSendLoc.mock.calls[0][0].la).toBeCloseTo(12.91);
  expect(useRoomStore.getState().lastSentAtMs).toBe(1_000_000);
});

it("does not re-send a position older than two minutes", () => {
  mockUpdateLastSeen.mockResolvedValue({ ok: true });
  const p = getPublisher("r1", { isBackground: () => false })!;
  p.publish(fix(12.9));
  mockSendLoc.mockClear();
  jest.setSystemTime(1_000_000 + 3 * 60_000);
  reconnected();
  expect(mockSendLoc).not.toHaveBeenCalled();
});

it("waits before retrying a failed last_seen write instead of hammering", async () => {
  mockLive = false;
  mockUpdateLastSeen.mockRejectedValue(new Error("offline"));
  const p = getPublisher("r1", { isBackground: () => true })!;
  p.publish(fix(12.9));
  await flush();
  expect(mockUpdateLastSeen).toHaveBeenCalledTimes(1);
  jest.setSystemTime(1_000_000 + 5_000);
  p.publish(fix(12.91));
  await flush();
  expect(mockUpdateLastSeen).toHaveBeenCalledTimes(1);
  jest.setSystemTime(1_000_000 + 16_000);
  p.publish(fix(12.92));
  await flush();
  expect(mockUpdateLastSeen).toHaveBeenCalledTimes(2);
  expect(useRoomStore.getState().lastSentAtMs).toBeNull();
});
