// lib/RASCHbkt.ts
import type { DifficultyId } from '@/types/Math';

/**
 * BAYESIAN KNOWLEDGE TRACING — mastery of a subtopic, updated answer by answer.
 *
 * Rasch gives ONE number for the whole student. BKT gives a probability that the
 * student has mastered EACH SKILL, and — unlike Rasch — it is a learning model:
 * mastery can transition from not-known to known while they practise.
 *
 * Two steps per answer.
 *
 * 1. EVIDENCE (Bayes). What does this answer say about mastery already held?
 *    The trick is that an answer is NOT proof either way, because:
 *      - SLIP:  a student who knows it can still get it wrong (careless)
 *      - GUESS: a student who doesn't can still get it right (1-in-4 on an MC)
 *
 *      P(M | correct) = P(M)(1−slip) / [ P(M)(1−slip) + (1−P(M))·guess ]
 *      P(M | wrong)   = P(M)·slip    / [ P(M)·slip    + (1−P(M))(1−guess) ]
 *
 *    This is why one lucky guess does not mint mastery, and one careless slip
 *    does not destroy it — the very thing a raw "4/6 correct" cannot express.
 *
 * 2. LEARNING (transition). Having just engaged with the material, an unmastered
 *    student may have LEARNT it:
 *
 *      P(M)' = P(M | answer) + (1 − P(M | answer)) · P(learn)
 *
 *    This second step is what makes it a learning model rather than a scoreboard.
 *
 * PARAMETERS. Properly, slip/guess/learn are FIT from data per skill. These are
 * sensible defaults, not measurements, and are labelled as such: guess is pinned
 * to the real chance of a 4-option multiple-choice guess, and slip rises with
 * difficulty (hard items invite careless errors even when you know the method).
 * scripts/analyzeItems.ts is where fitting them from real response data belongs
 * once there is enough of it.
 */

export interface BktParams {
  /** Mastery assumed before any evidence. */
  pInit: number;
  /** Chance of learning the skill from one engagement with it. */
  pLearn: number;
  /** Chance of answering wrong despite mastery. */
  pSlip: number;
  /** Chance of answering right without mastery. */
  pGuess: number;
}

/**
 * A 4-option multiple choice question can be guessed 1 time in 4 — that is not a
 * tunable, it is arithmetic, and pretending otherwise inflates every mastery
 * estimate on the platform.
 */
const MC_GUESS = 0.25;

/** Open (O) questions cannot be guessed — you either produce the answer or you don't. */
const OPEN_GUESS = 0.05;

const SLIP_BY_DIFFICULTY: Record<DifficultyId, number> = {
  0: 0.04, // beginner
  1: 0.06, // easy
  2: 0.10, // medium
  3: 0.16, // hard
  4: 0.25, // olympiad
  5: 0.20, // expert
};

export const DEFAULT_BKT: BktParams = {
  pInit: 0.25,
  pLearn: 0.12,
  pSlip: 0.10,
  pGuess: MC_GUESS,
};

export function paramsFor(difficultyId: DifficultyId, isOpen: boolean): BktParams {
  return {
    ...DEFAULT_BKT,
    pSlip: SLIP_BY_DIFFICULTY[difficultyId] ?? 0.1,
    pGuess: isOpen ? OPEN_GUESS : MC_GUESS,
  };
}

/**
 * One BKT step: Bayes on the evidence, then the learning transition.
 * `prior` is P(mastery) before this answer; the return is P(mastery) after.
 */
export function bktUpdate(prior: number, correct: boolean, params: BktParams): number {
  const p = Math.min(Math.max(prior, 0.001), 0.999);
  const { pSlip, pGuess, pLearn } = params;

  const posterior = correct
    ? (p * (1 - pSlip)) / (p * (1 - pSlip) + (1 - p) * pGuess)
    : (p * pSlip) / (p * pSlip + (1 - p) * (1 - pGuess));

  // The learning step — an unmastered student may have just picked it up.
  const withLearning = posterior + (1 - posterior) * pLearn;

  return Math.min(Math.max(withLearning, 0.001), 0.999);
}

/** Probability the student answers the NEXT question of this skill correctly. */
export function predictNext(mastery: number, params: BktParams = DEFAULT_BKT): number {
  return mastery * (1 - params.pSlip) + (1 - mastery) * params.pGuess;
}

/** Mastered enough to stop drilling it. The usual BKT convention. */
export const MASTERY_THRESHOLD = 0.95;

export function isMastered(mastery: number): boolean {
  return mastery >= MASTERY_THRESHOLD;
}
