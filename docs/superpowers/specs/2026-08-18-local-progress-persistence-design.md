# Local progress persistence — design

Date: 2026-08-18
Status: approved, ready for implementation planning
Parent spec: `docs/superpowers/specs/2026-08-15-sanskritify-design.md` (build order §10, step 4)

---

## 1. What this covers

Step 4 of the parent spec's build order — "full engine: path, review
scheduling, hearts, streak, daily goal, achievements" — is five separable
pieces, not one. This spec covers the first slice: **local persistence**,
plus wiring the two pieces of engine logic that already exist but currently
do nothing.

Today, `packages/core` has `currentHearts()` and `streakLength()` — both
pure, both tested, neither called from anywhere. `LessonScreen.tsx` starts
every session with a hardcoded `{ hearts: 5, maxHearts: 5 }`. Nothing in the
app persists across a restart: kill the app mid-lesson and hearts, XP, and
any notion of "did I study today" are gone.

This spec makes hearts and streak real: stored on-device, correct after a
restart, and visible where they already have a natural home (the lesson
HUD for hearts, a new home-screen badge for streak).

**Out of scope**, deferred to later slices of step 4: lesson path/unit
progression (still one hardcoded lesson), review scheduling (SRS), XP
accumulation toward a daily goal, and achievements. None of those are
touched here. Step 5 (Supabase, auth, sync) is untouched — this is
on-device only.

---

## 2. Storage

`@react-native-async-storage/async-storage`, not `expo-sqlite` or
`react-native-mmkv`.

- We're storing three small values (a heart count, a timestamp, a list of
  date strings) — a relational store buys nothing yet. Revisit when SRS
  needs to query `lexeme_srs`-shaped rows.
- MMKV is a native module Expo Go doesn't support; adopting it now would
  force a custom dev client for no benefit this slice needs.

One JSON blob under a versioned key, so a future shape change doesn't have
to guess what old data looked like:

```ts
// AsyncStorage key: "@sanskritify/progress/v1"
interface StoredProgress {
  hearts: { count: number; updatedAt: string }; // ISO 8601
  activityDays: string[];                        // "YYYY-MM-DD", deduped
}
```

Default on first read (no stored value yet):
`{ hearts: { count: 5, updatedAt: <now> }, activityDays: [] }`. `5` is
`SessionOpts.maxHearts`'s current default from `LessonScreen.tsx` — the
adapter reads it from there rather than hardcoding a second copy.

New module: `apps/mobile/src/storage/progressStore.ts`

```ts
function loadProgress(): Promise<StoredProgress>;
function saveProgress(progress: StoredProgress): Promise<void>;
```

Thin: JSON parse/stringify plus the default above. All engine math (heart
regen, streak length, recording a day) stays in `packages/core`, per the
purity rule — this module is the only place in the app that touches
AsyncStorage directly.

---

## 3. Hearts

### New pure function

`packages/core/src/hearts.ts` gains `msUntilNextHeart`, alongside the
existing `currentHearts`:

```ts
function msUntilNextHeart(count: number, updatedAt: string, now: string, max: number): number;
```

Same regen math `currentHearts` already does (`HEART_REGEN_MS` = 30 min per
heart), returning the remainder until the next tick instead of the
recomputed count. Returns `0` if `count >= max`. Tested the same way as
`currentHearts`.

### Wiring

`LessonScreen.tsx`, on mount:

1. `loadProgress()`, then `currentHearts(stored.hearts.count, stored.hearts.updatedAt, now, maxHearts)` for the live, regenerated count.
2. **Live hearts `> 0`**: `createSession(lesson, { hearts: live, maxHearts: 5 })`, as today — just no longer hardcoded.
3. **Live hearts `=== 0`**: don't call `createSession` — it throws below 1 (`session.ts:16-18`, intentionally: hearts=0 used to report `in_progress` and fail on the first correct answer). New render branch instead: an "out of hearts" screen showing time until the next one, via `msUntilNextHeart`.

Whenever `submitAnswer` returns a state whose `hearts` is lower than
before the call, persist `{ count: next.state.hearts, updatedAt: now }`
immediately — not batched to session end. An app killed mid-lesson must not
get hearts back for free.

---

## 4. Streak

### New pure function

`packages/core/src/streak.ts` gains `recordActivityDay`, alongside the
existing `streakLength`:

```ts
function recordActivityDay(days: string[], day: string): string[];
```

Dedupe/sorted insert — inserting a day already present returns the same
set (by value). Tested alongside the existing streak tests.

### Wiring

Recorded **on engagement, not completion**: a learner who plays and fails
still studied today, and gating on `status === 'complete'` would erase
that. The first `submitAnswer` call of a session calls
`recordActivityDay(stored.activityDays, today)` and persists it right
away — same kill-mid-lesson reasoning as hearts, not deferred to session
end.

`apps/mobile/app/index.tsx` (home screen), on mount: `loadProgress()`,
`streakLength(activityDays, today)`, render a `🔥 N` badge next to the
title when `N > 0`. Nothing rendered when `N === 0` — a fresh install
showing "🔥 0" reads as a failure state, not a feature.

---

## 5. Files touched

| File | Change |
|---|---|
| `packages/core/src/hearts.ts` | add `msUntilNextHeart` |
| `packages/core/src/streak.ts` | add `recordActivityDay` |
| `packages/core/src/index.ts` | export both |
| `apps/mobile/src/storage/progressStore.ts` | new — `loadProgress`/`saveProgress` |
| `apps/mobile/src/screens/LessonScreen.tsx` | load/persist wiring, zero-hearts branch |
| `apps/mobile/app/index.tsx` | streak badge |
| `apps/mobile/package.json` | add `@react-native-async-storage/async-storage` |

---

## 6. Testing

- `packages/core`: Vitest cases for `msUntilNextHeart` and
  `recordActivityDay`, alongside the existing `hearts.test.ts` /
  `streak.test.ts`.
- `apps/mobile/src/storage/progressStore.test.ts`: new, against a mocked
  `AsyncStorage` — round-trips the default, round-trips a stored value,
  handles a missing key.
- `LessonScreen.test.tsx`: extend for the zero-hearts branch (session not
  created, "out of hearts" screen shown instead) and for hearts persisting
  after a wrong answer.
- Home screen: a test asserting the streak badge renders when
  `activityDays` produces `N > 0` and doesn't when it doesn't.
