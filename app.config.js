// Everything lives in app.json; this only adjusts it for e2e builds.
//
// BUDS_E2E=1 (set by .github/workflows/e2e.yml) builds the release APK the
// Maestro suite runs against:
//  - OTA updates off, so a newer update on a channel can't replace the JS
//    under test.
//  - Cleartext HTTP allowed, so the emulator can reach the local Supabase
//    stack at http://10.0.2.2. Never set for real builds.
module.exports = ({ config }) => {
  if (process.env.BUDS_E2E !== "1") return config;
  const plugins = (config.plugins ?? []).map((p) =>
    Array.isArray(p) && p[0] === "expo-build-properties"
      ? [p[0], { ...p[1], android: { ...p[1]?.android, usesCleartextTraffic: true } }]
      : p,
  );
  return { ...config, plugins, updates: { ...config.updates, enabled: false } };
};
