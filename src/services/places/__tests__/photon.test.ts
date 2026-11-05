import { isAbortError, parsePhoton, rankPlaces, SEARCH_TIMEOUT_MS, searchPlaces } from "@/services/places/photon";

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
    // Nearby: country is noise and dropped.
    expect(r.address).toBe("Torstr 101, Berlin");
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

describe("parsePhoton addresses", () => {
  it("uses neighbourhood + city, keeps country when unbiased, labels kind", () => {
    const [r] = parsePhoton({
      features: [
        {
          geometry: { coordinates: [77.64, 12.97] },
          properties: { name: "Toit", district: "Indiranagar", city: "Bengaluru", country: "India", osm_value: "pub" },
        },
      ],
    });
    expect(r.address).toBe("Indiranagar, Bengaluru, India");
    expect(r.kind).toBe("Pub");
  });

  it("hides vague kinds", () => {
    const [r] = parsePhoton({
      features: [{ geometry: { coordinates: [1, 1] }, properties: { name: "X", osm_value: "yes" } }],
    });
    expect(r.kind).toBeNull();
  });
});

describe("rankPlaces", () => {
  const p = (id: string, name: string, lat: number, distanceM: number | null) => ({
    id,
    name,
    address: "",
    lat,
    lng: 0,
    distanceM,
  });

  it("drops same-name results within 150 m", () => {
    expect(rankPlaces([p("a", "Mall", 0, null), p("b", "mall", 0.0005, null)]).map((r) => r.id)).toEqual(["a"]);
  });

  it("lets a near result pass a far namesake", () => {
    const far = p("far", "Central", 1, 900_000);
    const near = p("near", "Central", 2, 1_000);
    expect(rankPlaces([far, near]).map((r) => r.id)).toEqual(["near", "far"]);
  });

  it("keeps Photon order when distances are close", () => {
    expect(rankPlaces([p("a", "A", 0, 3_000), p("b", "B", 1, 1_000)]).map((r) => r.id)).toEqual(["a", "b"]);
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

  it("rejects with AbortError when the internal timeout fires", async () => {
    jest.useFakeTimers();
    try {
      global.fetch = ((_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "AbortError")),
          );
        })) as unknown as typeof fetch;
      const pending = searchPlaces("cafe");
      const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
      await jest.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not fire fetch for a pre-aborted caller signal", async () => {
    const mock = jest.fn(async () => ({ ok: true, json: async () => ({ features: [] }) }));
    global.fetch = mock as unknown as typeof fetch;
    const controller = new AbortController();
    controller.abort();
    await expect(searchPlaces("cafe", undefined, 6, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(mock).not.toHaveBeenCalled();
  });
});
