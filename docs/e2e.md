# Testing: what runs where

Most checks need no device and run on every PR in a few minutes. The
device suite (Maestro) runs only before an APK.

| When | What | Catches |
|---|---|---|
| Every PR (CI `check`, ~4 min) | Typecheck, lint, unit tests | Logic: arrival, sheet actions, snapping, routing, categories... |
| | Component tests (`*.test.tsx`, React Native Testing Library) | A screen renders and reacts: chips, recents, the arrival card |
| | Boot test (`src/app/__tests__/boot.test.tsx`) | Every route module imports; the app starts to Home; tabs; Home -> create -> room screen |
| | `expo-doctor` (SDK version check skipped) | Config, plugin and native-module setup problems |
| | Bundle check (`expo export --platform android`) | JS that won't bundle, i.e. a broken OTA |
| PRs touching `supabase/` (CI `db`) | Migrations, SQL smoke test, types drift | Schema and RPC breakage |
| **Before an APK** | The checklist below | Native crashes, real flows on a device |

Component tests render with Jest stand-ins for native modules
(`jest.setup.js`: MapLibre, Reanimated's worklets, AsyncStorage), so they
say nothing about what the map draws, gestures, or native crashes. That's
the device suite's job.

## Before an APK

1. `npx expo install --check`: bring Expo packages to the SDK's expected
   versions (native changes belong in the APK batch, not an OTA).
2. The Maestro suite: locally on the emulator (below), or in CI by adding
   the `e2e` label to the PR (or Actions -> E2E -> Run workflow).
3. After uploading to Play's internal testing track: the pre-launch
   report (Play Console -> Testing -> Pre-launch report). Google runs the
   build on real phones and reports crashes with screenshots.
4. Device checks Maestro can't do: two-person live sync, screen-off
   sharing, notifications, how things look.

# E2E testing with Maestro

Maestro drives the real app on emulator/hardware: YAML flows, zero
instrumentation in the app, no new dependencies. Flows live in `.maestro/`
and target `testID`s (see `src/components/ui.tsx` — `Button`/`Chip` accept
`testID`; key screens tag their interactives).

## Local run (all free, all local)

1. Backend: `npx supabase start` (ports 5433x; `.env` points at the LAN IP).
2. Emulator: boot the `buds_pixel` AVD (or any API 35+ image).
3. Permissions and mock GPS: `suite.yml` grants them and sets the
   location itself. Running a single flow? Grant them with `adb shell pm grant`
   and `adb emu geo fix <lng> <lat>` first.
4. Install + Metro: `npx expo run:android` (or `adb install` the debug APK,
   then `npx expo start --dev-client`).
5. Install the Maestro CLI (https://docs.maestro.dev — standalone binary,
   nothing added to the repo), then `maestro test .maestro/suite.yml`.

## Known limits (verified against Maestro docs)

- Map long-press uses percent-of-screen points — re-check per device.
- Absolutely-positioned map chrome can defeat text selectors; `testID`s are
  the primary selectors, text is the fallback.
- CI uses the `google_atd` emulator image (no launcher, no on-screen
  keyboard): its screenshots come out black, so read
  `screen-hierarchy/` and `logcat.txt` in the artifact instead, and don't
  use `hideKeyboard` (it turns into Back).
- Dev-build LogBox toasts can cover tappables; dismiss or use release builds
  for stable runs.
- Two-device flows (live sync drill) need two emulators/devices; the flows
  above are single-device. Deep-link join (`buds://join/CODE`) needs a live
  room code — script it when the drill is automated.

## CI (GitHub Actions)

`.github/workflows/e2e.yml` runs the whole suite on demand only: add the
`e2e` label to a PR, or Actions -> E2E -> Run workflow. It's free (public
repo) and needs no secrets:

1. Starts the Supabase local stack (auth, REST, realtime) on the runner.
2. Builds a release APK for x86_64 with `BUDS_E2E=1`. `app.config.js` then
   turns OTA updates off (the APK runs exactly this PR's JS) and allows
   cleartext HTTP so the emulator can reach `http://10.0.2.2:54331`. It's
   minified like the real release, so R8 stripping something shows up.
3. Boots a Pixel 6 emulator (API 34) and runs `.maestro/suite.yml`.
4. Uploads the JUnit report and Maestro's screenshots/logs as the
   `maestro-results` artifact, pass or fail.

It isn't a required check, so auto-merge doesn't wait for it. A run takes
about 15 minutes: 10 for the Gradle build, 3 for the suite.

Not covered, still manual: two-person live sync, real road search results
(Mapbox/Photon results vary), background/screen-off sharing, notifications,
and how things look.

EAS Workflows has a Maestro job too, but it needs a paid Expo plan.

## The suite

`.maestro/suite.yml` runs the flows in order from a clean install (each
flow continues from where the last left the app). The room flows start
with `in-room.yml` rather than `launchApp`: a relaunch opens on Home, and
the helper taps Rejoin when that's where the app is.

| Flow | Covers |
|---|---|
| `tabs.yml` | Home / Trips / Profile tabs, a trip preset |
| `home-create-room.yml` | Name + create a room, live map |
| `dest-search.yml` | Category chip toggle, empty search, adjust-pin cancel |
| `member-focus.yml` | Focus from detail, long-press menu, clearing focus |
| `destination-route.yml` | Long-press destination, road route, Navigate CTA |
| `arrival.yml` | Destination on your own spot, "You've arrived", End trip |

Run it locally with `maestro test .maestro/suite.yml` (it grants
permissions and sets a mock location itself; a fresh install is used).
