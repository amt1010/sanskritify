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
    default:
      console.error('usage: content-cli extract [chapter...]');
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
