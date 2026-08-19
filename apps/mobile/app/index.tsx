import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { isConsonant } from '@sanskritify/sanskrit';
import { streakLength } from '@sanskritify/core';
import { loadProgress } from '../src/storage/progressStore';

// These five conjuncts are the ones that most often fall back to a visible
// virama on a system font. If they render as ligatures here, the bundled
// font is working.
const CONJUNCTS = ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व'];

export default function Home() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((progress) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      setStreak(streakLength(progress.activityDays, today));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>संस्कृतम्</Text>
      {/* Zero reads as a failure state on a fresh install, not a feature —
          so the badge only appears once there's something to show. */}
      {streak > 0 && <Text testID="streak">{`🔥 ${streak}`}</Text>}
      <Text style={styles.conjuncts}>{CONJUNCTS.join('  ')}</Text>
      {/* Proves the Metro config actually resolves a workspace package, not
          just that the file compiles under tsc. */}
      <Text testID="sanskrit-import-check" style={{ opacity: 0 }}>
        {isConsonant('क') ? 'ok' : 'fail'}
      </Text>
      <Link href="/lesson/les.ch01.u1.l1" style={styles.link}>
        पाठं आरभस्व
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  title: { fontFamily: 'NotoDeva-Bold', fontSize: 40 },
  conjuncts: { fontFamily: 'NotoDeva', fontSize: 32 },
  link: { fontFamily: 'NotoDeva', fontSize: 20, color: '#1a7f37' },
});
