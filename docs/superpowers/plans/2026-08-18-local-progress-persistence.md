# Local Progress Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hearts and streak survive an app restart, by wiring the existing pure `currentHearts`/`streakLength` functions to on-device storage instead of the hardcoded `{ hearts: 5, maxHearts: 5 }` `LessonScreen.tsx` uses today.

**Architecture:** A new `apps/mobile/src/storage/progressStore.ts` module wraps `@react-native-async-storage/async-storage` behind `loadProgress()`/`saveProgress()`, storing one versioned JSON blob (`{ hearts: { count, updatedAt }, activityDays: [] }`). Two new pure functions land in `packages/core` (`msUntilNextHeart`, `recordActivityDay`), tested the same way as the functions already there. `LessonScreen.tsx` and `app/index.tsx` are the only consumers of the storage module — `packages/core` never touches it.

**Tech Stack:** React Native / Expo 57, TypeScript, Vitest (`packages/core`), Jest + `@testing-library/react-native` (`apps/mobile`), `@react-native-async-storage/async-storage`.

**Spec:** `docs/superpowers/specs/2026-08-18-local-progress-persistence-design.md`

## Global Constraints

- `packages/core` must not import React, React Native, or Expo — enforced by an eslint rule. All storage I/O lives in `apps/mobile`.
- Never store a streak counter. Store the set of activity days; derive the length via `streakLength`.
- Only a `wrong` verdict costs a heart (unchanged — `session.ts` already enforces this; this plan only persists the result).
- Storage key is versioned: `@sanskritify/progress/v1`.
- **Correction from the spec doc:** the spec's `StoredProgress.hearts.updatedAt` is typed `string` (ISO 8601). The actual `currentHearts`/`streakLength` signatures in `packages/core/src/hearts.ts` take `updatedAt`/`now` as **numbers** (epoch ms) — confirmed by reading the file while planning. This plan stores `updatedAt` as a `number` throughout, to match the existing, tested functions exactly rather than convert at every call site. Same field name, same intent, corrected type.
- **Correction from the spec doc:** the spec's file table lists `packages/core/src/index.ts` as touched ("export both"). It needs no change — `index.ts` already does `export * from './hearts'` and `export * from './streak'`, so `msUntilNextHeart` and `recordActivityDay` are re-exported automatically once added to their source files. No task below touches `index.ts`.

---

## Task 1: `msUntilNextHeart` in `packages/core`

**Files:**
- Modify: `packages/core/src/hearts.ts`
- Test: `packages/core/src/hearts.test.ts`

**Interfaces:**
- Consumes: nothing new — `HEART_REGEN_MS` (existing export, `1_800_000`).
- Produces: `msUntilNextHeart(stored: number, updatedAt: number, now: number, max: number): number` — ms remaining until the next heart regenerates; `0` once at `max`. Same validation as `currentHearts` (throws on non-finite `stored`/`updatedAt`/`now`, or non-integer/negative `max`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/hearts.test.ts` (inside the existing `describe('currentHearts', ...)` block's file, as a sibling `describe`):

```ts
describe('msUntilNextHeart', () => {
  it('is zero once at the maximum', () => {
    expect(msUntilNextHeart(5, T0, T0, 5)).toBe(0);
  });

  it('is zero when stored is already above the maximum', () => {
    expect(msUntilNextHeart(9, T0, T0, 5)).toBe(0);
  });

  it('is a full interval right after the last update', () => {
    expect(msUntilNextHeart(3, T0, T0, 5)).toBe(HEART_REGEN_MS);
  });

  it('counts down within the current interval', () => {
    expect(msUntilNextHeart(3, T0, T0 + 100, 5)).toBe(HEART_REGEN_MS - 100);
  });

  it('is zero the instant regen catches up to the maximum', () => {
    // stored=3, max=5: two intervals of elapsed time regenerate exactly to 5.
    expect(msUntilNextHeart(3, T0, T0 + HEART_REGEN_MS * 2, 5)).toBe(0);
  });

  it('resets to a full interval just after a heart regenerates', () => {
    expect(msUntilNextHeart(3, T0, T0 + HEART_REGEN_MS + 1, 5)).toBe(HEART_REGEN_MS - 1);
  });

  it('treats a backwards clock as no elapsed time', () => {
    expect(msUntilNextHeart(2, T0, T0 - HEART_REGEN_MS * 10, 5)).toBe(HEART_REGEN_MS);
  });

  it.each([
    ['stored', () => msUntilNextHeart(NaN, T0, T0, 5)],
    ['updatedAt', () => msUntilNextHeart(3, NaN, T0, 5)],
    ['now', () => msUntilNextHeart(3, T0, NaN, 5)],
  ])('throws for a non-finite %s', (_label, call) => {
    expect(call).toThrow();
  });

  it.each([[-1], [2.5], [NaN]])('throws for max = %p', (max) => {
    expect(() => msUntilNextHeart(3, T0, T0, max)).toThrow();
  });
});
```

Update the import line at the top of the file to include the new function:

```ts
import { currentHearts, msUntilNextHeart, HEART_REGEN_MS } from './hearts';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sanskritify/core test`
Expected: FAIL — `msUntilNextHeart is not defined` / not exported.

- [ ] **Step 3: Implement, sharing validation with `currentHearts`**

Replace the full contents of `packages/core/src/hearts.ts` with:

```ts
export const HEART_REGEN_MS = 1_800_000; // 30 minutes

function validateHeartInputs(stored: number, updatedAt: number, now: number, max: number): void {
  // NaN would pass straight through every comparison below and surface as a
  // heart count that is neither above nor below anything. Refuse it here.
  if (!Number.isFinite(stored)) throw new Error(`stored must be a finite number, got ${stored}`);
  if (!Number.isFinite(updatedAt)) throw new Error(`updatedAt must be a finite number, got ${updatedAt}`);
  if (!Number.isFinite(now)) throw new Error(`now must be a finite number, got ${now}`);
  if (!Number.isInteger(max) || max < 0) throw new Error(`max must be a non-negative integer, got ${max}`);
}

// A backwards clock yields negative elapsed time. Children do change the
// device clock; treating it as zero is enough while there is no shop.
function elapsedSince(updatedAt: number, now: number): number {
  return Math.max(0, now - updatedAt);
}

export function currentHearts(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  validateHeartInputs(stored, updatedAt, now, max);
  const regenerated = Math.floor(elapsedSince(updatedAt, now) / HEART_REGEN_MS);

  // Clamped at both ends. A corrupt negative stored value must not reach the
  // UI, and createSession throws below one heart.
  return Math.min(max, Math.max(0, stored + regenerated));
}

// Time remaining until the next heart lands, for an "out of hearts" screen.
// Zero once regen has already reached the maximum — nothing left to wait for.
export function msUntilNextHeart(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  validateHeartInputs(stored, updatedAt, now, max);
  if (currentHearts(stored, updatedAt, now, max) >= max) return 0;
  const elapsed = elapsedSince(updatedAt, now);
  return HEART_REGEN_MS - (elapsed % HEART_REGEN_MS);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/core test`
Expected: PASS, all `currentHearts` and `msUntilNextHeart` cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hearts.ts packages/core/src/hearts.test.ts
git commit -m "Add msUntilNextHeart for an out-of-hearts screen"
```

---

## Task 2: `recordActivityDay` in `packages/core`

**Files:**
- Modify: `packages/core/src/streak.ts`
- Test: `packages/core/src/streak.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `recordActivityDay(activityDays: string[], day: string): string[]` — appends `day` (format `YYYY-MM-DD`) if absent; returns the same array reference, unchanged, if `day` is already present (so callers can skip persisting with `next !== prev`). Throws on a malformed `day`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/streak.test.ts`, as a sibling `describe` to the existing `describe('streakLength', ...)`:

```ts
describe('recordActivityDay', () => {
  it('appends a new day', () => {
    expect(recordActivityDay(['2026-08-15'], '2026-08-16')).toEqual(['2026-08-15', '2026-08-16']);
  });

  it('starts a list from empty', () => {
    expect(recordActivityDay([], '2026-08-16')).toEqual(['2026-08-16']);
  });

  // The caller uses reference equality to decide whether to persist —
  // recording a day already present must be a no-op, not a same-value copy.
  it('returns the same array reference when the day is already recorded', () => {
    const days = ['2026-08-15', '2026-08-16'];
    expect(recordActivityDay(days, '2026-08-16')).toBe(days);
  });

  it('throws for a malformed day', () => {
    expect(() => recordActivityDay([], 'nonsense')).toThrow();
  });

  it('names the offending value in the error', () => {
    expect(() => recordActivityDay([], '2026-08-32')).toThrow(/2026-08-32/);
  });
});
```

Update the import line at the top of the file:

```ts
import { streakLength, recordActivityDay } from './streak';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sanskritify/core test`
Expected: FAIL — `recordActivityDay is not defined` / not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/streak.ts`, add after `streakLength`. **Correction found during execution:** the plan's first draft validated with the `ISO_DAY` regex alone, but that only checks the `YYYY-MM-DD` shape — `2026-08-32` matches it despite not being a real date. `toUtcDay` (already in this file, not exported) does the full calendar round-trip check `streakLength` relies on for the same reason; reuse it instead of re-validating with the regex, or `recordActivityDay('2026-08-32')` silently accepts a corrupt day:

```ts
// Dedupe/insert only — no sort. streakLength consumes this as a Set and
// doesn't care about order, and neither does anything else that reads it.
export function recordActivityDay(activityDays: string[], day: string): string[] {
  // toUtcDay does full calendar validation (not just the YYYY-MM-DD shape,
  // which 2026-08-32 also matches) and throws with `day` in the message.
  // Its numeric result isn't needed here — recordActivityDay stores strings,
  // same as toUtcDay's caller streakLength does.
  toUtcDay(day);
  if (activityDays.includes(day)) return activityDays;
  return [...activityDays, day];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/core test`
Expected: PASS, all `streakLength` and `recordActivityDay` cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/streak.ts packages/core/src/streak.test.ts
git commit -m "Add recordActivityDay to record engagement toward a streak"
```

---

## Task 3: `progressStore` — on-device persistence

**Files:**
- Create: `apps/mobile/src/storage/progressStore.ts`
- Create: `apps/mobile/jest.setup.js`
- Test: `apps/mobile/src/storage/progressStore.test.ts`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface StoredProgress { hearts: { count: number; updatedAt: number }; activityDays: string[] }`
  - `MAX_HEARTS: number` (`5`) — single source of truth for the app's heart cap, imported by Task 4.
  - `loadProgress(): Promise<StoredProgress>` — returns the default (`{ hearts: { count: MAX_HEARTS, updatedAt: Date.now() }, activityDays: [] }`) when nothing is stored yet.
  - `saveProgress(progress: StoredProgress): Promise<void>`

- [ ] **Step 1: Add the dependency and the Jest mock**

Run from `apps/mobile`:

```bash
cd apps/mobile
npx expo install @react-native-async-storage/async-storage
```

This resolves the version Expo 57 expects (`2.2.0`, confirmed while writing this plan) and writes it into `apps/mobile/package.json`'s `dependencies`.

The package ships a Jest mock at `@react-native-async-storage/async-storage/jest/async-storage-mock`, but **that file only exports the mock object — it does not register itself**. Pointing `setupFiles` directly at it (a plausible-looking config that several older guides show) silently does nothing: `import AsyncStorage from '@react-native-async-storage/async-storage'` still resolves to the real native module and throws `NativeModule: AsyncStorage is null` under Jest. Confirmed by trying exactly that during planning. The mock has to be wired in with `jest.mock()`.

Create `apps/mobile/jest.setup.js`:

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
```

Edit `apps/mobile/package.json`'s `"jest"` block (currently `{ "preset": "jest-expo" }`, around line 40) to load it:

```json
  "jest": {
    "preset": "jest-expo",
    "setupFiles": [
      "./jest.setup.js"
    ]
  }
```

`jest-expo`'s preset pushes its own `setupFiles` entry internally (`jest-expo/src/preset/setup.js`); confirmed while planning that Jest concatenates a project's `setupFiles` with the preset's rather than replacing them, so this addition doesn't drop anything jest-expo needs.

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/storage/progressStore.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProgress, saveProgress, MAX_HEARTS, type StoredProgress } from './progressStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('progressStore', () => {
  it('returns a default value when nothing is stored', async () => {
    const progress = await loadProgress();
    expect(progress.activityDays).toEqual([]);
    expect(progress.hearts.count).toBe(MAX_HEARTS);
    expect(typeof progress.hearts.updatedAt).toBe('number');
  });

  it('round-trips a saved value', async () => {
    const saved: StoredProgress = {
      hearts: { count: 3, updatedAt: 1_700_000_000_000 },
      activityDays: ['2026-08-15', '2026-08-16'],
    };
    await saveProgress(saved);
    expect(await loadProgress()).toEqual(saved);
  });

  it('persists across separate load calls', async () => {
    await saveProgress({ hearts: { count: 2, updatedAt: 1_700_000_000_000 }, activityDays: [] });
    const first = await loadProgress();
    const second = await loadProgress();
    expect(first).toEqual(second);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/mobile test -- progressStore`
Expected: FAIL — cannot find module `./progressStore`.

- [ ] **Step 4: Implement**

Create `apps/mobile/src/storage/progressStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sanskritify/progress/v1';
export const MAX_HEARTS = 5;

export interface StoredProgress {
  hearts: { count: number; updatedAt: number };
  activityDays: string[];
}

function defaultProgress(): StoredProgress {
  return { hearts: { count: MAX_HEARTS, updatedAt: Date.now() }, activityDays: [] };
}

export async function loadProgress(): Promise<StoredProgress> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return defaultProgress();
  return JSON.parse(raw) as StoredProgress;
}

export async function saveProgress(progress: StoredProgress): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/mobile test -- progressStore`
Expected: PASS, all three cases.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/jest.setup.js apps/mobile/src/storage/progressStore.ts apps/mobile/src/storage/progressStore.test.ts pnpm-lock.yaml
git commit -m "Add on-device progress storage"
```

(`pnpm-lock.yaml`, at the repo root, is what `expo install` in Step 1 updates — it belongs in this commit alongside the dependency it locks.)

---

## Task 4: Wire hearts into `LessonScreen`

**Files:**
- Modify: `apps/mobile/src/screens/LessonScreen.tsx`
- Test: `apps/mobile/src/screens/LessonScreen.test.tsx`

**Interfaces:**
- Consumes: `currentHearts`, `msUntilNextHeart` (Task 1, re-exported from `@sanskritify/core`'s barrel); `loadProgress`, `saveProgress`, `MAX_HEARTS`, `StoredProgress` (Task 3, from `../storage/progressStore`).
- Produces: no new exports — internal wiring only. Adds `testID="hearts-wait"` to the new out-of-hearts screen.

- [ ] **Step 1: Add test isolation and the failing tests**

At the top of `apps/mobile/src/screens/LessonScreen.test.tsx`, add the import and a `beforeEach` (the mocked `AsyncStorage` persists across tests in the same file otherwise, since Task 3's tests proved it's a real in-memory store):

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProgress, saveProgress } from '../storage/progressStore';
```

```ts
beforeEach(async () => {
  await AsyncStorage.clear();
});
```

Add two new tests inside `describe('LessonScreen', ...)`:

```ts
it('shows an out-of-hearts screen and does not start a session when hearts are exhausted', async () => {
  await saveProgress({ hearts: { count: 0, updatedAt: Date.now() }, activityDays: [] });
  const { getByTestId, queryByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
  expect(getByTestId('hearts-wait')).toBeTruthy();
  expect(queryByTestId('check')).toBeNull();
});

it('persists hearts to storage after a wrong answer', async () => {
  const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
  await playSelect(getByTestId, 'आ'); // wrong; target is अ
  expect(getByTestId('hearts').props.children).toContain('4');
  const stored = await loadProgress();
  expect(stored.hearts.count).toBe(4);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm --filter @sanskritify/mobile test -- LessonScreen`
Expected: the two new tests FAIL (no `hearts-wait` testID exists; hearts never persisted). The nine existing tests should still PASS at this point — they don't yet depend on anything this task changes.

- [ ] **Step 3: Implement — load progress, gate on hearts, persist on loss**

In `apps/mobile/src/screens/LessonScreen.tsx`:

Change the top imports from:

```ts
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  createSession, currentExercise, submitAnswer,
  type Answer, type GradeContext, type GradeResult, type SessionState,
} from '@sanskritify/core';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from '../components/AksharaComposer';
import { MatchPairs } from '../components/MatchPairs';
import { loadLesson, loadLexemes } from '../content/loadLesson';
```

to:

```ts
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  createSession, currentExercise, currentHearts, msUntilNextHeart, submitAnswer,
  type Answer, type GradeContext, type GradeResult, type SessionState,
} from '@sanskritify/core';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from '../components/AksharaComposer';
import { MatchPairs } from '../components/MatchPairs';
import { loadLesson, loadLexemes } from '../content/loadLesson';
import { loadProgress, saveProgress, MAX_HEARTS, type StoredProgress } from '../storage/progressStore';
```

Replace the `[session, setSession]` line and everything through the `useEffect` that clears the draft (currently lines 30–48) with:

```ts
  const [progress, setProgress] = useState<StoredProgress | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [heartsWaitMs, setHeartsWaitMs] = useState<number | null>(null);
  const [draft, setDraft] = useState<Answer | null>(null);
  const [akshara, setAkshara] = useState<Akshara>(EMPTY_AKSHARA);
  const [result, setResult] = useState<GradeResult | null>(null);

  // A fresh mount is a fresh lesson attempt, so this also re-checks hearts
  // if the learner backs out and returns after regen time has passed.
  useEffect(() => {
    let cancelled = false;
    loadProgress().then((stored) => {
      if (cancelled) return;
      const now = Date.now();
      const live = currentHearts(stored.hearts.count, stored.hearts.updatedAt, now, MAX_HEARTS);
      setProgress(stored);
      if (live <= 0) {
        setHeartsWaitMs(msUntilNextHeart(stored.hearts.count, stored.hearts.updatedAt, now, MAX_HEARTS));
        return;
      }
      setSession(createSession(lesson, { hearts: live, maxHearts: MAX_HEARTS }));
    });
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  const exercise = session === null ? null : currentExercise(session);

  // The draft answer must start empty for a new exercise. `result` is
  // deliberately NOT reset here: submitAnswer() advances session.index for
  // every verdict, including near-miss, so the exercise always changes in
  // the very same update that produces a near-miss's result. Clearing result
  // on that transition would erase the hint before it was ever shown — it
  // clears instead the moment the learner starts answering again, below.
  useEffect(() => {
    setDraft(null);
    setAkshara(EMPTY_AKSHARA);
  }, [exercise?.id]);
```

Replace the `check()` function:

```ts
  function check(): void {
    // A tap on Check before an answer exists is a mis-tap, not a wrong
    // answer. Grading an empty choice would cost a heart for it.
    if (session === null || progress === null || exercise === null || !hasAnswer) return;
    const answer: Answer =
      exercise.type === 'akshara-build' ? { kind: 'akshara', akshara } : draft!;
    const next = submitAnswer(session, answer, ctx);
    setSession(next.state);
    setResult(next.result);

    // Only a real change needs writing back. Regen-only growth (hearts.ts's
    // currentHearts) is always re-derivable from the original stored
    // snapshot plus elapsed time, so it's never worth a write; a loss is not
    // derivable from anything and must be persisted before the app can be
    // killed out from under it.
    if (next.state.hearts < session.hearts) {
      const nextProgress: StoredProgress = {
        ...progress,
        hearts: { count: next.state.hearts, updatedAt: Date.now() },
      };
      setProgress(nextProgress);
      void saveProgress(nextProgress);
    }
  }
```

Add the out-of-hearts render branch just above the existing `if (exercise === null || session.status !== 'in_progress')` branch:

```ts
  if (session === null) {
    if (heartsWaitMs !== null) {
      const minutes = Math.ceil(heartsWaitMs / 60_000);
      return (
        <View style={styles.screen}>
          <Text style={styles.big}>{locale === 'hi' ? 'हृदयानि समाप्तानि' : 'Out of hearts'}</Text>
          <Text testID="hearts-wait">
            {locale === 'hi' ? `${minutes} मिनटों में अगला हृदय` : `Next heart in ${minutes} min`}
          </Text>
        </View>
      );
    }
    return <View style={styles.screen} />;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/mobile test -- LessonScreen`
Expected: PASS — all 9 original tests plus the 2 new ones.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sanskritify/mobile typecheck`
Expected: no errors. (`session` and `progress` are narrowed to non-null within `check()` by the early-return guard; `exercise` stays `Exercise | null` throughout, matching its existing usage below.)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/LessonScreen.tsx apps/mobile/src/screens/LessonScreen.test.tsx
git commit -m "Persist hearts across restarts and gate lessons when exhausted"
```

---

## Task 5: Wire streak into `LessonScreen`

**Files:**
- Modify: `apps/mobile/src/screens/LessonScreen.tsx`
- Test: `apps/mobile/src/screens/LessonScreen.test.tsx`

**Interfaces:**
- Consumes: `recordActivityDay` (Task 2, from `@sanskritify/core`); `progress`/`setProgress`/`saveProgress` wiring already in place from Task 4.
- Produces: nothing new externally — internal wiring only.

- [ ] **Step 1: Write the failing tests**

Add to `apps/mobile/src/screens/LessonScreen.test.tsx`, inside `describe('LessonScreen', ...)`:

```ts
it('records today as an activity day on the first answer', async () => {
  const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
  await playSelect(getByTestId, 'अ');
  const stored = await loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  expect(stored.activityDays).toContain(today);
});

it('records the activity day only once per session', async () => {
  const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
  await playSelect(getByTestId, 'अ');
  await playSelect(getByTestId, 'आ');
  const stored = await loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  expect(stored.activityDays.filter((d) => d === today)).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sanskritify/mobile test -- LessonScreen`
Expected: FAIL — `activityDays` stays `[]`.

- [ ] **Step 3: Implement**

In `apps/mobile/src/screens/LessonScreen.tsx`, add `recordActivityDay` to the `@sanskritify/core` import (from Task 4's edit):

```ts
import {
  createSession, currentExercise, currentHearts, msUntilNextHeart, recordActivityDay, submitAnswer,
  type Answer, type GradeContext, type GradeResult, type SessionState,
} from '@sanskritify/core';
```

Add `useRef` to the React import:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

Add the ref alongside the other state declarations (after `const [result, setResult] = useState<GradeResult | null>(null);`):

```ts
  // Recorded once per mount: the first answer, right or wrong, means the
  // learner engaged today. Gating this on lesson completion would erase a
  // hard day that ended in a fail.
  const recordedActivity = useRef(false);
```

Task 4 left `check()` ending with a comment and an `if` block that persists hearts alone. Replace the **entire `check()` function** with the version below, which folds in activity-day recording so a hearts change and an activity-day change land in a single write instead of two. (Shown in full, not as a delta, since the exact brace to anchor a partial replacement on is easy to get wrong — the executor should not need to reload Task 4's text to find it.)

```ts
  function check(): void {
    // A tap on Check before an answer exists is a mis-tap, not a wrong
    // answer. Grading an empty choice would cost a heart for it.
    if (session === null || progress === null || exercise === null || !hasAnswer) return;
    const answer: Answer =
      exercise.type === 'akshara-build' ? { kind: 'akshara', akshara } : draft!;
    const next = submitAnswer(session, answer, ctx);
    setSession(next.state);
    setResult(next.result);

    // Only a real change needs writing back. Regen-only growth (hearts.ts's
    // currentHearts) is always re-derivable from the original stored
    // snapshot plus elapsed time, so it's never worth a write; a loss is not
    // derivable from anything and must be persisted before the app can be
    // killed out from under it. Same reasoning for the activity day: once
    // today is recorded there's nothing new to write.
    let nextProgress = progress;
    if (next.state.hearts < session.hearts) {
      nextProgress = { ...nextProgress, hearts: { count: next.state.hearts, updatedAt: Date.now() } };
    }
    if (!recordedActivity.current) {
      recordedActivity.current = true;
      const today = new Date().toISOString().slice(0, 10);
      const activityDays = recordActivityDay(nextProgress.activityDays, today);
      if (activityDays !== nextProgress.activityDays) {
        nextProgress = { ...nextProgress, activityDays };
      }
    }
    if (nextProgress !== progress) {
      setProgress(nextProgress);
      void saveProgress(nextProgress);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/mobile test -- LessonScreen`
Expected: PASS — all 13 tests (9 original + 2 from Task 4 + 2 new).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sanskritify/mobile typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/LessonScreen.tsx apps/mobile/src/screens/LessonScreen.test.tsx
git commit -m "Record today's activity day toward the streak"
```

---

## Task 6: Streak badge on the home screen

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Test: `apps/mobile/src/screens/Home.test.tsx` (new)

**Interfaces:**
- Consumes: `streakLength` (`@sanskritify/core`, existing export); `loadProgress` (Task 3).
- Produces: `testID="streak"` on the badge `Text`, rendered only when the streak is `> 0`.

**Bug found during manual verification, not caught by the test suite:** the test must NOT live inside `apps/mobile/app/` alongside `index.tsx`, even though every other test in this codebase is co-located with the file it tests. `app/` is expo-router's route directory — every file under it (matching a route extension) is picked up as a route and bundled into the actual running app, test files included. With `index.test.tsx` sitting there, the real app crashed on load with `Uncaught Error: expect is not defined`, because `describe`/`it`/`expect` are Jest globals that don't exist at runtime. `jest`'s test runner doesn't care where the file lives and passes either way, so nothing short of actually running the app catches this — confirmed by running `pnpm --filter @sanskritify/mobile test` clean, then loading the real app and hitting the crash. Fixed by putting the test in `src/screens/` instead, matching where `LessonScreen.test.tsx` already lives, importing `Home` from `'../../app/index'`.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/screens/Home.test.tsx`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import Home from '../../app/index';
import { saveProgress } from '../storage/progressStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Home', () => {
  it('shows no streak badge on a fresh install', async () => {
    const { queryByTestId } = await render(<Home />);
    expect(queryByTestId('streak')).toBeNull();
  });

  it('shows the streak badge once activity is recorded', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await saveProgress({ hearts: { count: 5, updatedAt: Date.now() }, activityDays: [today] });
    const { getByTestId } = await render(<Home />);
    expect(getByTestId('streak').props.children).toContain('1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sanskritify/mobile test -- Home.test`
Expected: FAIL — no `testID="streak"` exists.

- [ ] **Step 3: Implement**

Replace the full contents of `apps/mobile/app/index.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { isConsonant } from '@sanskritify/sanskrit';
import { streakLength } from '@sanskritify/core';
import { loadProgress } from '../src/storage/progressStore';

// These five conjuncts are the ones that most often fall back to a visible
// virama on a system font. If they render as ligatures here, the bundled
// font is working.
const CONJUNCTS = ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व'];

export default function Home() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((progress) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      setStreak(streakLength(progress.activityDays, today));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>संस्कृतम्</Text>
      {/* Zero reads as a failure state on a fresh install, not a feature —
          so the badge only appears once there's something to show. */}
      {streak > 0 && <Text testID="streak">{`🔥 ${streak}`}</Text>}
      <Text style={styles.conjuncts}>{CONJUNCTS.join('  ')}</Text>
      {/* Proves the Metro config actually resolves a workspace package, not
          just that the file compiles under tsc. */}
      <Text testID="sanskrit-import-check" style={{ opacity: 0 }}>
        {isConsonant('क') ? 'ok' : 'fail'}
      </Text>
      <Link href="/lesson/les.ch01.u1.l1" style={styles.link}>
        पाठं आरभस्व
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  title: { fontFamily: 'NotoDeva-Bold', fontSize: 40 },
  conjuncts: { fontFamily: 'NotoDeva', fontSize: 32 },
  link: { fontFamily: 'NotoDeva', fontSize: 20, color: '#1a7f37' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/mobile test -- Home.test`
Expected: PASS, both cases.

- [ ] **Step 5: Typecheck, full test suite, and a real run**

Run: `pnpm --filter @sanskritify/mobile typecheck`
Run: `pnpm --filter @sanskritify/mobile test`
Run: `pnpm --filter @sanskritify/core test`
Expected: everything passes.

This is the last task in the slice, and the test suite passing is not sufficient proof by itself — Task 6's own bug (a route-directory test file crashing the real app while every automated check stayed green) is exactly why. Actually run the app: `pnpm --filter @sanskritify/mobile web`, open it, confirm the home screen loads with no console errors, play the lesson to a wrong answer, reload, confirm hearts stayed at the lower count, return to the home screen, confirm the 🔥 badge shows.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/index.tsx apps/mobile/src/screens/Home.test.tsx
git commit -m "Show a streak badge on the home screen"
```

---

## After this plan

Remaining slices of the parent spec's build-order step 4 (lesson path/unit progression, review scheduling, daily goal, achievements) are out of scope here and get their own spec + plan, per `docs/superpowers/specs/2026-08-18-local-progress-persistence-design.md` §1.
