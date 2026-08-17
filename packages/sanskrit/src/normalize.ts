import { ANUSVARA, AVAGRAHA, DANDA, ZWJ, ZWNJ } from './chars';

// Anusvara equals a class nasal plus virama only when the nasal is homorganic
// with the consonant that follows — same place of articulation. अङ्ग and अंग
// are the same word; राजन् and राजम् are not. दीपकम् spells words both ways,
// so grading has to accept the pair, but folding every nasal unconditionally
// would also accept a wrong answer as correct.
//
// Written as regex literals rather than built from template strings: the
// template-string version silently ate the backslash in \s and compiled
// (?=s|$), which fails in a way no test in the plan would have caught.
const NASAL_VELAR = /ङ्(?=[क-ङ])/gu;
const NASAL_PALATAL = /ञ्(?=[च-ञ])/gu;
const NASAL_RETROFLEX = /ण्(?=[ट-ण])/gu;
const NASAL_DENTAL = /न्(?=[त-न])/gu;
const NASAL_LABIAL = /म्(?=[प-म])/gu;
const HOMORGANIC = [
  NASAL_VELAR,
  NASAL_PALATAL,
  NASAL_RETROFLEX,
  NASAL_DENTAL,
  NASAL_LABIAL,
];

// Word-final म् is interchangeable with anusvara — रामम् and रामं are one
// word, and the textbook's own title दीपकम् is also written दीपकं. Word-final
// न् is not interchangeable, so only म् gets this rule.
const FINAL_M = /म्(?=\s|$)/gu;

export function normalize(text: string): string {
  // Danda and whitespace are settled first so that a word-final म् before a
  // danda looks the same to FINAL_M as one at the end of the string.
  let s = text
    .normalize('NFC')
    .split(ZWJ)
    .join('')
    .split(ZWNJ)
    .join('')
    .split(AVAGRAHA)
    .join('')
    .split(DANDA)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();

  for (const re of HOMORGANIC) s = s.replace(re, ANUSVARA);
  return s.replace(FINAL_M, ANUSVARA);
}
