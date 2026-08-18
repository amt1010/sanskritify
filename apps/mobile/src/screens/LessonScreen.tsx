import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  createSession, currentExercise, currentHearts, msUntilNextHeart, submitAnswer,
  type Answer, type GradeContext, type GradeResult, type SessionState,
} from '@sanskritify/core';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from '../components/AksharaComposer';
import { MatchPairs } from '../components/MatchPairs';
import { loadLesson, loadLexemes } from '../content/loadLesson';
import { loadProgress, saveProgress, MAX_HEARTS, type StoredProgress } from '../storage/progressStore';

const EMPTY_AKSHARA: Akshara = { parts: [], matra: null, sign: null };

const HINT_TEXT: Partial<Record<string, { hi: string; en: string }>> = {
  'matra-differs': {
    hi: 'सही अक्षर, गलत मात्रा',
    en: 'Right consonant, wrong vowel mark',
  },
};

export interface LessonScreenProps {
  lessonId: string;
  locale?: 'hi' | 'en';
}

export function LessonScreen({ lessonId, locale = 'hi' }: LessonScreenProps) {
  const lesson = useMemo(() => loadLesson(lessonId), [lessonId]);
  const ctx: GradeContext = useMemo(() => ({ lexemes: loadLexemes(), locale }), [locale]);

  const [progress, setProgress] = useState<StoredProgress | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [heartsWaitMs, setHeartsWaitMs] = useState<number | null>(null);
  const [draft, setDraft] = useState<Answer | null>(null);
  const [akshara, setAkshara] = useState<Akshara>(EMPTY_AKSHARA);
  const [result, setResult] = useState<GradeResult | null>(null);

  // A fresh mount is a fresh lesson attempt, so this also re-checks hearts
  // if the learner backs out and returns after regen time has passed.
  useEffect(() => {
    let cancelled = false;
    loadProgress().then((stored) => {
      if (cancelled) return;
      const now = Date.now();
      const live = currentHearts(stored.hearts.count, stored.hearts.updatedAt, now, MAX_HEARTS);
      setProgress(stored);
      if (live <= 0) {
        setHeartsWaitMs(msUntilNextHeart(stored.hearts.count, stored.hearts.updatedAt, now, MAX_HEARTS));
        return;
      }
      setSession(createSession(lesson, { hearts: live, maxHearts: MAX_HEARTS }));
    });
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  const exercise = session === null ? null : currentExercise(session);

  // The draft answer must start empty for a new exercise. `result` is
  // deliberately NOT reset here: submitAnswer() advances session.index for
  // every verdict, including near-miss, so the exercise always changes in
  // the very same update that produces a near-miss's result. Clearing result
  // on that transition would erase the hint before it was ever shown — it
  // clears instead the moment the learner starts answering again, below.
  useEffect(() => {
    setDraft(null);
    setAkshara(EMPTY_AKSHARA);
  }, [exercise?.id]);

  // A stale hint belongs to the exercise that produced it. Once the learner
  // starts entering a new answer, it no longer applies.
  function chooseDraft(next: Answer): void {
    setDraft(next);
    setResult(null);
  }

  function changeAkshara(next: Akshara): void {
    setAkshara(next);
    setResult(null);
  }

  const hasAnswer =
    exercise?.type === 'akshara-build' ? akshara.parts.length > 0 : draft !== null;

  function check(): void {
    // A tap on Check before an answer exists is a mis-tap, not a wrong
    // answer. Grading an empty choice would cost a heart for it.
    if (session === null || progress === null || exercise === null || !hasAnswer) return;
    const answer: Answer =
      exercise.type === 'akshara-build' ? { kind: 'akshara', akshara } : draft!;
    const next = submitAnswer(session, answer, ctx);
    setSession(next.state);
    setResult(next.result);

    // Only a real change needs writing back. Regen-only growth (hearts.ts's
    // currentHearts) is always re-derivable from the original stored
    // snapshot plus elapsed time, so it's never worth a write; a loss is not
    // derivable from anything and must be persisted before the app can be
    // killed out from under it.
    if (next.state.hearts < session.hearts) {
      const nextProgress: StoredProgress = {
        ...progress,
        hearts: { count: next.state.hearts, updatedAt: Date.now() },
      };
      setProgress(nextProgress);
      void saveProgress(nextProgress);
    }
  }

  if (session === null) {
    if (heartsWaitMs !== null) {
      const minutes = Math.ceil(heartsWaitMs / 60_000);
      return (
        <View style={styles.screen}>
          <Text style={styles.big}>{locale === 'hi' ? 'हृदयानि समाप्तानि' : 'Out of hearts'}</Text>
          <Text testID="hearts-wait">
            {locale === 'hi' ? `${minutes} मिनटों में अगला हृदय` : `Next heart in ${minutes} min`}
          </Text>
        </View>
      );
    }
    return <View style={styles.screen} />;
  }

  if (exercise === null || session.status !== 'in_progress') {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.big}>{session.status === 'complete' ? 'साधु!' : 'पुनः प्रयत्नं कुरु'}</Text>
        <Text testID="xp">{`XP ${session.xp}`}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hud}>
        <Text testID="progress">{`${session.index + 1} / ${session.queue.length}`}</Text>
        <Text testID="hearts">{`♥ ${session.hearts}`}</Text>
      </View>

      {exercise.type === 'akshara-select' && (
        <>
          {/* Never render exercise.target here. The target is one of the
              options, so showing it would display the answer. */}
          <Text style={styles.prompt}>{exercise.promptTranslations[locale]}</Text>
          <View style={styles.options}>
            {exercise.options.map((o) => (
              <Pressable
                key={o}
                testID={`opt-${o}`}
                style={[
                  styles.option,
                  draft?.kind === 'choice' && draft.value === o && styles.optionActive,
                ]}
                onPress={() => chooseDraft({ kind: 'choice', value: o })}
              >
                <Text style={styles.deva}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {exercise.type === 'akshara-build' && (
        <>
          <Text style={styles.prompt}>
            {locale === 'hi' ? 'यह अक्षर बनाओ' : 'Build this letter'}
          </Text>
          <Text style={styles.target}>{exercise.target}</Text>
          <AksharaComposer value={akshara} onChange={changeAkshara} />
        </>
      )}

      {exercise.type === 'match-pairs' && (
        <MatchPairs
          lexemes={exercise.lexemeIds
            .map((id) => ctx.lexemes.get(id))
            .filter((l): l is NonNullable<typeof l> => l !== undefined)}
          locale={locale}
          onChange={(pairs) => chooseDraft({ kind: 'pairs', pairs })}
        />
      )}

      {result !== null && result.hint !== null && HINT_TEXT[result.hint] !== undefined && (
        <Text style={styles.hint}>{HINT_TEXT[result.hint]![locale]}</Text>
      )}

      <Pressable
        testID="check"
        style={[styles.check, !hasAnswer && styles.checkDisabled]}
        disabled={!hasAnswer}
        onPress={check}
      >
        <Text style={styles.checkText}>{locale === 'hi' ? 'जाँचो' : 'Check'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 20, gap: 20, justifyContent: 'center' },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  prompt: { fontFamily: 'NotoDeva', fontSize: 18, textAlign: 'center' },
  target: { fontFamily: 'NotoDeva', fontSize: 64, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  option: {
    minWidth: 72, minHeight: 72, borderRadius: 14, borderWidth: 2,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
  },
  optionActive: { borderColor: '#1a7f37', backgroundColor: '#eaf6ec' },
  deva: { fontFamily: 'NotoDeva', fontSize: 32 },
  hint: { fontFamily: 'NotoDeva', textAlign: 'center', color: '#9a6700', fontSize: 16 },
  check: {
    backgroundColor: '#1a7f37', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  checkDisabled: { backgroundColor: '#9ba3ab' },
  checkText: { fontFamily: 'NotoDeva', color: 'white', fontSize: 18, fontWeight: '600' },
  big: { fontFamily: 'NotoDeva', fontSize: 40, textAlign: 'center' },
});
