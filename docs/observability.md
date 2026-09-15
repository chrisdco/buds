# Buds — Observability (field phase)

Decision (skills Pass 8, issue #39 — revisits the "no Sentry" deferral with
real limits, per the `eas-observe` skill):

- **Sentry, errors-only, starting with the first dev build (#2).** The field
  phase's unknown-unknowns are crashes in code nobody watches: headless
  background-task crashes, cold-process relaunch failures, OEM-specific
  native crashes. EAS Observe explicitly has **no crash reporting** (the
  skill: "use Sentry or BugSnag for that"), so it cannot answer this
  phase's questions.
- **EAS Observe deferred** until a performance question exists (slow
  startup/TTI on tester hardware). Money is not the blocker — its free
  tier covers 10k MAU — but EAS project linkage plus a native rebuild is
  real work with no question to answer yet.

## Real limits (verified September 2026)

| Service | Free tier | Headroom at our scale (~10 users) |
|---|---|---|
| Sentry Developer | 5,000 errors/mo, 1 seat, 30-day retention. No card; past quota the server 429s and events drop | Enormous — unless a crash loop fires (e.g. a background-task restart loop). See quota discipline |
| EAS Observe free | 10,000 MAU, limited feature set | ~1000× headroom; irrelevant until adopted |

## Integration checklist (do when #2 lands — needs a rebuild + device)

Not before: the SDK is unverifiable without a dev build, so no Sentry code
ships until the toolchain exists.

1. `npx expo install @sentry/react-native` (SDK-matched versions, never copy
   pins — canonical shape is `expo/examples` `with-sentry`: `App.js` +
   `app.json` plugin block + `.env.example` DSN).
2. Add the `@sentry/react-native/expo` config plugin (project/org) to
   `app.json`; keep the existing config intact.
3. `EXPO_PUBLIC_SENTRY_DSN` in `.env` + `.env.example` (the DSN is
   public-by-design, like the Supabase anon key).
4. `Sentry.init` in `app/_layout.tsx`, `Sentry.wrap` on the root export.
   Errors only at first — no tracing, no replay (quota discipline + minimal
   weight).
5. Verify on device: a thrown test error appears with source maps; a
   background-task crash appears after relaunch.

## Quota discipline

If a crash loop ever threatens the 5k/mo budget, gate init by release
channel and/or add `beforeSend` sampling — never add a credit card. Paid
tiers ($26+/mo) are off the table at this scale by the $0 constraint.

## Out of scope

BugSnag (same job; Sentry owns the canonical Expo example), self-hosted
Sentry (ops burden, zero benefit at this scale), full tracing/replay
(until a debugging session needs them).
