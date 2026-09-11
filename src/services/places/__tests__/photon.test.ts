import { parsePhoton } from "@/services/places/photon";

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
