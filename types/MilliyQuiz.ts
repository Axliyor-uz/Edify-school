// types/MilliyQuiz.ts
//
// A teacher-built **Milliy sertifikat subject paper** for the subjects that are
// NOT maths: biology, chemistry, physics and ona tili today, English next.
// Contract + traps: docs/MILLIY_QUIZ.md.
//
// ⚠️ **Maths does not use these types.** The Milliy sertifikat maths paper is the
// 45-question DTM blueprint paper that `teacher_rasch_quizzes` already stores
// (docs/RASCH_QUIZ.md) — it is sat in the same runner, but it is scored by the
// Rasch ability model into `RASCH_levels/{uid}`. This subsystem deliberately has
// NO ability model: `questions1` only holds algebra and geometry, there is no
// blueprint for biology, and `RASCH_TOPICS` are the seven MATHS dimensions. A
// biology sitting that wrote a θ would be inventing a measurement.
//
// ⚠️ Questions are stored as EMBEDDED SNAPSHOTS, not refs — the same trade
// `teacher_rasch_quizzes` and `custom_tests.questions[]` make. A ref list would
// cost one read per question per student per sitting; the snapshot makes a whole
// paper ONE read however many students sit it, and freezes the question so
// editing the source later can never re-key a paper somebody already answered.
// The cost is that a fixed paper does not pick up a correction.

import type { Lang } from './Math';
import type { ExamQuestion } from './Exam';

/**
 * Which subject a paper belongs to — the route segment, and the value stored on
 * the document. Kept as a plain string union so adding a subject is one entry in
 * `MILLIY_SUBJECTS` ([lib/MilliyQuiz.ts](../lib/MilliyQuiz.ts)) plus its taxonomy
 * in `data/question_topics.json`.
 *
 * ⚠️ `'math'` is NOT in this union on purpose — it lives in the Rasch subsystem.
 */
export type MilliySubjectId = 'biologiya' | 'kimyo' | 'fizika' | 'ona-tili' | 'ingliz';

/**
 * One stored question — an `ExamQuestion` minus the two fields that are POSITION
 * rather than content, exactly as `RaschQuizItem` does it:
 *
 * - **`slotNumber`** — a `shared_options` block occupies one slot per
 *   sub-question, so inserting or reordering one question renumbers every
 *   question after it. `hydrateMilliyQuiz` stamps them on load.
 * - **`sectionLabel`** — a trilingual label that would otherwise be repeated on
 *   every item. Rehydrated from the subject on load.
 */
export type MilliyQuizItem = Omit<ExamQuestion, 'slotNumber' | 'sectionLabel'>;

export type MilliyQuizStatus = 'draft' | 'published' | 'closed';

export interface MilliyQuiz {
  id: string;
  /** The subject this paper belongs to. Every client query filters on it. */
  subject: MilliySubjectId;

  title: string;
  description: string;

  teacherId: string;
  teacherName: string;

  /**
   * SIX DIGITS, e.g. `"482913"` — typeable on a phone number pad and readable
   * aloud. ⚠️ A **string** everywhere: `"048213"` parsed as a number loses its
   * leading zero and stops matching.
   *
   * ⚠️ Uniqueness is checked ACROSS BOTH paper collections at generation time
   * (`reserveMilliyCode`), because the student types one code into one box and it
   * has to resolve to exactly one paper. It is still a check, not a constraint —
   * see docs/MILLIY_QUIZ.md.
   */
  accessCode: string;

  /** The paper, in the order the student sees it (before optional shuffling). */
  questions: MilliyQuizItem[];
  /** Exam SLOTS on the paper — a `shared_options` block is worth one per part. */
  questionCount: number;
  /**
   * How many slots this paper is MEANT to have — the teacher's own declared
   * length, set when they build it.
   *
   * ⚠️ **This is not a national spec.** The maths paper's 45 comes from the DTM
   * blueprint, which exists in this repo (`EXAM_BLUEPRINT`); no such published
   * blueprint is encoded for biology, so rather than invent one, the teacher
   * declares the length and publishing checks the paper against THAT. Change the
   * default in `MILLIY_SUBJECTS`, not here.
   */
  questionTarget: number;

  /** 0 is not allowed — a paper is sat against a clock. */
  durationMinutes: number;
  /** Shuffle the question order per student. Blocks stay intact either way. */
  shuffle: boolean;
  /** Reveal correct answers + explanations on the results screen. */
  showAnswers: boolean;

  status: MilliyQuizStatus;

  /** Firestore serverTimestamp. */
  createdAt: unknown | null;
  updatedAt: unknown | null;
}

/** What the builder holds before it is written (no id, no timestamps). */
export type MilliyQuizDraft = Omit<MilliyQuiz, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * One student's sitting — `milliy_quiz_results/{quizId}_{uid}`.
 *
 * The id is deterministic so a **retake overwrites** rather than accumulating —
 * the same rule `attempts/{uid}_{assignmentId}` and `teacher_rasch_results`
 * follow, and the same reason: "how did this class do" is a per-student question
 * that goes wrong the moment somebody sits twice.
 *
 * `teacherId` is denormalized because the read RULE proves ownership off it (the
 * teacher lists results with `where('teacherId','==',uid)`).
 */
export interface MilliyQuizResult {
  quizId: string;
  quizTitle: string;
  /** Denormalized so the student's sat-papers list can group without a read. */
  subject: MilliySubjectId;
  teacherId: string;

  studentId: string;
  studentName: string;

  /** Slots correct / slots on the paper. Not cards — see `questionCount`. */
  correct: number;
  total: number;
  percent: number;
  durationSec: number;
  /** Epoch ms — matches every other exam-side timestamp (docs/DATA_MODEL.md). */
  submittedAt: number;

  /** The question language the student sat it in. */
  examLang: Lang;

  /**
   * Per-SLOT outcome: `1` right, `0` wrong. Keyed by **`examSlotKeys`**
   * ([lib/ExamTeacher.ts](../lib/ExamTeacher.ts)) — the one place that vocabulary
   * is defined — so a `shared_options` block appears once per sub-question,
   * exactly as the paper numbers it.
   *
   * It is what lets the teacher's results page show a per-question solve rate at
   * **no extra read**: every sitting is already fetched in one query.
   *
   * ⚠️ It is an OUTCOME map, never an answer map — it records whether each slot
   * was right, never what the student put. And it drives `ExamReview`'s replay
   * mode, whose keys are `id#partId`, NOT the `id::partId` of the answers map.
   *
   * ⚠️ Optional and additive-only: a sitting written by an older client has none
   * and must keep working (it is excluded from the statistics rather than counted
   * as wrong).
   */
  items?: Record<string, number>;

  /**
   * Per-topic raw counts, keyed by the question_topics **topic slug** (e.g.
   * `sitologiya-genetika-va-seleksiya-asoslari`), so the teacher can see which
   * section of the programme the class is weak on.
   *
   * ⚠️ Raw counts ONLY — deliberately not an ability estimate. There is no
   * calibrated item difficulty for these subjects, so a θ here would be a
   * number with nothing behind it. A topic the paper never touched is ABSENT
   * from the map, never `{correct: 0, total: 0}`.
   */
  topics?: Record<string, { correct: number; total: number }>;
}
