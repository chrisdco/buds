# Buds — Design spec

Living spec. Every visual change should follow the laws below; deviations are
named at the bottom. References: Opal/Apple Health patterns via the sibling
Focus repo (`github.com/chrisdco/Focus`, `docs/design-references.md`) and the
Expo 8-principles framework
(Contrast, Hierarchy, Alignment, Proximity, Repetition, Balance,
White space, Unity).

## Laws

1. **No emoji in UI.** Glyphs must render monochrome cross-platform: ASCII
   (`+`, `›`, `←`, `⊕`, `★`, `●`) or text-presentation-forced
   (`⚙︎`/`⚑︎`/`⚠︎` with U+FE0E). Emoji-only codepoints (🧭 👥 👀 ⏳ 👆)
   are banned — they render as color emoji on some OEM skins and break unity.
2. **One primary action per view.** Map chrome is the exception (it is all
   actions): pills share one language (same bg/border/radius/metrics).
3. **Settings stay flat.** Toggle rows are full-bleed with hairline dividers,
   48px+ touch height; heterogeneous blocks separated by spacing, not boxes.
   Cards are earned (map overlays, member cards), not default.
4. **Eyebrow labels for hierarchy.** `Label` (uppercase, letterspaced, dim)
   introduces every section; values stay larger/brighter than their labels.
5. **Sheets balance top-to-bottom.** Detail screens anchor actions at the
   bottom (`marginTop: auto`) so the primary CTA sits in the thumb zone;
   no top-packed voids.
6. **Honest states over blank screens.** Loading skeletons, waiting pills,
   empty states, and staleness labels (`Updated Xs ago`, `Last seen Xm ago`)
   — never a blank map or white screen.
7. **Tone tokens first.** `colors` + `space` in `constants/theme.ts` are the
   only source of palette/rhythm; new styles use them (migration of older
   literals is progressive, not big-bang).

## 8-principle audit (re-check on every visual change)

- **Contrast** — one blue primary per view; `accent` never used for status;
  destructive red reserved for end/kick; warning amber reserved for
  expiry/formation alerts.
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

- Map markers keep per-member colors (wayfinding needs them; Focus's
  single-accent rule doesn't apply to a multi-actor map).
- Expiry extend actions stay as chips (compact map-adjacent language),
  not full buttons — they are low-frequency host tools, not conversion CTAs.

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
- **Uber — trip progress + dark map:** arrived/travelers progress bar under
  the insights headline; OpenFreeMap `dark` basemap so chrome stays legible;
  full-detent deck is the trip card (facts + action deck).
- **Life360 — Circles ≡ rooms**, member rows with live status, place
  alerts ≡ arrival/destination alerts, **Check-in ≡ "I'm here"** manual
  arrival (coexists with the auto detector; server-idempotent).
- **Explicitly not adopted:** member battery % (needs a presence/tick
  protocol change — P3), driving reports/crash/SOS-dispatch (out of scope),
  multi-Circle switcher (one active room; revisit with real demand).
