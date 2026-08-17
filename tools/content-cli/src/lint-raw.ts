export type RawRuleId =
  | 'space-before-virama'
  | 'virama-space-consonant'
  | 'orphan-matra'
  | 'zero-width-joiner'
  | 'lost-glyph'
  | 'sign-before-matra';

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
// glyph loss, or sign misordering. Measured across the sixteen committed
// extractions: 2,911 findings.
const RULES: Rule[] = [
  // space-before-virama: the virama got separated from its consonant, e.g.
  // मनषु ्याणां (मनुष्याणां with the halant pushed onto the next syllable).
  { id: 'space-before-virama', pattern: /\s्/gu },
  // virama-space-consonant: the cluster continues after a space. Restricted
  // to a following consonant so a real word boundary before a vowel-initial
  // word is not flagged. Without that restriction every word-final halant
  // consonant fires. Known gap: the range excludes the nukta consonants
  // U+0958-095F (क़, ख़, ग़, ...); measured 0 real occurrences, so left as-is.
  { id: 'virama-space-consonant', pattern: /्\s[क-ह]/gu },
  // orphan-matra: a dependent vowel sign (matra) cannot begin a word, so one
  // appearing right after a space is the tail of a conjunct that got split.
  { id: 'orphan-matra', pattern: /\s[ा-ौ]/gu },
  // zero-width-joiner: written as \u escapes, not the literal
  // characters -- a literal zero-width character is invisible here and in git
  // diff, and an editor or a future find-and-replace could silently lose or
  // duplicate it.
  { id: 'zero-width-joiner', pattern: /[\u200C\u200D]/gu },
  // lost-glyph: pdftotext could not decode a glyph and emitted a replacement
  // character. Unlike the other signatures this is not reordering, it is
  // outright loss: kXaa is kakSHaa ("class") with the whole k-SH conjunct
  // gone, where X is the replacement character. Written as a \u escape for
  // the same reason as the zero-width joiner above -- a literal replacement
  // character in the rule would match itself and look like it works even if
  // broken. Measured 91 sites across all sixteen chapters.
  { id: 'lost-glyph', pattern: /\uFFFD/gu },
  // sign-before-matra: a sign (candrabindu, anusvara, visarga) follows its
  // matra in correct Devanagari, never precedes it -- e.g. the visarga and
  // the matra swapped. Measured 91 sites across all sixteen chapters.
  { id: 'sign-before-matra', pattern: /[ऀ-ः][ा-ौ]/gu },
];

export function lintRaw(text: string): RawFinding[] {
  const findings: RawFinding[] = [];

  // Line-based so every finding carries a line and column an author can jump
  // to. That means corruption spanning a line break is missed -- measured at 12
  // of 2,741 findings, 0.4%, with zero viramas or matras at a line start in
  // the real extractions.
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
