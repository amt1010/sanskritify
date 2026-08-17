import lessonJson from './lesson-01.json';
import lexemesJson from './lexemes.json';
import conceptsJson from './concepts.json';

// Exported as unknown deliberately. Callers must run these through the Zod
// schemas, so a malformed hand edit fails loudly at the boundary instead of
// being trusted because TypeScript inferred a shape from the JSON file.
export const ch01Lesson: unknown = lessonJson;
export const ch01Lexemes: unknown[] = lexemesJson;
export const ch01Concepts: unknown[] = conceptsJson;
