import { describe, it, expect } from 'vitest';
import { isConsonant, isMatra, isIndependentVowel, isVirama, VIRAMA } from './chars';

describe('isConsonant', () => {
  it.each(['क', 'ख', 'ष', 'ह', 'ळ'])('accepts %s', (ch) => {
    expect(isConsonant(ch)).toBe(true);
  });
  it.each(['अ', 'ा', VIRAMA, '१', 'a'])('rejects %s', (ch) => {
    expect(isConsonant(ch)).toBe(false);
  });
});

describe('isMatra', () => {
  it.each(['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ृ'])('accepts %s', (ch) => {
    expect(isMatra(ch)).toBe(true);
  });
  it.each(['क', 'अ', VIRAMA])('rejects %s', (ch) => {
    expect(isMatra(ch)).toBe(false);
  });
});

describe('isIndependentVowel', () => {
  it.each(['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ऌ', 'ए', 'ऐ', 'ओ', 'औ'])('accepts %s', (ch) => {
    expect(isIndependentVowel(ch)).toBe(true);
  });
  it.each(['क', 'ा'])('rejects %s', (ch) => {
    expect(isIndependentVowel(ch)).toBe(false);
  });
});

describe('isVirama', () => {
  it('accepts the virama', () => expect(isVirama(VIRAMA)).toBe(true));
  it('rejects a consonant', () => expect(isVirama('क')).toBe(false));
});
