import { describe, it, expect } from 'vitest';
import { segmentAksharas } from './akshara';

// Written as escapes, not literal characters: a literal zero-width character
// is invisible in the editor and in git diff, so the line would read as
// const ZWJ = ''; to every future reader. Same reasoning as chars.ts.
const ZWJ = '\u200D';
const ZWNJ = '\u200C';

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
    // र्ण is one akshara: the र is a half-form joined to ण by virama.
    expect(segmentAksharas('वर्णमाला')).toEqual(['व', 'र्ण', 'मा', 'ला']);
  });

  it.each([
    ['प्रश्न', ['प्र', 'श्न']],
    ['विद्या', ['वि', 'द्या']],
    ['मित्रम्', ['मि', 'त्र', 'म्']],
    ['कार्यम्', ['का', 'र्य', 'म्']],
  ])('splits %s', (word, expected) => {
    expect(segmentAksharas(word)).toEqual(expected);
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

  // A ZWJ between a virama and the next consonant is what pdftotext emits.
  // It must not split the conjunct or become an akshara of its own.
  it('ignores ZWJ and ZWNJ', () => {
    expect(segmentAksharas(`सामान्${ZWJ}याः`)).toEqual(segmentAksharas('सामान्याः'));
    expect(segmentAksharas(`क${ZWNJ}ख`)).toEqual(['क', 'ख']);
    expect(segmentAksharas(ZWJ)).toEqual([]);
  });

  // These four pin down decisions rather than accidents. Changing any of them
  // is a real behaviour change and should fail here first.
  it('keeps a space as its own element', () => {
    expect(segmentAksharas('रामः गच्छति')).toEqual(['रा', 'मः', ' ', 'ग', 'च्छ', 'ति']);
  });

  it('keeps a danda as its own element', () => {
    expect(segmentAksharas('रामः।')).toEqual(['रा', 'मः', '।']);
  });

  it('keeps a word-final virama attached to its consonant', () => {
    expect(segmentAksharas('दीपकम्')).toEqual(['दी', 'प', 'क', 'म्']);
  });

  it('binds avagraha to the akshara before it', () => {
    expect(segmentAksharas('रामोऽस्ति')).toEqual(['रा', 'मोऽ', 'स्ति']);
  });

  it('does not bind an independent vowel to a preceding virama', () => {
    // क्अ is not valid Devanagari. If corrupt extraction produces it, the
    // right answer is two aksharas, not one glued unit.
    expect(segmentAksharas('क्अ')).toEqual(['क्', 'अ']);
  });

  // Losslessness is what lets the composer and the content validator agree.
  // If segmentation ever drops or duplicates a code point, this catches it.
  it('rejoins to the original for joiner-free input', () => {
    const words = [
      'कमल', 'बाला', 'क्ष', 'स्त्र', 'वर्णमाला', 'रामः', 'अंश', 'अजय',
      'दीपकम्', 'प्रश्न', 'विद्या', 'मित्रम्', 'कार्यम्', 'सर्वे',
      'उद्यानम्', 'रामः गच्छति', 'रामोऽस्ति', 'रामः।', '१२', 'कa',
    ];
    for (const w of words) {
      expect(segmentAksharas(w).join('')).toBe(w);
    }
  });
});
