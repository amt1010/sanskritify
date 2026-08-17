import { normalize, parseAkshara } from '@sanskritify/sanskrit';
import type { ContentPack, Exercise } from '@sanskritify/content';

export type ContentRuleId =
  | 'missing-lexeme'
  | 'missing-concept'
  | 'missing-sentence'
  | 'duplicate-id'
  | 'lesson-too-short'
  | 'lexeme-underused'
  | 'unbuildable-target'
  | 'ambiguous-options';

export interface ContentFinding {
  rule: ContentRuleId;
  id: string;
  detail: string;
}

const MIN_EXERCISES_PER_LESSON = 6;
const MIN_EXERCISES_PER_LEXEME = 3;
const MIN_TYPES_PER_LEXEME = 2;

// select-image carries two lexeme references, not one. Missing the second let
// an exercise offer options that do not exist.
function lexemeRefs(ex: Exercise): string[] {
  const refs: string[] = [];
  if ('lexemeIds' in ex) refs.push(...ex.lexemeIds);
  if ('lexemeId' in ex) refs.push(ex.lexemeId);
  if ('optionLexemeIds' in ex) refs.push(...ex.optionLexemeIds);
  return refs;
}

// Six of the eleven exercise types point at a sentence.
function sentenceRefs(ex: Exercise): string[] {
  return 'sentenceId' in ex ? [ex.sentenceId] : [];
}

export function lintContent(pack: ContentPack): ContentFinding[] {
  const out: ContentFinding[] = [];
  const exercises = pack.lessons.flatMap((l) => l.exercises);

  const seen = new Set<string>();
  const allIds = [
    ...pack.lexemes.map((x) => x.id),
    ...pack.sentences.map((x) => x.id),
    ...pack.concepts.map((x) => x.id),
    ...pack.lessons.map((x) => x.id),
    ...exercises.map((x) => x.id),
  ];
  for (const id of allIds) {
    if (seen.has(id)) out.push({ rule: 'duplicate-id', id, detail: 'id appears more than once' });
    seen.add(id);
  }

  const lexemeIds = new Set(pack.lexemes.map((x) => x.id));
  const conceptIds = new Set(pack.concepts.map((x) => x.id));
  const sentenceIds = new Set(pack.sentences.map((x) => x.id));

  for (const ex of exercises) {
    for (const ref of lexemeRefs(ex)) {
      if (!lexemeIds.has(ref)) {
        out.push({ rule: 'missing-lexeme', id: ex.id, detail: `references ${ref}` });
      }
    }
    for (const ref of sentenceRefs(ex)) {
      if (!sentenceIds.has(ref)) {
        out.push({ rule: 'missing-sentence', id: ex.id, detail: `references ${ref}` });
      }
    }
    if ('conceptId' in ex && ex.conceptId !== undefined && !conceptIds.has(ex.conceptId)) {
      out.push({ rule: 'missing-concept', id: ex.id, detail: `references ${ex.conceptId}` });
    }

    // A target the composer cannot build makes the exercise unpassable, and it
    // fails silently: grading just returns wrong for every answer.
    if (ex.type === 'akshara-build' && parseAkshara(ex.target) === null) {
      out.push({
        rule: 'unbuildable-target', id: ex.id,
        detail: `target ${ex.target} is not a single akshara`,
      });
    }

    // The schema compares options as raw strings, but grading normalises both
    // sides, so options that normalise alike are two correct answers.
    if (ex.type === 'akshara-select') {
      const normalised = ex.options.map(normalize);
      if (new Set(normalised).size !== normalised.length) {
        out.push({
          rule: 'ambiguous-options', id: ex.id,
          detail: `options normalise to the same string: ${ex.options.join(', ')}`,
        });
      }
    }
  }

  for (const sentence of pack.sentences) {
    for (const ref of sentence.lexemeIds) {
      if (!lexemeIds.has(ref)) {
        out.push({ rule: 'missing-lexeme', id: sentence.id, detail: `references ${ref}` });
      }
    }
  }

  // LessonSchema already enforces min(6) and lintContent takes a parsed pack,
  // so this cannot fire on the CLI path. Kept for callers that assemble a pack
  // in memory without parsing it first.
  for (const lesson of pack.lessons) {
    if (lesson.exercises.length < MIN_EXERCISES_PER_LESSON) {
      out.push({
        rule: 'lesson-too-short', id: lesson.id,
        detail: `${lesson.exercises.length} exercises, need ${MIN_EXERCISES_PER_LESSON}`,
      });
    }
  }

  // Review lessons are generated from due lexemes, so a lexeme reachable by
  // only one exercise gets memorised as that exercise rather than learned.
  for (const lexeme of pack.lexemes) {
    const using = exercises.filter((ex) => lexemeRefs(ex).includes(lexeme.id));
    const types = new Set(using.map((ex) => ex.type));
    if (using.length < MIN_EXERCISES_PER_LEXEME || types.size < MIN_TYPES_PER_LEXEME) {
      out.push({
        rule: 'lexeme-underused', id: lexeme.id,
        detail: `${using.length} exercises across ${types.size} types`,
      });
    }
  }

  return out;
}
