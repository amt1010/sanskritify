import { describe, it, expect } from 'vitest';
import { parseAkshara } from '@sanskritify/sanskrit';
import type { Lesson, Exercise } from '@sanskritify/content';
import { createSession, submitAnswer, currentExercise } from './session';
import type { GradeContext, SessionState } from './types';

const ctx: GradeContext = { lexemes: new Map(), locale: 'en' };

function ex(n: number, target: string): Exercise {
  return { id: `ex.${n}`, type: 'akshara-build', target, source: 'ncert-deepakam-ch02' };
}

const TARGETS = ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व', 'स्त'];

const lesson: Lesson = {
  id: 'les.ch01.u1.l1',
  unitId: 'unit.ch01.u1',
  titleTranslations: { hi: 'संयुक्त', en: 'Conjuncts' },
  exercises: TARGETS.map((t, i) => ex(i + 1, t)),
};

const opts = { hearts: 5, maxHearts: 5 };
const answer = (t: string) => ({ kind: 'akshara' as const, akshara: parseAkshara(t)! });
// क्षि is क्ष with a matra added: a near-miss. 'क्स' has a wrong consonant: wrong.
const nearMiss = (t: string) => answer(`${t}ि`);
const wrong = () => answer('क्स');

// Exercise is a ten-member discriminated union content-wide; only
// akshara-build carries `target`. Every exercise in this test lesson is
// akshara-build, so narrow here instead of widening the type with a cast.
function target(e: Exercise): string {
  if (e.type !== 'akshara-build') {
    throw new Error(`expected akshara-build, got ${e.type}`);
  }
  return e.target;
}

/** Play until the session ends, answering each exercise with `pick`. */
function playOut(
  start: SessionState,
  pick: (e: Exercise) => ReturnType<typeof answer>,
  limit = 60,
): SessionState {
  let s = start;
  for (let i = 0; i < limit && s.status === 'in_progress'; i += 1) {
    const e = currentExercise(s);
    if (e === null) break;
    s = submitAnswer(s, pick(e), ctx).state;
  }
  return s;
}

describe('createSession', () => {
  it('queues every exercise and starts in progress', () => {
    const s = createSession(lesson, opts);
    expect(s.queue).toHaveLength(6);
    expect(s.index).toBe(0);
    expect(s.status).toBe('in_progress');
    expect(s.wrongCount).toBe(0);
    expect(s.mistakeCount).toBe(0);
    expect(currentExercise(s)?.id).toBe('ex.1');
  });

  // A session that starts with no hearts used to report in_progress and then
  // fail on the learner's first correct answer.
  it.each([
    [{ hearts: 0, maxHearts: 5 }],
    [{ hearts: -1, maxHearts: 5 }],
    [{ hearts: 6, maxHearts: 5 }],
    [{ hearts: 2.5, maxHearts: 5 }],
    [{ hearts: 1, maxHearts: 0 }],
  ])('throws for invalid options %j', (bad) => {
    expect(() => createSession(lesson, bad)).toThrow();
  });

  it('names the offending value in the error', () => {
    expect(() => createSession(lesson, { hearts: 0, maxHearts: 5 })).toThrow(/got 0/);
  });
});

describe('submitAnswer', () => {
  it('advances on a correct answer without losing a heart', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), answer('क्ष'), ctx);
    expect(result.verdict).toBe('correct');
    expect(state.hearts).toBe(5);
    expect(state.index).toBe(1);
    expect(state.queue).toHaveLength(6);
  });

  it('costs a heart and re-queues on a wrong answer', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), wrong(), ctx);
    expect(result.verdict).toBe('wrong');
    expect(state.hearts).toBe(4);
    expect(state.wrongCount).toBe(1);
    expect(state.mistakeCount).toBe(1);
    expect(state.queue).toHaveLength(7);
    expect(state.queue[6]!.id).toBe('ex.1');
  });

  it('re-queues a near-miss without costing a heart', () => {
    const { state, result } = submitAnswer(createSession(lesson, opts), nearMiss('क्ष'), ctx);
    expect(result.verdict).toBe('near-miss');
    expect(state.hearts).toBe(5);
    expect(state.wrongCount).toBe(0);
    expect(state.mistakeCount).toBe(1);
    expect(state.queue).toHaveLength(7);
  });

  it('never fails a session on a correct answer, even at one heart', () => {
    const s = submitAnswer(createSession(lesson, { hearts: 1, maxHearts: 5 }), answer('क्ष'), ctx).state;
    expect(s.status).toBe('in_progress');
    expect(s.hearts).toBe(1);
  });

  it('fails the session when hearts reach zero', () => {
    const s = submitAnswer(createSession(lesson, { hearts: 1, maxHearts: 5 }), wrong(), ctx).state;
    expect(s.hearts).toBe(0);
    expect(s.status).toBe('failed');
    expect(s.xp).toBe(0);
  });

  it('ignores answers once the session is over', () => {
    const s = submitAnswer(createSession(lesson, { hearts: 1, maxHearts: 5 }), wrong(), ctx).state;
    expect(submitAnswer(s, answer('त्र'), ctx).state).toEqual(s);
  });

  it('re-queues an exercise at most twice, played through naturally', () => {
    // Answer ex.1 wrong every time it appears, everything else correctly.
    const s = playOut(createSession(lesson, opts), (e) => (e.id === 'ex.1' ? wrong() : answer(target(e))));
    expect(s.requeues['ex.1']).toBe(2);
    expect(s.queue).toHaveLength(8);
  });
});

describe('xp', () => {
  it('awards 15 for a flawless lesson', () => {
    const s = playOut(createSession(lesson, opts), (e) => answer(target(e)));
    expect(s.status).toBe('complete');
    expect(s.mistakeCount).toBe(0);
    expect(s.xp).toBe(15);
  });

  it('awards 10 when a wrong answer occurred', () => {
    let s = submitAnswer(createSession(lesson, opts), wrong(), ctx).state;
    s = playOut(s, (e) => answer(target(e)));
    expect(s.status).toBe('complete');
    expect(s.xp).toBe(10);
    expect(s.hearts).toBe(4);
  });

  // The bug this brief exists to fix: near-misses cost no hearts, so
  // wrongCount stayed 0 and a lesson the learner never got right scored 15.
  it('does not award the flawless bonus for a lesson full of near-misses', () => {
    const s = playOut(createSession(lesson, opts), (e) =>
      e.id === 'ex.1' ? nearMiss(target(e)) : answer(target(e)),
    );
    expect(s.status).toBe('complete');
    expect(s.hearts).toBe(5);
    expect(s.wrongCount).toBe(0);
    expect(s.mistakeCount).toBe(3);
    expect(s.xp).toBe(10);
  });
});

describe('bounded sessions', () => {
  // Deliberate: the re-queue cap keeps a session finite, so an exercise the
  // learner never gets right eventually stops coming back and the lesson ends.
  it('completes even when an exercise is never answered correctly', () => {
    const s = playOut(createSession(lesson, opts), (e) => (e.id === 'ex.1' ? nearMiss(target(e)) : answer(target(e))));
    expect(s.status).toBe('complete');
    expect(s.requeues['ex.1']).toBe(2);
  });

  it('terminates for every-answer-wrong within the heart budget', () => {
    const s = playOut(createSession(lesson, opts), () => wrong());
    expect(s.status).toBe('failed');
    expect(s.hearts).toBe(0);
  });
});
