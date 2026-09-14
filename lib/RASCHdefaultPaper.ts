// lib/RASCHdefaultPaper.ts
//
// The DEFAULT Rasch paper — the 45 questions the builder's "Namunaviy variant"
// button drops onto an empty paper, so a teacher can sit a blueprint-complete
// variant (or edit one into their own) without hand-picking 45 questions.
//
// ⚠️ **The content is data, not code.** It lives in `data/rasch-default-paper.json`
// and that file is the ONLY place to edit questions — this module just validates
// it and turns it into `RaschQuizItem`s. Contract: docs/RASCH_QUIZ.md.
//
// Why a bundled JSON rather than 45 seeded Firestore documents:
//   • it costs ZERO reads, and the builder already stores the paper as embedded
//     snapshots, so a ref to a seed document would buy nothing;
//   • a developer can change the paper in a diff that is reviewable, instead of
//     through a console;
//   • it cannot drift per environment — dev, staging and prod ship the same 45.
// The cost is that it is NOT in anyone's question bank: the items are snapshots
// only, they are never listed by the pickers and editing the JSON does not touch
// a paper a teacher has already saved. That is the same freeze every stored quiz
// item already has.

import { EXAM_BLUEPRINT, bandFor } from './Examblueprint';
import { getMathTopics } from './Mathstructure';
import { quizQuotaGaps, quizSlotCount, RASCH_QUIZ_TOTAL } from './RASCHquiz';
import type { DifficultyId, DifficultyKey, Lang, LocalizedText, OptionKey, QuestionDoc } from '@/types/Math';
import type { RaschQuizItem } from '@/types/TeacherRaschQuiz';

// ─── the authoring shape (what data/rasch-default-paper.json holds) ──────────

/** Any user-facing string: trilingual, or one string used for all three. */
export type DefaultText = string | Partial<Record<Lang, string>>;

export interface DefaultPaperEntry {
  /** A blueprint row id from EXAM_BLUEPRINT (`algebraic-y1`, `geometry-o`…). */
  sectionId: string;
  /** A chapter that row draws from. The topicId comes from the row's pools. */
  chapterId: string;
  question: DefaultText;
  /** Closed rows (Y-1 / Y-2) only — A–D. An O row must not carry options. */
  options?: Partial<Record<OptionKey, DefaultText>>;
  /** Closed: the correct option key. Open: the literal text the student types. */
  answer: string;
  /** Open only: other spellings graded correct. */
  acceptedAnswers?: string[];
  /** Open only, default `true` — grade with the numeric comparison. */
  numeric?: boolean;
  explanation?: DefaultText;
  /** Defaults to the row's own band (Y-1 → 2, Y-2 / O → 3). */
  difficultyId?: DifficultyId;
}

export interface DefaultPaperFile {
  title?: DefaultText;
  durationMinutes?: number;
  questions: DefaultPaperEntry[];
}

/**
 * Id prefix for a default item.
 *
 * ⚠️ It must not collide with a `questions1` or `teacher_questions` id, because
 * the builder de-duplicates on `id` (`pickedIds` / `checkQuizAdd`) — a collision
 * would make a real question un-addable. Firestore ids are 20 random chars, so a
 * readable slug can never be one.
 */
export const DEFAULT_ITEM_PREFIX = 'rasch-default-';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

const DIFF_KEY_BY_ID: Record<number, DifficultyKey> = {
  0: 'easy', 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard', 5: 'hard',
};

/** A bare string fills all three languages — most options are just a number. */
export function toLocalized(text: DefaultText | undefined): LocalizedText {
  if (typeof text === 'string') return { uz: text, ru: text, en: text };
  const uz = text?.uz ?? text?.ru ?? text?.en ?? '';
  return { uz, ru: text?.ru ?? uz, en: text?.en ?? uz };
}

// ─── one entry → one quiz item ──────────────────────────────────────────────

/** What the builder gets back: the paper, plus anything wrong with the file. */
export interface DefaultPaperBuild {
  items: RaschQuizItem[];
  title: LocalizedText;
  durationMinutes: number;
  /**
   * Human-readable faults, in file order. NON-EMPTY ⇒ do not load the paper: a
   * silently-wrong default is worse than none, because it would be published
   * against the wrong blueprint rows and mark students on dimensions the paper
   * never measured.
   */
  problems: string[];
}

/**
 * Validates and converts the whole file.
 *
 * Everything positional is DERIVED, never authored: `topicId` from the row's
 * pools, `testType` and the section from the row itself, the chapter name from
 * data/syllabus.json. The JSON therefore cannot invent a sectionId or file a
 * question under a chapter its row does not draw from — the two mistakes that
 * silently credit the wrong dimension (see `sectionForChapter`).
 */
export function buildDefaultPaper(file: DefaultPaperFile): DefaultPaperBuild {
  const problems: string[] = [];
  const items: RaschQuizItem[] = [];
  const entries = Array.isArray(file?.questions) ? file.questions : [];

  if (entries.length === 0) problems.push('data/rasch-default-paper.json: "questions" is empty.');

  entries.forEach((entry, index) => {
    const where = `#${index + 1} (${entry?.sectionId ?? '?'})`;

    const section = EXAM_BLUEPRINT.find((s) => s.id === entry?.sectionId);
    if (!section) {
      problems.push(`${where}: unknown sectionId — use one of ${EXAM_BLUEPRINT.map((s) => s.id).join(', ')}.`);
      return;
    }

    const pool = section.pools.find((p) => p.chapterId === entry.chapterId);
    if (!pool) {
      problems.push(
        `${where}: chapter "${entry.chapterId}" is not in this row's pools (${section.pools.map((p) => p.chapterId).join(', ')}).`,
      );
      return;
    }

    const closed = section.testType !== 'O';
    const answer = String(entry.answer ?? '').trim();
    if (!answer) {
      problems.push(`${where}: "answer" is empty.`);
      return;
    }

    if (closed) {
      const keys = OPTION_KEYS.filter((k) => entry.options?.[k] !== undefined);
      if (keys.length < 2) {
        problems.push(`${where}: a ${section.testType} row is a CLOSED item and needs A–D options.`);
        return;
      }
      if (!keys.includes(answer as OptionKey)) {
        problems.push(`${where}: "answer" is "${answer}" but the options are ${keys.join(', ')}.`);
        return;
      }
    } else if (entry.options) {
      // An O item is answered by TYPING. Options on it would never be rendered
      // (`examMode` goes by qType) and would only make the key look closed.
      problems.push(`${where}: an O row is an OPEN item — remove "options" and put the typed answer in "answer".`);
      return;
    }

    const difficultyId = entry.difficultyId ?? bandFor(section)[0] ?? 2;
    const numeric = entry.numeric !== false;

    items.push(buildItem({ entry, index, section, topicId: pool.topicId, closed, answer, difficultyId, numeric }));
  });

  // ── the paper as a whole ────────────────────────────────────────────────
  // Checked with the SAME functions the builder's publish gate uses, so a file
  // that loads is a file that can be published.
  if (problems.length === 0) {
    const slots = quizSlotCount(items);
    if (slots !== RASCH_QUIZ_TOTAL) {
      problems.push(`The default paper has ${slots} questions but needs exactly ${RASCH_QUIZ_TOTAL}.`);
    }
    for (const gap of quizQuotaGaps(items)) {
      problems.push(`Row "${gap.sectionId}" has ${gap.have} question(s) but needs ${gap.want}.`);
    }
  }

  return {
    items,
    title: toLocalized(file?.title),
    durationMinutes: file?.durationMinutes && file.durationMinutes > 0 ? file.durationMinutes : 150,
    problems,
  };
}

/** Chapter / topic display names, straight from the bundled syllabus. */
function namesFor(topicId: string, chapterId: string): { topic: string; chapter: string } {
  const topic = getMathTopics().find((tp) => tp.topicId === topicId);
  return {
    topic: topic?.name ?? '',
    chapter: topic?.chapters.find((ch) => ch.chapterId === chapterId)?.name ?? '',
  };
}

function buildItem(args: {
  entry: DefaultPaperEntry;
  index: number;
  section: (typeof EXAM_BLUEPRINT)[number];
  topicId: string;
  closed: boolean;
  answer: string;
  difficultyId: DifficultyId;
  numeric: boolean;
}): RaschQuizItem {
  const { entry, index, section, topicId, closed, answer, difficultyId, numeric } = args;
  const names = namesFor(topicId, entry.chapterId);

  const options = closed
    ? (Object.fromEntries(
        OPTION_KEYS
          .filter((k) => entry.options?.[k] !== undefined)
          .map((k) => [k, toLocalized(entry.options?.[k])]),
      ) as QuestionDoc['options'])
    : ({} as QuestionDoc['options']);

  // ⚠️ Every optional field is spread conditionally — a `undefined` anywhere in
  // here reaches Firestore through `saveQuiz` and the whole write throws.
  return {
    id: `${DEFAULT_ITEM_PREFIX}${String(index + 1).padStart(2, '0')}`,
    number: String(index + 1),
    subjectId: topicId,
    subject: names.topic,
    topicId,
    topic: names.topic,
    subtopicId: '',
    subtopic: '',
    chapterId: entry.chapterId,
    chapter: names.chapter,
    difficultyId,
    difficulty: DIFF_KEY_BY_ID[difficultyId] ?? 'medium',
    question: toLocalized(entry.question),
    options,
    answer: answer as OptionKey,
    explanation: toLocalized(entry.explanation),
    solutions: [],
    tags: [],
    language: ['uz', 'ru', 'en'],

    sectionId: section.id,
    testType: section.testType,
    // `source: 'teacher'` is what makes `examMode` render by `qType` instead of
    // by the test type — the same path a hand-written question takes, and the
    // only one on which an O item shows a typed input rather than A–D buttons.
    source: 'teacher',
    qType: closed ? 'mcq' : numeric ? 'numeric' : 'open',
    ...(closed ? { optionKeys: OPTION_KEYS.filter((k) => k in options) } : {}),
    ...(!closed && entry.acceptedAnswers?.length ? { acceptedAnswers: entry.acceptedAnswers } : {}),
  };
}

// ─── loading it ─────────────────────────────────────────────────────────────

/**
 * Reads the file and builds the paper.
 *
 * ⚠️ A DYNAMIC import on purpose. The JSON carries 45 trilingual questions and
 * every teacher who opens the builder would otherwise download it, including the
 * majority who never press the button — this way webpack splits it into its own
 * chunk that is fetched on the first click and cached after.
 */
export async function loadDefaultPaper(): Promise<DefaultPaperBuild> {
  const mod = await import('@/data/rasch-default-paper.json');
  return buildDefaultPaper((mod.default ?? mod) as unknown as DefaultPaperFile);
}
