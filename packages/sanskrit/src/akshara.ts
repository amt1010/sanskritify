import { isConsonant, isIndependentVowel, isMatra, isSign, isVirama, VIRAMA, ZWJ, ZWNJ } from './chars';

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

export interface AksharaPart {
  consonant: string;
  halant: boolean;
}

// A sign (anusvara, visarga, candrabindu) sits in its own slot because it is
// written after the matra. Filing it as a consonant part emits कंा where the
// learner meant कां — the codepoint reordering this type exists to prevent.
export interface Akshara {
  parts: AksharaPart[];
  matra: string | null;
  sign: string | null;
}

export function composeAkshara(a: Akshara): string {
  const body = a.parts.map((p) => (p.halant ? p.consonant + VIRAMA : p.consonant)).join('');
  return body + (a.matra ?? '') + (a.sign ?? '');
}

// Returns null rather than guessing. This is the boundary where arbitrary text
// becomes a composer value, so anything the composer cannot produce — avagraha,
// digits, Latin, a second matra — is refused here instead of surfacing later as
// an answer that can never match.
export function parseAkshara(text: string): Akshara | null {
  if (text === '') return null;
  if (segmentAksharas(text).length !== 1) return null;

  const parts: AksharaPart[] = [];
  let matra: string | null = null;
  let sign: string | null = null;

  for (const ch of [...text]) {
    if (isMatra(ch)) {
      if (matra !== null) return null;
      matra = ch;
      continue;
    }
    if (isSign(ch)) {
      if (sign !== null) return null;
      sign = ch;
      continue;
    }
    if (isVirama(ch)) {
      const last = parts[parts.length - 1];
      if (!last) return null;
      last.halant = true;
      continue;
    }
    if (!isConsonant(ch) && !isIndependentVowel(ch)) return null;
    parts.push({ consonant: ch, halant: false });
  }

  return parts.length === 0 ? null : { parts, matra, sign };
}

// A near-miss is defined narrowly in the spec: the consonant sequence is right
// and only the matra or a halant differs. A wrong sign is not a near-miss and
// does not earn the free re-queue.
export type AksharaDiff =
  | { kind: 'equal' }
  | { kind: 'matra-differs' }
  | { kind: 'sign-differs' }
  | { kind: 'consonants-differ' };

export function diffAkshara(expected: Akshara, actual: Akshara): AksharaDiff {
  const sameConsonants =
    expected.parts.length === actual.parts.length &&
    expected.parts.every((p, i) => p.consonant === actual.parts[i]!.consonant);

  if (!sameConsonants) return { kind: 'consonants-differ' };

  const sameHalants = expected.parts.every((p, i) => p.halant === actual.parts[i]!.halant);
  if (sameHalants && expected.matra === actual.matra && expected.sign === actual.sign) {
    return { kind: 'equal' };
  }

  // Consonants match, so the difference is a matra, a halant, or a sign.
  // Matra and halant come first: they are the near-miss cases, and a learner
  // who got both the cluster and the vowel right but the sign wrong has made
  // the larger mistake of the two.
  if (sameHalants && expected.matra === actual.matra) return { kind: 'sign-differs' };
  return { kind: 'matra-differs' };
}
