import { describe, it, expect } from 'vitest';
import { LessonSchema, ConceptSchema, LexemeSchema } from '../../schema';
import lesson from './lesson-01.json';
import concepts from './concepts.json';
import lexemes from './lexemes.json';

describe('chapter 1 content', () => {
  it('every concept validates', () => {
    for (const c of concepts) expect(() => ConceptSchema.parse(c)).not.toThrow();
  });

  it('every lexeme validates', () => {
    for (const l of lexemes) expect(() => LexemeSchema.parse(l)).not.toThrow();
  });

  it('lesson 1 validates', () => {
    expect(() => LessonSchema.parse(lesson)).not.toThrow();
  });

  it('lesson 1 has at least six exercises', () => {
    expect(LessonSchema.parse(lesson).exercises.length).toBeGreaterThanOrEqual(6);
  });

  it('every akshara-select option list contains its target', () => {
    for (const ex of LessonSchema.parse(lesson).exercises) {
      if (ex.type === 'akshara-select') expect(ex.options).toContain(ex.target);
    }
  });

  // Every exercise must name a concept that exists in this chapter, or the
  // hint panel has nothing to show.
  it('every conceptId resolves to a concept in this chapter', () => {
    const ids = new Set(concepts.map((c) => (c as { id: string }).id));
    for (const ex of LessonSchema.parse(lesson).exercises) {
      if ('conceptId' in ex && ex.conceptId !== undefined) {
        expect(ids, `${ex.id} references ${ex.conceptId}`).toContain(ex.conceptId);
      }
    }
  });

  it('exercise ids are unique', () => {
    const ids = LessonSchema.parse(lesson).exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The prompt is the only thing that makes a recognition exercise solvable,
  // and it must not contain the answer.
  it('no akshara-select prompt gives away its target', () => {
    for (const ex of LessonSchema.parse(lesson).exercises) {
      if (ex.type !== 'akshara-select') continue;
      for (const locale of ['hi', 'en'] as const) {
        const prompt = ex.promptTranslations[locale];
        expect(prompt.includes(ex.target), `${ex.id} ${locale}: ${prompt}`).toBe(false);
      }
    }
  });
});
