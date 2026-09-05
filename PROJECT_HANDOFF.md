# Buds — Project Handoff

> Single-page orientation for anyone (human or AI) picking this project up cold.
> For day-to-day commands see [README.md](README.md); for milestone status and
> known issues see [docs/ROADMAP.md](docs/ROADMAP.md). This file is the
> authoritative entry point.

- **Repo:** https://github.com/chrisdco/buds (private, default branch `main`)
- **Local path:** `C:\Users\admin\Projects\buds` (environment-specific; was `D:\Projects\Buds` on the original machine)
- **CI:** GitHub Actions, two jobs — `check` (typecheck + lint + unit tests) and
  `db` (full Supabase stack + migrations + SQL smoke test). Both green on `main`.
  The `keepalive` workflow skips gracefully until Supabase secrets exist.
- **Last verified:** tsc clean, eslint clean, 76 unit tests pass, SQL smoke
  passes locally and in CI.

---

## 1. Overview & goals

Buds is a **mobile-first, real-time collaborative navigation app** for small
groups. People create or join a temporary **Room** with a 6-character code (or
QR / `buds://join/CODE` deep link) and see each other move on a shared live map.
Up to **10 travelers** (who broadcast location) plus unlimited **spectators**
(view-only) per room.

Five **operational modes**, all built on one strategy framework:
- **Solo** — share where you are; others can watch.
- **Converge** — everyone heads to one shared destination (arrival ranking, group ETA).
- **Multi-track** — each traveler has their own destination (route-overlap insight).
- **Follow-leader** — followers chase a leader's live position (separation alerts).
- **Formation** — keep the group within a radius (breakaway alerts).

**Design philosophy / constraints (deliberate):**
- **$0 budget.** Everything runs on free tiers. No paid services anywhere.
- **Tiny scale.** Built for **2 real users, ~8 testers max** — explicitly
  right-sized away from the original "thousands of concurrent rooms" spec, while
  keeping clean "scale seams" (documented below) so it can grow without a rewrite.
- **Zero-friction identity.** Anonymous auth + a display name. No accounts/passwords.

---

## 2. Current development phase

**M0–M4 are code-complete; M5 is partially done.** The app is feature-complete
for v1 *in code*, fully verified for everything checkable without a phone, and
waiting on **on-device verification** for the background/notification paths and
the hosted-Supabase + Android-build setup.

| Milestone | State |
|---|---|
| M0 Walking skeleton | ✅ done |
| M1 Live shared map | ✅ done |
| M2 Destinations, routes, ETA, arrival | ✅ done |
| M3 Five-mode strategy framework | ✅ done |
| M4 Background sharing, host tools, notifications, battery | ✅ code-complete, ⏳ needs on-device verification |
| M5 Resilience & release | 🟡 expiry UI done; GPS tuning / two-phone drill / signed APK remain |

---

## 3. Completed features (verified)

- **Rooms:** create (name, mode, traveler limit, expiry), join by code/QR/deep
  link, typed join errors (`bad_code`/`room_full`/`room_locked`/`room_ended`/
  `kicked`) with a "join as spectator instead" fallback, idempotent rejoin,
  rejoin-on-reopen.
- **Live map:** MapLibre + OpenFreeMap tiles (no API key); animated member
  markers with heading arrow + presence color; presence states (moving /
  stationary / reconnecting / offline / arrived) derived per-viewer; fit-all and
  per-strategy camera; "last seen Xm ago" honesty.
- **Location pipeline:** GPS → jitter/teleport filter → adaptive throttle
  (2.5s driving / 4s walking / 20s stationary, ×2 backgrounded, 30s heartbeat) →
  realtime broadcast; **no per-tick DB writes**; 60s `last_seen` recovery upsert.
- **Destinations & routing:** long-press to set (host = room dest, self =
  personal, per mode rules); routing chain **OpenRouteService → OSRM demo →
  straight-line estimate** (never fails); route polylines (dashed = estimate);
  ETA + remaining distance chips; "Navigate" deep-links to Google/Apple Maps;
  re-route on staleness or >120m deviation.
- **Arrival & events:** self-reported arrival (idempotent `mark_arrived`, ranking
  by persisted `arrived_at`); local alert engine (priming / sustain windows /
  re-arm); in-app toasts; deviation/rejoin broadcast events; proximity,
  separation, and breakaway alerts computed **viewer-locally** (never broadcast).
- **Modes:** all five via a pure `ModeStrategy` interface; mid-session mode
  switching by the host with no client desync.
- **Host tools:** mode switch, lock/unlock, leader picker, kick, end room,
  room-expiry countdown + extend (+1h/+4h/remove).
- **Privacy:** pause sharing; spectator role; (approximate/invisible modes are
  deliberately deferred — see backlog).
- **Background sharing (code-complete):** headless `TaskManager` task + Android
  foreground service; HTTPS `update_last_seen` fallback when the socket is down;
  opt-in toggle; self-teardown when the room ends/kick (migration `0006`) or on
  exit/unmount/demotion; one-time warning if "Always" permission lapsed.
- **Local notifications (code-complete):** alerts route to OS notifications when
  backgrounded, in-app toasts when foregrounded; dedup gate.
- **Battery (code-complete):** guarded `expo-intent-launcher` exemption prompt.
- **Ops:** weekly GitHub Actions keepalive ping (prevents Supabase free-tier
  7-day pause); CI with a `db` smoke-test job.

---

## 4. In-progress / not-yet-verified work

Nothing is mid-edit (working tree is clean). The items below are **written but
unverified on hardware** — they cannot be confirmed without a physical device:

- **Background location runtime** (issue #13): screen-off tracking, OEM battery
  killers, cold-process headless relaunch.
- **OS notifications runtime** (issue #4): including the known gap that RN JS
  timers are throttled in background, so foreground-computed alerts may need to
  be driven from the background task.
- **Battery-exemption intent** (issue #14): confirm it resolves on real OEM skins.

---

## 5. Remaining phases / roadmap

**Setup blockers (must happen before any real use — all require you, not code):**
1. Provision the hosted Supabase project + apply migrations + enable anonymous
   sign-ins (#1).
2. Install the Android toolchain and produce the first dev build (#2).
3. Add keepalive secrets to GitHub Actions (#3, blocked by #1).

**M4 finish (on-device verification):** #13, #14, #4.

**M5 Resilience & release:** two-phone E2E drill (#5), GPS filter tuning with
real traces (#6), signed release APK for testers (#7).

**Ops / enhancements (low priority):** realtime quota alerting (#8), routing
resilience / ORS key (#9), iOS distribution (#10), member detail/focus sheet
(#16), realtime-channel integration test (#17).

**Backlog (intentionally cut from v1, #11):** session playback, host transfer,
voice rooms, AI route insights, geofenced events, activity detection, web
spectator client, in-app geocoding search, FCM push, approximate/invisible
privacy modes. Each is a documented scale-seam, not a rewrite.

---

## 6. Open issues & known bugs

- **No known open bugs.** An adversarial multi-agent review of the M4 batch
  surfaced 4 real defects (last_seen write-amplification on reconnect flaps,
  background service outliving an ended room, missing background-permission gate,
  foreground GPS watcher leak on demotion) — **all fixed** in commit `7779a75`.
- **Open issues are work items, not defects.** See the
  [issue tracker](https://github.com/ChrisDc777/buds/issues): setup blockers
  (#1–#3), on-device verification (#4, #13, #14), M5 (#5–#7), ops/enhancements
  (#8–#10, #16, #17), backlog (#11). Labels: `area:*`, `setup`, `ops`,
  `needs-device`, `priority:*`, `backlog`. Milestones: "M4: Background & host
  tooling", "M5: Resilience & release".
- **Closed:** #12 (CI smoke job), #15 (expiry UI).

---

## 7. Architecture & key design decisions

```
Phone (Expo dev build) ── MapLibre map (OpenFreeMap vector tiles)
  zustand stores ◄── ModeStrategy engine + alert engine (all local, pure)
  RealtimeService ── ONE private channel per room: "room:{uuid}"
  LocationPublisher ── fed by foreground watcher AND headless background task
        │ wss (realtime)                       │ https (rare)
  SUPABASE FREE: Realtime (broadcast loc ticks + presence + DB-change events)
                 Postgres (rooms/members/destinations + SECURITY DEFINER RPCs + RLS)
                 pg_cron (expiry sweep every 5 min)
        │ on destination set / deviation / ~120s
  OpenRouteService → OSRM demo → straight-line+haversine fallback
External: Google/Apple Maps deep link ("Navigate"); GitHub Actions weekly keepalive.
```

**P0 stability hardening (applied, desktop-verified, device drill still pending):**
migration `0007` + client fixes — shared-publisher lane refresh (bg throttle +
lease teardown), arrival server-confirm retry, store exit-reason hygiene,
deep-link validation, realtime/routing shape guards, `join_room` capacity lock,
host auto-promote on leave, lock-rejoin for prior members, typed validation
errors (`bad_name`/`bad_display_name`/`bad_limit`/`bad_expiry`/`bad_destination`),
`update_last_seen` expiry check, route fetch pacing (1100ms) + payload
validation. Smoke test extended (transfer, expiry-unswept, lock-rejoin,
validation); unit tests 72 → 76.

**Load-bearing decisions:**
1. **Location ticks are client-to-client broadcast, never written to the DB.**
   The DB holds only control-plane facts (rooms, membership, destinations) + a
   low-frequency `last_seen` snapshot for late-join/reconnect recovery. This is
   what keeps it inside the Supabase free tier and satisfies "no high-frequency
   history."
2. **Every per-viewer insight/alert is a pure function over a snapshot**
   (`src/modes/`). The room screen never branches on mode. Adding a mode = one
   file + a registry entry. Personal/separation/breakaway alerts are computed
   locally per viewer and never broadcast, so N clients can't all fire the same
   notification.
3. **All mutations go through SECURITY DEFINER Postgres RPCs** returning typed
   `{ok:true,...} | {ok:false,error}` results; RLS only grants member-scoped
   SELECT. No direct table writes from the client.
4. **Control-plane changes propagate via `realtime.broadcast_changes()` triggers**
   (room/member/destination rows → channel events); reconnecting clients refetch
   a one-shot `get_room_snapshot`.
5. **One shared `LocationPublisher` instance per room** feeds both the foreground
   watcher and the headless background task, so jitter/throttle state is shared
   and the two lanes can't double-send. Lane choice is per-tick: broadcast if the
   channel is live, else the `update_last_seen` HTTPS lane.
6. **zustand** (not Redux/Context) because background-task callbacks and realtime
   handlers run *outside* the React tree and need plain `getState()`/`setState()`.
7. **Routing is a fallback chain that never rejects** — worst case is a dashed
   straight line labeled "estimate". Turn-by-turn is deliberately delegated to
   Google/Apple Maps; Buds' value is the *shared* map, not re-building navigation.
8. **Map = MapLibre + OpenFreeMap** (zero API keys, identical on both platforms)
   rather than react-native-maps (would need a Google Cloud key on Android).

---

## 8. Key files & folders

```
app.json                         Expo config (plugins: location bg, maplibre, camera, notifications)
supabase/
  migrations/0001..0006          schema, RPCs, realtime RLS, broadcast triggers, cron, last_seen status
  tests/smoke.sql                full RPC-lifecycle smoke test (BEGIN/ROLLBACK, RAISEs on failure)
  config.toml                    local CLI config (ports remapped to 5433x; project_id="buds")
.github/workflows/
  ci.yml                         check + db jobs
  keepalive.yml                  weekly Supabase ping (needs repo secrets)
src/
  app/                           Expo Router screens
    _layout.tsx                  anon auth bootstrap; registers bg task + notifications
    index.tsx  create.tsx        home; create room
    join/index.tsx  join/[code].tsx   manual+QR join; deep-link auto-join
    room/[id]/_layout.tsx        channel + pipeline + background lifecycle (THE controller)
    room/[id]/index.tsx          THE map screen (map, markers, routes, insights, alerts)
    room/[id]/member/[uid].tsx   member detail + follow sheet (blind build, needs device review)
    room/[id]/settings.tsx       host controls + privacy/background toggles + expiry
    room/[id]/invite.tsx         QR + share sheet
  lib/                           supabaseClient, geo (haversine/bearing), time (skew), ids, expiry, nav, activeRoom
  services/
    realtime/roomChannel.ts      channel lifecycle, payloads, reconnect, isRoomChannelLive
    location/                    pipeline (fg), backgroundTask (headless), publisher (shared core),
                                 tick (pure codec), throttle, jitterFilter, permissions, battery
    routing/                     router (ORS→OSRM→straight-line), ors, osrm, deviation, routeManager
    rpc/rooms.ts                 typed wrappers for every RPC
    notifications.ts             expo-notifications handler/channel/permission + dedup
  stores/                        session, room, members, route, ui (zustand)
  modes/                         types, registry, solo, converge, multitrack, leader, formation, shared
  events/                        alertEngine, arrivalDetector
  features/                      map/ (RoomMap, MemberMarkers, RouteLines, DestinationMarkers)
                                 room/ (MemberList, InsightsPanel, Toasts, ExpiryBanner)
  types/contracts.ts             all shared types (rows, payloads, RPC results, live state)
  testing/fixtures.ts            mode-strategy test fixtures
```

**Where to start reading:** `src/types/contracts.ts` (the vocabulary) →
`src/app/room/[id]/_layout.tsx` (lifecycle) → `src/app/room/[id]/index.tsx`
(the screen) → `src/modes/registry.ts` + one strategy → `supabase/migrations/`.

---

## 9. Setup & run

**Prerequisites:** Node 22+, a Supabase account, Docker (for the local stack /
CI parity), Android Studio (for device builds — there is **no Android SDK on the
current dev machine yet**).

```bash
npm install

# Supabase (one-time)
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                 # applies migrations 0001..0006
# then enable Authentication -> Sign In/Up -> Anonymous in the dashboard
cp .env.example .env                  # fill in URL + anon key

# Develop
npm run typecheck                     # tsc --noEmit
npm run lint
npm test                              # 72 jest unit tests
npx expo run:android                  # build + install a dev build (NOT Expo Go)

# Local backend parity (optional, what CI does)
npx supabase start                    # ports remapped to 5433x (config.toml)
npx supabase db reset                 # re-apply migrations
Get-Content supabase/tests/smoke.sql -Raw | docker exec -i supabase_db_buds psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
```

> **The app does NOT run in Expo Go** — MapLibre, expo-location background, and
> expo-notifications are native modules requiring a dev build. Local builds
> (`npx expo run:android`) are free and unlimited.

---

## 10. Environment variables

Client (Expo, `EXPO_PUBLIC_` are bundled into the app — anon key is safe to ship):

| Var | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (public by design; RLS protects data) |
| `EXPO_PUBLIC_ORS_API_KEY` | optional | OpenRouteService key; without it routing skips ORS and uses OSRM→straight-line |

GitHub Actions secrets (for `keepalive.yml`):

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | keepalive ping target |
| `SUPABASE_ANON_KEY` | keepalive ping auth |

No private/service keys are used anywhere. Never commit `.env` (gitignored).

---

## 11. Dependencies (high-signal)

- **Expo SDK 56** / React Native 0.85 / React 19 / TypeScript ~6, `expo-router`.
- `@maplibre/maplibre-react-native@^11.3.4` — map (with OpenFreeMap tiles).
- `@supabase/supabase-js@^2` — Postgres, Realtime (broadcast + presence), anon auth.
- `zustand@^5` — state (usable from headless code).
- `expo-location` + `expo-task-manager` — foreground + background GPS.
- `expo-notifications` — local notifications. `expo-camera` — QR scan.
  `react-native-qrcode-svg` — QR display. `expo-intent-launcher` — battery intent.
- `@turf/distance` + `@turf/nearest-point-on-line` — overlap/deviation math.
- Dev: `jest` + `jest-expo`, `eslint` + `eslint-config-expo`, `typescript`.

---

## 12. Technical debt & future improvements

- **Background lane is unverified on hardware** — the highest-priority debt. The
  logic is structured and unit-tested where pure, but headless relaunch, OEM
  battery handling, and OS-notification delivery need a real device (#13/#14/#4).
- **Backgrounded alert computation** — alerts are computed in the React screen on
  a 5s clock; RN throttles JS timers in background, so some alerts may not fire
  unless computed inside the background task (#4).
- **No integration test for `roomChannel`** — coverage is unit + SQL smoke only;
  the realtime broadcast/presence wiring has no automated test (#17).
- **Member detail / smart-focus** — tapping a member to see their ETA, navigate
  to them, or pin the camera was in the plan but not built (#16).
- **Adaptive throttle floor (`min_send_interval_ms`)** exists in `rooms.settings`
  and is honored by the client, but there's no host UI to set it; it's a manual
  DB lever for now (a quota safety valve).
- **Single host, no transfer** — if the host vanishes the room runs until expiry
  (acceptable at this scale; host transfer is backlog).
- **Same account on two devices** — last-writer-wins on tick timestamp; shown as
  one marker. Documented quirk, fine for the trust model.
- **CRLF on Windows** — handled via `.gitattributes` (LF in repo).

**Scale seams (when >10 concurrent rooms becomes real):** mode strategies are
pure `f(snapshot)` and could move to an Edge Function verbatim; `last_seen`
columns are plain doubles, trivially migratable to PostGIS `geography(Point)`;
Supabase Pro tier is a config change, not a redesign; a web spectator client
reuses the channel protocol + GeoJSON routes with MapLibre GL JS.

---

## 13. Suggested first prompt to resume development

> You are resuming the **Buds** project (Expo SDK 56 + Supabase live-group-
> navigation app) at `D:\Projects\Buds`. Read `PROJECT_HANDOFF.md`, then
> `docs/ROADMAP.md`, then skim `src/types/contracts.ts` and
> `src/app/room/[id]/_layout.tsx` to load the architecture.
>
> The code for M0–M4 is complete and CI is green (typecheck + lint + 72 unit
> tests + a Supabase SQL smoke test). The next real work is **on-device
> verification of the background-location lane** (GitHub issue #13), which can't
> be done without an Android dev build. Before touching that:
> 1. Confirm the hosted Supabase project exists and migrations are applied
>    (issue #1), `.env` is filled, and `npx expo run:android` produces a working
>    dev build on a connected device (issue #2).
> 2. Then walk the two-phone verification drill (issue #5): two phones in one
>    room tracking each other; airplane-mode recovery; set a destination and
>    confirm ETA + a single arrival event.
>
> Keep the project's conventions: $0/free-tier only; mutations go through
> SECURITY DEFINER RPCs; location ticks stay broadcast-only (never per-tick DB
> writes); per-viewer logic stays pure in `src/modes`. Run `npm run typecheck`,
> `npm run lint`, and `npm test` before every commit, and the SQL smoke test
> (`supabase/tests/smoke.sql`) after any migration change. Follow the no-AI-
> attribution convention in commits/PRs. When you finish a unit of work, update
> the relevant GitHub issue and `docs/ROADMAP.md`.
