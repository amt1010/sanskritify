import type { Akshara } from '@sanskritify/sanskrit';
import type { Exercise, Lexeme, LocaleCode } from '@sanskritify/content';

export type Verdict = 'correct' | 'near-miss' | 'wrong';
export type HintCode = 'matra-differs' | null;

export interface GradeResult {
  verdict: Verdict;
  hint: HintCode;
}

export type Answer =
  | { kind: 'akshara'; akshara: Akshara }
  | { kind: 'choice'; value: string }
  | { kind: 'pairs'; pairs: Array<{ lexemeId: string; gloss: string }> };

export interface GradeContext {
  lexemes: Map<string, Lexeme>;
  locale: LocaleCode;
}

export interface SessionState {
  lessonId: string;
  queue: Exercise[];
  index: number;
  hearts: number;
  maxHearts: number;
  xp: number;
  wrongCount: number;
  mistakeCount: number;
  requeues: Record<string, number>;
  status: 'in_progress' | 'complete' | 'failed';
}

export interface SessionOpts {
  hearts: number;
  maxHearts: number;
}
