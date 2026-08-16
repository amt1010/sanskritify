import { describe, it, expect } from 'vitest';
import { parseAkshara } from '@sanskritify/sanskrit';
import type { Exercise, Lexeme } from '@sanskritify/content';
import { gradeAnswer } from './grading';
import type { GradeContext } from './types';

const ctx: GradeContext = { lexemes: new Map(), locale: 'en' };

const build: Exercise = {
  id: 'ex.ch02.001', type: 'akshara-build', target: 'क्ष', source: 'ncert-deepakam-ch02',
};

describe('gradeAnswer, akshara-build', () => {
  it('marks the exact akshara correct', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्ष')! }, ctx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('marks a wrong matra as a near-miss with a hint', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्षि')! }, ctx))
      .toEqual({ verdict: 'near-miss', hint: 'matra-differs' });
  });

  it('marks a wrong consonant as wrong', () => {
    expect(gradeAnswer(build, { kind: 'akshara', akshara: parseAkshara('क्स')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  // diffAkshara has four kinds since Task 5. A wrong sign is outside the
  // narrow near-miss rule, so it costs a heart. Pinned explicitly rather than
  // left to the switch's fallthrough.
  it('marks a wrong sign as wrong, not a near-miss', () => {
    const target: Exercise = { ...build, target: 'कं' };
    expect(gradeAnswer(target, { kind: 'akshara', akshara: parseAkshara('कः')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('marks a missing sign as wrong', () => {
    const target: Exercise = { ...build, target: 'कं' };
    expect(gradeAnswer(target, { kind: 'akshara', akshara: parseAkshara('क')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('marks the wrong answer kind wrong rather than throwing', () => {
    expect(gradeAnswer(build, { kind: 'choice', value: 'क्ष' }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  // A target the composer cannot build is a content bug that Task 12's lint
  // must catch. Grading cannot do anything better at runtime, so it refuses
  // the answer rather than throwing mid-lesson.
  it('marks any answer wrong when the target is not a single akshara', () => {
    const bad: Exercise = { ...build, target: 'कमल' };
    expect(gradeAnswer(bad, { kind: 'akshara', akshara: parseAkshara('क')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });
});

const select: Exercise = {
  id: 'ex.ch01.001', type: 'akshara-select', target: 'ऋ',
  options: ['ऋ', 'ऊ', 'उ', 'ऌ'],
  promptTranslations: { hi: 'ऋ चुनो', en: 'Pick ऋ' },
  source: 'ncert-deepakam-ch01',
};

describe('gradeAnswer, akshara-select', () => {
  it('marks the right option correct', () => {
    expect(gradeAnswer(select, { kind: 'choice', value: 'ऋ' }, ctx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('never returns near-miss for a multiple choice', () => {
    expect(gradeAnswer(select, { kind: 'choice', value: 'ऊ' }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('normalises before comparing', () => {
    expect(gradeAnswer(
      { ...select, target: 'अङ्ग', options: ['अङ्ग', 'ऊ'] },
      { kind: 'choice', value: 'अंग' },
      ctx,
    )).toEqual({ verdict: 'correct', hint: null });
  });

  it('marks the wrong answer kind wrong', () => {
    expect(gradeAnswer(select, { kind: 'akshara', akshara: parseAkshara('ऋ')! }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });
});

describe('gradeAnswer, match-pairs', () => {
  const lexemes = new Map<string, Lexeme>([
    ['lex.a', { id: 'lex.a', devanagari: 'जलम्', translations: { hi: 'पानी', en: 'water' }, source: 'original' }],
    ['lex.b', { id: 'lex.b', devanagari: 'वृक्षः', translations: { hi: 'पेड़', en: 'tree' }, source: 'original' }],
    ['lex.c', { id: 'lex.c', devanagari: 'गजः', translations: { hi: 'हाथी', en: 'elephant' }, source: 'original' }],
    ['lex.z', { id: 'lex.z', devanagari: 'चन्द्रः', translations: { hi: 'चाँद', en: 'moon' }, source: 'original' }],
  ]);
  const pairCtx: GradeContext = { lexemes, locale: 'en' };
  const ex: Exercise = {
    id: 'ex.ch03.001', type: 'match-pairs',
    lexemeIds: ['lex.a', 'lex.b', 'lex.c'], source: 'original',
  };
  const answer = (...pairs: Array<[string, string]>) =>
    ({ kind: 'pairs', pairs: pairs.map(([lexemeId, gloss]) => ({ lexemeId, gloss })) }) as const;

  it('marks all-correct pairings correct', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree'], ['lex.c', 'elephant']), pairCtx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('ignores the order the pairs arrive in', () => {
    expect(gradeAnswer(ex, answer(['lex.c', 'elephant'], ['lex.a', 'water'], ['lex.b', 'tree']), pairCtx))
      .toEqual({ verdict: 'correct', hint: null });
  });

  it('marks any wrong pairing wrong', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'tree'], ['lex.b', 'water'], ['lex.c', 'elephant']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  // These three all passed under an earlier version that checked only the pair
  // count and each pair's own gloss. Each one is an exercise passed without
  // knowing any of the words.
  it('rejects the same lexeme submitted repeatedly', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.a', 'water'], ['lex.a', 'water']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('rejects a lexeme that is not in this exercise', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree'], ['lex.z', 'moon']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('rejects a duplicated pairing that covers only two lexemes', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree'], ['lex.b', 'tree']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('rejects too few pairs', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('rejects a lexeme id that is not in the context at all', () => {
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree'], ['lex.qq', 'x']), pairCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });

  it('grades against the requested locale', () => {
    const hiCtx: GradeContext = { lexemes, locale: 'hi' };
    expect(gradeAnswer(ex, answer(['lex.a', 'पानी'], ['lex.b', 'पेड़'], ['lex.c', 'हाथी']), hiCtx))
      .toEqual({ verdict: 'correct', hint: null });
    expect(gradeAnswer(ex, answer(['lex.a', 'water'], ['lex.b', 'tree'], ['lex.c', 'elephant']), hiCtx))
      .toEqual({ verdict: 'wrong', hint: null });
  });
});

describe('gradeAnswer, types with no renderer yet', () => {
  it('marks an unrendered exercise type wrong rather than throwing', () => {
    const speak: Exercise = {
      id: 'ex.x', type: 'speak', sentenceId: 'sen.a', enabled: false, source: 'original',
    };
    expect(gradeAnswer(speak, { kind: 'choice', value: 'anything' }, ctx))
      .toEqual({ verdict: 'wrong', hint: null });
  });
});
