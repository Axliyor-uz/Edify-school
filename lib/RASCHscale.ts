// lib/RASCHscale.ts
import { DIFFICULTY_LOGIT, GUESS_MC, probCorrect } from './RASCHtheta';
import type { DifficultyId } from '@/types/Math';

/**
 * THE 0–5 MATHEMATICS LEVEL.
 *
 * Ability (θ) and item difficulty (b) live on one scale in Rasch, so a level is
 * not an invented score: it says which difficulty of problem you can actually do.
 * The ladder has THREE rungs, because the bank has three difficulty grades:
 *
 *     top rung  →  you RELIABLY solve hard / olympiad problems (difficultyId 3)
 *     middle    →  …medium problems (difficultyId 2)
 *     bottom    →  …easy problems (difficultyId 1)
 *     floor     →  below the easiest problems in the bank
 *
 * "RELIABLY" is doing real work here, and getting it wrong was a bug worth
 * spelling out. The first version defined a level as the difficulty you are
 * FIFTY-FIFTY on — the textbook Rasch reading. But a coin-flip is not mastery,
 * and it made the scale absurdly lenient: the top rung came out to just 69% of
 * the paper, so a student failing nearly half of it was rated a near-master.
 *
 * A rung therefore means you solve that grade at MASTERY_P (80%), not 50%:
 *
 *     θ(rung R) = b_R + logit(0.8) = b_R + 1.386
 *
 * ── The 0–5 display ──────────────────────────────────────────────────────────
 *
 * The three rungs are STRETCHED onto a 0–5 display scale. This is a change of
 * units and nothing else — the same ability, reported out of five instead of out
 * of three, so every value moves by the same factor:
 *
 *     level = rung × 5/3        1.5 out of 3  ⇔  2.5 out of 5
 *
 * ⚠️ Do NOT "improve" this by re-anchoring each display level to its own
 * difficulty grade (level L = reliably solves difficultyId L−1). That was tried
 * and reverted: the bank has three grades, not five, so two of the five anchors
 * would sit on grades the blueprint never draws — level 5 became unreachable
 * (a perfect 45/45 measured 4.45) and every existing level silently changed
 * meaning, a student at "medium" dropping to "easy" overnight. The stretch keeps
 * the measurement identical and only changes how it is reported.
 *
 * The band names below are the DISPLAY tiers of that stretched scale, which is
 * why they are read off the level, not off a difficulty grade.
 */

export const MASTER_LEVEL = 5;
export const MIN_LEVEL = 0;

/**
 * How reliably you must solve a tier to OWN it. 0.8, not 0.5: being a coin-flip
 * on olympiad problems is not what anyone means by "master of mathematics".
 */
export const MASTERY_P = 0.8;

/** The ability premium that reliability costs, in logits: logit(0.8) ≈ 1.386. */
const RELIABLY = Math.log(MASTERY_P / (1 - MASTERY_P));

/**
 * The floor of the scale: the ability at which a student's answers are barely
 * above pure guessing (~30% of a paper, against a 25% chance floor).
 *
 * It is pinned LOW on purpose. Anchoring level 0 one "difficulty step" below the
 * bottom tier put the floor at θ ≈ −0.8 — which sounds tidy until you notice that
 * a student there still scores 44% of the paper, so EVERY genuinely weak student
 * clamps to exactly 0.00: 7/45, 10/45 and 17/45 all rendered as "0.00", which is
 * where most beginners live. The bottom of the scale needs resolution, not a cliff.
 */
const FLOOR_THETA = -2.5;

/**
 * The ladder the model actually measures: one rung per difficulty grade in the
 * bank. Everything else on this scale is derived from these four points.
 */
const RUNG_ANCHORS: Array<{ rung: number; theta: number }> = [
  { rung: 0, theta: FLOOR_THETA }, // answering at little better than chance
  { rung: 1, theta: DIFFICULTY_LOGIT[1] + RELIABLY }, // reliably solves easy
  { rung: 2, theta: DIFFICULTY_LOGIT[2] + RELIABLY }, // …medium
  { rung: 3, theta: DIFFICULTY_LOGIT[3] + RELIABLY }, // …hard / olympiad
];

/** How many rungs the ladder has — the number of difficulty grades drawn. */
const RUNGS = 3;

/**
 * Rungs → display levels. Derived from MASTER_LEVEL rather than written as a
 * literal 5/3, so changing the display range to 0–10 stays a one-line edit and
 * cannot leave the anchors behind.
 */
const STRETCH = MASTER_LEVEL / RUNGS;

/** (level, θ) anchor points on the DISPLAY scale. Ordered, ascending. */
export const LEVEL_ANCHORS: Array<{ level: number; theta: number }> = RUNG_ANCHORS.map((a) => ({
  level: Math.round(a.rung * STRETCH * 1e6) / 1e6,
  theta: a.theta,
}));

/** Ability in logits → level on the 0–5 scale. */
export function thetaToLevel(theta: number): number {
  const first = LEVEL_ANCHORS[0];
  const last = LEVEL_ANCHORS[LEVEL_ANCHORS.length - 1];

  if (theta <= first.theta) return MIN_LEVEL;
  if (theta >= last.theta) return MASTER_LEVEL;

  for (let i = 1; i < LEVEL_ANCHORS.length; i++) {
    const lo = LEVEL_ANCHORS[i - 1];
    const hi = LEVEL_ANCHORS[i];
    if (theta <= hi.theta) {
      const t = (theta - lo.theta) / (hi.theta - lo.theta);
      const level = lo.level + t * (hi.level - lo.level);
      return Math.round(level * 100) / 100;
    }
  }
  return MASTER_LEVEL;
}

/** Level on the 0–5 scale → ability in logits. The inverse of thetaToLevel. */
export function levelToTheta(level: number): number {
  const clamped = Math.max(MIN_LEVEL, Math.min(MASTER_LEVEL, level));

  for (let i = 1; i < LEVEL_ANCHORS.length; i++) {
    const lo = LEVEL_ANCHORS[i - 1];
    const hi = LEVEL_ANCHORS[i];
    if (clamped <= hi.level) {
      const t = (clamped - lo.level) / (hi.level - lo.level);
      return lo.theta + t * (hi.theta - lo.theta);
    }
  }
  return LEVEL_ANCHORS[LEVEL_ANCHORS.length - 1].theta;
}

/**
 * The chance this student solves a problem of the given difficulty grade.
 * This is what a level MEANS, made concrete — and it is the sentence worth
 * putting on the screen: "at level 1.2 you solve about 55% of easy problems and
 * 22% of medium ones."
 */
export function chanceAt(level: number, difficultyId: DifficultyId): number {
  // Includes the guessing floor: this is the chance the student's ANSWER is
  // right, which is what they actually experience — not the chance they knew it.
  return Math.round(
    probCorrect(levelToTheta(level), DIFFICULTY_LOGIT[difficultyId], GUESS_MC) * 100,
  );
}

/**
 * The band names ARE the difficulty tiers, so the label and the number can never
 * tell different stories: a student at 3.1 is in the "medium" band because 3 is
 * the level that certifies medium problems.
 */
export type LevelBand = 'beginner' | 'simple' | 'easy' | 'medium' | 'hard' | 'olympiad';

/**
 * A name for where the student stands, as a fifth of the display scale.
 *
 * You enter a tier once you are within 0.25 of its level — a uniform rule,
 * unlike the hand-tuned thresholds this replaced (2.85 / 2.25 / 1.5 / 0.75),
 * where the gap to the next band differed at every step for no stated reason.
 *
 * These are DISPLAY tiers of the stretched scale, not difficulty grades: the
 * bank has three grades, the display has five bands, and the two do not line up
 * one-to-one. `olympiad` is reached at level 5 = the top rung = reliably solving
 * difficultyId 3, which is exactly what the old 3/3 meant.
 */
export function levelBand(level: number): LevelBand {
  if (level >= 4.75) return 'olympiad';
  if (level >= 3.75) return 'hard';
  if (level >= 2.75) return 'medium';
  if (level >= 1.75) return 'easy';
  if (level >= 0.75) return 'simple';
  return 'beginner';
}

/**
 * ⚠️ Band → colour does NOT live here. It is a UI concern and it must be ONE
 * table: `app/(student)/raschmodel/_components/LevelBadge.tsx` owns it, shared by
 * the navbar chip, the "My level" card and the hub summary. A `BAND_COLOR` table
 * of raw Tailwind colours (zinc/slate/sky/violet/emerald/amber) used to sit here
 * with zero consumers — raw colours are exactly what the student design system
 * forbids, since the whole tree re-skins from design.config.ts.
 */

/** "1.24" — always two decimals, so the number doesn't jitter in width. */
export function formatLevel(level: number): string {
  return level.toFixed(2);
}

// ─── confidence shrinkage — how much a topic's level may be TRUSTED ──────────

/**
 * Items at which a topic's estimate is worth about 63 % of its face value.
 *
 * `6` because the blueprint's dimensions run from 1 item (Funksiyalar O) to 14
 * (Geometriya): a 2-item dimension lands at 28 % confidence, 6 at 63 %, and 14 at
 * 90 %. Those are the numbers the rule has to be sensible at.
 */
export const CONFIDENCE_ITEMS = 6;

/**
 * How much evidence `n` items are: `1 − e^(−n/CONFIDENCE_ITEMS)`, in [0, 1).
 *
 *     items   0     1     2     4     6     8    14    20
 *     conf   0.00  0.15  0.28  0.49  0.63  0.74  0.90  0.96
 */
export function evidenceConfidence(items: number): number {
  return items > 0 ? 1 - Math.exp(-items / CONFIDENCE_ITEMS) : 0;
}

/**
 * A topic level, shrunk toward a population level by how much evidence backs it:
 * `conf·level + (1 − conf)·population`.
 *
 * ⚠️ **For RANKING topics against each other, not for display.** The level shown
 * on screen is already a shrunk estimate — `estimateAbility` is EAP with an
 * N(0, 1.2) prior, which shrinks toward the population mean by construction — so
 * showing this instead would shrink the same estimate twice and understate every
 * thin dimension. What EAP does NOT fix is the *comparison*: "2 of 2 correct" and
 * "11 of 14 correct" can land at similar levels, and picking the larger as a
 * student's STRONGEST topic is then a coin toss decided by the 2-item dimension.
 * Ranking on the shrunk value makes the thin dimension have to earn it.
 *
 * `population` is the cohort's own mean level for that topic where there is one —
 * the honest "what we would guess before looking at this student".
 */
export function shrinkLevel(level: number, items: number, population: number): number {
  const conf = evidenceConfidence(items);
  return conf * level + (1 - conf) * population;
}
