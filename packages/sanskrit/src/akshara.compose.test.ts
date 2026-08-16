import { describe, it, expect } from 'vitest';
import { composeAkshara, parseAkshara, diffAkshara, type Akshara } from './akshara';

const KSHA: Akshara = {
  parts: [{ consonant: 'क', halant: true }, { consonant: 'ष', halant: false }],
  matra: null,
  sign: null,
};

describe('composeAkshara', () => {
  it('joins a conjunct', () => {
    expect(composeAkshara(KSHA)).toBe('क्ष');
  });

  it('appends a matra', () => {
    expect(composeAkshara({ ...KSHA, matra: 'ि' })).toBe('क्षि');
  });

  it('renders a bare consonant', () => {
    expect(composeAkshara({ parts: [{ consonant: 'क', halant: false }], matra: null, sign: null })).toBe('क');
  });

  it('renders a trailing halant', () => {
    expect(composeAkshara({ parts: [{ consonant: 'त', halant: true }], matra: null, sign: null })).toBe('त्');
  });

  // The sign goes after the matra. Emitting it before produces कंा, which is
  // a different string from कां and will never match an expected answer.
  it('puts a sign after the matra', () => {
    const kaam: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: 'ा', sign: 'ं' };
    expect(composeAkshara(kaam)).toBe('कां');
    expect([...composeAkshara(kaam)].map((c) => c.codePointAt(0))).toEqual([0x0915, 0x093e, 0x0902]);
  });

  it('renders a sign with no matra', () => {
    expect(composeAkshara({ parts: [{ consonant: 'अ', halant: false }], matra: null, sign: 'ं' })).toBe('अं');
  });
});

describe('parseAkshara', () => {
  it('round-trips a conjunct', () => {
    expect(parseAkshara('क्ष')).toEqual(KSHA);
  });

  it('round-trips a conjunct with a matra', () => {
    expect(parseAkshara('क्षि')).toEqual({ ...KSHA, matra: 'ि' });
  });

  it('separates a sign from a matra', () => {
    expect(parseAkshara('कां')).toEqual({
      parts: [{ consonant: 'क', halant: false }],
      matra: 'ा',
      sign: 'ं',
    });
  });

  it.each(['क', 'का', 'कि', 'क्ष', 'क्षि', 'त्', 'अ', 'अं', 'अः', 'मः', 'कं', 'कां', 'कैं', 'स्त्र', 'र्ण', 'द्या'])(
    'round-trips %s through compose',
    (word) => {
      const a = parseAkshara(word);
      expect(a).not.toBeNull();
      expect(composeAkshara(a!)).toBe(word);
    },
  );

  it('returns null for input that is not a single akshara', () => {
    expect(parseAkshara('कमल')).toBeNull();
    expect(parseAkshara('')).toBeNull();
  });

  // parseAkshara is a boundary: it turns arbitrary text into a composer value.
  // Anything the composer cannot produce is rejected rather than mistyped.
  it.each([
    ['मोऽ', 'avagraha is not a composer key'],
    ['काि', 'two matras'],
    ['कंं', 'two signs'],
    ['्क', 'leading virama'],
    ['१', 'digit'],
    ['ka', 'latin'],
  ])('returns null for %s (%s)', (text) => {
    expect(parseAkshara(text)).toBeNull();
  });
});

describe('diffAkshara', () => {
  it('reports equal for identical aksharas', () => {
    expect(diffAkshara(KSHA, KSHA)).toEqual({ kind: 'equal' });
  });

  it('reports matra-differs when only the vowel is wrong', () => {
    expect(diffAkshara(KSHA, { ...KSHA, matra: 'ि' })).toEqual({ kind: 'matra-differs' });
  });

  it('reports matra-differs when only a halant is wrong', () => {
    const noHalant: Akshara = {
      parts: [{ consonant: 'क', halant: false }, { consonant: 'ष', halant: false }],
      matra: null,
      sign: null,
    };
    expect(diffAkshara(KSHA, noHalant)).toEqual({ kind: 'matra-differs' });
  });

  // A wrong anusvara is not a wrong matra, so it must not earn the free
  // re-queue that near-miss grants. Task 7 maps this to a wrong verdict.
  it('reports sign-differs when only the sign is wrong', () => {
    expect(diffAkshara(KSHA, { ...KSHA, sign: 'ं' })).toEqual({ kind: 'sign-differs' });
  });

  it('reports consonants-differ when the cluster is wrong', () => {
    const wrong: Akshara = {
      parts: [{ consonant: 'क', halant: true }, { consonant: 'स', halant: false }],
      matra: null,
      sign: null,
    };
    expect(diffAkshara(KSHA, wrong)).toEqual({ kind: 'consonants-differ' });
  });

  it('reports consonants-differ when the cluster lengths differ', () => {
    const shorter: Akshara = { parts: [{ consonant: 'क', halant: true }], matra: null, sign: null };
    expect(diffAkshara(KSHA, shorter)).toEqual({ kind: 'consonants-differ' });
  });

  it('prefers consonants-differ when both consonants and matra are wrong', () => {
    const wrong: Akshara = {
      parts: [{ consonant: 'ग', halant: false }],
      matra: 'ी',
      sign: null,
    };
    expect(diffAkshara(KSHA, wrong)).toEqual({ kind: 'consonants-differ' });
  });
});
