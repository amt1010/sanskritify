import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lexeme, LocaleCode } from '@sanskritify/content';

export interface MatchPairsProps {
  lexemes: Lexeme[];
  locale: LocaleCode;
  onChange: (pairs: Array<{ lexemeId: string; gloss: string }>) => void;
}

export function MatchPairs({ lexemes, locale, onChange }: MatchPairsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Array<{ lexemeId: string; gloss: string }>>([]);

  const glosses = lexemes.map((l) => l.translations[locale]).sort();

  function pickGloss(gloss: string): void {
    if (selected === null) return;
    const next = [...pairs.filter((p) => p.lexemeId !== selected), { lexemeId: selected, gloss }];
    setPairs(next);
    setSelected(null);
    onChange(next);
  }

  return (
    <View style={styles.row}>
      <View style={styles.column}>
        {lexemes.map((l) => (
          <Pressable
            key={l.id}
            testID={`lex-${l.id}`}
            style={[styles.tile, selected === l.id && styles.tileActive]}
            onPress={() => setSelected(l.id)}
          >
            <Text style={styles.deva}>{l.devanagari}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.column}>
        {glosses.map((g) => (
          <Pressable key={g} testID={`gloss-${g}`} style={styles.tile} onPress={() => pickGloss(g)}>
            <Text style={styles.gloss}>{g}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16 },
  column: { flex: 1, gap: 8 },
  tile: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#d0d7de',
    alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  tileActive: { borderColor: '#1a7f37', backgroundColor: '#eaf6ec' },
  deva: { fontFamily: 'NotoDeva', fontSize: 22 },
  gloss: { fontFamily: 'NotoDeva', fontSize: 16 },
});
