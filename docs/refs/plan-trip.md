# Plan-your-trip reference (Uber, dark theme)

Source: `shots/plan-trip.png` (chat paste, Oct 2026 — archive the file to lock).
Face-value distillation; pixel-unknown states fall back to help docs.

## Screen anatomy (top → bottom)

1. **Nav header:** back chevron left, centered semibold title "Plan your
   trip". No trailing action.
2. **Qualifier chips row:** two pill dropdowns — clock glyph + "Pick-up
   now" + caret; person glyph + "For me" + caret. Buds analogue: only the
   Now/Later half exists (no scheduling of others' rides, no multi-user
   booking) — implemented as Now/Later chips in `/search`.
3. **OD card:** one rounded-16 bordered box, two rows joined by a vertical
   connector (dot over square): origin row (bold, "UPDOT®") + active
   "Where to?" input with blue caret. Trailing circular `+` button (add
   stop — no Buds analogue, skipped).
4. **Saved chips:** horizontally scrolling pills — home glyph + "Add
   Home", briefcase + "Add Work", star + "Saved places" (truncated).
   Implemented as Add Home / Add Work chips; Buds saves via arm-then-pick.
5. **Result rows:** clock glyph *with distance above it* (`0.8 mi`, `3.1 mi`
   left column), bold name (1 line), dim address (1 line). Implemented with
   Photon + last-known-fix distances; no-fix means no distances, never a block.
6. **"Search in a different city":** globe glyph row — implemented as a
   nearby-bias toggle with inline state.
7. **"Set location on map":** pin glyph row, sub "Go back and long-press".
   Pin-placing needs a live room map, stated inline.

## Skipped with reason

Add-stop `+` (multi-leg trips have no analogue — one destination per
traveler by design), "For me" person picker (no booking for others),
"Pick-up now" time dropdown (Now is the default; Later is the separate
toggle + slots).
