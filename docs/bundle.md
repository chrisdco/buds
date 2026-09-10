# Bundle measurement runbook (Expo Atlas)

Measure-only. No code changes ship from this doc; numbers go to
`docs/ROADMAP.md` (Performance budget) when refreshed.

## One-off Atlas pass

```bash
# Production bundle + Atlas data (no publishing, local only)
EXPO_UNSTABLE_ATLAS=true npx expo export --platform android
# opens the interactive treemap from .expo/atlas.jsonl
npx expo-atlas .expo/atlas.jsonl
```

Prefer `expo start --no-dev` + `http://localhost:8081/_expo/atlas` for a
quicker production-mode look without a full export.

## What to look for

- Any single dependency > ~500 KB minified that serves one screen.
- Duplicated modules (two versions of one library — check `package-lock`).
- Our code vs `node_modules` split trending over releases.
- Metro silently transpiling ESM→CJS (Atlas shows transform detail).

## History

- Sept 2026: removed `@turf/{distance,helpers,nearest-point-on-line}` from
  the hot path (local `lib/geo.distToPolylineM`); direct deps dropped.
  Turf remains only as MapLibre's transitive subset — Atlas will confirm
  `nearest-point-on-line` no longer ships.
