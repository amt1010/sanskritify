import { extractChapter } from './extract';

const [command, ...rest] = process.argv.slice(2);

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

async function main(): Promise<void> {
  switch (command) {
    case 'extract': {
      const root = process.cwd();
      const chapters = rest.length > 0 ? rest.map(Number) : range(1, 16);
      for (const ch of chapters) {
        const r = await extractChapter(ch, root, 'packages/content/raw');
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
