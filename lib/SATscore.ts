// lib/SATscore.ts
//
// The SAT Math "scaled score" (200–800) shown on the results page.
//
// ⚠️ THIS IS AN APPROXIMATION, NOT COLLEGE BOARD'S SCORE. The real digital SAT
// converts raw score to a 200–800 scale through a proprietary, per-form IRT
// equating table that is not public and cannot be reproduced here. What IS
// public and reproducible is the test's SHAPE: two modules, and the ceiling a
// student can reach depends on whether their Module 1 performance routed them
// into the harder or the easier Module 2 (a student routed easier can no
// longer reach the top of the scale, no matter how well they do on Module 2 —
// that's what makes the routing meaningful in the first place). This file
// encodes exactly that shape as a simple, transparent, LABELED approximation —
// the same honesty pattern the Milliy sertifikat subject papers use for their
// own un-encoded specs (docs/MILLIY_QUIZ.md: "not a national spec").
//
// Never present `estimateScaledScore`'s output as an official or equated SAT
// score anywhere in the UI — always alongside its own raw correct/total.

import type { SatModuleRoute } from '@/types/SatQuiz';

const SCALE_FLOOR = 200;
const SCALE_CEIL = 800;
/** A student routed to the easier Module 2 cannot reach the top of the scale —
 *  mirrors the real test's shape (routing itself is evidence of a lower ceiling). */
const EASIER_ROUTE_CEIL = 590;

/** Round to the nearest 10 — matches the real SAT's score granularity. */
const roundToTen = (n: number): number => Math.round(n / 10) * 10;

/**
 * Raw correct/total across BOTH modules → an approximate 200–800 scaled score.
 * Linear within the route's own range; `total === 0` returns the floor rather
 * than dividing by zero (an abandoned/unsat test).
 */
export function estimateScaledScore(route: SatModuleRoute, correct: number, total: number): number {
  if (total <= 0) return SCALE_FLOOR;
  const ceiling = route === 'harder' ? SCALE_CEIL : EASIER_ROUTE_CEIL;
  const fraction = Math.min(1, Math.max(0, correct / total));
  const raw = SCALE_FLOOR + (ceiling - SCALE_FLOOR) * fraction;
  return Math.min(SCALE_CEIL, Math.max(SCALE_FLOOR, roundToTen(raw)));
}
