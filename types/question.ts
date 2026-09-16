// types/question.ts
//
// The canonical question schema (v1) — the ONE format every new question is
// written in, across every creation method. Read docs/QUESTIONS.md before
// changing anything here.
//
// Two hard constraints shaped this file:
//
// 1. The bank already holds thousands of LEGACY docs (`questions1`, older
//    `teacher_questions`, and question snapshots frozen inside
//    `custom_tests.questions[]` / `bsb_chsb_tests.questions[]`). They use a flat
//    shape: `options` as an {A,B,C,D} map, `answer` as a letter, `difficulty` as
//    a string. Those docs are NOT migrated — they must keep working forever.
//    Every reader therefore goes through `normalizeQuestion()`
//    (lib/questionSchema.ts), which accepts BOTH shapes.
//
// 2. Firestore cannot filter across two different shapes, and a compatibility
//    OR-query would double the reads. So a v1 doc keeps FLAT MIRRORS of exactly
//    the fields we filter/order on — `creatorId`, `creationMethod`,
//    `difficultyId`, `createdAt` — which are the same fields legacy docs already
//    carry. One query, one index, both shapes. Never filter on the nested
//    `difficulty.name` / `metadata.creatorId`; they are for reading, not querying.

import type { Lang, LocalizedText } from "./Math";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  "mcq",              // single correct answer
  "multiple_select",  // multiple correct answers
  "true_false",
  "open",             // short text answer
  "numeric",
  "fill_blank",
  "matching",
  "ordering",
  "drag_drop",
  "hotspot",          // click on image
  "matrix",
  "essay",
  "coding",
  "proof",
  "graph",
  "equation_builder",
  "interactive",

  // ── Blocks: ONE stem, SEVERAL sub-questions, ONE document ────────────────
  /** Stem + parts a), b), … each with its own answer (the "39. Tenglamalar sistemasi" shape). */
  "multi_part",
  /** Stem + N sub-questions that all pick from ONE shared A–F option pool
   *  (the "33-35 testlar" shape — the pool is printed once beside the block). */
  "shared_options",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** A block: one stem, several sub-questions, stored as a single document. */
export const BLOCK_TYPES: QuestionType[] = ["multi_part", "shared_options"];
export const isBlockType = (t: QuestionType) => BLOCK_TYPES.includes(t);

/** Types answered by typing text rather than picking an option (no option list). */
export const TEXT_ANSWER_TYPES: QuestionType[] = [
  "open", "numeric", "fill_blank", "essay", "coding", "proof", "graph", "equation_builder", "interactive",
];
export const isTextType = (t: QuestionType) => TEXT_ANSWER_TYPES.includes(t);

/** Which types the app can currently RENDER and AUTO-GRADE end to end. */
export const IMPLEMENTED_QUESTION_TYPES: QuestionType[] = [
  "mcq", "multiple_select", "true_false", "open", "numeric", "multi_part", "shared_options",
];

/** `single` = one answer, `multi` = several, `text` = typed/free answer. */
export type AnswerMode = "single" | "multi" | "text";

export const ANSWER_MODE_BY_TYPE: Record<QuestionType, AnswerMode> = {
  mcq: "single", true_false: "single", hotspot: "single",
  multiple_select: "multi", matching: "multi", ordering: "multi", drag_drop: "multi", matrix: "multi",
  open: "text", numeric: "text", fill_blank: "text", essay: "text", coding: "text",
  proof: "text", graph: "text", equation_builder: "text", interactive: "text",
  // A block's answer is one value PER PART, so it is `multi` at the block level.
  multi_part: "multi", shared_options: "multi",
};

export const QUESTION_STATUSES = ["draft", "review", "approved", "published", "archived", "deleted"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const CREATION_METHODS = [
  "ai_prompt", "ai_generated", "imported", "exam_import",
  "teacher_created", "copied", "translated", "corrected",
] as const;
export type CreationMethod = (typeof CREATION_METHODS)[number];

/**
 * Provenance filters, grouped by **who actually wrote the question**.
 *
 * ⚠️ The bank holds questions from every era, so each list must carry BOTH the
 * legacy `creationMethod` strings and the v1 enum above — a filter that knows
 * only the enum silently hides half a teacher's bank. They ride the existing
 * `creationMethod + creatorId + createdAt` composite index, so a
 * `where('creationMethod','in', …)` beside `creatorId ==` needs no new index.
 * Shared by `create/my_questions` and the Rasch builder's own-bank picker.
 */
export const AI_CREATION_METHODS: string[] = ["general_ai", "ai_generated", "ai_prompt", "by_prompt"];
export const IMAGE_CREATION_METHODS: string[] = ["by_image", "imported"];
export const MANUAL_CREATION_METHODS: string[] = ["custom", "teacher_created", "manual", "manual_builder"];

/** Everything a machine wrote — a question read out of an image is AI-written too. */
export const MACHINE_CREATION_METHODS: string[] = [...AI_CREATION_METHODS, ...IMAGE_CREATION_METHODS];

/** ⚠️ False for a document whose method is empty or unrecognized — "not known to
 *  be AI" is not the same as "written by hand", and a legacy doc must not be
 *  mislabelled as the teacher's own work. */
export const isAiWritten = (creationMethod: string) => MACHINE_CREATION_METHODS.includes(creationMethod);

/**
 * Per-source defaults, applied by `toQuestionV1()` whenever the creator did not
 * supply a value. This is what makes "by prompt", "by image" and "by hand"
 * produce consistently-filled documents instead of each page inventing its own.
 *
 * `status` is the important one: a machine wrote it → it lands in `review`
 * (a human still has to approve it), a teacher wrote it by hand → `published`.
 * `verified` is never true here — only a human reviewer sets that.
 */
export interface CreationDefaults {
  status: QuestionStatus;
  /** Stamped into `metadata.aiModel`; "" for human-authored questions. */
  aiModel: string;
  points: number;
  /** Seconds. */
  estimatedTime: number;
  /** Merged into `tags[]` (deduped), so a bank can be filtered by provenance. */
  tags: string[];
}

const GEMINI = "gemini-2.5-flash";

export const CREATION_METHOD_DEFAULTS: Record<CreationMethod, CreationDefaults> = {
  // AI from a free-text prompt (create/by_user_input).
  ai_prompt: { status: "review", aiModel: GEMINI, points: 1, estimatedTime: 60, tags: ["ai", "ai_prompt"] },
  // AI from a topic/syllabus pick (create/ai, maktab, ixtisoslashtirilgan_maktab).
  ai_generated: { status: "review", aiModel: GEMINI, points: 1, estimatedTime: 60, tags: ["ai"] },
  // AI read it off a photo of an existing paper (create/by_image).
  imported: { status: "review", aiModel: GEMINI, points: 1, estimatedTime: 60, tags: ["ai", "by_image"] },
  exam_import: { status: "review", aiModel: "", points: 1, estimatedTime: 90, tags: ["exam_import"] },
  // Written by hand (create/question, create/custom) — trusted, goes straight out.
  teacher_created: { status: "published", aiModel: "", points: 1, estimatedTime: 60, tags: ["teacher_created"] },
  copied: { status: "draft", aiModel: "", points: 1, estimatedTime: 60, tags: ["copied"] },
  translated: { status: "review", aiModel: "", points: 1, estimatedTime: 60, tags: ["translated"] },
  // A human fixed a broken question (the edit flow in create/question).
  corrected: { status: "published", aiModel: "", points: 1, estimatedTime: 60, tags: ["corrected"] },
};

export const MEDIA_TYPES = ["image", "pdf", "3d", "animation", "latex", "geogebra"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const TEST_TYPES = [
  "diagnostic", "practice", "homework", "exam", "quiz", "adaptive",
  "placement", "SAT", "IELTS", "TOEFL", "custom",
] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const SUPPORTED_LANGUAGES: Lang[] = ["uz", "ru", "en"];

// ─── Difficulty ─────────────────────────────────────────────────────────────
//
// ⚠️ The ids are NOT a fresh 0..5 ladder: `easy=1 / medium=2 / hard=3 /
// olympiad=4` are already burned into thousands of legacy docs, every
// `where('difficultyId','==',n)` query, and the RASCH anchor tables. Renumbering
// them would silently re-label the existing bank. So the two NEW levels take the
// free slots: `beginner=0` and `expert=5`. Sort by `DIFFICULTY_ORDER`, never by
// the raw id.

export const DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert", "olympiad"] as const;
export type DifficultyName = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_ID_BY_NAME: Record<DifficultyName, number> = {
  beginner: 0, easy: 1, medium: 2, hard: 3, olympiad: 4, expert: 5,
};

export const DIFFICULTY_NAME_BY_ID: Record<number, DifficultyName> = {
  0: "beginner", 1: "easy", 2: "medium", 3: "hard", 4: "olympiad", 5: "expert",
};

/** Ascending real difficulty — the id order is not monotonic (see above). */
export const DIFFICULTY_ORDER: Record<DifficultyName, number> = {
  beginner: 0, easy: 1, medium: 2, hard: 3, expert: 4, olympiad: 5,
};

export interface QuestionDifficulty {
  id: number;
  name: DifficultyName;
  /** Calibrated RASCH `b` in logits; null until scripts/analyzeItems.ts writes it. */
  rasch: number | null;
  estimatedAbility: number | null;
}

// ─── Media ──────────────────────────────────────────────────────────────────

export interface QuestionImage {
  hasImage: boolean;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export const emptyImage = (): QuestionImage => ({
  hasImage: false, storagePath: "", downloadUrl: "", width: 0, height: 0,
});

// ─── Content ────────────────────────────────────────────────────────────────

export interface TaxonomyRef {
  id: string;
  name: string;
}

export interface QuestionOption {
  /** "A" | "B" | … — the value stored in `correctAnswer.value` and in a student's answer. */
  id: string;
  text: LocalizedText;
  image: QuestionImage | null;
}

export interface QuestionCorrectAnswer {
  /** Letter for `mcq`, letter[] for `multiple_select`, the literal text for `open`/`numeric`. */
  value: string | string[];
  /** `open`/`numeric` only — other spellings/forms that also count as correct. */
  acceptedAnswers: string[];
  /** `open`/`numeric` only. */
  caseSensitive?: boolean;
}

/**
 * One sub-question inside a block (`multi_part` / `shared_options`).
 *
 * The whole block — stem, image, option pool and every part — is ONE Firestore
 * document: a 3-question block costs 1 write and 1 read instead of 3, and the
 * stem/diagram is stored once instead of being duplicated per question. That is
 * the entire reason blocks exist as a type rather than as N linked questions.
 */
export interface QuestionPart {
  /** "a", "b" … or "33", "34" — also the key a student's answer is stored under. */
  id: string;
  prompt: LocalizedText;
  /** mcq | multiple_select | true_false | open | numeric. Never a block. */
  type: QuestionType;
  /** The part's OWN options. Empty on `shared_options` — those parts use the
   *  block's top-level `options` pool, so the pool is stored exactly once. */
  options: QuestionOption[];
  correctAnswer: QuestionCorrectAnswer;
  points: number;
  explanation: LocalizedText;
}

export interface QuestionSolutionV1 {
  method: string;
  steps: Record<Lang, string[]>;
  finalAnswer: LocalizedText;
}

export interface QuestionAdaptive {
  enabled: boolean;
  minimumTheta: number;
  maximumTheta: number;
}

export interface QuestionMetadata {
  creatorId: string;
  creatorName: string;
  creationMethod: CreationMethod;
  /** e.g. "gemini-2.5-flash" — "" for human-authored questions. */
  aiModel: string;
  verified: boolean;
  reviewedBy: string;
  createdAt: unknown | null; // serverTimestamp() on write, Timestamp on read
  updatedAt: unknown | null;
  publishedAt: unknown | null;
  deleted: boolean;

  // ── Who fixed it, if anyone. Set by the edit flow (`updateQuestion`), NOT by
  // the original author — a question nobody has corrected has "" here. The UI
  // shows "Tuzatgan: {correctedBy}" so a wrong answer can be traced to whoever
  // last touched it.
  /** Display name of the teacher who last corrected this question. */
  correctedBy: string;
  correctedById: string;
  correctedAt: unknown | null;
}

/**
 * The canonical document written to `teacher_questions/{id}`.
 * `schemaVersion: 1` is what `isQuestionV1()` keys off — legacy docs have no such field.
 */
export interface QuestionV1 {
  id: string;
  schemaVersion: 1;
  status: QuestionStatus;
  type: QuestionType;
  answerMode: AnswerMode;

  subject: TaxonomyRef;
  topic: TaxonomyRef;
  subtopic: TaxonomyRef;
  chapter: TaxonomyRef;

  difficulty: QuestionDifficulty;
  points: number;
  /** Seconds a student is expected to need. */
  estimatedTime: number;

  question: LocalizedText;
  image: QuestionImage;
  audio: null;
  video: null;
  formula: string;

  /** On a `shared_options` block this is the SHARED A–F pool every part picks from. */
  options: QuestionOption[];
  correctAnswer: QuestionCorrectAnswer;

  /** Non-empty only for block types. `points` is the sum of the parts'. */
  parts: QuestionPart[];

  solutions: QuestionSolutionV1[];
  hint: LocalizedText;
  explanation: LocalizedText;
  references: string[];
  tags: string[];
  curriculum: string[];
  language: Lang[];

  adaptive: QuestionAdaptive;
  metadata: QuestionMetadata;

  // ── Flat query mirrors (see the header note) — same field names legacy docs
  // use, so ONE query matches both shapes. Keep in sync with the nested values.
  creatorId: string;
  creationMethod: CreationMethod;
  difficultyId: number;
  createdAt: unknown | null;

  /** Uniform [0,1). Powers per-student random sampling in the Milliy sertifikat
   *  exam ([lib/ExamTeacher.ts](../lib/ExamTeacher.ts)) — the same pattern
   *  questions1 uses. Legacy teacher docs lack it until the backfill runs, so the
   *  exam sampler falls back to a createdAt page for those. */
  rand: number;

  /**
   * 🟢 2026-09-16 — set by the SAT JSON importer (`/teacher/sat/import`).
   * `true` means the uploader chose to publish this question to the SHARED SAT
   * pool, so every teacher's SAT builder can pick it from the "Shared" tab.
   *
   * ⚠️ This is a VISIBILITY flag, not an ownership change: `creatorId` stays
   * the uploader's uid, so they alone can edit or delete it (the
   * `teacher_questions` update/delete rule) and the picker shows their
   * `creatorName` as attribution. That is what distinguishes it from the
   * anonymous platform pool (`creatorId: ''`), which only an Admin-SDK script
   * writes and which nobody in-app owns.
   *
   * A flat field for the same reason as the mirrors above: it is QUERIED
   * (`sharedBank == true && subject.id == … orderBy createdAt desc`).
   * Optional — absent on every question written before this existed, which
   * reads as "not shared".
   */
  sharedBank?: boolean;
}

// ─── Statistics — a SEPARATE collection, never mixed into the question ───────
//
// `question_stats/{questionId}`. Kept out of the question doc on purpose: stats
// churn on every answer, question content does not. Nothing writes this yet —
// per-answer writes would multiply Firestore cost, so it is meant to be filled
// by an offline/batched aggregation (scripts/analyzeItems.ts already computes
// the RASCH figures). Creating a question does NOT create a stats doc.

export interface QuestionStats {
  questionId: string;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  skipped: number;
  averageTime: number;
  averageAttempts: number;
  averageAbility: number;
  raschDifficulty: number | null;
  discrimination: number | null;
  guessing: number | null;
  lastCalculated: unknown | null;
}

/** One student's answer to one question — the unit the stats above aggregate. */
export interface StudentAnswerRecord {
  studentId: string;
  questionId: string;
  selectedAnswer: string | string[];
  correct: boolean;
  timeSpent: number;
  attemptNumber: number;
  abilityBefore: number | null;
  abilityAfter: number | null;
  createdAt: unknown | null;
}

// ─── The read-side view model ───────────────────────────────────────────────
//
// What `normalizeQuestion()` returns, and the ONLY question shape UI code should
// touch. It is deliberately LEGACY-SHAPED (`options` letter map, `answer`
// letter, `difficulty` string) so the ~30 existing render/grade sites keep
// working untouched — they just receive normalized data now. New surfaces should
// prefer `optionList` / `correctAnswer` / `difficultyName`.

export interface NormalizedOption {
  id: string;
  text: LocalizedText;
  imageUrl: string | null;
}

export interface NormalizedSolution {
  method: string;
  steps: string[];
  final_answer: string;
}

/** A block's sub-question, ready to render. */
export interface NormalizedPart {
  id: string;
  prompt: LocalizedText;
  type: QuestionType;
  /** The part's own options, or the block's shared pool (already resolved). */
  optionList: NormalizedOption[];
  correctAnswer: QuestionCorrectAnswer;
  points: number;
  explanation: LocalizedText;
}

export interface NormalizedQuestion {
  id: string;
  type: QuestionType;
  answerMode: AnswerMode;
  status: QuestionStatus;

  question: LocalizedText;
  imageUrl: string | null;

  /** Legacy-compatible: `{ A: {uz,ru,en, imageUrl}, … }`. Empty for text-answer types. */
  options: Record<string, LocalizedText & { imageUrl: string | null }>;
  /** Ordered options — prefer this in new code. */
  optionList: NormalizedOption[];

  /** Legacy-compatible correct letter ("" for text-answer types). */
  answer: string;
  correctAnswer: QuestionCorrectAnswer;

  /** Legacy-compatible lowercase string, e.g. "easy". */
  difficulty: DifficultyName;
  difficultyId: number;
  /** Title-cased for badges, e.g. "Easy" (what CartItem called `uiDifficulty`). */
  uiDifficulty: string;

  points: number;
  estimatedTime: number;

  /** Empty for a normal question. Non-empty → this is a BLOCK: render the stem
   *  once, then each part. A student's answer is a map `{ [partId]: value }`. */
  parts: NormalizedPart[];
  /** True when `parts` drive the answering (see `gradeQuestion`). */
  isBlock: boolean;

  explanation: LocalizedText;
  hint: LocalizedText;
  solutions: NormalizedSolution[];
  tags: string[];
  language: Lang[];

  // Flat taxonomy (legacy field names) + the v1 refs.
  subject: string; subjectId: string;
  topic: string; topicId: string;
  chapter: string; chapterId: string;
  subtopic: string; subtopicId: string;

  creatorId: string;
  creatorName: string;
  creationMethod: string;
  /** "" unless someone has edited this question — then the corrector's name. */
  correctedBy: string;

  /** Firestore Timestamp as stored; absent on questions that never had one. */
  createdAt?: { toDate: () => Date } | null;

  /** Calibrated RASCH difficulty when available (legacy field `b`). */
  b?: number;
  rand?: number;

  /** The untouched source doc — for writers that must round-trip it. */
  raw: Record<string, unknown>;
}

/**
 * **Closed** = every answer point is picked from an option list, so the item is
 * graded by a letter and never by typed text ("yopiq savol"). The Rasch paper
 * builder filters on this.
 *
 * ⚠️ Mirrors the rule `ExamTeacher.toExamItem` already applies: a part that
 * draws from the block's printed pool answers with a letter **even when the
 * document mislabels its type** `open`. A `multi_part` block is closed only if
 * EVERY part carries its own options — one typed part makes the whole block
 * typed on the runner.
 */
export const isClosedQuestion = (n: NormalizedQuestion): boolean => {
  if (!n.isBlock) return !isTextType(n.type) && n.optionList.length > 0;
  // `parseParts` hands the shared pool over by reference, which is how the exam
  // bridge detects the same thing.
  if (n.optionList.length > 0 && n.parts.every((p) => p.optionList === n.optionList)) return true;
  return n.parts.length > 0 && n.parts.every((p) => !isTextType(p.type) && p.optionList.length > 0);
};
