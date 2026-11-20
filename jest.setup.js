// jest.mock factories run before imports resolve, so they must use require.
/* eslint-disable @typescript-eslint/no-require-imports */

// Provide dummy Supabase env so modules that import the client load under test.
// No test hits the network; these are placeholders only.
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

// Reanimated 4 runs on the worklets runtime, which is native: its JS mock
// lets components with entering/exiting animations render under Jest.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
// AsyncStorage's in-memory mock (tests that need specific behaviour still
// override it with their own jest.mock).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
// expo-router's test helper (renderRouter) swaps in Reanimated's mock, which
// lacks newer exports such as cubicBezier (CSS transitions in ui.tsx); fill
// the gaps from the real module.
jest.mock("react-native-reanimated/mock", () => {
  const mock = jest.requireActual("react-native-reanimated/mock");
  return { ...jest.requireActual("react-native-reanimated"), ...mock };
});
// MapLibre ships untranspiled TS and needs its native view: stand in a plain
// View for every component (Map, Camera, Layer, Marker...) and no-op
// managers, so screens that import the map can render in component tests.
// What the map draws is checked on a device, not here.
jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stub = React.forwardRef(function MapStub(props, ref) {
    React.useImperativeHandle(ref, () => new Proxy({}, { get: () => () => Promise.resolve(null) }));
    return React.createElement(View, { testID: props.testID }, props.children);
  });
  const managers = new Proxy({}, { get: () => () => Promise.resolve(null) });
  return new Proxy(
    { __esModule: true, OfflineManager: managers, LocationManager: managers },
    { get: (t, key) => (key in t ? t[key] : Stub) },
  );
});
