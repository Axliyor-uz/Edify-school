// types/Exam.ts
import type { TopicKey } from '@/lib/RASCHtopics';
import type { DifficultyId, Lang, LocalizedText, QuestionDoc } from './Math';
import type { QuestionType } from './question';

/**
 * Milliy sertifikat question formats.
 *   Y-1 — closed, single correct answer (basic)
 *   Y-2 — closed, single correct answer (harder / multi-step)
 *   O   — open-ended equivalent (hardest)
 *
 * These are a property of the *blueprint slot*, not of a question: no doc in
 * questions1 carries a `testType` field, so we approximate the format with a
 * difficulty band instead (see DIFFICULTY_BAND in lib/Examblueprint.ts).
 */
export type TestType = 'Y-1' | 'Y-2' | 'O';

/** Which collection a blueprint section is filled from. */
export type ExamSource = 'bank' | 'teacher';

/** One chapter of the question bank, addressed the way questions1 stores it. */
export interface ChapterRef {
  /** "1" = Algebra, "2" = Geometriya. Unpadded, as stored. */
  topicId: string;
  /** "01".."18", zero-padded to 2 chars, as stored. */
  chapterId: string;
}

/** One row of the exam blueprint = one DTM section at one test type. */
export interface BlueprintSection {
  /** Stable key — groups results and doubles as the React key. */
  id: string;
  /** The topic the student is levelled on. Several sections share one topic —
   *  Geometriya is drawn at Y-1, Y-2 and O — and their scores pool together. */
  topic: TopicKey;
  label: Record<Lang, string>;
  testType: TestType;
  count: number;
  /**
   * The DTM ball printed beside each of this section's questions, **in printed
   * order** — `count` of them, and every section's list together sums to 100.
   *
   * ⚠️ It is a multiset, not a formula: a Y-1 section mixes 1.3 and 2.2, and
   * which question gets which is what the dynamic marks decide
   * ([lib/RASCHmarks.ts](../lib/RASCHmarks.ts)). The VALUES never change — only
   * their assignment within the section does.
   */
  balls: number[];
  /** The questions1 chapters this section draws from. */
  pools: ChapterRef[];
  /** Overrides DIFFICULTY_BAND[testType] for sections that need their own band. */
  difficulties?: DifficultyId[];
  /**
   * `'bank'` (default) fills from questions1 via the `rand` sampler.
   * `'teacher'` fills from teacher_questions (v1), matched to the section's
   * chapters via the question_topics taxonomy — with images and blocks.
   */
  source?: ExamSource;
}

/**
 * One sub-question of a `multi_part` teacher block, shown on the same card as
 * the block stem. The whole block counts as ONE exam question (unlike a
 * `shared_options` block, whose parts are expanded into one exam slot each).
 */
export interface ExamPart {
  /** Also the suffix of the answer key: `answers[`${q.id}::${id}`]`. */
  id: string;
  prompt: LocalizedText;
  /** `mcq` | `true_false` → option buttons; `open` | `numeric` → typed input. */
  qType: QuestionType;
  /** Option ids to render for a closed part (empty for a typed part). */
  optionKeys: string[];
  options: Record<string, LocalizedText>;
  optionImages?: Record<string, string | null>;
  /** Correct option id (closed) or the literal text (typed). */
  answer: string;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  explanation?: LocalizedText;
}

/**
 * A question bound to its position in the exam.
 *
 * The base fields are the legacy `questions1` shape the whole RASCH pipeline
 * reads (options letter-map, `answer` letter, `solutions[].final_answer`). The
 * optional fields below carry what a v1 `teacher_questions` doc adds — images,
 * a real question type, and blocks — and are absent on a questions1 item.
 */
export interface ExamQuestion extends QuestionDoc {
  slotNumber: number;
  sectionId: string;
  sectionLabel: Record<Lang, string>;
  testType: TestType;

  // ── teacher_questions extras (undefined on a questions1 item) ─────────────
  /** Which collection this came from. Absent ⇒ `'bank'`. */
  source?: ExamSource;
  /** The doc's real type — drives render/grade for a teacher item instead of
   *  `testType`. A bank item has none and falls back to the testType rules. */
  qType?: QuestionType;
  /** The block's shared statement, carried onto each expanded `shared_options`
   *  sub-question so the stem ("Parallelepiped… hajmi 72 cm²") is never dropped.
   *  Rendered above `question`. Absent unless it differs from `question`. */
  stem?: LocalizedText | null;
  /** Prompt image (v1 `image.downloadUrl`). */
  imageUrl?: string | null;
  /** Option id → image url, for image-bearing options. */
  optionImages?: Record<string, string | null>;
  /** Option ids to render for a closed teacher item (e.g. A–F for a shared
   *  pool). Absent ⇒ render the questions1 default A–D. */
  optionKeys?: string[];
  /** Accepted spellings for a typed teacher item (open/numeric). */
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  /** Who authored this teacher item, shown even mid-exam so a wrong question can
   *  be traced to a person. Absent on a questions1 bank item (no author). */
  creatorId?: string;
  creatorName?: string;
  /** The corrector's display name, if the question was ever edited. */
  correctedBy?: string;
  /** Non-empty ⇒ this is a `multi_part` block: render the stem then each part,
   *  and grade it as one question (all parts must be correct). */
  parts?: ExamPart[];
}

export interface Shortfall {
  sectionId: string;
  label: Record<Lang, string>;
  testType: TestType;
  requested: number;
  received: number;
}

export interface BuildExamResult {
  questions: ExamQuestion[];
  shortfalls: Shortfall[];
  /** Documents Firestore actually returned — what the build was billed. */
  docsRead: number;
}

/**
 * A whole exam sitting in the browser: the paper itself plus the student's
 * progress. Persisted by lib/Examsession.ts so a reload, a closed tab, or a
 * revisit resumes the same paper without re-reading a single document.
 */
export interface ExamSnapshot {
  version: number;
  /** The account this paper belongs to ('' = signed-out). localStorage is shared
   *  by every account on one browser, so the runner ignores a snapshot whose uid
   *  isn't the current student's — otherwise student B resumes student A's paper
   *  and sees A's results. */
  uid: string;
  /** Chosen on the intro screen — NOT the app UI language. */
  examLang: Lang;
  questions: ExamQuestion[];
  shortfalls: Shortfall[];
  answers: Record<string, string>;
  flagged: string[];
  current: number;
  /** Epoch ms. The clock keeps running while the tab is closed. */
  endsAt: number;
  savedAt: number;
  submitted: boolean;
  autoSubmitted: boolean;
  docsRead: number;
  /** Result already written to the student's account — never write it twice. */
  saved?: boolean;
  /** Seconds spent per question id — persisted, so a reload keeps the timings
   *  the guess/gap/fragile diagnosis is built from. */
  seconds?: Record<string, number>;

  // ── teacher-quiz sittings only (docs/RASCH_QUIZ.md) ──────────────────────
  /**
   * The teacher paper this sitting came from — `teacher_rasch_quizzes/{id}` for a
   * maths paper, `milliy_quizzes/{id}` for a subject paper. Absent on a mock exam.
   *
   * ⚠️ Which collection it means is told by `milliySubject`, and the two live in
   * SEPARATE localStorage stores (lib/Examsession.ts), so a snapshot is never
   * ambiguous in practice.
   */
  quizId?: string;
  /**
   * Set ⇒ this is a Milliy sertifikat **subject** paper (`biologiya`…) from
   * `milliy_quizzes`, scored on raw counts with no ability model
   * (docs/MILLIY_QUIZ.md). Absent ⇒ a maths paper or the mock exam, both of which
   * move `RASCH_levels`.
   */
  milliySubject?: string;
  /** Denormalized so the resume screen can name the paper without a read. */
  quizTitle?: string;
  quizTeacherId?: string;
  quizTeacherName?: string;
  /** The quiz's own time limit — a teacher paper is not always 150 minutes, and
   *  the deadline must survive a reload without re-reading the quiz doc. */
  durationMinutes?: number;
  /** The teacher chose to withhold answers/explanations after submission. */
  hideAnswers?: boolean;
}
