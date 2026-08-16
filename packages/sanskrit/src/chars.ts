export const VIRAMA = '्';
// ZWJ and ZWNJ are \u escapes, not literal characters. A literal
// zero-width character is invisible in the editor and in git diff, so
// the line would read as export const ZWJ = ''; to every future reader.
export const ZWJ = '\u200D';
export const ZWNJ = '\u200C';
export const ANUSVARA = 'ं';
export const AVAGRAHA = 'ऽ';
export const DANDA = '।';

// Devanagari block ranges. Consonants क (0915) through ह (0939), plus the
// nukta-composed forms क़-य़ for Urdu/Persian loanwords (क़, ख़, ग़,
// ज़, ड़, ढ़, फ़, य़), and the Marathi/Kashmiri additions ॹ (0979) through
// ॿ (097F). ळ (0933) is already inside the main क-ह range.
//
// The nukta forms are written as \u escapes, not as the literal glyphs
// क़-य़: Unicode excludes them from NFC recomposition (they are
// compatibility composites), so a literal क़ saved to a UTF-8 source file
// decomposes on disk into क plus a combining nukta — two code units, not
// one. A regex character-class range needs single-code-unit endpoints; the
// decomposed form throws "Range out of order in character class" at parse
// time. Confirmed by writing the literal glyphs here and running the test
// file — that is the exact error it produced.
const CONSONANT = /^[क-ह\u0958-\u095Fॹ-ॿ]$/u;

// Vowel signs (093A-093B, 093E-094C, 094E-094F, 0955-0957, 0962-0963).
// The 093A-094C span is not one clean run: 093C is the nukta and 093D is
// AVAGRAHA, neither of which is a vowel sign, so they are cut out of the
// range rather than swept in. The span also stops at 094C (औ's matra),
// one below VIRAMA (094D) — callers ask for the virama explicitly via
// isVirama, isMatra never claims it.
const MATRA = /^[ऺऻा-ौॎॏॕ-ॗॢ-ॣ]$/u;

// Independent vowels अ (0905) through औ (0914), plus ऄ (0904, short a,
// used in Marwari) at the low end, ॠ-ॡ (0960-0961, long vocalic r/l), and
// the Marathi additions ॲ-ॷ (0972-0977).
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
