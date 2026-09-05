# Buds

Live maps for small groups. Create a room, share the 6-character code, and see
your buds move on a shared map in real time — converge on a destination, follow
a leader, or keep a convoy in formation.

Built for ~2–10 people per room on an entirely free stack:

| Piece | Tech | Cost |
|---|---|---|
| App | Expo SDK 56 / React Native (dev builds, not Expo Go) | free |
| Map | MapLibre React Native + [OpenFreeMap](https://openfreemap.org) tiles | free, no API key |
| Realtime + DB + auth | Supabase free tier (Broadcast/Presence + Postgres + anonymous auth) | free |
| Routing (M2+) | OpenRouteService free key → OSRM demo → straight-line fallback | free |

Location ticks are **never written to the database** — they fan out
client-to-client over a private Supabase Realtime channel per room
(`room:<uuid>`). Postgres holds only rooms/membership/destinations plus a
low-frequency "last seen" snapshot for late joiners.

## One-time setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Enable anonymous sign-ins: **Authentication → Sign In / Up → Anonymous**.
3. Apply migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

4. Copy `.env.example` to `.env` and fill in the URL + anon key from
   **Project Settings → API**.

### 2. Keepalive (important!)

Free Supabase projects **pause after 7 idle days** and must be revived by hand
in the dashboard. If you push this repo to GitHub, add two Actions secrets so
[.github/workflows/keepalive.yml](.github/workflows/keepalive.yml) pings the
project twice a week: `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 3. Android dev build

Background location and MapLibre are native modules → **the app does not run in
Expo Go**. You need a development build. One-time machine setup: install
[Android Studio](https://developer.android.com/studio) (brings the SDK +
emulator; a JDK is bundled). Then:

```bash
npx expo run:android        # builds + installs on the connected device/emulator
```

Local builds are free and unlimited (no EAS quota). For a shareable APK for
testers:

```bash
cd android && .\gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk, sideload to phones
```

iOS: works via `npx expo run:ios` from a Mac (free Apple ID = 7-day re-signed
dev builds). TestFlight needs a paid Apple Developer account.

## Daily development

```bash
npm start            # Metro for an already-installed dev build
npm run lint
npx tsc --noEmit     # typecheck
```

## How it works

```
GPS fix → jitter filter → adaptive throttle (2.5s driving / 4s walking / 20s parked)
       → broadcast 'loc' on room channel → peers' stores → markers update
Control changes (destination, kick, mode) → SECURITY DEFINER RPC → Postgres
       → trigger broadcast_changes() → all clients converge on DB truth
```

- `src/services/realtime/roomChannel.ts` — channel lifecycle, payloads, reconnect
- `src/services/location/pipeline.ts` — the GPS → filter → throttle → publish loop
- `src/stores/` — zustand stores (plain JS objects, writable from headless code)
- `supabase/migrations/` — schema, RPCs, realtime RLS, triggers, expiry cron

## Daily development (cont.)

```bash
npm test             # 76 unit tests: geo, throttle, jitter filter, alert engine,
                     # arrival detector (incl. retry), routing fallback chain,
                     # mode strategies, expiry countdown, tick codec,
                     # notification dedup
```

Routing uses OSRM's public demo server by default; for better quality and
quota, grab a free [OpenRouteService key](https://openrouteservice.org) and add
`EXPO_PUBLIC_ORS_API_KEY=...` to `.env`.

## Roadmap

- [x] M0/M1 — rooms, codes, live shared map, presence, reconnect recovery
- [x] M2 — destinations, routes + ETA, arrival detection, converge ranking, navigate handoff
- [x] M3 — mode strategy framework: all five modes with insights/alerts/camera policies
- [x] M4 — formation/separation alerts, QR invites + deep link, host tools, pause-sharing, background tracking lane, battery-exemption prompt, local notifications *(background paths pending on-device verification)*
- [x] P0 — stability hardening (migration `0007`): publisher lane refresh, arrival server-confirm retry, capacity lock, host auto-promote, typed validation errors, realtime/routing guards *(desktop-verified via tsc/lint/unit/SQL smoke)*
- [~] M5 — expiry countdown + host extend done; remaining: on-device GPS tuning, signed release APK, real group drive
- CI now runs typecheck + lint + unit tests **and** a full Supabase migration + SQL smoke-test job
