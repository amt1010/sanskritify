import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ContentPack } from '@sanskritify/content';
import { extractChapter, REPO_ROOT } from './extract';

const [command, ...rest] = process.argv.slice(2);

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// The canonical content path — note the src/, not packages/content/data. Each
// chapter directory holds concepts.json / lexemes.json / sentences.json
// (arrays) and one lesson-NN.json (a single lesson object) per lesson, the
// layout Task 13 lays down. Every file is schema-validated as it is read, so
// a malformed chapter fails loudly here rather than being trusted into
// lintContent or buildPack.
async function loadContentPack(dataDir: string): Promise<ContentPack> {
  const { readFile, readdir } = await import('node:fs/promises');
  const { LexemeSchema, SentenceSchema, ConceptSchema, LessonSchema } = await import('@sanskritify/content');

  const lexemes: ContentPack['lexemes'] = [];
  const sentences: ContentPack['sentences'] = [];
  const concepts: ContentPack['concepts'] = [];
  const lessons: ContentPack['lessons'] = [];

  const entries = await readdir(dataDir, { recursive: true });
  const jsonFiles = entries.filter((e) => e.endsWith('.json')).sort();

  for (const rel of jsonFiles) {
    const file = path.join(dataDir, rel);
    const data: unknown = JSON.parse(await readFile(file, 'utf8'));
    const name = path.basename(rel);

    if (name === 'lexemes.json') {
      for (const raw of data as unknown[]) lexemes.push(LexemeSchema.parse(raw));
    } else if (name === 'sentences.json') {
      for (const raw of data as unknown[]) sentences.push(SentenceSchema.parse(raw));
    } else if (name === 'concepts.json') {
      for (const raw of data as unknown[]) concepts.push(ConceptSchema.parse(raw));
    } else if (name.startsWith('lesson-')) {
      lessons.push(LessonSchema.parse(data));
    } else {
      throw new Error(`unrecognised content file: ${file}`);
    }
  }

  return {
    // Provisional: no manifest file exists yet to carry these, and Task 13
    // does not add one. Revisit once a chapter needs to version separately
    // from the rest of the course.
    version: '1.0.0',
    courseId: 'sanskrit-class-6',
    lexemes, sentences, concepts, lessons,
  };
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
    case 'lint:content': {
      // REPO_ROOT, not a bare relative path — same cwd trap as extract and
      // lint:raw above.
      const dataDir = path.join(REPO_ROOT, 'packages', 'content', 'src', 'data');
      // Task 13 creates this directory. Until then there is no content to
      // lint, and CI has to stay green rather than crash on a missing dir.
      if (!existsSync(dataDir)) {
        console.log(`lint:content: no content at ${dataDir} yet, nothing to lint`);
        break;
      }
      const { lintContent } = await import('./lint-content');
      const findings = lintContent(await loadContentPack(dataDir));
      for (const f of findings) {
        console.log(`${f.rule}  ${f.id}  ${f.detail}`);
      }
      console.log(`\n${findings.length} findings`);
      if (findings.length > 0) process.exit(1);
      break;
    }
    case 'build': {
      const dataDir = path.join(REPO_ROOT, 'packages', 'content', 'src', 'data');
      const pack = await loadContentPack(dataDir);
      const { buildPack } = await import('./build');
      const { json, hash } = buildPack(pack);
      // REPO_ROOT again — build writes files, so a cwd-relative path here
      // would silently land the pack under tools/content-cli/ and report
      // success rather than failing the way extract does.
      const outDir = path.join(REPO_ROOT, 'packages', 'content', 'dist');
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `pack-${hash}.json`);
      await writeFile(outPath, json, 'utf8');
      console.log(`built ${outPath}`);
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
