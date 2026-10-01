# Buds — Design spec

Living spec. Every visual change should follow the laws below; deviations are
named at the bottom. References: Opal/Apple Health patterns via the sibling
Focus repo (`github.com/chrisdco/Focus`, `docs/design-references.md`) and the
Expo 8-principles framework
(Contrast, Hierarchy, Alignment, Proximity, Repetition, Balance,
White space, Unity).

## Laws

1. **No emoji in UI.** Glyphs must render monochrome cross-platform: native
   symbols via `components/AppSymbol.tsx` (SF Symbols on iOS, Material
   Symbols on Android, explicit per-platform names validated by tsc, text
   fallback always provided). Raw text glyphs are allowed only when
   text-presentation is forced (U+FE0E) or the codepoint is text by default
   (`← ⊕ ★ ● ›`). Emoji-only codepoints are banned.
2. **Uber duet + Inter.** Ink-black canvas, white primary CTAs with black
   labels, neutral grays; blue survives only as information (live codes,
   ETAs, links). Type is Inter only (`constants/fonts.ts`, exact family
   names, no bare `fontWeight` — Android can't synthesize weights):
   700 titles/codes, 600 labels/insights, 500 buttons, 400 body. Pills are
   999px stadium; cards 16px.
3. **Confirms are native sheets, not system alerts.** Destructive or
   consequential choices go through `ConfirmSheet` (@expo/ui modal
   BottomSheet + scrim); `Alert.alert` remains only for pure notices.
   Callers `await requestConfirm()` — replacement resolves pending false,
   so no one hangs.
4. **One primary action per view.** Map chrome is the exception (it is all
   actions): pills share one language (same bg/border/radius/metrics).
5. **Settings stay flat.** Toggle rows are full-bleed with hairline dividers,
   48px+ touch height; heterogeneous blocks separated by spacing, not boxes.
   Cards are earned (map overlays, member cards), not default.
6. **Eyebrow labels for hierarchy.** `Label` (uppercase, letterspaced, dim)
   introduces every section; values stay larger/brighter than their labels.
7. **Sheets balance top-to-bottom.** Detail screens anchor actions at the
   bottom (`marginTop: auto`) so the primary CTA sits in the thumb zone;
   no top-packed voids.
8. **Honest states over blank screens.** Loading skeletons, waiting pills,
   empty states, and staleness labels (`Updated Xs ago`, `Last seen Xm ago`)
   — never a blank map or white screen.
9. **Tone tokens first.** `colors` + `space` in `constants/theme.ts` are the
   only source of palette/rhythm; new styles use them (migration of older
   literals is progressive, not big-bang).
10. **First run is minimal.** No signup wall (anonymous by design), value in
    ~90 seconds, inline teaching over carousels. Home carries a 3-step strip,
    not a tour.
11. **Permissions are double-prompted.** Our sheet explains the exchange at
    the moment of intent (Not now = harmless, never blocks); the OS dialog
    only follows Continue. Denials surface an inline banner + Settings
    deep-link, never a dead end. Never chain system dialogs.
12. **First-level IA is three tabs; settings has two homes.** Home (create /
    join), Trips (recents + rejoin), Profile (name, prefs, support) share one
    custom Android-targeted tab bar; room/create/join stay full-screen stack
    with no tabs. App profile home vs per-room settings stays split;
    destructive identity actions always confirm and verify.

## 8-principle audit (re-check on every visual change)

- **Contrast** — one white primary per view; `accent` blue is information
  only (codes, ETAs); destructive red reserved for end/kick; warning amber
  reserved for expiry/formation alerts.
- **Hierarchy** — map > insights headline > member cards; sheet: identity >
  route/position > actions; settings: section label > row value > caption.
- **Alignment** — 20px screen axis (`Screen`), 12px map-overlay axis; one
  axis per surface, never mixed on the same surface.
- **Proximity** — hairlines between same-type rows; spacing between blocks;
  toasts offset below the connection banner, never overlapping it.
- **Repetition** — one pill language (chips, top bar, FABs), one badge
  language (`HOST`, `★` leader), one toast shape.
- **Balance** — hero mass on top (map/sheet header), actions as fulcrum at
  the bottom, quiet lists anchor.
- **White space** — 16px section rhythm, 20px insets; the map itself is the
  breathing room on the room screen.
- **Unity** — no emoji, one accent family, member colors only on
  avatars/dots/routes/pins (never text), tabular numerals on codes/timers.

## Deliberate deviations

- `@expo/ui` is the default for native controls (ConfirmSheet BottomSheet,
  buttons, text) — except three hand-rolled keeps, audited per the expo-ui
  skill: RN `Switch` (universal Switch has no track/thumb tint, and our duet
  needs exact neutrals — platform tint modifiers would cost a file split for
  zero UX gain), flat settings rows instead of `List` (native `List` is iOS
  grouped-settings styling; law 5 mandates flat ink rows), and chips/steppers
  instead of `Picker` (compact map-adjacent language for 3–4 options).
  RoomSheet stays hand-rolled: universal BottomSheet is modal-only.

- Map markers keep per-member colors (wayfinding needs them; Focus's
  single-accent rule doesn't apply to a multi-actor map).
- Motion follows the expo-animation skill, with three keeps: member markers
  move in discrete jumps (ticks arrive every 2.5–20s and MapLibre markers
  aren't Reanimated views — per-frame geo interpolation would cross the
  bridge per marker per frame and imply a precision the throttle
  deliberately threw away; heading arrow + presence opacity carry the
  aliveness), full-screen map loads keep the honest spinner (a map canvas
  has no layout to skeletonize — shimmer is reserved for list rows like
  dest-search results), and press feedback is a 3% / 120ms scale on buttons
  and chips only (list rows highlight instead of scaling).
- Design tokens live in `constants/theme.ts` (`colors` + `space` + `radius`,
  law 9) — not the skill's `src/theme/` layout, and deliberately dark-only
  fixed hex rather than semantic `Color` APIs: the product is ink-black on
  every device (manifest pins `userInterfaceStyle: dark`), there is no light
  mode to adapt to, and iOS is deferred (#10) so dynamic/adaptive color
  buys nothing today. Revisit with the iOS lane. Same lane owns the keeps
  below: `elevation` stays over `boxShadow` (Android renders it; the
  translation is unverifiable without a device), `borderCurve` is skipped
  (iOS-only prop), filenames stay camelCase (established convention —
  renaming is churn, not drift), and QR black-on-white stays literal
  (scanner contrast requirement, not a theme decision).
- Expiry extend actions stay as chips (compact map-adjacent language),
  not full buttons — they are low-frequency host tools, not conversion CTAs.

## Illustrations (Phase B, Sept 2026)

Prod pattern (Uber/Notion rule): **raster for scenes, vector for simple.**
Complex scenes ship as build-time PNGs (`npm run art` → `assets/illustrations/`,
`@1x/@2x/@3x` via `scripts/rasterize-art.mjs` + `@resvg/resvg-js`) and render
as one native `<Image>` — a thousand-node SVG tree costs a thousand native
views on mount, a PNG costs one. Vectors (`react-native-svg`) stay for icons,
peep avatars, and small spots (<100 nodes). Node budget for any future scene:
~150 nodes or it gets rasterized, no exceptions.
- **unDraw scenes** (no attribution, commercial OK, decorative use): home hero
  (`share-location`), join (`location-search`), preset cards (`destination`,
  `order-ride`, `travel-together`), all with primary `#6c63ff` → `colors.accent`
  `#4F8EF7` baked at raster time. Sources live in
  `assets/illustrations/src/` so swaps stay reproducible. Dark-theme note:
  near-black shapes (`#2f2e41`) read as night shading on ink — verified
  on-device, not assumed. Dead slugs are common (CDN 404s); old art lives
  under `/illustrations/`, new under `/illustration/`.

- **unDraw scenes** (no attribution, commercial OK, decorative use):
  home hero (`ShareLocationArt`, primary `#6c63ff` → `colors.accent`
  `#4F8EF7`) and join art (`LocationSearchArt`, same recolor). Dark-theme
  note: near-black shapes (`#2f2e41`) read as night shading on ink —
  verified on-device, not assumed.
- **Open Peeps figure** (CC0, zero restrictions): empty-recents
  (`WaitingPeepArt`, sitting traveler; black↔white remap for ink theme).
- **Perf rule for art (Sept 2026, Trips lag + pop-in fixes):** `Slot` +
  `router.replace` remounts the whole tab on every visit, so tab art must be
  mount-cheap AND single-commit. Scenes ship rasterized (one native view);
  `PresetArt` is memoized; all bundled bitmaps decode up front
  (`Asset.loadAsync` in root layout, off the splash path) so screens paint
  complete — never placeholder-then-pop (a rAF-defer tried that; it read as
  a visible flash and was removed). Node count, not pixels, is what drops
  frames on mount: halftone dot fields get thinned at conversion
  (`--thin=FILL:N`, e.g. the travel-together globe went 1375 → 490 nodes).
- **Skipped deliberately:** Storyset (free tier demands visible
  attribution + link — hostile to a native app with no credits surface;
  revisit only with Premium) and ManyPixels (license is fine but no direct
  file access, and its flat style overlaps unDraw — one scene language wins).
- Preset tiles were monochrome symbols until the rail redesign below (a 64px
  medallion can't host a scene without turning to mud).
- **Round 2 (same session): Uber-style preset rail** — horizontal snapping
  cards (232px) with full-bleed cover-cropped scenes, then reworked to the
  Uber main-page "For you" circle grid (92px circles, badge on top edge,
  label below) once reference shots arrived. Meet up =
  `destination_fkst`, Follow leader = `order-ride_4gaq` (landscape, very
  Uber), Stay together = `travel-together_uhlf`. `TripPreset.image` is now
  `{ Art, vbW, vbH, fx, fy, window }`: circles show a zoomed focal window,
  focals picked against laptop renders (`scripts/preview-crop.mjs`) so no
  blind emulator rounds — resvg preview framing provably equals on-device
  framing (same bytes, same viewBox math). testIDs unchanged (Maestro taps
  them). 4th tab deferred to a design discussion, not this pass.
- **Open Peeps people system (CC0):** `PeepAvatar` (7 faces A–H, deterministic
  hash by id) drives member cards, the profile identity medallion, and the
  create-screen "gather your buds" trio. White-on-ink remap baked at
  conversion. Paint never mutates post-mount (same Fabric rule as the tab
  pill fix).
- **Uber path language:** route lines get a soft white casing underlay on the
  dark tiles (`RouteLines` casing layer, same dash as the core).
- **Skipped with reason:** Storyset (attribution), ManyPixels (no direct
  files + style overlap), invite-screen art (QR is the hero; clutter risk),
  preset-tile medallions (64px mud rule above).
- **Library patch (patch-package, JS-only, no rebuild):**
  `patches/@expo+ui+57.0.17.patch` adds the missing `.catch()` to the
  `hide()` call in `@expo/ui`'s Android `BottomSheet` — without it, any
  native-side dismissal race (gesture/scrim/back-press, or activity teardown
  when backgrounding to Maps) surfaced as `Uncaught (in promise) Error:
  Call to function 'ModalBottomSheetView.hide' has been rejected`, and the
  stuck mount then wedged every later confirm invisible. Verified on-device:
  open → swipe-dismiss → silent logcat, room intact, reopen works.

## Future review (optional): screen transitions

Deferred until the app has moved (post-device-verification / weekly tester
use). Standard cleanup comes first; a shared-element library only if a hero
moment is wanted.

- **screen-choreography.dev (`react-native-screen-choreography` v0.5.2,
  pre-1.0):** one retained native subtree moves Source owner → native overlay
  → Destination `Target` via `react-native-teleport`; React ownership stays
  at source. Model is `ChoreographyScreen(screenId)` + `groupId` (e.g.
  `artwork.42`) + `defineTransition({ motion, shared: { hero: { kind:
  'bounds'|'surface' } }, enter/exit })` on a single 0→1 expansion clock
  (back is 1→0). Expo entry is
  `react-native-screen-choreography/expo-router` (`ChoreographyProvider` in
  root layout, `animation: 'none'`, detail as `containedTransparentModal` +
  transparent content, `useChoreographyRouter.push/back`, `groupId` per item,
  standalone fallback for deep links with no mounted source). Examples:
  Gallery (photo hero), Wallet (multi-role + reveals), Wallet-setup (panel
  expands to next step).
- **Fit vs Buds (checked Sept 2026):** stack matches (SDK 57 / RN 0.86.3 /
  Reanimated 4.5.1 / Screens 4.26 / Fabric) but costs are real — native
  rebuild + dev-client (no Expo Go), Stack-only (our tabs are `Slot` +
  custom `TabBar` with `router.replace`, so not eligible), invasive wrappers,
  pre-1.0 breaking risk. Only candidate worth piloting: `MemberList`
  avatar → `room/[id]/member/[uid]` avatar header (`bounds` hero + title/stat
  reveals). Do NOT shared-element the MapLibre map (trips/home cards →
  room) — fade/slide only.
- **What people usually do (do this first):** standardize Stack
  `animation`/`presentation` per route (`slide_from_right` pushes,
  `slide_from_bottom`/`fade_from_bottom` modals for create/join/invite,
  `animationDuration` ~250–350ms); iOS 18+ native zoom via Expo
  `Link.AppleZoom`/`AppleZoomTarget` for a cheap hero (graceful fallback,
  Stack-only, avoid with headers); Reanimated `entering`/`exiting`/`Layout`
  on lists + tab pill with reduced-motion respect; keep current press
  3%/120ms + sheet springs. Alt lib with presets (Instagram/AppleMusic):
  `react-native-screen-transitions` via `withLayoutContext` — same
  dev-client cost. Revisit when motion, not stability, is the constraint.

## Reference patterns adopted (Uber / Google Maps / Life360)

Shared grammar, Buds brand. Learn the pattern, not the pixels.

- **Google Maps — 3-detent non-modal sheet** (`RoomSheet`): peek (headline) /
  half (trip panel) / full (trip card deck), no scrim, map interactive
  behind, drag handle + tap-to-cycle, fling-aware snap. Camera bottom
  padding and logo/attribution position track the detent so framed content
  and ornaments stay in the visible strip.
- **Google Maps — self blue-dot language:** self marker carries the accent
  ring; others keep white. (No accuracy halo: our throttle quantizes
  positions, so a halo would imply false precision.)
- **Google Maps — share-duration:** expiry chips are the analogue of Maps'
  "share for 1 hour"; non-hosts always see the countdown line.
- **Uber — destination search + adjust:** "Where to?" pill over the map,
  bold-name/dim-address/distance rows, then a fixed-center-pin adjust step
  (drag the map, pin stays put) before the native confirm. Search never sets
  directly — picks seed adjust mode, where the existing policy gates apply.
- **Uber — trip progress + dark map:** arrived/travelers progress bar under
  the insights headline; OpenFreeMap `dark` basemap so chrome stays legible;
  full-detent deck is the trip card (facts + action deck).
- **Life360 — Circles ≡ rooms**, member rows with live status, place
  alerts ≡ arrival/destination alerts, **Check-in ≡ "I'm here"** manual
  arrival (coexists with the auto detector; server-idempotent).
- **Uber — selectable rows:** map markers toggle camera focus with a ring;
  list cards mirror the set with a bright selected border. One focus follows,
  several fit; the chip names one ("Following X") or counts many
  ("Focusing N") and clears on tap. FABs float above the sheet at every
  detent so focus stays reachable.
- **Explicitly not adopted:** member battery % (needs a presence/tick
  protocol change — P3), driving reports/crash/SOS-dispatch (out of scope),
  multi-Circle switcher (one active room; revisit with real demand).
