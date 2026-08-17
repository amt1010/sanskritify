import { describe, it, expect } from 'vitest';
import type { ContentPack } from '@sanskritify/content';
import { buildPack } from './build';

const base = {
  version: '1.0.0', courseId: 'sanskrit-class-6',
  lexemes: [{
    id: 'lex.a', devanagari: 'जलम्',
    translations: { hi: 'पानी', en: 'water' }, source: 'original',
  }],
  sentences: [], concepts: [], lessons: [],
} as ContentPack;

describe('buildPack', () => {
  it('produces a hash', () => {
    const { hash, json } = buildPack(base);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.parse(json).courseId).toBe('sanskrit-class-6');
  });

  // Two authors writing the same content in different key orders must produce
  // the same pack, or every reformat looks like a new release to the OTA
  // update check.
  it('hashes the same regardless of key order', () => {
    const reordered = {
      courseId: base.courseId, version: base.version,
      sentences: [], concepts: [], lessons: [],
      lexemes: [{
        source: 'original', translations: { en: 'water', hi: 'पानी' },
        devanagari: 'जलम्', id: 'lex.a',
      }],
    } as ContentPack;
    expect(buildPack(reordered).hash).toBe(buildPack(base).hash);
  });

  it('hashes an absent optional key the same as an explicit undefined', () => {
    const explicit = {
      ...base,
      lexemes: [{ ...base.lexemes[0]!, audioRef: undefined }],
    } as ContentPack;
    expect(buildPack(explicit).hash).toBe(buildPack(base).hash);
  });

  it('is deterministic across repeated builds', () => {
    expect(buildPack(base).hash).toBe(buildPack(base).hash);
  });

  it('produces a different hash for different content', () => {
    const changed = { ...base, version: '1.0.1' } as ContentPack;
    expect(buildPack(changed).hash).not.toBe(buildPack(base).hash);
  });

  it('rejects a pack that does not satisfy the schema', () => {
    expect(() => buildPack({ ...base, lexemes: [{ id: 'nope' }] } as unknown as ContentPack)).toThrow();
  });
});
