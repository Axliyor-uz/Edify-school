// types/SatQuiz.ts
//
// A teacher-built, ADAPTIVE SAT Math test: Module 1 (fixed) then Module 2,
// where the Module 2 pool served (Easier vs Harder) depends on the student's
// Module 1 score — the real digital SAT's own per-module adaptivity. Contract
// + traps: docs/SAT_QUIZ.md.
//
// ⚠️ Deliberately NOT `ExamQuestion`/`teacher_rasch_quizzes`-shaped. Those types
// carry blueprint/`testType` (Y-1/Y-2/O) and block machinery
// (`lib/ExamTeacher.ts`) that exist for the Milliy sertifikat DTM protocol and
// mean nothing here. A SAT Math item is always a single `mcq` (4 choices) or
// `numeric` (grid-in) — never a block — so this file defines its own small
// item shape instead of forcing one through that pipeline. See
// lib/SatMathQuiz.ts for the conversion from a bank question.
//
// ⚠️ Questions are stored as EMBEDDED SNAPSHOTS, not refs — same trade
// `milliy_quizzes`/`teacher_rasch_quizzes` make. A whole test costs ONE read
// however many students sit it; the cost is that a fixed paper does not pick
// up a later correction to the source question.

import type { Lang, LocalizedText } from './Math';

/** The 4 official digital SAT Math domains — `data/question_topics.json`'s
 *  `sat-matematika` topic slugs. See `lib/SatMathQuiz.ts::SAT_MATH_DOMAINS`. */
export type SatMathDomain =
  | 'algebra'
  | 'advanced-math'
  | 'problem-solving-and-data-analysis'
  | 'geometry-and-trigonometry';

/** Which Module 2 pool a student was served, decided from their Module 1 score. */
export type SatModuleRoute = 'easier' | 'harder';

/**
 * One stored question — a small, self-contained snapshot (not `ExamQuestion`).
 * Only `mcq` (4 lettered choices) and `numeric` (a typed "grid-in" response)
 * ever appear here; both are already fully implemented question types
 * (docs/QUESTIONS.md).
 */
export interface SatQuizItem {
  id: string;
  qType: 'mcq' | 'numeric';

  /** The bank question's own topic slug + label, denormalized for the results page. */
  domain: SatMathDomain;
  domainLabel: LocalizedText;

  difficultyId: number;

  question: LocalizedText;
  imageUrl: string | null;

  /** `['A','B','C','D']` for `mcq`; empty for `numeric`. */
  optionKeys: string[];
  options: Record<string, LocalizedText>;
  optionImages?: Record<string, string | null>;

  /** Correct option letter (`mcq`) or the literal expected text (`numeric`). */
  answer: string;
  /** `numeric` only — other spellings/forms that also count as correct. */
  acceptedAnswers?: string[];

  explanation?: LocalizedText;

  /** Who wrote it, shown even mid-test — mirrors the rest of the app
   *  (docs/QUESTIONS.md, "Who made it"). Absent on a legacy/bank item with no author. */
  creatorId?: string;
  creatorName?: string;
  correctedBy?: string;
}

export type SatMathTestStatus = 'draft' | 'published' | 'closed';

export interface SatMathTest {
  id: string;
  title: string;
  description: string;

  teacherId: string;
  teacherName: string;

  /**
   * SIX DIGITS, e.g. `"482913"`. ⚠️ A **string** everywhere — parsed as a
   * number it loses a leading zero and stops matching.
   *
   * ⚠️ OWN NAMESPACE: uniqueness is checked only against other
   * `sat_math_tests`, never against `milliy_quizzes`/`teacher_rasch_quizzes`.
   * SAT is a separate program with its own code-entry point
   * (`/sat`, not `/milliy-sertifikat`), so there is no shared box that needs a
   * cross-collection lookup the way the Milliy sertifikat subjects do.
   */
  accessCode: string;

  /** Fixed — every student who sits this test answers the same Module 1. */
  module1: SatQuizItem[];
  /** Served only to a student whose Module 1 score routed them "easier". */
  module2Easier: SatQuizItem[];
  /** Served only to a student whose Module 1 score routed them "harder". */
  module2Harder: SatQuizItem[];

  /** Minutes per module. Real digital SAT Math: 35 + 35. */
  module1Minutes: number;
  module2Minutes: number;

  /**
   * How many Module 1 questions correct routes a student to the HARDER
   * Module 2 (`>=` this routes harder, below routes easier). Default
   * `Math.ceil(module1.length / 2)`.
   */
  routingThreshold: number;

  /** Shuffle each module's question order per student. */
  shuffle: boolean;
  /** Reveal correct answers + explanations on the results screen. */
  showAnswers: boolean;

  status: SatMathTestStatus;

  createdAt: unknown | null;
  updatedAt: unknown | null;
}

/** What the builder holds before it is written (no id, no timestamps). */
export type SatMathTestDraft = Omit<SatMathTest, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * One student's sitting — `sat_math_results/{testId}_{uid}`.
 *
 * Deterministic id ⇒ a retake OVERWRITES, the same rule every exam-shaped
 * collection in this repo follows (`attempts`, `teacher_rasch_results`,
 * `milliy_quiz_results`).
 */
export interface SatMathResult {
  testId: string;
  testTitle: string;
  teacherId: string;

  studentId: string;
  studentName: string;

  module1Correct: number;
  module1Total: number;
  route: SatModuleRoute;
  module2Correct: number;
  module2Total: number;

  correct: number;
  total: number;

  /**
   * 200–800, rounded to the nearest 10 — an EXPLICIT APPROXIMATION
   * (`lib/SATscore.ts::estimateScaledScore`), NOT College Board's proprietary
   * IRT-equated score. Never present this as an official/equated result —
   * see docs/SAT_QUIZ.md.
   */
  scaledScore: number;

  durationSec: number;
  /** Epoch ms — matches every other exam-side timestamp (docs/DATA_MODEL.md). */
  submittedAt: number;

  examLang: Lang;

  /**
   * Per-question outcome: `1` right, `0` wrong, keyed by the question's own
   * `id` (no block sub-question namespace needed — SAT items are never
   * blocks). Drives the results page's per-question solve rate at no extra
   * read. ⚠️ Optional and additive-only: an older sitting has none and is
   * excluded from solve-rate stats rather than counted wrong.
   */
  items?: Record<string, number>;

  /** Per-domain raw counts. A domain neither module touched is ABSENT, never `{0,0}`. */
  domains?: Partial<Record<SatMathDomain, { correct: number; total: number }>>;
}

// ─── the browser-side sitting (lib/SatSession.ts) ────────────────────────────

/**
 * ⚠️ No `'directions'` phases here — unlike the runner itself, which mounts
 * only once the student presses Start (same convention `ExamRunner` follows:
 * the CALLING PAGE shows the intro/instructions and calls
 * `requestExamFullscreen()` synchronously in that click). The one exception is
 * `'transition'`, the Module 1 → Module 2 hand-off screen — that happens
 * MID-SITTING, driven by the routing decision only the runner knows, so it
 * has to live in this state machine rather than the page.
 */
export type SatRunnerPhase = 'module1' | 'module1-review' | 'transition' | 'module2' | 'module2-review' | 'submitted';

/**
 * A whole SAT Math sitting in the browser: the test itself plus the student's
 * progress. Persisted so a reload, a closed tab, or a revisit resumes the same
 * sitting without re-reading the test document. Mirrors `ExamSnapshot`
 * (types/Exam.ts) in spirit, not in shape — see the file header for why SAT
 * doesn't reuse it.
 */
export interface SatExamSnapshot {
  version: number;
  /** localStorage is shared by every account on one browser — a snapshot whose
   *  uid isn't the current student's is ignored. */
  uid: string;
  examLang: Lang;

  testId: string;
  testTitle: string;
  teacherId: string;
  teacherName: string;

  module1: SatQuizItem[];
  module2Easier: SatQuizItem[];
  module2Harder: SatQuizItem[];
  module1Minutes: number;
  module2Minutes: number;
  routingThreshold: number;
  showAnswers: boolean;

  phase: SatRunnerPhase;

  module1Answers: Record<string, string>;
  module1Flagged: string[];
  /** Answer-choice letters the student struck out, per question id — a UI aid,
   *  never graded. */
  crossedOut: Record<string, string[]>;
  current: number;
  /** Epoch ms — clamped at Module 1 start, kept running while the tab is closed. */
  module1EndsAt: number;

  /** Set the moment Module 1 is submitted — decides which pool Module 2 serves. */
  route: SatModuleRoute | null;
  module2Answers: Record<string, string>;
  module2Flagged: string[];
  module2EndsAt: number;

  startedAt: number;
  savedAt: number;
  /** Result already written to the student's account — never write it twice. */
  saved?: boolean;
}
