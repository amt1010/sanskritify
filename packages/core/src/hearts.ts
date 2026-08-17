export const HEART_REGEN_MS = 1_800_000; // 30 minutes

export function currentHearts(
  stored: number,
  updatedAt: number,
  now: number,
  max: number,
): number {
  // NaN would pass straight through every comparison below and surface as a
  // heart count that is neither above nor below anything. Refuse it here.
  if (!Number.isFinite(stored)) throw new Error(`stored must be a finite number, got ${stored}`);
  if (!Number.isFinite(updatedAt)) throw new Error(`updatedAt must be a finite number, got ${updatedAt}`);
  if (!Number.isFinite(now)) throw new Error(`now must be a finite number, got ${now}`);
  if (!Number.isInteger(max) || max < 0) throw new Error(`max must be a non-negative integer, got ${max}`);

  // A backwards clock yields negative elapsed time. Children do change the
  // device clock; treating it as zero is enough while there is no shop.
  const elapsed = Math.max(0, now - updatedAt);
  const regenerated = Math.floor(elapsed / HEART_REGEN_MS);

  // Clamped at both ends. A corrupt negative stored value must not reach the
  // UI, and Task 8's createSession throws below one heart.
  return Math.min(max, Math.max(0, stored + regenerated));
}
