// types/TeacherRaschQuiz.ts
//
// A teacher-built Rasch paper: 45 questions the teacher picked or wrote, opened
// by a private 6-digit code, sat in the student Rasch runner and scored by the
// same ability model as the mock exam. Contract + traps: docs/RASCH_QUIZ.md.
//
// ⚠️ Questions are stored as EMBEDDED SNAPSHOTS, not as refs.
//
// A ref list would mean 45 document reads per student per sitting, plus a read
// rule wide enough to serve them; the snapshot makes the whole paper ONE read no
// matter how many students sit it, and it freezes the question the way
// `custom_tests.questions[]` already does — editing a source question later can
// never re-key a paper somebody has already answered. The cost is that a fixed
// paper does not pick up a correction; that is the intended trade (see the doc).

import type { Lang } from './Math';
import type { ExamQuestion } from './Exam';
import type { TopicKey } from '@/lib/RASCHtopics';
import type { TopicScore } from './RASCH';

/**
 * One stored question.
 *
 * It is an `ExamQuestion` minus the two fields that are POSITION rather than
 * content: `slotNumber` (recomputed on load, because a `shared_options` block
 * occupies several slots and reordering the paper moves every number after it)
 * and `sectionLabel` (a trilingual label that would be repeated 45 times — it is
 * rehydrated from `sectionId` through EXAM_BLUEPRINT, which is bundled).
 */
export type RaschQuizItem = Omit<ExamQuestion, 'slotNumber' | 'sectionLabel'>;

/** Where a question came from — the builder tab that added it. */
export type QuizItemOrigin = 'bank' | 'teacher';

export type RaschQuizStatus = 'draft' | 'published' | 'closed';

export interface TeacherRaschQuiz {
  id: string;
  title: string;
  description: string;

  teacherId: string;
  teacherName: string;

  /**
   * SIX DIGITS, e.g. `"482913"`. Digits only, so it can be typed on a phone
   * number pad and read aloud without the letter/number ambiguity that makes
   * `custom_tests.accessCode` (an alphanumeric 6) awkward over a classroom.
   * Uniqueness is checked at generation time — see the service — but the check is
   * a query, not a constraint, so a race can still collide. The lookup takes the
   * FIRST published match.
   */
  accessCode: string;

  /** The paper, in the order the student sees it (before optional shuffling). */
  questions: RaschQuizItem[];
  /** Exam SLOTS, not cards — a `shared_options` block is worth one per part. */
  questionCount: number;

  /** 0 is not allowed: a Rasch paper is sat against a clock. */
  durationMinutes: number;
  /** Shuffle the question order per student. Blocks stay intact either way. */
  shuffle: boolean;
  /** Reveal the correct answers + explanations on the results screen. */
  showAnswers: boolean;

  status: RaschQuizStatus;

  /** Firestore serverTimestamp. */
  createdAt: unknown | null;
  updatedAt: unknown | null;
}

/** What the builder holds before it is written (no id, no timestamps). */
export type RaschQuizDraft = Omit<TeacherRaschQuiz, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * One student's sitting — `teacher_rasch_results/{quizId}_{uid}`.
 *
 * The id is deterministic so a retake OVERWRITES rather than accumulating, the
 * same rule `attempts/{uid}_{assignmentId}` follows. `teacherId` is denormalized
 * because the read rule proves ownership off it (a teacher lists their own
 * results with `where('teacherId','==',uid)`).
 */
export interface RaschQuizResult {
  quizId: string;
  quizTitle: string;
  teacherId: string;

  studentId: string;
  studentName: string;

  /** Slots correct / slots on the paper. Not cards — see `questionCount`. */
  correct: number;
  total: number;
  percent: number;
  durationSec: number;
  /** Epoch ms — matches every other RASCH timestamp (see docs/DATA_MODEL.md). */
  submittedAt: number;

  /** The question language the student sat it in. */
  examLang: Lang;
  /** Per-dimension raw counts, so the teacher sees the evidence. */
  topics: Record<TopicKey, TopicScore>;
  /**
   * Per-dimension ability in LOGITS, for the dimensions this paper actually
   * measured. The teacher's results page maps each to the 0–5 level, which is
   * what "where is this student weak" is reported on.
   *
   * ⚠️ Logits, not levels — and only for dimensions with at least one item.
   *
   * Storing θ rather than the level keeps the record independent of the display
   * scale: `thetaToLevel` has already been restretched once (0–3 → 0–5) and
   * doing that again must not silently re-label saved results. A dimension the
   * paper never touched is ABSENT from the map, never `0` — zero is a real
   * ability, "not measured" is not, and conflating them is the exact bug the
   * student-side heptagon documents (`level: null` ≠ 0).
   *
   * Optional because results written before 2026-07-28 have no such field; the
   * results page renders those dimensions as "—" rather than inventing a level
   * from the percentage, which under Rasch is not the same quantity.
   */
  topicTheta?: Partial<Record<TopicKey, number>>;
  /** Ability measured from this paper alone, in logits. */
  theta: number | null;

  /**
   * Per-SLOT outcome: `1` right, `0` wrong. Keyed by `examSlotKeys` — the same
   * id `ItemResponse.id` carries, so a `shared_options` block appears once per
   * sub-question, exactly as the paper numbers it.
   *
   * This is what makes the marks dynamic ([lib/RASCHmarks.ts](../lib/RASCHmarks.ts)):
   * the teacher's page already reads every sitting of the paper in one query, so
   * "3 of 22 solved question 17" costs **no extra read** — and question 17's ball
   * is derived from it rather than printed in advance.
   *
   * ⚠️ Optional, and additive-only. Sittings saved before 2026-07-29 have none;
   * they are EXCLUDED from the statistics rather than counted as wrong, and their
   * own dynamic score reads "—". An APK rollout lags the web deploy, so old
   * clients keep writing results without it and must keep working.
   *
   * ⚠️ It is an outcome map, not an answer map — it records whether each slot was
   * right, never what the student put. "What did they answer for 12" is still not
   * stored (see docs/RASCH_QUIZ.md, known issues).
   */
  items?: Record<string, number>;
}

/** Blueprint coverage of a paper under construction, per dimension. */
export type QuizTopicCounts = Partial<Record<TopicKey, number>>;
