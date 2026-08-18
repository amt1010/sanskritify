import { describe, it, expect } from 'vitest';
import { currentHearts, msUntilNextHeart, HEART_REGEN_MS } from './hearts';

const T0 = 1_700_000_000_000;

describe('currentHearts', () => {
  it('returns the stored value before any regen elapses', () => {
    expect(currentHearts(3, T0, T0 + 1000, 5)).toBe(3);
  });

  it('adds one heart per regen interval', () => {
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS, 5)).toBe(4);
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS * 2, 5)).toBe(5);
  });

  it('does not add a heart one millisecond early', () => {
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS - 1, 5)).toBe(3);
  });

  it('clamps to the maximum', () => {
    expect(currentHearts(3, T0, T0 + HEART_REGEN_MS * 99, 5)).toBe(5);
  });

  it('does not regenerate past the maximum from a full state', () => {
    expect(currentHearts(5, T0, T0 + HEART_REGEN_MS * 4, 5)).toBe(5);
  });

  it('treats a backwards clock as no elapsed time', () => {
    // Children do change the device clock.
    expect(currentHearts(2, T0, T0 - HEART_REGEN_MS * 10, 5)).toBe(2);
  });

  // A corrupt stored value must not surface as a negative heart count.
  // Task 8's createSession throws for hearts < 1, so a negative here becomes
  // a crash a long way from its cause.
  it('never returns fewer than zero hearts', () => {
    expect(currentHearts(-3, T0, T0, 5)).toBe(0);
    expect(currentHearts(-3, T0, T0 + HEART_REGEN_MS * 2, 5)).toBe(0);
  });

  it('clamps a stored value above the maximum', () => {
    expect(currentHearts(9, T0, T0, 5)).toBe(5);
  });

  // NaN is the worst failure shape available: every comparison against it is
  // false, so nothing errors and everything is quietly wrong.
  it.each([
    ['stored', () => currentHearts(NaN, T0, T0, 5)],
    ['updatedAt', () => currentHearts(3, NaN, T0, 5)],
    ['now', () => currentHearts(3, T0, NaN, 5)],
    ['infinite now', () => currentHearts(3, T0, Infinity, 5)],
  ])('throws for a non-finite %s', (_label, call) => {
    expect(call).toThrow();
  });

  it.each([[-1], [2.5], [NaN]])('throws for max = %p', (max) => {
    expect(() => currentHearts(3, T0, T0, max)).toThrow();
  });

  it('names the offending value in the error', () => {
    expect(() => currentHearts(3, T0, NaN, 5)).toThrow(/got NaN/);
  });
});

describe('msUntilNextHeart', () => {
  it('is zero once at the maximum', () => {
    expect(msUntilNextHeart(5, T0, T0, 5)).toBe(0);
  });

  it('is zero when stored is already above the maximum', () => {
    expect(msUntilNextHeart(9, T0, T0, 5)).toBe(0);
  });

  it('is a full interval right after the last update', () => {
    expect(msUntilNextHeart(3, T0, T0, 5)).toBe(HEART_REGEN_MS);
  });

  it('counts down within the current interval', () => {
    expect(msUntilNextHeart(3, T0, T0 + 100, 5)).toBe(HEART_REGEN_MS - 100);
  });

  it('is zero the instant regen catches up to the maximum', () => {
    // stored=3, max=5: two intervals of elapsed time regenerate exactly to 5.
    expect(msUntilNextHeart(3, T0, T0 + HEART_REGEN_MS * 2, 5)).toBe(0);
  });

  it('resets to a full interval just after a heart regenerates', () => {
    expect(msUntilNextHeart(3, T0, T0 + HEART_REGEN_MS + 1, 5)).toBe(HEART_REGEN_MS - 1);
  });

  it('treats a backwards clock as no elapsed time', () => {
    expect(msUntilNextHeart(2, T0, T0 - HEART_REGEN_MS * 10, 5)).toBe(HEART_REGEN_MS);
  });

  it.each([
    ['stored', () => msUntilNextHeart(NaN, T0, T0, 5)],
    ['updatedAt', () => msUntilNextHeart(3, NaN, T0, 5)],
    ['now', () => msUntilNextHeart(3, T0, NaN, 5)],
  ])('throws for a non-finite %s', (_label, call) => {
    expect(call).toThrow();
  });

  it.each([[-1], [2.5], [NaN]])('throws for max = %p', (max) => {
    expect(() => msUntilNextHeart(3, T0, T0, max)).toThrow();
  });
});
