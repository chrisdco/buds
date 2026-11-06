# Route view — design and engineering spec

Status: draft, revised after review (Nov 2026). Nothing here is built yet except what
"Today" calls out. Each phase at the end is one PR and, unless marked APK,
ships over OTA.

## 1. What it is for

The map should answer the one question each mode cares about, at a glance,
without the user reading every line:

| Mode | The question |
|---|---|
| Meet up (`converge`) | Is this a fair place, and when is everyone there? |
| Follow leader (`leader`) | Is the convoy intact, who is falling behind? |
| Stay together (`formation`) | Is anyone drifting away from the group? |
| Own way (`multitrack`) | Where is each person, and are they on track? |
| Get home safe (`solo`) | Is this person moving, on route, and when home? |

Principles:

1. **One person, one color, everywhere** — face ring, route, ETA chip, list
   row. Already true for markers; routes follow.
2. **Emphasis, not deletion.** Nobody silently disappears. A de-emphasized
   person is still a face on the map and a row in the sheet.
3. **The map never asks you to configure it first.** Every mode opens on a
   sensible view; switching is one tap; settings are for people who care.
4. **Same rules, every mode.** One visual system (tiers, section 4) and one
   switcher (lenses, section 5); modes only pick defaults.

## 2. Today (what exists)

- `routeManager.ensureRoutes` fetches one route per traveler (self every
  2 min, others every 5, leader-chase every 1, refetch on deviation > 120 m
  or destination moved > 50 m), sequential with 1.1 s gaps.
- Router chain ORS -> OSRM demo -> dashed straight line, 60 s O/D cache.
  Driving profile only.
- `RouteLines` renders **one GeoJSON source + two layers per member**
  (casing + core); self 5 px / others 3 px.
- Member markers with ETA chips; tap toggles a focus set (`selectedIds`).
- Destinations: one room pin, optional per-member pins.

Gaps this spec closes: no way to switch what you see, every route has the
same weight, nothing for choosing a place, no travel profile per person,
and N sources x 2 layers gets expensive past ~6 people.

## 3. Vocabulary

- **Lens** — a named rule that decides which routes are emphasized
  ("Everyone", "Me", "Stragglers", ...). A preset, picked from a chip row.
- **Tier** — how strongly a route is drawn: `primary`, `secondary`,
  `context`, `hidden`. A lens assigns a tier to every person.
- **Candidate** — a place someone suggested in Meet up, not yet chosen.
- **Phase** — `planning` (choosing where), `live` (on the way), `done`.

## 4. Visual system

### 4.1 Tiers

| Tier | Core width | Opacity | Casing | Label on map | Used for |
|---|---|---|---|---|---|
| primary | 5 px | 0.95 | yes | ETA chip on face + mid-route time bubble | you, the focused person, the leader |
| secondary | 3.5 px | 0.7 | yes, faint | ETA chip on face | people the lens cares about |
| context | 2 px | 0.3 | no | face only, no chip | everyone else |
| hidden | — | — | — | face only, dimmed 0.6 | big groups, "Me" lens |

Rules that keep it readable:

- **At most 3 primary + 4 secondary** at once. A lens that would exceed
  that demotes by ETA (latest first stays up — late people matter most).
- Zoom-aware widths: below zoom 11 everything thins by 30% and `context`
  goes `hidden`, so a city-wide view isn't a hairball.
- **Overlap**: routes that share road (convoys, same origin) are offset a
  few pixels (`line-offset` by stable rank) so you see "three lines on one
  road", not one line.
- **Draw order**: context under secondary under primary under markers; self
  always top of its tier.

### 4.2 Line meaning (never color-only)

| Look | Means |
|---|---|
| solid | road route |
| dashed | estimate (straight line, routing failed or offline) |
| dotted, thin | walking leg / last 200 m |
| amber casing | this person is late or off route |
| arrow chevrons every ~150 px | direction, only on primary |
| line shrinks from the start | progress (travelled part is trimmed, not greyed) |

### 4.3 On-map labels

- One **time bubble** per primary route at its midpoint ("18 min"). Hidden
  when bubbles would collide (MapLibre symbol collision does this for us).
- Face ETA chips stay as today (#80).
- Candidates (section 6.1) get their own pin style: hollow pin with a
  score badge, so they never look like the chosen destination.

### 4.4 Color safety

Member palette is fixed (10 colors, `colorForUser`). Two members whose
colors are within a contrast threshold of each other in one room get the
second one's route drawn with a dash-dot pattern; markers already show
faces so they stay distinguishable.

## 5. Lenses — switching what you see

### 5.1 The lens set

| Lens | Primary | Secondary | Context | Hidden |
|---|---|---|---|---|
| **Everyone** | you | up to 4 latest | rest | — |
| **Me** | you | — | — | everyone else (faces stay) |
| **Stragglers** | latest 1-3 | next 2 | rest | — |
| **Focus** | the people you picked | — | you (toggle: "You" chip / Profile) | rest |
| **Arrivals** | none (no lines) | — | — | all; list sorted by ETA, faces show chips |

Modes pick the default lens and which lenses are offered:

| Mode | Default | Offered |
|---|---|---|
| Meet up | Everyone | Everyone, Me, Stragglers, Focus, Arrivals |
| Follow leader | "Convoy" (leader primary, gap labels; see 6.2) | Convoy, Me, Stragglers, Focus |
| Stay together | "Group" (no long routes; see 6.3) | Group, Focus |
| Own way | Me | Me, Everyone, Focus, "Off route" (Stragglers ranked by who left their route, last chip) |
| Get home safe | Me (or "Them" for watchers) | single lens, no switcher |

### 5.2 How you switch (in order of how often people will do it)

1. **Lens chips** — a horizontal chip row pinned just above the bottom
   sheet: `Everyone · Me · Stragglers · Focus`. One tap. The selected chip
   shows a count: "Everyone 8". Hidden when the mode offers one lens.
2. **Tap a face** (map or list) -> switches to Focus with that person and
   flies the camera to fit their route. Tap more faces to add. Tap the
   Focus chip's x, or the selected face again, to go back to the previous
   lens. (This replaces today's silent focus toggle with a visible state.)
3. **Long-press a face** -> "Only them" (Focus with one person) plus quick
   actions (call, ping, show route). Same menu from the list row.
4. **Swipe the chip row / sheet header** left-right to step lenses
   (optional; added with tab-swipe in the next APK since it uses the same
   gesture plumbing).
5. **Camera follows the lens**: switching re-fits the camera to the primary
   + secondary routes (animated 400 ms), unless the user has panned in the
   last 10 s — then we leave the camera alone and show a "Re-center" pill.

A one-line **legend** sits in the sheet header so the state is never a
mystery: "Showing 3 of 8 · Stragglers". Tapping it opens the lens chips if
they were scrolled away.

### 5.3 Auto by group size (defaults, user can always override)

| Travelers | Everyone lens behavior | Chip row |
|---|---|---|
| 1-4 | all secondary/primary, no demotion | hidden unless the mode has >1 lens |
| 5-7 | latest 4 secondary, rest context | shown |
| 8-10 | latest 2 secondary, rest hidden, "ETA range 12-31 min" chip | shown, Stragglers suggested with a dot |

Room size is capped at 10 today; the same table extends if that changes.

## 6. Per mode, per phase

### 6.1 Meet up (`converge`) — includes "Pick someone up"

**Planning (choosing where).** New: candidates.

- Anyone in the room can **suggest a place** (search sheet already exists).
  It drops a hollow candidate pin; max 5 candidates, oldest unpicked ones
  drop off.
- A **candidate carousel** replaces the sheet's top card: one card per
  candidate with name, "everyone there in 12-25 min", the slowest person's
  face, and a fairness badge. Swiping cards moves the map preview to that
  candidate; the map shows everyone's routes to the **focused candidate
  only** (others show just their pin + badge).
- **Fairness score** (lower is better): `max ETA + 0.5 x (max - min)`.
  Best candidate gets "Fairest" tag. Shown as minutes, never as a raw score.
- **Choose**: host taps "Go here" (or any member, per room setting
  `whoChooses: host | anyone`); candidate becomes the destination; others
  fade out. Optional reactions (thumbs up) on cards — counts only, no
  voting rules.
- **Pick someone up** = Meet up where the destination is a member: their
  face is the pin, routes go to their live position (leader-chase refetch
  cadence), and their card says "Waiting at ...".
- **Moving the pin while choosing** (host dragging): routes go to straight
  dashed lines while dragging, then real routes 500 ms after release.

**Live.** Default lens Everyone. Lines trim as people move. Late (ETA past
the agreed time, or > 1.5x initial) -> amber casing + promoted to
secondary. Arrived -> line removed, face gets a check, moves to "There"
section of the list.

**Done.** Everyone arrived or room ended -> routes clear; trip detail keeps
a static "who came from where" thumbnail (phase 5).

### 6.2 Follow leader (`leader`) — road trip convoy

- **One road route**, leader -> destination, primary, leader's color. The
  leader's own travelled path is not drawn (privacy + clutter).
- Followers do **not** get their own full routes. Each follower is placed
  on the leader route ("snapped") with a **gap label**: "1.2 km / 3 min
  behind". Only followers off the leader route (> 150 m) get a short
  secondary line from them back to the nearest point on it.
- **Convoy strip** in the sheet: a horizontal line with faces placed by
  distance along the route (leader at front, destination at the end). This
  is the main "is the convoy intact" read, and it's cheap — no extra
  routing.
- **Stops**: anyone can suggest a stop (fuel, food); it appears as a
  candidate waypoint on the route; leader accepts -> route redraws through
  it and everyone gets a toast.
- Alerts: follower gap > room setting (default 5 min), follower off route.

### 6.3 Stay together (`formation`) — hike as a group

- No long routes by default. The group is drawn as a **soft hull** (rounded
  convex hull, 12% fill in accent) around everyone within the formation
  radius; the **centroid** is a small ring.
- Anyone outside the radius: dashed secondary line from them to the
  centroid + distance label; amber casing past 1.5x radius.
- **Regroup point**: anyone can drop one; everyone gets a short (walking)
  route to it as secondary; cleared when all are within radius of it.
- If the room has a destination, it shows as a pin and one primary route
  from the centroid (not per person).

### 6.4 Own way (`multitrack`)

- Each person to their own destination pin (existing initials pins).
- Default lens **Me**: your route primary; others as faces with chips.
  "Everyone" is one tap away and uses the tier rules (5.3).

### 6.5 Get home safe (`solo`)

- Traveler sees their route and ETA; watchers see the traveler's route
  primary with a "last moved 2 min ago" chip.
- Alerts (watchers): no movement for N min (room setting), off route,
  ETA passed by 15 min. No switcher.

## 7. Travel profiles

Each member can set how they're travelling: **drive** (default), **walk**,
**cycle**, **transit** (estimate only). Shown as a tiny glyph on their ETA
chip. Routing:

- ORS supports `driving-car`, `foot-walking`, `cycling-regular` directly.
- OSRM demo is driving only; FOSSGIS mirror (routing.openstreetmap.de)
  has car/bike/foot — add as a second fallback.
- **Transit** has two levels, and we ship both:
  - *Estimate* (always available): an ETA only — straight line x 1.4 at
    25 km/h, dashed, labelled "approx." No lines, stops or departure times.
  - *Real transit* (where covered): which bus/train, where to board, when
    it leaves, and the walking legs. Source: **Transitous** (free,
    community-run MOTIS routing over open GTFS feeds; fair-use, needs
    attribution) — coverage is strong in Europe, patchy elsewhere. If a
    request returns nothing, we fall back to the estimate automatically.
    Google Routes API does transit everywhere but is paid per request;
    only worth it if transit becomes a core use case.
  - The chip shows which one you're getting: "~25 min" (estimate) vs
    "Bus 42 · 25 min" (real).

## 8. Controls and settings UX

The phone is small and the map is the product, so controls follow a
**three-depth rule**. Every option lives at exactly one *home* depth, and
the shallower depths only ever show shortcuts to it.

| Depth | What it looks like | Cost to reach | For |
|---|---|---|---|
| **1. On the map** | chips, faces, pins, one floating Layers button | 1 tap, no screen change | things people change every trip (lens, focus, pick a place) |
| **2. Quick panel** | native menu or a short sheet (max ~5 rows) that opens *over* the map, which stays visible and live | 1-2 taps, dismiss by tapping the map | things changed sometimes (who can pick, ETA sharing, travel mode) |
| **3. Full settings** | a settings screen with sections, every knob, plain explanations | via "More settings ->" | rare, deep, power-user, defaults |

Rules:

- **Every quick panel ends in "More settings ->"**, which deep-links to the
  *exact* section of the full screen (`/room/[id]/settings#map`), scrolled
  and highlighted. You never hunt for where an option lives.
- **Contextual first.** Options appear where the thing is: long-press a face
  for that person's options; tap a suggested pin for that place's options;
  the Layers button for the map's options. There is no "settings" mega-menu
  in the room.
- **Native controls** from `@expo/ui` (already in the APK): `Menu` for
  short choices (Android dropdown / iOS context menu), `Picker` for
  segmented choices, `Switch`, `BottomSheet` for quick panels. They look
  and behave like the OS, cost no custom gesture code, and get
  accessibility for free.
- **Show the effect, not the setting.** A quick panel changes the map
  behind it immediately (no Save button); the state shows on the map itself
  (lens legend, a small eye-off glyph on a hidden ETA), so nobody needs to
  remember what they set.
- **Undo instead of confirm** for reversible changes: a toast with "Undo"
  for 5 s. Confirm dialogs only for things that affect other people and
  can't be undone (ending the room, removing someone).

### 8.1 What lives where

| Option | Depth 1 | Depth 2 | Depth 3 (home) |
|---|---|---|---|
| Lens (who's emphasized) | chips + tap face | Layers panel | personal default per mode |
| Focus on people | tap / long-press face | — | — |
| Suggest a place | "+" on the place card | search sheet (exists) | — |
| Pick the final place | "Go here" on a card (if allowed) | — | — |
| Who can pick / suggest / start | — | room panel (host) | room settings, Permissions |
| ETA sharing | eye glyph on my chip | my sharing panel | personal + room settings |
| My travel mode | glyph on my chip -> menu | — | personal default |
| Time bubbles on routes, show arrived | — | Layers panel | personal default |
| Alerts (late, gap, drift) thresholds | — | — | room settings |
| Suggested-place reactions and caps | — | — | room settings |

### 8.2 Permissions ("who can")

One pattern for every "who can" question, so people learn it once:

- Actions: **pick the final place**, **suggest places**, **add stops**,
  **change the destination**, **extend / end the room**, **invite**.
- Each has one control, a native `Menu` with:
  `Host only` · `Host + co-hosts` · `Anyone` · `Choose people...`
- `Choose people...` opens a sheet with the member list (faces + check
  boxes). Selection is saved as member ids.
- Co-host is a role the host grants by long-pressing a face -> "Make
  co-host". (Room roles already exist; co-host is a new value.)
- Defaults depend on mode and are shown in the menu as "(default)":

| Action | Meet up | Convoy | Stay together | Own way | Home safe |
|---|---|---|---|---|---|
| Pick the final place | host | leader | host | — | traveler |
| Suggest places / stops | anyone | anyone | anyone | — | — |
| Change destination | host | leader | host | self | traveler |

Enforced on the server (RLS / RPC checks), not just hidden in the UI.

### 8.3 ETA and location sharing (visibility)

Two sides, and the stricter one always wins:

- **Room policy** (host, depth 2/3): `Everyone sees everyone` ·
  `Everyone sees the host, host sees all` · `Only the host sees ETAs`.
- **Personal** (each member, depth 1-2 via the eye glyph on their own
  chip): `Share my ETA` on/off, `Share live position` / `Share only ETA`
  (position snaps to the route, no exact dot).
- Effective visibility = `min(room policy, personal choice)`. If the room
  needs sharing to work (Get home safe, Convoy), the personal toggle
  explains that turning it off pauses the trip for others, instead of
  silently breaking it.
- Hidden ETAs render as the face with an eye-off glyph, so others know it
  is a choice, not a bug.

### 8.4 Suggested places ("candidates")

A **separate render and separate logic** from the chosen destination:

- **Data**: own table (`room_candidates`), own store slice, own realtime
  event. Choosing one copies it into the room destination and marks it
  picked; nothing else in the destination code changes.
- **Render**: own GeoJSON source + symbol layer (hollow pin + ETA-range
  badge), so 5 candidates cost one layer, not 5 React markers. The
  carousel is its own component under the sheet header.
- **Customizable** (room settings, with generic defaults):
  - reactions: `None` · `Thumbs up` (default) · `Pick an emoji set`
    (up to 4 emoji the host picks)
  - cap: 3 / 5 (default) / 8
  - sort cards by: `Fairest` (default) · `Most liked` · `Newest` ·
    `Closest to me`
  - fairness: `Balanced` (default, slowest + spread) · `Fastest for all`
    (slowest only) · `Shortest total travel` (sum)
  - auto-pick: off (default) / "pick the fairest at the time" for planned
    trips

### 8.5 Personal map, like your own Google Maps

What each person sets once and gets everywhere (App Settings -> Map,
depth 3, with shortcuts in the Layers panel):

- default lens per mode, travel mode, units (km/mi), time bubbles,
  reduce motion, "keep my position fuzzy until the trip starts",
  saved places (Home, Work, others) that show up first in search and as
  one-tap suggestions.

### 8.6 How it's stored (one typed schema)

| Layer | Who sets it | Stored in |
|---|---|---|
| **Room** | host / co-hosts | `rooms.settings` jsonb (exists) |
| **Personal** | each user | local persisted store; synced to a `profiles.prefs` jsonb so it follows the account |
| **App** | us, no release | Supabase `app_config` row, read at launch, cached |

Everything a lens or setting can do is expressed as **data**, not code
branches:

```ts
// src/modes/lenses.ts (new) — the whole lens system is this table + one
// pure function. Adding a lens = adding a row.
interface LensSpec {
  id: "everyone" | "me" | "stragglers" | "focus" | "arrivals" | "convoy" | "group";
  label: string;
  rank: (p: PersonView, ctx: LensCtx) => Tier; // pure, unit-tested
}
interface RouteViewConfig {          // zod-validated; merged app <- room <- personal
  lens: LensSpec["id"];
  caps: { primary: number; secondary: number };   // 3 / 4
  timeBubbles: boolean;
  showArrived: boolean;
  lateFactor: number;                 // 1.5
  convoyGapAlertS: number;            // 300
  candidateLimit: number;             // 5
}
function assignTiers(people: PersonView[], cfg: RouteViewConfig, ctx: LensCtx): Record<string, Tier>;
```

Merge order is `defaults <- app_config <- room <- personal (where allowed)`;
each layer is a partial validated with zod, invalid keys dropped, so a bad
remote row can't break the map. Room settings that matter for fairness
(e.g. "show ETAs to everyone") are not personally overridable.

**Tools**: no third-party flag service yet. Code registry + `zod` (new,
JS-only, ships over OTA) +
`rooms.settings` + one `app_config` table covers it and costs nothing.
If we later want staged rollouts or A/B tests, PostHog or Statsig slot in
behind the same `app_config` reader.

## 9. Engineering

### 9.1 Rendering (performance)

- **One source, few layers** instead of N sources x 2 layers: a single
  `GeoJSONSource` FeatureCollection, one feature per route with properties
  `{ userId, color, tier, dashed, late, offset }`. Three layers total
  (casing, core, chevrons) using **data-driven expressions**
  (`["match", ["get","tier"], ...]`) for width/opacity/offset and a
  `filter` to drop `hidden`. Switching lens = recomputing properties, no
  layer mount/unmount, no native view churn.
- Candidate pins and time bubbles are a symbol layer on a second source
  (native collision handling) instead of React `<Marker>` views.
- Faces stay React markers (they need the Peep SVG), already memoized.
- **Geometry simplification**: routes are simplified once on fetch
  (Douglas-Peucker, ~5 m tolerance) — OSRM geometries can be thousands of
  points; this cuts them 5-10x. Progress trimming slices the simplified
  array by nearest index (cheap, O(n) once per position tick per primary).
- Features are recomputed only when routes, tiers or positions-of-primary
  change; positions of context people only move faces.
- Budget to verify on device: lens switch < 1 frame of JS work (< 16 ms)
  at 10 people; map FPS steady while panning with 10 routes.

### 9.2 Fetching (quota and battery)

- **Planning with candidates** uses the **OSRM / ORS table (matrix) API**:
  one request returns durations for N people x K candidates. That fills
  every card's "12-25 min" and the fairness score without fetching any
  geometry. Full geometry is fetched only for the **focused candidate**
  (N routes, sequential as today). 10 people x 5 candidates = 1 matrix call
  instead of 50 route calls.
- **Live**: keep `routeManager`'s cadence, but by tier: primary as today
  (self 2 min), secondary 5 min, context 10 min, hidden never (ETA from
  matrix every 5 min instead). Deviation refetch stays for self.
- **Dragging a pin**: straight lines during drag, fetch 500 ms after
  release, abort in-flight fetches from the previous position (AbortController
  already in `withTimeout`).
- Shared O/D cache stays; key gains the profile.
- Offline / provider down: dashed straight lines (exists), banner "Routes
  are estimates right now".

### 9.3 Data model changes

- `room_candidates` table (id, room_id, member_id, lat, lng, label,
  created_at, picked_at) + RLS like `room_dests`; realtime on the room
  channel. Reactions as a small `room_candidate_reacts` table or a jsonb
  counter.
- `room_members.travel_profile` text (drive/walk/cycle/transit).
- `app_config` (key text pk, value jsonb, updated_at), public read.
- `rooms.settings` gains the `map` object (schema in section 8).
- Convoy stops reuse `room_candidates` with `kind = 'stop'`.

### 9.4 Code layout

- `src/modes/lenses.ts` — lens table + `assignTiers` (pure, tested).
- `src/features/map/routeFeatures.ts` — routes + tiers -> FeatureCollection
  (pure, tested).
- `src/features/map/RouteLines.tsx` — becomes the 3-layer renderer.
- `src/features/map/LensChips.tsx`, `MapOptionsSheet.tsx`,
  `CandidateCarousel.tsx`, `ConvoyStrip.tsx`, `FormationHull.tsx`.
- `src/services/routing/matrix.ts` — table API with the same provider chain.
- `src/lib/routeViewConfig.ts` — zod schema + merge.

## 10. Phases

| # | Ships | What | Needs |
|---|---|---|---|
| 0 | OTA | Routing Edge Function proxy (cache, keys, rate limit), `app_config`, `zod` | edge function, migration |
| 1 | OTA | Single-source renderer, tiers, lens table, lens chips, tap-face Focus, legend, camera follow | — |
| 2 | OTA | Three-depth settings: Layers quick panel, room settings Map + Permissions sections, "who can" menus, co-host, ETA visibility, deep links | migration |
| 3 | OTA | Meet up candidates: suggest, carousel, matrix ETAs, fairness, Go here | migration |
| 4 | OTA | Convoy strip, snapped followers, gap labels, stops | phase 3 table |
| 5 | OTA | Formation hull, regroup point; travel profiles incl. Transitous transit | migration |
| 6 | APK | Swipe between lenses (with tab swipe), haptics on lens switch | next APK |

Each phase lands behind an `app_config` flag so it can be switched off
without a release if it misbehaves on device.

### 10.1 Phase 1 as built

Flag: `app_config` row `routeView` = `{"lenses": true}` (missing row =
on). Off = no chips, no legend, plain Everyone tiers, the mode's own
camera; the single-source renderer stays.

| Spec item | Where |
|---|---|
| Tiers, caps, group-size rules (4.1, 5.1, 5.3) | `modes/lenses.ts` `assignTiers`; Stragglers primary 1 / 2 / 3 by size; Focus keeps your own route as context unless turned off (`sessionStore.focusShowsMe`, "You" chip while focusing, Profile > Your route in Focus); Own way's Stragglers is "Off route": off-route people primary/secondary, the rest context, legend "Everyone's on route" when none |
| Line meaning (4.2): solid, dashed estimate, dotted last 200 m, amber casing, chevrons on primary every 150 px, progress trim | `features/map/routeFeatures.ts` + `RouteLines.tsx` (casing, core, core dash-dot, final dots, estimate, chevrons) |
| "Late or off route" | `modes/routeSignals.ts`: > 120 m off own road route; formation outside radius; leader beyond separation alert; meet up ETA >= median + max(10 min, 50%) with 3+ ETAs |
| Time bubbles (4.3) | `buildRouteLabels` -> `route-labels` symbol source, Noto Sans Bold from the basemap glyphs, native collision |
| Color safety (4.4) | a solid route whose color is within RGB distance 60 of an earlier one draws dash-dot |
| Hidden faces dimmed 0.6 | `MemberMarkers` `dimmedIds` (not in Arrivals) |
| Chips with count, Stragglers dot at 8+, Focus chip (5.2 #1) | `LensChips.tsx` |
| Tap a face, map or list (5.2 #2) | marker tap / list avatar tap toggle Focus; camera fits them and their routes |
| Long-press a face or row (5.2 #3) | `MemberActionSheet`: Only them, add/remove from focus, navigate, details |
| Camera follows the lens, 400 ms, 10 s pan hold + Re-center pill (5.2 #5) | `uiStore.pickLens` / `markUserPan`, `useRoomCamera` |
| Legend in the sheet header, tap brings chips back; ETA range at 8+ | `SheetHeader` `legend` |
| Refetch by tier (9.2) | `routeManager`: self 2 min, leader target 1 min, primary/secondary 5 min, context/hidden 10 min |
| "Routes are estimates right now" banner (9.2) | room screen top stack |

Left to the phase that owns it: Convoy and Group lenses (phases 4, 5),
walking legs (5, needs travel profiles), matrix ETAs so hidden routes
stop fetching (3), swipe and haptics (6). Call / ping quick actions wait
on those features existing; the menu has the actions the app has today.

## 11. Decisions (Nov 2026 review)

1. **Who picks the final place**: host by default; changeable with the
   shared "who can" control (8.2): host only / host + co-hosts / anyone /
   choose people.
2. **ETA visibility**: room policy set by the host, personal opt-out per
   member, stricter wins (8.3). Default: everyone sees everyone.
3. **Transit**: estimate always, real transit via Transitous where it
   exists, automatic fallback (section 7).
4. **Suggested places**: own data, own render layer, own logic (8.4);
   generic defaults (thumbs up, cap 5, sort by fairest) all customizable
   in room settings.
5. **Settings**: three-depth rule (section 8): on the map, quick panel,
   full settings, with "More settings ->" deep links.

## 12. Still open

- Co-host role: new server role value, or a flag on the member row?
- Should personal map prefs sync across devices from day one
  (`profiles.prefs`), or stay on-device first?
- Paid fallbacks (self-hosted routing, Google transit): at what usage do we
  switch? See 13.3.

## 13. Stack evaluation — will it hold?

Short answer: **the app stack is fine for all of this; the free
third-party services behind it are not, at launch scale.** Fix those
behind one seam so the app never needs a release to switch provider.

### 13.1 Fine as is

| Piece | Why it holds |
|---|---|
| Expo SDK 57, RN 0.86, OTA | Everything in phases 1-5 is JS + Supabase, so it ships over OTA. Only gestures/haptics/background need the APK. |
| MapLibre RN 11 | Native GPU renderer. Data-driven `line-width`/`line-opacity`/`line-offset`, filters, symbol collision, fill layers (formation hull), line-placed icons (chevrons) are all supported. One source + 3 layers for 10 routes is light. |
| `@expo/ui` | Real native `Menu`, `Picker`, `Switch`, `BottomSheet` — the "native-ish" feel without custom gesture code. Some components are still marked beta; where one is missing on a platform we fall back to the RN built-in. |
| Zustand + pure functions | Lens/tier/feature computation is pure and tiny at <= 10 people (well under 1 ms). Selectors keep re-renders to the layers that changed. |
| Reanimated 4 | Chip, sheet and camera-follow animations on the UI thread. |
| Supabase Postgres + RLS | "Who can" permissions are enforced server-side with policies/RPC checks; settings are jsonb with typed parsing in the app. |
| OpenFreeMap tiles | Free, no key, no request quota. Fine; offline packs already exist. |

### 13.2 Will strain — and the fix

| Risk | Why | Fix |
|---|---|---|
| **OSRM demo server** | Public demo: no SLA, ~1 req/s courtesy limit, not meant for production apps. Routes silently degrade to dashed lines when it's busy. | **Routing proxy** as a Supabase Edge Function: the app calls our endpoint, the function picks the provider, holds the keys, caches routes for everyone (convoys share O/D pairs), and rate-limits per room. Then swap the provider behind it without an app release. |
| **ORS free tier** | Daily quotas (on the order of a couple of thousand directions and a few hundred matrix calls per day; check current limits) — fine for testing, gone in a day at launch. | Same proxy. Next step up: self-hosted OSRM or Valhalla for one region on a small VPS (tens of dollars a month, unlimited calls, car/bike/foot + matrix), or a paid host (Stadia, GraphHopper) if we don't want to run servers. |
| **Realtime message volume** | Positions dominate: a 10-person driving room publishes about every 2.5 s each, fanned out to 10 receivers — roughly 40 delivered messages/s per room. Supabase plans cap messages/s and concurrent connections (free tier is low; Pro is several times higher). A handful of busy rooms hits the free cap. | Short term: Pro plan when we have real users; positions are already throttled by speed. Later, for big rooms: one batched room snapshot every few seconds (Edge Function) instead of per-person fan-out. Revisit at about 100 concurrent rooms. |
| **Faces as React markers** | Each `<Marker>` is a native view; at 10 it's fine, much more and position ticks get janky. | Room cap is 10. If that rises: faces for `hidden` people become a symbol layer with pre-rendered avatar images. |
| **Background location** | Android kills JS location without a foreground service. | Next APK (already planned). |
| **Transitous** | Community-run, best-effort, coverage varies. | Through the same proxy, short timeout, automatic estimate fallback. |

### 13.3 What I'd add now vs later

- **Now (phase 0, before phase 3)**: the routing Edge Function proxy with
  shared caching; `zod` for config parsing; `app_config` table.
- **When there are real users**: Supabase Pro; self-hosted or paid routing
  for the main region.
- **Not needed**: a different map SDK, a different backend, a third-party
  feature-flag service, or a state library change.
