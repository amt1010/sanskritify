import { render, fireEvent } from '@testing-library/react-native';
import type { Akshara } from '@sanskritify/sanskrit';
import { AksharaComposer } from './AksharaComposer';

// @testing-library/react-native v14 made `render` and `fireEvent.*` async
// (they now await React's `act()` internally), so every test here awaits
// them. The brief's test bodies are otherwise unchanged from what it wrote.
const empty: Akshara = { parts: [], matra: null, sign: null };
const ka: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: null, sign: null };

describe('AksharaComposer', () => {
  it('appends a consonant when its key is pressed', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<AksharaComposer value={empty} onChange={onChange} />);
    await fireEvent.press(getByTestId('key-क'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: false }], matra: null, sign: null,
    });
  });

  it('marks the last part halant when the virama key is pressed', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<AksharaComposer value={ka} onChange={onChange} />);
    await fireEvent.press(getByTestId('key-virama'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: true }], matra: null, sign: null,
    });
  });

  it('sets the matra when a matra key is pressed', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<AksharaComposer value={ka} onChange={onChange} />);
    await fireEvent.press(getByTestId('key-ि'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: false }], matra: 'ि', sign: null,
    });
  });

  // Anusvara and visarga are signs, not matras. Writing them into the matra
  // slot makes कां unrepresentable, because composeAkshara emits parts, then
  // matra, then sign — there would be nowhere left for the ा.
  it('sets the sign when a sign key is pressed', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<AksharaComposer value={ka} onChange={onChange} />);
    await fireEvent.press(getByTestId('key-ं'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: false }], matra: null, sign: 'ं',
    });
  });

  it('keeps a matra and a sign at the same time', async () => {
    const onChange = jest.fn();
    const withMatra: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: 'ा', sign: null };
    const { getByTestId } = await render(<AksharaComposer value={withMatra} onChange={onChange} />);
    await fireEvent.press(getByTestId('key-ं'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: false }], matra: 'ा', sign: 'ं',
    });
  });

  it('shows the composed preview', async () => {
    const ksha: Akshara = {
      parts: [{ consonant: 'क', halant: true }, { consonant: 'ष', halant: false }],
      matra: null, sign: null,
    };
    const { getByTestId } = await render(<AksharaComposer value={ksha} onChange={jest.fn()} />);
    expect(getByTestId('preview').props.children).toBe('क्ष');
  });

  // कां is the case the sign slot exists for. If this renders as कंा the
  // slots are being filled in the wrong order.
  it('previews a matra and sign in the right order', async () => {
    const kaam: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: 'ा', sign: 'ं' };
    const { getByTestId } = await render(<AksharaComposer value={kaam} onChange={jest.fn()} />);
    expect(getByTestId('preview').props.children).toBe('कां');
  });

  it('backspace removes the sign first, then the matra, then a consonant', async () => {
    const onChange = jest.fn();
    const full: Akshara = { parts: [{ consonant: 'क', halant: false }], matra: 'ा', sign: 'ं' };

    const a = await render(<AksharaComposer value={full} onChange={onChange} />);
    await fireEvent.press(a.getByTestId('backspace'));
    expect(onChange).toHaveBeenLastCalledWith({ ...full, sign: null });

    const b = await render(<AksharaComposer value={{ ...full, sign: null }} onChange={onChange} />);
    await fireEvent.press(b.getByTestId('backspace'));
    expect(onChange).toHaveBeenLastCalledWith({ ...full, matra: null, sign: null });

    const c = await render(<AksharaComposer value={ka} onChange={onChange} />);
    await fireEvent.press(c.getByTestId('backspace'));
    expect(onChange).toHaveBeenLastCalledWith({ parts: [], matra: null, sign: null });
  });

  it('backspace clears a halant before removing its consonant', async () => {
    const onChange = jest.fn();
    const halant: Akshara = { parts: [{ consonant: 'क', halant: true }], matra: null, sign: null };
    const { getByTestId } = await render(<AksharaComposer value={halant} onChange={onChange} />);
    await fireEvent.press(getByTestId('backspace'));
    expect(onChange).toHaveBeenCalledWith({
      parts: [{ consonant: 'क', halant: false }], matra: null, sign: null,
    });
  });

  it.each([['key-ि'], ['key-ं'], ['key-virama']])(
    'ignores %s when no consonant has been chosen',
    async (testID) => {
      const onChange = jest.fn();
      const { getByTestId } = await render(<AksharaComposer value={empty} onChange={onChange} />);
      await fireEvent.press(getByTestId(testID));
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('does nothing on backspace when the akshara is empty', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<AksharaComposer value={empty} onChange={onChange} />);
    await fireEvent.press(getByTestId('backspace'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
