import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';

// U+0958 QA is precomposed; NFC decomposes it to क + nukta. Written as an
// escape because the literal glyph lands in this file already decomposed,
// which would make the assertion compare a string to itself.
const QA_PRECOMPOSED = '\u0958';
const ZWJ = '\u200D';
const ZWNJ = '\u200C';

describe('normalize', () => {
  it('applies NFC', () => {
    expect(normalize(QA_PRECOMPOSED)).toBe(normalize('क़'));
  });

  it('strips ZWJ and ZWNJ', () => {
    expect(normalize(`सामान्${ZWJ}याः`)).toBe('सामान्याः');
    expect(normalize(`क${ZWNJ}ख`)).toBe('कख');
  });

  it('treats anusvara and a homorganic class nasal as equal', () => {
    expect(normalize('अङ्ग')).toBe(normalize('अंग'));
    expect(normalize('सन्धि')).toBe(normalize('संधि'));
  });

  it('treats word-final म् as equal to anusvara', () => {
    expect(normalize('रामम्')).toBe(normalize('रामं'));
    expect(normalize('दीपकम्')).toBe(normalize('दीपकं'));
  });

  // Regression. An earlier version folded every class nasal + virama
  // unconditionally, which made these pairs compare equal and let the app
  // accept a wrong answer as correct.
  it('does not merge words that differ only in a word-final nasal', () => {
    expect(normalize('राजन्')).not.toBe(normalize('राजम्'));
    expect(normalize('तान्')).not.toBe(normalize('ताम्'));
  });

  it('does not fold a class nasal before a non-homorganic consonant', () => {
    // न् in अन्य is followed by य, which is not dental. अंय is not a spelling
    // of this word, so a learner typing it must not be accepted.
    expect(normalize('अन्य')).not.toBe(normalize('अंय'));
  });

  it('ignores avagraha', () => {
    expect(normalize('रामोऽस्ति')).toBe(normalize('रामोस्ति'));
  });

  it('collapses whitespace and drops danda', () => {
    expect(normalize('  रामः   गच्छति ।  ')).toBe(normalize('रामः गच्छति'));
  });

  it('folds a word-final म् the same way before a danda', () => {
    expect(normalize('रामः गच्छति दीपकम् ।')).toBe(normalize('रामः गच्छति दीपकं'));
  });

  it('leaves an already-clean string unchanged', () => {
    expect(normalize('बालकः')).toBe('बालकः');
  });

  it('is idempotent', () => {
    for (const w of ['अङ्ग', 'दीपकम्', 'रामोऽस्ति', 'राजन्', '  रामः   गच्छति ।  ']) {
      expect(normalize(normalize(w))).toBe(normalize(w));
    }
  });

  it('returns an empty string unchanged', () => {
    expect(normalize('')).toBe('');
  });
});
