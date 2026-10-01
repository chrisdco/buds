# Uber reference set (Sept 2026)

Product reference for the Buds ↔ Uber visual alignment pass. Files live
outside the repo (chat/Downloads); the distilled patterns below are the
durable contract — read these before restyling a surface.

Local files (previous batch, `Downloads/WhatsApp Unknown 2026-09-11 …/`):
`…12.48.40 PM.jpeg`, `…12.48.40 PM (1).jpeg`, `…4.10.47 PM.jpeg`,
`…4.10.47 PM (1).jpeg` — ride-select sheet, map + collapsed sheet,
plan-a-trip search, destination rows.

Main-page ref (shared in chat, Sept 18 — save a copy next to this file as
`uber-home.png` if it needs pixel comparison): Uber home, dark theme.

## Distilled patterns (mapped to Buds)

1. **Search box as primary entry** — full-width rounded field, magnifier +
   placeholder + trailing affordance (`Later` pill). Streamlined single
   action, not a button row. Buds mapping: home "Join with code" is a
   search-styled entry (same handler/rules); "Later" has no analogue
   (durations, not schedules) and is deliberately skipped.
2. **Limited recents** — one recents card (clock icon, title, sub, chevron),
   never a long list. Buds mapping: home rejoin card (1 active) + Trips
   recents capped at 5, same row language.
3. **"For you" grid** — circular art tiles with promo badges overlapping the
   top edge, label below. Buds mapping: Trips preset circles + Popular badge.
4. **Getaway photo cards** — wide snap carousel, art-forward. Kept in mind
   for future wide surfaces; presets stay circular (one row, no scroll).
5. **Bottom pill bar** — compact, 3–4 items, selected = filled pill + white
   label, unselected dim. No 4th Buds tab until a design discussion says so.
   Matched Sept 18: 16px margins, 58px cells, 26px icons, 13px labels,
   `colors.raised` (#262626) selected fill — all native views, no tab library.
6. **Rows over cards for options** — ride/mode lists are rows (art left,
   title + sub center, value right, selected = border highlight). Next
   application: create/settings mode selectors (still bare chips).

Adopted Sept 18 (verified on emulator): home "Join with code" is a
search-styled entry (same name/prime rules; focuses the name field when
empty); Trips presets are the "For you" circle grid; tab pill compacted.
Skipped: "Later" scheduling (no product analogue — durations, not times).
Skipped: "Later" scheduling (no product analogue — durations, not times).
