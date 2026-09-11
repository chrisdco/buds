import { buildOsrmUrl, osrmBase } from "@/services/routing/osrm";

const FROM = { lat: 48.2, lng: 16.37 };
const TO = { lat: 48.21, lng: 16.38 };

describe("osrmBase", () => {
  const OLD = process.env.EXPO_PUBLIC_OSRM_URL;

  afterEach(() => {
    if (OLD === undefined) delete process.env.EXPO_PUBLIC_OSRM_URL;
    else process.env.EXPO_PUBLIC_OSRM_URL = OLD;
  });

  it("defaults to the public demo server", () => {
    delete process.env.EXPO_PUBLIC_OSRM_URL;
    expect(osrmBase()).toBe("https://router.project-osrm.org/route/v1/driving");
  });

  it("honours a self-hosted override and trims slashes", () => {
    process.env.EXPO_PUBLIC_OSRM_URL = "https://osrm.internal.example.com/";
    expect(osrmBase()).toBe("https://osrm.internal.example.com");
  });

  it("ignores a blank override", () => {
    process.env.EXPO_PUBLIC_OSRM_URL = "   ";
    expect(osrmBase()).toBe("https://router.project-osrm.org/route/v1/driving");
  });
});

describe("buildOsrmUrl", () => {
  it("builds the driving route URL in lng,lat order", () => {
    expect(buildOsrmUrl(FROM, TO)).toBe(
      "https://router.project-osrm.org/route/v1/driving/16.37,48.2;16.38,48.21?overview=full&geometries=geojson",
    );
  });

  it("uses an explicit base when given", () => {
    expect(buildOsrmUrl(FROM, TO, "https://osrm.internal.example.com")).toContain(
      "https://osrm.internal.example.com/16.37,48.2;16.38,48.21",
    );
  });
});
