# Buds — UI critique against Uber (Oct 2026)

Written 2026-10-29. Every screen was read in code (layout, spacing, type
sizes, colors) against four Uber dark-mode references in
`C:\Users\admin\Downloads\uber`:

| Ref | Screen | What it teaches |
|---|---|---|
| `12.48.40 PM.jpeg` | Home | One entry point (search), grouped recents, bold section heads, art grid, floating tab bar |
| `12.48.40 PM (1).jpeg` | Plan your trip | Nav header, one "when" dropdown chip, origin/destination card, uniform result rows |
| `4.10.47 PM.jpeg` | Choose a trip (1 option) | Map with callouts, sheet with a big title, selected row, pinned CTA naming the choice |
| `4.10.47 PM (1).jpeg` | Choose a trip (list) | Vertical option rows: art left, name + meta, **value right and biggest** |

Nothing was rendered: no emulator run (by request). Spacing calls come from
the style values, so treat pixel-level points as "verify on device".

---

## 1. The six problems that make everything feel worse

These cut across all screens. Fixing them in the design system moves every
screen at once.

### 1.1 Everything is a bordered box on pure black
The canvas is `#000000` and surfaces are `#111111` / `#1A1A1A`, so cards barely
separate from the background. To compensate, almost every surface gets a 1px
`#2A2A2A` border: search box, Later pill, rejoin card, icon tiles, preset
circles, chips, mode cards, stepper buttons, map pills, FABs, toasts, the sheet,
the tab bar. The result reads as a wireframe.

**Uber:** a near-black *gray* canvas with clearly lighter filled surfaces
(search box, circle tiles, icon tiles, chips). Borders are reserved for
meaning: a 2px white border marks the *selected* row ("Bike Saver"), plus
hairline dividers inside groups.

**Fix:** lift the canvas slightly and step the surfaces up so fill does the
separating. Remove default borders, keep hairline dividers, and use a 2px
white border only for selection.

### 1.2 Flat hierarchy: one title size, one eyebrow, lots of tiny text
- Every screen title is the same 28pt left-aligned `Title`, whether it's a
  tab root or a pushed sub-screen.
- Every section uses the same 13pt UPPERCASE dim `Label` ("YOUR NAME",
  "RECENT PLACES", "FOR YOU", "MODE"…). That makes Home look like a settings
  form.
- Important values are rendered *smallest*:
  - the room's trip headline: a 13pt pill
  - member ETA: 12pt
  - room code under the title: 11pt
  - the HOST badge: 9pt
  - map name tags: 11pt
  - preset blurbs: 11pt

**Uber:**
- bold sentence-case section heads ("For you", "Outstation getaways",
  ~28pt)
- a centered nav title on pushed screens ("Plan your trip")
- a big centered sheet title ("Choose a trip")
- large secondary text, nearly as big as the title and only dimmer
- the decision value (₹55.00) is the largest text in each row

### 1.3 Too many primary actions; CTAs in the content instead of pinned
Uber gives each screen one full-width CTA pinned to the bottom, and it names
the selection: "Choose Auto", "Choose Bike Saver". Buds:

| Screen | Competing primary actions |
|---|---|
| Home | Search box, Later, **Create a room** (white), **Join with code**, Retry |
| Join | **Join room**, Scan QR code, Back (three stacked buttons) + Paste |
| Create | **Create room** sits at the end of non-scrolling content, with Back under it |
| Room, full detent | Navigate, Re-center, Invite, Room settings (four stacked buttons) |

### 1.4 No navigation header on pushed screens
Create, Join, Plan-your-trip, room settings, member detail, invite and app
settings all have the same layout: a left-aligned 28pt title at the top and a
**"Back" ghost button at the bottom**, often below the fold. Uber has a back
arrow top-left with a centered title, and nothing at the bottom except the
CTA.

### 1.5 Mixed glyph systems
Real icons (`AppSymbol`) sit next to text characters in nearly every row:
- `›` chevrons
- `×` close
- `−` / `+` stepper
- `●` and `⚑` pins
- `⚠` warnings

Chevrons appear on search results and recents, where Uber has none. Uber's
only chevrons are on map callouts and the payment row.

### 1.6 Blue used as decoration
`design.md` law 2 says blue is information only, but it's used decoratively in
several places:
- Room codes are bold blue letter-spaced text on the Home rejoin card, every
  Trips row, the map title pill and the details deck. The code is the least
  useful fact about a past trip.
- Saved-place icons are tinted blue.
- Member insight lines and the progress bar are blue.
- Focused inputs get a blue border.

Uber's only blue is the "Faster" badge and the Home/Work icon tiles.

---

## 2. Bugs found while reading (fix first)

1. **Create can't scroll.** `app/create.tsx` renders all of this straight
   into `<Screen>` with no `ScrollView`:
   - the crew strip and the name field
   - the destination card
   - 5 mode cards
   - the stepper
   - 4 duration chips
   - the summary line, Create and Back

   On a normal-height phone, **Create room** falls below the screen and can't
   be reached. Join has the same shape plus an auto-focused keyboard.
2. **Toasts cover the "Where to?" pill.** Toasts sit at `insets.top + 64`
   (104 with the connection banner) and the destination pill at
   `insets.top + 60` (108). Toasts render later, so every toast hides the pill
   for 4 seconds.
3. **Emoji in UI:** the Converge headline says "Everyone has arrived 🎉"
   (`modes/converge.ts`), which breaks law 1.
4. **Spectators see a disabled "Where to?" pill** at 60% opacity on the map.
   Uber hides what you can't do; this one just teaches "this app is broken".

---

## 3. Screen by screen

### Home (`app/(tabs)/index.tsx`) vs Uber Home
| Buds now | Uber | Change |
|---|---|---|
| "Buds" title + marketing tagline lead the screen (~90dp) | Search is the first thing | Drop the hero for returning users (a first-run line at most) |
| Search box ~50dp tall, 16pt placeholder, a `›` inside, Later as a separate bordered pill | ~60dp filled box, ~20pt "Where to?", Later is a darker pill *inside* the box | Taller filled box, Later nested inside, no chevron |
| A **"Your name" text field** on Home that gates Create/Join | No form fields on home | Ask for the name once at first create/join (inline sheet), edit it in Profile |
| Three row styles: rejoin = bordered card, recents = hairline rows, planned = rows with `×` | One grouped card, uniform rows, inset divider | One `GroupedCard` holding the active room + recents + planned, same row anatomy |
| "FOR YOU" eyebrow + bare `›` | Bold "For you" + circular arrow button | Section head component |
| Preset circles carry two-line 11pt blurbs | One-word label | Labels only; the blurb moves to the create screen |
| Full-width **Create a room** (white) + **Join with code** at the bottom | No buttons on home | Make "Join with code" and "New room" tiles in the For-you grid, and let a search pick lead to create. Search stays the single primary |

### Plan your trip (`app/search.tsx`) vs Uber Plan your trip
- **Header:** left-aligned 28pt title with no back arrow, and a "Back" button
  after the results. Use a nav header: ← + centered "Plan your trip".
- **When:** Now/Later chips, then a second row of slot chips, both above the
  field. Uber uses one "Pick-up now ▾" chip that opens a picker sheet. Do the
  same: "Now ▾" opens the time slots.
- **Field:** a plain text field whose focus border is blue. Uber uses a
  prominent white-outlined card. Buds has no origin to show, so make it one
  field with a search icon and a clear button, with a white focus outline.
- **Result rows:** the left column switches between a clock icon and a
  distance label from row to row, and every row ends in `›`. Uber keeps the
  icon fixed with the distance *under* it, and shows no chevron.
- **"More options":** "Search in a different city" is a toggle dressed as a
  navigation row. "Set location on map" sends you to *Create*, which is
  surprising. Give both rows round icon tiles like Uber's, and make the map
  row honest ("Pick on the map after creating") or remove it.

### Create (`app/create.tsx`) vs Uber Choose a trip
The mode list is the right instinct, since it maps to Uber's ride list, but
it's dressed as a form:
- **Rows:** radio circles on the right, no art, and an
  **"Experimental" tag on Solo and Multi-track** shown to users. Uber's rows
  have art on the left, the name plus one meta line, and a white border when
  selected, with no radios.
- **CTA:** "Create room" sits in the flow (and is unreachable, see the bugs
  section) with "Back" under it. Uber's CTA is pinned and names the choice:
  **"Create Converge room"**. The summary line ("2 travelers · Converge · 12h")
  belongs in that pinned footer.
- **Steppers:** text `−`/`+` in bordered squares. Use filled circular icon
  buttons.
- **Crew strip:** the decorative avatars sit above the room name. Low value,
  so drop it or move it under the CTA.

### Join (`app/join/index.tsx`)
- Illustration, then title, code, paste, role chips, **Join**, **Scan**,
  **Back**: three stacked buttons.
- Put Scan as an icon button inside the code field and Paste as an inline
  chip. The only pinned button should be **Join room**.

### Trips (`app/(tabs)/trips.tsx`) vs Uber Activity
- It shows the **same four preset circles as Home** ("Start a trip"), so two
  tabs share one grid.
- Planned trips (the *upcoming* ones) live on Home, not here.
- Rows lead with the blue room code and have both `×` and `›`.
- **Change:** make Trips "Activity": an *Upcoming* section (planned trips) and
  a *Past* section where each row shows place/name, then when and mode. Put
  rejoin on the row and move forget to a swipe or long-press. Remove the
  presets from this tab.

### Profile (`app/(tabs)/profile.tsx`)
- A "Profile" section inside the Profile tab, and a second place to edit the
  name (Home has one too).
- The avatar picker is a wrapping row of the Auto tile, every face and the
  initial tile.
- "App" is an eyebrow above a single row.
- **Change:** a big name header with the avatar (tap to change, picker in a
  sheet), then one flat list of rows with icons: Units, Notifications,
  Privacy, Help. That's closer to Uber's Account.

### Room map (`app/room/[id]/index.tsx`): the most important screen
**Chrome count:** up to ten floating layers:
- the back pill, the title pill (name, mode and blue code), the Invite pill,
  the Settings pill
- the connection banner, SOS banners, the Where-to pill, toasts, the waiting
  pill
- four FABs (focus chip, Navigate, Recenter, SOS)
- the sheet

Uber's map has a 44dp black back circle, callouts on the map itself, and the
sheet.

| Area | Now | Uber-style change |
|---|---|---|
| Top bar | Four pills of different widths | Back circle only. Name, code, Invite and Settings move into the sheet header |
| Sheet surface | Pure black with a 1px border, and a `#2A2A2A` handle that's barely visible | Raised gray sheet, visible handle, no border |
| Sheet title | Headline in a 13pt centered pill | A real 22–24pt title: "2 of 4 arrived". Last ETA as a large secondary line, divider below |
| Members | Horizontal carousel of 184dp cards, **sorted alphabetically**, ETA 12pt blue | **Vertical rows** like Uber's ride list: avatar, name and status ("Moving · 3.2 km"), with the **ETA right-aligned and largest**. Selected = white border. Sort SOS first, then by ETA, arrived last |
| Check-in | Small outlined "I'm here" pill floating mid-sheet | Becomes the pinned CTA when you're inside the radius |
| Full detent | Navigate / Re-center / Invite / Room settings as four stacked buttons, duplicating the FABs and top bar | **One pinned CTA** that changes with context: Invite buds (alone) → Navigate (has a destination) → I'm here (near it). Recenter and SOS stay as FABs |
| Expiry | 11pt note | One meta line under the sheet title |
| Map labels | Initial-letter circles with 11pt rounded name tags; destination tag 11pt | Uber callouts: square-cornered black boxes, ~15–16pt text, a `›` into detail, and an ETA box ("4 MIN") on members |
| Member detail | A full-screen push that loses the map | Tap a row → sheet content swaps to that member (Navigate CTA, Follow), and the map follows them |

### Room settings, member detail, invite, app settings
- All end in "Back to map" / "Back" ghost buttons and have no header. Use the
  nav header instead.
- In room settings, the destructive "End room for everyone" sits next to
  "Back to map". Separate them: destructive goes in its own group at the end,
  with spacing above it.

### Tab bar (`features/nav/TabBar.tsx`)
This one is close to Uber already: floating pill, filled selected capsule. The
only change is to drop the border (fill plus elevation is enough).

---

## 4. Design-system changes (tokens + components)

**Color**
| Token | Now | Proposed |
|---|---|---|
| `bg` | `#000000` | Near-black gray (eyeballed from refs; tune on device) |
| `surface` | `#111111` + border | One clear step lighter, **no border** |
| `surfaceAlt` / `raised` | `#1A1A1A` / `#262626` | Tiles, chips and the sheet one step above `surface` |
| `border` | On everything | Hairline dividers only; **2px white = selected** |
| `accent` | Codes, icons, insights, focus | Live info only (ETA badges, links) |

**Type scale** (named tokens instead of ad-hoc sizes; nothing under 12pt off
the map):
- display: 28–30 bold (tab roots)
- navTitle: 20 semibold, centered
- section: 22 bold, sentence case
- sheetTitle: 22–24 bold
- rowTitle: 17 medium
- rowSub: 15 regular dim
- value: 20 semibold (ETA / count, right-aligned)
- meta: 13 medium

**Spacing:** 16 gutters. 32 between Home sections (now 18 via `Label`
margins). Rows at least 64dp. Icon tiles 44, radius 12, filled, no border.

**New shared components:**
- `NavHeader`: ← plus centered title
- `ListRow`: icon tile, title, sub, and a trailing value or chevron
- `GroupedCard`
- `SelectableRow`: the Uber ride row
- `StickyFooter`: a pinned CTA above the safe area, with an optional summary
  line
- `MapCallout`
- `SectionHeader`: bold title plus an optional circular arrow

**`docs/design.md` laws that this proposal changes:**
- Law 6, eyebrow labels for hierarchy: replace it with sentence-case section
  heads.
- Law 5, cards are earned: refine it to "fill, not borders".

---

## 5. Suggested order for the UI pass

| # | Work | Why first |
|---|---|---|
| P0 | Create/Join scroll + pinned CTA, toast offset, the 🎉 emoji, hiding the spectator pill | Real bugs; small |
| P1 | Tokens (surfaces, type scale) and `NavHeader` / `ListRow` / `StickyFooter` / `SectionHeader` | Every later screen reuses them |
| P2 | Room sheet: title, vertical member rows with ETA right, contextual pinned CTA, chrome reduction, callouts | Where users spend the trip |
| P3 | Home (one primary, grouped recents, name out), Plan-your-trip header/when-chip, Create as a ride-list | Entry flows |
| P4 | Trips → Activity, Profile → Account list, settings screens on `NavHeader` | Lower traffic |

Each step is one branch and PR. The screenshot check on the emulator is
yours (P2 especially).

### About the reference images
They stay in `Downloads`. The repo is **public**, and these screenshots show
real addresses and a pickup location, so I didn't copy them into
`docs/refs/shots/`. If you want them archived in the repo, cropped or
blurred versions would be safe.
