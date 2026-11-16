import { supabase } from "@/lib/supabaseClient";
import { searchPlaces as photonSearch } from "@/services/places/photon";
import { fromProxyRows, resetPlaceSearch, searchPlaces } from "@/services/places/search";

jest.mock("@/lib/supabaseClient", () => ({ supabase: { functions: { invoke: jest.fn() } }, supabaseConfigured: true }));
jest.mock("@/services/places/photon", () => ({
  ...jest.requireActual("@/services/places/photon"),
  searchPlaces: jest.fn(),
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockPhoton = photonSearch as jest.Mock;
const origin = { lat: 12.97, lng: 77.59 };
const row = { id: "m1", name: "Third Wave Coffee", address: "Indiranagar, Bengaluru", lat: 12.978, lng: 77.64, kind: "Cafe" };

describe("place search", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockPhoton.mockReset().mockResolvedValue([{ id: "p1", name: "OSM", address: "", lat: 1, lng: 1, distanceM: null }]);
    resetPlaceSearch();
  });

  it("uses Mapbox results from the proxy, with distances", async () => {
    mockInvoke.mockResolvedValue({ data: { results: [row] }, error: null });
    const r = await searchPlaces("third wave", origin);
    expect(r[0].name).toBe("Third Wave Coffee");
    expect(r[0].distanceM).toBeGreaterThan(4000);
    expect(mockPhoton).not.toHaveBeenCalled();
  });

  it("falls back to Photon when the proxy fails or finds nothing", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "502", context: { status: 502 } } });
    expect((await searchPlaces("x y", origin))[0].id).toBe("p1");
    mockInvoke.mockResolvedValueOnce({ data: { results: [] }, error: null });
    expect((await searchPlaces("x y", origin))[0].id).toBe("p1");
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("stops asking the proxy for a while when it has no token", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "503", context: { status: 503 } } });
    await searchPlaces("cafe", origin);
    await searchPlaces("cafe", origin);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockPhoton).toHaveBeenCalledTimes(2);
  });

  it("drops malformed rows", () => {
    expect(fromProxyRows([row, { ...row, lat: NaN }], origin)).toHaveLength(1);
  });
});
