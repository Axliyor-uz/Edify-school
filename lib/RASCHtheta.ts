// lib/RASCHtheta.ts
import { EXAM_BLUEPRINT, DIFFICULTY_BAND } from './Examblueprint';
import type { DifficultyId } from '@/types/Math';
import type { Ability, ItemResponse } from '@/types/RASCH';

/**
 * The Rasch model — the thing this feature is named after, finally doing the work.
 *
 * WHY, in one paragraph. A percent-correct score confounds two different things:
 * how good the student is, and how hard the paper happened to be. The exam
 * sampler draws 45 random items, so an easy draw flatters and a hard draw
 * punishes — and the level moves for reasons that have nothing to do with
 * learning. Rasch separates them. It places student ability (θ) and item
 * difficulty (b) on ONE logit scale, where the chance of a correct answer is
 *
 *     P(correct) = 1 / (1 + e^-(θ - b))
 *
 * θ = b means a 50/50 shot. A student one logit above an item's difficulty gets
 * it right ~73% of the time. Because difficulty is modelled explicitly, θ from a
 * hard paper is directly comparable to θ from an easy one — which percent-correct
 * never is.
 *
 * ITEM DIFFICULTY. Real Rasch calibrates b from thousands of responses. We do
 * not have those yet, so b is ANCHORED to the difficultyId the bank already
 * carries (1/2/3). That is an approximation, and it is stated as one — see
 * scripts/analyzeItems.ts, which calibrates real difficulties from response data
 * once enough students have answered each item, and can then override these
 * anchors.
 *
 * ESTIMATION. θ is estimated by EAP (expected a posteriori) over a grid, with a
 * N(0, 1) prior — not maximum likelihood. MLE is the textbook choice but it
 * diverges to ±∞ on a perfect or a zero score, which for a 2-item topic happens
 * constantly. The prior keeps every estimate finite and hands back an honest
 * standard error instead of a fantasy.
 *
 * GUESSING — and this one is not optional. Pure Rasch (1PL) says a student far
 * below an item's difficulty essentially never gets it right. On a FOUR-OPTION
 * multiple-choice paper that is simply false: they get it right one time in four,
 * for free. Ignoring that hands every lucky hit to "ability", and θ inflates.
 *
 * Measured on real data: a student scoring 28/45 (63% on medium, 62% on hard)
 * came out at θ = 0.82 — "near master" — when subtracting the 25% floor shows
 * they genuinely knew about half the material. So the lower asymptote is modelled:
 *
 *     P(correct) = c + (1 − c) · σ(θ − b)
 *
 * with c = 0.25 for multiple choice and c = 0.05 for the open (O) questions,
 * which cannot be guessed. This is the 3PL floor, and it is arithmetic, not a
 * tunable: four options is four options.
 */

/**
 * Difficulty anchors, in logits, for the bank's three difficulty grades.
 * Chosen so a "medium" item sits at the origin: a student at θ=0 is a coin-flip
 * on medium, comfortable on easy (~73%), and struggling on hard (~23%).
 */
export const DIFFICULTY_LOGIT: Record<DifficultyId, number> = {
  0: -2.0, // beginner
  1: -1.0, // easy
  2: 0.0, // medium
  3: 1.2, // hard
  4: 2.5, // olympiad
  5: 1.9, // expert
};

/**
 * The guessing floor. A four-option question is answered correctly 1 time in 4
 * by someone who knows nothing — that is arithmetic, not a parameter to taste.
 */
export const GUESS_MC = 0.25;
/** An open (O) question cannot be guessed: you either produce the answer or not. */
export const GUESS_OPEN = 0.05;

export function guessFor(testType: string): number {
  return testType === 'O' ? GUESS_OPEN : GUESS_MC;
}

/** An item as the model sees it: a difficulty and a guessing floor. */
export interface PaperItem {
  b: number;
  c: number;
}

/** Grid for the EAP integral. ±4 logits covers everything a human can score. */
const GRID_MIN = -4;
const GRID_MAX = 4;
const GRID_STEP = 0.05;

/** Prior N(0, PRIOR_SD²) — the population we assume before seeing any answers. */
const PRIOR_SD = 1.2;

/**
 * An item's difficulty in logits.
 *
 * Prefers the CALIBRATED value measured from real responses (written onto the
 * question document by scripts/analyzeItems.ts, so it arrives free with a
 * question the exam already read). Falls back to the difficultyId anchor for
 * items nobody has answered enough times yet — so the estimate improves
 * silently as the bank gets used, with no migration and no extra reads.
 */
export function itemDifficulty(item: Pick<ItemResponse, 'difficultyId' | 'b'>): number {
  if (typeof item.b === 'number' && Number.isFinite(item.b)) return item.b;
  return DIFFICULTY_LOGIT[item.difficultyId] ?? 0;
}

/**
 * P(correct) with a guessing floor: c + (1 − c)·σ(θ − b).
 *
 * With c = 0 this is plain Rasch. With c = 0.25 it is what actually happens on a
 * four-option paper — and the difference is not cosmetic: at θ = b it is the gap
 * between 50% and 62%.
 */
export function probCorrect(theta: number, b: number, c = 0): number {
  return c + (1 - c) / (1 + Math.exp(-(theta - b)));
}

/**
 * The standard paper: the difficulty mix the blueprint actually produces
 * (32 medium Y-1 items, 13 hard Y-2/O items). `expected` is the score this
 * student would get on THIS mix — so it is comparable across sittings no matter
 * what the sampler happened to draw.
 */
export const STANDARD_PAPER: PaperItem[] = EXAM_BLUEPRINT.flatMap((section) => {
  const band = section.difficulties ?? DIFFICULTY_BAND[section.testType];
  // A section's items are spread across its band; use the band's mean difficulty.
  // reduce<number>: `0` is a valid DifficultyId now, so TS would otherwise infer
  // the accumulator as DifficultyId and reject the running sum.
  const b = band.reduce<number>((sum, d) => sum + DIFFICULTY_LOGIT[d], 0) / band.length;
  const c = guessFor(section.testType);
  return Array.from({ length: section.count }, () => ({ b, c }));
});

/** Expected % correct on the standard paper at ability θ — the sum of P(correct). */
export function expectedScore(theta: number, paper: PaperItem[] = STANDARD_PAPER): number {
  if (paper.length === 0) return 0;
  const sum = paper.reduce((acc, item) => acc + probCorrect(theta, item.b, item.c), 0);
  return Math.round((sum / paper.length) * 100);
}

/**
 * Estimates ability from a set of scored responses.
 *
 * Unanswered items are DROPPED, not counted as wrong: a question the student
 * never reached says nothing about ability, and treating skips as errors would
 * punish anyone who ran out of time.
 */
export function estimateAbility(items: ItemResponse[]): Ability {
  const scored = items.filter((i) => i.chosen !== '');

  if (scored.length === 0) {
    // No evidence at all — fall back to the prior itself.
    return { theta: 0, se: PRIOR_SD, expected: expectedScore(0), items: 0 };
  }

  let wSum = 0;
  let wTheta = 0;
  let wTheta2 = 0;

  for (let theta = GRID_MIN; theta <= GRID_MAX + 1e-9; theta += GRID_STEP) {
    // log-likelihood, kept in logs so 45 factors don't underflow
    let logL = -(theta * theta) / (2 * PRIOR_SD * PRIOR_SD); // log prior
    for (const item of scored) {
      // The guessing floor belongs INSIDE the likelihood: without it, a correct
      // answer on a hard item is treated as proof of ability when it may just be
      // one-in-four luck.
      const p = probCorrect(theta, itemDifficulty(item), guessFor(item.testType));
      // Clamp: a p of exactly 0 or 1 would make log(p) infinite.
      const pc = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
      logL += item.correct ? Math.log(pc) : Math.log(1 - pc);
    }
    const w = Math.exp(logL);
    wSum += w;
    wTheta += w * theta;
    wTheta2 += w * theta * theta;
  }

  if (!(wSum > 0) || !Number.isFinite(wSum)) {
    return { theta: 0, se: PRIOR_SD, expected: expectedScore(0), items: scored.length };
  }

  const theta = wTheta / wSum;
  const variance = Math.max(0, wTheta2 / wSum - theta * theta);
  const se = Math.sqrt(variance);

  return {
    theta: Math.round(theta * 1000) / 1000,
    se: Math.round(se * 1000) / 1000,
    expected: expectedScore(theta),
    items: scored.length,
  };
}

/**
 * The band around `expected` implied by the standard error — the honest version
 * of a level. A 2-item topic produces a huge band, and it should.
 */
export function expectedRange(ability: Ability): { low: number; high: number } {
  return {
    low: expectedScore(ability.theta - ability.se),
    high: expectedScore(ability.theta + ability.se),
  };
}
