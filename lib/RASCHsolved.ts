// lib/RASCHsolved.ts
import { EXAM_BLUEPRINT, topicForChapter } from './Examblueprint';
import { getMathTopics } from './Mathstructure';
import { skillFor, type SkillKey } from './RASCHskills';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import { examChosen } from './ExamTeacher';
import type { ExamQuestion } from '@/types/Exam';
import type { Lang, LocalizedText, OptionKey, QuestionDoc } from '@/types/Math';

/**
 * The questions the student has actually solved, archived per topic in the
 * browser.
 *
 * Firestore is deliberately NOT involved. RASCH_attempts only records per-topic
 * totals — it has no per-question detail — so rebuilding "the problems I solved
 * in Geometriya" from the server would mean re-reading the question documents
 * (~45 per exam) every time the page is opened. Archiving them locally at
 * submission costs zero reads and zero writes.
 *
 * The trade-off, stated plainly: this history is per-device. Sign in on another
 * phone and the levels follow you (they live in RASCH_levels), but this list
 * starts empty. Making it follow the account means writing the questions into
 * the attempt document — a much bigger write, per exam — which is the opposite
 * of what we were asked for.
 */

const KEY = 'RASCHmodel:solved:v1';
const VERSION = 1;

/**
 * Per topic. Sixty is a few months' work — enough that the per-skill review can
 * page back through "+5 more" and still find something, while seven topics stay
 * well inside the localStorage quota (a question with three languages of text,
 * options and an explanation is ~1–2 KB, so the ceiling is roughly 400–800 KB).
 *
 * Raised from 20 when the review moved from "the last exam" to "my work on this
 * skill": twenty per DIMENSION is only two or three questions per SKILL, which
 * made every skill panel look empty.
 */
const CAP_PER_TOPIC = 60;

export interface SolvedQuestion {
  id: string;
  /** Epoch ms of the exam this came from. */
  examAt: number;
  chapter: string;
  subtopic: string;
  /**
   * The syllabus position, so a stored question can be resolved to the SKILL it
   * exercises (lib/RASCHskills.ts) without re-reading the question document.
   *
   * Optional because entries archived before this existed carry only the display
   * NAMES above — `resolveSolvedPosition` recovers the ids from those, so the
   * skill review works on old archives too. New entries always carry them.
   */
  topicId?: string;
  chapterId?: string;
  subtopicId?: string;
  testType: string;
  question: LocalizedText;
  /** Shared block statement, shown above the question (shared_options items). */
  stem?: LocalizedText | null;
  options: Record<OptionKey, LocalizedText>;
  answer: OptionKey;
  /** Prompt image (teacher_questions items only). */
  imageUrl?: string | null;
  explanation: LocalizedText;
  /** Plain-text answer for open (O) questions; undefined for closed ones. */
  expected?: string;
  /** What the student put down — an option key, or typed text for O. */
  given: string;
  correct: boolean;
  /** Question language at the time it was sat. */
  lang: Lang;
  /** Author of the question (teacher_questions items) — shown in review too. */
  creatorName?: string;
  /** Corrector's display name, if it was ever edited. */
  correctedBy?: string;
  /** Where it was answered. Absent on entries archived before drills were kept
   *  — those are all exams, so `undefined` reads as 'exam'. */
  kind?: 'exam' | 'practice';
}

interface Archive {
  version: number;
  byTopic: Record<string, SolvedQuestion[]>;
}

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedValue: Archive | null = null;

const EMPTY: Archive = { version: VERSION, byTopic: {} };

// localStorage is shared by every account on one browser, so the archive is
// namespaced per account — otherwise the "questions I solved" review shows
// student A's history to student B. The active account is set by each consuming
// page (setSolvedUser); '' is the signed-out bucket.
let activeUid = '';
const keyFor = (uid: string) => `${KEY}:${uid || 'anon'}`;

function emit() {
  for (const listener of listeners) listener();
}

/** Point the archive at the signed-in student. Call before reading or writing.
 *  Switching accounts drops the cache and notifies subscribers to re-read. */
export function setSolvedUser(uid: string | null | undefined): void {
  const u = uid || '';
  if (u === activeUid) return;
  activeUid = u;
  cachedRaw = null;
  cachedValue = null;
  emit();
}

export function subscribeSolved(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable reference across renders — useSyncExternalStore requires it. */
export function getSolvedArchive(): Archive {
  if (typeof window === 'undefined') return EMPTY;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(activeUid));
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw && cachedValue) return cachedValue;

  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Archive) : EMPTY;
    cachedValue = parsed.version === VERSION && parsed.byTopic ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

export function getServerSolvedArchive(): Archive {
  return EMPTY;
}

/** Newest first — the most recent attempt at a topic is what you want to review. */
export function solvedForTopic(topic: TopicKey): SolvedQuestion[] {
  return [...(getSolvedArchive().byTopic[topic] ?? [])].reverse();
}

export function solvedCounts(): Record<TopicKey, { solved: number; correct: number }> {
  const archive = getSolvedArchive();
  const out = {} as Record<TopicKey, { solved: number; correct: number }>;
  for (const key of TOPIC_KEYS) {
    const list = archive.byTopic[key] ?? [];
    out[key] = {
      solved: list.length,
      correct: list.filter((q) => q.correct).length,
    };
  }
  return out;
}

/**
 * Files one finished exam's questions under the topics they belong to.
 *
 * Called once per exam, alongside the Firestore save. Purely local, so it also
 * works for a signed-out student.
 */
export function archiveExam(params: {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  isCorrect: (q: ExamQuestion) => boolean;
  expectedFor: (q: ExamQuestion) => string | undefined;
  lang: Lang;
  at: number;
}): void {
  if (typeof window === 'undefined') return;

  const sectionTopic = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.topic]));
  const archive = getSolvedArchive();
  const byTopic: Record<string, SolvedQuestion[]> = { ...archive.byTopic };

  for (const q of params.questions) {
    const topic = sectionTopic.get(q.sectionId);
    if (!topic) continue;

    const entry: SolvedQuestion = {
      id: q.id,
      examAt: params.at,
      chapter: q.chapter,
      subtopic: q.subtopic,
      topicId: q.topicId,
      chapterId: q.chapterId,
      subtopicId: q.subtopicId,
      testType: q.testType,
      question: q.question,
      ...(q.stem ? { stem: q.stem } : {}),
      options: q.options,
      answer: q.answer,
      ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
      explanation: q.explanation,
      expected: params.expectedFor(q),
      // A block's answer lives under per-part keys — examChosen collapses them.
      given: examChosen(q, params.answers),
      correct: params.isCorrect(q),
      lang: params.lang,
      ...(q.creatorName ? { creatorName: q.creatorName } : {}),
      ...(q.correctedBy ? { correctedBy: q.correctedBy } : {}),
    };

    // Re-solving the same question replaces the old record rather than
    // duplicating it — the list is "how I did on this question", latest wins.
    const existing = (byTopic[topic] ?? []).filter((e) => e.id !== entry.id);
    byTopic[topic] = [...existing, entry].slice(-CAP_PER_TOPIC);
  }

  commit(byTopic);
}

/**
 * The same, for a finished practice drill.
 *
 * Practice used to be invisible here: only exams were archived, so a student who
 * drilled a skill ten times still saw "no questions stored" on that skill's
 * review. A drill is the work most worth reviewing — it is the attempt made
 * right after seeing the weakness.
 *
 * Practice draws straight from `questions1` (no sections), so the dimension is
 * recovered from the chapter through the blueprint, exactly as the practice save
 * path does for its item responses.
 */
export function archivePractice(params: {
  questions: QuestionDoc[];
  answers: Record<string, string>;
  lang: Lang;
  at: number;
}): void {
  if (typeof window === 'undefined') return;

  const archive = getSolvedArchive();
  const byTopic: Record<string, SolvedQuestion[]> = { ...archive.byTopic };

  for (const q of params.questions) {
    const topic = topicForChapter(q.topicId, q.chapterId);
    const given = params.answers[q.id] ?? '';

    const entry: SolvedQuestion = {
      id: q.id,
      examAt: params.at,
      chapter: q.chapter,
      subtopic: q.subtopic,
      topicId: q.topicId,
      chapterId: q.chapterId,
      subtopicId: q.subtopicId,
      testType: 'practice',
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      given,
      correct: given === q.answer,
      lang: params.lang,
      kind: 'practice',
    };

    const existing = (byTopic[topic] ?? []).filter((e) => e.id !== entry.id);
    byTopic[topic] = [...existing, entry].slice(-CAP_PER_TOPIC);
  }

  commit(byTopic);
}

/** Writes the archive back, tolerating a full quota. */
function commit(byTopic: Record<string, SolvedQuestion[]>): void {
  const next: Archive = { version: VERSION, byTopic };
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(keyFor(activeUid), raw);
    cachedRaw = raw;
    cachedValue = next;
    emit();
  } catch {
    // Quota exceeded — the exam/drill and the levels are unaffected; only this
    // review archive is lost. Never break a submission over it.
  }
}

// ─── Reading the archive by SKILL ────────────────────────────────────────────

/**
 * Recovers a stored question's syllabus ids.
 *
 * New entries carry them outright. Entries archived before that carry only the
 * display names, so they are looked up in the bundled syllabus — chapter names
 * are unique across both subjects, which makes the lookup unambiguous. Without
 * this the skill review would be empty for every student until their next exam.
 */
function resolveSolvedPosition(
  q: SolvedQuestion,
): { topicId: string; chapterId: string; subtopicId: string } | null {
  if (q.topicId && q.chapterId && q.subtopicId) {
    return { topicId: q.topicId, chapterId: q.chapterId, subtopicId: q.subtopicId };
  }
  const hit = nameIndex().get(`${q.chapter} ${q.subtopic}`);
  return hit ?? null;
}

let NAME_INDEX: Map<string, { topicId: string; chapterId: string; subtopicId: string }> | null = null;

/** Built lazily and once — the syllabus is bundled, so this costs no I/O. */
function nameIndex() {
  if (NAME_INDEX) return NAME_INDEX;
  const map = new Map<string, { topicId: string; chapterId: string; subtopicId: string }>();
  for (const topic of getMathTopics()) {
    for (const chapter of topic.chapters) {
      for (const sub of chapter.subtopics) {
        map.set(`${chapter.name} ${sub.name}`, {
          topicId: topic.topicId,
          chapterId: chapter.chapterId,
          subtopicId: sub.subtopicId,
        });
      }
    }
  }
  NAME_INDEX = map;
  return map;
}

export interface SolvedBySkill {
  /** FULL lists, newest first. The UI pages through them ("+5 more") — capping
   *  here would make "show more" impossible to implement honestly. */
  correct: SolvedQuestion[];
  wrong: SolvedQuestion[];
}

/**
 * The questions this skill was measured on, newest first, split by outcome.
 *
 * `scope: 'last'` keeps only the most recent sitting — "how did I do on the last
 * paper" — while 'all' spans everything the device has archived. Both are capped
 * for display; the uncapped totals ride along so the UI never implies the cap is
 * the whole story.
 */
export function solvedForSkill(
  skillKey: SkillKey,
  opts: { scope?: 'last' | 'all' } = {},
): SolvedBySkill {
  return split(
    Object.values(getSolvedArchive().byTopic).flat().filter((q) => {
      const pos = resolveSolvedPosition(q);
      return pos ? skillFor(pos.topicId, pos.chapterId, pos.subtopicId) === skillKey : false;
    }),
    opts.scope ?? 'all',
  );
}

/**
 * Newest first, split by outcome, optionally narrowed to the most recent sitting.
 *
 * A question re-answered later is archived once (latest wins), so the newest
 * `examAt` in a filtered set IS the last sitting that touched it — which is what
 * makes "last exam" meaningful per skill rather than only globally.
 */
function split(list: SolvedQuestion[], scope: 'last' | 'all'): SolvedBySkill {
  const scoped =
    scope === 'last' && list.length > 0
      ? (() => {
          const latest = Math.max(...list.map((q) => q.examAt));
          return list.filter((q) => q.examAt === latest);
        })()
      : list;

  const newestFirst = [...scoped].sort((a, b) => b.examAt - a.examAt);
  return {
    correct: newestFirst.filter((q) => q.correct),
    wrong: newestFirst.filter((q) => !q.correct),
  };
}

export function clearSolvedArchive(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(activeUid));
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedValue = null;
  emit();
}
