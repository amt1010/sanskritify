import type { Exercise, Lesson } from '@sanskritify/content';
import { gradeAnswer } from './grading';
import type { Answer, GradeContext, GradeResult, SessionOpts, SessionState } from './types';

const XP_PER_LESSON = 10;
const XP_PERFECT_BONUS = 5;
const MAX_REQUEUES = 2;

export function createSession(lesson: Lesson, opts: SessionOpts): SessionState {
  // The boundary. A session built with no hearts used to report in_progress
  // and then fail on the learner's first correct answer, because the
  // hearts-exhausted check runs on every submit regardless of verdict.
  if (!Number.isInteger(opts.maxHearts) || opts.maxHearts < 1) {
    throw new Error(`maxHearts must be a positive integer, got ${opts.maxHearts}`);
  }
  if (!Number.isInteger(opts.hearts) || opts.hearts < 1 || opts.hearts > opts.maxHearts) {
    throw new Error(`hearts must be an integer between 1 and ${opts.maxHearts}, got ${opts.hearts}`);
  }

  return {
    lessonId: lesson.id,
    queue: [...lesson.exercises],
    index: 0,
    hearts: opts.hearts,
    maxHearts: opts.maxHearts,
    xp: 0,
    wrongCount: 0,
    mistakeCount: 0,
    requeues: {},
    status: 'in_progress',
  };
}

export function currentExercise(state: SessionState): Exercise | null {
  return state.queue[state.index] ?? null;
}

export function submitAnswer(
  state: SessionState,
  answer: Answer,
  ctx: GradeContext,
): { state: SessionState; result: GradeResult } {
  const exercise = currentExercise(state);
  if (state.status !== 'in_progress' || exercise === null) {
    return { state, result: { verdict: 'wrong', hint: null } };
  }

  const result = gradeAnswer(exercise, answer, ctx);

  // Only a wrong answer costs a heart. A near-miss re-queues but is free.
  const hearts = result.verdict === 'wrong' ? state.hearts - 1 : state.hearts;
  const wrongCount = result.verdict === 'wrong' ? state.wrongCount + 1 : state.wrongCount;
  // Hearts and the flawless bonus are different questions. A near-miss is
  // free but it is not flawless: keying the bonus off wrongCount alone paid
  // 15 XP for a lesson where an exercise was never once answered correctly.
  const mistakeCount =
    result.verdict === 'correct' ? state.mistakeCount : state.mistakeCount + 1;

  let queue = state.queue;
  let requeues = state.requeues;
  if (result.verdict !== 'correct') {
    const seen = state.requeues[exercise.id] ?? 0;
    // Capped so a learner who keeps missing one exercise still reaches the end.
    if (seen < MAX_REQUEUES) {
      queue = [...state.queue, exercise];
      requeues = { ...state.requeues, [exercise.id]: seen + 1 };
    }
  }

  const index = state.index + 1;

  let status: SessionState['status'] = 'in_progress';
  if (hearts <= 0) status = 'failed';
  else if (index >= queue.length) status = 'complete';

  const xp =
    status === 'complete'
      ? XP_PER_LESSON + (mistakeCount === 0 ? XP_PERFECT_BONUS : 0)
      : state.xp;

  return {
    state: { ...state, queue, index, hearts, wrongCount, mistakeCount, requeues, xp, status },
    result,
  };
}
