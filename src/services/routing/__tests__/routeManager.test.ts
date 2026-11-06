import { modeRegistry } from "@/modes/registry";
import type { ClientSnapshot } from "@/modes/types";
import { ensureRoutes, resetRouteManager } from "@/services/routing/routeManager";
import { fetchRoute } from "@/services/routing/router";
import { useRouteStore } from "@/stores/routeStore";
import type { MemberLive, RouteResult } from "@/types/contracts";

jest.mock("@/services/routing/router", () => ({ fetchRoute: jest.fn() }));
jest.mock("@/services/realtime/roomChannel", () => ({ sendEvt: jest.fn() }));

const fetchMock = fetchRoute as jest.MockedFunction<typeof fetchRoute>;

const DEST = { lat: 48.22, lng: 16.4 };
const POS = { lat: 48.2, lng: 16.37 };

const traveler = (userId: string): MemberLive => ({
  userId,
  memberId: `m-${userId}`,
  name: userId,
  role: "traveler",
  sharing: true,
  arrivedAt: null,
  online: true,
  moving: true,
  pos: { ...POS, atMs: 0 } as MemberLive["pos"],
});

// A road route that already ends at the destination, fetched `ageMs` ago.
const routeAged = (ageMs: number): RouteResult => ({
  coords: [
    [POS.lng, POS.lat],
    [DEST.lng, DEST.lat],
  ],
  distanceM: 3000,
  durationS: 600,
  source: "osrm",
  fetchedAt: Date.now() - ageMs,
});

function snap(routes: Record<string, RouteResult>): ClientSnapshot {
  return {
    room: { id: "r1", mode: "converge", leader_id: null, settings: {} } as unknown as ClientSnapshot["room"],
    members: { me: traveler("me"), peer: traveler("peer") },
    destRoom: { ...DEST, label: "Cafe" } as unknown as ClientSnapshot["destRoom"],
    destByMember: {},
    routes,
    units: "km",
  };
}

describe("route refresh paced by tier", () => {
  beforeEach(() => {
    resetRouteManager();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(routeAged(0));
  });

  const sevenMin = 7 * 60_000;

  it("refreshes an emphasized peer after 5 minutes", async () => {
    useRouteStore.getState().setTiers({ me: "primary", peer: "secondary" });
    await ensureRoutes(snap({ me: routeAged(0), peer: routeAged(sevenMin) }), modeRegistry.converge, "me");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a context or hidden peer wait until 10 minutes", async () => {
    useRouteStore.getState().setTiers({ me: "primary", peer: "context" });
    await ensureRoutes(snap({ me: routeAged(0), peer: routeAged(sevenMin) }), modeRegistry.converge, "me");
    expect(fetchMock).not.toHaveBeenCalled();

    useRouteStore.getState().setTiers({ me: "primary", peer: "hidden" });
    await ensureRoutes(snap({ me: routeAged(0), peer: routeAged(11 * 60_000) }), modeRegistry.converge, "me");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
