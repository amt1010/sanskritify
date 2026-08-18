export const HEART_REGEN_MS = 1_800_000; // 30 minutes

function validateHeartInputs(stored: number, updatedAt: number, now: number, max: number): void {
  // NaN would pass straight through every comparison below and surface as a
  // heart count that is neither above nor below anything. Refuse it here.
  if (!Number.isFinite(stored)) throw new Error(`stored must be a finite number, got ${stored}`);
  if (!Number.isFinite(updatedAt)) throw new Error(`updatedAt must be a finite number, got ${updatedAt}`);
  if (!Number.isFinite(now)) throw new Error(`now must be a finite number, got ${now}`);
  if (!Number.isInteger(max) || max < 0) throw new Error(`max must be a non-negative integer, got ${max}`);
}

// A backwards clock yields negative elapsed time. Children do change the
// device clock; treating it as zero is enough while there is no shop.
function elapsedSince(updatedAt: number, now: number): number {
  return Math.max(0, now - updatedAt);
}

export function currentHearts(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  validateHeartInputs(stored, updatedAt, now, max);
  const regenerated = Math.floor(elapsedSince(updatedAt, now) / HEART_REGEN_MS);

  // Clamped at both ends. A corrupt negative stored value must not reach the
  // UI, and createSession throws below one heart.
  return Math.min(max, Math.max(0, stored + regenerated));
}

// Time remaining until the next heart lands, for an "out of hearts" screen.
// Zero once regen has already reached the maximum — nothing left to wait for.
export function msUntilNextHeart(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  validateHeartInputs(stored, updatedAt, now, max);
  if (currentHearts(stored, updatedAt, now, max) >= max) return 0;
  const elapsed = elapsedSince(updatedAt, now);
  return HEART_REGEN_MS - (elapsed % HEART_REGEN_MS);
}
