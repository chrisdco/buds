# E2E testing with Maestro

Maestro drives the real app on emulator/hardware: YAML flows, zero
instrumentation in the app, no new dependencies. Flows live in `.maestro/`
and target `testID`s (see `src/components/ui.tsx` — `Button`/`Chip` accept
`testID`; key screens tag their interactives).

## Local run (all free, all local)

1. Backend: `npx supabase start` (ports 5433x; `.env` points at the LAN IP).
2. Emulator: boot the `buds_pixel` AVD (or any API 35+ image).
3. Pre-grant permissions + mock GPS (Maestro can't reliably drive OS dialogs):
   ```bash
   adb shell pm grant com.buds.app android.permission.ACCESS_FINE_LOCATION
   adb shell pm grant com.buds.app android.permission.ACCESS_COARSE_LOCATION
   adb shell pm grant com.buds.app android.permission.POST_NOTIFICATIONS
   adb emu geo fix <lng> <lat>
   ```
4. Install + Metro: `npx expo run:android` (or `adb install` the debug APK,
   then `npx expo start --dev-client`).
5. Install the Maestro CLI (https://docs.maestro.dev — standalone binary,
   nothing added to the repo), then:
   ```bash
   maestro test .maestro/home-create-room.yml
   maestro test .maestro/destination-route.yml
   maestro test .maestro/member-sheet-follow.yml
   ```

## Known limits (verified against Maestro docs)

- Map long-press uses percent-of-screen points — re-check per device.
- Absolutely-positioned map chrome can defeat text selectors; `testID`s are
  the primary selectors, text is the fallback.
- Dev-build LogBox toasts can cover tappables; dismiss or use release builds
  for stable runs.
- Two-device flows (live sync drill) need two emulators/devices; the flows
  above are single-device. Deep-link join (`buds://join/CODE`) needs a live
  room code — script it when the drill is automated.

## CI (deferred)

EAS Workflows has a first-class Maestro job, but we stay local-first: no
`eas.json`, no cloud builds. A future option is GitHub Actions +
`android-emulator-runner` running these same flows; do that when the suite
proves stable locally.
