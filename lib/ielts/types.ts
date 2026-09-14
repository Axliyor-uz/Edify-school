// IELTS platform types — the real, wired model (replaces the dead types in types/ielts.ts).
// Shapes mirror what the reading builder already writes; additive-only for Android sync.

export type IeltsSkill = 'reading' | 'listening' | 'writing' | 'speaking';
export type IeltsTestCategory = 'academic' | 'general';
export type IeltsMode = 'simulation' | 'practice';
export type IeltsResultsVisibility = 'always' | 'after_due' | 'never';

export const IELTS_QUESTION_TYPES = [
  'matching_headings',
  'true_false_not_given',
  'multiple_choice',
  'summary_completion',
  'matching_paragraph_information',
  'list_selection',
  'matching_features',
  'sentence_completion',
  'matching_sentence_endings',
  'short_answer',
  'table_completion',
  'flowchart_completion',
  'diagram_completion',
] as const;
export type IeltsQuestionType = (typeof IELTS_QUESTION_TYPES)[number];

export interface IeltsTextBlock {
  type: 'text';
  label: string;
  content: string;
}

// Rows vary by type — the builder's shapes, kept loose where the builder is loose.
export interface IeltsQuestionRow {
  question_number: number;
  correct_answer?: string | string[]; // stripped from public docs (answers_split)
  statement?: string;
  question_text?: string;
  sentence?: string;
  sentence_start?: string;
  target_paragraph?: string;
  passage_reference?: string;
  explanation?: string;
  options?: { id: string; text: string }[];
}

export interface IeltsQuestionBlock {
  type: IeltsQuestionType;
  instructions: string;
  start_question: number;
  end_question: number;
  questions: IeltsQuestionRow[];
  options?: { id: string; text: string }[] | string[] | { label: string; description: string }[] | null;
  word_limit?: number;
  summary_title?: string;
  summary_text?: string;
  table_title?: string;
  headers?: string[];
  rows?: { cells: string[] }[];
  flowchart_title?: string;
  steps?: string[];
  diagram_title?: string;
  diagram_url?: string;
  diagram_alt_text?: string;
}

export interface IeltsPassage {
  id: string;
  module: 'reading';
  passage_number: number;
  title: string;
  subtitle: string;
  instruction: string;
  word_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  blocks: IeltsTextBlock[];
  questions: IeltsQuestionBlock[];
}

export interface IeltsListeningPart {
  part_number: number; // 1..4
  audio_url: string;
  audio_duration_seconds?: number;
  transcript?: string;
  questions: IeltsQuestionBlock[];
}

/**
 * Admin-managed catalog controls for the PLATFORM dataset (additive, 2026-07-31).
 * Written by the admin panel only (`/admin/ielts`) and mirrored onto BOTH the test doc
 * and `ielts_test_meta/{testId}` so every reader — full-doc (teacher) and meta-only
 * (student library) — sees the same order and the same hidden flags.
 * Missing = visible, and unordered items sort after ordered ones.
 */
export interface IeltsCatalogControls {
  /** Ascending display position within a skill. Admin-assigned, 0-based, dense. */
  catalogOrder?: number;
  /** Hide from the student Practice Library. */
  hiddenFromStudents?: boolean;
  /** Hide from the teacher platform lists + the assign-test picker. */
  hiddenFromTeachers?: boolean;
}

interface IeltsTestBase extends IeltsCatalogControls {
  test_id: string;
  test_title: string;
  total_time_minutes: number;
  total_questions: number;
  teacherId: string | null; // null for platform tests
  source?: 'teacher' | 'platform';
  test_category?: IeltsTestCategory; // reading band table selection (default 'academic')
  answers_split?: boolean; // true => doc holds no correct_answer; key in ielts_answer_keys
  status: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IeltsReadingTest extends IeltsTestBase {
  module: 'reading';
  passages: IeltsPassage[];
}

export interface IeltsListeningTest extends IeltsTestBase {
  module: 'listening';
  parts: IeltsListeningPart[];
}

export interface IeltsWritingTest extends IeltsTestBase {
  module: 'writing';
  task1: { prompt: string; imageUrl?: string; modelAnswer?: string };
  task2: { prompt: string; modelAnswer?: string };
}

export interface IeltsSpeakingTest extends IeltsTestBase {
  module: 'speaking';
  part1Questions: string[];
  part2CueCard: { topic: string; bullets: string[] };
  part3Questions: string[];
}

export type IeltsTest = IeltsReadingTest | IeltsListeningTest | IeltsWritingTest | IeltsSpeakingTest;

// ielts_answer_keys/{testId}
export interface IeltsKeyEntry {
  t: IeltsQuestionType;
  a: string | string[]; // letter(s) or accepted text alternates ("taxi/cab", "(the) library")
  wl?: number; // word limit
  span?: number; // list_selection: how many question numbers this entry covers
}
export interface IeltsAnswerKeyDoc {
  testId: string;
  teacherId: string | null;
  skill: 'reading' | 'listening';
  keys: Record<string, IeltsKeyEntry>;
}

// ielts_groups/{groupId} — read rule is teacher/member only; join goes through /api/ielts/join.
export interface IeltsGroup {
  id?: string;
  title: string;
  targetBand: number;        // e.g. 7.0
  joinCode: string;          // MUST start with "I-" (join API regex depends on it)
  teacherId: string;
  teacherName: string;
  description?: string;
  studentIds: string[];
  createdAt: unknown;
  // ── Center-managed groups (2026-07-29, additive-only) ──────────────────────
  // Set ONLY by POST /api/manager/ielts-groups (Admin SDK). When `managed`,
  // the roster is manager-owned: join-by-code is refused (CENTER_MANAGED),
  // teacher UI hides Requests/add/remove, and studentIds mirrors the linked
  // classes/{classId} doc (which carries schedule/attendance/finance).
  centerId?: string | null;
  classId?: string | null;
  managed?: boolean;
}

// ielts_groups/{groupId}/assignments/{assignmentId}
export interface IeltsAssignment {
  testId: string;
  skill: IeltsSkill;
  testTitle: string;
  questionCount: number;
  totalTimeMinutes: number;
  mode: IeltsMode;
  openAt: unknown | null;
  dueAt: unknown | null;
  allowedAttempts: number;
  resultsVisibility: IeltsResultsVisibility;
  assignedTo: 'all' | string[];
  teacherId: string;
  createdAt: unknown;
  status: 'active';
  completedBy: string[];
}

/** IELTS writing rubric: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. */
export interface IeltsWritingCriteria {
  ta: number;
  cc: number;
  lr: number;
  gra: number;
}

// ielts_test_meta/{testId} — lightweight library-card summary written in the same batch as the
// test doc (saveIeltsTest / W&S saves). Never contains answers. Old tests get one on re-save;
// readers fall back to full-doc fetch when metas are missing (count mismatch).
export interface IeltsTestMeta extends IeltsCatalogControls {
  testId: string;
  skill: IeltsSkill;
  test_title: string;
  teacherId: string | null;
  source: 'teacher' | 'platform';
  test_category?: IeltsTestCategory;
  total_questions: number;
  total_time_minutes: number;
  typeBreakdown?: Record<string, number>; // reading/listening only
  updatedAt: unknown;
  createdAt?: unknown;
}

export interface IeltsPerQuestionResult {
  correct: boolean;
  type: string;
}

// ielts_attempts — server-written only.
// Assignment attempts: deterministic id `${uid}_${groupId}_${assignmentId}`.
// Practice attempts: auto id, kind 'practice', unlimited history.
export interface IeltsAttempt {
  userId: string;
  userName: string;
  kind: 'assignment' | 'practice';
  groupId?: string;
  assignmentId?: string;
  testId: string;
  skill: IeltsSkill;
  mode: IeltsMode;
  answers: Record<string, string | string[]>;
  rawScore?: number;
  totalQuestions?: number;
  bandScore?: number;
  perQuestion?: Record<string, IeltsPerQuestionResult>;
  typeStats?: Record<string, { correct: number; total: number }>;
  // writing/speaking
  writing?: { task1Text: string; task2Text: string; task1Words: number; task2Words: number };
  speaking?: { part1AudioUrl?: string; part2AudioUrl?: string; part3AudioUrl?: string };
  reviewStatus?: 'pending_review' | 'graded';
  teacherGrade?: {
    band: number;
    comments: string;
    gradedAt: unknown;
    /** Optional IELTS rubric sub-scores (whole/half bands). Additive — old grades have band+comments only. */
    criteria?: IeltsWritingCriteria;
  };
  /** AI first-pass writing estimate (server-written by /api/ielts/analyze-writing). Advisory only — teacherGrade always wins. */
  aiEstimate?: {
    band: number;
    criteria: IeltsWritingCriteria;
    feedback: { uz: string; ru: string; en: string };
    model: string;
    createdAt: unknown;
  };
  tabSwitches: number;
  timeSpentSeconds: number;
  attemptsTaken?: number;
  xpEarned?: number;
  startedAt: unknown;
  submittedAt: unknown;
}
