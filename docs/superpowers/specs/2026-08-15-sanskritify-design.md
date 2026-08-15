# Sanskritify — design

A Duolingo-style app that teaches Class 6 Sanskrit to children in India,
following the NCERT textbook दीपकम् भाग १.

Date: 2026-08-15
Status: approved, ready for implementation planning

---

## 1. What we're building

A React Native app, iOS and Android, built with Expo, that turns the 16
chapters of दीपकम् into a game an eleven-year-old will open every day.

The source material is in `Class6/` — `fsde100.pdf` (front matter and
contents) plus `fsde101.pdf` through `fsde116.pdf`, one per chapter. This is
NCERT's दीपकम् भाग १, first edition June 2024, aligned to NEP 2020 and
NCF-SE 2023. It is the first Sanskrit textbook most Indian students ever
see.

| # | Chapter | Teaches |
|---|---|---|
| 1 | वयं वर्णमालां पठामः | vowels, consonants |
| 2 | संयुक्त-व्यञ्जनानि | conjunct consonants |
| 3 | एषः कः? एषा का? एतत् किम्? | gender, three numbers, pronouns |
| 4 | अहं च त्वम् च | self-introduction, professions |
| 5 | संख्यागणना ननु सरला | numbers |
| 6 | अहं प्रातः उत्तिष्ठामि | daily routine, present tense |
| 7 | शूराः वयं धीराः वयम् | song |
| 8 | सः एव महान् चित्रकारः | narrative |
| 9 | अतिथिदेवो भव | narrative |
| 10 | बुद्धिः सर्वार्थसाधिका | story |
| 11 | यः जानाति सः पण्डितः | riddles (प्रहेलिका) |
| 12 | त्वम् आपणं गच्छ | dialogue, imperatives |
| 13 | पृथिव्यां त्रीणि रत्नानि | narrative |
| 14 | आलस्यं हि... महान् रिपुः | dialogue |
| 15 | माधवस्य प्रियम् अङ्गम् | body parts |
| 16 | वृक्षाः सत्पुरुषाः इव | environment |

### Decisions taken

| Question | Decision |
|---|---|
| Audience | Real Class 6 students. Store-shipped, not a demo. |
| Content scope | All 16 chapters, in depth. |
| Instruction languages | Ship Hindi + English. Build i18n plumbing for N languages. |
| Gamification | Core loop plus audio. No leagues, no gem shop, no parent dashboard in v1. |
| Audio | Human-recorded Sanskrit. Listening exercises only; no speaking in v1. |
| Answer input | Word-bank tiles plus a custom अक्षर composer. |
| Architecture | Content-as-data monorepo, offline-first app, thin backend. |
| Content source | दीपकम् text directly for v1. Original authored content later. |

### Out of scope for v1

Leagues and leaderboards. Gem economy and shop. Parent/teacher dashboard.
Speaking exercises. A web authoring studio — content is authored through
`content-cli` and a text editor. Classes 7–12.

Each of these is designed *around* rather than designed *out*: the schema
reserves a `speak` exercise type, the backend schema supports the shop
without changing, and the content packages are already keyed by course so
Class 7 is a new data directory, not a new app.

---

## 2. Two problems that shape everything

### 2.1 No production-grade Sanskrit ASR exists

`SFSpeechRecognizer` on iOS and Android's speech APIs have no `sa-IN`
locale. Using `hi-IN` as a proxy mis-hears visarga, conjuncts, and vowel
length — precisely the distinctions chapters 1 and 2 exist to teach. A
child pronouncing `रामः` correctly would be marked wrong.

So v1 has listening exercises and no speaking exercises. The `speak` type
exists in the schema, disabled, so adding it later is a content and UI
change with no model migration.

For the same reason we do not use text-to-speech. Hindi TTS reading
Devanagari flattens visarga, mangles conjuncts, and ignores vowel length.
Shipping it would teach wrong pronunciation to real children. All audio is
recorded by a human Sanskrit speaker.

### 2.2 `pdftotext` reorders Devanagari conjuncts

Extraction produces real Unicode, but conjuncts and matras come out in the
wrong order:

| In the PDF | Out of `pdftotext` |
|---|---|
| वर्णमालां | वर्मण ालां |
| मनुष्याणां | मनषु ्याणां |
| वृक्ष | वकृ ्ष |
| स्वतन्त्ररूपेण | स्वतन्त्ररूपणे |

Extraction cannot be the content source. It is a *draft* that a human
verifies against the PDF. Section 5 describes how we make that cheap
instead of eliminating it, which is not possible.

---

## 3. Architecture

### 3.1 Repo layout

```
sanskritify/
├── apps/
│   └── mobile/            Expo app. Screens, navigation, animation. UI only.
├── packages/
│   ├── core/              lesson engine, grading, SRS, progression. Pure TS.
│   ├── sanskrit/          Devanagari: akshara segmentation, normalisation.
│   ├── content/           chapter data + Zod schemas + bundle builder.
│   ├── i18n/              locale packs, ICU messages.
│   └── ui/                shared RN components + design tokens.
├── tools/
│   └── content-cli/       extract · lint · build · audio manifest.
├── services/
│   └── supabase/          migrations, RLS policies.
├── docs/
└── Class6/                source PDFs, untouched.
```

pnpm workspaces plus Turborepo. TypeScript in strict mode everywhere.

### 3.2 Why these boundaries

**`packages/core` imports nothing from React Native.** The lesson engine,
answer grading, heart accounting, XP arithmetic, and review scheduling are
plain functions over plain data. They run under Vitest in milliseconds with
no Metro bundler, no simulator, no emulator. This is the code most likely
to be wrong and the most expensive to test through a UI, so it does not
live behind one.

**`packages/sanskrit` is separate from both.** Devanagari grapheme handling
is subtle: `क्ष` is four codepoints and one akshara; `ि` renders to the
left of the consonant it logically follows. Both the अक्षर composer in the
app and the content validator in tooling need identical segmentation. Two
implementations would drift, and the composer would start accepting answers
the validator rejects. One package, exhaustively tested.

**`packages/ui` holds the design system.** Screens compose it; it never
imports from `core` or `content`.

### 3.3 Data flow

```
chapter JSON  ──build──▶  validated, versioned content pack
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     bundled in binary                  CDN (OTA updates)
              └───────────────┬───────────────┘
                              ▼
                    SQLite content tables
                              ▼
      core engine ──reads──┤ ├──writes attempts──▶ SQLite
                                                      │
                                                 sync outbox
                                                      ▼
                                            Supabase (ap-south-1)
```

Content ships inside the binary so a fresh install works offline on first
launch, and mirrors to a CDN so correcting a visarga in chapter 9 is a data
push rather than a two-week store review.

Local stack is `expo-sqlite` with Drizzle. SQLite is the source of truth
during a session; every answer writes locally before anything touches the
network.

### 3.4 Sync

An outbox table with a monotonic `client_seq` drains to Supabase when
connectivity appears.

Most progress merges trivially because it is monotonic: XP takes `max`,
furthest lesson takes `max`, completed lessons take a union. Last-writer-
wins is safe there.

**Streaks are the exception and are where apps of this kind break.** Stored
as an integer counter, offline play plus a second device produces a counter
that is wrong in both directions with no way to reconstruct the truth. So
we store a **set of activity dates** — one `activity_days` row per local
calendar day the learner met their goal. Streak length is derived from that
set on read. Union is idempotent and order-independent, so it merges across
devices with no conflict logic. The counter is never stored.

Hearts regenerate on a timer (one per 30 minutes), so we store `hearts` and
`hearts_updated_at` and compute the current value on read rather than
running a background timer. Children will change the device clock; on each
sync we clamp against server time. With no shop in v1 there is nothing to
exploit, so that is as far as we take it.

### 3.5 Stack

| Concern | Choice |
|---|---|
| Runtime | Expo SDK 54, React Native New Architecture |
| Navigation | expo-router |
| Animation | Reanimated |
| Local DB | expo-sqlite + Drizzle |
| Backend | Supabase — Postgres, Auth, Storage — region `ap-south-1` |
| Schemas | Zod |
| Unit tests | Vitest |
| E2E | Maestro |
| Font | Noto Sans Devanagari, bundled |

---

## 4. Content model

### 4.1 Atoms

Four record types, referenced by ID. Exercises never inline strings.

**Lexeme** — the vocabulary unit. Stem, gender, declension class, per-locale
gloss, `audioRef`, and the chapters it appears in. `बालकः` appears in
chapters 3, 4, and 6; three copies would drift. One record referenced three
times lets review track *the word* across the course and gives a glossary
screen for free.

**Sentence** — canonical Sanskrit form, `acceptedForms`, per-locale
translations, `audioRef`, and the lexemes it contains.

**Concept** — a grammar note shown before its drills. `विभक्ति-2`,
`लट्-लकार`, `पुंलिङ्ग-अकारान्त`.

**Exercise** — one interaction, referencing lexemes, sentences, and concepts.

Hierarchy on top: `Course → Chapter → Unit → Lesson → Exercise`. The 16
chapters map one-to-one to the book. Each chapter splits into 2–5 units; a
lesson is 8–15 exercises, three to five minutes.

Every record carries `source`: `"ncert-deepakam-ch03"` now, `"original"`
later. The engine never reads it. It exists so the eventual swap to
authored content is a data migration rather than a schema or app change,
and so provenance is auditable.

### 4.2 Exercise types

| Type | Interaction | Where it earns its keep |
|---|---|---|
| `akshara-select` | hear or see, pick the अक्षर | Ch 1 |
| `akshara-build` | compose `क् + ष् + अ = क्ष` | Ch 1–2 |
| `select-image` | Sanskrit word → pick picture | Ch 3–5, 15 |
| `match-pairs` | 5 Sanskrit ↔ meaning pairs | every chapter |
| `translate-to-locale` | Sanskrit → Hindi/English tiles | Ch 4+ |
| `translate-to-sanskrit` | Hindi/English → Sanskrit tiles | Ch 4+ |
| `fill-blank` | choose the right form for a gap | विभक्ति, verb endings |
| `listen-select` | hear audio → pick Devanagari | every chapter |
| `listen-build` | dictation with tiles | Ch 6+ |
| `order-sentence` | arrange scrambled words | Ch 8+ |
| `speak` | defined, disabled in v1 | — |

### 4.3 Grading

```
raw input → normalise → match against acceptedForms → verdict
```

Two things Sanskrit does that a single-string answer key cannot handle:

**Word order is free.** `रामः ग्रामं गच्छति` and `ग्रामं रामः गच्छति` are
both correct. Sentences therefore carry an explicit `acceptedForms` array,
hand-authored. We deliberately do *not* auto-generate permutations — that
would accept word salad that happens to permute correctly.

**Sandhi produces multiple valid spellings.** `रामः + अस्ति → रामोऽस्ति`.
Where the textbook shows both, both are accepted.

Normalisation, implemented once in `packages/sanskrit` and used by both the
app and the content validator:

- Unicode NFC
- strip ZWJ and ZWNJ
- anusvara ↔ class nasal equivalence (`अङ्ग` = `अंग`; दीपकम् itself uses both)
- optional avagraha
- whitespace and danda `।`

Three verdicts, not two: `correct`, `near-miss`, `wrong`. `near-miss` exists
for `akshara-build`, where a learner who builds `क्षि` for target `क्ष`
should see "सही अक्षर, गलत मात्रा" rather than a red cross. Because the
composer's answer is structured parts rather than a string, we know which
part was wrong.

**A `near-miss` does not cost a heart.** It shows the targeted message and
re-queues the exercise, counting against the session's perfect-lesson bonus
but not against hearts. Only `wrong` costs a heart. A `near-miss` is defined
narrowly: the consonant sequence is correct and only the matra or virama
differs. Anything else is `wrong`.

### 4.4 i18n

UI chrome lives in `packages/i18n/locales/{hi,en}.json` as ICU messages.
Content glosses live inside content records as `translations: { hi, en }`,
because translators work chapter by chapter and that is the unit they are
handed.

Locale packs version independently of content packs, so a future Marathi
drop ships without rebuilding content. Fallback chain is requested → `hi` →
`en`. A missing string warns in development and never crashes in
production.

### 4.5 Audio

Content references `audioRef` IDs, never file paths.

`content-cli audio:manifest` emits every lexeme and sentence needing a
recording, grouped by chapter. That output is the script handed to the voice
artist. Recordings return into `packages/content/audio/`, and the manifest
step verifies coverage and fails the build on any gap.

Audio ships to the CDN rather than the binary — the clip count across 16
chapters is an estimate, on the order of 2,000, enough to inflate install
size unacceptably — with chapters 1 and 2 pre-bundled so onboarding works
before any download completes. The manifest step produces the exact count
once chapters are verified.

---

## 5. Content pipeline

1. **`content-cli extract`** — `pdftotext` per chapter into
   `packages/content/raw/ch01.txt`, committed so diffs are visible.

2. **`content-cli lint:raw`** — four corruption-signature rules. Measured
   across the 16 chapter PDFs:

   | Rule | Hits | Signal |
   |---|---|---|
   | space before virama (`मनषु ्याणां`) | 564 | clean |
   | virama + space + consonant (`अङ् गानि`) | 712 | good, some false positives |
   | orphan matra after space (`वर्मण ालां`) | 428 | clean |
   | stray ZWJ / ZWNJ | 786 | clean, mechanical fix |

   About 1,700 flagged sites, roughly 105 per chapter. An author reviews 105
   highlighted spots against the PDF instead of proofreading 16 chapters
   cold.

3. **Human verification** — corrected text lands in
   `packages/content/source/ch01.md` with structured markers. There is no
   way to skip this and still ship correct Sanskrit to children. The lint
   makes it cheap, not unnecessary.

4. **`content-cli lint:content`** — referential integrity:
   - every exercise's lexeme and sentence IDs resolve
   - every `audioRef` has a file in the manifest
   - every sentence has `hi` and `en` translations
   - no duplicate IDs
   - every lesson has at least 6 exercises
   - every concept is introduced before it is drilled
   - **every lexeme is referenced by at least 3 exercises across at least 2
     types** — required by review generation, see 6.3

5. **`content-cli build`** — Zod validation, versioned pack, integrity hash.

CI runs steps 2, 4, and 5 on every push. A malformed chapter cannot merge.

---

## 6. Lesson engine

### 6.1 Session as a pure reducer

`packages/core` exposes two functions and no side effects:

```ts
createSession(lesson: Lesson, opts: SessionOpts): SessionState
submitAnswer(state: SessionState, answer: Answer): { state: SessionState; result: Result }
```

The entire lesson — queue, hearts, correct-answer run, XP accrual,
re-queued mistakes — is a value a test can construct and assert on. The
screen is a thin renderer over `SessionState`.

Lifecycle: `idle → in_progress → complete | failed`.

A wrong answer costs a heart and re-queues that exercise later in the same
session, up to twice. Duolingo repeats until correct; twice is enough
teaching and keeps sessions bounded.

Five hearts, one regenerating every 30 minutes. With no shop in v1, the
only other refill is completing a review lesson — which is the right
incentive, since a learner out of hearts is exactly the learner who should
be reviewing.

### 6.2 Path and progression

`16 chapters → 2–5 units each → 3–6 lessons per unit → unit review →
chapter test`. Linear unlock.

**Per-chapter test-out.** A Class 6 student downloading this in November is
on chapter 7 at school. Forcing them through वर्णमाला drills to reach it
loses them in one session. Passing a chapter test unlocks that chapter. The
test already exists as content, so this is progression logic, not new
content.

Pass threshold is 80% of exercises correct on the first attempt, with no
hearts consumed beyond two. A failed test-out costs nothing and can be
retried after 24 hours; the intent is to let a prepared learner skip ahead,
not to gate anyone out.

### 6.3 Review scheduling

SM-2-lite, keyed to **lexemes and concepts**, not exercises. Strength 0–5,
intervals 1d / 3d / 7d / 16d / 35d / 90d. A correct answer raises strength
by one; a wrong answer drops it by two and makes the item due soon.

Because review is keyed to lexemes, a review lesson is *generated*: pull the
most overdue lexemes, then select exercises referencing them. That is why
the content lint requires each lexeme to appear in at least 3 exercises
across at least 2 types — otherwise an item can only be reviewed one way
and the learner memorises the exercise rather than the word.

### 6.4 The अक्षर composer

```
  target:   क्ष          [🔊]
  ┌──────────────────────────┐
  │        क् + ष            │   live preview, large
  └──────────────────────────┘
  क  ख  ग  घ  ङ  च  छ  ज ...      consonants
  ा  ि  ी  ु  ू  े  ै  ो  ्  ं  ः     matras + virama
```

Tap `क`, it appears. Tap `्`, it visibly becomes the half-form `क्`. Tap
`ष`, and the two join into `क्ष` in front of the learner. That transition
is the entire content of chapter 2, and a printed textbook physically
cannot show it.

Two constraints:

**State is parts, not a string.** `[{c:'क', halant:true}, {c:'ष'}]`,
rendered through `composeAkshara()` in `packages/sanskrit`. Editing a
Devanagari string directly means fighting matra reordering and cursor
placement; editing parts is trivial and yields the `near-miss` diagnostics
described in 4.3.

**Bundle the font.** System Devanagari differs between iOS and Android, and
some conjuncts fall back to explicit half-form-plus-virama instead of a
ligature — so `क्ष` would look like a different character depending on the
phone. Bundling Noto Sans Devanagari makes rendering identical everywhere.
Cheap now, miserable to retrofit.

---

## 7. Gamification

XP: 10 per lesson, +5 for a lesson with no mistakes, 20 for a chapter test.

Daily goal chosen at onboarding: 10 / 20 / 30 / 50 XP.

Streak derived from `activity_days`, never stored as a counter (3.4).

**Streak freezes** — hold at most 2. One is granted for every 7 consecutive
active days, up to the cap of 2. When a day is missed and a freeze is held,
it is spent automatically and the streak survives; the learner is told on
next open. Not purchasable, since there is no shop. A learner who misses a
day because of a school exam should not lose a 40-day streak; that is the
moment they quit. Highest retention per line of code in the app.

**Achievements** — 7-day streak, chapter complete, 100 words learned, 10
perfect lessons. Pure computation over existing tables, no new content.

**Notifications** — a daily reminder at a learner-chosen time via
`expo-notifications`. The streak mechanic is inert without them.

**Mascot** — recommended: शुकः, the parrot of the शुकसप्ततिः fables.
Recognisable to every Indian child, and the "repeat after me" association
suits a language app. हंसः, the swan of विवेक, is the alternative. Art is a
real cost and a real dependency, so it is kept off the engineering critical
path; the app functions with a placeholder.

---

## 8. Backend and children's data

**India's DPDP Act 2023 sets the child threshold at 18, not 13.** Every user
of this app is legally a child. Section 9 requires verifiable parental
consent before processing their data and prohibits behavioural advertising
and tracking directed at children.

What follows:

- **Parent-gated signup.** The parent supplies an email and verifies by OTP,
  then creates the child profile. We store the *parent's* contact, never the
  child's. The child has a display name and an avatar. No email, no phone,
  no real name, no location, no contacts.
- **No third-party analytics or advertising SDKs.** First-party event
  logging into our own Postgres only. This is also what Apple's Kids
  Category and Google Play's Designed for Families require, so building to
  it costs nothing and keeps both store paths open.
- **No leaderboards.** Already out of v1, and ranking real children against
  each other invites exactly the scrutiny we do not want.
- **Data residency in India.** Supabase `ap-south-1`, Mumbai.
- **Parent-initiated deletion** of the child's account and all associated
  data, from inside the app.

### Schema

```
parents        (id, email, created_at)
learners       (id, parent_id, display_name, avatar, locale, daily_goal_xp)
progress       (learner_id, lesson_id, status, best_score, completed_at)
activity_days  (learner_id, day)                        -- streak source of truth
lexeme_srs     (learner_id, lexeme_id, strength, last_seen, next_due)
xp_events      (learner_id, amount, source, client_seq) -- append-only
hearts         (learner_id, count, updated_at)
streak_freezes (learner_id, held, last_granted_day, last_spent_day)
```

One parent, many learners — siblings share an account. Row-level security on
every table resolves to `parent_id` through `learners`, so a parent can only
reach their own children's rows.

Every synced table is append-only or monotonic, which is why the outbox
drains without a conflict-resolution layer.

---

## 9. Testing

Test-driven throughout. The architecture exists partly to make that cheap.

- **`packages/sanskrit`** — table-driven tests over real strings from
  दीपकम्. Normalisation, akshara segmentation, composition. Small, subtle,
  and consumed by two callers that must agree, so it gets the most
  exhaustive coverage in the repo.
- **`packages/core`** — Vitest over the session reducer, grading verdicts,
  SRS intervals, heart regeneration, and streak derivation from date sets.
  Milliseconds, no simulator.
- **`packages/content`** — schema validation plus every lint rule, run in CI
  across all 16 chapters.
- **Sync** — outbox merge tested as pure functions against simulated
  multi-device conflicts: two devices, both offline, same day, both earning
  XP.
- **`apps/mobile`** — React Native Testing Library for the composer; Maestro
  for three end-to-end flows: onboarding, complete a lesson, and go offline
  → play → reconnect → verify sync.

---

## 10. Build order

1. Monorepo skeleton. `sanskrit` and `core` with tests. One hardcoded lesson
   playable end to end.
2. Content pipeline — extract, lint, verify, build — proven on chapters 1–2.
3. अक्षर composer. Chapters 1–2 complete and genuinely good.
4. Full engine: path, review scheduling, hearts, streak, daily goal,
   achievements.
5. Supabase, parent-gated auth, sync, DPDP flows.
6. Audio manifest → recording → integration.
7. Chapters 3–16 content. The long pole, and the one thing that
   parallelises across multiple authors.
8. Store compliance, kids-category review, closed beta.

Steps 6 and 7 run alongside 4 and 5 rather than after them. Content is gated
on authors and a voice artist, not on code.

This is too much for a single implementation plan. The first plan covers
steps 1–3, which is the vertical slice that proves the whole architecture:
a real lesson from chapter 1, built from verified content, played end to end
through the composer. Steps 4–8 get their own plans once that slice stands
up.

---

## 11. Known risks

| Risk | Standing |
|---|---|
| Content authoring for 16 chapters is the dominant cost | Accepted. Mitigated by lint-guided verification (5) and parallel authoring (10). |
| दीपकम् is NCERT copyright; commercial use needs permission | Open. v1 uses textbook content by decision. Pursue NCERT permission in parallel; the `source` field (4.1) makes swapping to original content a data change. |
| Voice artist availability gates all audio | Open. Manifest-driven so recording can start as soon as chapters 1–2 are verified. |
| Mascot art is an external dependency | Accepted. Off the critical path; placeholder ships. |
| No Sanskrit ASR, so no speaking practice | Accepted for v1. `speak` type reserved in schema (2.1). |
