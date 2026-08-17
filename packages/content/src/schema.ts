import { z } from 'zod';

export const LOCALES = ['hi', 'en'] as const;
export type LocaleCode = (typeof LOCALES)[number];

// Every user-facing content string carries both shipped locales. A future
// locale is added by extending LOCALES; strict() then rejects any record that
// carries an unknown one, so the gap surfaces at validation rather than as a
// blank label in the app.
export const TranslationsSchema = z
  .object({ hi: z.string().min(1), en: z.string().min(1) })
  .strict();

// Provenance. The engine never reads this. It exists so swapping textbook
// content for original content later is a data migration, not a schema change.
export const SourceSchema = z.union([
  z.literal('original'),
  z.string().regex(/^ncert-deepakam-ch(0[1-9]|1[0-6])$/),
]);

// strict() everywhere: a mistyped optional key used to parse clean and be
// dropped, so a typo'd audioRef silently shipped a lesson with no audio.
export const LexemeSchema = z
  .object({
    id: z.string().startsWith('lex.'),
    devanagari: z.string().min(1),
    gender: z.enum(['pum', 'stri', 'napum']).optional(),
    declension: z.string().optional(),
    translations: TranslationsSchema,
    audioRef: z.string().optional(),
    source: SourceSchema,
  })
  .strict();
export type Lexeme = z.infer<typeof LexemeSchema>;

export const SentenceSchema = z
  .object({
    id: z.string().startsWith('sen.'),
    canonical: z.string().min(1),
    acceptedForms: z.array(z.string().min(1)).min(1),
    translations: TranslationsSchema,
    audioRef: z.string().optional(),
    lexemeIds: z.array(z.string().startsWith('lex.')),
    source: SourceSchema,
  })
  .strict()
  // Sanskrit word order is free, so acceptedForms is hand-authored rather than
  // generated. If it omits the canonical form, the app marks its own answer
  // wrong and the content author never finds out.
  .refine((s) => s.acceptedForms.includes(s.canonical), {
    message: 'acceptedForms must include canonical',
    path: ['acceptedForms'],
  });
export type Sentence = z.infer<typeof SentenceSchema>;

export const ConceptSchema = z
  .object({
    id: z.string().startsWith('con.'),
    titleTranslations: TranslationsSchema,
    bodyTranslations: TranslationsSchema,
    source: SourceSchema,
  })
  .strict();
export type Concept = z.infer<typeof ConceptSchema>;

const Base = { id: z.string().startsWith('ex.'), source: SourceSchema };

// Every member is a plain ZodObject so they can all join one discriminatedUnion.
// The akshara-select rules live in the superRefine below rather than in a
// .refine here: a .refine would make this a ZodEffects, which a
// discriminatedUnion will not accept, and the workaround was a second exported
// schema that silently rejected every akshara-select.
const AksharaSelect = z
  .object({
    ...Base,
    type: z.literal('akshara-select'),
    target: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    // The learner is asked a question, never shown the answer. Without audio in
    // v1 the prompt is the only thing that makes this exercise solvable, so it
    // is required rather than optional.
    promptTranslations: TranslationsSchema,
    conceptId: z.string().startsWith('con.').optional(),
    audioRef: z.string().optional(),
  })
  .strict();

const AksharaBuild = z
  .object({
    ...Base,
    type: z.literal('akshara-build'),
    target: z.string().min(1),
    conceptId: z.string().startsWith('con.').optional(),
    audioRef: z.string().optional(),
  })
  .strict();

const MatchPairs = z
  .object({
    ...Base,
    type: z.literal('match-pairs'),
    lexemeIds: z.array(z.string().startsWith('lex.')).min(3).max(6),
  })
  .strict();

// Defined for schema completeness. Renderers arrive with chapter 3+.
const SelectImage = z.object({
  ...Base, type: z.literal('select-image'),
  lexemeId: z.string(), optionLexemeIds: z.array(z.string()).min(2),
}).strict();
const TranslateToLocale = z.object({
  ...Base, type: z.literal('translate-to-locale'), sentenceId: z.string(),
}).strict();
const TranslateToSanskrit = z.object({
  ...Base, type: z.literal('translate-to-sanskrit'), sentenceId: z.string(),
}).strict();
const FillBlank = z.object({
  ...Base, type: z.literal('fill-blank'), sentenceId: z.string(),
  blankIndex: z.number().int().nonnegative(), options: z.array(z.string()).min(2),
}).strict();
const ListenSelect = z.object({
  ...Base, type: z.literal('listen-select'), audioRef: z.string(),
  target: z.string(), options: z.array(z.string()).min(2),
}).strict();
const ListenBuild = z.object({
  ...Base, type: z.literal('listen-build'), audioRef: z.string(), sentenceId: z.string(),
}).strict();
const OrderSentence = z.object({
  ...Base, type: z.literal('order-sentence'), sentenceId: z.string(),
}).strict();
// Speaking is deferred to a later version. The type exists so content can be
// authored now; enabled is pinned false so none of it can ship by accident.
const Speak = z.object({
  ...Base, type: z.literal('speak'), sentenceId: z.string(), enabled: z.literal(false),
}).strict();

export const ExerciseSchema = z
  .discriminatedUnion('type', [
    AksharaSelect, AksharaBuild, MatchPairs, SelectImage, TranslateToLocale,
    TranslateToSanskrit, FillBlank, ListenSelect, ListenBuild, OrderSentence, Speak,
  ])
  .superRefine((exercise, ctx) => {
    if (exercise.type !== 'akshara-select') return;
    if (!exercise.options.includes(exercise.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'options must include target',
      });
    }
    // Two identical tiles is a broken exercise, and Task 16 keys option tiles
    // by their own text, so duplicates also collide into one test selector.
    if (new Set(exercise.options).size !== exercise.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'options must be unique',
      });
    }
  });
export type Exercise = z.infer<typeof ExerciseSchema>;

export const LessonSchema = z
  .object({
    id: z.string().startsWith('les.'),
    unitId: z.string().startsWith('unit.'),
    titleTranslations: TranslationsSchema,
    exercises: z.array(ExerciseSchema).min(6),
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

export const ContentPackSchema = z
  .object({
    version: z.string(),
    courseId: z.string(),
    lexemes: z.array(LexemeSchema),
    sentences: z.array(SentenceSchema),
    concepts: z.array(ConceptSchema),
    lessons: z.array(LessonSchema),
  })
  .strict();
export type ContentPack = z.infer<typeof ContentPackSchema>;
