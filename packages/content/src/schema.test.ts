import { describe, it, expect } from 'vitest';
import { LexemeSchema, SentenceSchema, ExerciseSchema, LessonSchema } from './schema';

const validSelect = {
  id: 'ex.ch01.002',
  type: 'akshara-select',
  target: 'ऋ',
  options: ['ऋ', 'ऊ', 'उ', 'ऌ'],
  promptTranslations: { hi: 'ऋ चुनो', en: 'Pick ऋ' },
  source: 'ncert-deepakam-ch01',
};

describe('LexemeSchema', () => {
  it('accepts a valid lexeme', () => {
    const parsed = LexemeSchema.parse({
      id: 'lex.balakah',
      devanagari: 'बालकः',
      translations: { hi: 'लड़का', en: 'boy' },
      source: 'ncert-deepakam-ch03',
    });
    expect(parsed.devanagari).toBe('बालकः');
  });

  it('rejects a lexeme missing the English gloss', () => {
    expect(() =>
      LexemeSchema.parse({
        id: 'lex.balakah',
        devanagari: 'बालकः',
        translations: { hi: 'लड़का' },
        source: 'ncert-deepakam-ch03',
      }),
    ).toThrow();
  });

  it('rejects an id without the lex. prefix', () => {
    expect(() =>
      LexemeSchema.parse({
        id: 'balakah',
        devanagari: 'बालकः',
        translations: { hi: 'लड़का', en: 'boy' },
        source: 'original',
      }),
    ).toThrow();
  });

  // A typo'd optional key used to parse clean and vanish, taking the audio
  // with it and warning nobody.
  it('rejects an unknown key', () => {
    expect(() =>
      LexemeSchema.parse({
        id: 'lex.balakah',
        devanagari: 'बालकः',
        translations: { hi: 'लड़का', en: 'boy' },
        source: 'original',
        audioReff: 'audio/balakah.mp3',
      }),
    ).toThrow();
  });

  it('rejects a source outside the known chapters', () => {
    expect(() =>
      LexemeSchema.parse({
        id: 'lex.x',
        devanagari: 'क',
        translations: { hi: 'क', en: 'ka' },
        source: 'ncert-deepakam-ch17',
      }),
    ).toThrow();
  });
});

describe('SentenceSchema', () => {
  const base = {
    id: 'sen.ch03.001',
    canonical: 'रामः ग्रामं गच्छति',
    acceptedForms: ['रामः ग्रामं गच्छति', 'ग्रामं रामः गच्छति'],
    translations: { hi: 'राम गाँव जाता है', en: 'Rama goes to the village' },
    lexemeIds: ['lex.ramah', 'lex.gramam', 'lex.gacchati'],
    source: 'ncert-deepakam-ch03',
  };

  it('accepts a sentence whose accepted forms include the canonical', () => {
    expect(SentenceSchema.parse(base).canonical).toBe('रामः ग्रामं गच्छति');
  });

  // Sanskrit word order is free, so acceptedForms is hand-authored. Leaving
  // the canonical form out of it means the app marks its own answer wrong.
  it('rejects a sentence whose accepted forms omit the canonical', () => {
    expect(() =>
      SentenceSchema.parse({ ...base, acceptedForms: ['ग्रामं रामः गच्छति'] }),
    ).toThrow();
  });
});

describe('ExerciseSchema', () => {
  it('accepts an akshara-build exercise', () => {
    const parsed = ExerciseSchema.parse({
      id: 'ex.ch01.001',
      type: 'akshara-build',
      target: 'क्ष',
      conceptId: 'con.conjunct',
      source: 'ncert-deepakam-ch02',
    });
    expect(parsed.type).toBe('akshara-build');
  });

  // The whole point of one exported name: this is the value the plan's
  // ExerciseSchema silently rejected.
  it('accepts an akshara-select exercise', () => {
    const parsed = ExerciseSchema.parse(validSelect);
    expect(parsed.type).toBe('akshara-select');
    if (parsed.type === 'akshara-select') expect(parsed.options).toHaveLength(4);
  });

  it('accepts a match-pairs exercise', () => {
    const parsed = ExerciseSchema.parse({
      id: 'ex.ch01.010',
      type: 'match-pairs',
      lexemeIds: ['lex.a', 'lex.b', 'lex.c'],
      source: 'ncert-deepakam-ch01',
    });
    expect(parsed.type).toBe('match-pairs');
  });

  it('rejects an akshara-select whose options omit the target', () => {
    expect(() => ExerciseSchema.parse({ ...validSelect, options: ['ऊ', 'उ', 'ऌ'] })).toThrow();
  });

  // Task 16 renders option tiles keyed by their own text. Duplicates make two
  // identical tiles and an ambiguous selector.
  it('rejects an akshara-select with duplicate options', () => {
    expect(() => ExerciseSchema.parse({ ...validSelect, options: ['ऋ', 'ऋ', 'ऊ'] })).toThrow();
  });

  it('rejects an akshara-select with no prompt, which would show the answer', () => {
    const { promptTranslations, ...noPrompt } = validSelect;
    expect(() => ExerciseSchema.parse(noPrompt)).toThrow();
  });

  it('rejects an unknown exercise type', () => {
    expect(() => ExerciseSchema.parse({ id: 'ex.x', type: 'sing', source: 'original' })).toThrow();
  });

  it('rejects an unknown key on a known type', () => {
    expect(() => ExerciseSchema.parse({ ...validSelect, audioReff: 'x.mp3' })).toThrow();
  });

  // The eight types with no renderer yet still have to validate, or chapter 3
  // content cannot be authored ahead of its UI.
  it.each([
    ['select-image', { lexemeId: 'lex.a', optionLexemeIds: ['lex.a', 'lex.b'] }],
    ['translate-to-locale', { sentenceId: 'sen.a' }],
    ['translate-to-sanskrit', { sentenceId: 'sen.a' }],
    ['fill-blank', { sentenceId: 'sen.a', blankIndex: 0, options: ['क', 'ख'] }],
    ['listen-select', { audioRef: 'a.mp3', target: 'क', options: ['क', 'ख'] }],
    ['listen-build', { audioRef: 'a.mp3', sentenceId: 'sen.a' }],
    ['order-sentence', { sentenceId: 'sen.a' }],
    ['speak', { sentenceId: 'sen.a', enabled: false }],
  ])('accepts a %s exercise', (type, rest) => {
    expect(ExerciseSchema.parse({ id: 'ex.x', type, source: 'original', ...rest }).type).toBe(type);
  });
});

describe('LessonSchema', () => {
  const sixExercises = Array.from({ length: 6 }, (_, i) => ({ ...validSelect, id: `ex.ch01.10${i}` }));
  const lesson = {
    id: 'les.ch01.u1.l1',
    unitId: 'unit.ch01.u1',
    titleTranslations: { hi: 'स्वर', en: 'Vowels' },
    exercises: sixExercises,
  };

  it('accepts a lesson with six exercises', () => {
    expect(LessonSchema.parse(lesson).exercises).toHaveLength(6);
  });

  it('rejects a lesson with fewer than six exercises', () => {
    expect(() => LessonSchema.parse({ ...lesson, exercises: [] })).toThrow();
  });

  // The error has to name which exercise, or fixing a 40-exercise pack is a
  // guessing game.
  it('reports the index of the offending exercise', () => {
    const bad = {
      ...lesson,
      exercises: [...sixExercises.slice(0, 5), { ...validSelect, options: ['ऊ', 'उ'] }],
    };
    const result = LessonSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(['exercises', 5, 'options']);
    }
  });
});
