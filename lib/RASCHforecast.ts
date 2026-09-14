// lib/RASCHforecast.ts
import type { RASCHLevels } from '@/types/RASCH';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';

/**
 * Predicting the next exam score.
 *
 * The honest version of this is a least-squares trend line through the exam
 * scores, extrapolated one exam forward — with two guards, because a raw trend
 * line on three noisy points is worse than useless:
 *
 *   1. SHRINKAGE. With few exams the slope is mostly noise, so it is pulled
 *      toward the student's mean by m/(m+2): at 3 exams only 60% of the
 *      measured trend is believed, at 10 exams 83%. Two lucky exams in a row
 *      cannot forecast a moonshot.
 *   2. A RANGE, not a number. The margin comes from how far the exams actually
 *      scatter around the trend, widened when there are few of them. A single
 *      number would imply a precision this data does not have.
 *
 * Everything is clamped to 0–100 — an extrapolated line will otherwise happily
 * predict 130%.
 *
 * Pure functions over data already in RASCH_levels: no Firestore, no reads.
 */

/** Exams beyond this are ignored — old form is not evidence about next week. */
const WINDOW = 8;

/** Below this many points, |slope| is treated as noise and reported as flat. */
const FLAT_SLOPE = 1.5;

/**
 * Nobody improves more than this per exam, sustained. Without the cap, scoring
 * 10 then 90 fits a +40/exam line and forecasts 100% — a real number produced by
 * two data points and no evidence.
 */
const MAX_SLOPE = 8;

/**
 * A line through two points has zero residuals, so the scatter looks like zero
 * and the band collapses to a confident fiction. Under four exams we don't
 * believe the measured spread and impose a floor.
 */
const SPREAD_FLOOR_SPARSE = 10;
const SPREAD_FLOOR = 5;

export type Direction = 'up' | 'down' | 'flat';
export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface Forecast {
  /** Predicted next score, 0–100. Equals the current level when there is no trend. */
  expected: number;
  /** Plausible band around `expected`, 0–100. */
  low: number;
  high: number;
  /** Believed movement per exam, in points (already shrunk). */
  slope: number;
  direction: Direction;
  confidence: Confidence;
  /** How many exams the forecast is based on. */
  basedOn: number;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Forecasts the next score from a run of past scores.
 * `fallback` (the current level) is used when there is nothing to fit.
 */
export function forecastFrom(scores: number[], fallback: number): Forecast {
  const recent = scores.slice(-WINDOW);
  const m = recent.length;

  // Nothing sat yet — we have no evidence at all, only the self-declared baseline.
  if (m === 0) {
    return {
      expected: clamp(fallback),
      low: clamp(fallback - 20),
      high: clamp(fallback + 20),
      slope: 0,
      direction: 'flat',
      confidence: 'none',
      basedOn: 0,
    };
  }

  // One exam is a point, not a trend.
  if (m === 1) {
    return {
      expected: clamp(recent[0]),
      low: clamp(recent[0] - 15),
      high: clamp(recent[0] + 15),
      slope: 0,
      direction: 'flat',
      confidence: 'low',
      basedOn: 1,
    };
  }

  // Least squares over x = 0 … m-1.
  const xs = recent.map((_, i) => i);
  const xBar = mean(xs);
  const yBar = mean(recent);

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < m; i++) {
    sxy += (xs[i] - xBar) * (recent[i] - yBar);
    sxx += (xs[i] - xBar) ** 2;
  }
  const rawSlope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yBar - rawSlope * xBar;

  // Shrink the trend toward "no trend" — few points, little belief — then cap
  // it, so a wild pair of exams can't fit a rocket.
  const shrink = m / (m + 2);
  const shrunk = rawSlope * shrink;
  const slope = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, shrunk));

  // Extrapolate one exam past the last one, from the believed slope.
  const expectedRaw = yBar + slope * (m - xBar);

  // Spread of the actual scores around the fitted line.
  let sse = 0;
  for (let i = 0; i < m; i++) {
    sse += (recent[i] - (intercept + rawSlope * xs[i])) ** 2;
  }
  const residualSd = m > 2 ? Math.sqrt(sse / (m - 2)) : Math.sqrt(sse / m);
  const measured = Number.isFinite(residualSd) ? residualSd : 0;
  const spread = Math.max(measured, m < 4 ? SPREAD_FLOOR_SPARSE : SPREAD_FLOOR);

  // Fewer exams → wider band.
  const margin = spread * (1 + 2 / m);

  const direction: Direction =
    Math.abs(slope) < FLAT_SLOPE ? 'flat' : slope > 0 ? 'up' : 'down';

  const confidence: Confidence =
    m >= 6 && spread < 12 ? 'high' : m >= 4 ? 'medium' : 'low';

  return {
    expected: clamp(expectedRaw),
    low: clamp(expectedRaw - margin),
    high: clamp(expectedRaw + margin),
    slope: Math.round(slope * 10) / 10,
    direction,
    confidence,
    basedOn: m,
  };
}

/** Forecast of the next exam's overall score. */
export function forecastOverall(levels: RASCHLevels): Forecast {
  const scores = levels.exams.map((e) => e.score);
  const fallbackLevel = Math.round(
    mean(TOPIC_KEYS.map((k) => levels.topics[k]?.level ?? 0)),
  );
  return forecastFrom(scores, fallbackLevel);
}

/** Forecast per topic — where the next exam is likely to gain or lose points. */
export function forecastByTopic(levels: RASCHLevels): Record<TopicKey, Forecast> {
  const out = {} as Record<TopicKey, Forecast>;
  for (const key of TOPIC_KEYS) {
    const topic = levels.topics[key];
    out[key] = forecastFrom(topic?.scores ?? [], topic?.level ?? 0);
  }
  return out;
}
