# Chapter 1 verification worksheet

For the repo owner, with `Class6/fsde101.pdf` open to chapter 1. Ashish Tripathi has
checked it on 08/17/2026 — everything in `packages/content/src/data/ch01/` is
reviewed. See `source/ch01.md` for how it was derived.

Work through each item, write down the answer, then see "What to do with
the answers" at the end.

## 1. The five corrections

For each row, does the PDF actually show the corrected form?

| # | Extracted (`ch01.txt`) | Proposed correction | PDF shows correction? (y/n) | Notes |
|---|---|---|---|---|
| 1 | `वर्मण ालां` | `वर्णमालां` | y | |
| 2 | `स्वतन्त्ररूपणे` | `स्वतन्त्ररूपेण` | y | |
| 3 | `सामान्‍याः` | `सामान्याः` | y | |
| 4 | `सन्‍त‍ि` | `सन्ति` | y | |
| 5 | `वरण्मालायाम्` | `वर्णमालायाम्` | y | |

## 2. Does chapter 1 teach ॠ?

`ॠ` (दीर्घ ऋ, U+0960) occurs 0 times in the `pdftotext` extraction of
chapter 1. `con.ch01.hrasva-dirgha` currently teaches only अ/आ, इ/ई, उ/ऊ as
short/long pairs — it does not mention ऋ or ॠ at all.

- Does the printed chapter mention ॠ anywhere — in the वर्णमाला chart, a
  footnote, or a table? (y/n) **n.** ऋ (U+090B, ह्रस्व) does appear — pages
  5, 7, 9, and again in माता का ऋण on page 10 — but दीर्घ ॠ itself is not in
  chapter 1 anywhere.
- If yes, should the concept body add it as a third short/long pair? N/A —
  ॠ isn't in the chapter. Added the pair anyway, since ऋ is: `con.ch01.hrasva-dirgha`
  now lists ऋ/ॠ as the third pair, with ॠ there only as ऋ's grammatical long
  counterpart. No drill exercise pairs them, since there's no ॠ word in the
  chapter to build one from.

## 3. Does ऌ deserve its own place in the lesson?

`ऌ` appears 18 times in the extraction, `ऋ` only 3 times — ऌ is far more
present in this chapter's text than ऋ is, which is the opposite of what a
usual वर्णमाला ordering would suggest.

- Does the chapter present ऌ as a first-class vowel (its own row/box in the
  vowel chart, not just an incidental use)? (y/n) **y.**
- If yes, should a ninth exercise (or a swap for one of the eight) cover ऌ
  specifically? Don't add it yourself — write the answer here and it goes in
  as a follow-up. **Yes — add a ninth exercise (or swap one of the eight)
  covering ऌ.** Not done in this pass; tracked as a follow-up.

## 4. Are the two concept bodies a fair statement of what the chapter says?

Read `con.ch01.svara` and `con.ch01.hrasva-dirgha` in
`packages/content/src/data/ch01/concepts.json` against the chapter's actual
explanation.

- `con.ch01.svara`: does the chapter define स्वर the way this body does
  (pronounced independently, no supporting sound needed)? (y/n) **y.**
- `con.ch01.hrasva-dirgha`: does the chapter state the ह्रस्व/दीर्घ
  distinction as a difference in vowel length ("held twice as long")? (y/n)
  **y.**
- Anything the chapter says that these bodies get wrong or leave out? **Yes
  — `con.ch01.hrasva-dirgha` left out the ऋ/ॠ pair entirely.** Fixed: see
  item 2 above.

## 5. Is कृषि the right example word?

`ex.ch01.005`'s prompt asks the learner to pick the vowel heard in `कृषि`.

- Does chapter 1 actually use the word कृषि anywhere? (y/n) **y.** It
  carries ह्रस्व ऋ, which is exactly what `ex.ch01.005` targets.
- If not, what word does the chapter use that contains ऋ, that would make a
  better example? N/A — कृषि works, no change needed.

## 6. Does the lesson structure match the chapter's own structure?

- Lesson title is `समानाक्षर स्वर` ("simple vowels"). Does the chapter use
  this term, or a different one, for this group of vowels? **y — page 1
  headings the group as समानाक्षर-स्वराः** (hyphenated compound, प्रथमा
  बहुवचन ाः ending). The lesson title drops the hyphen and the plural
  ending, giving the citation form of the same compound — consistent with
  how the other lesson/concept titles in this chapter (e.g. `स्वर`, not
  `स्वराः`) use citation forms rather than the inflected form printed on the
  page. Title kept as-is.
- The lesson is unit `unit.ch01.u1`, lesson `l1` — a single lesson for the
  whole simple-vowel set. Does the chapter's own pacing suggest splitting
  this into more than one lesson, or is one lesson the right size? **One
  lesson is the right size.**

## What to do with the answers

For anything marked "n" above, or any note you added:

1. Fix the JSON in `packages/content/src/data/ch01/` directly.
2. Update `packages/content/source/ch01.md` to describe the correction and
   why.
3. Once every item above has been checked against the PDF and the JSON
   matches what the page says, change this file's and `ch01.md`'s status
   line from "not been checked against the printed page" to a line stating
   a human checked it, with the date and who did it.
