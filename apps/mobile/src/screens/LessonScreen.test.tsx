import { render, fireEvent, type RenderResult } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LessonScreen } from './LessonScreen';
import { loadProgress, saveProgress } from '../storage/progressStore';

// @testing-library/react-native v14 made `render` and `fireEvent.*` async
// (they now await React's `act()` internally, the same thing Task 15 found
// for AksharaComposer.test.tsx), so every call here is awaited.

// Chapter 1, lesson 1: five akshara-select exercises (targets अ आ इ ऊ ऋ) then
// three akshara-build exercises (targets कि की कु). Fixed by Task 13's
// content — if these targets ever change, these tests must change with them.

async function playSelect(getByTestId: RenderResult['getByTestId'], option: string): Promise<void> {
  await fireEvent.press(getByTestId(`opt-${option}`));
  await fireEvent.press(getByTestId('check'));
}

// The mocked AsyncStorage is a real in-memory store shared across tests in
// this file, now that LessonScreen reads and writes progress through it.
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('LessonScreen', () => {
  it('shows five hearts at the start', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    expect(getByTestId('hearts').props.children).toContain('5');
  });

  it('never renders the target for akshara-select, which would be the answer', async () => {
    const { queryAllByText } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    // अ appears exactly once, as an option tile — not also as a prompt.
    expect(queryAllByText('अ')).toHaveLength(1);
  });

  it('disables Check until an answer is chosen', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    expect(getByTestId('check').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(getByTestId('opt-अ'));
    expect(getByTestId('check').props.accessibilityState?.disabled).toBeFalsy();
  });

  // Pressing Check with nothing selected used to fall back to an empty
  // choice, which graded wrong and cost a heart for a mis-tap.
  it('does nothing when Check is pressed with no answer chosen', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    await fireEvent.press(getByTestId('check'));
    expect(getByTestId('hearts').props.children).toContain('5');
    expect(getByTestId('progress').props.children).toContain('1');
  });

  it('advances to the next exercise after a correct answer', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    await playSelect(getByTestId, 'अ'); // exercise 1, target अ
    expect(getByTestId('progress').props.children).toContain('2');
  });

  it('loses a heart on a wrong answer', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    await playSelect(getByTestId, 'आ'); // wrong; target is अ
    expect(getByTestId('hearts').props.children).toContain('4');
  });

  // Plays through the real exercises rather than jumping via a test-only prop,
  // so this exercises the actual advance path instead of a state the reducer
  // could never reach on its own.
  it('shows the matra hint on a near-miss without losing a heart', async () => {
    const { getByTestId, queryByText } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);

    await playSelect(getByTestId, 'अ'); // 1: अ, correct
    await playSelect(getByTestId, 'आ'); // 2: आ, correct
    await playSelect(getByTestId, 'इ'); // 3: इ, correct
    await playSelect(getByTestId, 'ऊ'); // 4: ऊ, correct
    await playSelect(getByTestId, 'ऋ'); // 5: ऋ, correct

    // Exercise 6 is akshara-build with target कि. Build की instead: right
    // consonant, wrong matra — a near-miss.
    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ी'));
    await fireEvent.press(getByTestId('check'));

    expect(queryByText(/मात्रा/)).toBeTruthy();
    expect(getByTestId('hearts').props.children).toContain('5');
  });

  // The hint from a near-miss must not linger once the learner moves on.
  //
  // submitAnswer() advances session.index for every verdict, near-miss
  // included — it does not replay the missed exercise immediately, it only
  // appends it to the back of the queue for later. So the near-miss on
  // exercise 6 (कि) has already moved play to exercise 7 (की) by the time its
  // hint is shown. Answering exercise 7 the same way it was just built — की —
  // is not another near-miss, it is exercise 7's actual, correct target: the
  // one real-play scenario that both shows the hint and then genuinely
  // clears it, rather than replacing one near-miss hint with another.
  it('clears the hint when a new exercise starts', async () => {
    const { getByTestId, queryByText } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);

    for (const t of ['अ', 'आ', 'इ', 'ऊ', 'ऋ']) await playSelect(getByTestId, t);

    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ी')); // near-miss: की built against exercise 6's target कि
    await fireEvent.press(getByTestId('check'));
    expect(queryByText(/मात्रा/)).toBeTruthy();

    // Now on exercise 7, target की. Building की again is correct here.
    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ी'));
    await fireEvent.press(getByTestId('check'));
    expect(queryByText(/मात्रा/)).toBeNull();
  });

  it('completes the lesson and shows XP after the last exercise', async () => {
    const { getByTestId, getByText } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);

    await playSelect(getByTestId, 'अ');
    await playSelect(getByTestId, 'आ');
    await playSelect(getByTestId, 'इ');
    await playSelect(getByTestId, 'ऊ');
    await playSelect(getByTestId, 'ऋ');

    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ि'));
    await fireEvent.press(getByTestId('check'));

    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ी'));
    await fireEvent.press(getByTestId('check'));

    await fireEvent.press(getByTestId('key-क'));
    await fireEvent.press(getByTestId('key-ु'));
    await fireEvent.press(getByTestId('check'));

    // A single template-literal expression (`XP ${session.xp}`) is one JSX
    // child, not several interpolated siblings, so RN Testing Library hands
    // back a plain string here rather than an array — verified by running
    // this test: `.join('')` throws "children.join is not a function".
    expect(getByTestId('xp').props.children).toContain('15');
    expect(getByText('साधु!')).toBeTruthy();
  });

  it('shows an out-of-hearts screen and does not start a session when hearts are exhausted', async () => {
    await saveProgress({ hearts: { count: 0, updatedAt: Date.now() }, activityDays: [] });
    const { getByTestId, queryByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    expect(getByTestId('hearts-wait')).toBeTruthy();
    expect(queryByTestId('check')).toBeNull();
  });

  it('persists hearts to storage after a wrong answer', async () => {
    const { getByTestId } = await render(<LessonScreen lessonId="les.ch01.u1.l1" />);
    await playSelect(getByTestId, 'आ'); // wrong; target is अ
    expect(getByTestId('hearts').props.children).toContain('4');
    const stored = await loadProgress();
    expect(stored.hearts.count).toBe(4);
  });
});
