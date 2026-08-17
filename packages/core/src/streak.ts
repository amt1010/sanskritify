const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

// Days are compared as whole UTC days rather than local time. The strings are
// already local calendar dates, so anchoring them to UTC keeps the arithmetic
// free of daylight-saving shifts.
function toUtcDay(iso: string): number {
  if (!ISO_DAY.test(iso)) {
    throw new Error(`day must be YYYY-MM-DD, got ${JSON.stringify(iso)}`);
  }

  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const ms = Date.UTC(year, month - 1, day);

  // Date.UTC does not reject impossible dates: 2026-08-32 comes back as
  // 1 September, and years below 100 are remapped into the 1900s. Either would
  // turn a corrupt day into a different valid-looking one and inflate a
  // streak, so round-trip the value and reject any drift.
  const back = new Date(ms);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    throw new Error(`not a real calendar date: ${iso}`);
  }

  return ms / DAY_MS;
}

// Derived from the set of activity days, never stored. A set unions across
// devices without conflict; a counter does not.
export function streakLength(activityDays: string[], today: string): number {
  const todayNum = toUtcDay(today);
  const days = new Set(activityDays.map(toUtcDay));
  if (days.size === 0) return 0;

  // Today may still be in progress, so a run ending yesterday still counts.
  // Starting the walk at today also means a day in the future — which a second
  // device in another timezone can legitimately write — is skipped rather than
  // counted.
  let cursor = days.has(todayNum) ? todayNum : todayNum - 1;
  if (!days.has(cursor)) return 0;

  let length = 0;
  while (days.has(cursor)) {
    length += 1;
    cursor -= 1;
  }
  return length;
}
