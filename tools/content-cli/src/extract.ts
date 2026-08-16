import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);

// The repo root, resolved from this file's own location rather than
// process.cwd(). pnpm and turbo both run package scripts with cwd set to the
// package directory (tools/content-cli), so a cwd-based root would read
// Class6/ from the wrong place. extract fails loudly when that happens, but
// later commands (build) write files, where a wrong root would not fail
// loudly — it would silently write output under tools/content-cli/ instead.
// This file lives at tools/content-cli/src/extract.ts, so the root is three
// levels up, true no matter where the process was launched from.
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export interface ExtractResult {
  chapter: number;
  source: string;
  outPath: string;
  chars: number;
}

export function chapterPdfPath(chapter: number, root: string): string {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 16) {
    throw new Error(`chapter must be between 1 and 16, got ${chapter}`);
  }
  // fsde100.pdf is front matter, so chapter N is fsde1NN.pdf with N from 01.
  const name = `fsde1${String(chapter).padStart(2, '0')}.pdf`;
  // posix.join so the result is byte-identical on every platform and the test
  // can assert one exact string. On Windows this yields a mixed-separator path
  // like C:\repo/Class6/fsde101.pdf, which pdftotext accepts — checked.
  return path.posix.join(root, 'Class6', name);
}

export async function extractChapter(
  chapter: number,
  root: string,
  outDir: string,
): Promise<ExtractResult> {
  const source = chapterPdfPath(chapter, root);
  const outPath = path.join(outDir, `ch${String(chapter).padStart(2, '0')}.txt`);
  await mkdir(outDir, { recursive: true });

  try {
    // -enc UTF-8 is load-bearing. Without it pdftotext emits Latin-1 and every
    // Devanagari code point is dropped, not reordered: chapter 1 goes from
    // 6,621 Devanagari code points to zero.
    await run('pdftotext', ['-enc', 'UTF-8', source, outPath]);
  } catch (err: unknown) {
    if (err !== null && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT') {
      throw new Error(
        'pdftotext is not installed. Install poppler-utils; on Windows it ships ' +
          'with Git for Windows at /mingw64/bin/pdftotext.',
      );
    }
    throw err;
  }

  const text = await readFile(outPath, 'utf8');
  return { chapter, source, outPath, chars: text.length };
}
