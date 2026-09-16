// lib/SatQuestionImport.ts
//
// The PURE layer of the teacher SAT dataset importer (`/teacher/sat/import`):
// parse a JSON file, validate every row against the taxonomy, and hand back
// rows already shaped for `toQuestionV1`. No Firestore, no React — the page
// only renders what this returns, and this can be reasoned about on its own.
//
// ⚠️ EVERY row is validated against `data/question_topics.json`, not merely
// type-checked. `toQuestionV1` THROWS `InvalidTopicError` on an unknown
// subject/topic/subtopic triple (docs/QUESTIONS.md — "an LLM cannot pick a
// topic"), so an unvalidated row would blow up mid-import after earlier rows
// had already been written. Rejecting up front is what makes the import
// all-or-nothing per row and reportable before anything is saved.
//
// ⚠️ The ids in the file are the TAXONOMY'S ids, not free text, and they are
// persisted into the document. That is why the upload page prints the whole
// topic → section tree next to the file picker: a teacher cannot guess
// `research-organizing-margin-of-error-outliers`.

import { findSubtopic, findTopic, findSubject } from '@/lib/questionTopics';
import { SAT_MATH_TAXONOMY_SLUG, SAT_RW_TAXONOMY_SLUG } from '@/lib/SatMathQuiz';
import { DIFFICULTY_ID_BY_NAME, DIFFICULTY_LEVELS, type DifficultyName } from '@/types/question';

export type SatImportSubject = typeof SAT_MATH_TAXONOMY_SLUG | typeof SAT_RW_TAXONOMY_SLUG;

/** Math authors `mcq` + `numeric` (grid-in); English R&W has no grid-in. */
export const allowedTypesFor = (subject: SatImportSubject): ('mcq' | 'numeric')[] =>
  subject === SAT_MATH_TAXONOMY_SLUG ? ['mcq', 'numeric'] : ['mcq'];

/** One row of the uploaded file, before validation — genuinely untyped input. */
type RawRow = Record<string, unknown>;

/** A row that passed, with the exact `toQuestionV1` source object built. */
export interface SatImportOk {
  /** 0-based position in the file — what the error/preview lists cite. */
  index: number;
  preview: string;
  type: 'mcq' | 'numeric';
  topicName: string;
  subtopicName: string;
  difficulty: DifficultyName;
  /** Ready to hand straight to `toQuestionV1`. */
  source: Record<string, unknown>;
}

export interface SatImportError {
  index: number;
  reason: string;
}

export interface SatImportReport {
  subject: SatImportSubject;
  ok: SatImportOk[];
  errors: SatImportError[];
  /** Rows dropped as exact content duplicates of an earlier row in the SAME file. */
  duplicates: number;
  /** Set when the file itself could not be read as a JSON array of objects. */
  fatal?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Accepts `choices` as `{A:"…"}` or as a plain array `["…","…"]` (→ A,B,C,D). */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
function readChoices(v: unknown): Record<string, string> | null {
  if (Array.isArray(v)) {
    if (v.length > LETTERS.length) return null;
    const out: Record<string, string> = {};
    v.forEach((text, i) => { out[LETTERS[i]] = str(text); });
    return out;
  }
  if (v && typeof v === 'object') {
    const out: Record<string, string> = {};
    for (const [k, text] of Object.entries(v as Record<string, unknown>)) {
      out[k.trim().toUpperCase()] = str(text);
    }
    return out;
  }
  return null;
}

/** Exact-content key, so re-uploading the same file twice in a row is visible. */
const contentKey = (row: RawRow) => JSON.stringify([
  str(row.question),
  str(row.answer).toLowerCase(),
  Object.entries(readChoices(row.choices) ?? {}).sort(),
]);

/**
 * Validate ONE row. Returns the built source object, or a human reason string.
 * Reasons name the offending value — a 400-row file is only fixable if the
 * report says *which* id was wrong, not merely that one was.
 */
function buildRow(row: RawRow, subject: SatImportSubject): { source: Record<string, unknown>; meta: Omit<SatImportOk, 'index' | 'source'> } | string {
  const subjectNode = findSubject(subject);
  if (!subjectNode) return `unknown subject "${subject}"`;

  const question = str(row.question);
  if (question.length < 3) return 'missing "question"';

  const rawType = (str(row.type) || 'mcq').toLowerCase();
  const allowed = allowedTypesFor(subject);
  if (!allowed.includes(rawType as 'mcq' | 'numeric')) {
    return `"type": "${rawType}" — this subject accepts ${allowed.join(' or ')}`;
  }
  const type = rawType as 'mcq' | 'numeric';

  const topicId = str(row.topic);
  const subtopicId = str(row.subtopic);
  const topic = findTopic(subject, topicId);
  if (!topic) return `unknown "topic": "${topicId}"`;
  const subtopic = findSubtopic(subject, topicId, subtopicId);
  if (!subtopic) return `unknown "subtopic": "${subtopicId}" under topic "${topicId}"`;

  const difficultyRaw = (str(row.difficulty) || 'medium').toLowerCase();
  if (!DIFFICULTY_LEVELS.includes(difficultyRaw as DifficultyName)) {
    return `unknown "difficulty": "${difficultyRaw}" — one of ${DIFFICULTY_LEVELS.join(', ')}`;
  }
  const difficulty = difficultyRaw as DifficultyName;
  const difficultyId = DIFFICULTY_ID_BY_NAME[difficulty];

  const answer = str(row.answer);
  if (!answer) return 'missing "answer"';

  const options: Record<string, { uz: string; ru: string; en: string }> = {};
  let correctValue = answer;

  if (type === 'mcq') {
    const choices = readChoices(row.choices);
    if (!choices) return 'missing "choices" (object {"A":…} or array)';
    const keys = Object.keys(choices);
    if (keys.length < 2) return `"choices" needs at least 2 entries, got ${keys.length}`;
    if (keys.some((k) => !choices[k])) return '"choices" has an empty entry';
    const letter = answer.toUpperCase();
    if (!(letter in choices)) return `"answer": "${answer}" is not one of its own choices (${keys.join(', ')})`;
    // Content is English — SAT is an English-language exam, and the runner reads
    // `.en` for these subjects (docs/SAT_QUIZ.md, the English-only chrome change).
    for (const [k, text] of Object.entries(choices)) options[k] = { uz: '', ru: '', en: text };
    correctValue = letter;
  }

  const acceptedAnswers = Array.isArray(row.acceptedAnswers)
    ? row.acceptedAnswers.map((a) => str(a)).filter(Boolean)
    : [];
  if (type === 'mcq' && acceptedAnswers.length) {
    return '"acceptedAnswers" only applies to a "numeric" question';
  }

  const source = {
    question: { uz: '', ru: '', en: question },
    imageUrl: str(row.imageUrl) || null,
    imageStoragePath: null,

    type,
    options,
    correctAnswer: { value: correctValue, acceptedAnswers, caseSensitive: false },

    subject: { id: subject, name: subjectNode.name },
    topic: { id: topic.id, name: topic.name },
    subtopic: { id: subtopic.id, name: subtopic.name },
    chapter: { id: '', name: '' },

    difficulty: { id: difficultyId, name: difficulty },
    difficultyId,

    explanation: { uz: '', ru: '', en: str(row.explanation) },
    hint: '',
    tags: [],
    curriculum: [],
    language: ['en'],
  };

  const flat = question.replace(/\s+/g, ' ');
  return {
    source,
    meta: {
      preview: flat.length > 120 ? `${flat.slice(0, 120)}…` : flat,
      type,
      topicName: topic.name,
      subtopicName: subtopic.name,
      difficulty,
    },
  };
}

/** Hard cap per upload — a single batch is capped at 500 writes by Firestore,
 *  and the page chunks at that size; this keeps one upload reviewable too. */
export const MAX_IMPORT_ROWS = 500;

/**
 * Parse and validate a whole file. NEVER throws — a malformed file comes back
 * as `fatal`, a malformed row as an entry in `errors`, so the page can always
 * render a report instead of an error boundary.
 */
export function parseSatImport(text: string, subject: SatImportSubject): SatImportReport {
  const empty: SatImportReport = { subject, ok: [], errors: [], duplicates: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ...empty, fatal: `Not valid JSON: ${e instanceof Error ? e.message : 'parse failed'}` };
  }

  // Tolerate a wrapper object — `{"questions": [...]}` is a shape people export.
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown })?.questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;

  if (!rows) return { ...empty, fatal: 'Expected a JSON array of questions, or {"questions": [...]}.' };
  if (rows.length === 0) return { ...empty, fatal: 'The file contains no questions.' };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { ...empty, fatal: `${rows.length} rows — split the file, the limit is ${MAX_IMPORT_ROWS} per upload.` };
  }

  const ok: SatImportOk[] = [];
  const errors: SatImportError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ index, reason: 'not a JSON object' });
      return;
    }
    const row = raw as RawRow;

    const key = contentKey(row);
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key);

    const built = buildRow(row, subject);
    if (typeof built === 'string') { errors.push({ index, reason: built }); return; }
    ok.push({ index, source: built.source, ...built.meta });
  });

  return { subject, ok, errors, duplicates };
}

/** The example shown on the upload page — kept here so the docs, the UI and
 *  the validator above can never describe three different formats. */
export const SAT_IMPORT_EXAMPLE = `[
  {
    "question": "If 3x + 5 = 20, what is the value of x?",
    "type": "mcq",
    "topic": "algebra",
    "subtopic": "linear-equations",
    "difficulty": "easy",
    "choices": { "A": "3", "B": "5", "C": "7", "D": "15" },
    "answer": "B",
    "explanation": "3x = 15, so x = 5."
  },
  {
    "question": "What is the value of 65/4 as a decimal?",
    "type": "numeric",
    "topic": "problem-solving-and-data-analysis",
    "subtopic": "unit-conversion",
    "difficulty": "medium",
    "answer": "16.25",
    "acceptedAnswers": ["65/4"]
  }
]`;
