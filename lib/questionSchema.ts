// lib/questionSchema.ts
//
// The single adapter between the question SHAPES on disk and the question shape
// the app renders. Read docs/QUESTIONS.md first.
//
//   write path:  creator → toQuestionV1()  → teacher_questions (canonical v1)
//   read  path:  any doc → normalizeQuestion() → NormalizedQuestion → UI
//
// `normalizeQuestion()` accepts, and must keep accepting:
//   • v1        — `options: [{id,text,image}]`, `correctAnswer:{value}`, `difficulty:{id,name}`
//   • legacy    — `options: {A:{uz,ru,en}}`, `answer:'B'`, `difficulty:'easy'`  (questions1,
//                 old teacher_questions, and the snapshots frozen inside custom_tests.questions[])
//   • interim   — the short-lived `created_questions` shape (options map carrying imageUrl)
//
// It costs ZERO Firestore reads — it is a pure function over a doc the caller
// already has. Nothing here migrates data; legacy docs are never rewritten.
//
// ⚠️ NOT for `bsb_chsb_tests` questions. Those are a different polymorphic type
// (points/pairs/rubric, `answer` may be a boolean or a {uz,ru,en} map) and their
// runner/grader compares against those raw values — normalizing would corrupt them.

import { isValidTopicPath } from "@/lib/questionTopics";
import type { Lang, LocalizedText } from "@/types/Math";
import {
  ANSWER_MODE_BY_TYPE, CREATION_METHOD_DEFAULTS, DIFFICULTY_ID_BY_NAME, DIFFICULTY_NAME_BY_ID,
  QUESTION_TYPES, emptyImage,
  type AnswerMode, type CreationMethod, type DifficultyName, type NormalizedOption,
  type NormalizedPart, type NormalizedQuestion, type NormalizedSolution, type QuestionCorrectAnswer,
  type QuestionOption, type QuestionPart, type QuestionStatus, type QuestionType, type QuestionV1,
} from "@/types/question";

/** A question document straight out of Firestore — genuinely untyped: this
 *  module exists precisely to tell the three possible shapes apart at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

const LANGS: Lang[] = ["uz", "ru", "en"];

/** Reads a trilingual field that may also be a bare string (legacy AI output). */
export function toLocalized(value: unknown): LocalizedText {
  if (typeof value === "string") return { uz: value, ru: "", en: "" };
  if (value && typeof value === "object") {
    const v = value as Raw;
    return { uz: v.uz ?? "", ru: v.ru ?? "", en: v.en ?? "" };
  }
  return { uz: "", ru: "", en: "" };
}

/** Picks a language with a fallback chain — never returns undefined. */
export function getText(value: unknown, lang: Lang = "uz"): string {
  const loc = toLocalized(value);
  return loc[lang] || loc.uz || loc.ru || loc.en || "";
}

const firstFilled = (loc: LocalizedText) => loc.uz || loc.ru || loc.en || "";

export const isQuestionV1 = (raw: Raw | null | undefined): boolean =>
  !!raw && (raw.schemaVersion === 1 || Array.isArray(raw.options));

// ─── difficulty ─────────────────────────────────────────────────────────────

/** Accepts `{id,name}` (v1), `'easy'` (legacy), `'Hard'` (uiDifficulty), or a bare id. */
export function parseDifficulty(raw: Raw): { name: DifficultyName; id: number; rasch: number | null } {
  const d = raw?.difficulty;

  if (d && typeof d === "object") {
    const name = (DIFFICULTY_NAME_BY_ID[d.id] ?? String(d.name || "medium").toLowerCase()) as DifficultyName;
    return {
      name: name in DIFFICULTY_ID_BY_NAME ? name : "medium",
      id: typeof d.id === "number" ? d.id : DIFFICULTY_ID_BY_NAME[name] ?? 2,
      rasch: typeof d.rasch === "number" ? d.rasch : null,
    };
  }

  const named = String(d || raw?.uiDifficulty || "").toLowerCase() as DifficultyName;
  if (named in DIFFICULTY_ID_BY_NAME) {
    return { name: named, id: DIFFICULTY_ID_BY_NAME[named], rasch: null };
  }

  const id = typeof raw?.difficultyId === "number" ? raw.difficultyId : 2;
  return { name: DIFFICULTY_NAME_BY_ID[id] ?? "medium", id, rasch: null };
}

// ─── options + answer ───────────────────────────────────────────────────────

function parseOptions(raw: Raw): NormalizedOption[] {
  const opts = raw?.options;
  if (!opts) return [];

  // v1: already an ordered array.
  if (Array.isArray(opts)) {
    return opts
      .filter(Boolean)
      .map((o: Raw, i: number) => ({
        id: String(o.id || OPTION_LETTERS[i] || i),
        text: toLocalized(o.text ?? o),
        imageUrl: o.image?.downloadUrl || o.imageUrl || null,
      }));
  }

  // legacy / interim: a letter-keyed map. Sorting keeps A,B,C,D stable.
  return Object.keys(opts)
    .sort()
    .map((letter) => {
      const o = opts[letter];
      return {
        id: letter,
        text: toLocalized(o),
        imageUrl: (o && typeof o === "object" && (o.imageUrl || o.image?.downloadUrl)) || null,
      };
    });
}

function parseCorrectAnswer(raw: Raw, type: QuestionType): QuestionCorrectAnswer {
  const ca = raw?.correctAnswer;

  // v1
  if (ca && typeof ca === "object" && "value" in ca) {
    return {
      value: ca.value ?? "",
      acceptedAnswers: Array.isArray(ca.acceptedAnswers) ? ca.acceptedAnswers : [],
      caseSensitive: !!ca.caseSensitive,
    };
  }

  // interim `created_questions`: correctAnswer was a trilingual text blob.
  if (ca && typeof ca === "object" && !Array.isArray(ca)) {
    const text = firstFilled(toLocalized(ca));
    if (!raw.answer && text) {
      return {
        value: text,
        acceptedAnswers: Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers : [],
        caseSensitive: !!raw.caseSensitive,
      };
    }
  }

  // legacy: a letter (mcq) or a typed answer.
  const answer = raw?.answer;
  const value = Array.isArray(answer) ? answer : answer == null ? "" : String(answer);

  return {
    value: type === "multiple_select" && !Array.isArray(value) ? [value].filter(Boolean) : value,
    acceptedAnswers: Array.isArray(raw?.acceptedAnswers) ? raw.acceptedAnswers : [],
    caseSensitive: !!raw?.caseSensitive,
  };
}

function parseType(raw: Raw): QuestionType {
  const t = String(raw?.type || "").toLowerCase();

  // bsb / older AI routes used these names.
  if (t === "short_answer" || t === "open_ended") return "open";
  // Only trust a type we know (QUESTION_TYPES is the source of truth — a hardcoded
  // list here would silently misclassify every newly added type as `mcq`).
  if (t && (QUESTION_TYPES as readonly string[]).includes(t)) return t as QuestionType;

  // No usable type field: infer from the shape.
  // A doc carrying `parts[]` is a block; a shared pool means the parts pick from it.
  if (Array.isArray(raw?.parts) && raw.parts.length > 0) {
    const partsHaveOwnOptions = raw.parts.some((p: Raw) => p?.options && Object.keys(p.options).length > 0);
    return partsHaveOwnOptions ? "multi_part" : "shared_options";
  }

  // `answerMode` is the interim created_questions flag ('closed' | 'open').
  if (raw?.answerMode === "open" || raw?.answerMode === "text") return "open";
  const hasOptions = Array.isArray(raw?.options) ? raw.options.length > 0 : !!raw?.options && Object.keys(raw.options).length > 0;
  return hasOptions ? "mcq" : "open";
}

// ─── blocks (multi_part / shared_options) ───────────────────────────────────

/**
 * A student's answer to a BLOCK: one entry per part id.
 * Stored in `attempts.answers[questionId]` as a plain object.
 */
export type BlockAnswer = Record<string, string | string[]>;

export const isBlockAnswer = (given: unknown): given is BlockAnswer =>
  !!given && typeof given === "object" && !Array.isArray(given);

/**
 * `shared_options` parts have no options of their own — they draw from the
 * block's pool, which is why the pool is stored only once.
 */
function parseParts(raw: Raw, sharedPool: NormalizedOption[]): NormalizedPart[] {
  const parts = raw?.parts;
  if (!Array.isArray(parts)) return [];

  return parts.filter(Boolean).map((p: Raw, i: number) => {
    const own = parseOptions(p);
    const type = (p.type || "mcq") as QuestionType;
    return {
      id: String(p.id || i + 1),
      prompt: toLocalized(p.prompt ?? p.question),
      type,
      optionList: own.length > 0 ? own : sharedPool,
      correctAnswer: parseCorrectAnswer(p, type),
      points: typeof p.points === "number" ? p.points : 1,
      explanation: toLocalized(p.explanation),
    };
  });
}

// ─── solutions ──────────────────────────────────────────────────────────────

function parseSolutions(raw: Raw, lang: Lang): NormalizedSolution[] {
  const sols = raw?.solutions;
  if (!Array.isArray(sols)) return [];

  return sols.filter(Boolean).map((s: Raw) => {
    // v1: steps is {uz:[],ru:[],en:[]} and the answer is trilingual.
    if (s.steps && !Array.isArray(s.steps)) {
      const steps: string[] = s.steps[lang]?.length ? s.steps[lang] : (s.steps.uz || s.steps.ru || s.steps.en || []);
      return {
        method: s.method || "",
        steps: Array.isArray(steps) ? steps : [],
        final_answer: firstFilled(toLocalized(s.finalAnswer ?? s.final_answer)),
      };
    }
    // legacy: steps is a plain string[] and final_answer a string.
    return {
      method: s.method || "",
      steps: Array.isArray(s.steps) ? s.steps : [],
      final_answer: typeof s.final_answer === "string" ? s.final_answer : firstFilled(toLocalized(s.final_answer)),
    };
  });
}

// ─── the read adapter ───────────────────────────────────────────────────────

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Turns ANY stored question (v1, legacy, interim) into the one shape the UI reads.
 * Pure — no I/O. Safe to call on every render, but prefer mapping once at the
 * fetch boundary so React sees stable objects.
 *
 * @param lang picks the language for the flattened `solutions[].steps`.
 */
export function normalizeQuestion(raw: Raw, lang: Lang = "uz"): NormalizedQuestion {
  const type = parseType(raw);
  const optionList = parseOptions(raw);
  const difficulty = parseDifficulty(raw);
  const correctAnswer = parseCorrectAnswer(raw, type);

  // Legacy-shaped map so existing `q.options[letter]` render code keeps working.
  const options: NormalizedQuestion["options"] = {};
  for (const o of optionList) options[o.id] = { ...o.text, imageUrl: o.imageUrl };

  const answer = Array.isArray(correctAnswer.value)
    ? correctAnswer.value.join(",")
    : String(correctAnswer.value ?? "");

  // A block: the stem is answered through its parts. `shared_options` parts fall
  // back to the block's own option list (the printed A–F pool).
  const parts = parseParts(raw, optionList);

  const meta = (raw?.metadata || {}) as Raw;
  const ref = (v: unknown, fallbackName: unknown, fallbackId: unknown) => {
    if (v && typeof v === "object") {
      const o = v as Raw;
      return { name: String(o.name ?? ""), id: String(o.id ?? "") };
    }
    return { name: String(fallbackName ?? v ?? ""), id: String(fallbackId ?? "") };
  };

  const subject = ref(raw?.subject, raw?.subject, raw?.subjectId);
  const topic = ref(raw?.topic, raw?.topic, raw?.topicId);
  const chapter = ref(raw?.chapter, raw?.chapter, raw?.chapterId);
  const subtopic = ref(raw?.subtopic, raw?.subtopic, raw?.subtopicId);

  return {
    id: String(raw?.id ?? ""),
    type,
    answerMode: (raw?.answerMode === "single" || raw?.answerMode === "multi" || raw?.answerMode === "text"
      ? raw.answerMode
      : ANSWER_MODE_BY_TYPE[type]) as AnswerMode,
    status: (raw?.status || "published") as QuestionStatus,

    question: toLocalized(raw?.question ?? raw?.text),
    imageUrl: raw?.image?.downloadUrl || raw?.imageUrl || null,

    options,
    optionList,

    answer,
    correctAnswer,

    difficulty: difficulty.name,
    difficultyId: difficulty.id,
    uiDifficulty: raw?.uiDifficulty || titleCase(difficulty.name),

    // A block is worth the sum of its parts unless the doc says otherwise.
    points: typeof raw?.points === "number"
      ? raw.points
      : parts.length
        ? parts.reduce((sum, p) => sum + p.points, 0)
        : 1,
    estimatedTime: typeof raw?.estimatedTime === "number" ? raw.estimatedTime : 60,

    parts,
    isBlock: parts.length > 0,

    explanation: toLocalized(raw?.explanation),
    hint: toLocalized(raw?.hint),
    solutions: parseSolutions(raw, lang),
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    language: Array.isArray(raw?.language) ? raw.language : ["uz"],

    subject: subject.name, subjectId: subject.id,
    topic: topic.name, topicId: topic.id,
    chapter: chapter.name, chapterId: chapter.id,
    subtopic: subtopic.name, subtopicId: subtopic.id,

    creatorId: raw?.creatorId || meta.creatorId || "",
    creatorName: raw?.creatorName || meta.creatorName || "",
    creationMethod: raw?.creationMethod || meta.creationMethod || "",
    correctedBy: meta.correctedBy || "",
    createdAt: raw?.createdAt ?? meta.createdAt ?? null,

    // RASCH: `b` is the calibrated difficulty written by scripts/analyzeItems.ts.
    ...(typeof raw?.b === "number" ? { b: raw.b } : difficulty.rasch !== null ? { b: difficulty.rasch } : {}),
    ...(typeof raw?.rand === "number" ? { rand: raw.rand } : {}),

    raw,
  };
}

/** Convenience for a list of docs (custom_tests.questions[], query snapshots…). */
export const normalizeQuestions = (list: Raw[] | undefined | null, lang: Lang = "uz"): NormalizedQuestion[] =>
  (list || []).filter(Boolean).map((q) => normalizeQuestion(q, lang));

// ─── grading ────────────────────────────────────────────────────────────────

/** One part of a block, graded on its own. */
export function isPartCorrect(part: NormalizedPart, given: string | string[] | undefined | null): boolean {
  // A part IS a question — reuse the same comparator by shaping it as one.
  return isAnswerCorrect(
    {
      type: part.type,
      optionList: part.optionList,
      correctAnswer: part.correctAnswer,
      isBlock: false,
      parts: [],
    } as unknown as NormalizedQuestion,
    given,
  );
}

/**
 * Points earned / points available. THE scoring entry point:
 *   • normal question → 0 or `q.points`
 *   • block           → the sum of the parts the student got right (partial credit)
 *
 * A block's answer is `{ [partId]: value }`, so one document holds the whole
 * block AND one `attempts.answers[qId]` entry holds the whole response.
 */
export function gradeQuestion(
  q: NormalizedQuestion,
  given: string | string[] | BlockAnswer | undefined | null,
): { earned: number; total: number } {
  if (!q.isBlock) {
    const total = q.points || 1;
    const ok = isAnswerCorrect(q, given as string | string[] | undefined | null);
    return { earned: ok ? total : 0, total };
  }

  const answers: BlockAnswer = isBlockAnswer(given) ? given : {};
  const total = q.parts.reduce((sum, p) => sum + (p.points || 1), 0);
  const earned = q.parts.reduce(
    (sum, p) => (isPartCorrect(p, answers[p.id]) ? sum + (p.points || 1) : sum),
    0,
  );
  return { earned, total };
}

/** Collapses runs of whitespace and trims — "  2 x " and "2 x" are the same answer. */
const squashSpace = (s: string) => s.replace(/\s+/g, " ").trim();

/** Numeric answers: "0,5" (uz/ru decimal comma) === "0.5", and spaces never matter. */
const squashNumeric = (s: string) => squashSpace(s).replace(/,/g, ".").replace(/\s/g, "");

/** True when a student actually answered — `[]` and `"  "` do not count. */
export const hasAnswer = (given: string | string[] | undefined | null): boolean =>
  Array.isArray(given) ? given.length > 0 : typeof given === "string" && given.trim() !== "";

/**
 * The ONE grading comparison — every runner and every results/review page must call
 * this instead of `answers[q.id] === q.answer`, so a question is graded identically
 * wherever it is shown. Handles every shape `normalizeQuestion()` can produce:
 *
 *   mcq / true_false   → option-id (letter) equality — identical to the legacy check.
 *   multiple_select    → exact SET equality over the selected option ids.
 *   open / numeric / … → text compare against `correctAnswer.value` AND every
 *                        `acceptedAnswers` entry; whitespace-collapsed, case-insensitive
 *                        unless `caseSensitive`, and comma/dot-insensitive for `numeric`.
 */
export function isAnswerCorrect(
  q: NormalizedQuestion,
  given: string | string[] | BlockAnswer | undefined | null,
): boolean {
  // A block counts as correct only when EVERY part is (partial credit lives in
  // `gradeQuestion`, which is what a runner should score with).
  if (q.isBlock) {
    const { earned, total } = gradeQuestion(q, given);
    return total > 0 && earned === total;
  }
  if (isBlockAnswer(given)) return false; // a block answer to a non-block question
  if (!hasAnswer(given)) return false;

  const { value, acceptedAnswers, caseSensitive } = q.correctAnswer;

  // Multi-answer: the sets must match exactly (no partial credit).
  if (q.type === "multiple_select" || Array.isArray(value)) {
    const want = new Set((Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean));
    const got = new Set(
      (Array.isArray(given) ? given : String(given).split(",")).map((g) => String(g).trim()).filter(Boolean),
    );
    if (want.size !== got.size) return false;
    for (const g of got) if (!want.has(g)) return false;
    return true;
  }

  const answer = Array.isArray(given) ? given.join(",") : String(given);

  // Closed types: options exist, so the stored answer is an option id.
  if (q.optionList.length > 0) return answer === String(value ?? "");

  // Text types (open, numeric, fill_blank, …) — no options to pick from.
  const prep = (s: string) => {
    const t = q.type === "numeric" ? squashNumeric(s) : squashSpace(s);
    return caseSensitive ? t : t.toLowerCase();
  };

  const given_ = prep(answer);
  if (!given_) return false;

  return [String(value ?? ""), ...(acceptedAnswers || []).map(String)]
    .filter((c) => c.trim() !== "")
    .some((c) => prep(c) === given_);
}

// ─── the write adapter ──────────────────────────────────────────────────────

export interface QuestionV1Meta {
  id: string;
  creatorId: string;
  creatorName: string;
  creationMethod: CreationMethod;
  status?: QuestionStatus;
  aiModel?: string;
  /** serverTimestamp() — passed in so this module stays free of firestore imports. */
  timestamp: unknown;
  /** EDIT path only: the original `createdAt`, so an edit doesn't reset it. */
  createdAt?: unknown;
  /** EDIT path only: the teacher who fixed the question ("corrected by …"). */
  correctedBy?: string;
  correctedById?: string;
  curriculum?: string[];
  points?: number;
  estimatedTime?: number;
}

/**
 * Thrown when a creator tries to file a question under a subject/topic/subtopic
 * that is not in data/question_topics.json. Pages catch this and show the topic
 * picker instead of writing garbage taxonomy into the bank.
 */
export class InvalidTopicError extends Error {
  constructor(readonly path: { subjectId: string; topicId: string; subtopicId: string }) {
    super(`Question topic is not in question_topics.json: ${path.subjectId}/${path.topicId}/${path.subtopicId}`);
    this.name = "InvalidTopicError";
  }
}

/**
 * Builds the canonical v1 doc from ANY in-memory question a creator already has
 * (the AI pages, the custom canvas and the builder all hand over their existing
 * object). One doc, one write — nothing else is created alongside it.
 *
 * ⚠️ **Throws `InvalidTopicError` unless the topic path exists in
 * data/question_topics.json.** This is the single choke point that keeps the bank
 * clean: an LLM cannot invent a subject, and no page can fall back to a
 * placeholder like "custom" or "by_prompt". Creators must ask the teacher which
 * topic the questions belong to (TopicAssignModal) before saving.
 */
/** A part whose options ARE the block's pool must not re-store them. */
const isSharedPool = (type: QuestionType, part: NormalizedPart, pool: NormalizedOption[]) =>
  type === "shared_options" || (part.optionList.length > 0 && part.optionList === pool);

const toStoredOption = (o: NormalizedOption): QuestionOption => ({
  id: o.id,
  text: o.text,
  image: o.imageUrl ? { ...emptyImage(), hasImage: true, downloadUrl: o.imageUrl, storagePath: "" } : null,
});

export function toQuestionV1(source: Raw, meta: QuestionV1Meta): QuestionV1 {
  const n = normalizeQuestion(source);
  const type = n.type;

  if (!isValidTopicPath(n.subjectId, n.topicId, n.subtopicId)) {
    throw new InvalidTopicError({ subjectId: n.subjectId, topicId: n.topicId, subtopicId: n.subtopicId });
  }

  const options: QuestionOption[] = n.optionList.map((o) => ({
    id: o.id,
    text: o.text,
    image: o.imageUrl
      ? { ...emptyImage(), hasImage: true, downloadUrl: o.imageUrl, storagePath: source?.options?.[o.id]?.imageStoragePath || "" }
      : null,
  }));

  const image = n.imageUrl
    ? { ...emptyImage(), hasImage: true, downloadUrl: n.imageUrl, storagePath: source?.imageStoragePath || source?.image?.storagePath || "" }
    : emptyImage();

  const solutions = n.solutions.map((s) => ({
    method: s.method || "Standard",
    steps: LANGS.reduce((acc, l) => ({ ...acc, [l]: l === "uz" ? s.steps : [] }), {} as Record<Lang, string[]>),
    finalAnswer: { uz: s.final_answer, ru: "", en: "" },
  }));

  // Per-source defaults (types/question.ts): what "by prompt" / "by image" /
  // "by hand" each fill in when the creator didn't say. An AI-written question
  // defaults to `review`; a hand-written one to `published`.
  const defaults = CREATION_METHOD_DEFAULTS[meta.creationMethod];
  const status = meta.status || defaults.status;

  return {
    id: meta.id,
    schemaVersion: 1,
    status,
    type,
    answerMode: n.answerMode,

    subject: { id: n.subjectId, name: n.subject },
    topic: { id: n.topicId, name: n.topic },
    subtopic: { id: n.subtopicId, name: n.subtopic },
    chapter: { id: n.chapterId, name: n.chapter },

    difficulty: {
      id: n.difficultyId,
      name: n.difficulty,
      rasch: typeof n.b === "number" ? n.b : null,
      estimatedAbility: null,
    },
    // A block is always worth the sum of its parts — a per-source default (1)
    // would silently make a 3-part block worth as much as a single question.
    points: n.isBlock ? n.parts.reduce((sum, p) => sum + (p.points || 1), 0) : (meta.points ?? source?.points ?? defaults.points),
    estimatedTime: meta.estimatedTime ?? source?.estimatedTime ?? defaults.estimatedTime,

    question: n.question,
    image,
    audio: null,
    video: null,
    formula: typeof source?.formula === "string" ? source.formula : "",

    options,
    correctAnswer: n.correctAnswer,

    // Blocks: every part travels inside this ONE document.
    parts: n.parts.map((p): QuestionPart => ({
      id: p.id,
      prompt: p.prompt,
      type: p.type,
      // `shared_options` parts keep an EMPTY list — they read the block's pool,
      // so the pool is never duplicated per part.
      options: isSharedPool(type, p, n.optionList) ? [] : p.optionList.map(toStoredOption),
      correctAnswer: p.correctAnswer,
      points: p.points,
      explanation: p.explanation,
    })),

    solutions,
    hint: n.hint,
    explanation: n.explanation,
    references: Array.isArray(source?.references) ? source.references : [],
    // Provenance tags are merged in (deduped) so the bank stays filterable by source.
    tags: [...new Set([...n.tags, ...defaults.tags])],
    curriculum: meta.curriculum ?? (Array.isArray(source?.curriculum) ? source.curriculum : []),
    language: n.language,

    adaptive: { enabled: true, minimumTheta: -3, maximumTheta: 3 },

    metadata: {
      creatorId: meta.creatorId,
      creatorName: meta.creatorName,
      creationMethod: meta.creationMethod,
      aiModel: meta.aiModel || defaults.aiModel,
      // Only a human reviewer sets `verified` — never the creator.
      verified: false,
      reviewedBy: "",
      createdAt: meta.createdAt ?? meta.timestamp,
      updatedAt: meta.timestamp,
      publishedAt: status === "published" ? meta.timestamp : null,
      deleted: false,

      // Only the edit flow passes these; a question nobody has fixed keeps "".
      // Carried over from the source doc otherwise, so a later edit by someone
      // else doesn't erase the previous corrector until they actually correct it.
      correctedBy: meta.correctedBy ?? source?.metadata?.correctedBy ?? "",
      correctedById: meta.correctedById ?? source?.metadata?.correctedById ?? "",
      correctedAt: meta.correctedBy ? meta.timestamp : (source?.metadata?.correctedAt ?? null),
    },

    // Flat query mirrors — the fields every Firestore filter/order uses.
    creatorId: meta.creatorId,
    creationMethod: meta.creationMethod,
    difficultyId: n.difficultyId,
    createdAt: meta.createdAt ?? meta.timestamp,

    // Uniform [0,1) so the student exam can sample a DIFFERENT random subset per
    // student (lib/ExamTeacher.ts), the same way questions1 does. Re-rolled on
    // every save, which is harmless — it only reshuffles sampling position.
    rand: typeof source?.rand === 'number' ? source.rand : Math.random(),
  };
}
