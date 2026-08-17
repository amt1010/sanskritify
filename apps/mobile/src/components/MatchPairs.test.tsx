import { render, fireEvent, type RenderResult } from '@testing-library/react-native';
import type { Lexeme } from '@sanskritify/content';
import { MatchPairs } from './MatchPairs';

// Chapter 1 has no lexemes (Task 13), so MatchPairs never renders through
// LessonScreen in this plan. This is its only coverage.

// Devanagari kept to single consonants already used elsewhere in this app
// (AksharaComposer's DEFAULT_CONSONANTS), so there is nothing here to
// transcribe wrong.
const lexemes: Lexeme[] = [
  { id: 'lex.test.001', devanagari: 'क', translations: { hi: 'क', en: 'ka' }, source: 'original' },
  { id: 'lex.test.002', devanagari: 'ख', translations: { hi: 'ख', en: 'kha' }, source: 'original' },
  { id: 'lex.test.003', devanagari: 'ग', translations: { hi: 'ग', en: 'ga' }, source: 'original' },
];

describe('MatchPairs', () => {
  it('renders a tile for every lexeme and every gloss', async () => {
    const { getByTestId } = await render(
      <MatchPairs lexemes={lexemes} locale="en" onChange={jest.fn()} />,
    );
    for (const l of lexemes) expect(getByTestId(`lex-${l.id}`)).toBeTruthy();
    for (const gloss of ['ka', 'kha', 'ga']) expect(getByTestId(`gloss-${gloss}`)).toBeTruthy();
  });

  it('calls onChange with the pairing when a lexeme then a gloss is picked', async () => {
    const onChange = jest.fn();
    const { getByTestId }: RenderResult = await render(
      <MatchPairs lexemes={lexemes} locale="en" onChange={onChange} />,
    );
    await fireEvent.press(getByTestId('lex-lex.test.001'));
    await fireEvent.press(getByTestId('gloss-ka'));
    expect(onChange).toHaveBeenCalledWith([{ lexemeId: 'lex.test.001', gloss: 'ka' }]);
  });

  // Re-picking a gloss for a lexeme that already has one replaces the pairing.
  // The alternative — appending — would let a learner match the same lexeme
  // twice and be told both pairings are still active.
  it('replaces an existing pairing instead of adding a duplicate', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MatchPairs lexemes={lexemes} locale="en" onChange={onChange} />,
    );
    await fireEvent.press(getByTestId('lex-lex.test.001'));
    await fireEvent.press(getByTestId('gloss-ka'));
    await fireEvent.press(getByTestId('lex-lex.test.001'));
    await fireEvent.press(getByTestId('gloss-kha'));
    expect(onChange).toHaveBeenLastCalledWith([{ lexemeId: 'lex.test.001', gloss: 'kha' }]);
  });
});
