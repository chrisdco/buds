import { pendingDotAt } from "../PendingRoutes";

jest.mock("@maplibre/maplibre-react-native", () => ({ GeoJSONSource: () => null, Layer: () => null }));
jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
jest.mock("@/theme", () => ({ useColors: () => ({ text: "#fff" }) }));

describe("pendingDotAt", () => {
  const from: [number, number] = [72.8, 19.0];
  const to: [number, number] = [72.9, 19.2];

  it("starts at the start and is halfway at mid-loop", () => {
    expect(pendingDotAt(from, to, 0)).toEqual(from);
    const [lng, lat] = pendingDotAt(from, to, 0.5);
    expect(lng).toBeCloseTo(72.85);
    expect(lat).toBeCloseTo(19.1);
  });

  it("approaches the end and eases near the ends", () => {
    const [lng] = pendingDotAt(from, to, 0.999);
    expect(lng).toBeCloseTo(72.9, 3);
    // Eased: the first 10% of time covers less than 10% of the way.
    const [early] = pendingDotAt(from, to, 0.1);
    expect((early - from[0]) / (to[0] - from[0])).toBeLessThan(0.1);
  });
});
