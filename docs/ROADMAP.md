# Buds — Status & Roadmap

Living status doc. The [README](../README.md) covers setup; this covers *where
the project is, what's verified, what's next, and what to worry about*.
The phased execution plan (P0–P3) is tracked in the GitHub issue tracker
(see issue #18); this file summarizes it.

## Where it stands (September 2026)

| Milestone | State | Notes |
|---|---|---|
| M0 — Walking skeleton | ✅ done | Expo SDK 56, MapLibre + OpenFreeMap, anon auth, create/join by code, presence member list |
| M1 — Live shared map | ✅ done | Location pipeline (jitter filter + adaptive throttle), animated markers + presence states, `last_seen` recovery, reconnect handling |
| M2 — Destinations, routes, ETA | ✅ done | Long-press destinations, ORS→OSRM→straight-line routing chain, route polylines, ETA cards, self-reported arrival, converge ranking, Navigate deep-link |
| M3 — Mode framework | ✅ done | All five modes (solo/converge/multitrack/leader/formation) as pure strategies; alert engine + toasts; host tools, QR invite, deep-link join |
| M4 — Background & host tooling | 🟡 code-complete | Host controls, QR/deep-link, pause-sharing, separation/breakaway alerts, **background location task lane, OEM battery-exemption prompt, local notifications** all implemented. The background/notification paths are written + unit-tested where pure, but **not yet verified on a device** |
| M5 — Resilience & release | 🟡 started | **Expiry-countdown UI + host extend done.** Remaining: GPS tuning with real traces, on-device E2E drills, signed APK |
| P0 — Stability hardening | ✅ done (desktop) | Migration `0007` + client fixes: publisher lane refresh, arrival server-confirm retry, store/exit hygiene, deep-link + realtime/routing guards, capacity lock, host auto-promote, typed validation errors. Verified via tsc/lint/unit/SQL smoke; device drill still pending |

## Current phase plan (P0–P3)

- **P0 — Stability hardening (this change):** all desktop-verifiable fixes.
  Local Docker (`npx supabase start` + `db reset` + smoke) is the source of
  truth until the hosted project exists; no device needed.
- **P1 — Prove it works (needs device):** hosted Supabase (#1) → first dev
  build (#2) → keepalive secrets (#3) → two-phone drill (#5) → GPS tuning
  (#6) → background/battery/notifications verification (#13/#14/#4) →
  signed tester APK (#7).
- **P2 — Make it feel real (after drill):** member detail/focus sheet (#16)
  — built blind, pending device review — Break/Help/SOS map actions,
  first-30-seconds polish (skeletons, empty states, honest errors, a11y —
  first pass built blind), Expo SDK 57 upgrade, solo/multitrack moved to
  experimental/secondary placement (kept in code).
- **P3 — Grow/harden (after weekly tester use):** quota alerting (#8), route
  proxy/cache (#9), channel integration test (#17), web spectator link,
  retention purge, host-transfer UI, iOS decision (#10).

Product direction: convoy coordination (converge/leader/formation) is the
wedge; solo/multitrack stay as experimental candidates until validated.
Backlog (#11) stays deferred.

## What's verified

- **Backend**: all 7 migrations apply cleanly on a local Supabase stack; the
  full RPC lifecycle is exercised by [supabase/tests/smoke.sql](../supabase/tests/smoke.sql)
  (create → join → full/locked/kicked/rejoin rejections → validation errors →
  destinations → arrival → mode switch → end → host-transfer → expiry-unswept),
  and `broadcast_changes` triggers are confirmed to write
  into `realtime.messages`.
- **Client logic**: 76 jest unit tests (`npm test`) over geo math, the send
  throttle, jitter/teleport filter, alert engine (priming/sustain/re-arm),
  arrival detector (incl. retry/re-arm), the routing fallback chain (incl.
  malformed-payload fallthrough), every mode strategy, the
  expiry countdown, the tick codec, and the notification dedup gate.
- **Static**: `tsc --noEmit` and `expo lint` clean; enforced on every push by
  [CI](../.github/workflows/ci.yml), which now also spins up the Supabase local
  stack and runs the SQL smoke test (`db` job) in the cloud.
- **NOT yet verified**: anything requiring a phone — background tracking, real
  GPS behavior, a two-device live session, battery drain, OS notifications.
  The background lane is structured to reuse the unit-tested publisher, but its
  cold-start/headless behavior must be confirmed on a device.
- **Emulator-verified (Sept 2026, first runtime):** home→create→room, channel +
  presence, GPS marker + auto-camera, `last_seen` lane, destination + OSRM
  route + ETA, member sheet + follow camera, settings, invite QR — all against
  the local backend. Open from that pass: MapLibre line-layer geometry warning,
  marker-tap confirmation, movement/arrival (emulator GPS is static).

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
  UI) are now built but not yet verified on hardware (issues #13/#14).
- **Background lane needs on-device verification** — the headless task,
  foreground-service start/stop, self-teardown on `room_ended`, and OS
  notifications are implemented and unit-tested where pure, but their runtime
  behavior (especially cold-process relaunch and OEM battery handling) can only
  be confirmed on a real device.
- **Supabase free pause** — keepalive cron now skips gracefully (green) until
  the repo secrets are set; add `SUPABASE_URL` / `SUPABASE_ANON_KEY` when the
  hosted project exists (issue #3).
- **Local-first until then** — all P0 fixes verify against the local Docker
  stack (`npx supabase start` + `db reset` + smoke); the hosted project is only
  needed for the two-phone drill.
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
