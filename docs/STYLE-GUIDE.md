# Style guide

Applies to everything written here that a human reads: markdown docs, PR
descriptions, commit bodies, READMEs, design docs, code comments.

## Rules

- Direct and concrete. Numbers over adjectives, examples over description.
  "428 orphan-matra hits across 16 chapters", not "significant extraction
  issues".
- Plain words. Not "leverage", "utilize", "robust", "seamless", "delve",
  "in order to", "it's worth noting that".
- Active voice, first person where natural. Say who does what.
- Say the uncertain parts out loud instead of hedging everything equally.
  If one number is a guess and another is measured, mark the guess.
- Short sentences carry the point. Longer ones unpack the nuance.
- Lead with the answer, then the reasoning.
- No marketing register. If a sentence could appear in a product brochure,
  rewrite it.

## Commits

Write commit messages as if the repo owner wrote them: what changed and why.

No `Co-Authored-By` trailers, no "generated with" footers, no AI or tool
attribution of any kind. Same rule for PR titles and bodies, tags, and
release notes.

## Sanskrit and Devanagari in prose

- Write Sanskrit terms in Devanagari with a gloss on first use:
  `विभक्ति` (case ending). Don't transliterate into Latin unless the point
  is about pronunciation.
- When quoting the textbook, quote it exactly. If a string came out of
  `pdftotext` and hasn't been verified against the PDF, say so.
