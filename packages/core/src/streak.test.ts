import { describe, it, expect } from 'vitest';
import { streakLength, recordActivityDay } from './streak';

const DAY_MS = 86_400_000;

describe('streakLength', () => {
  it('is zero with no activity', () => {
    expect(streakLength([], '2026-08-16')).toBe(0);
  });

  it('counts a run ending today', () => {
    expect(streakLength(['2026-08-14', '2026-08-15', '2026-08-16'], '2026-08-16')).toBe(3);
  });

  it('counts a run ending yesterday, since today is not over', () => {
    expect(streakLength(['2026-08-14', '2026-08-15'], '2026-08-16')).toBe(2);
  });

  it('is zero when the last activity was two days ago', () => {
    expect(streakLength(['2026-08-13', '2026-08-14'], '2026-08-16')).toBe(0);
  });

  it('ignores duplicates, which is why the set merges across devices', () => {
    expect(streakLength(['2026-08-16', '2026-08-16', '2026-08-15'], '2026-08-16')).toBe(2);
  });

  it('ignores order', () => {
    expect(streakLength(['2026-08-15', '2026-08-16', '2026-08-14'], '2026-08-16')).toBe(3);
  });

  it('counts only the run, not older activity behind a gap', () => {
    expect(streakLength(['2026-08-10', '2026-08-15', '2026-08-16'], '2026-08-16')).toBe(2);
  });

  it.each([
    ['a month boundary', ['2026-07-31', '2026-08-01'], '2026-08-01', 2],
    ['a year boundary', ['2026-12-31', '2027-01-01'], '2027-01-01', 2],
    ['a leap day', ['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01', 3],
    ['a non-leap February', ['2027-02-28', '2027-03-01'], '2027-03-01', 2],
  ])('crosses %s', (_label, days, today, expected) => {
    expect(streakLength(days, today)).toBe(expected);
  });

  // A second device in another timezone can legitimately record tomorrow.
  // The walk runs backwards from today, so a future day must not inflate
  // the streak or start one.
  it('ignores days in the future', () => {
    expect(streakLength(['2026-08-17', '2026-08-16'], '2026-08-16')).toBe(1);
    expect(streakLength(['2026-08-17'], '2026-08-16')).toBe(0);
  });

  it('handles a long unbroken run', () => {
    const days = Array.from({ length: 400 }, (_, i) =>
      new Date(Date.UTC(2026, 7, 16) - i * DAY_MS).toISOString().slice(0, 10),
    );
    expect(streakLength(days, '2026-08-16')).toBe(400);
  });

  // Date.UTC rolls 2026-08-32 forward to 2026-09-01 rather than failing, so a
  // corrupt day silently becomes a different valid-looking day and inflates
  // the streak. These strings come out of storage and sync, so this is a
  // boundary and it throws.
  it.each([
    ['a non-date string', ['not-a-date']],
    ['a day past the end of the month', ['2026-08-32']],
    ['a month above twelve', ['2026-13-01']],
    ['the 30th of February', ['2026-02-30']],
    ['the 29th of a non-leap February', ['2027-02-29']],
    ['an empty string', ['']],
    ['a year Date.UTC remaps', ['0000-01-01']],
    ['a two-digit year', ['26-08-16']],
  ])('throws for %s', (_label, days) => {
    expect(() => streakLength(days, '2026-09-01')).toThrow();
  });

  it('throws for a malformed today', () => {
    expect(() => streakLength(['2026-08-16'], 'nonsense')).toThrow();
  });

  it('names the offending value in the error', () => {
    expect(() => streakLength(['2026-08-32'], '2026-09-01')).toThrow(/2026-08-32/);
  });
});

describe('recordActivityDay', () => {
  it('appends a new day', () => {
    expect(recordActivityDay(['2026-08-15'], '2026-08-16')).toEqual(['2026-08-15', '2026-08-16']);
  });

  it('starts a list from empty', () => {
    expect(recordActivityDay([], '2026-08-16')).toEqual(['2026-08-16']);
  });

  // The caller uses reference equality to decide whether to persist —
  // recording a day already present must be a no-op, not a same-value copy.
  it('returns the same array reference when the day is already recorded', () => {
    const days = ['2026-08-15', '2026-08-16'];
    expect(recordActivityDay(days, '2026-08-16')).toBe(days);
  });

  it('throws for a malformed day', () => {
    expect(() => recordActivityDay([], 'nonsense')).toThrow();
  });

  it('names the offending value in the error', () => {
    expect(() => recordActivityDay([], '2026-08-32')).toThrow(/2026-08-32/);
  });
});
