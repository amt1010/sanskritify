import { describe, it, expect } from 'vitest';
import { lintRaw } from './lint-raw';

// ZWJ is ZERO WIDTH JOINER (U+200D), ZWNJ is ZERO WIDTH NON-JOINER (U+200C).
// Written as \u escapes rather than the literal characters so they
// stay visible and intentional in source and diff.
const ZWJ = '\u200D';
const ZWNJ = '\u200C';

// THIN_SPACE (U+2009) and EM_SPACE (U+2003) are the two non-ASCII whitespace
// characters pdftotext actually preserves from the PDFs' typographic kerning.
// Same reasoning as above: escapes, not literal characters.
const THIN_SPACE = '\u2009';
const EM_SPACE = '\u2003';

describe('lintRaw', () => {
  it('flags a space before a virama', () => {
    // मनुष्याणां extracted as मनषु ्याणां
    expect(lintRaw('मनषु ्याणां').map((f) => f.rule)).toContain('space-before-virama');
  });

  it('flags a virama followed by a space and a consonant', () => {
    // अङ्गानि extracted as अङ् गानि
    expect(lintRaw('अङ् गानि').map((f) => f.rule)).toContain('virama-space-consonant');
  });

  it('does not flag a virama followed by a space and a vowel', () => {
    // प्रियम् अङ्गम् is correct Sanskrit: word-final म् then a new word.
    // Without this restriction the rule would flag every word-final म्.
    expect(lintRaw('प्रियम् अङ्गम्').map((f) => f.rule)).not.toContain('virama-space-consonant');
  });

  it('flags an orphan matra after a space', () => {
    // वर्णमालां extracted as वर्मण ालां -- the first line of chapter 1.
    expect(lintRaw('वयं वर्मण ालां पठामः').map((f) => f.rule)).toContain('orphan-matra');
  });

  it.each([[ZWJ], [ZWNJ]])('flags a zero-width joiner', (joiner) => {
    expect(lintRaw(`सामान्${joiner}याः`).map((f) => f.rule)).toContain('zero-width-joiner');
  });

  it('reports the line number', () => {
    expect(lintRaw('clean line\nमनषु ्याणां')[0]!.line).toBe(2);
  });

  it('reports the column', () => {
    const found = lintRaw('अब मनषु ्याणां');
    expect(found[0]!.column).toBeGreaterThan(1);
  });

  it('returns findings sorted by line then column', () => {
    const found = lintRaw(`मनषु ्याणां\nअङ् गानि\nवर्मण ालां`);
    const keys = found.map((f) => f.line * 1000 + f.column);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('includes an excerpt around the match', () => {
    const found = lintRaw('वयं वर्मण ालां पठामः');
    expect(found[0]!.excerpt.length).toBeGreaterThan(0);
    expect('वयं वर्मण ालां पठामः').toContain(found[0]!.excerpt);
  });

  it('returns nothing for clean text', () => {
    expect(lintRaw('वयं वर्णमालां पठामः ।')).toEqual([]);
  });

  it('returns nothing for empty input', () => {
    expect(lintRaw('')).toEqual([]);
  });

  // \s rather than a literal space is load-bearing. The PDFs use thin and em
  // spaces for kerning and pdftotext preserves them: measured across the
  // sixteen chapters, 217 corruption sites sit next to U+2009 and 17 next to
  // U+2003. A literal-space rule misses 261 findings, about 10% of the total.
  it.each([
    ['a thin space', THIN_SPACE],
    ['an em space', EM_SPACE],
    ['a tab', '\t'],
  ])('flags a virama separated by %s', (_label, ws) => {
    expect(lintRaw(`मनषु${ws}्याणां`).map((f) => f.rule)).toContain('space-before-virama');
  });

  it('flags an orphan matra after a thin space', () => {
    expect(lintRaw(`वयं वर्मण${THIN_SPACE}ालां`).map((f) => f.rule)).toContain('orphan-matra');
  });

  // CRLF files are the normal case on Windows: pdftotext writes them and the
  // working copy keeps them even though the committed blob is LF. This proves
  // a trailing \r produces no phantom findings on clean text -- it does not
  // prove \s specifically over a literal space, since a trailing \r always sits
  // last on a split line, never next to a virama or matra. The thin/em-space
  // cases above are what prove \s is load-bearing.
  it('is unaffected by CRLF line endings', () => {
    expect(lintRaw('वयं वर्णमालां पठामः ।\r\nशुद्धम् ।\r\n')).toEqual([]);
  });

  it('finds every occurrence on one line, not just the first', () => {
    expect(lintRaw('मनषु ्याणां मनषु ्याणां').filter((f) => f.rule === 'space-before-virama'))
      .toHaveLength(2);
  });
});
