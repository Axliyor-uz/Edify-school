// lib/RASCHlevels.ts
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import type { ExamPoint, RASCHLevels, TopicLevel, TopicScore } from '@/types/RASCH';

/**
 * The levelling engine — pure functions, no Firestore. Everything here is
 * deterministic so it can be tested (and re-run server-side later without
 * touching the UI).
 *
 * A level is the MEAN OF THE LAST 5 SCORES for that topic, where the student's
 * self-selected baseline is the first entry of the window:
 *
 *   window = [baseline, exam₁, exam₂, …]        (oldest → newest)
 *   level  = mean(last 5 of window)
 *
 * So with no exams yet the level IS the baseline; after five exams the baseline
 * has slid out of the window and the level is pure recent form. A sixth exam
 * pushes the first one out — old results stop counting, which is what makes the
 * number track current ability rather than lifetime history.
 */

export const LEVEL_WINDOW = 5;

/** How many exam scores we keep per topic for the chart. */
export const HISTORY_CAP = 20;

export const DEFAULT_BASELINE = 50;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function percentOf(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * The level implied by a baseline plus a topic's exam history.
 * Exported so the UI can preview a level without going through Firestore.
 */
export function levelFrom(baseline: number | null, scores: number[]): number {
  const window = [...(baseline === null ? [] : [baseline]), ...scores].slice(-LEVEL_WINDOW);
  return Math.round(mean(window));
}

/** An untouched profile: every topic sitting exactly at its baseline. */
export function emptyLevels(
  userId: string,
  baseline: Record<TopicKey, number> | null,
): RASCHLevels {
  const topics = {} as Record<TopicKey, TopicLevel>;
  for (const key of TOPIC_KEYS) {
    topics[key] = {
      level: baseline ? baseline[key] : DEFAULT_BASELINE,
      delta: 0,
      scores: [],
    };
  }
  return { userId, baseline, topics, exams: [], examCount: 0, updatedAt: Date.now() };
}

/**
 * Folds one exam into a student's levels.
 *
 * Pure: takes the current document (or null for a first-timer) and returns the
 * next one. `delta` is the movement this exam caused, which is what the results
 * screen shows as ▲/▼ per topic.
 */
export function applyExam(
  previous: RASCHLevels | null,
  params: {
    userId: string;
    topicScores: Record<TopicKey, TopicScore>;
    overallPercent: number;
    at: number;
    /** The paper's id (its `endsAt`), carried onto the chart row so the same
     *  paper can never be appended twice. */
    examId?: number;
  },
): RASCHLevels {
  const base = previous ?? emptyLevels(params.userId, null);
  const topics = {} as Record<TopicKey, TopicLevel>;

  for (const key of TOPIC_KEYS) {
    const prior = base.topics?.[key] ?? { level: DEFAULT_BASELINE, delta: 0, scores: [] };
    const baseline = base.baseline?.[key] ?? null;
    const scored = params.topicScores[key];

    // A topic the exam didn't touch keeps its level and its history untouched.
    if (!scored || scored.total === 0) {
      topics[key] = { ...prior, delta: 0 };
      continue;
    }

    const scores = [...prior.scores, scored.percent].slice(-HISTORY_CAP);
    const level = levelFrom(baseline, scores);
    topics[key] = { level, delta: level - prior.level, scores };
  }

  const row: ExamPoint = { at: params.at, score: params.overallPercent };
  // Never write `undefined` to Firestore — only carry the id when there is one.
  if (params.examId !== undefined) row.id = params.examId;

  const exams: ExamPoint[] = [...(base.exams ?? []), row].slice(-HISTORY_CAP);

  return {
    userId: params.userId,
    baseline: base.baseline,
    topics,
    exams,
    examCount: (base.examCount ?? 0) + 1,
    updatedAt: params.at,
  };
}

/**
 * Sets (or re-sets) the starting level. Levels are recomputed, so a student who
 * fixes a baseline they mis-picked sees it reflected immediately — and once
 * they have 5 exams behind them, changing it does nothing at all, because the
 * baseline has already slid out of every window.
 */
export function applyBaseline(
  previous: RASCHLevels | null,
  userId: string,
  baseline: Record<TopicKey, number>,
): RASCHLevels {
  const base = previous ?? emptyLevels(userId, null);
  const topics = {} as Record<TopicKey, TopicLevel>;

  for (const key of TOPIC_KEYS) {
    const prior = base.topics?.[key] ?? { level: baseline[key], delta: 0, scores: [] };
    const level = levelFrom(baseline[key], prior.scores);
    topics[key] = { level, delta: 0, scores: prior.scores };
  }

  return {
    ...base,
    userId,
    baseline,
    topics,
    updatedAt: Date.now(),
  };
}

/** Overall level = mean of the seven topic levels. */
export function overallLevel(levels: RASCHLevels): number {
  return Math.round(mean(TOPIC_KEYS.map((k) => levels.topics[k]?.level ?? 0)));
}
