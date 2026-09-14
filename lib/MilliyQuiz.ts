// lib/MilliyQuiz.ts
//
// The pure layer of the teacher-built **Milliy sertifikat subject paper** for the
// non-maths subjects (docs/MILLIY_QUIZ.md): the subject registry, turning a
// picked question into a stored item, turning a stored paper back into the exam
// items the runner renders, and the arithmetic the builder shows.
//
// No Firestore here — services/milliyQuizService.ts owns every read and write,
// this file owns every rule. That split is what lets the builder recompute its
// whole picture on each keystroke for free.
//
// ⚠️ **Maths is not served by this file.** See types/MilliyQuiz.ts for why the
// maths paper stays in the Rasch subsystem, and `MILLIY_SUBJECTS` below for how
// the hub routes it.

import { examSlotCount, toExamItem, type ExamSlotMeta } from './ExamTeacher';
import { isClosedQuestion, isTextType } from '@/types/question';
import type { NormalizedQuestion } from '@/types/question';
import type { ExamQuestion, TestType } from '@/types/Exam';
import type { DifficultyId, Lang, LocalizedText } from '@/types/Math';
import type { MilliyQuizItem, MilliySubjectId } from '@/types/MilliyQuiz';

// ─── the subject registry ────────────────────────────────────────────────────

/**
 * How a subject reaches a paper builder.
 *
 * - **`rasch`** — maths. Delegates to `app/teacher/milliy-sertifikat/math` and the
 *   `teacher_rasch_quizzes` collection: that IS the 45-question DTM blueprint
 *   paper (docs/RASCH_QUIZ.md), so re-implementing it here would be two builders
 *   and two runners for one exam.
 * - **`generic`** — this subsystem: a teacher-declared number of questions drawn
 *   from the teacher's own bank, stored in `milliy_quizzes`, with no blueprint
 *   quota and no ability model.
 * - **`soon`** — announced, not built. The hub renders it inert.
 */
export type MilliySubjectKind = 'rasch' | 'generic' | 'soon';

export interface MilliySubject {
  /** Route segment, and the `subject` field stored on a paper. */
  id: MilliySubjectId | 'math';
  kind: MilliySubjectKind;
  name: LocalizedText;
  /**
   * The `data/question_topics.json` subject id whose questions this paper draws
   * from. `null` for a subject with no taxonomy yet (and for maths, which draws
   * from two — algebra and geometriya — through the Rasch builder).
   */
  taxonomySlug: string | null;
  /** Where the hub sends the teacher. `null` ⇒ the card is inert. */
  href: string | null;
  /** The paper length the builder starts from. The teacher may change it. */
  defaultQuestions: number;
  defaultMinutes: number;
}

/**
 * ⚠️ **The single source of truth for "which Milliy sertifikat subjects exist".**
 * The teacher hub, the student hub and the builder all read this list — a subject
 * added in one place and not the others is the bug this registry prevents.
 *
 * To add a subject: append its taxonomy to `data/question_topics.json` (see
 * `scripts/addBiologyTopics.mjs` for the reviewable way), then flip its entry
 * here from `soon` to `generic` with the right `taxonomySlug`. Nothing else has
 * to move — the builder, the student runner and the results page are generic.
 */
export const MILLIY_SUBJECTS: MilliySubject[] = [
  {
    id: 'math',
    kind: 'rasch',
    name: { uz: 'Matematika', ru: 'Математика', en: 'Mathematics' },
    taxonomySlug: null,
    href: '/teacher/milliy-sertifikat/math',
    defaultQuestions: 45,
    defaultMinutes: 150,
  },
  {
    id: 'biologiya',
    kind: 'generic',
    name: { uz: 'Biologiya', ru: 'Биология', en: 'Biology' },
    taxonomySlug: 'biologiya',
    href: '/teacher/milliy-sertifikat/biologiya',
    defaultQuestions: 30,
    defaultMinutes: 90,
  },
  {
    id: 'kimyo',
    kind: 'generic',
    name: { uz: 'Kimyo', ru: 'Химия', en: 'Chemistry' },
    taxonomySlug: 'kimyo',
    href: '/teacher/milliy-sertifikat/kimyo',
    // ⚠️ 40 / 100, NOT the programme's 43 / 180. The DTM chemistry paper is two
    // parts: #1–40 (closed + short typed) in 100 minutes, then #41–43 extended
    // WRITTEN work in 80 more, marked by a human against per-step M/A criteria
    // out of 25 balls each. This subsystem auto-grades, so it serves part 1 —
    // the whole of what can be machine-marked — and the defaults say so rather
    // than promising a 43-question paper it cannot score. See docs/MILLIY_QUIZ.md.
    defaultQuestions: 40,
    defaultMinutes: 100,
  },
  {
    id: 'fizika',
    kind: 'generic',
    name: { uz: 'Fizika', ru: 'Физика', en: 'Physics' },
    taxonomySlug: 'fizika',
    href: '/teacher/milliy-sertifikat/fizika',
    // ⚠️ 35 / 100 is THIS REPO's default, not a national spec. No physics
    // blueprint is encoded anywhere here (maths has `EXAM_BLUEPRINT`; nothing
    // equivalent exists for physics), so rather than invent one these match
    // `data/physics-default-paper.json` — pressing "Namunaviy variant" then
    // fills the builder to exactly its target instead of overshooting it.
    defaultQuestions: 35,
    defaultMinutes: 100,
  },
  {
    id: 'ona-tili',
    kind: 'generic',
    name: { uz: 'Ona tili', ru: 'Родной язык', en: 'Uzbek language' },
    taxonomySlug: 'ona-tili',
    href: '/teacher/milliy-sertifikat/ona-tili',
    // ⚠️ **Ona tili, NOT "ona tili va adabiyot".** The taxonomy has no literature
    // topic on purpose (scripts/addNativeLanguageTopics.mjs) — literature is its
    // own subject with its own texts, and filing it under a grammar section
    // would put a second subject inside this one's per-topic report.
    // 30 / 90 matches `data/ona-tili-default-paper.json`, same reasoning as fizika.
    defaultQuestions: 30,
    defaultMinutes: 90,
  },
  {
    id: 'ingliz',
    kind: 'soon',
    name: { uz: 'Ingliz tili', ru: 'Английский язык', en: 'English' },
    taxonomySlug: null,
    href: null,
    defaultQuestions: 30,
    defaultMinutes: 90,
  },
];

export const findMilliySubject = (id: string): MilliySubject | undefined =>
  MILLIY_SUBJECTS.find((s) => s.id === id);

/**
 * The subject of a `[subject]` route segment, or `null` when that segment is not
 * a built generic subject.
 *
 * ⚠️ Rejects `math` on purpose: `/teacher/milliy-sertifikat/math` must not open a
 * second, empty maths builder against the wrong collection. The hub links maths
 * straight to the Rasch flow.
 */
export function genericSubject(segment: string): MilliySubject | null {
  const subject = findMilliySubject(segment);
  return subject && subject.kind === 'generic' ? subject : null;
}

export const subjectName = (subject: MilliySubject, lang: Lang): string =>
  subject.name[lang] || subject.name.uz;

/**
 * Where a STUDENT goes for this subject. `null` ⇒ not built, render the card inert.
 *
 * ⚠️ Maths lands on `/raschmodel`, the existing Rasch suite — that suite IS the
 * Milliy sertifikat maths section (its own level chart, practice, diagnosis and
 * code page), so the hub adopts it rather than replacing it. `MilliySubject.href`
 * is the TEACHER's destination and is a different route; keeping them as two
 * functions is what stops one being used for the other.
 */
export function studentSubjectHref(subject: MilliySubject): string | null {
  if (subject.kind === 'rasch') return '/raschmodel';
  if (subject.kind === 'generic') return `/milliy-sertifikat/${subject.id}`;
  return null;
}

// ─── picking a question → a stored paper item ────────────────────────────────

/**
 * Where a stored item claims to sit. There is **no blueprint** for these
 * subjects, so `sectionId` is the question's own topic slug — which is what the
 * results page groups by — and `testType` records only how the item is ANSWERED.
 *
 * ⚠️ `testType` is NOT a difficulty band here (it is on the maths paper, where
 * `DIFFICULTY_BAND` maps Y-1→medium / Y-2→hard). For these subjects it is `'O'`
 * for a typed item and `'Y-1'` for a closed one, and nothing reads it to decide
 * rendering: every item is `source: 'teacher'`, so `examMode` goes by the
 * question's own `qType`. It is stored for the results page's closed/typed split.
 */
function slotMeta(n: NormalizedQuestion, typed: boolean): ExamSlotMeta {
  return {
    sectionId: n.topicId || '',
    sectionLabel: { uz: n.topic || '', ru: n.topic || '', en: n.topic || '' },
    testType: (typed ? 'O' : 'Y-1') as TestType,
  };
}

/**
 * A `teacher_questions` document → a stored paper item.
 *
 * Runs through the SAME `toExamItem` the maths paper and the mock exam use, so
 * images, `shared_options` / `multi_part` blocks and typed answers behave
 * identically here. ⚠️ `toExamItem`'s taxonomy bridge (`bankIds`) only knows
 * algebra and geometriya; for any other subject it falls back to the document's
 * own ids, which is exactly what these papers want — there is no questions1
 * mirror to bridge to.
 */
export function milliyQuizItem(n: NormalizedQuestion): MilliyQuizItem {
  // ⚠️ A block is typed unless EVERY part is answered by picking an option —
  // `isClosedQuestion` is the same rule the picker's closed/typed badge uses, so
  // the badge and the stored `testType` cannot disagree.
  const typed = n.isBlock ? !isClosedQuestion(n) : isTextType(n.type);
  return stripPosition(toExamItem(n, slotMeta(n, typed)));
}

/** Drops the two POSITION fields — both are recomputed by `hydrateMilliyQuiz`. */
function stripPosition(q: ExamQuestion): MilliyQuizItem {
  const item = { ...q } as Partial<ExamQuestion>;
  delete item.slotNumber;
  delete item.sectionLabel;
  return item as MilliyQuizItem;
}

/**
 * Strips what nothing renders, before the item goes into the paper document.
 *
 * A Firestore document is capped at 1 MiB and this one holds the whole paper.
 * `solutions[].steps` is by far the biggest field and only `final_answer` is ever
 * read (to grade a typed item) — exactly what the localStorage snapshot and
 * `slimQuizItem` already do, for the same reason.
 */
export function slimMilliyItem(q: MilliyQuizItem): MilliyQuizItem {
  const finalAnswer = q.solutions?.[0]?.final_answer;
  return {
    ...q,
    solutions: finalAnswer ? [{ final_answer: finalAnswer, method: '', steps: [] }] : [],
    tags: [],
    language: [],
  };
}

/** Firestore's hard document limit is 1 MiB; leave room for the rest of the doc. */
export const MILLIY_MAX_BYTES = 900_000;

/**
 * Rough serialized size of a paper, in bytes.
 *
 * The builder shows it against the ceiling and the service refuses to write past
 * it. A 1 MiB write that fails after an hour of picking is the single worst thing
 * this feature could do to a teacher, so it is surfaced while there is still
 * something they can do about it.
 */
export function milliyByteSize(items: MilliyQuizItem[]): number {
  return new Blob([JSON.stringify(items)]).size;
}

// ─── a stored paper → the paper the runner renders ───────────────────────────

/**
 * Stamps slot numbers and rehydrates the section labels.
 *
 * Slot numbers are NOT stored: a `shared_options` block occupies one slot per
 * sub-question, so inserting or reordering a single question renumbers every
 * question after it. Deriving them on load means the stored array is the only
 * thing that has to be right.
 *
 * ⚠️ Unlike `hydrateQuiz`, this must NOT fall back to `EXAM_BLUEPRINT[0].label` —
 * that is a maths dimension name, and printing "Sonlar" on a biology question
 * would be worse than printing nothing.
 */
export function hydrateMilliyQuiz(items: MilliyQuizItem[]): ExamQuestion[] {
  let nextSlot = 1;
  return items.map((item) => {
    const label = item.topic || '';
    const q: ExamQuestion = {
      ...item,
      slotNumber: nextSlot,
      sectionLabel: { uz: label, ru: label, en: label },
    };
    nextSlot += examSlotCount(q);
    return q;
  });
}

/** Exam SLOTS on a paper — a `shared_options` block counts once per part. */
export function milliySlotCount(items: MilliyQuizItem[]): number {
  return hydrateMilliyQuiz(items).reduce((sum, q) => sum + examSlotCount(q), 0);
}

/**
 * Slots ONE item costs. A stored item carries no position (both fields are
 * derived by `hydrateMilliyQuiz`), so they are stubbed in just for the count.
 */
export function milliyItemSlots(item: MilliyQuizItem): number {
  return examSlotCount({ ...item, slotNumber: 0, sectionLabel: { uz: '', ru: '', en: '' } });
}

/** Slots per topic slug, for the builder's coverage list and the results page. */
export function milliyTopicCounts(items: MilliyQuizItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of hydrateMilliyQuiz(items)) {
    const key = q.sectionId || q.topicId || '';
    counts[key] = (counts[key] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/** Slots per difficulty grade, for the builder's balance strip. */
export function milliyDifficultyCounts(items: MilliyQuizItem[]): Record<DifficultyId, number> {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyId, number>;
  for (const q of hydrateMilliyQuiz(items)) {
    counts[q.difficultyId] = (counts[q.difficultyId] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/** Closed vs typed slots — the only structural split these papers have. */
export function milliyKindCounts(items: MilliyQuizItem[]): { closed: number; open: number } {
  let closed = 0;
  let open = 0;
  for (const q of hydrateMilliyQuiz(items)) {
    const slots = examSlotCount(q);
    if (q.testType === 'O') open += slots;
    else closed += slots;
  }
  return { closed, open };
}

// ─── the add check ───────────────────────────────────────────────────────────

/** Why an add was refused — the builder turns each into its own message. */
export type MilliyAddCheck =
  | { ok: true; slots: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'full'; slots: number };

/**
 * May this item join the paper?
 *
 * ⚠️ **A block is added whole or not at all.** A `shared_options` block occupies
 * one slot per sub-question, so one that would overshoot the declared length is
 * refused entirely — truncating it would break the shared pool it is printed
 * with.
 *
 * There is deliberately **no per-section quota** (the maths paper has 13 of them,
 * from a blueprint that exists). Inventing quotas for biology would refuse a
 * teacher's question on the authority of a spec this repo does not have.
 */
export function checkMilliyAdd(
  items: MilliyQuizItem[],
  item: MilliyQuizItem,
  target: number,
): MilliyAddCheck {
  if (items.some((q) => q.id === item.id)) return { ok: false, reason: 'duplicate' };

  const slots = milliyItemSlots(item);
  if (milliySlotCount(items) + slots > target) return { ok: false, reason: 'full', slots };

  return { ok: true, slots };
}

/** Preview text for a builder row — the paper is trilingual, the list is not. */
export function milliyItemPreview(q: MilliyQuizItem, lang: Lang, max = 110): string {
  const raw = q.question?.[lang] || q.question?.uz || q.question?.ru || q.question?.en || '';
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Fisher–Yates over CARDS — a block is never split apart by shuffling. */
export function shuffleMilliyItems(items: MilliyQuizItem[]): MilliyQuizItem[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Ids already on the paper — the picker greys those rows out. */
export const milliyPickedIds = (items: MilliyQuizItem[]): Set<string> =>
  new Set(items.map((q) => q.id));
