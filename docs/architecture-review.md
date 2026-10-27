# Buds — Architecture review (Oct 2026)

Written 2026-10-27 after the reliability audit (PR #50). Recommendations
only — no code changed with this doc. Each item says **what**, **why**,
**cost**, and **when** (trigger or phase). Limits below were checked
against the vendors' own pages on 2026-10-27 (sources at the bottom).

## TL;DR

1. **The realtime budget is the real constraint, and ROADMAP's math was
   wrong.** Supabase bills every *recipient* of a broadcast. A 5-car convoy
   at driving rate burns ~36k messages/hour; the free 2M/month is ~55
   convoy-hours. Not "a tiny fraction".
2. **Keep Supabase** for auth, Postgres, RPCs and control-plane broadcasts.
   That design (definer RPCs + RLS + smoke test + type-drift CI) is the
   strongest part of the project.
3. **Add one free Cloudflare Worker** as the app's "edge": keepalive cron,
   routing/geocoding proxy + cache (hides the ORS key, respects the public
   servers' fair-use rules, lets providers change without an app release).
4. **Cut realtime volume first** (adaptive send rate when nobody is
   watching) — cheapest, transport-agnostic, likely 3–10× savings.
5. **Put a transport seam in the client** so the live plane can move to a
   **Cloudflare Durable Object per room** when a trigger fires. That move
   also fixes broadcast spoofing (server stamps the sender) and gives
   ~15× the free capacity.
6. **Split the 1,100-line room screen** into a room-session controller +
   a view. Fuzzy today, and it blocks testing the orchestration.

---

## 1. Backend: where things stand

| Plane | Today | Volume | Verdict |
|---|---|---|---|
| Auth | Supabase anonymous | tiny | keep |
| Data / commands | Postgres + 15 `SECURITY DEFINER` RPCs, RLS | tiny | keep — well-tested |
| Control-plane push | DB triggers → `realtime.broadcast_changes` | low (last_seen updates are already suppressed) | keep |
| Live plane | client broadcast `loc`/`evt` + presence on `room:<uuid>` | **high** | the problem |
| Expiry | pg_cron every 5 min | tiny | keep |
| Routing | ORS (key in app bundle) → OSRM public demo → straight line | per member per minute (60s cache) | proxy it |
| Geocoding | Photon public (`photon.komoot.io`) | per keystroke-ish | proxy + cache it |
| Tiles | OpenFreeMap (no key) | client-direct | fine, keep |
| Keepalive | GitHub Actions cron, **secrets never set** (#3) | — | replace |

### 1.1 The realtime budget (corrected math)

Supabase counts a broadcast as 1 sent + 1 per subscribed recipient (self-send
is off in Buds, so the sender isn't counted again). Send rates come from
`services/location/throttle.ts`: driving 2.5s, walking 4s, stationary 20s.

| Room | Rate | Counted msgs/s | Per hour | Free 2M/month lasts |
|---|---|---|---|---|
| 5 travelers, driving | 0.4/s each | 5 × 0.4 × 5 = **10** | 36,000 | **~55 h** |
| 10 travelers, driving | 0.4/s each | 10 × 0.4 × 10 = **40** | 144,000 | **~14 h** |
| 5 travelers, walking | 0.25/s each | ~6 | 22,500 | ~89 h |
| 5 travelers, parked | 0.05/s each | ~1.3 | 4,500 | ~440 h |

There's also a project-wide cap of **100 msg/s** on Free. The docs don't
say whether it counts recipients. If it does, about **10 driving convoys**
running at once would hit it.

ROADMAP's performance budget claimed "~5 msg/s vs 2M free/mo — a tiny
fraction". That compares a per-second rate with a monthly quota and
ignores recipient fan-out. This PR corrects it.

**Conclusion:** at ~10 testers this is fine. A couple of friend groups
using it for road trips would exhaust Free within weeks. Plan for it
now, while it's cheap to.

### 1.2 Recommendation R1 — cut volume first (small, do soon)

The single biggest lever: **phones in pockets don't need 2.5s ticks from
peers.** Presence already carries each member's `appState` (`fg`/`bg`).

- When **no other member is foreground**, send at heartbeat cadence
  (30s) regardless of speed; snap back to the speed-based rate on the
  next presence sync that shows a foreground viewer.
- Alerts still work: separation/breakaway are computed viewer-locally, so
  a background viewer evaluates on 30s ticks. That's acceptable
  because sustain windows are 30–60s. SOS and arrival are `evt` messages
  and stay immediate.
- In a typical convoy most phones are backgrounded (drivers run
  navigation in the foreground). Expect 3–10× fewer messages.

Cost: ~1 day. It's a change to `throttle.ts` plus presence-derived input,
with unit tests. It survives any transport change.

### 1.3 Recommendation R2 — one Cloudflare Worker "edge" (free, do soon)

One Worker (`edge/` in this repo, deployed with `wrangler`) on the Workers
Free plan (100k requests/day):

| Route | What | Why |
|---|---|---|
| `scheduled` (cron trigger) | ping Supabase PostgREST twice a week | Replaces the GitHub keepalive. GitHub disables scheduled workflows in public repos after 60 days without repo activity, which is exactly when a paused project hurts. Closes #3 once the hosted project exists. |
| `GET /route` | ORS (key held as a Worker secret) → OSRM fallback, Cache API keyed on rounded O/D | The `EXPO_PUBLIC_ORS_API_KEY` ships inside the APK and anyone can extract it and burn the daily quota. Caching across *all* users (today: per device) cuts upstream calls, and providers can be swapped without an app release. |
| `GET /geocode` | Photon proxy + cache, simple per-IP rate limit | Photon's and OSRM-demo's public servers are fair-use, no-SLA services. A cache plus a polite single client keeps Buds a good citizen and gives a switch point if they block us. |

Keep the client's existing chain (`services/routing/router.ts`) as the
fallback when the edge is unreachable, so the edge is never a new single
point of failure.

Auth: require the Supabase access token (verify with Supabase's JWKS
endpoint, asymmetric signing keys) so the proxy isn't an open relay.

Cost: ~1–2 days including `wrangler` CI deploy. Free.

### 1.4 Recommendation R3 — live plane on Durable Objects (when triggered)

**Trigger:** any one of these:
- monthly realtime messages pass ~50% of the quota after R1,
- spoofing matters (public/strangers' rooms, or SOS goes beyond friends),
- a web spectator (P3) needs a live feed.

**Design:** one SQLite-backed Durable Object per room (`idFromName(roomId)`),
reached through the same Worker as R2.

- Client opens `wss://edge…/room/<id>` with its Supabase access token. The
  Worker verifies the JWT (JWKS) and membership (one RPC/REST call to
  Supabase at connect), then hands the socket to the room's DO.
- The DO **stamps `u` from the verified token** on every relayed `loc`/`evt`.
  Peers can no longer forge each other's SOS or position. This closes
  the protocol gap the audit left open.
- The DO keeps last-known positions in memory/SQLite, so late joiners get
  an instant snapshot without the `last_seen` HTTPS lane.
- Presence = the DO's socket set (Hibernation API, per-socket attachment for
  name/role/appState).
- Control-plane changes (rooms/members/destinations) can stay on Supabase
  Realtime at first. They're low-volume, already working, and tested.

**Free capacity (Workers Free):** 100k requests/day; incoming WS messages
count 20:1, and outgoing messages are free. Duration is 13,000 GB-s/day.

| 5-car driving convoy | Supabase Realtime | Durable Object |
|---|---|---|
| Billable per hour | 36,000 msgs | 360 requests + ~450 GB-s (128 MB × 3600 s; ticks every 0.5s keep it awake) |
| Free headroom | ~55 h / **month** | ~28 h / **day** (duration-bound) |

That's roughly 15× the capacity. Past the Free limits, operations fail until 00:00
UTC (no surprise bill), so the client must keep its current degradation:
`last_seen` HTTPS fallback and "Reconnecting…".

**Interim spoofing fix (do before R3 if SOS matters sooner):** send SOS via
an RPC (`raise_sos`) that writes a row. The existing trigger broadcast then
carries a server-attested `auth.uid()`. SOS is rare, so the quota cost is nil.

Cost of R3: ~1 week including tests and a two-phone drill. Most of it is
de-risked by A1 below.

### 1.5 What I would *not* do

- **Don't move Postgres to D1 or leave Supabase.** The RPC/RLS layer, smoke
  tests and type-drift CI are solid, and auth + Postgres are well within Free.
- **Don't self-host tiles or routing yet.** OpenFreeMap is free and keyless.
  The R2 proxy gives an escape hatch for routing without running servers.
- **Don't use R2/KV/D1/Pages yet.** No uploads, no web surface. Pages becomes
  relevant for P3 (web spectator) or an https invite landing page that falls
  back to the store when the app isn't installed.
- Other realtime SaaS (Ably, Pusher, Firebase RTDB) bill or cap per
  connection/recipient in the same shape as Supabase. They aren't worth a
  migration when the DO path removes the fan-out cost and fixes spoofing.

---

## 2. Client architecture

### A1. Transport seam (do before R3; useful now)

`services/realtime/roomChannel.ts` is both the Supabase transport *and*
the dispatcher that writes into five stores (room, members, routes,
session, ui). Split it in two:

- `RoomTransport` interface — `connect(roomId)`, `disconnect()`,
  `sendLoc`, `sendEvt`, `track(presence)`, plus callbacks
  `onLoc/onEvt/onPresence/onControl/onStatus`. Implementations:
  `supabaseTransport` (today's code) and later `edgeTransport` (R3).
- `roomDispatch` — a pure-ish module that takes transport events and
  applies them to stores. The generation guard, snapshot refresh and exit
  reasons live here, transport-agnostic and unit-testable without a fake
  socket.

Payoff: R3 becomes "add a transport + flip a flag". The existing
`roomChannel.test.ts` mostly becomes dispatcher tests.

### A2. Room screen → controller + view

`app/room/[id]/index.tsx` is 1,102 lines with ~12 effects. The effects
cover the slow clock, alert engine, permission priming, alert delivery,
route reconciliation, arrival detection, camera fit/follow, adjust-pin and
the search hand-off. Only the camera, adjust-pin and gestures are about
*rendering*.

- Move alerts, route reconcile and arrival into a `features/room/session/`
  controller (plain TS driven by store subscriptions, started/stopped
  alongside the channel). The screen stops being the only place this logic
  runs. Today, if the screen unmounts while the room is live (e.g. a
  future tab or modal flow), alerts and arrival silently stop.
- Keep camera/adjust-pin as hooks (`useRoomCamera`, `useAdjustPin`) next to
  the screen.
- Target: screen < 400 lines, controller logic covered by Jest without
  rendering.

### A3. Version the wire protocol now

`loc`/`evt` payloads have no version. Rooms will mix app builds (testers
update at different times), and R1/R3 change the protocol. Add `v: 1` to
outgoing payloads and make receivers ignore unknown `v`/fields. That
costs one line today and saves a forced-update mess later.

### A4. Smaller items

- **Persisted state:** six modules hand-roll AsyncStorage keys. That's fine
  at this size, but give each key a schema version (sessionStore already
  clamps legacy values ad hoc) before the next persisted-shape change.
- **`jest` / `jest-expo` sit in `dependencies`.** Move them to
  `devDependencies`. Harmless at runtime, but misleading.
- **Observability:** the Sentry-at-first-dev-build plan
  (`docs/observability.md`) stands. Add Worker logs (`wrangler tail`,
  free) when R2 lands.

### What's already right (keep)

zustand stores with narrow selectors, and the mode strategy registry
(`src/modes`) with viewer-local alerts. Also MapLibre + OpenFreeMap (no
Google key), the honest degradation chain for routing, and the
`last_seen` fallback lane. All fit both current and future scope.

---

## Progress (2026-10-27)

| # | Item | Status |
|---|---|---|
| 1 | A3 protocol version field | Done — #52 (`PROTOCOL_VERSION`, receivers drop newer, absent = v1) |
| 2 | R1 adaptive send rate | Done — #53 (`hasWatchers` → 30s heartbeat when nobody is foreground) |
| 3 | SOS via RPC | Done — #54 (migration 0009 `set_sos`, `room_members.sos_at`; legacy evt dropped) |
| 4 | A1 transport seam | Done — #55 (`RoomTransport`, `supabaseTransport`, `roomDispatch`) |
| 5 | A2 room screen split | Done — #56 (`roomSession` controller + hooks + overlays; screen 1,102 → 365 lines) |
| — | R2 Worker edge | Waiting on a Cloudflare account and the hosted Supabase project (#1) |
| — | R3 Durable Object live plane | Waiting on a trigger (see 1.4) |

None of it is device-verified yet: the two-phone drill (#5) is the check
for R1 (rate drops when backgrounded) and the SOS round-trip.

## 3. Suggested order

| # | Item | Size | Depends on |
|---|---|---|---|
| 1 | R1 adaptive send rate | S | — |
| 2 | A3 protocol version field | XS | — |
| 3 | R2 Worker edge (keepalive + route/geocode proxy) | M | Cloudflare account; hosted Supabase (#1) for keepalive |
| 4 | A1 transport seam + dispatcher | M | — |
| 5 | A2 room screen split | M | A1 helps |
| 6 | SOS via RPC (interim spoof fix) | S | — |
| 7 | R3 Durable Object live plane | L | A1, R2, trigger fired |

Items 1, 2, 4 and 5 are code-only and verifiable with Jest. Items 3 and 7
need a Cloudflare account (free, no card for Workers Free) and the hosted
Supabase project from #1.

## Sources (checked 2026-10-27)

- Supabase realtime message counting and Free 2M/month:
  https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages
- Supabase realtime quotas (200 connections, 100 msg/s on Free):
  https://supabase.com/docs/guides/realtime/quotas
- Cloudflare Durable Objects pricing (Free: 100k requests/day, 13,000 GB-s/day,
  WS incoming 20:1, outgoing free, SQLite 5 GB):
  https://developers.cloudflare.com/durable-objects/platform/pricing/
