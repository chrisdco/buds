# Buds — Status & Roadmap

Living status doc. The [README](../README.md) covers setup; this covers *where
the project is, what's verified, what's next, and what to worry about*.

## Where it stands (June 2026)

| Milestone | State | Notes |
|---|---|---|
| M0 — Walking skeleton | ✅ done | Expo SDK 56, MapLibre + OpenFreeMap, anon auth, create/join by code, presence member list |
| M1 — Live shared map | ✅ done | Location pipeline (jitter filter + adaptive throttle), animated markers + presence states, `last_seen` recovery, reconnect handling |
| M2 — Destinations, routes, ETA | ✅ done | Long-press destinations, ORS→OSRM→straight-line routing chain, route polylines, ETA cards, self-reported arrival, converge ranking, Navigate deep-link |
| M3 — Mode framework | ✅ done | All five modes (solo/converge/multitrack/leader/formation) as pure strategies; alert engine + toasts; host tools, QR invite, deep-link join |
| M4 — Background & host tooling | 🟡 code-complete | Host controls, QR/deep-link, pause-sharing, separation/breakaway alerts, **background location task lane, OEM battery-exemption prompt, local notifications** all implemented. The background/notification paths are written + unit-tested where pure, but **not yet verified on a device** |
| M5 — Resilience & release | 🟡 started | **Expiry-countdown UI + host extend done.** Remaining: GPS tuning with real traces, on-device E2E drills, signed APK |

## What's verified

- **Backend**: all 5 migrations apply cleanly on a local Supabase stack; the
  full RPC lifecycle is exercised by [supabase/tests/smoke.sql](../supabase/tests/smoke.sql)
  (create → join → full/locked/kicked rejections → destinations → arrival →
  mode switch → end), and `broadcast_changes` triggers are confirmed to write
  into `realtime.messages`.
- **Client logic**: 72 jest unit tests (`npm test`) over geo math, the send
  throttle, jitter/teleport filter, alert engine (priming/sustain/re-arm),
  arrival detector, the routing fallback chain, every mode strategy, the
  expiry countdown, the tick codec, and the notification dedup gate.
- **Static**: `tsc --noEmit` and `expo lint` clean; enforced on every push by
  [CI](../.github/workflows/ci.yml), which now also spins up the Supabase local
  stack and runs the SQL smoke test (`db` job) in the cloud.
- **NOT yet verified**: anything requiring a phone — background tracking, real
  GPS behavior, a two-device live session, battery drain, OS notifications.
  The background lane is structured to reuse the unit-tested publisher, but its
  cold-start/headless behavior must be confirmed on a device.

## Architecture in one screen

```
GPS fix → jitter filter → adaptive throttle (2.5s drive / 4s walk / 20s idle)
       → broadcast 'loc' on the room channel → peers' zustand stores → markers
Control changes (destination, kick, mode) → SECURITY DEFINER RPC → Postgres
       → broadcast_changes() trigger → all clients converge on DB truth
Routes: ORS (optional key) → OSRM demo → straight-line; refetched on staleness
       or >120m route deviation. ETAs are display-only; turn-by-turn hands off
       to Google/Apple Maps.
```

- Location ticks are **never written to the DB** — pure client-to-client
  broadcast. Postgres holds rooms/members/destinations + one low-frequency
  `last_seen` snapshot for late-join recovery.
- Every per-viewer insight/alert is a **pure function over a snapshot**
  (`src/modes/`), so the room screen never branches on mode and adding a mode
  is one file + a registry entry.
- Alerts that concern one person (separation, breakaway) are computed
  viewer-locally and never broadcast, so 8 clients can't all fire the same
  notification.

## Setup blockers (must happen before any real use)

1. **Hosted Supabase project** — create it, enable anonymous sign-ins,
   `supabase link` + `db push`, fill `.env`. (issue: backend setup)
2. **Android toolchain** — install Android Studio, then `npx expo run:android`
   on a connected device. The app uses native modules, so **Expo Go won't
   work**. (issue: device setup)
3. **Keepalive secrets** — add `SUPABASE_URL` / `SUPABASE_ANON_KEY` repo
   secrets so the free project doesn't pause after 7 idle days. (issue: ops)

## Known issues & concerns

- **Android OEM background killers** — the #1 real-world risk; mitigations
  (foreground service, exemption prompt, HTTPS fallback lane, honest staleness
  UI) are designed but not yet built/verified on hardware.
- **Supabase free pause** — keepalive cron exists but is inert until the repo
  secrets are set.
- **OSRM demo server** has no SLA and a ~1 req/s courtesy limit; fine for 2–8
  users but a free ORS key (`EXPO_PUBLIC_ORS_API_KEY`) is recommended.
- **Realtime quota** — math says 2–8 users sit far under the free 2M
  msgs/month, but there's no usage alerting yet.
- **iOS** — only local dev builds on a free Apple ID (7-day re-sign);
  TestFlight needs the $99 paid account. Android-first by design.

## Deferred to backlog (intentionally cut from v1)

Session playback, host transfer, voice rooms, AI insights, geofenced events,
activity detection, web spectator client, in-app geocoding search, FCM push.
Each is a documented scale-seam, not a rewrite — see the issue tracker.
