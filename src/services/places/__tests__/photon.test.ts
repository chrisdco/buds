import { isAbortError, parsePhoton, searchPlaces } from "@/services/places/photon";

const BERLIN = { lat: 52.52, lng: 13.405 };

describe("parsePhoton", () => {
  it("returns empty for missing or malformed payloads", () => {
    expect(parsePhoton({})).toEqual([]);
    expect(parsePhoton({ features: [{ geometry: {}, properties: {} }] })).toEqual([]);
    expect(parsePhoton({ features: [{ properties: { name: "x" } }] })).toEqual([]);
  });

  it("maps name + address + distance", () => {
    const [r] = parsePhoton(
      {
        features: [
          {
            geometry: { coordinates: [13.41, 52.525] },
            properties: {
              osm_type: "N",
              osm_id: 7,
              name: "Cafe Mitte",
              street: "Torstr",
              housenumber: "101",
              city: "Berlin",
              country: "Germany",
            },
          },
        ],
      },
      BERLIN,
    );
    expect(r.id).toBe("N7");
    expect(r.name).toBe("Cafe Mitte");
    expect(r.address).toBe("Torstr 101, Berlin, Germany");
    expect(r.lat).toBe(52.525);
    expect(r.lng).toBe(13.41);
    expect(r.distanceM).toBeGreaterThan(400);
    expect(r.distanceM).toBeLessThan(900);
  });

  it("falls back to street when unnamed and nulls distance without origin", () => {
    const [r] = parsePhoton({
      features: [
        {
          geometry: { coordinates: [13.41, 52.525] },
          properties: { street: "Torstr", housenumber: "101", city: "Berlin" },
        },
      ],
    });
    expect(r.name).toBe("Torstr 101");
    expect(r.address).toBe("Berlin");
    expect(r.distanceM).toBeNull();
  });
});

describe("isAbortError", () => {
  it("matches aborts by name and rejects everything else", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("photon:500"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});

describe("searchPlaces transport", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  const payload = {
    features: [
      {
        geometry: { coordinates: [13.41, 52.525] },
        properties: { osm_type: "N", osm_id: 7, name: "Cafe Mitte", city: "Berlin" },
      },
    ],
  };

  it("sends an abort signal and parses the payload", async () => {
    const mock = jest.fn(async (_url: unknown, _init?: unknown) => ({
      ok: true,
      json: async () => payload,
    }));
    global.fetch = mock as unknown as typeof fetch;
    const [r] = await searchPlaces("cafe");
    expect(mock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mock.mock.calls[0] as [unknown, RequestInit | undefined];
    expect(String(calledUrl)).toContain("photon.komoot.io");
    expect(calledInit?.signal).toBeInstanceOf(AbortSignal);
    expect(r.name).toBe("Cafe Mitte");
  });

  it("throws typed errors on HTTP failure", async () => {
    global.fetch = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(searchPlaces("cafe")).rejects.toThrow("photon:503");
  });

  it("forwards caller aborts as AbortError", async () => {
    global.fetch = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      })) as unknown as typeof fetch;
    const controller = new AbortController();
    const pending = searchPlaces("cafe", undefined, 6, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
