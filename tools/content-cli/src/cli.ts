import path from 'node:path';
import { extractChapter, REPO_ROOT } from './extract';

const [command, ...rest] = process.argv.slice(2);

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

async function main(): Promise<void> {
  switch (command) {
    case 'extract': {
      // REPO_ROOT, not process.cwd() — see the comment on REPO_ROOT in
      // extract.ts. Same reasoning applies to the output directory: it must
      // not be a bare relative string either, or it lands in the wrong place
      // whenever this runs via `pnpm --filter ... run cli`.
      const outDir = path.join(REPO_ROOT, 'packages', 'content', 'raw');
      const chapters = rest.length > 0 ? rest.map(Number) : range(1, 16);
      for (const ch of chapters) {
        const r = await extractChapter(ch, REPO_ROOT, outDir);
        console.log(`ch${ch}: ${r.chars} chars -> ${r.outPath}`);
      }
      break;
    }
    case 'lint:raw': {
      const { readFile } = await import('node:fs/promises');
      const { lintRaw } = await import('./lint-raw');
      let total = 0;
      for (const ch of rest.length > 0 ? rest.map(Number) : range(1, 16)) {
        // REPO_ROOT, not a bare relative path — see the comment on it in
        // extract.ts. The same cwd trap applies here: pnpm runs this script
        // from tools/content-cli, so a bare 'packages/content/raw/...' path
        // would read the wrong directory.
        const file = path.join(
          REPO_ROOT, 'packages', 'content', 'raw',
          `ch${String(ch).padStart(2, '0')}.txt`,
        );
        const findings = lintRaw(await readFile(file, 'utf8'));
        total += findings.length;
        for (const f of findings) {
          console.log(`${file}:${f.line}:${f.column}  ${f.rule}  ${f.excerpt.trim()}`);
        }
      }
      console.log(`\n${total} findings`);
      break;
    }
    default:
      console.error('usage: content-cli extract [chapter...]');
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
