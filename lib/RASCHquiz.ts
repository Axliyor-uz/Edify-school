// lib/RASCHquiz.ts
//
// The pure layer of the teacher-built Rasch paper (docs/RASCH_QUIZ.md): turning a
// picked question into a stored quiz item, turning a stored quiz back into the
// exam items the runner renders, and the arithmetic the builder shows.
//
// No Firestore here — the service (services/teacherRaschQuizService.ts) owns
// every read and write, this file owns every rule. That split is what lets the
// builder recompute the blueprint picture on each keystroke for free.

import { EXAM_BLUEPRINT, sectionForChapter } from './Examblueprint';
import { examSlotCount, toExamItem, type ExamSlotMeta } from './ExamTeacher';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import { isClosedQuestion, isTextType } from '@/types/question';
import type { NormalizedQuestion } from '@/types/question';
import type { ExamQuestion, TestType } from '@/types/Exam';
import type { DifficultyId, Lang, QuestionDoc } from '@/types/Math';
import type { QuizTopicCounts, RaschQuizItem } from '@/types/TeacherRaschQuiz';

/**
 * A teacher paper is exactly 45 slots — the length of the Milliy sertifikat
 * paper, and the reason its result can go on the same chart and move the same
 * levels as a mock exam. A shorter paper measures a narrower slice of the seven
 * dimensions, so the builder refuses to PUBLISH below this (a draft may be any
 * length while it is being assembled).
 */
export const RASCH_QUIZ_TOTAL = 45;

/** Default clock. The teacher may change it; 0 is not offered. */
export const RASCH_QUIZ_DEFAULT_MINUTES = 150;

// ─── the access code ─────────────────────────────────────────────────────────

export const ACCESS_CODE_LENGTH = 6;

/** Six digits. Never starts a run of leading zeros being trimmed — it is a
 *  STRING everywhere, never parsed to a number. */
export function newAccessCode(): string {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += Math.floor(Math.random() * 10);
  return code;
}

/** Digits only, exactly six. Used by both the builder and the student's input. */
export function isValidAccessCode(code: string): boolean {
  return new RegExp(`^\\d{${ACCESS_CODE_LENGTH}}$`).test(code);
}

/** Keeps only digits and clamps the length — for an onChange handler. */
export function sanitizeAccessCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, ACCESS_CODE_LENGTH);
}

// ─── picking a question → a stored quiz item ─────────────────────────────────

/**
 * The test type a hand-picked question is filed under.
 *
 * On the mock exam the test type comes from the blueprint ROW being filled. A
 * teacher picks questions one at a time, so it is derived from the question,
 * under the protocol's own definitions:
 *
 *   • **O**   — an OPEN item: no options, the student types a short answer.
 *               ⚠️ **Every typed teacher question is O, whatever its difficulty.**
 *               "Open" is a property of how it is answered, not of how hard it
 *               is, so an easy typed question is still an O and never a Y.
 *               ⚠️ **A ko'p savolli BLOCK counts too.** A `multi_part` block
 *               ("Ko'p savolli ochiq test", e.g. 39-masala) is answered by
 *               typing into every part, so it is an O exactly like a flat typed
 *               question. Only a block whose parts all pick from options — a
 *               `shared_options` pool ("Ko'p savolli yopiq test", 33–35) or
 *               per-part option lists — stays closed.
 *   • **Y-2** — a CLOSED item, harder than Y-1 and requiring adaptation. The
 *               blueprint has exactly ONE Y-2 row: hard Geometriya, from the
 *               multi-step chapters. A hard question anywhere else is Y-1 —
 *               there is no row for it to be Y-2 in.
 *   • **Y-1** — every other closed item.
 *
 * ⚠️ A `questions1` item is NEVER filed as `O`. `examMode()` reads the test type
 * for a bank item (a teacher item goes by its own `qType`), so an `O` would hide
 * the A–D options the teacher picked the question FOR and demand a typed answer
 * graded against `solutions[].final_answer` the teacher never saw.
 */
function testTypeFor(params: { source: 'bank' | 'teacher'; difficultyId: number; typed: boolean }): TestType {
  if (params.source === 'teacher' && params.typed) return 'O';
  return params.difficultyId >= 3 ? 'Y-2' : 'Y-1';
}

/**
 * The blueprint row a hand-picked question goes in, or `null` when the protocol
 * has no row for it.
 *
 * ⚠️ Resolved from the chapter AND the type, not the chapter alone: Geometriya is
 * drawn at Y-1, Y-2 and O from the same chapters, so chapter-only filed every
 * open geometry question under `geometry-y1` — the wrong quota and the wrong
 * ball budget.
 *
 * Two asymmetric fallbacks, because the two directions mean different things:
 *
 *   • **A closed item always lands somewhere.** Wanting `Y-2` where there is no
 *     Y-2 row simply means it is a Y-1 question, and the row's own type then
 *     wins — an item must not print a type its row does not have.
 *   • **An open item has nowhere else to go.** `O` is how it is ANSWERED; filing
 *     it in a Y row would put a typed question in a closed slot, count it against
 *     a closed quota and price it in a closed row's budget. The blueprint has no
 *     open row for Sonlar or Algebraik, so an open question from those chapters
 *     is simply not placeable on a DTM paper — `null`, and the builder says so.
 */
export function sectionForItem(topicId: string, chapterId: string, wanted: TestType) {
  const section = sectionForChapter(topicId, chapterId, wanted);
  if (wanted === 'O' && section.testType !== 'O') return null;
  return section;
}

/** `sectionForItem`, in the shape `toExamItem` wants. Unplaceable ⇒ empty id. */
function slotMeta(topicId: string, chapterId: string, wanted: TestType): ExamSlotMeta {
  const section = sectionForItem(topicId, chapterId, wanted);
  if (!section) {
    // Kept as `O` on purpose: the item IS an open question, and `checkQuizAdd`
    // refuses it on the empty sectionId. Nothing writes it to Firestore.
    return { sectionId: '', sectionLabel: { uz: '', ru: '', en: '' }, testType: wanted };
  }
  return { sectionId: section.id, sectionLabel: section.label, testType: section.testType };
}

/**
 * A `questions1` document → a quiz item.
 *
 * The bank doc IS the legacy shape every ExamQuestion extends, so this is the
 * blueprint fields plus `source: 'bank'` — no normalization, no bridging.
 */
export function bankQuizItem(q: QuestionDoc): RaschQuizItem {
  const wanted = testTypeFor({ source: 'bank', difficultyId: q.difficultyId, typed: false });
  const { sectionId, testType } = slotMeta(q.topicId, q.chapterId, wanted);
  return { ...q, sectionId, testType, source: 'bank' };
}

/**
 * A `teacher_questions` document → a quiz item.
 *
 * Runs through the SAME `toExamItem` the mock exam's teacher slots use, so
 * images, `shared_options` / `multi_part` blocks and the question_topics →
 * questions1 taxonomy bridge all behave identically on a hand-built paper.
 */
export function teacherQuizItem(n: NormalizedQuestion): RaschQuizItem {
  // ⚠️ A block is typed unless EVERY part is answered by picking an option —
  // `isClosedQuestion` is the same rule the picker's closed/typed badge and its
  // kind filter use, so the badge and the row an add lands in cannot disagree.
  // (Before 2026-07-29 a block was excluded outright, which filed an open
  // "Ko'p savolli ochiq test" under a Y row.)
  const typed = n.isBlock ? !isClosedQuestion(n) : isTextType(n.type);
  // The bridge lives inside toExamItem, so the section can only be resolved from
  // the ids it produces — build the item first with a placeholder, then re-file
  // it. Cheap: it is a pure object build, not a read.
  const probe = toExamItem(n, { sectionId: '', sectionLabel: { uz: '', ru: '', en: '' }, testType: 'Y-1' });
  const wanted = testTypeFor({ source: 'teacher', difficultyId: probe.difficultyId, typed });
  const { sectionId, testType } = slotMeta(probe.topicId, probe.chapterId, wanted);

  return stripPosition({ ...probe, sectionId, testType });
}

/** Drops the two POSITION fields — both are recomputed by `hydrateQuiz`. */
function stripPosition(q: ExamQuestion): RaschQuizItem {
  const item = { ...q } as Partial<ExamQuestion>;
  delete item.slotNumber;
  delete item.sectionLabel;
  return item as RaschQuizItem;
}

/**
 * Strips what nothing renders, before the item is written into the quiz doc.
 *
 * A Firestore document is capped at 1 MiB and this one holds 45 questions.
 * `solutions[].steps` is by far the biggest field on a bank doc and the runner
 * only ever reads `final_answer` (which grades an open item), so the steps go —
 * exactly what the localStorage snapshot already does for the same reason.
 */
export function slimQuizItem(q: RaschQuizItem): RaschQuizItem {
  const finalAnswer = q.solutions?.[0]?.final_answer;
  return {
    ...q,
    solutions: finalAnswer ? [{ final_answer: finalAnswer, method: '', steps: [] }] : [],
    tags: [],
    language: [],
  };
}

/**
 * Rough serialized size of a paper, in bytes.
 *
 * The builder shows it and the service refuses to write past the ceiling. A
 * 1 MiB write that fails at question 45 after an hour of picking is the single
 * worst failure this feature can have, so it is surfaced while there is still
 * something the teacher can do about it.
 */
export function quizByteSize(items: RaschQuizItem[]): number {
  return new Blob([JSON.stringify(items)]).size;
}

/** Firestore's hard document limit is 1 MiB; leave room for the rest of the doc. */
export const QUIZ_MAX_BYTES = 900_000;

// ─── a stored quiz → the paper the runner renders ────────────────────────────

/**
 * Stamps slot numbers and rehydrates the trilingual section labels.
 *
 * Slot numbers are NOT stored: a `shared_options` block occupies one slot per
 * sub-question, so inserting or reordering a single question renumbers every
 * question after it. Deriving them on load means the stored array is the only
 * thing that has to be right.
 */
export function hydrateQuiz(items: RaschQuizItem[]): ExamQuestion[] {
  const labels = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.label]));
  const fallback = EXAM_BLUEPRINT[0].label;

  let nextSlot = 1;
  return items.map((item) => {
    const q: ExamQuestion = {
      ...item,
      slotNumber: nextSlot,
      sectionLabel: labels.get(item.sectionId) ?? fallback,
    };
    nextSlot += examSlotCount(q);
    return q;
  });
}

/** Exam SLOTS on a paper — a `shared_options` block counts once per part. */
export function quizSlotCount(items: RaschQuizItem[]): number {
  return hydrateQuiz(items).reduce((sum, q) => sum + examSlotCount(q), 0);
}

/** `sectionId` → levelling dimension. Built once; the blueprint is a constant. */
const SECTION_TOPIC: Map<string, TopicKey> = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.topic]));

/** Slots per dimension, for the builder's coverage panel. */
export function quizTopicCounts(items: RaschQuizItem[]): QuizTopicCounts {
  const counts: QuizTopicCounts = {};
  for (const q of hydrateQuiz(items)) {
    const topic = SECTION_TOPIC.get(q.sectionId);
    if (!topic) continue;
    counts[topic] = (counts[topic] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/** The dimension one stored item is filed under. `null` = an unknown `sectionId`. */
export function quizItemTopic(item: RaschQuizItem): TopicKey | null {
  return SECTION_TOPIC.get(item.sectionId) ?? null;
}

/**
 * The dimension a `questions1` chapter would count against — what the bank
 * picker's chapter dropdown shows the quota for, BEFORE anything is read.
 *
 * Goes through `sectionForChapter`, the same resolver `bankQuizItem` uses, so
 * the number on the dropdown is the number the pick will actually move.
 */
export function topicForQuizChapter(topicId: string, chapterId: string): TopicKey | null {
  return SECTION_TOPIC.get(sectionForChapter(topicId, chapterId).id) ?? null;
}

/**
 * Slots ONE item costs. A stored item carries no position (both fields are
 * derived by `hydrateQuiz`), so they are stubbed in just for the count.
 */
export function quizItemSlots(item: RaschQuizItem): number {
  return examSlotCount({ ...item, slotNumber: 0, sectionLabel: { uz: '', ru: '', en: '' } });
}

/** Slots per difficulty grade (1 easy / 2 medium / 3 hard), for the same panel. */
export function quizDifficultyCounts(items: RaschQuizItem[]): Record<DifficultyId, number> {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyId, number>;
  for (const q of hydrateQuiz(items)) {
    counts[q.difficultyId] = (counts[q.difficultyId] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/**
 * How the mock exam's 45 slots are shared out — and, since a teacher paper is
 * scored into the SAME seven dimensions on the SAME 0–5 scale, the quota each
 * dimension must hit exactly. Kept for display: the panel still reports per
 * dimension, because that is what a student is levelled on.
 */
export const BLUEPRINT_TOPIC_TARGET: Record<TopicKey, number> = (() => {
  const target = {} as Record<TopicKey, number>;
  for (const key of TOPIC_KEYS) target[key] = 0;
  for (const section of EXAM_BLUEPRINT) target[section.topic] += section.count;
  return target;
})();

/**
 * ⚠️ **The real quota is per blueprint ROW, not per dimension.**
 *
 * A row is a dimension × test type: Geometriya needs 7 Y-1 **and** 3 Y-2 **and**
 * 4 O, and 14 geometry questions of the wrong types is not the same paper. The
 * dimension total was the first cut of this rule and let a teacher build 14
 * closed geometry questions, which measures something the national paper does
 * not — and leaves the O rows, the only ones that ask a student to *produce* an
 * answer, empty.
 *
 * ⚠️ A `questions1` item is never filed as `O` (`testTypeFor`), so the five O
 * rows can ONLY be filled by the teacher's own typed questions. The builder says
 * so rather than letting them hunt through a bank that cannot contain one.
 */
export const BLUEPRINT_SECTION_TARGET: Record<string, number> = Object.fromEntries(
  EXAM_BLUEPRINT.map((s) => [s.id, s.count]),
);

/** Slots per blueprint row, for the builder's coverage panel. */
export function quizSectionCounts(items: RaschQuizItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of hydrateQuiz(items)) {
    counts[q.sectionId] = (counts[q.sectionId] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/** Why an add was refused — the builder turns each into its own message. */
export type QuizAddCheck =
  | { ok: true; slots: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'full'; slots: number }
  | { ok: false; reason: 'sectionFull'; slots: number; sectionId: string; have: number; want: number }
  | { ok: false; reason: 'noSlot'; slots: number; testType: TestType };

/**
 * May this item join the paper?
 *
 * ⚠️ **A block is added whole or not at all.** A `shared_options` block occupies
 * one slot per sub-question, so a block that would overshoot its row's quota is
 * refused entirely — truncating it would break the shared pool it is printed
 * with.
 *
 * An item whose `sectionId` is not in the blueprint has no quota to check
 * against and is judged on the 45-slot total alone; `sectionForChapter` makes
 * that unreachable from either picker, and `toItemResponses` would file it under
 * the wrong dimension anyway (see docs/RASCH_QUIZ.md).
 */
export function checkQuizAdd(items: RaschQuizItem[], item: RaschQuizItem): QuizAddCheck {
  if (items.some((q) => q.id === item.id)) return { ok: false, reason: 'duplicate' };

  const slots = quizItemSlots(item);
  if (quizSlotCount(items) + slots > RASCH_QUIZ_TOTAL) return { ok: false, reason: 'full', slots };

  const want = BLUEPRINT_SECTION_TARGET[item.sectionId];
  // ⚠️ No row ⇒ refused, not waved through on the 45-slot count. The only way to
  // get here is an OPEN question from a dimension the protocol gives no open row
  // (Sonlar, Algebraik): there is no slot on a DTM paper for it, and letting it
  // in would put a typed question in a closed row's quota and ball budget.
  if (typeof want !== 'number') return { ok: false, reason: 'noSlot', slots, testType: item.testType };

  const have = quizSectionCounts(items)[item.sectionId] ?? 0;
  if (have + slots > want) {
    return { ok: false, reason: 'sectionFull', slots, sectionId: item.sectionId, have, want };
  }

  return { ok: true, slots };
}

/** Blueprint rows that are not exactly at quota — empty means publishable. */
export function quizQuotaGaps(items: RaschQuizItem[]): { sectionId: string; have: number; want: number }[] {
  const counts = quizSectionCounts(items);
  return EXAM_BLUEPRINT
    .map((s) => ({ sectionId: s.id, have: counts[s.id] ?? 0, want: s.count }))
    .filter((row) => row.have !== row.want);
}

/** Preview text for a builder row — the paper is trilingual, the list is not. */
export function itemPreview(q: RaschQuizItem, lang: Lang, max = 110): string {
  const raw = q.question?.[lang] || q.question?.uz || q.question?.ru || q.question?.en || '';
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Fisher–Yates over CARDS — a block is never split apart by shuffling. */
export function shuffleItems(items: RaschQuizItem[]): RaschQuizItem[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
