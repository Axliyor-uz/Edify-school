// lib/RASCHdynamic.ts
import { probCorrect, expectedScore, STANDARD_PAPER, type PaperItem } from './RASCHtheta';
import type { Ability } from '@/types/RASCH';

/**
 * DYNAMIC RASCH — ability that moves.
 *
 * Plain Rasch is a MEASUREMENT model, not a learning model. It assumes θ is
 * fixed while it estimates P(correct) = σ(θ − b). It has no mechanism at all for
 * "the student studied for two weeks and got better", which is precisely the
 * thing a student wants predicted.
 *
 * The fix is to let θ follow a random walk between sittings and filter it — a
 * Kalman filter over the latent ability (this is what "dynamic Rasch" means, and
 * it is the same family as Elo/Glicko, which are just this filter with the
 * variance bookkeeping simplified away):
 *
 *   PREDICT   between sittings, uncertainty GROWS: v⁻ = v + q · Δdays
 *             (a student you haven't measured for a month could have moved)
 *   UPDATE    a new sitting measures θ with its own error: v_obs = se²
 *             K = v⁻ / (v⁻ + v_obs)                    ← how much to believe it
 *             θ ← θ + K · (θ_obs − θ)
 *             v ← (1 − K) · v⁻                         ← and uncertainty shrinks
 *
 * The gain K does the sensible thing automatically: a 45-item exam (small se)
 * moves the estimate a lot; a 10-item drill (large se) nudges it. No hand-tuned
 * learning rate.
 *
 * PREDICTION then works the way it should — NOT by extrapolating a percentage:
 *   1. project θ forward by the measured learning rate,
 *   2. compute P(correct) = σ(θ − bᵢ) for every item on the paper,
 *   3. sum them. Σ P is the expected score.
 */

/** Drift per day, in logits² — how fast ability can plausibly move unobserved. */
const DRIFT_PER_DAY = 0.0025; // ≈ 0.3 logits of uncertainty added per year idle

/** Learning rates beyond this are not believed — nobody gains 1 logit/week forever. */
const MAX_RATE_PER_DAY = 0.05;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One measurement of ability, at a moment in time. */
export interface ThetaPoint {
  at: number;
  /** The filtered (posterior) ability after this sitting. */
  theta: number;
  /** Posterior standard error. */
  se: number;
  /** What was measured from this sitting alone, before filtering. */
  observed: number;
  kind: 'exam' | 'practice';
}

/**
 * Folds one sitting's measurement into the running ability estimate.
 *
 * `prior` is the filtered state from last time (null on the first sitting).
 */
export function filterTheta(
  prior: { theta: number; se: number; at: number } | null,
  observation: Ability,
  at: number,
  kind: 'exam' | 'practice',
): ThetaPoint {
  // No history: the sitting IS the estimate.
  if (!prior) {
    return { at, theta: observation.theta, se: observation.se, observed: observation.theta, kind };
  }

  const days = Math.max(0, (at - prior.at) / DAY_MS);

  // PREDICT — uncertainty grows while we weren't looking.
  const vPredicted = prior.se * prior.se + DRIFT_PER_DAY * days;

  // UPDATE — weight the new sitting by how precise it actually is.
  const vObserved = Math.max(observation.se * observation.se, 1e-4);
  const gain = vPredicted / (vPredicted + vObserved);

  const theta = prior.theta + gain * (observation.theta - prior.theta);
  const variance = (1 - gain) * vPredicted;

  return {
    at,
    theta: Math.round(theta * 1000) / 1000,
    se: Math.round(Math.sqrt(variance) * 1000) / 1000,
    observed: observation.theta,
    kind,
  };
}

/** The measured learning rate, in logits per day, with its own uncertainty. */
export interface LearningRate {
  /** Logits gained per day. Positive = learning. */
  perDay: number;
  /** Standard error of that slope. */
  se: number;
  /** Sittings the rate is based on. */
  points: number;
  /** Logits per week — the human-readable version. */
  perWeek: number;
}

/**
 * Fits the trend of θ over TIME (not over "sitting number" — two exams a day
 * apart and two a month apart say very different things about learning speed).
 *
 * TWO SUBTLETIES, both of which I got wrong first time and the tests caught:
 *
 * 1. The trend is fitted to the RAW per-sitting measurements (`observed`), NOT
 *    to the filtered θ. A Kalman filter is *designed* to lag — that is what
 *    smoothing means — so fitting a trend to its output systematically
 *    under-reads how fast the student is actually improving. In simulation, a
 *    student truly gaining 0.10 logits/week was measured at 0.04 that way: the
 *    filter's own inertia read as "barely learning", and "days to target" came
 *    back wildly pessimistic. The raw measurements are noisier but unbiased, and
 *    the slope's standard error already accounts for that noise.
 *
 * 2. Only EXAM sittings count, when there are enough of them. Practice is
 *    untimed and its ability estimate runs flattering, so letting drills into the
 *    trend would manufacture a learning rate out of the change of conditions
 *    rather than the student getting better.
 *
 * The slope is then shrunk toward zero when the evidence is thin, and hard
 * capped: two lucky exams must not extrapolate into a genius.
 */
export function learningRate(trace: ThetaPoint[]): LearningRate {
  const exams = trace.filter((p) => p.kind === 'exam');
  const source = exams.length >= 2 ? exams : trace;

  const points = source.length;
  if (points < 2) return { perDay: 0, se: 0, points, perWeek: 0 };

  const t0 = source[0].at;
  const xs = source.map((p) => (p.at - t0) / DAY_MS);
  const ys = source.map((p) => p.observed);

  const xBar = xs.reduce((a, b) => a + b, 0) / points;
  const yBar = ys.reduce((a, b) => a + b, 0) / points;


  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < points; i++) {
    sxy += (xs[i] - xBar) * (ys[i] - yBar);
    sxx += (xs[i] - xBar) ** 2;
  }
  // All sittings on the same day: no time base, so no rate can be inferred.
  if (sxx < 1e-6) return { perDay: 0, se: 0, points, perWeek: 0 };

  const rawSlope = sxy / sxx;

  // Shrink toward "no learning" when the evidence is thin.
  const shrink = points / (points + 2);
  const slope = Math.max(-MAX_RATE_PER_DAY, Math.min(MAX_RATE_PER_DAY, rawSlope * shrink));

  // Residual scatter → standard error of the slope.
  let sse = 0;
  const intercept = yBar - rawSlope * xBar;
  for (let i = 0; i < points; i++) sse += (ys[i] - (intercept + rawSlope * xs[i])) ** 2;
  const residualVar = points > 2 ? sse / (points - 2) : sse / Math.max(1, points);
  const se = Math.sqrt(Math.max(residualVar, 1e-6) / sxx);

  return {
    perDay: Math.round(slope * 10000) / 10000,
    se: Math.round(se * 10000) / 10000,
    points,
    perWeek: Math.round(slope * 7 * 100) / 100,
  };
}

export interface ScorePrediction {
  /** Expected score on a standard paper, 0–100 — the SUM of P(correct). */
  expected: number;
  low: number;
  high: number;
  /** The projected ability this is computed from. */
  theta: number;
  se: number;
  /** Days ahead of the last measurement. */
  horizonDays: number;
}

/**
 * Predicts the score on a future paper.
 *
 * This is the honest pipeline, and it is NOT "fit a line through past
 * percentages":
 *
 *   θ_future = θ_now + rate · days        ← the learning model supplies this
 *   P(item i) = σ(θ_future − bᵢ)          ← Rasch supplies this
 *   score     = Σᵢ P(item i)              ← the expected number correct
 *
 * The band is not decoration: uncertainty in θ, drift over the horizon, and
 * uncertainty in the learning rate itself all compound, so predicting further
 * ahead is honestly less certain — and the band widens to say so.
 */
export function predictScore(
  current: { theta: number; se: number } | null,
  rate: LearningRate,
  horizonDays = 0,
  paper: PaperItem[] = STANDARD_PAPER,
): ScorePrediction | null {
  if (!current) return null;

  const theta = current.theta + rate.perDay * horizonDays;

  // Everything that makes the future uncertain, added in variance:
  const variance =
    current.se * current.se + // how well we know ability today
    DRIFT_PER_DAY * horizonDays + // ability wanders
    (rate.se * horizonDays) ** 2; // and we don't know the learning rate exactly
  const se = Math.sqrt(variance);

  return {
    expected: expectedScore(theta, paper),
    low: expectedScore(theta - se, paper),
    high: expectedScore(theta + se, paper),
    theta: Math.round(theta * 1000) / 1000,
    se: Math.round(se * 1000) / 1000,
    horizonDays,
  };
}

/** P(correct) for each item on a paper — the raw material of the sum above. */
export function itemProbabilities(theta: number, paper: PaperItem[] = STANDARD_PAPER): number[] {
  return paper.map((item) => probCorrect(theta, item.b, item.c));
}

/**
 * How many days of study, at the current rate, to reach a target score.
 * Null when the target is already met, or when the student isn't improving.
 */
export function daysToTarget(
  current: { theta: number },
  rate: LearningRate,
  targetPercent: number,
  paper: PaperItem[] = STANDARD_PAPER,
): number | null {
  if (expectedScore(current.theta, paper) >= targetPercent) return null;
  if (rate.perDay <= 0.0005) return null; // not improving — no honest answer exists

  for (let days = 1; days <= 365; days++) {
    if (expectedScore(current.theta + rate.perDay * days, paper) >= targetPercent) return days;
  }
  return null;
}
