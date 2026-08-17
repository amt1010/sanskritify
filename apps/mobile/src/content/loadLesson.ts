import {
  LessonSchema, LexemeSchema, ch01Lesson, ch01Lexemes,
  type Lesson, type Lexeme,
} from '@sanskritify/content';

// Bundled content only. Task 12's pack build and OTA delivery replace this in
// a later plan; the shape of what the screen consumes does not change.
const LESSONS: Record<string, unknown> = {
  'les.ch01.u1.l1': ch01Lesson,
};

export function loadLesson(id: string): Lesson {
  const raw = LESSONS[id];
  if (raw === undefined) throw new Error(`unknown lesson: ${id}`);
  return LessonSchema.parse(raw);
}

export function loadLexemes(): Map<string, Lexeme> {
  const list = ch01Lexemes.map((l) => LexemeSchema.parse(l));
  return new Map(list.map((l) => [l.id, l]));
}
