import { categoryFor, mergeNearby, reversePlace, searchPlaces, type PlaceResult } from "@/services/places/photon";

const HERE = { lat: 12.9784, lng: 77.6408 };

const place = (id: string, name: string, distanceM: number | null, lat = 12.98, lng = 77.64): PlaceResult => ({
  id,
  name,
  address: "",
  lat,
  lng,
  distanceM,
});

describe("categoryFor", () => {
  it("recognises a kind of place, with or without 'near me'", () => {
    expect(categoryFor("Airport")?.tags).toEqual(["aeroway:aerodrome"]);
    expect(categoryFor("petrol pump near me")?.tags).toEqual(["amenity:fuel"]);
    expect(categoryFor("nearest  atm")?.tags).toEqual(["amenity:atm"]);
  });

  it("leaves named searches alone", () => {
    expect(categoryFor("Phoenix mall")).toBeNull();
    expect(categoryFor("Airport Road")).toBeNull();
    expect(categoryFor("near me")).toBeNull();
  });
});

describe("mergeNearby", () => {
  it("puts nearby hits first, nearest first, then unseen text results", () => {
    const out = mergeNearby(
      [place("a", "Shell", 800), place("b", "Indian Oil", 600)],
      [place("b", "Indian Oil", 600), place("c", "Petrol Bunk Road", 300)],
      5,
    );
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("Photon requests", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const feature = (name: string, lng: number, lat: number, id: number) => ({
    geometry: { coordinates: [lng, lat] },
    properties: { osm_type: "N", osm_id: id, name, city: "Bengaluru" },
  });

  it("adds a nearby-by-tag lookup for category queries, biased to street level", async () => {
    const urls: string[] = [];
    global.fetch = (async (url: unknown) => {
      urls.push(String(url));
      const nearby = String(url).includes("/reverse/");
      return {
        ok: true,
        json: async () => ({
          features: nearby ? [feature("HAL Airport", 77.66, 12.95, 1)] : [feature("Airport Road", 77.64, 12.97, 2)],
        }),
      };
    }) as unknown as typeof fetch;
    const out = await searchPlaces("airport", HERE);
    expect(out.map((r) => r.name)).toEqual(["HAL Airport", "Airport Road"]);
    const text = urls.find((u) => u.includes("/api/"))!;
    expect(text).toContain("zoom=14");
    expect(text).toContain("location_bias_scale=0.2");
    expect(urls.find((u) => u.includes("/reverse/"))).toContain("osm_tag=aeroway%3Aaerodrome");
  });

  it("still answers when the nearby lookup fails", async () => {
    global.fetch = (async (url: unknown) =>
      String(url).includes("/reverse/")
        ? { ok: false, status: 500 }
        : { ok: true, json: async () => ({ features: [feature("Cafe Muziris", 77.64, 12.978, 3)] }) }) as unknown as typeof fetch;
    const out = await searchPlaces("cafe", HERE);
    expect(out.map((r) => r.name)).toEqual(["Cafe Muziris"]);
  });

  it("names a pin from the closest thing, widening when nothing is right there", async () => {
    const calls: string[] = [];
    global.fetch = (async (url: unknown) => {
      calls.push(String(url));
      const wide = String(url).includes("radius=1");
      return { ok: true, json: async () => ({ features: wide ? [feature("100 Feet Road", 77.64, 12.97, 4)] : [] }) };
    }) as unknown as typeof fetch;
    await expect(reversePlace(12.97, 77.64)).resolves.toEqual({ name: "100 Feet Road", address: "Bengaluru" });
    expect(calls).toHaveLength(2);
  });
});
