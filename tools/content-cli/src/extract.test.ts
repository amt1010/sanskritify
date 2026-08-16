import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chapterPdfPath, extractChapter } from './extract';

// The repo root, from tools/content-cli/src/.
const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('chapterPdfPath', () => {
  it('maps chapter 1 to fsde101.pdf', () => {
    expect(chapterPdfPath(1, '/repo')).toBe('/repo/Class6/fsde101.pdf');
  });

  it('maps chapter 16 to fsde116.pdf', () => {
    expect(chapterPdfPath(16, '/repo')).toBe('/repo/Class6/fsde116.pdf');
  });

  it('rejects chapter 0, which is front matter and not a chapter', () => {
    expect(() => chapterPdfPath(0, '/repo')).toThrow(/1 and 16/);
  });

  it('rejects chapter 17', () => {
    expect(() => chapterPdfPath(17, '/repo')).toThrow(/1 and 16/);
  });

  it.each([[1.5], [NaN], [-1]])('rejects %p', (chapter) => {
    expect(() => chapterPdfPath(chapter, '/repo')).toThrow();
  });
});

describe('extractChapter', () => {
  // This is the regression guard for -enc UTF-8. Without the flag pdftotext
  // emits Latin-1 and every Devanagari code point is dropped: measured 6,621
  // with the flag on chapter 1, and 0 without. A missing flag would otherwise
  // land 16 silently empty files in the repo.
  it('extracts Devanagari from chapter 1', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'sanskritify-extract-'));
    try {
      const result = await extractChapter(1, REPO_ROOT, outDir);
      const text = await readFile(result.outPath, 'utf8');
      const devanagari = [...text].filter((ch) => {
        const n = ch.codePointAt(0)!;
        return n >= 0x0900 && n <= 0x097f;
      }).length;

      expect(devanagari).toBeGreaterThan(1000);
      expect(result.chapter).toBe(1);
      expect(result.chars).toBe(text.length);
      expect(result.outPath).toContain('ch01.txt');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('gives a usable error when the chapter does not exist', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'sanskritify-extract-'));
    try {
      await expect(extractChapter(1, path.join(outDir, 'nope'), outDir)).rejects.toThrow();
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 30_000);
});
