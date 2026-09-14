// types/RASCH.ts
import type { TopicKey } from '@/lib/RASCHtopics';
import type { ThetaPoint } from '@/lib/RASCHdynamic';
import type { DifficultyId, Lang, OptionKey } from './Math';

/** One topic's slice of one exam. */
export interface TopicScore {
  correct: number;
  total: number;
  /** 0–100, rounded. `correct / total`. */
  percent: number;
}

/**
 * ONE ANSWERED QUESTION — the atom everything else is built from.
 *
 * The aggregate scores (`geometry: 4/7`) cannot be un-aggregated, so this is the
 * only record that makes item analysis, subtopic diagnosis, Rasch calibration
 * and distractor analysis possible at all. It is stored inside the attempt
 * document: 45 of these is a few KB, still ONE document and ONE write.
 */
export interface ItemResponse {
  /** questions1 doc id. */
  id: string;
  topic: TopicKey;
  /** "1" = Algebra, "2" = Geometriya. */
  topicId: string;
  chapterId: string;
  subtopicId: string;
  difficultyId: DifficultyId;
  testType: string;
  /** Option key, or the typed text for an open (O) question. '' = unanswered. */
  chosen: string;
  /** The key that would have been correct. */
  answer: OptionKey;
  correct: boolean;
  /** Seconds this question was on screen. */
  sec: number;
  /** Calibrated Rasch difficulty, if the item has been calibrated. Falls back
   *  to the difficultyId anchor when absent. Comes free with the question doc. */
  b?: number;
  /** Where this response came from. A timed 45-question exam and a relaxed
   *  10-question drill are not the same evidence — mixing them silently would
   *  flatter the exam picture. Absent on responses recorded before the split. */
  kind?: 'exam' | 'practice';
}

/**
 * What a response says about the student, once time is taken into account.
 * Same score, very different diagnoses:
 *   solid    — right, and not slow
 *   fragile  — right, but slow: it will collapse under exam time pressure
 *   guess    — wrong, and fast: not attempted seriously / guessed
 *   gap      — wrong after real effort: a genuine knowledge gap
 *   skipped  — never answered
 */
export type Behavior = 'solid' | 'fragile' | 'guess' | 'gap' | 'skipped';

/** Rolled-up performance on one chapter or one subtopic. */
export interface SpotStat {
  /** Ids, so names can be resolved from the bundled syllabus (0 reads). */
  topicId: string;
  chapterId: string;
  /** Empty for a chapter-level row. */
  subtopicId: string;
  seen: number;
  correct: number;
  /** Total seconds spent here — `sumSec / seen` is the average. */
  sumSec: number;
  behaviors: Record<Behavior, number>;
  lastAt: number;
  /** P(mastery) from Bayesian Knowledge Tracing — a LEARNING model, so unlike
   *  raw accuracy it can rise as the student learns, and it discounts lucky
   *  guesses and careless slips. See lib/RASCHbkt.ts. */
  mastery?: number;
  /** Kalman-filtered Rasch ability for this chapter/subtopic, in logits. This is
   *  what the 0–3 level is read off (lib/RASCHscale.ts). */
  theta?: number;
  /** Its standard error. A chapter met twice has a huge one, and should. */
  se?: number;
}

/** Per-chapter and per-subtopic rollups, keyed by id path. */
export interface Diagnostics {
  /** key: `${topicId}:${chapterId}` */
  chapters: Record<string, SpotStat>;
  /** key: `${topicId}:${chapterId}:${subtopicId}` */
  subtopics: Record<string, SpotStat>;
  updatedAt: number;
}

/**
 * A Rasch ability estimate, in logits, with its uncertainty.
 * `expected` re-expresses it as the score this student would be expected to get
 * on a STANDARD paper — which, unlike a raw percent, is not inflated or
 * deflated by the luck of the draw.
 */
export interface Ability {
  /** Logits. 0 ≈ the difficulty of an average (medium) item. */
  theta: number;
  /** Standard error, in logits. Small = confident. */
  se: number;
  /** Expected % on a standard paper, 0–100. */
  expected: number;
  /** Items the estimate is based on. */
  items: number;
}

/** What the student is levelled at, per topic. */
export interface TopicLevel {
  /** 0–100 — mean of the last LEVEL_WINDOW scores (baseline seeds the window). */
  level: number;
  /** level − previous level. Positive = improving. 0 before the first exam. */
  delta: number;
  /** Per-exam percents, oldest → newest, capped at HISTORY_CAP for the chart. */
  scores: number[];
  /** Rasch ability for this topic, estimated over the recent item window. */
  ability?: Ability;
  /**
   * The DYNAMIC ability for this dimension: one filtered measurement per sitting
   * that touched this topic.
   *
   * Mathematics ability is not one number — it is seven. A student can be
   * climbing in Geometriya while sliding in Trigonometriya, and a single θ
   * averages that away. Each topic therefore carries its own Kalman-filtered θ,
   * so every exam and every drill moves that dimension on its own evidence.
   *
   * Sittings with only 2 items for a topic produce a large `se`, so the filter
   * gain is small and the dimension barely moves — which is correct: two
   * questions are not a re-measurement of your geometry.
   */
  thetaTrace?: ThetaPoint[];
}

/** One row of the progress chart. */
export interface ExamPoint {
  /**
   * Stable id of the paper this row came from — its deadline (`endsAt`, epoch
   * ms), fixed the moment the paper was drawn.
   *
   * This is what makes the write idempotent: `saveExamResult` refuses to append
   * a row whose id is already in `exams`, so a re-fired effect, a second tab or
   * a retry after a write that actually committed can no longer inflate the exam
   * history. Absent on rows written before the id existed.
   */
  id?: number;
  /** Epoch ms of submission. */
  at: number;
  /** Overall exam percent, 0–100. */
  score: number;
  /** Draw-independent expected score at the ability measured by this exam. */
  expected?: number;
}

/**
 * RASCH_levels/{uid} — one document per student, holding everything the progress
 * and diagnosis pages need. Read cost of the whole thing: 1 document.
 */
export interface RASCHLevels {
  userId: string;
  /**
   * Which version of the ability model produced the stored θ values.
   *
   * v1 had no guessing floor, so it credited one-in-four lucky hits as ability
   * and inflated every θ. Bumping this triggers a recompute from `recentItems`,
   * which is exactly why those items are kept.
   */
  modelVersion?: number;
  /** The starting level the student picked per topic, 0–100. Null until set. */
  baseline: Record<TopicKey, number> | null;
  topics: Record<TopicKey, TopicLevel>;
  /** Overall score of each exam, oldest → newest, capped at HISTORY_CAP. */
  exams: ExamPoint[];
  examCount: number;
  updatedAt: number;

  /** Overall Rasch ability across the recent window (exam + practice). */
  ability?: Ability;
  /** …the same, from exam responses only. This is the one that predicts an exam. */
  abilityExam?: Ability;
  /** …and from practice only — usually higher: no clock, no pressure. */
  abilityPractice?: Ability;
  /**
   * The most recent item responses (exams AND practice), newest last, capped.
   * Ability is re-estimated from this window, so it tracks current form without
   * ever reading the attempt documents back.
   */
  recentItems?: ItemResponse[];
  /**
   * Per-chapter / per-subtopic rollups, kept SEPARATELY by source.
   *
   * Exam and practice measure different things — one is timed and high-stakes,
   * the other is relaxed and repeatable — so pooling them buries the difference.
   * The combined view is derived by merging these two (mergeDiagnostics), which
   * costs nothing and keeps the document from tripling in size.
   */
  diagnosticsExam?: Diagnostics;
  diagnosticsPractice?: Diagnostics;
  /** Legacy: the pooled rollup written before the split. Read as exam data. */
  diagnostics?: Diagnostics;

  /**
   * The ability trace — one filtered measurement per sitting, over time.
   *
   * Rasch on its own cannot predict a FUTURE exam: it assumes ability is fixed.
   * This is the missing piece — it lets ability move (a random walk, filtered),
   * so a learning rate can be measured and projected. See lib/RASCHdynamic.ts.
   */
  thetaTrace?: ThetaPoint[];
}

/**
 * RASCH_attempts/{autoId} — the permanent, append-only record of one sitting.
 * Written once and never read by the app, so it costs one write and no reads.
 * `items` is what makes it worth keeping.
 */
export interface RASCHAttempt {
  userId: string;
  submittedAt: number;
  examLang: Lang;
  /** 'exam' = the 45-question paper; 'practice' = a targeted drill. */
  kind: 'exam' | 'practice';
  correct: number;
  total: number;
  percent: number;
  /** Seconds spent, from start to submission. */
  durationSec: number;
  topics: Record<TopicKey, TopicScore>;
  /** Per-question detail — the raw material for every later analysis. */
  items: ItemResponse[];
  /** Ability measured from this sitting alone. */
  ability?: Ability;
}
