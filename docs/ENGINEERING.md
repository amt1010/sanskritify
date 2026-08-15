# Engineering conventions

How we write code here. Short, because a long conventions doc is a doc nobody
reads.

## TypeScript

`strict: true` and `noUncheckedIndexedAccess: true` everywhere. Both are on in
`tsconfig.base.json` and neither gets turned off per-package.

No `any`. If you genuinely need one, add a comment on the same line saying
why. `unknown` plus a narrowing check is almost always what you wanted.

Prefer `type` for unions and `interface` for object shapes that others
implement or extend. Don't agonise over it.

Export types alongside the code that produces them. A consumer should get the
function and its types from one import.

## Files and boundaries

One responsibility per file. When a file starts needing a table of contents in
your head, split it.

Files that change together live together. Split by responsibility, not by
technical layer — `akshara.ts` holds segmentation, parsing, composition, and
diffing because they change as a unit, not spread across `parsers/`,
`utils/`, and `helpers/`.

A package's public surface is its `index.ts`. Import from
`@sanskritify/sanskrit`, not from `@sanskritify/sanskrit/src/akshara`.

Pure logic does not import platform APIs. Not React, not React Native, not
`Date.now()`, not `fetch`. Pass time and I/O in as arguments — that is why
`currentHearts(stored, updatedAt, now, max)` takes `now` instead of reading
the clock.

## Tests

Test-driven. Write the failing test, watch it fail for the right reason,
write the smallest thing that passes, commit.

Watching it fail matters. A test that passes before the implementation exists
is testing nothing, and you will not find out for weeks.

Test behaviour, not implementation. `streakLength(['2026-08-15'], '2026-08-16')
=== 1` is behaviour. Asserting that it called an internal helper is not.

Table-driven tests for anything with many cases — character classification,
normalisation, corruption rules. `it.each` keeps them readable.

Name the case, not the function. `it('marks a wrong matra as a near-miss')`
beats `it('gradeAnswer works')`.

Cover the edge that will actually break: empty input, a backwards clock,
duplicate entries, a conjunct three consonants deep.

## Errors

Fail loudly at the boundary, never in the middle. Content is validated by Zod
when it is loaded; after that the types are trusted and the code does not
re-check.

Throw with the value in the message. `chapter must be between 1 and 16, got
17` — not `invalid chapter`.

Don't swallow errors to make a test pass. If something can't happen, let it
throw; if it can, handle it explicitly.

## Comments

Comment why, not what. `// A backwards clock yields negative elapsed time.
Children do change the device clock.` earns its place. `// increment i` does
not.

The Sanskrit and Unicode reasoning is worth commenting every time. Nobody
reading `CLASS_NASAL_VIRAMA` six months from now will remember that दीपकम्
spells the same word both ways.

Comments follow `docs/STYLE-GUIDE.md` like any other prose.

## Naming

Say what it is. `segmentAksharas`, not `process`. `activityDays`, not `data`.

Devanagari-domain names use the Sanskrit term, because there is no good
English equivalent and the textbook uses it: `akshara`, `matra`, `virama`,
`lexeme`. Don't invent `letterPart`.

Booleans read as assertions: `isConsonant`, `halant`, `enabled`.

## Commits

Small and frequent. One logical change per commit — the TDD cycle is a
natural commit boundary.

Subject line in the imperative, under ~60 characters. Body explains why, and
mentions any decision a reader would otherwise have to reverse-engineer.

No AI, tool, or generation attribution of any kind.

## Dependencies

Add one only when writing it ourselves is clearly worse. Every dependency is
a thing that breaks on an Expo upgrade.

Nothing that phones home. See the DPDP rules in `CLAUDE.md`.
