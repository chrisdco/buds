# Buds — Observability

Two tools, one job each (decided November 2026, revisiting issue #39):

- **Sentry, errors only**: crashes and unhandled JS errors, with native
  crash coverage (headless background-task crashes, OEM-specific native
  crashes). Same Sentry account as Incline; the free plan's quota is per
  organization, so both apps share it.
- **EAS Observe, performance**: cold/warm launch, time to first render and
  to interactive, per-route navigation timings, update download times.
  Built into EAS, no extra account. Its JS error reporting is in preview
  and it has no native crash reporting, which is why Sentry stays.

Code: `src/lib/monitoring.ts` (`initMonitoring`, `reportError`,
`withMonitoring`), wired in `src/app/_layout.tsx` (root wrap, Observe
interactive marker, route `ErrorBoundary` with a Try again screen).

## Real limits (checked November 2026)

| Service | Free tier | Our use |
|---|---|---|
| Sentry Developer | 1 seat, about 5,000 errors/month, 30-day retention. No card; past quota events drop | Errors only: `tracesSampleRate: 0`, no replay, no screenshots |
| EAS Observe | 100,000 events/month on the free plan | Startup + route metrics only |

## Privacy

- No PII: `sendDefaultPii` off, no screenshots, no view hierarchy.
- Breadcrumbs are limited to navigation, touches, UI clicks and app
  lifecycle. Console logs and network breadcrumbs are dropped (they could
  carry coordinates or room codes).
- Observe's Expo Router integration filters route params that identify a
  room, a person or a place (`id`, `uid`, `code`, `lat`, `lng`, `label`,
  `name`, `q`).
- Sentry only runs in release builds with a DSN set; dev builds never
  report.

## Setup (the owner does these; secrets never go through Claude)

1. In Sentry, create a React Native project `buds` in the Incline org.
2. Put its DSN in EAS env vars as `EXPO_PUBLIC_SENTRY_DSN` for the
   `preview` and `production` environments (the DSN is public by design,
   like the Supabase anon key).
3. Optional, for readable stack traces: create a Sentry auth token and set
   `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG` and `SENTRY_PROJECT` in EAS,
   then remove `SENTRY_DISABLE_AUTO_UPLOAD` from `eas.json`.
4. Build a new APK. Monitoring is native code: OTA updates can't add it to
   an older build (the app version was bumped to 0.2.0 for this).
5. Check: throw a test error in a preview build and confirm it shows up in
   Sentry; open the app a few times and run `eas observe:metrics-summary`.

## Quota discipline

If a crash loop ever threatens the monthly budget, add `beforeSend`
sampling or gate init by channel. Never add a card; paid tiers are off the
table at this scale.

## Out of scope

BugSnag (same job as Sentry), self-hosted Sentry (ops burden), tracing and
session replay (until a debugging session needs them).
