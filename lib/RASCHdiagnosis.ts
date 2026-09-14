// lib/RASCHdiagnosis.ts
import { getMathTopics } from './Mathstructure';
import { bktUpdate, paramsFor, DEFAULT_BKT } from './RASCHbkt';
import { estimateAbility } from './RASCHtheta';
import type { DifficultyId } from '@/types/Math';
import type { Behavior, Diagnostics, ItemResponse, SpotStat } from '@/types/RASCH';

/**
 * Turning raw responses into a diagnosis.
 *
 * Two ideas do the work here.
 *
 * 1. TIME SEPARATES "DOESN'T KNOW" FROM "RUSHED". Correctness alone cannot tell
 *    a guess from a genuine gap, or solid knowledge from knowledge that only
 *    survives when unhurried. Seconds-on-item can:
 *
 *      wrong + fast  → guess    (not seriously attempted)
 *      wrong + slow  → gap      (real effort, real gap — this is what to study)
 *      right + slow  → fragile  (correct, but it will collapse under exam time)
 *      right + brisk → solid
 *
 *    Same score, four different remedies. A student with 10 "guess" items has a
 *    pacing problem; one with 10 "gap" items has a knowledge problem. Telling
 *    them apart is the whole point.
 *
 * 2. WEAKNESS LIVES AT SUBTOPIC LEVEL. "Algebra 34%" is not actionable.
 *    "Trigonometriya → formulalar: 1/5" is. Every response carries chapterId and
 *    subtopicId already, so the rollup is free.
 */

/**
 * How long a question of each grade *should* take, in seconds. The paper allows
 * 150 min for 45 items — 200s each on average — and harder items deserve more of
 * that budget than easy ones.
 */
export const EXPECTED_SEC: Record<DifficultyId, number> = {
  0: 50,  // beginner
  1: 90,  // easy
  2: 160, // medium
  3: 260, // hard
  4: 400, // olympiad
  5: 320, // expert
};

/** Under this share of the expected time, an answer was not seriously attempted. */
const FAST_RATIO = 0.35;
/** Over this share, the student was labouring. */
const SLOW_RATIO = 1.15;

export function classify(item: ItemResponse): Behavior {
  if (item.chosen === '') return 'skipped';

  const budget = EXPECTED_SEC[item.difficultyId] ?? 160;
  const fast = item.sec < budget * FAST_RATIO;
  const slow = item.sec > budget * SLOW_RATIO;

  if (item.correct) return slow ? 'fragile' : 'solid';
  return fast ? 'guess' : 'gap';
}

const EMPTY_BEHAVIORS = (): Record<Behavior, number> => ({
  solid: 0,
  fragile: 0,
  guess: 0,
  gap: 0,
  skipped: 0,
});

export function chapterKey(topicId: string, chapterId: string): string {
  return `${topicId}:${chapterId}`;
}

export function subtopicKey(topicId: string, chapterId: string, subtopicId: string): string {
  return `${topicId}:${chapterId}:${subtopicId}`;
}

function blankSpot(topicId: string, chapterId: string, subtopicId: string): SpotStat {
  return {
    topicId,
    chapterId,
    subtopicId,
    seen: 0,
    correct: 0,
    sumSec: 0,
    behaviors: EMPTY_BEHAVIORS(),
    lastAt: 0,
  };
}

function fold(spot: SpotStat, item: ItemResponse, at: number): SpotStat {
  const behavior = classify(item);

  // Bayesian Knowledge Tracing. Accuracy says what happened; mastery says what
  // the student KNOWS — discounting the 1-in-4 guess and the careless slip, and
  // allowing for the fact that they may have just learnt it.
  const params = paramsFor(item.difficultyId, item.testType === 'O');
  const prior = spot.mastery ?? DEFAULT_BKT.pInit;
  // An unanswered question is no evidence about knowledge, so it must not move
  // mastery — treating a skip as a wrong answer would punish running out of time.
  const mastery = item.chosen === '' ? prior : bktUpdate(prior, item.correct, params);

  return {
    ...spot,
    seen: spot.seen + 1,
    correct: spot.correct + (item.correct ? 1 : 0),
    sumSec: spot.sumSec + item.sec,
    behaviors: { ...spot.behaviors, [behavior]: (spot.behaviors[behavior] ?? 0) + 1 },
    lastAt: Math.max(spot.lastAt, at),
    mastery,
  };
}

/**
 * Folds a sitting's responses into the running per-chapter/per-subtopic record.
 *
 * Ability is filtered PER SPOT as well: a chapter is a little Rasch measurement
 * of its own, so it carries its own θ — and therefore its own 0–3 level. The
 * items of one sitting that fall in one chapter are estimated together (rather
 * than one at a time), because 4 questions measured jointly say far more than 4
 * separate one-question updates.
 */
export function applyItems(
  previous: Diagnostics | undefined,
  items: ItemResponse[],
  at: number,
): Diagnostics {
  const chapters = { ...(previous?.chapters ?? {}) };
  const subtopics = { ...(previous?.subtopics ?? {}) };

  for (const item of items) {
    const cKey = chapterKey(item.topicId, item.chapterId);
    const sKey = subtopicKey(item.topicId, item.chapterId, item.subtopicId);

    chapters[cKey] = fold(
      chapters[cKey] ?? blankSpot(item.topicId, item.chapterId, ''),
      item,
      at,
    );
    subtopics[sKey] = fold(
      subtopics[sKey] ?? blankSpot(item.topicId, item.chapterId, item.subtopicId),
      item,
      at,
    );
  }

  // Now the ability update, once per spot, from all of this sitting's items in it.
  const byChapter = new Map<string, ItemResponse[]>();
  const bySubtopic = new Map<string, ItemResponse[]>();
  for (const item of items) {
    if (item.chosen === '') continue; // a skip is not evidence about ability
    const cKey = chapterKey(item.topicId, item.chapterId);
    const sKey = subtopicKey(item.topicId, item.chapterId, item.subtopicId);
    byChapter.set(cKey, [...(byChapter.get(cKey) ?? []), item]);
    bySubtopic.set(sKey, [...(bySubtopic.get(sKey) ?? []), item]);
  }

  for (const [key, group] of byChapter) {
    chapters[key] = withFilteredTheta(chapters[key], group, at);
  }
  for (const [key, group] of bySubtopic) {
    subtopics[key] = withFilteredTheta(subtopics[key], group, at);
  }

  return { chapters, subtopics, updatedAt: at };
}

/**
 * Kalman-filters this spot's ability with the evidence from one sitting.
 *
 * The gain does the honest thing on its own: a chapter that showed up once with
 * 2 questions has a huge standard error, so the new measurement barely moves it.
 * Two questions are not a re-measurement of your trigonometry.
 */
function withFilteredTheta(spot: SpotStat, group: ItemResponse[], at: number): SpotStat {
  const observed = estimateAbility(group);

  // First sighting: the measurement IS the estimate.
  if (typeof spot.theta !== 'number' || typeof spot.se !== 'number') {
    return { ...spot, theta: observed.theta, se: observed.se };
  }

  const vPrior = spot.se * spot.se + DRIFT_PER_DAY * Math.max(0, (at - spot.lastAt) / DAY_MS);
  const vObs = Math.max(observed.se * observed.se, 1e-4);
  const gain = vPrior / (vPrior + vObs);

  const theta = spot.theta + gain * (observed.theta - spot.theta);
  const se = Math.sqrt((1 - gain) * vPrior);

  return {
    ...spot,
    theta: Math.round(theta * 1000) / 1000,
    se: Math.round(se * 1000) / 1000,
  };
}

/** Same drift the overall ability filter uses — ability wanders while unobserved. */
const DRIFT_PER_DAY = 0.0025;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Ranking weak spots ─────────────────────────────────────────────────────

/**
 * Prior strength for the shrunk accuracy below. Beta(1.5, 1.5) — worth about
 * three questions of evidence, pulling thin samples toward 50%.
 */
const PRIOR_STRENGTH = 1.5;

/**
 * Success rate, shrunk toward neutral by a Beta prior.
 *
 * Ranking by RAW accuracy is wrong: one unlucky question (0/1) would sit at the
 * top of the weakness list forever, above a real 3/10.
 *
 * A Wilson LOWER bound — the obvious fix, and the one I reached for first — is
 * also wrong, and subtly so: it returns exactly 0 for every 0/n, so 0/1 still
 * outranks 3/10, and it cannot even separate 0/1 from 0/5.
 *
 * The shrunk posterior mean behaves the way a human would:
 *     0/1  → 0.38   (thin evidence, barely moves off neutral)
 *     3/10 → 0.35   (real evidence of trouble — ranks worse)
 *     0/5  → 0.19   (repeated failure — worst, correctly)
 * More evidence of failure ⇒ weaker. That is the property we actually want.
 */
export function shrunkAccuracy(correct: number, seen: number): number {
  return (correct + PRIOR_STRENGTH) / (seen + 2 * PRIOR_STRENGTH);
}

export interface WeakSpot extends SpotStat {
  key: string;
  chapterName: string;
  subtopicName: string;
  accuracy: number;
  /** Ranking score — lower is weaker. */
  score: number;
  avgSec: number;
  dominant: Behavior;
  /** P(mastery) 0–1 from BKT. */
  mastery: number;
}

/** Resolves ids to names from the bundled syllabus — 0 Firestore reads. */
function nameLookup() {
  const topics = getMathTopics();
  const chapterNames = new Map<string, string>();
  const subtopicNames = new Map<string, string>();

  for (const topic of topics) {
    for (const chapter of topic.chapters) {
      chapterNames.set(chapterKey(topic.topicId, chapter.chapterId), chapter.name);
      for (const sub of chapter.subtopics) {
        subtopicNames.set(
          subtopicKey(topic.topicId, chapter.chapterId, sub.subtopicId),
          sub.name,
        );
      }
    }
  }
  return { chapterNames, subtopicNames };
}

function dominantBehavior(behaviors: Record<Behavior, number>): Behavior {
  // Skips are noise here; we want the dominant *answered* behavior.
  const ranked = (['gap', 'guess', 'fragile', 'solid'] as Behavior[])
    .map((b) => [b, behaviors[b] ?? 0] as const)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : 'skipped';
}

/**
 * The subtopics (or chapters) the student is actually weakest at, worst first.
 *
 * `minSeen` guards against ranking on a single question. Spots the student has
 * never met are excluded — an unseen subtopic is unknown, not weak, and
 * pretending otherwise would fill the list with noise.
 */
export function weakestSpots(
  diagnostics: Diagnostics | undefined,
  options: { level?: 'subtopic' | 'chapter'; minSeen?: number; limit?: number } = {},
): WeakSpot[] {
  const { level = 'subtopic', minSeen = 2, limit = 8 } = options;
  if (!diagnostics) return [];

  const { chapterNames, subtopicNames } = nameLookup();
  const source = level === 'chapter' ? diagnostics.chapters : diagnostics.subtopics;

  return Object.entries(source)
    .filter(([, spot]) => spot.seen >= minSeen)
    .map(([key, spot]) => {
      const cKey = chapterKey(spot.topicId, spot.chapterId);
      return {
        ...spot,
        key,
        chapterName: chapterNames.get(cKey) ?? spot.chapterId,
        subtopicName: subtopicNames.get(key) ?? '',
        accuracy: spot.seen > 0 ? Math.round((spot.correct / spot.seen) * 100) : 0,
        score: shrunkAccuracy(spot.correct, spot.seen),
        avgSec: spot.seen > 0 ? Math.round(spot.sumSec / spot.seen) : 0,
        dominant: dominantBehavior(spot.behaviors),
        mastery: spot.mastery ?? DEFAULT_BKT.pInit,
      };
    })
    .sort((a, b) => a.score - b.score || b.seen - a.seen)
    .slice(0, limit);
}

/**
 * Merges two rollups into one — how the "combined" view is produced without
 * storing a third copy of every chapter and subtopic.
 */
export function mergeDiagnostics(
  a: Diagnostics | undefined,
  b: Diagnostics | undefined,
): Diagnostics | undefined {
  if (!a) return b;
  if (!b) return a;

  const mergeSpots = (
    x: Record<string, SpotStat>,
    y: Record<string, SpotStat>,
  ): Record<string, SpotStat> => {
    const out: Record<string, SpotStat> = { ...x };
    for (const [key, spot] of Object.entries(y)) {
      const existing = out[key];
      if (!existing) {
        out[key] = spot;
        continue;
      }
      const behaviors = { ...existing.behaviors };
      for (const [behavior, n] of Object.entries(spot.behaviors)) {
        behaviors[behavior as Behavior] = (behaviors[behavior as Behavior] ?? 0) + n;
      }
      out[key] = {
        ...existing,
        seen: existing.seen + spot.seen,
        correct: existing.correct + spot.correct,
        sumSec: existing.sumSec + spot.sumSec,
        behaviors,
        lastAt: Math.max(existing.lastAt, spot.lastAt),
        // Mastery and θ are estimates, not counts — they cannot be summed. Take
        // the more recently updated ones, which have seen the most evidence.
        mastery: (spot.lastAt >= existing.lastAt ? spot.mastery : existing.mastery) ?? existing.mastery,
        theta: (spot.lastAt >= existing.lastAt ? spot.theta : existing.theta) ?? existing.theta,
        se: (spot.lastAt >= existing.lastAt ? spot.se : existing.se) ?? existing.se,
      };
    }
    return out;
  };

  return {
    chapters: mergeSpots(a.chapters, b.chapters),
    subtopics: mergeSpots(a.subtopics, b.subtopics),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Behaviour totals across everything seen — the pacing/knowledge split. */
export function behaviorTotals(diagnostics: Diagnostics | undefined): Record<Behavior, number> {
  const totals = EMPTY_BEHAVIORS();
  if (!diagnostics) return totals;

  for (const spot of Object.values(diagnostics.chapters)) {
    for (const [behavior, n] of Object.entries(spot.behaviors)) {
      totals[behavior as Behavior] += n;
    }
  }
  return totals;
}
