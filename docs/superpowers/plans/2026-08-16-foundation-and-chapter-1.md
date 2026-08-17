# Sanskritify Foundation and Chapter 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Class 6 student can open the app and play a real chapter-1 lesson built from verified दीपकम् content, answering with the अक्षर composer, with hearts and XP working.

**Architecture:** pnpm + Turborepo monorepo. Devanagari logic (`packages/sanskrit`) and the lesson engine (`packages/core`) are pure TypeScript with no React Native imports, so they test under Vitest in milliseconds. Content is authored as JSON, validated by Zod, and built into a versioned pack by a CLI. The Expo app is a thin renderer over engine state.

**Tech Stack:** TypeScript 5.x strict, pnpm workspaces, Turborepo, Vitest, Zod, Expo SDK 54, expo-router, Reanimated, Noto Sans Devanagari.

**Spec:** `docs/superpowers/specs/2026-08-15-sanskritify-design.md`

## Global Constraints

**Read these three before writing code. They apply to every task.**

- `CLAUDE.md` — the non-negotiable rules, and why each one exists.
- `docs/ENGINEERING.md` — TypeScript, file boundaries, tests, errors, naming, commits.
- `docs/STYLE-GUIDE.md` — prose style for all docs, commit bodies, and comments.

The four that get violated most often, repeated here so they're unmissable:
pure packages import no platform APIs (pass `now` in, don't call `Date.now()`);
watch every test fail before implementing it; comment why, never what; no AI
attribution in commits.

- TypeScript `strict: true` in every package. No `any` without a comment justifying it.
- `packages/core` and `packages/sanskrit` MUST NOT import from `react`, `react-native`, or `expo`. Enforced by lint rule in Task 1.
- Expo SDK 54, React Native New Architecture enabled.
- Bundled font: Noto Sans Devanagari. Never rely on system Devanagari for conjunct rendering.
- Locales shipped: `hi` and `en`. Fallback chain: requested → `hi` → `en`.
- Hearts: max 5, one regenerates every 30 minutes (1800000 ms).
- XP: 10 per lesson, +5 if the lesson had zero `wrong` verdicts, 20 for a chapter test.
- Verdicts: `correct`, `near-miss`, `wrong`. **Only `wrong` costs a heart.** `near-miss` means the consonant sequence is correct and only the matra or virama differs.
- A wrong or near-miss exercise re-queues later in the same session, at most twice.
- Streak is derived from a set of activity dates. Never store a streak counter.
- Review intervals, for later use: 1d, 3d, 7d, 16d, 35d, 90d.
- Commit messages: what changed and why. No AI, tool, or generation attribution of any kind.
- Prose in docs and comments follows `docs/STYLE-GUIDE.md`.

## Out of scope for this plan

Backend, Supabase, auth, sync, DPDP flows (spec §8). Review scheduling (spec §6.3). Path and progression UI (spec §6.2). Audio recording and playback (spec §4.5). Chapters 3–16. Exercise types other than `akshara-select`, `akshara-build`, `match-pairs` — the schema defines all of them, but only these three get renderers and grading here.

## File structure

```
packages/sanskrit/src/
  chars.ts        character classification and Unicode constants
  normalize.ts    normalisation for answer comparison
  akshara.ts      segmentation, parsing, composition, diffing
  index.ts        public exports
packages/content/src/
  schema.ts       Zod schemas for all content records
  index.ts        public exports
  data/ch01/      verified chapter 1 JSON
packages/core/src/
  types.ts        Answer, Verdict, GradeResult, SessionState
  grading.ts      gradeAnswer
  session.ts      createSession, submitAnswer
  hearts.ts       currentHearts
  streak.ts       streakLength
  index.ts        public exports
tools/content-cli/src/
  extract.ts      pdftotext wrapper
  lint-raw.ts     four corruption-signature rules
  lint-content.ts referential integrity checks
  build.ts        validate and emit versioned pack
  cli.ts          command dispatch
apps/mobile/
  app/            expo-router routes
  src/components/AksharaComposer.tsx
  src/components/MatchPairs.tsx
  src/screens/LessonScreen.tsx
```

---

### Task 1: Monorepo skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `vitest.workspace.ts`
- Create: `packages/sanskrit/package.json`, `packages/sanskrit/tsconfig.json`, `packages/sanskrit/src/index.ts`
- Test: `packages/sanskrit/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: workspace commands `pnpm test`, `pnpm typecheck`, `pnpm lint`. Package name convention `@sanskritify/<name>`.

- [ ] **Step 1: Create the workspace root**

`package.json`:
```json
{
  "name": "sanskritify",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 2: Add the purity lint rule**

This enforces the spec's core boundary: `packages/core` and `packages/sanskrit` must never import React Native.

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['packages/core/**/*.ts', 'packages/sanskrit/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['react', 'react-native', 'react-native/*', 'expo', 'expo-*'],
        }],
      },
    },
  ],
};
```

- [ ] **Step 3: Create the sanskrit package**

`packages/sanskrit/package.json`:
```json
{
  "name": "@sanskritify/sanskrit",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

`packages/sanskrit/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/sanskrit/src/index.ts`:
```ts
export const PACKAGE_NAME = '@sanskritify/sanskrit';
```

`vitest.workspace.ts` at root:
```ts
export default ['packages/*', 'tools/*'];
```

- [ ] **Step 4: Write a smoke test**

`packages/sanskrit/src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('workspace', () => {
  it('resolves package exports', () => {
    expect(PACKAGE_NAME).toBe('@sanskritify/sanskrit');
  });
});
```

- [ ] **Step 5: Verify the toolchain**

Run: `pnpm install && pnpm test && pnpm typecheck && pnpm lint`
Expected: all three pass, one test passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Set up pnpm and Turborepo workspace

TypeScript strict everywhere. An eslint rule blocks React Native imports
from packages/core and packages/sanskrit so the engine stays testable
without a simulator."
```

---

### Task 2: Devanagari character classification

**Files:**
- Create: `packages/sanskrit/src/chars.ts`
- Test: `packages/sanskrit/src/chars.test.ts`
- Modify: `packages/sanskrit/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export const VIRAMA: '्';
  export const ZWJ: '‍';
  export const ZWNJ: '‌';
  export const ANUSVARA: 'ं';
  export const AVAGRAHA: 'ऽ';
  export const DANDA: '।';
  export function isConsonant(ch: string): boolean;
  export function isMatra(ch: string): boolean;
  export function isIndependentVowel(ch: string): boolean;
  export function isVirama(ch: string): boolean;
  ```

- [ ] **Step 1: Write the failing test**

`packages/sanskrit/src/chars.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isConsonant, isMatra, isIndependentVowel, isVirama, VIRAMA } from './chars';

describe('isConsonant', () => {
  it.each(['क', 'ख', 'ष', 'ह', 'ळ'])('accepts %s', (ch) => {
    expect(isConsonant(ch)).toBe(true);
  });
  it.each(['अ', 'ा', VIRAMA, '१', 'a'])('rejects %s', (ch) => {
    expect(isConsonant(ch)).toBe(false);
  });
});

describe('isMatra', () => {
  it.each(['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ृ'])('accepts %s', (ch) => {
    expect(isMatra(ch)).toBe(true);
  });
  it.each(['क', 'अ', VIRAMA])('rejects %s', (ch) => {
    expect(isMatra(ch)).toBe(false);
  });
});

describe('isIndependentVowel', () => {
  it.each(['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ऌ', 'ए', 'ऐ', 'ओ', 'औ'])('accepts %s', (ch) => {
    expect(isIndependentVowel(ch)).toBe(true);
  });
  it.each(['क', 'ा'])('rejects %s', (ch) => {
    expect(isIndependentVowel(ch)).toBe(false);
  });
});

describe('isVirama', () => {
  it('accepts the virama', () => expect(isVirama(VIRAMA)).toBe(true));
  it('rejects a consonant', () => expect(isVirama('क')).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/sanskrit test`
Expected: FAIL, `Cannot find module './chars'`.

- [ ] **Step 3: Write minimal implementation**

`packages/sanskrit/src/chars.ts`:
```ts
export const VIRAMA = '्';
export const ZWJ = '‍';
export const ZWNJ = '‌';
export const ANUSVARA = 'ं';
export const AVAGRAHA = 'ऽ';
export const DANDA = '।';

// Devanagari block ranges. Consonants क (0915) through ह (0939), plus the
// nukta-composed forms क़ (0958) through य़ (095F) and ळ (0933) which is
// already inside the main range.
const CONSONANT = /^[क-हक़-य़ॹ-ॿ]$/u;
const MATRA = /^[ऺ-ौॎ-ॏॕ-ॗॢ-ॣ]$/u;
const INDEPENDENT_VOWEL = /^[ऄ-औॠ-ॡॲ-ॷ]$/u;

export function isConsonant(ch: string): boolean {
  return CONSONANT.test(ch);
}

export function isMatra(ch: string): boolean {
  return MATRA.test(ch);
}

export function isIndependentVowel(ch: string): boolean {
  return INDEPENDENT_VOWEL.test(ch);
}

export function isVirama(ch: string): boolean {
  return ch === VIRAMA;
}
```

Then re-export from `packages/sanskrit/src/index.ts`:
```ts
export * from './chars';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/sanskrit test`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/sanskrit
git commit -m "Add Devanagari character classification

Ranges cover the main consonant block plus nukta forms, which appear in
loanwords the textbook uses. Matra range deliberately excludes the virama
so callers must ask for it explicitly."
```

---

### Task 3: Answer normalisation

**Files:**
- Create: `packages/sanskrit/src/normalize.ts`
- Test: `packages/sanskrit/src/normalize.test.ts`
- Modify: `packages/sanskrit/src/index.ts`

**Interfaces:**
- Consumes: `chars.ts` constants from Task 2
- Produces: `export function normalize(text: string): string;`

Normalisation is applied to both sides before comparison. Spec §4.3.

- [ ] **Step 1: Write the failing test**

`packages/sanskrit/src/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';

describe('normalize', () => {
  it('applies NFC', () => {
    // क + nukta as decomposed sequence vs precomposed क़
    expect(normalize('क़')).toBe(normalize('क़'));
  });

  it('strips ZWJ and ZWNJ', () => {
    expect(normalize('सामान्‍याः')).toBe('सामान्याः');
    expect(normalize('क‌ख')).toBe('कख');
  });

  it('treats anusvara and class nasal as equal', () => {
    expect(normalize('अङ्ग')).toBe(normalize('अंग'));
    expect(normalize('सन्धि')).toBe(normalize('संधि'));
  });

  it('ignores avagraha', () => {
    expect(normalize('रामोऽस्ति')).toBe(normalize('रामोस्ति'));
  });

  it('collapses whitespace and drops danda', () => {
    expect(normalize('  रामः   गच्छति ।  ')).toBe(normalize('रामः गच्छति'));
  });

  it('leaves an already-clean string unchanged', () => {
    expect(normalize('बालकः')).toBe('बालकः');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/sanskrit test normalize`
Expected: FAIL, `Cannot find module './normalize'`.

- [ ] **Step 3: Write minimal implementation**

`packages/sanskrit/src/normalize.ts`:
```ts
import { ANUSVARA, AVAGRAHA, DANDA, VIRAMA, ZWJ, ZWNJ } from './chars';

// A class nasal followed by a virama is equivalent to anusvara before the
// same cluster: अङ्ग and अंग are the same word. दीपकम् uses both spellings,
// so grading must accept either. We fold toward anusvara.
const CLASS_NASALS = ['ङ', 'ञ', 'ण', 'न', 'म'];
const CLASS_NASAL_VIRAMA = new RegExp(`[${CLASS_NASALS.join('')}]${VIRAMA}`, 'gu');

export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .split(ZWJ).join('')
    .split(ZWNJ).join('')
    .replace(CLASS_NASAL_VIRAMA, ANUSVARA)
    .split(AVAGRAHA).join('')
    .split(DANDA).join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
```

Re-export from `index.ts`:
```ts
export * from './normalize';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/sanskrit test normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sanskrit
git commit -m "Add answer normalisation for Devanagari comparison

Folds class nasal plus virama to anusvara because दीपकम् spells the same
word both ways, and drops avagraha so a learner is not marked wrong for
writing the un-elided form."
```

---

### Task 4: Akshara segmentation

**Files:**
- Create: `packages/sanskrit/src/akshara.ts`
- Test: `packages/sanskrit/src/akshara.segment.test.ts`
- Modify: `packages/sanskrit/src/index.ts`

**Interfaces:**
- Consumes: `chars.ts` from Task 2
- Produces: `export function segmentAksharas(text: string): string[];`

An akshara is one consonant cluster with its vowel. `क्ष` is four codepoints and one akshara. The content validator and the composer both depend on this agreeing exactly.

- [ ] **Step 1: Write the failing test**

`packages/sanskrit/src/akshara.segment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { segmentAksharas } from './akshara';

describe('segmentAksharas', () => {
  it('splits simple consonant-vowel syllables', () => {
    expect(segmentAksharas('कमल')).toEqual(['क', 'म', 'ल']);
  });

  it('keeps a matra with its consonant', () => {
    expect(segmentAksharas('बाला')).toEqual(['बा', 'ला']);
  });

  it('keeps a conjunct together', () => {
    expect(segmentAksharas('क्ष')).toEqual(['क्ष']);
  });

  it('handles a three-consonant conjunct', () => {
    expect(segmentAksharas('स्त्र')).toEqual(['स्त्र']);
  });

  it('splits a real word from chapter 1', () => {
    expect(segmentAksharas('वर्णमाला')).toEqual(['व', 'र्ण', 'मा', 'ला']);
  });

  it('keeps anusvara and visarga attached', () => {
    expect(segmentAksharas('रामः')).toEqual(['रा', 'मः']);
    expect(segmentAksharas('अंश')).toEqual(['अं', 'श']);
  });

  it('treats an independent vowel as its own akshara', () => {
    expect(segmentAksharas('अजय')).toEqual(['अ', 'ज', 'य']);
  });

  it('returns an empty array for empty input', () => {
    expect(segmentAksharas('')).toEqual([]);
  });
});
```

Note on `वर्णमाला`: `र्ण` is one akshara because the `र` is a half-form joined to `ण` by virama.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/sanskrit test akshara.segment`
Expected: FAIL, `Cannot find module './akshara'`.

- [ ] **Step 3: Write minimal implementation**

`packages/sanskrit/src/akshara.ts`:
```ts
import { isConsonant, isIndependentVowel, isVirama } from './chars';

// Signs that bind to the akshara that precedes them: matras, anusvara,
// candrabindu, visarga, nukta, and the various Vedic marks.
const TRAILING_SIGN = /^[ऀ-ःऺ-ॏ॑-ॗॢ-ॣ]$/u;

export function segmentAksharas(text: string): string[] {
  const chars = [...text];
  const out: string[] = [];
  let current = '';

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;

    if (current === '') {
      current = ch;
      continue;
    }

    const prev = chars[i - 1]!;

    // A virama binds the next consonant into the same cluster.
    if (isVirama(prev) && (isConsonant(ch) || isIndependentVowel(ch))) {
      current += ch;
      continue;
    }

    if (TRAILING_SIGN.test(ch) || isVirama(ch)) {
      current += ch;
      continue;
    }

    out.push(current);
    current = ch;
  }

  if (current !== '') out.push(current);
  return out;
}
```

Re-export from `index.ts`:
```ts
export * from './akshara';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/sanskrit test akshara.segment`
Expected: PASS, 8 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/sanskrit
git commit -m "Add akshara segmentation

Groups a consonant cluster with its vowel so क्ष counts as one unit rather
than four codepoints. Both the composer and the content validator use this,
and they have to agree or the composer accepts answers the validator
rejects."
```

---

### Task 5: Akshara parse, compose, and diff

**Files:**
- Modify: `packages/sanskrit/src/akshara.ts`
- Test: `packages/sanskrit/src/akshara.compose.test.ts`

**Interfaces:**
- Consumes: `segmentAksharas` from Task 4
- Produces:
  ```ts
  export interface AksharaPart { consonant: string; halant: boolean }
  export interface Akshara { parts: AksharaPart[]; matra: string | null }
  export function composeAkshara(a: Akshara): string;
  export function parseAkshara(text: string): Akshara | null;
  export type AksharaDiff =
    | { kind: 'equal' }
    | { kind: 'matra-differs' }
    | { kind: 'consonants-differ' };
  export function diffAkshara(expected: Akshara, actual: Akshara): AksharaDiff;
  ```

The composer holds parts, not a string. `diffAkshara` is what produces the `near-miss` verdict in Task 7.

- [ ] **Step 1: Write the failing test**

`packages/sanskrit/src/akshara.compose.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { composeAkshara, parseAkshara, diffAkshara, type Akshara } from './akshara';

const KSHA: Akshara = {
  parts: [{ consonant: 'क', halant: true }, { consonant: 'ष', halant: false }],
  matra: null,
};

describe('composeAkshara', () => {
  it('joins a conjunct', () => {
    expect(composeAkshara(KSHA)).toBe('क्ष');
  });

  it('appends a matra', () => {
    expect(composeAkshara({ ...KSHA, matra: 'ि' })).toBe('क्षि');
  });

  it('renders a bare consonant', () => {
    expect(composeAkshara({ parts: [{ consonant: 'क', halant: false }], matra: null })).toBe('क');
  });

  it('renders a trailing halant', () => {
    expect(composeAkshara({ parts: [{ consonant: 'त', halant: true }], matra: null })).toBe('त्');
  });
});

describe('parseAkshara', () => {
  it('round-trips a conjunct', () => {
    expect(parseAkshara('क्ष')).toEqual(KSHA);
  });

  it('round-trips a conjunct with a matra', () => {
    expect(parseAkshara('क्षि')).toEqual({ ...KSHA, matra: 'ि' });
  });

  it('returns null for input that is not a single akshara', () => {
    expect(parseAkshara('कमल')).toBeNull();
    expect(parseAkshara('')).toBeNull();
  });
});

describe('diffAkshara', () => {
  it('reports equal for identical aksharas', () => {
    expect(diffAkshara(KSHA, KSHA)).toEqual({ kind: 'equal' });
  });

  it('reports matra-differs when only the vowel is wrong', () => {
    expect(diffAkshara(KSHA, { ...KSHA, matra: 'ि' })).toEqual({ kind: 'matra-differs' });
  });

  it('reports matra-differs when only a halant is wrong', () => {
    const noHalant: Akshara = {
      parts: [{ consonant: 'क', halant: false }, { consonant: 'ष', halant: false }],
      matra: null,
    };
    expect(diffAkshara(KSHA, noHalant)).toEqual({ kind: 'matra-differs' });
  });

  it('reports consonants-differ when the cluster is wrong', () => {
    const wrong: Akshara = {
      parts: [{ consonant: 'क', halant: true }, { consonant: 'स', halant: false }],
      matra: null,
    };
    expect(diffAkshara(KSHA, wrong)).toEqual({ kind: 'consonants-differ' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/sanskrit test akshara.compose`
Expected: FAIL, `composeAkshara is not exported`.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/sanskrit/src/akshara.ts`. Merge `isMatra` and `VIRAMA`
into the existing `import { ... } from './chars'` line at the top of the file
rather than adding a second import statement:
```ts
// top of file becomes:
// import { isConsonant, isIndependentVowel, isMatra, isVirama, VIRAMA } from './chars';

export interface AksharaPart {
  consonant: string;
  halant: boolean;
}

export interface Akshara {
  parts: AksharaPart[];
  matra: string | null;
}

export function composeAkshara(a: Akshara): string {
  const body = a.parts.map((p) => (p.halant ? p.consonant + VIRAMA : p.consonant)).join('');
  return a.matra === null ? body : body + a.matra;
}

export function parseAkshara(text: string): Akshara | null {
  if (text === '') return null;
  if (segmentAksharas(text).length !== 1) return null;

  const chars = [...text];
  const parts: AksharaPart[] = [];
  let matra: string | null = null;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;
    if (isMatra(ch)) {
      matra = ch;
      continue;
    }
    if (isVirama(ch)) {
      const last = parts[parts.length - 1];
      if (last) last.halant = true;
      continue;
    }
    parts.push({ consonant: ch, halant: false });
  }

  return parts.length === 0 ? null : { parts, matra };
}

// A near-miss is defined narrowly in the spec: the consonant sequence is
// right and only the matra or a halant differs. Anything else is wrong.
export type AksharaDiff =
  | { kind: 'equal' }
  | { kind: 'matra-differs' }
  | { kind: 'consonants-differ' };

export function diffAkshara(expected: Akshara, actual: Akshara): AksharaDiff {
  const sameConsonants =
    expected.parts.length === actual.parts.length &&
    expected.parts.every((p, i) => p.consonant === actual.parts[i]!.consonant);

  if (!sameConsonants) return { kind: 'consonants-differ' };

  const sameHalants = expected.parts.every((p, i) => p.halant === actual.parts[i]!.halant);
  if (sameHalants && expected.matra === actual.matra) return { kind: 'equal' };

  return { kind: 'matra-differs' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/sanskrit test`
Expected: PASS, all sanskrit tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/sanskrit
git commit -m "Add akshara parse, compose and diff

The composer stores parts rather than a string so we avoid fighting matra
reordering, and so a wrong answer can say which part was wrong. diffAkshara
implements the narrow near-miss rule: consonants right, matra or halant
wrong."
```

---

### Task 6: Content schema

**Files:**
- Create: `packages/content/package.json`, `packages/content/tsconfig.json`, `packages/content/src/schema.ts`, `packages/content/src/index.ts`
- Test: `packages/content/src/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export type LocaleCode = 'hi' | 'en';
  export const TranslationsSchema: z.ZodType<Record<LocaleCode, string>>;
  export const LexemeSchema; export type Lexeme;
  export const SentenceSchema; export type Sentence;
  export const ConceptSchema; export type Concept;
  export const ExerciseSchema; export type Exercise;
  export const LessonSchema; export type Lesson;
  export const ContentPackSchema; export type ContentPack;
  ```

Schema covers all 11 exercise types from spec §4.2. Only three get renderers in this plan.

- [ ] **Step 1: Create the package**

`packages/content/package.json`:
```json
{
  "name": "@sanskritify/content",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": { "zod": "^3.23.0" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

`packages/content/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/content/src/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
// akshara-select carries a .refine, so it is a ZodEffects and cannot join a
// discriminatedUnion. The exported union that includes it is
// ExerciseSchemaWithRefinements; alias it here.
import {
  LexemeSchema,
  LessonSchema,
  ExerciseSchemaWithRefinements as ExerciseSchema,
} from './schema';

describe('LexemeSchema', () => {
  it('accepts a valid lexeme', () => {
    const parsed = LexemeSchema.parse({
      id: 'lex.balakah',
      devanagari: 'बालकः',
      translations: { hi: 'लड़का', en: 'boy' },
      source: 'ncert-deepakam-ch03',
    });
    expect(parsed.devanagari).toBe('बालकः');
  });

  it('rejects a lexeme missing the English gloss', () => {
    expect(() =>
      LexemeSchema.parse({
        id: 'lex.balakah',
        devanagari: 'बालकः',
        translations: { hi: 'लड़का' },
        source: 'ncert-deepakam-ch03',
      }),
    ).toThrow();
  });
});

describe('ExerciseSchema', () => {
  it('accepts an akshara-build exercise', () => {
    const parsed = ExerciseSchema.parse({
      id: 'ex.ch01.001',
      type: 'akshara-build',
      target: 'क्ष',
      conceptId: 'con.conjunct',
      source: 'ncert-deepakam-ch02',
    });
    expect(parsed.type).toBe('akshara-build');
  });

  it('accepts an akshara-select exercise', () => {
    const parsed = ExerciseSchema.parse({
      id: 'ex.ch01.002',
      type: 'akshara-select',
      target: 'ऋ',
      options: ['ऋ', 'ऊ', 'उ', 'ऌ'],
      promptTranslations: { hi: 'ऋ चुनो', en: 'Pick ऋ' },
      source: 'ncert-deepakam-ch01',
    });
    expect(parsed.options).toHaveLength(4);
  });

  it('rejects an akshara-select whose options omit the target', () => {
    expect(() =>
      ExerciseSchema.parse({
        id: 'ex.ch01.003',
        type: 'akshara-select',
        target: 'ऋ',
        options: ['ऊ', 'उ', 'ऌ'],
        promptTranslations: { hi: 'ऋ चुनो', en: 'Pick ऋ' },
        source: 'ncert-deepakam-ch01',
      }),
    ).toThrow();
  });

  it('rejects an akshara-select with no prompt, which would show the answer', () => {
    expect(() =>
      ExerciseSchema.parse({
        id: 'ex.ch01.004',
        type: 'akshara-select',
        target: 'ऋ',
        options: ['ऋ', 'ऊ', 'उ', 'ऌ'],
        source: 'ncert-deepakam-ch01',
      }),
    ).toThrow();
  });

  it('rejects an unknown exercise type', () => {
    expect(() => ExerciseSchema.parse({ id: 'x', type: 'sing', source: 'original' })).toThrow();
  });
});

describe('LessonSchema', () => {
  it('rejects a lesson with fewer than six exercises', () => {
    expect(() =>
      LessonSchema.parse({
        id: 'les.ch01.u1.l1',
        unitId: 'unit.ch01.u1',
        titleTranslations: { hi: 'स्वर', en: 'Vowels' },
        exercises: [],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/content test`
Expected: FAIL, `Cannot find module './schema'`.

- [ ] **Step 4: Write minimal implementation**

`packages/content/src/schema.ts`:
```ts
import { z } from 'zod';

export const LOCALES = ['hi', 'en'] as const;
export type LocaleCode = (typeof LOCALES)[number];

// Every user-facing content string carries both shipped locales. A future
// locale is added by extending LOCALES, and the lint in Task 12 will then
// flag every record that lacks it.
export const TranslationsSchema = z.object({
  hi: z.string().min(1),
  en: z.string().min(1),
});

// Provenance. The engine never reads this. It exists so swapping textbook
// content for original content later is a data migration, not a schema change.
export const SourceSchema = z.union([
  z.literal('original'),
  z.string().regex(/^ncert-deepakam-ch(0[1-9]|1[0-6])$/),
]);

export const LexemeSchema = z.object({
  id: z.string().startsWith('lex.'),
  devanagari: z.string().min(1),
  gender: z.enum(['pum', 'stri', 'napum']).optional(),
  declension: z.string().optional(),
  translations: TranslationsSchema,
  audioRef: z.string().optional(),
  source: SourceSchema,
});
export type Lexeme = z.infer<typeof LexemeSchema>;

export const SentenceSchema = z.object({
  id: z.string().startsWith('sen.'),
  canonical: z.string().min(1),
  acceptedForms: z.array(z.string().min(1)).min(1),
  translations: TranslationsSchema,
  audioRef: z.string().optional(),
  lexemeIds: z.array(z.string().startsWith('lex.')),
  source: SourceSchema,
});
export type Sentence = z.infer<typeof SentenceSchema>;

export const ConceptSchema = z.object({
  id: z.string().startsWith('con.'),
  titleTranslations: TranslationsSchema,
  bodyTranslations: TranslationsSchema,
  source: SourceSchema,
});
export type Concept = z.infer<typeof ConceptSchema>;

const Base = { id: z.string().startsWith('ex.'), source: SourceSchema };

const AksharaSelect = z
  .object({
    ...Base,
    type: z.literal('akshara-select'),
    target: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    // The learner is asked a question, never shown the answer. Without audio
    // in v1 the prompt is the only thing that makes this exercise solvable,
    // so it is required rather than optional.
    promptTranslations: TranslationsSchema,
    conceptId: z.string().startsWith('con.').optional(),
    audioRef: z.string().optional(),
  })
  .refine((e) => e.options.includes(e.target), {
    message: 'options must include target',
    path: ['options'],
  });

const AksharaBuild = z.object({
  ...Base,
  type: z.literal('akshara-build'),
  target: z.string().min(1),
  conceptId: z.string().startsWith('con.').optional(),
  audioRef: z.string().optional(),
});

const MatchPairs = z.object({
  ...Base,
  type: z.literal('match-pairs'),
  lexemeIds: z.array(z.string().startsWith('lex.')).min(3).max(6),
});

// Types defined for schema completeness. Renderers arrive with chapter 3+.
const SelectImage = z.object({
  ...Base, type: z.literal('select-image'),
  lexemeId: z.string(), optionLexemeIds: z.array(z.string()).min(2),
});
const TranslateToLocale = z.object({
  ...Base, type: z.literal('translate-to-locale'), sentenceId: z.string(),
});
const TranslateToSanskrit = z.object({
  ...Base, type: z.literal('translate-to-sanskrit'), sentenceId: z.string(),
});
const FillBlank = z.object({
  ...Base, type: z.literal('fill-blank'), sentenceId: z.string(),
  blankIndex: z.number().int().nonnegative(), options: z.array(z.string()).min(2),
});
const ListenSelect = z.object({
  ...Base, type: z.literal('listen-select'), audioRef: z.string(),
  target: z.string(), options: z.array(z.string()).min(2),
});
const ListenBuild = z.object({
  ...Base, type: z.literal('listen-build'), audioRef: z.string(), sentenceId: z.string(),
});
const OrderSentence = z.object({
  ...Base, type: z.literal('order-sentence'), sentenceId: z.string(),
});
const Speak = z.object({
  ...Base, type: z.literal('speak'), sentenceId: z.string(), enabled: z.literal(false),
});

export const ExerciseSchema = z.discriminatedUnion('type', [
  AksharaBuild, MatchPairs, SelectImage, TranslateToLocale, TranslateToSanskrit,
  FillBlank, ListenSelect, ListenBuild, OrderSentence, Speak,
  // AksharaSelect carries a .refine so it is a ZodEffects, not a ZodObject,
  // and cannot join a discriminatedUnion. It is validated separately below.
]);

export const ExerciseSchemaWithRefinements = z.union([AksharaSelect, ExerciseSchema]);
export type Exercise = z.infer<typeof ExerciseSchemaWithRefinements>;

export const LessonSchema = z.object({
  id: z.string().startsWith('les.'),
  unitId: z.string().startsWith('unit.'),
  titleTranslations: TranslationsSchema,
  exercises: z.array(ExerciseSchemaWithRefinements).min(6),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const ContentPackSchema = z.object({
  version: z.string(),
  courseId: z.string(),
  lexemes: z.array(LexemeSchema),
  sentences: z.array(SentenceSchema),
  concepts: z.array(ConceptSchema),
  lessons: z.array(LessonSchema),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;
```

`packages/content/src/index.ts`:
```ts
export * from './schema';
```

The test imports `ExerciseSchema` but `akshara-select` validation lives on `ExerciseSchemaWithRefinements`. Update the test's import to use `ExerciseSchemaWithRefinements` and alias it:

```ts
import { ExerciseSchemaWithRefinements as ExerciseSchema } from './schema';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/content test`
Expected: PASS, 6 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/content
git commit -m "Add content schema

Covers all eleven exercise types from the spec even though only three get
renderers now, so adding chapter 3 content later is data rather than a
schema change. Every record carries a source field for provenance."
```

---

### Task 7: Answer grading

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/types.ts`, `packages/core/src/grading.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/grading.test.ts`

**Interfaces:**
- Consumes: `normalize`, `parseAkshara`, `diffAkshara` from `@sanskritify/sanskrit`; `Exercise` from `@sanskritify/content`
- Produces:
  ```ts
  export type Verdict = 'correct' | 'near-miss' | 'wrong';
  export type HintCode = 'matra-differs' | null;
  export interface GradeResult { verdict: Verdict; hint: HintCode }
  export type Answer =
    | { kind: 'akshara'; akshara: Akshara }
    | { kind: 'choice'; value: string }
    | { kind: 'pairs'; pairs: Array<{ lexemeId: string; gloss: string }> };
  export function gradeAnswer(exercise: Exercise, answer: Answer, ctx: GradeContext): GradeResult;
  export interface GradeContext { lexemes: Map<string, Lexeme>; locale: LocaleCode }
  ```

- [ ] **Step 1: Create the package**

`packages/core/package.json`:
```json
{
  "name": "@sanskritify/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@sanskritify/sanskrit": "workspace:*",
    "@sanskritify/content": "workspace:*"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/core/src/grading.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseAkshara } from '@sanskritify/sanskrit';
import type { Exercise, Lexeme } from '@sanskritify/content';
import { gradeAnswer, type GradeContext } from './grading';

const ctx: GradeContext = { lexemes: new Map(), locale: 'en' };

const build: Exercise = {
  id: 'ex.ch02.001', type: 'akshara-build', target: 'क्ष', source: 'ncert-deepakam-ch02',
};

describe('gradeAnswer, akshara-build', () => {
  it('marks the exact akshara correct', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्ष')! }, ctx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('marks a wrong matra as a near-miss with a hint', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्षि')! }, ctx))
      .toEqual({ verdict: 'near-miss', hint: 'matra-differs' });
  });

  it('marks a wrong consonant as wrong', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्स')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });
});

const select: Exercise = {
  id: 'ex.ch01.001', type: 'akshara-select', target: 'ऋ',
  options: ['ऋ', 'ऊ', 'उ', 'ऌ'],
  promptTranslations: { hi: 'ऋ चुनो', en: 'Pick ऋ' },
  source: 'ncert-deepakam-ch01',
};

describe('gradeAnswer, akshara-select', () => {
  it('marks the right option correct', () => {
    expect(gradeAnswer(select, { kind: 'choice', value: 'ऋ' }, ctx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('never returns near-miss for a multiple choice', () => {
    expect(gradeAnswer(select, { kind: 'choice', value: 'ऊ' }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('normalises before comparing', () => {
    expect(gradeAnswer(
      { ...select, target: 'अङ्ग', options: ['अङ्ग', 'ऊ'] },
      { kind: 'choice', value: 'अंग' },
      ctx,
    )).toEqual({ verdict: 'correct', hint: null });
  });
});

describe('gradeAnswer, match-pairs', () => {
  const lexemes = new Map<string, Lexeme>([
    ['lex.a', { id: 'lex.a', devanagari: 'जलम्', translations: { hi: 'पानी', en: 'water' }, source: 'original' }],
    ['lex.b', { id: 'lex.b', devanagari: 'वृक्षः', translations: { hi: 'पेड़', en: 'tree' }, source: 'original' }],
    ['lex.c', { id: 'lex.c', devanagari: 'गजः', translations: { hi: 'हाथी', en: 'elephant' }, source: 'original' }],
  ]);
  const pairCtx: GradeContext = { lexemes, locale: 'en' };
  const ex: Exercise = {
    id: 'ex.ch03.001', type: 'match-pairs',
    lexemeIds: ['lex.a', 'lex.b', 'lex.c'], source: 'original',
  };

  it('marks all-correct pairings correct', () => {
    expect(gradeAnswer(ex, { kind: 'pairs', pairs: [
      { lexemeId: 'lex.a', gloss: 'water' },
      { lexemeId: 'lex.b', gloss: 'tree' },
      { lexemeId: 'lex.c', gloss: 'elephant' },
    ] }, pairCtx)).toEqual({ verdict: 'correct', hint: null });
  });

  it('marks any wrong pairing wrong', () => {
    expect(gradeAnswer(ex, { kind: 'pairs', pairs: [
      { lexemeId: 'lex.a', gloss: 'tree' },
      { lexemeId: 'lex.b', gloss: 'water' },
      { lexemeId: 'lex.c', gloss: 'elephant' },
    ] }, pairCtx)).toEqual({ verdict: 'wrong', hint: null });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/core test`
Expected: FAIL, `Cannot find module './grading'`.

- [ ] **Step 4: Write minimal implementation**

`packages/core/src/types.ts`:
```ts
import type { Akshara } from '@sanskritify/sanskrit';
import type { Lexeme, LocaleCode } from '@sanskritify/content';

export type Verdict = 'correct' | 'near-miss' | 'wrong';
export type HintCode = 'matra-differs' | null;

export interface GradeResult {
  verdict: Verdict;
  hint: HintCode;
}

export type Answer =
  | { kind: 'akshara'; akshara: Akshara }
  | { kind: 'choice'; value: string }
  | { kind: 'pairs'; pairs: Array<{ lexemeId: string; gloss: string }> };

export interface GradeContext {
  lexemes: Map<string, Lexeme>;
  locale: LocaleCode;
}
```

`packages/core/src/grading.ts`:
```ts
import { diffAkshara, normalize, parseAkshara } from '@sanskritify/sanskrit';
import type { Exercise } from '@sanskritify/content';
import type { Answer, GradeContext, GradeResult } from './types';

const CORRECT: GradeResult = { verdict: 'correct', hint: null };
const WRONG: GradeResult = { verdict: 'wrong', hint: null };

export function gradeAnswer(
  exercise: Exercise,
  answer: Answer,
  ctx: GradeContext,
): GradeResult {
  switch (exercise.type) {
    case 'akshara-build': {
      if (answer.kind !== 'akshara') return WRONG;
      const expected = parseAkshara(exercise.target);
      if (expected === null) return WRONG;
      const diff = diffAkshara(expected, answer.akshara);
      if (diff.kind === 'equal') return CORRECT;
      // Spec: near-miss is consonants right, matra or halant wrong. It does
      // not cost a heart, so the boundary here is load-bearing.
      if (diff.kind === 'matra-differs') return { verdict: 'near-miss', hint: 'matra-differs' };
      return WRONG;
    }

    case 'akshara-select': {
      if (answer.kind !== 'choice') return WRONG;
      return normalize(answer.value) === normalize(exercise.target) ? CORRECT : WRONG;
    }

    case 'match-pairs': {
      if (answer.kind !== 'pairs') return WRONG;
      if (answer.pairs.length !== exercise.lexemeIds.length) return WRONG;
      const allRight = answer.pairs.every((p) => {
        const lexeme = ctx.lexemes.get(p.lexemeId);
        if (lexeme === undefined) return false;
        return normalize(lexeme.translations[ctx.locale]) === normalize(p.gloss);
      });
      return allRight ? CORRECT : WRONG;
    }

    default:
      return WRONG;
  }
}
```

Do **not** re-export the types from `grading.ts`. `index.ts` already does
`export * from './types'`, and a second path to the same names collides.

`packages/core/src/index.ts`:
```ts
export * from './types';
export * from './grading';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/core test`
Expected: PASS, 8 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "Add answer grading with three verdicts

near-miss only fires for akshara-build where the consonants are right and
the matra or halant is wrong, and it does not cost a heart. Multiple choice
can never be a near-miss because there is no partial structure to compare."
```

---

### Task 8: Session reducer

**Files:**
- Create: `packages/core/src/session.ts`
- Test: `packages/core/src/session.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `gradeAnswer`, `GradeContext`, `Answer` from Task 7; `Lesson`, `Exercise` from Task 6
- Produces:
  ```ts
  export interface SessionState {
    lessonId: string;
    queue: Exercise[];
    index: number;
    hearts: number;
    maxHearts: number;
    xp: number;
    wrongCount: number;
    requeues: Record<string, number>;
    status: 'in_progress' | 'complete' | 'failed';
  }
  export interface SessionOpts { hearts: number; maxHearts: number }
  export function createSession(lesson: Lesson, opts: SessionOpts): SessionState;
  export function submitAnswer(
    state: SessionState, answer: Answer, ctx: GradeContext,
  ): { state: SessionState; result: GradeResult };
  export function currentExercise(state: SessionState): Exercise | null;
  ```

- [ ] **Step 1: Write the failing test**

`packages/core/src/session.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseAkshara } from '@sanskritify/sanskrit';
import type { Lesson, Exercise } from '@sanskritify/content';
import { createSession, submitAnswer, currentExercise } from './session';
import type { GradeContext } from './types';

const ctx: GradeContext = { lexemes: new Map(), locale: 'en' };

function ex(n: number, target: string): Exercise {
  return { id: `ex.${n}`, type: 'akshara-build', target, source: 'ncert-deepakam-ch02' };
}

const lesson: Lesson = {
  id: 'les.ch01.u1.l1',
  unitId: 'unit.ch01.u1',
  titleTranslations: { hi: 'संयुक्त', en: 'Conjuncts' },
  exercises: [ex(1, 'क्ष'), ex(2, 'त्र'), ex(3, 'ज्ञ'), ex(4, 'श्र'), ex(5, 'द्व'), ex(6, 'स्त')],
};

const opts = { hearts: 5, maxHearts: 5 };
const right = (t: string) => ({ kind: 'akshara' as const, akshara: parseAkshara(t)! });

describe('createSession', () => {
  it('queues every exercise and starts in progress', () => {
    const s = createSession(lesson, opts);
    expect(s.queue).toHaveLength(6);
    expect(s.index).toBe(0);
    expect(s.status).toBe('in_progress');
    expect(currentExercise(s)?.id).toBe('ex.1');
  });
});

describe('submitAnswer', () => {
  it('advances on a correct answer without losing a heart', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), right('क्ष'), ctx);
    expect(result.verdict).toBe('correct');
    expect(state.hearts).toBe(5);
    expect(state.index).toBe(1);
    expect(state.queue).toHaveLength(6);
  });

  it('costs a heart and re-queues on a wrong answer', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), right('क्स'), ctx);
    expect(result.verdict).toBe('wrong');
    expect(state.hearts).toBe(4);
    expect(state.queue).toHaveLength(7);
    expect(state.queue[6]!.id).toBe('ex.1');
  });

  it('re-queues a near-miss without costing a heart', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), right('क्षि'), ctx);
    expect(result.verdict).toBe('near-miss');
    expect(state.hearts).toBe(5);
    expect(state.queue).toHaveLength(7);
  });

  it('re-queues an exercise at most twice', () => {
    let s = createSession(lesson, opts);
    s = submitAnswer(s, right('क्षि'), ctx).state; // requeue 1
    s = { ...s, index: s.queue.length - 1 };
    s = submitAnswer(s, right('क्षि'), ctx).state; // requeue 2
    const before = s.queue.length;
    s = { ...s, index: s.queue.length - 1 };
    s = submitAnswer(s, right('क्षि'), ctx).state; // capped
    expect(s.queue.length).toBe(before);
  });

  it('fails the session when hearts reach zero', () => {
    let s = createSession(lesson, { hearts: 1, maxHearts: 5 });
    s = submitAnswer(s, right('क्स'), ctx).state;
    expect(s.hearts).toBe(0);
    expect(s.status).toBe('failed');
  });

  it('completes with 15 XP for a flawless lesson', () => {
    let s = createSession(lesson, opts);
    for (const target of ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व', 'स्त']) {
      s = submitAnswer(s, right(target), ctx).state;
    }
    expect(s.status).toBe('complete');
    expect(s.xp).toBe(15);
  });

  it('completes with 10 XP when a wrong answer occurred', () => {
    let s = createSession(lesson, opts);
    s = submitAnswer(s, right('क्स'), ctx).state; // wrong, requeues ex.1
    for (const target of ['त्र', 'ज्ञ', 'श्र', 'द्व', 'स्त', 'क्ष']) {
      s = submitAnswer(s, right(target), ctx).state;
    }
    expect(s.status).toBe('complete');
    expect(s.xp).toBe(10);
  });

  it('ignores answers once the session is over', () => {
    let s = createSession(lesson, { hearts: 1, maxHearts: 5 });
    s = submitAnswer(s, right('क्स'), ctx).state;
    const after = submitAnswer(s, right('त्र'), ctx);
    expect(after.state).toEqual(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/core test session`
Expected: FAIL, `Cannot find module './session'`.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/session.ts`:
```ts
import type { Exercise, Lesson } from '@sanskritify/content';
import { gradeAnswer } from './grading';
import type { Answer, GradeContext, GradeResult } from './types';

const XP_PER_LESSON = 10;
const XP_PERFECT_BONUS = 5;
const MAX_REQUEUES = 2;

export interface SessionState {
  lessonId: string;
  queue: Exercise[];
  index: number;
  hearts: number;
  maxHearts: number;
  xp: number;
  wrongCount: number;
  requeues: Record<string, number>;
  status: 'in_progress' | 'complete' | 'failed';
}

export interface SessionOpts {
  hearts: number;
  maxHearts: number;
}

export function createSession(lesson: Lesson, opts: SessionOpts): SessionState {
  return {
    lessonId: lesson.id,
    queue: [...lesson.exercises],
    index: 0,
    hearts: opts.hearts,
    maxHearts: opts.maxHearts,
    xp: 0,
    wrongCount: 0,
    requeues: {},
    status: 'in_progress',
  };
}

export function currentExercise(state: SessionState): Exercise | null {
  return state.queue[state.index] ?? null;
}

export function submitAnswer(
  state: SessionState,
  answer: Answer,
  ctx: GradeContext,
): { state: SessionState; result: GradeResult } {
  const exercise = currentExercise(state);
  if (state.status !== 'in_progress' || exercise === null) {
    return { state, result: { verdict: 'wrong', hint: null } };
  }

  const result = gradeAnswer(exercise, answer, ctx);

  // Only a wrong answer costs a heart. A near-miss re-queues but is free.
  const hearts = result.verdict === 'wrong' ? state.hearts - 1 : state.hearts;
  const wrongCount = result.verdict === 'wrong' ? state.wrongCount + 1 : state.wrongCount;

  let queue = state.queue;
  let requeues = state.requeues;
  if (result.verdict !== 'correct') {
    const seen = state.requeues[exercise.id] ?? 0;
    if (seen < MAX_REQUEUES) {
      queue = [...state.queue, exercise];
      requeues = { ...state.requeues, [exercise.id]: seen + 1 };
    }
  }

  const index = state.index + 1;

  let status: SessionState['status'] = 'in_progress';
  if (hearts <= 0) status = 'failed';
  else if (index >= queue.length) status = 'complete';

  const xp =
    status === 'complete'
      ? XP_PER_LESSON + (wrongCount === 0 ? XP_PERFECT_BONUS : 0)
      : state.xp;

  return {
    state: { ...state, queue, index, hearts, wrongCount, requeues, xp, status },
    result,
  };
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './session';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/core test session`
Expected: PASS, 9 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Add the lesson session reducer

Pure function over plain data, so a whole lesson is a value a test can
construct. A near-miss re-queues without costing a heart, and any exercise
re-queues at most twice so sessions stay bounded."
```

---

### Task 9: Hearts regeneration and streak derivation

**Files:**
- Create: `packages/core/src/hearts.ts`, `packages/core/src/streak.ts`
- Test: `packages/core/src/hearts.test.ts`, `packages/core/src/streak.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export const HEART_REGEN_MS: 1800000;
  export function currentHearts(
    stored: number, updatedAt: number, now: number, max: number,
  ): number;
  export function streakLength(activityDays: string[], today: string): number;
  ```

`activityDays` are `YYYY-MM-DD` strings in the learner's local calendar. Spec §3.4: the streak counter is derived, never stored.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/hearts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { currentHearts, HEART_REGEN_MS } from './hearts';

const T0 = 1_700_000_000_000;

describe('currentHearts', () => {
  it('returns the stored value before any regen elapses', () => {
    expect(currentHearts(3, T0, T0 + 1000, 5)).toBe(3);
  });

  it('adds one heart per regen interval', () => {
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS, 5)).toBe(4);
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS * 2, 5)).toBe(5);
  });

  it('clamps to the maximum', () => {
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS * 99, 5)).toBe(5);
  });

  it('does not regenerate past the maximum from a full state', () => {
    expect(currentHearts(5, T0, T0 + HEART_REGEN_MS * 4, 5)).toBe(5);
  });

  it('treats a backwards clock as no elapsed time', () => {
    expect(currentHearts(2, T0, T0 - HEART_REGEN_MS * 10, 5)).toBe(2);
  });
});
```

`packages/core/src/streak.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { streakLength } from './streak';

describe('streakLength', () => {
  it('is zero with no activity', () => {
    expect(streakLength([], '2026-08-16')).toBe(0);
  });

  it('counts a run ending today', () => {
    expect(streakLength(['2026-08-14', '2026-08-15', '2026-08-16'], '2026-08-16')).toBe(3);
  });

  it('counts a run ending yesterday, since today is not over', () => {
    expect(streakLength(['2026-08-14', '2026-08-15'], '2026-08-16')).toBe(2);
  });

  it('is zero when the last activity was two days ago', () => {
    expect(streakLength(['2026-08-13', '2026-08-14'], '2026-08-16')).toBe(0);
  });

  it('ignores duplicates, which is why the set merges across devices', () => {
    expect(streakLength(['2026-08-16', '2026-08-16', '2026-08-15'], '2026-08-16')).toBe(2);
  });

  it('ignores order', () => {
    expect(streakLength(['2026-08-15', '2026-08-16', '2026-08-14'], '2026-08-16')).toBe(3);
  });

  it('crosses a month boundary', () => {
    expect(streakLength(['2026-07-31', '2026-08-01'], '2026-08-01')).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sanskritify/core test hearts streak`
Expected: FAIL, both modules missing.

- [ ] **Step 3: Write minimal implementations**

`packages/core/src/hearts.ts`:
```ts
export const HEART_REGEN_MS = 1_800_000; // 30 minutes

export function currentHearts(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  // A backwards clock yields negative elapsed time. Children do change the
  // device clock; treating it as zero is enough while there is no shop.
  const elapsed = Math.max(0, now - updatedAt);
  const regenerated = Math.floor(elapsed / HEART_REGEN_MS);
  return Math.min(max, stored + regenerated);
}
```

`packages/core/src/streak.ts`:
```ts
const DAY_MS = 86_400_000;

function toUtcDay(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  ) / DAY_MS;
}

// Derived from the set of activity days, never stored. A set unions across
// devices without conflict; a counter does not.
export function streakLength(activityDays: string[], today: string): number {
  const days = new Set(activityDays.map(toUtcDay));
  if (days.size === 0) return 0;

  const todayNum = toUtcDay(today);

  // Today may still be in progress, so a run ending yesterday still counts.
  let cursor = days.has(todayNum) ? todayNum : todayNum - 1;
  if (!days.has(cursor)) return 0;

  let length = 0;
  while (days.has(cursor)) {
    length += 1;
    cursor -= 1;
  }
  return length;
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './hearts';
export * from './streak';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/core test`
Expected: PASS, all core tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "Add heart regeneration and streak derivation

Hearts are computed from a timestamp rather than a background timer.
Streak length is derived from the set of activity days so two offline
devices merge by union instead of fighting over a counter."
```

---

### Task 10: Content CLI extract command

**Files:**
- Create: `tools/content-cli/package.json`, `tools/content-cli/tsconfig.json`, `tools/content-cli/src/extract.ts`, `tools/content-cli/src/cli.ts`
- Test: `tools/content-cli/src/extract.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export interface ExtractResult { chapter: number; source: string; outPath: string; chars: number }
  export function chapterPdfPath(chapter: number, root: string): string;
  export function extractChapter(chapter: number, root: string, outDir: string): Promise<ExtractResult>;
  ```

Chapter N maps to `Class6/fsde1NN.pdf`: chapter 1 is `fsde101.pdf`, chapter 16 is `fsde116.pdf`. `fsde100.pdf` is front matter and is not a chapter.

- [ ] **Step 1: Create the package**

`tools/content-cli/package.json`:
```json
{
  "name": "@sanskritify/content-cli",
  "version": "0.0.0",
  "type": "module",
  "bin": { "content-cli": "./src/cli.ts" },
  "dependencies": {
    "@sanskritify/content": "workspace:*",
    "@sanskritify/sanskrit": "workspace:*",
    "zod": "^3.23.0"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

`tools/content-cli/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`tools/content-cli/src/extract.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chapterPdfPath } from './extract';

describe('chapterPdfPath', () => {
  it('maps chapter 1 to fsde101.pdf', () => {
    expect(chapterPdfPath(1, '/repo')).toBe('/repo/Class6/fsde101.pdf');
  });

  it('maps chapter 16 to fsde116.pdf', () => {
    expect(chapterPdfPath(16, '/repo')).toBe('/repo/Class6/fsde116.pdf');
  });

  it('rejects chapter 0, which is front matter and not a chapter', () => {
    expect(() => chapterPdfPath(0, '/repo')).toThrow(/1 and 16/);
  });

  it('rejects chapter 17', () => {
    expect(() => chapterPdfPath(17, '/repo')).toThrow(/1 and 16/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/content-cli test`
Expected: FAIL, `Cannot find module './extract'`.

- [ ] **Step 4: Write minimal implementation**

`tools/content-cli/src/extract.ts`:
```ts
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

export interface ExtractResult {
  chapter: number;
  source: string;
  outPath: string;
  chars: number;
}

export function chapterPdfPath(chapter: number, root: string): string {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 16) {
    throw new Error(`chapter must be between 1 and 16, got ${chapter}`);
  }
  const name = `fsde1${String(chapter).padStart(2, '0')}.pdf`;
  return path.posix.join(root, 'Class6', name);
}

export async function extractChapter(
  chapter: number,
  root: string,
  outDir: string,
): Promise<ExtractResult> {
  const source = chapterPdfPath(chapter, root);
  const outPath = path.join(outDir, `ch${String(chapter).padStart(2, '0')}.txt`);
  await mkdir(outDir, { recursive: true });
  // -enc UTF-8 matters. Without it pdftotext emits Latin-1 and every
  // Devanagari codepoint is lost rather than merely reordered.
  await run('pdftotext', ['-enc', 'UTF-8', source, outPath]);
  const text = await readFile(outPath, 'utf8');
  return { chapter, source, outPath, chars: text.length };
}
```

`tools/content-cli/src/cli.ts`:
```ts
#!/usr/bin/env node
import { extractChapter } from './extract';

const [command, ...rest] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case 'extract': {
      const root = process.cwd();
      const chapters = rest.length > 0 ? rest.map(Number) : range(1, 16);
      for (const ch of chapters) {
        const r = await extractChapter(ch, root, 'packages/content/raw');
        console.log(`ch${ch}: ${r.chars} chars -> ${r.outPath}`);
      }
      break;
    }
    default:
      console.error('usage: content-cli extract [chapter...]');
      process.exit(1);
  }
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/content-cli test`
Expected: PASS, 4 cases.

- [ ] **Step 6: Extract all chapters for real**

Run: `pnpm --filter @sanskritify/content-cli exec tsx src/cli.ts extract`
Expected: 16 files in `packages/content/raw/`, each with a non-zero char count.

If `pdftotext` is missing, install poppler-utils. On Windows it ships with Git for Windows at `/mingw64/bin/pdftotext`.

- [ ] **Step 7: Commit**

```bash
git add tools/content-cli packages/content/raw
git commit -m "Add content-cli extract

Raw extractions are committed so corrections are visible as diffs. The
-enc UTF-8 flag is required; without it pdftotext drops Devanagari
entirely rather than merely reordering it."
```

---

### Task 11: Raw corruption lint

**Files:**
- Create: `tools/content-cli/src/lint-raw.ts`
- Test: `tools/content-cli/src/lint-raw.test.ts`
- Modify: `tools/content-cli/src/cli.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export type RawRuleId =
    | 'space-before-virama' | 'virama-space-consonant'
    | 'orphan-matra' | 'zero-width-joiner';
  export interface RawFinding {
    rule: RawRuleId; line: number; column: number; excerpt: string;
  }
  export function lintRaw(text: string): RawFinding[];
  ```

These four rules are the corruption signatures measured in spec §5. They flag about 105 sites per chapter, which is what makes human verification affordable.

- [ ] **Step 1: Write the failing test**

`tools/content-cli/src/lint-raw.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { lintRaw } from './lint-raw';

describe('lintRaw', () => {
  it('flags a space before a virama', () => {
    // मनुष्याणां extracted as मनषु ्याणां
    const found = lintRaw('मनषु ्याणां');
    expect(found.map((f) => f.rule)).toContain('space-before-virama');
  });

  it('flags a virama followed by a space and a consonant', () => {
    // अङ्गानि extracted as अङ् गानि
    const found = lintRaw('अङ् गानि');
    expect(found.map((f) => f.rule)).toContain('virama-space-consonant');
  });

  it('does not flag a virama followed by a space and a vowel', () => {
    // प्रियम् अङ्गम् is correct Sanskrit: word-final म् then a new word.
    const found = lintRaw('प्रियम् अङ्गम्');
    expect(found.map((f) => f.rule)).not.toContain('virama-space-consonant');
  });

  it('flags an orphan matra after a space', () => {
    // वर्णमालां extracted as वर्मण ालां
    const found = lintRaw('वयं वर्मण ालां पठामः');
    expect(found.map((f) => f.rule)).toContain('orphan-matra');
  });

  it('flags zero-width joiners', () => {
    const found = lintRaw('सामान्‍याः');
    expect(found.map((f) => f.rule)).toContain('zero-width-joiner');
  });

  it('reports the line number', () => {
    const found = lintRaw('clean line\nमनषु ्याणां');
    expect(found[0]!.line).toBe(2);
  });

  it('returns nothing for clean text', () => {
    expect(lintRaw('वयं वर्णमालां पठामः ।')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/content-cli test lint-raw`
Expected: FAIL, `Cannot find module './lint-raw'`.

- [ ] **Step 3: Write minimal implementation**

`tools/content-cli/src/lint-raw.ts`:
```ts
export type RawRuleId =
  | 'space-before-virama'
  | 'virama-space-consonant'
  | 'orphan-matra'
  | 'zero-width-joiner';

export interface RawFinding {
  rule: RawRuleId;
  line: number;
  column: number;
  excerpt: string;
}

interface Rule {
  id: RawRuleId;
  pattern: RegExp;
}

// Each pattern is a corruption signature of pdftotext's conjunct reordering,
// measured across the sixteen chapter PDFs. See spec section 5.
const RULES: Rule[] = [
  // मनषु ्याणां — the virama got separated from its consonant.
  { id: 'space-before-virama', pattern: /\s्/gu },
  // अङ् गानि — the cluster continues after a space. Restricted to a
  // following consonant so प्रियम् अङ्गम् (a genuine word boundary before a
  // vowel-initial word) is not flagged.
  { id: 'virama-space-consonant', pattern: /्\s[क-ह]/gu },
  // वर्मण ालां — a matra cannot begin a word.
  { id: 'orphan-matra', pattern: /\s[ा-ौ]/gu },
  { id: 'zero-width-joiner', pattern: /[‌‍]/gu },
];

export function lintRaw(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const lines = text.split('\n');

  lines.forEach((lineText, i) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(lineText)) !== null) {
        findings.push({
          rule: rule.id,
          line: i + 1,
          column: m.index + 1,
          excerpt: lineText.slice(Math.max(0, m.index - 12), m.index + 14),
        });
      }
    }
  });

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}
```

Add a `lint:raw` branch to `tools/content-cli/src/cli.ts`, inside the `switch`:
```ts
    case 'lint:raw': {
      const { readFile } = await import('node:fs/promises');
      const { lintRaw } = await import('./lint-raw');
      let total = 0;
      for (const ch of rest.length > 0 ? rest.map(Number) : range(1, 16)) {
        const file = `packages/content/raw/ch${String(ch).padStart(2, '0')}.txt`;
        const findings = lintRaw(await readFile(file, 'utf8'));
        total += findings.length;
        for (const f of findings) {
          console.log(`${file}:${f.line}:${f.column}  ${f.rule}  ${f.excerpt.trim()}`);
        }
      }
      console.log(`\n${total} findings`);
      break;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/content-cli test lint-raw`
Expected: PASS, 7 cases.

- [ ] **Step 5: Run it against the real extractions**

Run: `pnpm --filter @sanskritify/content-cli exec tsx src/cli.ts lint:raw`
Expected: roughly 1,700 findings across 16 chapters. If the total is under 500 or over 4,000, the extraction step or a rule is wrong — investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add tools/content-cli
git commit -m "Add raw corruption lint

Four signatures of pdftotext conjunct reordering, flagging about 105 sites
per chapter. The virama-space rule requires a following consonant so a real
word boundary like प्रियम् अङ्गम् is not reported."
```

---

### Task 12: Content lint and pack build

**Files:**
- Create: `tools/content-cli/src/lint-content.ts`, `tools/content-cli/src/build.ts`
- Test: `tools/content-cli/src/lint-content.test.ts`
- Modify: `tools/content-cli/src/cli.ts`

**Interfaces:**
- Consumes: `ContentPackSchema`, `ContentPack` from Task 6
- Produces:
  ```ts
  export type ContentRuleId =
    | 'missing-lexeme' | 'missing-concept' | 'duplicate-id'
    | 'lesson-too-short' | 'lexeme-underused';
  export interface ContentFinding { rule: ContentRuleId; id: string; detail: string }
  export function lintContent(pack: ContentPack): ContentFinding[];
  export function buildPack(pack: ContentPack): { json: string; hash: string };
  ```

`lexeme-underused` enforces spec §6.3: every lexeme needs at least 3 exercises across at least 2 types, or review can only ever test it one way.

- [ ] **Step 1: Write the failing test**

`tools/content-cli/src/lint-content.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { ContentPack } from '@sanskritify/content';
import { lintContent } from './lint-content';

function pack(over: Partial<ContentPack> = {}): ContentPack {
  return {
    version: '1.0.0', courseId: 'sanskrit-class-6',
    lexemes: [], sentences: [], concepts: [], lessons: [],
    ...over,
  };
}

describe('lintContent', () => {
  it('flags an exercise referencing a lexeme that does not exist', () => {
    const p = pack({
      lessons: [{
        id: 'les.a', unitId: 'unit.a',
        titleTranslations: { hi: 'क', en: 'k' },
        exercises: [
          { id: 'ex.1', type: 'match-pairs', lexemeIds: ['lex.ghost', 'lex.b', 'lex.c'], source: 'original' },
        ],
      }] as ContentPack['lessons'],
    });
    const found = lintContent(p);
    expect(found.map((f) => f.rule)).toContain('missing-lexeme');
  });

  it('flags a duplicate id', () => {
    const lexeme = {
      id: 'lex.a', devanagari: 'जलम्',
      translations: { hi: 'पानी', en: 'water' }, source: 'original' as const,
    };
    const found = lintContent(pack({ lexemes: [lexeme, lexeme] }));
    expect(found.map((f) => f.rule)).toContain('duplicate-id');
  });

  it('flags a lexeme used by fewer than three exercises', () => {
    const p = pack({
      lexemes: [{
        id: 'lex.a', devanagari: 'जलम्',
        translations: { hi: 'पानी', en: 'water' }, source: 'original',
      }],
      lessons: [{
        id: 'les.a', unitId: 'unit.a',
        titleTranslations: { hi: 'क', en: 'k' },
        exercises: [
          { id: 'ex.1', type: 'match-pairs', lexemeIds: ['lex.a'], source: 'original' },
        ],
      }] as ContentPack['lessons'],
    });
    const found = lintContent(p);
    expect(found.map((f) => f.rule)).toContain('lexeme-underused');
  });

  it('passes a clean pack', () => {
    expect(lintContent(pack())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/content-cli test lint-content`
Expected: FAIL, `Cannot find module './lint-content'`.

- [ ] **Step 3: Write minimal implementation**

`tools/content-cli/src/lint-content.ts`:
```ts
import type { ContentPack, Exercise } from '@sanskritify/content';

export type ContentRuleId =
  | 'missing-lexeme'
  | 'missing-concept'
  | 'duplicate-id'
  | 'lesson-too-short'
  | 'lexeme-underused';

export interface ContentFinding {
  rule: ContentRuleId;
  id: string;
  detail: string;
}

const MIN_EXERCISES_PER_LESSON = 6;
const MIN_EXERCISES_PER_LEXEME = 3;
const MIN_TYPES_PER_LEXEME = 2;

function lexemeRefs(ex: Exercise): string[] {
  if ('lexemeIds' in ex) return ex.lexemeIds;
  if ('lexemeId' in ex) return [ex.lexemeId];
  return [];
}

export function lintContent(pack: ContentPack): ContentFinding[] {
  const out: ContentFinding[] = [];
  const exercises = pack.lessons.flatMap((l) => l.exercises);

  const seen = new Set<string>();
  const allIds = [
    ...pack.lexemes.map((x) => x.id),
    ...pack.sentences.map((x) => x.id),
    ...pack.concepts.map((x) => x.id),
    ...pack.lessons.map((x) => x.id),
    ...exercises.map((x) => x.id),
  ];
  for (const id of allIds) {
    if (seen.has(id)) out.push({ rule: 'duplicate-id', id, detail: 'id appears more than once' });
    seen.add(id);
  }

  const lexemeIds = new Set(pack.lexemes.map((x) => x.id));
  const conceptIds = new Set(pack.concepts.map((x) => x.id));

  for (const ex of exercises) {
    for (const ref of lexemeRefs(ex)) {
      if (!lexemeIds.has(ref)) {
        out.push({ rule: 'missing-lexeme', id: ex.id, detail: `references ${ref}` });
      }
    }
    if ('conceptId' in ex && ex.conceptId !== undefined && !conceptIds.has(ex.conceptId)) {
      out.push({ rule: 'missing-concept', id: ex.id, detail: `references ${ex.conceptId}` });
    }
  }

  for (const lesson of pack.lessons) {
    if (lesson.exercises.length < MIN_EXERCISES_PER_LESSON) {
      out.push({
        rule: 'lesson-too-short', id: lesson.id,
        detail: `${lesson.exercises.length} exercises, need ${MIN_EXERCISES_PER_LESSON}`,
      });
    }
  }

  // Review lessons are generated from due lexemes, so a lexeme reachable by
  // only one exercise gets memorised as that exercise rather than learned.
  for (const lexeme of pack.lexemes) {
    const using = exercises.filter((ex) => lexemeRefs(ex).includes(lexeme.id));
    const types = new Set(using.map((ex) => ex.type));
    if (using.length < MIN_EXERCISES_PER_LEXEME || types.size < MIN_TYPES_PER_LEXEME) {
      out.push({
        rule: 'lexeme-underused', id: lexeme.id,
        detail: `${using.length} exercises across ${types.size} types`,
      });
    }
  }

  return out;
}
```

`tools/content-cli/src/build.ts`:
```ts
import { createHash } from 'node:crypto';
import { ContentPackSchema, type ContentPack } from '@sanskritify/content';

export function buildPack(pack: ContentPack): { json: string; hash: string } {
  const validated = ContentPackSchema.parse(pack);
  const json = JSON.stringify(validated);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  return { json, hash };
}
```

Add `lint:content` and `build` branches to the CLI `switch`, mirroring the `lint:raw` branch: read `packages/content/src/data/**/*.json` (that is the canonical content path — note the `src/`), assemble a `ContentPack`, run `lintContent`, print findings, then `buildPack` and write to `packages/content/dist/pack-<hash>.json`. Exit code 1 if there are any findings.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/content-cli test`
Expected: PASS, all content-cli tests green.

- [ ] **Step 5: Add CI**

Create `.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: sudo apt-get update && sudo apt-get install -y poppler-utils
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter @sanskritify/content-cli exec tsx src/cli.ts lint:content
```

- [ ] **Step 6: Commit**

```bash
git add tools/content-cli .github
git commit -m "Add content lint, pack build and CI

The lexeme-underused rule enforces what review scheduling needs: three
exercises across two types per word, otherwise a due word can only be
tested one way and the learner memorises the exercise. CI fails the build
on any finding, so a malformed chapter cannot merge."
```

---

### Task 13: Verified chapter 1 lesson content

**Files:**
- Create: `packages/content/src/data/ch01/concepts.json`, `packages/content/src/data/ch01/lexemes.json`, `packages/content/src/data/ch01/lesson-01.json`
- Create: `packages/content/source/ch01.md`
- Test: `packages/content/src/data/ch01/ch01.test.ts`

**Interfaces:**
- Consumes: schemas from Task 6, `lintContent` from Task 12
- Produces: lesson id `les.ch01.u1.l1`, unit `unit.ch01.u1`, concept `con.ch01.svara`

This is the human verification step from spec §5. The raw extraction is a draft; the author corrects it against `Class6/fsde101.pdf`.

- [ ] **Step 1: Verify the chapter 1 source text**

Run: `pnpm --filter @sanskritify/content-cli exec tsx src/cli.ts lint:raw 1`

Open `Class6/fsde101.pdf` beside the output. For each finding, correct the text and record the verified content in `packages/content/source/ch01.md`. Known corruptions in this chapter, confirmed against the PDF:

| Extracted | Correct |
|---|---|
| वर्मण ालां | वर्णमालां |
| स्वतन्त्ररूपणे | स्वतन्त्ररूपेण |
| सामान्‍याः | सामान्याः |
| सन्‍त‍ि | सन्ति |
| वरण्मालायाम् | वर्णमालायाम् |

The chapter teaches: समानाक्षराणि (अ इ उ ऋ ऌ, with दीर्घ आ ई ऊ ॠ), सन्ध्यक्षराणि (ए ऐ ओ औ), and अनुनासिक-स्वराः.

- [ ] **Step 2: Write the failing test**

`packages/content/src/data/ch01/ch01.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LessonSchema, ConceptSchema, LexemeSchema } from '../../schema';
import lesson from './lesson-01.json';
import concepts from './concepts.json';
import lexemes from './lexemes.json';

describe('chapter 1 content', () => {
  it('every concept validates', () => {
    for (const c of concepts) expect(() => ConceptSchema.parse(c)).not.toThrow();
  });

  it('every lexeme validates', () => {
    for (const l of lexemes) expect(() => LexemeSchema.parse(l)).not.toThrow();
  });

  it('lesson 1 validates', () => {
    expect(() => LessonSchema.parse(lesson)).not.toThrow();
  });

  it('lesson 1 has at least six exercises', () => {
    expect(LessonSchema.parse(lesson).exercises.length).toBeGreaterThanOrEqual(6);
  });

  it('every akshara-select option list contains its target', () => {
    for (const ex of LessonSchema.parse(lesson).exercises) {
      if (ex.type === 'akshara-select') expect(ex.options).toContain(ex.target);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/content test ch01`
Expected: FAIL, JSON files missing.

- [ ] **Step 4: Author the content**

`packages/content/src/data/ch01/concepts.json`:
```json
[
  {
    "id": "con.ch01.svara",
    "titleTranslations": { "hi": "स्वर", "en": "Vowels" },
    "bodyTranslations": {
      "hi": "वर्ण दो प्रकार के होते हैं — स्वर और व्यञ्जन। स्वरों का उच्चारण स्वतन्त्र रूप से होता है।",
      "en": "Letters are of two kinds: vowels and consonants. A vowel is pronounced on its own, without needing another sound."
    },
    "source": "ncert-deepakam-ch01"
  },
  {
    "id": "con.ch01.hrasva-dirgha",
    "titleTranslations": { "hi": "ह्रस्व और दीर्घ", "en": "Short and long" },
    "bodyTranslations": {
      "hi": "अ इ उ ऋ ह्रस्व हैं। आ ई ऊ ॠ दीर्घ हैं। दीर्घ स्वर का उच्चारण दुगुना लम्बा होता है।",
      "en": "अ इ उ ऋ are short. आ ई ऊ ॠ are long, held for twice as long. The difference changes the meaning of a word, so it matters."
    },
    "source": "ncert-deepakam-ch01"
  }
]
```

`packages/content/src/data/ch01/lexemes.json`:
```json
[]
```

Chapter 1 teaches letters, not words, so it has no lexemes. The empty array keeps the loader uniform across chapters.

`packages/content/src/data/ch01/lesson-01.json`:
```json
{
  "id": "les.ch01.u1.l1",
  "unitId": "unit.ch01.u1",
  "titleTranslations": { "hi": "समानाक्षर स्वर", "en": "Simple vowels" },
  "exercises": [
    { "id": "ex.ch01.001", "type": "akshara-select", "target": "अ",
      "options": ["अ", "आ", "इ", "उ"],
      "promptTranslations": { "hi": "सबसे पहला स्वर चुनो", "en": "Pick the first vowel of the वर्णमाला" },
      "conceptId": "con.ch01.svara", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.002", "type": "akshara-select", "target": "आ",
      "options": ["अ", "आ", "ई", "ऊ"],
      "promptTranslations": { "hi": "'अ' का दीर्घ रूप चुनो", "en": "Pick the long form of अ" },
      "conceptId": "con.ch01.hrasva-dirgha", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.003", "type": "akshara-select", "target": "इ",
      "options": ["इ", "ई", "उ", "ऋ"],
      "promptTranslations": { "hi": "'ई' का ह्रस्व रूप चुनो", "en": "Pick the short form of ई" },
      "conceptId": "con.ch01.svara", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.004", "type": "akshara-select", "target": "ऊ",
      "options": ["उ", "ऊ", "ओ", "औ"],
      "promptTranslations": { "hi": "'उ' का दीर्घ रूप चुनो", "en": "Pick the long form of उ" },
      "conceptId": "con.ch01.hrasva-dirgha", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.005", "type": "akshara-select", "target": "ऋ",
      "options": ["ऋ", "ऌ", "इ", "उ"],
      "promptTranslations": { "hi": "'कृषि' शब्द में जो स्वर है, वह चुनो", "en": "Pick the vowel heard in कृषि" },
      "conceptId": "con.ch01.svara", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.006", "type": "akshara-build", "target": "कि",
      "conceptId": "con.ch01.svara", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.007", "type": "akshara-build", "target": "की",
      "conceptId": "con.ch01.hrasva-dirgha", "source": "ncert-deepakam-ch01" },
    { "id": "ex.ch01.008", "type": "akshara-build", "target": "कु",
      "conceptId": "con.ch01.svara", "source": "ncert-deepakam-ch01" }
  ]
}
```

Exercises 006 to 008 pair a matra with its independent vowel, which is what makes the ह्रस्व/दीर्घ distinction concrete rather than a table to memorise.

Also create `packages/content/src/data/ch01/index.ts` so consumers import from
the package surface rather than reaching into `src/data/`:
```ts
import lessonJson from './lesson-01.json';
import lexemesJson from './lexemes.json';
import conceptsJson from './concepts.json';

export const ch01Lesson: unknown = lessonJson;
export const ch01Lexemes: unknown[] = lexemesJson;
export const ch01Concepts: unknown[] = conceptsJson;
```
They are exported as `unknown` deliberately: callers must run them through the
Zod schemas, so a malformed JSON edit fails loudly at the boundary rather than
being trusted because TypeScript inferred a shape from the file.

Add `export * from './data/ch01';` to `packages/content/src/index.ts`, and set
`"resolveJsonModule": true` in `packages/content/tsconfig.json`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/content test ch01`
Expected: PASS, 5 cases.

- [ ] **Step 6: Run the content lint**

Run: `pnpm --filter @sanskritify/content-cli exec tsx src/cli.ts lint:content`
Expected: 0 findings. Chapter 1 has no lexemes, so `lexeme-underused` cannot fire.

- [ ] **Step 7: Commit**

```bash
git add packages/content
git commit -m "Add verified chapter 1 lesson

Text checked against fsde101.pdf; the extraction had वर्णमालां as
वर्मण ालां and स्वतन्त्ररूपेण as स्वतन्त्ररूपणे among others. The build
exercises pair each matra with its independent vowel so the short/long
distinction is something the learner does rather than memorises."
```

---

### Task 14: Expo app skeleton with bundled font

**Files:**
- Create: `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/tsconfig.json`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`
- Create: `apps/mobile/assets/fonts/NotoSansDevanagari-Regular.ttf`, `apps/mobile/assets/fonts/NotoSansDevanagari-Bold.ttf`

**Interfaces:**
- Consumes: nothing
- Produces: a running Expo app; font family names `NotoDeva` and `NotoDeva-Bold`

- [ ] **Step 1: Scaffold the app**

Run: `pnpm create expo-app apps/mobile --template blank-typescript`

Then edit `apps/mobile/package.json` to add the workspace deps and expo-router:
```json
{
  "name": "@sanskritify/mobile",
  "main": "expo-router/entry",
  "dependencies": {
    "@sanskritify/core": "workspace:*",
    "@sanskritify/content": "workspace:*",
    "@sanskritify/sanskrit": "workspace:*",
    "expo": "~54.0.0",
    "expo-router": "~4.0.0",
    "expo-font": "~13.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "~4.12.0",
    "react-native-screens": "~4.1.0"
  },
  "scripts": {
    "start": "expo start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

- [ ] **Step 2: Enable the New Architecture and register the scheme**

`apps/mobile/app.json`:
```json
{
  "expo": {
    "name": "Sanskritify",
    "slug": "sanskritify",
    "scheme": "sanskritify",
    "newArchEnabled": true,
    "ios": { "supportsTablet": true, "bundleIdentifier": "app.sanskritify" },
    "android": { "package": "app.sanskritify" },
    "plugins": ["expo-router", "expo-font"]
  }
}
```

- [ ] **Step 3: Download and bundle the font**

Download Noto Sans Devanagari (SIL Open Font License) from Google Fonts into `apps/mobile/assets/fonts/`.

System Devanagari differs between iOS and Android, and some conjuncts fall back to a half-form plus a visible virama rather than a ligature — so `क्ष` would look like a different character depending on the phone. This is why the font is bundled rather than assumed.

- [ ] **Step 4: Load the font at the root**

`apps/mobile/app/_layout.tsx`:
```tsx
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoDeva: require('../assets/fonts/NotoSansDevanagari-Regular.ttf'),
    'NotoDeva-Bold': require('../assets/fonts/NotoSansDevanagari-Bold.ttf'),
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Add a conjunct rendering check screen**

`apps/mobile/app/index.tsx`:
```tsx
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// These five conjuncts are the ones that most often fall back to a visible
// virama on a system font. If they render as ligatures here, the bundled
// font is working.
const CONJUNCTS = ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व'];

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>संस्कृतम्</Text>
      <Text style={styles.conjuncts}>{CONJUNCTS.join('  ')}</Text>
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

- [ ] **Step 6: Verify on both platforms**

Run: `pnpm --filter @sanskritify/mobile start`

Open on an iOS simulator and an Android emulator. Confirm all five conjuncts render as single ligatures with no visible virama, and that they look identical on both. If they differ, the font did not load — check the `expo-font` plugin registration before continuing.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "Add Expo app skeleton with bundled Devanagari font

Noto Sans Devanagari is bundled rather than assumed because system fonts
differ across iOS and Android and some conjuncts fall back to a visible
virama. The home screen renders five known-difficult conjuncts as a check."
```

---

### Task 15: Akshara composer component

**Files:**
- Create: `apps/mobile/src/components/AksharaComposer.tsx`
- Test: `apps/mobile/src/components/AksharaComposer.test.tsx`
- Modify: `apps/mobile/package.json` to add test deps

**Interfaces:**
- Consumes: `Akshara`, `AksharaPart`, `composeAkshara` from `@sanskritify/sanskrit`
- Produces:
  ```tsx
  export interface AksharaComposerProps {
    value: Akshara;
    onChange: (next: Akshara) => void;
    consonants?: string[];
    matras?: string[];
  }
  export function AksharaComposer(props: AksharaComposerProps): JSX.Element;
  ```

The component is controlled and holds no state of its own, so the reducer logic stays testable.

- [ ] **Step 1: Add test dependencies**

Add to `apps/mobile/package.json` devDependencies:
```json
{
  "@testing-library/react-native": "^12.7.0",
  "react-test-renderer": "18.3.1",
  "jest-expo": "~52.0.0"
}
```

Add the script: `"test": "jest"`, and `"jest": { "preset": "jest-expo" }`.

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/components/AksharaComposer.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from './AksharaComposer';

const empty: Akshara = { parts: [], matra: null };

describe('AksharaComposer', () => {
  it('appends a consonant when its key is pressed', () => {
    const onChange = jest.fn();
    const { getByText } = render(<AksharaComposer value={empty} onChange={onChange} />);
    fireEvent.press(getByText('क'));
    expect(onChange).toHaveBeenCalledWith({ parts: [{ consonant: 'क', halant: false }], matra: null });
  });

  it('marks the last part halant when the virama key is pressed', () => {
    const onChange = jest.fn();
    const value: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: null };
    const { getByText } = render(<AksharaComposer value={value} onChange={onChange} />);
    fireEvent.press(getByText('्'));
    expect(onChange).toHaveBeenCalledWith({ parts: [{ consonant: 'क', halant: true }], matra: null });
  });

  it('sets the matra when a matra key is pressed', () => {
    const onChange = jest.fn();
    const value: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: null };
    const { getByText } = render(<AksharaComposer value={value} onChange={onChange} />);
    fireEvent.press(getByText('ि'));
    expect(onChange).toHaveBeenCalledWith({ parts: [{ consonant: 'क', halant: false }], matra: 'ि' });
  });

  it('shows the composed preview', () => {
    const ksha: Akshara = {
      parts: [{ consonant: 'क', halant: true }, { consonant: 'ष', halant: false }],
      matra: null,
    };
    const { getByTestId } = render(<AksharaComposer value={ksha} onChange={jest.fn()} />);
    expect(getByTestId('preview').props.children).toBe('क्ष');
  });

  it('backspace removes the matra before removing a consonant', () => {
    const onChange = jest.fn();
    const value: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: 'ि' };
    const { getByTestId } = render(<AksharaComposer value={value} onChange={onChange} />);
    fireEvent.press(getByTestId('backspace'));
    expect(onChange).toHaveBeenCalledWith({ parts: [{ consonant: 'क', halant: false }], matra: null });
  });

  it('ignores a matra press when no consonant has been chosen', () => {
    const onChange = jest.fn();
    const { getByText } = render(<AksharaComposer value={empty} onChange={onChange} />);
    fireEvent.press(getByText('ि'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/mobile test`
Expected: FAIL, `Cannot find module './AksharaComposer'`.

- [ ] **Step 4: Write minimal implementation**

`apps/mobile/src/components/AksharaComposer.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { composeAkshara, type Akshara } from '@sanskritify/sanskrit';

const DEFAULT_CONSONANTS = [
  'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ',
  'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न',
  'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व',
  'श', 'ष', 'स', 'ह',
];

const DEFAULT_MATRAS = ['ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः'];

const VIRAMA_KEY = '्';

export interface AksharaComposerProps {
  value: Akshara;
  onChange: (next: Akshara) => void;
  consonants?: string[];
  matras?: string[];
}

export function AksharaComposer({
  value,
  onChange,
  consonants = DEFAULT_CONSONANTS,
  matras = DEFAULT_MATRAS,
}: AksharaComposerProps) {
  function pressConsonant(c: string): void {
    onChange({ ...value, parts: [...value.parts, { consonant: c, halant: false }] });
  }

  function pressVirama(): void {
    if (value.parts.length === 0) return;
    const parts = value.parts.map((p, i) =>
      i === value.parts.length - 1 ? { ...p, halant: true } : p,
    );
    onChange({ ...value, parts });
  }

  function pressMatra(m: string): void {
    // A matra has nothing to attach to without a consonant.
    if (value.parts.length === 0) return;
    onChange({ ...value, matra: m });
  }

  function backspace(): void {
    if (value.matra !== null) {
      onChange({ ...value, matra: null });
      return;
    }
    const last = value.parts[value.parts.length - 1];
    if (last === undefined) return;
    if (last.halant) {
      const parts = value.parts.map((p, i) =>
        i === value.parts.length - 1 ? { ...p, halant: false } : p,
      );
      onChange({ ...value, parts });
      return;
    }
    onChange({ ...value, parts: value.parts.slice(0, -1) });
  }

  return (
    <View style={styles.root}>
      <View style={styles.previewBox}>
        <Text testID="preview" style={styles.preview}>
          {composeAkshara(value)}
        </Text>
      </View>

      <View style={styles.keys}>
        {consonants.map((c) => (
          <Pressable
            key={c} testID={`key-${c}`} style={styles.key}
            onPress={() => pressConsonant(c)}
          >
            <Text style={styles.keyText}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.keys}>
        <Pressable
          testID="key-virama" style={[styles.key, styles.viramaKey]}
          onPress={pressVirama}
        >
          <Text style={styles.keyText}>{VIRAMA_KEY}</Text>
        </Pressable>
        {matras.map((m) => (
          <Pressable
            key={m} testID={`key-${m}`} style={styles.key}
            onPress={() => pressMatra(m)}
          >
            <Text style={styles.keyText}>{m}</Text>
          </Pressable>
        ))}
        <Pressable testID="backspace" style={styles.key} onPress={backspace}>
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, alignItems: 'center' },
  previewBox: {
    minHeight: 96, minWidth: 160, borderRadius: 16, borderWidth: 2,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
  },
  preview: { fontFamily: 'NotoDeva', fontSize: 56 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  key: {
    minWidth: 44, minHeight: 44, borderRadius: 10, borderWidth: 1,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8,
  },
  viramaKey: { backgroundColor: '#fff4e5' },
  keyText: { fontFamily: 'NotoDeva', fontSize: 22 },
});
```

Key targets are 44pt minimum, which is the accessibility floor and matters more than usual for eleven-year-olds on small phones.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sanskritify/mobile test`
Expected: PASS, 6 cases.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "Add the akshara composer

Controlled component holding parts rather than a string, so composition
avoids matra reordering entirely and a wrong answer can report which part
was wrong. Pressing virama visibly turns क into क्, which is the whole
lesson of chapter 2."
```

---

### Task 16: Lesson screen, playable end to end

**Files:**
- Create: `apps/mobile/src/components/MatchPairs.tsx`, `apps/mobile/src/screens/LessonScreen.tsx`, `apps/mobile/app/lesson/[id].tsx`, `apps/mobile/src/content/loadLesson.ts`
- Test: `apps/mobile/src/screens/LessonScreen.test.tsx`

**Interfaces:**
- Consumes: `createSession`, `submitAnswer`, `currentExercise`, `GradeContext` from `@sanskritify/core`; `AksharaComposer` from Task 15; chapter 1 JSON from Task 13
- Produces: a playable lesson at route `/lesson/:id`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/screens/LessonScreen.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { LessonScreen } from './LessonScreen';

describe('LessonScreen', () => {
  // The HUD renders strings like "♥ 5" and "1 / 8", so assertions are against
  // string content, not numbers.
  it('shows five hearts at the start', () => {
    const { getByTestId } = render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    expect(getByTestId('hearts').props.children).toContain('5');
  });

  it('never renders the target for akshara-select, which would be the answer', () => {
    const { queryAllByText } = render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    // अ appears exactly once, as an option tile — not also as a prompt.
    expect(queryAllByText('अ')).toHaveLength(1);
  });

  it('advances to the next exercise after a correct answer', () => {
    const { getByTestId } = render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    // Exercise 1 is akshara-select with target अ.
    fireEvent.press(getByTestId('opt-अ'));
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('progress').props.children).toContain('2');
  });

  it('loses a heart on a wrong answer', () => {
    const { getByTestId } = render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    fireEvent.press(getByTestId('opt-आ')); // wrong; target is अ
    fireEvent.press(getByTestId('check'));
    expect(getByTestId('hearts').props.children).toContain('4');
  });

  it('shows the matra hint on a near-miss without losing a heart', () => {
    const { getByTestId, queryByText } = render(
      <LessonScreen lessonId="les.ch01.u1.l1" startIndex={5} />,
    );
    // Exercise 6 is akshara-build with target कि. Build की instead.
    fireEvent.press(getByTestId('key-क'));
    fireEvent.press(getByTestId('key-ी'));
    fireEvent.press(getByTestId('check'));
    expect(queryByText(/मात्रा/)).toBeTruthy();
    expect(getByTestId('hearts').props.children).toContain('5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sanskritify/mobile test LessonScreen`
Expected: FAIL, `Cannot find module './LessonScreen'`.

- [ ] **Step 3: Write the content loader**

`apps/mobile/src/content/loadLesson.ts`:
```ts
import {
  LessonSchema, LexemeSchema, ch01Lesson, ch01Lexemes,
  type Lesson, type Lexeme,
} from '@sanskritify/content';

// Bundled content only. Task 12's pack build and OTA delivery replace this
// in a later plan; the shape of what the screen consumes does not change.
const LESSONS: Record<string, unknown> = {
  'les.ch01.u1.l1': ch01Lesson,
};

export function loadLesson(id: string): Lesson {
  const raw = LESSONS[id];
  if (raw === undefined) throw new Error(`unknown lesson: ${id}`);
  return LessonSchema.parse(raw);
}

export function loadLexemes(): Map<string, Lexeme> {
  const list = ch01Lexemes.map((l) => LexemeSchema.parse(l));
  return new Map(list.map((l) => [l.id, l]));
}
```

- [ ] **Step 4: Write the match-pairs renderer**

`apps/mobile/src/components/MatchPairs.tsx`:
```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lexeme, LocaleCode } from '@sanskritify/content';

export interface MatchPairsProps {
  lexemes: Lexeme[];
  locale: LocaleCode;
  onChange: (pairs: Array<{ lexemeId: string; gloss: string }>) => void;
}

export function MatchPairs({ lexemes, locale, onChange }: MatchPairsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Array<{ lexemeId: string; gloss: string }>>([]);

  const glosses = lexemes.map((l) => l.translations[locale]).sort();

  function pickGloss(gloss: string): void {
    if (selected === null) return;
    const next = [...pairs.filter((p) => p.lexemeId !== selected), { lexemeId: selected, gloss }];
    setPairs(next);
    setSelected(null);
    onChange(next);
  }

  return (
    <View style={styles.row}>
      <View style={styles.column}>
        {lexemes.map((l) => (
          <Pressable
            key={l.id}
            testID={`lex-${l.id}`}
            style={[styles.tile, selected === l.id && styles.tileActive]}
            onPress={() => setSelected(l.id)}
          >
            <Text style={styles.deva}>{l.devanagari}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.column}>
        {glosses.map((g) => (
          <Pressable key={g} testID={`gloss-${g}`} style={styles.tile} onPress={() => pickGloss(g)}>
            <Text style={styles.gloss}>{g}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16 },
  column: { flex: 1, gap: 8 },
  tile: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#d0d7de',
    alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  tileActive: { borderColor: '#1a7f37', backgroundColor: '#eaf6ec' },
  deva: { fontFamily: 'NotoDeva', fontSize: 22 },
  gloss: { fontSize: 16 },
});
```

- [ ] **Step 5: Write the lesson screen**

`apps/mobile/src/screens/LessonScreen.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createSession, currentExercise, submitAnswer,
  type Answer, type GradeContext, type GradeResult, type SessionState,
} from '@sanskritify/core';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from '../components/AksharaComposer';
import { MatchPairs } from '../components/MatchPairs';
import { loadLesson, loadLexemes } from '../content/loadLesson';

const EMPTY_AKSHARA: Akshara = { parts: [], matra: null };

const HINT_TEXT: Record<string, { hi: string; en: string }> = {
  'matra-differs': {
    hi: 'सही अक्षर, गलत मात्रा',
    en: 'Right consonant, wrong vowel mark',
  },
};

export interface LessonScreenProps {
  lessonId: string;
  locale?: 'hi' | 'en';
  startIndex?: number;
}

export function LessonScreen({ lessonId, locale = 'hi', startIndex = 0 }: LessonScreenProps) {
  const lesson = useMemo(() => loadLesson(lessonId), [lessonId]);
  const ctx: GradeContext = useMemo(() => ({ lexemes: loadLexemes(), locale }), [locale]);

  const [session, setSession] = useState<SessionState>(() => ({
    ...createSession(lesson, { hearts: 5, maxHearts: 5 }),
    index: startIndex,
  }));
  const [draft, setDraft] = useState<Answer | null>(null);
  const [akshara, setAkshara] = useState<Akshara>(EMPTY_AKSHARA);
  const [result, setResult] = useState<GradeResult | null>(null);

  const exercise = currentExercise(session);

  function check(): void {
    if (exercise === null) return;
    const answer: Answer =
      exercise.type === 'akshara-build' ? { kind: 'akshara', akshara } : draft ?? { kind: 'choice', value: '' };
    const next = submitAnswer(session, answer, ctx);
    setSession(next.state);
    setResult(next.result);
    setDraft(null);
    setAkshara(EMPTY_AKSHARA);
  }

  if (exercise === null || session.status !== 'in_progress') {
    return (
      <View style={styles.screen}>
        <Text style={styles.big}>{session.status === 'complete' ? 'साधु!' : 'पुनः प्रयत्नं कुरु'}</Text>
        <Text testID="xp">XP {session.xp}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hud}>
        <Text testID="progress">{`${session.index + 1} / ${session.queue.length}`}</Text>
        <Text testID="hearts">{`♥ ${session.hearts}`}</Text>
      </View>

      {exercise.type === 'akshara-select' && (
        <>
          {/* Never render exercise.target here. The target is one of the
              options, so showing it would display the answer. */}
          <Text style={styles.prompt}>{exercise.promptTranslations[locale]}</Text>
          <View style={styles.options}>
            {exercise.options.map((o) => (
              <Pressable
                key={o}
                testID={`opt-${o}`}
                style={[
                  styles.option,
                  draft?.kind === 'choice' && draft.value === o && styles.optionActive,
                ]}
                onPress={() => setDraft({ kind: 'choice', value: o })}
              >
                <Text style={styles.deva}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {exercise.type === 'akshara-build' && (
        <>
          <Text style={styles.prompt}>
            {locale === 'hi' ? 'यह अक्षर बनाओ' : 'Build this letter'}
          </Text>
          <Text style={styles.target}>{exercise.target}</Text>
          <AksharaComposer value={akshara} onChange={setAkshara} />
        </>
      )}

      {exercise.type === 'match-pairs' && (
        <MatchPairs
          lexemes={exercise.lexemeIds.map((id) => ctx.lexemes.get(id)!).filter(Boolean)}
          locale={locale}
          onChange={(pairs) => setDraft({ kind: 'pairs', pairs })}
        />
      )}

      {result !== null && result.hint !== null && (
        <Text style={styles.hint}>{HINT_TEXT[result.hint]![locale]}</Text>
      )}

      <Pressable testID="check" style={styles.check} onPress={check}>
        <Text style={styles.checkText}>{locale === 'hi' ? 'जाँचो' : 'Check'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 20, justifyContent: 'center' },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  prompt: { fontSize: 18, textAlign: 'center' },
  target: { fontFamily: 'NotoDeva', fontSize: 64, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  option: {
    minWidth: 72, minHeight: 72, borderRadius: 14, borderWidth: 2,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
  },
  optionActive: { borderColor: '#1a7f37', backgroundColor: '#eaf6ec' },
  deva: { fontFamily: 'NotoDeva', fontSize: 32 },
  hint: { textAlign: 'center', color: '#9a6700', fontSize: 16 },
  check: {
    backgroundColor: '#1a7f37', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  checkText: { color: 'white', fontSize: 18, fontWeight: '600' },
  big: { fontFamily: 'NotoDeva', fontSize: 40, textAlign: 'center' },
});
```

Option tiles carry `testID={`opt-${o}`}` so tests select them unambiguously, and the composer keys already carry `testID={`key-${c}`}` from Task 15. Do not edit `AksharaComposer.tsx` in this task.

- [ ] **Step 6: Wire the route**

`apps/mobile/app/lesson/[id].tsx`:
```tsx
import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '../../src/screens/LessonScreen';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LessonScreen lessonId={id} />;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @sanskritify/mobile test`
Expected: PASS, composer and screen tests green.

- [ ] **Step 8: Play it on both platforms**

Run: `pnpm --filter @sanskritify/mobile start`

On an iOS simulator and an Android emulator, play `les.ch01.u1.l1` start to finish. Confirm: hearts drop only on wrong answers, the matra hint appears on a near-miss without costing a heart, the composer preview updates as keys are pressed, and finishing shows 15 XP for a flawless run.

- [ ] **Step 9: Run everything**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all green across all packages.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile
git commit -m "Add the lesson screen, playable end to end

Renders akshara-select, akshara-build and match-pairs over the core session
reducer. The screen holds no lesson logic of its own; hearts, XP, re-queues
and verdicts all come from the engine, so the rules stay unit tested."
```

---

## Self-review

**Spec coverage.** §3.1 repo layout → Tasks 1, 6, 7, 10, 14. §3.2 purity boundary → Task 1 lint rule. §3.4 streak as a date set → Task 9. §3.5 stack → Tasks 1, 14. §4.1 four record types → Task 6. §4.2 exercise types → Task 6 schema; three renderers in Tasks 15, 16. §4.3 grading and normalisation → Tasks 3, 7. §4.4 i18n → partial: `TranslationsSchema` in Task 6 and inline `locale` prop in Task 16; the ICU locale-pack package is **not** built here and is listed below as a known gap. §5 pipeline → Tasks 10, 11, 12, 13. §6.1 session reducer → Task 8. §6.4 composer → Tasks 5, 15. §7 XP → Task 8; hearts → Tasks 8, 9.

**Deliberate gaps, all deferred to later plans:** `packages/i18n` and `packages/ui` are referenced in the spec's file layout but not created here — Task 16 passes `locale` as a prop and inlines the two hint strings, which is honest for one lesson and must be replaced before chapter 3. Audio, review scheduling, the path UI, and the backend are all out of scope as stated at the top. `acceptedForms` is in the schema but unused until translation exercises exist.

**Type consistency check.** `Akshara` and `AksharaPart` (Task 5) are consumed unchanged by Tasks 7, 15, 16. `GradeResult` is `{ verdict, hint }` in Tasks 7, 8, 16. `SessionState.queue` grows on re-queue, so Task 16 reads `session.queue.length` rather than the lesson length — correct. `ExerciseSchemaWithRefinements` is the exported union because `akshara-select` carries a `.refine` and cannot join a `discriminatedUnion`; Task 6 step 4 notes the test import alias, and `Exercise` is inferred from the union, so Tasks 7, 8, 12 all type-check against it.
