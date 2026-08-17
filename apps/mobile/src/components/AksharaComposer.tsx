import { Pressable, StyleSheet, Text, View } from 'react-native';
import { composeAkshara, type Akshara } from '@sanskritify/sanskrit';

const DEFAULT_CONSONANTS = [
  'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ',
  'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न',
  'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व',
  'श', 'ष', 'स', 'ह',
];

const DEFAULT_MATRAS = ['ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ'];

// Anusvara and visarga are signs, not matras: they are written after the matra,
// so they need their own slot. Putting them in the matra list made कां
// impossible to build, because the ं would occupy the slot the ा needs.
const DEFAULT_SIGNS = ['ं', 'ः'];

const VIRAMA_KEY = '्';

export interface AksharaComposerProps {
  value: Akshara;
  onChange: (next: Akshara) => void;
  consonants?: string[];
  matras?: string[];
  signs?: string[];
}

export function AksharaComposer({
  value,
  onChange,
  consonants = DEFAULT_CONSONANTS,
  matras = DEFAULT_MATRAS,
  signs = DEFAULT_SIGNS,
}: AksharaComposerProps) {
  function pressConsonant(c: string): void {
    onChange({ ...value, parts: [...value.parts, { consonant: c, halant: false }] });
  }

  function pressVirama(): void {
    if (value.parts.length === 0) return;
    const parts = value.parts.map((p, i) =>
      i === value.parts.length - 1 ? { ...p, halant: true } : p,
    );
    onChange({ ...value, parts });
  }

  // A matra or a sign has nothing to attach to without a consonant.
  function pressMatra(m: string): void {
    if (value.parts.length === 0) return;
    onChange({ ...value, matra: m });
  }

  function pressSign(s: string): void {
    if (value.parts.length === 0) return;
    onChange({ ...value, sign: s });
  }

  // Undo in the order the learner built it: sign, then matra, then the halant
  // on the last consonant, then the consonant itself.
  function backspace(): void {
    if (value.sign !== null) {
      onChange({ ...value, sign: null });
      return;
    }
    if (value.matra !== null) {
      onChange({ ...value, matra: null });
      return;
    }
    const last = value.parts[value.parts.length - 1];
    if (last === undefined) return;
    if (last.halant) {
      const parts = value.parts.map((p, i) =>
        i === value.parts.length - 1 ? { ...p, halant: false } : p,
      );
      onChange({ ...value, parts });
      return;
    }
    onChange({ ...value, parts: value.parts.slice(0, -1) });
  }

  return (
    <View style={styles.root}>
      <View style={styles.previewBox}>
        <Text testID="preview" style={styles.preview}>
          {composeAkshara(value)}
        </Text>
      </View>

      <View style={styles.keys}>
        {consonants.map((c) => (
          <Pressable key={c} testID={`key-${c}`} style={styles.key} onPress={() => pressConsonant(c)}>
            <Text style={styles.keyText}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.keys}>
        <Pressable testID="key-virama" style={[styles.key, styles.viramaKey]} onPress={pressVirama}>
          <Text style={styles.keyText}>{VIRAMA_KEY}</Text>
        </Pressable>
        {matras.map((m) => (
          <Pressable key={m} testID={`key-${m}`} style={styles.key} onPress={() => pressMatra(m)}>
            <Text style={styles.keyText}>{m}</Text>
          </Pressable>
        ))}
        {signs.map((s) => (
          <Pressable key={s} testID={`key-${s}`} style={[styles.key, styles.signKey]} onPress={() => pressSign(s)}>
            <Text style={styles.keyText}>{s}</Text>
          </Pressable>
        ))}
        <Pressable testID="backspace" style={styles.key} onPress={backspace}>
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, alignItems: 'center' },
  previewBox: {
    minHeight: 96, minWidth: 160, borderRadius: 16, borderWidth: 2,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
  },
  preview: { fontFamily: 'NotoDeva', fontSize: 56 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  key: {
    minWidth: 44, minHeight: 44, borderRadius: 10, borderWidth: 1,
    borderColor: '#d0d7de', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8,
  },
  viramaKey: { backgroundColor: '#fff4e5' },
  signKey: { backgroundColor: '#eef2ff' },
  keyText: { fontFamily: 'NotoDeva', fontSize: 22 },
});
