# Google Play readiness

What Play will ask for and the answers for buds. Anything marked **You**
needs your Play Console account; the rest is already in the repo.

## 1. Permissions that trigger reviews

| Permission | Status | Why |
|---|---|---|
| `ACCESS_BACKGROUND_LOCATION` | **Removed** (app.json) | Screen-off sharing is a location foreground service started from the open app, which Android runs on "While using the app". Not requesting it skips Play's background-location declaration and video review entirely. |
| `FOREGROUND_SERVICE_LOCATION` | Kept | Needed for that service. Play asks you to declare it (below). |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Kept | Play restricts this to apps whose core feature breaks under Doze. Live trip sharing qualifies; say so if asked. Drop it if review pushes back: the foreground service mostly survives Doze on its own. |
| `CAMERA` | Kept | QR invite scanning only. |
| `POST_NOTIFICATIONS` | Kept | Arrival and SOS alerts, and the sharing notification. |

### Foreground service declaration (Play Console → App content → Foreground service permissions) — **You**

- **Type:** Location.
- **Task:** "During a trip, Buds shares the user's live location with the
  members of their trip room so they can see each other on the map and get
  arrival and safety alerts. The user starts the trip in the app; sharing
  continues while the phone is locked until the trip ends or the user stops
  it. A persistent notification shows the whole time."
- **User impact if deferred:** "Members would see a frozen position the
  moment the phone locks, which defeats safety features like Get home safe."
- **Video** (Play asks for a short link, e.g. unlisted YouTube): open Buds →
  create a trip → show the "Buds is sharing your location" notification →
  lock the phone → on a second phone, show the marker still moving → end the
  trip → notification disappears. 30–60 seconds is enough.

## 2. Data safety form — **You** (answers below)

Data is encrypted in transit (HTTPS/WSS). Deletion: Settings → Delete my
data calls `delete_my_data()` (migration 0013), which leaves every room and
deletes the user's memberships, positions, personal destinations and empty
hosted rooms on the server, then wipes the phone. Play also wants a way to
ask for deletion without the app (people who uninstalled): **You** — a
contact email or simple web form on the privacy policy page is enough.

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Precise location | Yes | Yes, with the other members of the user's trip room only | App functionality | No (core feature); the user can pause sharing or watch as a spectator |
| Name (display name, up to 24 characters) | Yes | Room members | App functionality | Required to join a room |
| User IDs (anonymous account ID) | Yes | No | App functionality | No |
| Crash logs | Yes, once Sentry is on | No | Analytics (diagnostics) | No |
| Diagnostics (app performance) | Yes, once EAS Observe is on | No | Analytics | No |

- **Not collected:** contacts, photos, messages, financial or health data,
  web history, advertising ID. No ads, no selling of data.
- **Processors** (data passed to a service to do a job, not "shared" in
  Play's sense): Supabase (database and realtime), OpenFreeMap (map tiles),
  OSRM / openrouteservice / routing.openstreetmap.de (routes: start and end
  coordinates), Mapbox and Photon (place search: the query and the
  approximate area), Sentry and Expo (diagnostics, no location).

## 3. Store listing — **You**

- Privacy policy URL: publish `docs/privacy-policy.md` somewhere public
  (GitHub Pages, a Notion page, your site). Play rejects apps without one.
- Content rating questionnaire: the app shares location with other users →
  answer "Yes" to "shares user location with other users". Expect a Teen/12+
  rating.
- Target audience: 13+ (location sharing with strangers via invite codes
  rules out a children's audience).
- Screenshots: home, a live trip map with routes, the room sheet, search.

## 4. Build

- Production builds an AAB (`eas build --profile production`) with all four
  CPU types; Play sends each phone only its own. The preview APK carries
  only arm64-v8a + x86_64 (eas.json) to stay small.
- Bump `version` in app.json for every native change (runtime policy is
  `appVersion`).
- First upload goes to an internal testing track; Play's pre-launch report
  runs the app on real devices for free and is worth reading before review.

## 5. Already handled in code

- Location retention: last known positions are cleared 10 minutes after a
  room ends or a member leaves (migration 0012).
- Crash reports and metrics never include location (src/lib/monitoring.ts).
- Location prompts are explained before the system dialog and asked once
  per trip.
