import { diffAkshara, normalize, parseAkshara } from '@sanskritify/sanskrit';
import type { Exercise } from '@sanskritify/content';
import type { Answer, GradeContext, GradeResult } from './types';

const CORRECT: GradeResult = { verdict: 'correct', hint: null };
const WRONG: GradeResult = { verdict: 'wrong', hint: null };

export function gradeAnswer(
  exercise: Exercise,
  answer: Answer,
  ctx: GradeContext,
): GradeResult {
  switch (exercise.type) {
    case 'akshara-build': {
      if (answer.kind !== 'akshara') return WRONG;
      // A target the composer cannot build is a content bug. Task 12's lint
      // catches it; at runtime there is nothing better to do than refuse the
      // answer, because throwing would end a child's lesson.
      const expected = parseAkshara(exercise.target);
      if (expected === null) return WRONG;
      const diff = diffAkshara(expected, answer.akshara);
      if (diff.kind === 'equal') return CORRECT;
      // Near-miss is consonants right, matra or halant wrong. It does not cost
      // a heart, so this boundary is load-bearing. sign-differs and
      // consonants-differ both fall through to wrong.
      if (diff.kind === 'matra-differs') return { verdict: 'near-miss', hint: 'matra-differs' };
      return WRONG;
    }

    case 'akshara-select': {
      if (answer.kind !== 'choice') return WRONG;
      return normalize(answer.value) === normalize(exercise.target) ? CORRECT : WRONG;
    }

    case 'match-pairs': {
      if (answer.kind !== 'pairs') return WRONG;
      if (answer.pairs.length !== exercise.lexemeIds.length) return WRONG;

      // The submitted lexemes must be exactly the exercise's lexemes. Checking
      // only the count and each pair's own gloss let a learner answer the same
      // lexeme three times and be told they matched all three.
      const submitted = new Set(answer.pairs.map((p) => p.lexemeId));
      if (submitted.size !== exercise.lexemeIds.length) return WRONG;
      if (!exercise.lexemeIds.every((id) => submitted.has(id))) return WRONG;

      const allRight = answer.pairs.every((p) => {
        const lexeme = ctx.lexemes.get(p.lexemeId);
        if (lexeme === undefined) return false;
        return normalize(lexeme.translations[ctx.locale]) === normalize(p.gloss);
      });
      return allRight ? CORRECT : WRONG;
    }

    default:
      return WRONG;
  }
}
