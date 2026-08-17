import { describe, it, expect } from 'vitest';
import type { ContentPack } from '@sanskritify/content';
import { lintContent } from './lint-content';

function pack(over: Partial<ContentPack> = {}): ContentPack {
  return {
    version: '1.0.0', courseId: 'sanskrit-class-6',
    lexemes: [], sentences: [], concepts: [], lessons: [],
    ...over,
  };
}

const lexeme = (id: string, devanagari: string) => ({
  id, devanagari,
  translations: { hi: 'x', en: 'x' },
  source: 'original' as const,
});

const lesson = (id: string, exercises: unknown[]) => ({
  id, unitId: 'unit.a',
  titleTranslations: { hi: 'क', en: 'k' },
  exercises,
}) as unknown as ContentPack['lessons'][number];

describe('lintContent', () => {
  it('flags an exercise referencing a lexeme that does not exist', () => {
    const p = pack({
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'match-pairs', lexemeIds: ['lex.ghost', 'lex.b', 'lex.c'], source: 'original' },
      ])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('missing-lexeme');
  });

  // select-image carries a second lexeme list that the first version of this
  // lint ignored entirely.
  it('flags a ghost lexeme in select-image optionLexemeIds', () => {
    const p = pack({
      lexemes: [lexeme('lex.a', 'जलम्')],
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'select-image', lexemeId: 'lex.a', optionLexemeIds: ['lex.a', 'lex.ghost'], source: 'original' },
      ])],
    });
    const found = lintContent(p).filter((f) => f.rule === 'missing-lexeme');
    expect(found.map((f) => f.detail).join(' ')).toContain('lex.ghost');
  });

  // Six of the eleven exercise types reference a sentence.
  it.each([
    ['translate-to-locale', { sentenceId: 'sen.ghost' }],
    ['translate-to-sanskrit', { sentenceId: 'sen.ghost' }],
    ['fill-blank', { sentenceId: 'sen.ghost', blankIndex: 0, options: ['क', 'ख'] }],
    ['listen-build', { sentenceId: 'sen.ghost', audioRef: 'a.mp3' }],
    ['order-sentence', { sentenceId: 'sen.ghost' }],
    ['speak', { sentenceId: 'sen.ghost', enabled: false }],
  ])('flags a %s referencing a sentence that does not exist', (type, rest) => {
    const p = pack({
      lessons: [lesson('les.a', [{ id: 'ex.1', type, source: 'original', ...rest }])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('missing-sentence');
  });

  // The mirror of the six cases above: proves the rule stays silent when the
  // sentenceId reference is valid, not just that it fires when it isn't.
  it.each([
    ['translate-to-locale', { sentenceId: 'sen.a' }],
    ['translate-to-sanskrit', { sentenceId: 'sen.a' }],
    ['fill-blank', { sentenceId: 'sen.a', blankIndex: 0, options: ['क', 'ख'] }],
    ['listen-build', { sentenceId: 'sen.a', audioRef: 'a.mp3' }],
    ['order-sentence', { sentenceId: 'sen.a' }],
    ['speak', { sentenceId: 'sen.a', enabled: false }],
  ])('does not flag a %s referencing a sentence that exists', (type, rest) => {
    const p = pack({
      sentences: [{
        id: 'sen.a', canonical: 'रामः', acceptedForms: ['रामः'],
        translations: { hi: 'x', en: 'x' },
        lexemeIds: [], source: 'original',
      }] as ContentPack['sentences'],
      lessons: [lesson('les.a', [{ id: 'ex.1', type, source: 'original', ...rest }])],
    });
    expect(lintContent(p).map((f) => f.rule)).not.toContain('missing-sentence');
  });

  it('flags a sentence referencing a lexeme that does not exist', () => {
    const p = pack({
      sentences: [{
        id: 'sen.a', canonical: 'रामः', acceptedForms: ['रामः'],
        translations: { hi: 'x', en: 'x' },
        lexemeIds: ['lex.ghost'], source: 'original',
      }] as ContentPack['sentences'],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('missing-lexeme');
  });

  it('flags a missing concept', () => {
    const p = pack({
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'akshara-build', target: 'क', conceptId: 'con.ghost', source: 'original' },
      ])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('missing-concept');
  });

  it('flags a duplicate id', () => {
    const l = lexeme('lex.a', 'जलम्');
    expect(lintContent(pack({ lexemes: [l, l] })).map((f) => f.rule)).toContain('duplicate-id');
  });

  it('flags a lexeme used by fewer than three exercises', () => {
    const p = pack({
      lexemes: [lexeme('lex.a', 'जलम्')],
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'match-pairs', lexemeIds: ['lex.a'], source: 'original' },
      ])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('lexeme-underused');
  });

  it('flags a lexeme used three times but by only one exercise type', () => {
    const p = pack({
      lexemes: [lexeme('lex.a', 'जलम्')],
      lessons: [lesson('les.a', [1, 2, 3].map((n) => ({
        id: `ex.${n}`, type: 'match-pairs', lexemeIds: ['lex.a'], source: 'original',
      })))],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('lexeme-underused');
  });

  // parseAkshara returns null for a multi-akshara target, so grading returns
  // wrong for every answer and the exercise can never be passed. Nothing
  // crashes; a child simply cannot get it right.
  it('flags an akshara-build target that is not a single akshara', () => {
    const p = pack({
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'akshara-build', target: 'कमल', source: 'original' },
      ])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('unbuildable-target');
  });

  it('accepts an akshara-build target that is a single akshara', () => {
    const p = pack({
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'akshara-build', target: 'क्ष', source: 'original' },
      ])],
    });
    expect(lintContent(p).map((f) => f.rule)).not.toContain('unbuildable-target');
  });

  // The schema's uniqueness check compares raw strings, but grading normalises
  // both sides, so these two options are both correct answers.
  it('flags akshara-select options that normalise to the same string', () => {
    const p = pack({
      lessons: [lesson('les.a', [{
        id: 'ex.1', type: 'akshara-select', target: 'अङ्ग',
        options: ['अङ्ग', 'अंग'],
        promptTranslations: { hi: 'x', en: 'x' }, source: 'original',
      }])],
    });
    expect(lintContent(p).map((f) => f.rule)).toContain('ambiguous-options');
  });

  it('accepts akshara-select options that stay distinct after normalising', () => {
    const p = pack({
      lessons: [lesson('les.a', [{
        id: 'ex.1', type: 'akshara-select', target: 'ऋ',
        options: ['ऋ', 'ऊ', 'उ'],
        promptTranslations: { hi: 'x', en: 'x' }, source: 'original',
      }])],
    });
    expect(lintContent(p).map((f) => f.rule)).not.toContain('ambiguous-options');
  });

  // A populated pack that satisfies every rule. The earlier version of this
  // test used an empty pack, which passes against an implementation that
  // returns [] unconditionally.
  it('passes a populated pack that satisfies every rule', () => {
    const p = pack({
      lexemes: [lexeme('lex.a', 'जलम्'), lexeme('lex.b', 'वृक्षः'), lexeme('lex.c', 'गजः')],
      concepts: [{
        id: 'con.a', titleTranslations: { hi: 'x', en: 'x' },
        bodyTranslations: { hi: 'x', en: 'x' }, source: 'original',
      }] as ContentPack['concepts'],
      lessons: [lesson('les.a', [
        { id: 'ex.1', type: 'match-pairs', lexemeIds: ['lex.a', 'lex.b', 'lex.c'], source: 'original' },
        { id: 'ex.2', type: 'match-pairs', lexemeIds: ['lex.a', 'lex.b', 'lex.c'], source: 'original' },
        { id: 'ex.3', type: 'select-image', lexemeId: 'lex.a', optionLexemeIds: ['lex.a', 'lex.b'], source: 'original' },
        { id: 'ex.4', type: 'select-image', lexemeId: 'lex.b', optionLexemeIds: ['lex.b', 'lex.c'], source: 'original' },
        { id: 'ex.5', type: 'select-image', lexemeId: 'lex.c', optionLexemeIds: ['lex.c', 'lex.a'], source: 'original' },
        { id: 'ex.6', type: 'akshara-build', target: 'क्ष', conceptId: 'con.a', source: 'original' },
      ])],
    });
    expect(lintContent(p)).toEqual([]);
  });

  it('returns nothing for an empty pack', () => {
    expect(lintContent(pack())).toEqual([]);
  });
});
