# Sanskritify

A Duolingo-style app teaching Class 6 Sanskrit to children in India, from the
NCERT textbook दीपकम् भाग १. React Native via Expo, iOS and Android.

- Spec: `docs/superpowers/specs/2026-08-15-sanskritify-design.md`
- Active plan: `docs/superpowers/plans/2026-08-16-foundation-and-chapter-1.md`
- Prose style: `docs/STYLE-GUIDE.md`
- Engineering conventions: `docs/ENGINEERING.md`

Read the spec before making a design decision. It already answers most
"why is it like this" questions, and the answers are load-bearing.

## Layout

```
apps/mobile        Expo app. Screens, navigation, animation. UI only.
packages/core      lesson engine, grading, review scheduling. Pure TS.
packages/sanskrit  Devanagari: segmentation, normalisation, composition.
packages/content   chapter data + Zod schemas.
packages/i18n      locale packs.
packages/ui        shared components + design tokens.
tools/content-cli  extract · lint · build · audio manifest.
services/supabase  migrations, RLS policies.
Class6/            source PDFs. Never edit.
```

## Rules that are not negotiable

**`packages/core` and `packages/sanskrit` must not import React, React
Native, or Expo.** An eslint rule enforces it. These packages are the only
place the hard logic lives, and they stay testable in milliseconds without a
simulator. If you need platform APIs there, the design is wrong — pass the
value in.

**Never store a streak counter.** Store the set of activity days and derive
the length. A counter cannot merge across two offline devices; a set unions
without conflict.

**Only a `wrong` verdict costs a heart.** `near-miss` re-queues for free. A
`near-miss` is narrow: consonant sequence correct, matra or halant wrong.

**The composer holds parts, not a string.** `Akshara` is
`{ parts: AksharaPart[], matra: string | null, sign: string | null }`.
Anusvara and visarga get their own `sign` slot because they are written after
the matra — filing them as a part or a matra reorders the composed string.
Editing Devanagari strings directly means fighting matra reordering; editing
parts does not.

**Devanagari logic lives in `packages/sanskrit` and nowhere else.** The
composer and the content validator must agree exactly, or the app accepts
answers CI rejects.

**Never trust `pdftotext` output.** It reorders conjuncts — `वर्णमालां`
extracts as `वर्मण ालां`. Raw extractions are drafts. Content is only correct
after a human checks it against the PDF.

**No third-party analytics or advertising SDKs, ever.** Every user is legally
a child under India's DPDP Act, which sets the threshold at 18. First-party
logging only.

**Bundle the Devanagari font.** System fonts render conjuncts differently on
iOS and Android.

## Commits

What changed and why. No AI, tool, or generation attribution — no
`Co-Authored-By`, no "generated with" footers. Same for PR titles and bodies.

## Commands

```
pnpm test        all packages
pnpm typecheck   all packages
pnpm lint        all packages
pnpm --filter @sanskritify/<pkg> test
```
