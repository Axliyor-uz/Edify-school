// lib/RASCHmarks.ts
//
// DYNAMIC MARKS — what each question on a paper is worth, priced from how the
// cohort actually answered it.
//
// A question's ball is a GUARANTEED BASE plus a share of the paper's
// difficulty budget:
//
//     Bᵢ = Yᵢ + σᵢ
//
//     Yᵢ  = BASE_BALL[testType]        1.1 · Y-1   1.3 · Y-2   1.6 · O
//     p̂ᵢ  = (correct + 1.5)/(seen + 3)              shrunk share correct
//     dᵢ  = 1 − p̂ᵢ                                   difficulty
//     wᵢ  = dᵢ²                                      difficulty weight
//     σᵢ  = (PAPER_TOTAL − ΣY) · wᵢ / Σw             the bonus
//
// On the DTM maths paper — 32 Y-1, 3 Y-2, 10 O — the bases come to
// 32(1.1) + 3(1.3) + 10(1.6) = **55.1**, so the difficulty budget shared out
// across the 45 questions is exactly **44.9**, and the paper sums to 100 by
// construction. The student's score is then the balls they earned, out of that
// 100 (`normalizedScore`).
//
// Two things the formula buys, and they are the whole design:
//   1. **Every question is worth something.** A question the whole class solved
//      still carries its base, so an easy paper does not collapse to nothing.
//   2. **Difficulty is paid out of a FIXED budget.** The 44.9 goes where the
//      cohort struggled, in proportion to d² — flat at the easy end (90 % and
//      80 % solved barely differ), steep at the hard end (20 % and 10 % differ a
//      lot), which is where a mark scheme should discriminate.
//
// ⚠️ **The bonus is RELATIVE and that is deliberate here.** σᵢ depends on the
// other 44 questions through Σw: the same question takes a bigger slice of the
// same 44.9 on a paper where everything else was easy. The BASE is what is
// absolute. That is the trade that keeps the paper at exactly 100 with no
// scaling pass — see the history below.
//
// ── three earlier designs, and why they went ────────────────────────────────
//   1. **A per-SECTION budget** (2026-07-29). Each blueprint row kept its
//      printed total and its questions permuted the balls inside it, so the
//      hardest question on the paper could be worth less than an easy one in a
//      richer row.
//   2. **Whole-paper allocation renormalised to exactly 100** (2026-07-29).
//      Balls were priced against each other and rescaled; the rescaling
//      collapsed them onto a handful of values.
//   3. **An absolute 1.3 … 6.0 curve, capped at 100** (2026-07-29 → 2026-08-01).
//      `ball = 1.3 + 4.7·d²`, priced per question and then scaled down by one
//      factor whenever the 45 would pass 100. Comparable across papers in
//      principle — but the cap bound on nearly every real paper, so the
//      "absolute" ball was scaled in practice anyway, and a displayed ball could
//      then sit below its own documented floor. `BALL_MIN`, `BALL_MAX`,
//      `BALL_SPAN`, `ballFor` and `capBalls` went with it.
//
// Pure: no Firestore, no React. Contract + traps: docs/RASCH_QUIZ.md.

import { sectionBalls } from './Examblueprint';
import { examSlotKeys } from './ExamTeacher';
import type { ExamQuestion, TestType } from '@/types/Exam';

/** What a paper is worth, exactly — and what a score is out of. */
export const PAPER_TOTAL = 100;

/**
 * The GUARANTEED base of one question, by test type — the `Yᵢ` of `Bᵢ = Yᵢ + σᵢ`.
 *
 * It is what the question is worth before the cohort has said anything, and no
 * amount of "everybody solved it" takes it away. The ladder follows how much a
 * question ASKS of a student, which is exactly what the three types encode: an
 * open item (`O`) must be produced rather than picked, a `Y-2` needs adaptation,
 * a `Y-1` is a closed item with one right answer.
 *
 * ⚠️ **These are floors, not the printed DTM values** (1.3 / 2.2 / 3.2, still
 * shown struck through as `SlotMark.printedBall`). They are deliberately lower:
 * the gap between the bases and 100 IS the difficulty budget, and a bigger floor
 * would leave less of the paper for the cohort to price.
 */
export const BASE_BALL: Record<TestType, number> = { 'Y-1': 1.1, 'Y-2': 1.3, O: 1.6 };

/**
 * The share of the paper the bases may occupy, used ONLY to rescue a degenerate
 * paper (see `baseBalls`).
 *
 * `0.551` is not a knob — it is the DTM 45-slot paper's own split, 55.1 of base
 * to 44.9 of difficulty. A paper long enough that its bases alone would reach
 * 100 is pulled back to that same balance rather than to an invented one.
 */
export const BASE_SHARE = 0.551;

/**
 * The exponent on difficulty in the weight `wᵢ = dᵢ^BALL_CURVE`.
 *
 * `2` (a square) is deliberately convex, not linear: on a linear ramp a question
 * solved by 90 % and one solved by 80 % pull the same amount of budget apart as
 * 20 % and 10 % do — noise dressed as a judgement at one end, a real distinction
 * at the other. Squaring compresses the easy end and stretches the hard end, so
 * the budget flows to the questions that actually separated the class.
 *
 * ⚠️ It is a marking curve, not the statistics. Ability is estimated by the 3PL
 * EAP model in [lib/RASCHtheta.ts](RASCHtheta.ts) and is untouched by this file
 * — see docs/RASCH_QUIZ.md on why the two must not be conflated.
 */
export const BALL_CURVE = 2;

/**
 * Responses below which a ball is FLAGGED as still settling.
 *
 * ⚠️ **It is a label, not a switch.** A question is priced from the moment one
 * student has answered it — the ball on screen is always the current one, and
 * `provisional` only tells the teacher how much to lean on it. The shrunk `p̂`
 * (`PRIOR_WEIGHT`) is what keeps a thin item honest, continuously and per
 * question rather than all-or-nothing.
 */
export const MIN_RESPONSES = 5;

/**
 * Shrinkage toward `PRIOR_P`, in "imaginary responses".
 *
 * Two questions at 1/6 and 0/6 are barely distinguishable, and shrinking both
 * toward 0.5 keeps a single lucky answer from taking a large slice of the
 * difficulty budget. It is also what prices a question NOBODY has answered yet:
 * p̂ = 0.5, so it draws the neutral weight (0.25) and an unsat paper spreads its
 * budget evenly instead of guessing.
 */
export const PRIOR_WEIGHT = 3;
export const PRIOR_P = 0.5;

/** Balls carry TWO decimals. One decimal collapses the bonuses onto a handful of
 *  values, which is the discreteness this design exists to remove. */
const round2 = (v: number) => Math.round(v * 100) / 100;

/** How one slot went, across everybody who has sat the paper. */
export interface ItemStat {
  seen: number;
  correct: number;
}

/** One numbered question on the paper, marked. */
export interface SlotMark {
  /** `examSlotKeys` — the id shared by ItemResponse, the stored outcome map and this. */
  key: string;
  /** Its position on the paper (1…45). */
  number: number;
  sectionId: string;
  testType: TestType;
  seen: number;
  correct: number;
  /** Raw proportion correct, or `null` when nobody has answered it yet. */
  p: number | null;
  /** The guaranteed base for this question's test type — the `Yᵢ`. */
  base: number;
  /** What this question is worth: `base` + its share of the difficulty budget. */
  ball: number;
  /** What the protocol prints in this position, before any repricing. */
  printedBall: number;
  /**
   * What this question's section adds up to under the marks in force.
   *
   * ⚠️ **Reported, not reserved.** The paper is priced as a whole and a section's
   * total MOVES — a row full of questions the class found hard is worth more than
   * the protocol prints it, and that is the point.
   */
  sectionTotal: number;
  /** Fewer than `MIN_RESPONSES` answers — the ball is live but still moving. */
  provisional: boolean;
}

export interface PaperSlot {
  key: string;
  number: number;
  sectionId: string;
  testType: TestType;
}

/** The paper's slots in order, with the position each is printed under. */
export function paperSlots(questions: ExamQuestion[]): PaperSlot[] {
  return questions.flatMap((q) =>
    examSlotKeys(q).map((key, i) => ({
      key,
      number: q.slotNumber + i,
      sectionId: q.sectionId,
      testType: q.testType,
    })),
  );
}

/**
 * Every stored sitting → per-slot counts.
 *
 * ⚠️ A result saved before `items` existed contributes NOTHING, not zeros: it
 * has no per-question record, and counting it as "seen but wrong" would make
 * every question of an old paper look impossible.
 */
export function cohortStats(results: { items?: Record<string, number> }[]): Map<string, ItemStat> {
  const stats = new Map<string, ItemStat>();
  for (const r of results) {
    if (!r.items) continue;
    for (const [key, value] of Object.entries(r.items)) {
      const stat = stats.get(key) ?? { seen: 0, correct: 0 };
      stat.seen += 1;
      stat.correct += value ? 1 : 0;
      stats.set(key, stat);
    }
  }
  return stats;
}

/** Shrunk proportion correct — see `PRIOR_WEIGHT`. */
export function shrunkP(stat: ItemStat): number {
  return (stat.correct + PRIOR_WEIGHT * PRIOR_P) / (stat.seen + PRIOR_WEIGHT);
}

/**
 * A question's claim on the difficulty budget — `w = (1 − p̂)^BALL_CURVE`.
 *
 * ⚠️ **A weight, not a mark.** It is meaningless on its own; what a question is
 * worth is `base + budget · w/Σw`, which is why nothing outside `paperMarks`
 * should price anything from it. A slot nobody has answered gets the prior
 * (p̂ = 0.5 → w = 0.25), so it neither gains nor loses against a measured item
 * that landed at the same solve rate.
 *
 *     solved  100%   90%   80%   70%   60%   50%   40%   30%   20%   10%    0%
 *     w       0.00  0.01  0.04  0.09  0.16  0.25  0.36  0.49  0.64  0.81  1.00
 *
 * ⚠️ **The ends are asymptotes in practice, because `p̂` is SHRUNK**: 20 of 20
 * solved reads p̂ = 0.93 and weighs 0.005, not 0; 0 of 20 weighs 0.88, not 1.
 * That is deliberate — one lucky answer must not move a mark — and the gap
 * closes as the cohort grows.
 */
export function difficultyWeight(stat: ItemStat | undefined): number {
  const p = stat && stat.seen > 0 ? shrunkP(stat) : PRIOR_P;
  return (1 - p) ** BALL_CURVE;
}

/**
 * Rounds to two decimals so the parts still add to the whole.
 *
 * ⚠️ Rounding each ball on its own does NOT: 45 roundings drift, and a paper
 * marked out of 100 that adds to 99.87 is unreadable. Largest-remainder in
 * hundredths lands the error on whichever balls were rounded hardest and keeps
 * the total exact.
 */
function roundHundredths(values: number[], total: number): number[] {
  const cents = values.map((v) => v * 100);
  const out = cents.map(Math.floor);
  let left = Math.round(total * 100) - out.reduce((a, b) => a + b, 0);

  const order = cents.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  for (let k = order.length - 1; left < 0 && k >= 0; k--, left++) out[order[k].i] -= 1;

  return out.map((v) => v / 100);
}

/**
 * Each slot's guaranteed base, and what is therefore left to price difficulty
 * with.
 *
 * A DTM-shaped paper (32/3/10) gets `BASE_BALL` verbatim — 55.1 of base, 44.9 of
 * budget. ⚠️ **A long paper is the one case that has to yield**: 100 questions
 * would carry 110 of base and leave the difficulty budget negative, so once the
 * bases reach `BASE_SHARE` of the paper they are scaled down by ONE factor until
 * they occupy exactly that share. One factor, never a per-type clamp — the
 * 1.1 : 1.3 : 1.6 ladder between the types is the thing being preserved.
 */
export function baseBalls(slots: PaperSlot[], cap = PAPER_TOTAL): { bases: number[]; budget: number } {
  const bases = slots.map((slot) => BASE_BALL[slot.testType] ?? BASE_BALL['Y-1']);
  const total = bases.reduce((a, b) => a + b, 0);
  const room = cap * BASE_SHARE;
  if (total <= room || total <= 0) return { bases, budget: cap - total };
  return { bases: bases.map((v) => (v / total) * room), budget: cap - room };
}

/**
 * The printed value for a paper that has **no printed protocol** — an even split
 * of `PAPER_TOTAL` across its slots.
 *
 * ⚠️ This is what the Milliy sertifikat SUBJECT papers (biology…) use: the DTM
 * maths blueprint is the only place per-position printed balls exist, and
 * inventing per-section values for a subject whose blueprint this repo does not
 * have would be worse than an honest flat split. It is the "before" shown beside
 * a moved mark, nothing more — it has never been what a question is marked at.
 *
 * See docs/MILLIY_QUIZ.md.
 */
export function evenPrinted(count: number, total = PAPER_TOTAL): number[] {
  if (count <= 0) return [];
  return roundHundredths(new Array(count).fill(total / count), total);
}

/**
 * What each position PRINTS in the DTM maths protocol, in paper order.
 *
 * Per section, because that is the only place the printed values exist — a row's
 * `balls` are its own multiset. It is the "before" the results page strikes
 * through, nothing more.
 */
function printedBalls(slots: PaperSlot[]): number[] {
  const bySection = new Map<string, number>();
  for (const slot of slots) bySection.set(slot.sectionId, (bySection.get(slot.sectionId) ?? 0) + 1);

  const next = new Map<string, number>();
  return slots.map((slot) => {
    const row = sectionBalls(slot.sectionId, bySection.get(slot.sectionId) ?? 1);
    const i = next.get(slot.sectionId) ?? 0;
    next.set(slot.sectionId, i + 1);
    return row[i] ?? row[row.length - 1] ?? 0;
  });
}

/**
 * The whole paper, marked against its cohort — `Bᵢ = Yᵢ + σᵢ`, summing to
 * exactly `PAPER_TOTAL`.
 *
 * Nothing here is stored. The marks are derived on every render from the
 * sittings that exist right now, which means **a question's ball moves when a
 * classmate sits the paper**. That is the feature, and the results page says so
 * on screen.
 *
 * ⚠️ **Subject-agnostic.** Everything below the `printed` argument is base +
 * cohort arithmetic — test type and solve rate in, ball out — with no blueprint,
 * no calibrated difficulty and no taxonomy in it, which is why the same marking
 * serves the Milliy sertifikat subject papers (docs/MILLIY_QUIZ.md). `printed` is
 * the ONLY maths-specific part, so it is injectable: pass
 * `evenPrinted(slots.length)` for a paper with no printed protocol. It defaults
 * to the DTM table so the maths caller is unchanged.
 *
 * ⚠️ Do NOT confuse this with the ability model. θ and the 0–5 levels come from
 * the 3PL EAP fit in [lib/RASCHtheta.ts](RASCHtheta.ts), which IS anchored on
 * calibrated maths item difficulty and is deliberately not generalized.
 */
export function paperMarks(
  slots: PaperSlot[],
  stats: Map<string, ItemStat>,
  printed: number[] = printedBalls(slots),
): SlotMark[] {
  const rows = slots.map((slot, i) => ({ slot, stat: stats.get(slot.key), printedBall: printed[i] ?? 0 }));
  if (rows.length === 0) return [];

  // The floor every question keeps, and what is left of the 100 to price
  // difficulty with.
  const { bases, budget } = baseBalls(slots);

  // The difficulty budget, shared in proportion to d². Σw is only ever 0 in the
  // impossible case of a perfectly-solved shrunk cohort; splitting evenly there
  // keeps the paper at 100 instead of dropping the budget on the floor.
  const weights = rows.map((row) => difficultyWeight(row.stat));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const balls = roundHundredths(
    bases.map((base, i) => base + budget * (weightSum > 0 ? weights[i] / weightSum : 1 / rows.length)),
    PAPER_TOTAL,
  );

  // Reported per section AFTER the pricing, never reserved before it.
  const sectionTotals = new Map<string, number>();
  rows.forEach((row, i) => {
    const id = row.slot.sectionId;
    sectionTotals.set(id, (sectionTotals.get(id) ?? 0) + balls[i]);
  });

  return rows.map((row, i) => {
    const seen = row.stat?.seen ?? 0;
    return {
      key: row.slot.key,
      number: row.slot.number,
      sectionId: row.slot.sectionId,
      testType: row.slot.testType,
      seen,
      correct: row.stat?.correct ?? 0,
      p: seen > 0 ? row.stat!.correct / seen : null,
      base: round2(bases[i]),
      ball: balls[i],
      printedBall: row.printedBall,
      sectionTotal: round2(sectionTotals.get(row.slot.sectionId) ?? 0),
      // Per QUESTION, not per paper: a slot's ball is as settled as its own
      // response count makes it.
      provisional: seen < MIN_RESPONSES,
    };
  });
}

/**
 * Every ball on the paper added up — what a perfect sitting would earn.
 *
 * **`PAPER_TOTAL` exactly** on any paper with slots: the bases and the budget are
 * defined to add to it and `roundHundredths` keeps that exact. It is still summed
 * rather than assumed, because it is what the per-question grid on screen adds up
 * to and the two must agree by construction, not by comment.
 */
export function paperTotal(marks: SlotMark[]): number {
  return round2(marks.reduce((sum, m) => sum + m.ball, 0));
}

/**
 * Raw balls one student earned — the evidence behind the score, shown beside the
 * per-question grid.
 *
 * `null` for a sitting saved before per-item outcomes were recorded — the raw
 * percentage is what those results have, and inventing a mark from it would be
 * a different number wearing the same label.
 */
export function scoreFor(marks: SlotMark[], items: Record<string, number> | undefined): number | null {
  if (!items) return null;
  return round2(marks.reduce((sum, m) => sum + (items[m.key] ? m.ball : 0), 0));
}

/**
 * **The student's score, out of 100** — `Σ(balls earned) / Σ(balls) × 100`.
 *
 * Since the paper sums to exactly `PAPER_TOTAL`, this is the earned balls
 * themselves to one decimal; the division is kept so the number can never drift
 * from the grid it is read beside.
 *
 * ⚠️ This is where difficulty is rewarded. Two students who each answered 10 of
 * 45 do NOT score the same: the ten the class found hardest carry most of the
 * 44.9 difficulty budget on top of their bases, while ten everybody solved carry
 * little more than their base. A flat count of right answers cannot say that, and
 * it is the single most misleading number a maths dashboard can show.
 */
export function normalizedScore(
  marks: SlotMark[],
  items: Record<string, number> | undefined,
): number | null {
  const earned = scoreFor(marks, items);
  if (earned === null) return null;
  const total = paperTotal(marks);
  return total > 0 ? Math.round((earned / total) * PAPER_TOTAL * 10) / 10 : 0;
}
