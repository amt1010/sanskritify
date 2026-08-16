import { isConsonant, isVirama, ZWJ, ZWNJ } from './chars';

// Signs that bind to the akshara before them: matras, anusvara, candrabindu,
// visarga, nukta, avagraha, and the Vedic accent marks. The range covers the
// virama too, which is why the isVirama check below is not strictly needed —
// it is kept because a reader should not have to know that to follow the code.
const TRAILING_SIGN = /^[ऀ-ःऺ-ॏ॑-ॗॢ-ॣ]$/u;

export function segmentAksharas(text: string): string[] {
  // ZWJ and ZWNJ carry no sound. pdftotext emits them inside conjuncts, and
  // leaving them in tears न्याः into न् and याः with the joiner stranded
  // between as an akshara of its own. Dropping them here means segmentation
  // does not depend on the caller having normalised first.
  const chars = [...text].filter((ch) => ch !== ZWJ && ch !== ZWNJ);
  const out: string[] = [];
  let current = '';

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;

    if (current === '') {
      current = ch;
      continue;
    }

    const prev = chars[i - 1]!;

    // A virama binds the next consonant into the same cluster. Consonants
    // only — क्अ is not valid Devanagari, so a vowel after a virama starts a
    // new akshara rather than joining the cluster.
    if (isVirama(prev) && isConsonant(ch)) {
      current += ch;
      continue;
    }

    if (TRAILING_SIGN.test(ch) || isVirama(ch)) {
      current += ch;
      continue;
    }

    out.push(current);
    current = ch;
  }

  if (current !== '') out.push(current);
  return out;
}
