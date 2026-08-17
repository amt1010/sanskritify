import { createHash } from 'node:crypto';
import { ContentPackSchema, type ContentPack } from '@sanskritify/content';

// The hash identifies a pack for OTA updates, so it has to depend only on
// content. Zod's parse output follows schema key order rather than the input's
// insertion order, which makes the JSON stable across differently-formatted
// sources — checked, including that an absent optional key hashes the same as
// an explicit undefined.
export function buildPack(pack: ContentPack): { json: string; hash: string } {
  const validated = ContentPackSchema.parse(pack);
  const json = JSON.stringify(validated);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  return { json, hash };
}
