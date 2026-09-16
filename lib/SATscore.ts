// lib/SATscore.ts
//
// The SAT "scaled score" (200–800) shown on the results pages.
//
// ⚠️ STILL AN APPROXIMATION, NOT COLLEGE BOARD'S SCORE. The real digital SAT
// equates each form with a proprietary per-form IRT table that is not public.
// What IS public is (a) the test's SHAPE — two modules, with the reachable
// ceiling depending on whether Module 1 routed the student into the harder or
// the easier Module 2 — and (b) a published RAW-SCORE CONVERSION TABLE from a
// released practice test. This file combines both, and labels the result as an
// estimate everywhere it surfaces.
//
// 🟢 2026-09-16: the old straight line from 200 to the route ceiling was
// replaced by the real conversion CURVE below (adapted from the published
// raw-score conversion table shipped with digital SAT Practice Test 11, via
// github.com/yudopr11/sat-simulation). The curve matters because the real
// mapping is nowhere near linear — it is steep at both ends and much flatter
// through the middle, so a straight line overpays mid-range students and
// underpays strong ones. It also reports a RANGE (e.g. "640–700"), which is
// how College Board itself reports a practice-test estimate.
//
// ⚠️ SCORES FROM BEFORE THIS CHANGE ARE NOT COMPARABLE TO SCORES AFTER IT.
// `SatMathResult.scaledScore` is persisted at submit time, so a sitting graded
// under the old straight line keeps its old number forever and a teacher's
// average mixes the two models. Nothing re-scores old sittings (money-style
// immutability is not the reason — there is simply no backfill script, and
// silently rewriting a student's past score would be worse). Both models were
// always labeled an approximation; if the mixed average ever matters, write a
// one-off backfill rather than special-casing it in the UI.
//
// Never present any output of this file as an official or equated SAT score —
// always show it next to the student's own raw correct/total.

import type { SatModuleRoute } from '@/types/SatQuiz';

const SCALE_FLOOR = 200;
const SCALE_CEIL = 800;

/** A student routed to the easier Module 2 cannot reach the top of the scale —
 *  mirrors the real test's shape (being routed easier is itself evidence of a
 *  lower ceiling). Applied ON TOP of the curve, clamping both ends of the band. */
const EASIER_ROUTE_CEIL = 590;

/**
 * Raw score (number correct) → `[lower, upper]` scaled-score band.
 *
 * Index = raw score, so index 0 is "nothing correct". Source: the raw-score
 * conversion table published with digital SAT Practice Test 11 — a 54-question
 * Math section (27 + 27), which is why the table runs 0…54.
 *
 * ⚠️ THE LENGTH IS THE TRAP. Our tests are teacher-built and can be ANY length
 * (a 12-question mock is normal), so this table is NEVER indexed with a raw
 * count directly — `bandForFraction` maps the student's fraction correct onto
 * the table's own domain first. Indexing a 12/12 sitting as raw 12 would read
 * off [330, 370] and report a perfect paper as a failing score.
 */
export const SAT_RAW_SCORE_TABLE: ReadonlyArray<readonly [number, number]> = [
  [200, 200], // 0
  [210, 220], // 1
  [210, 220], // 2
  [210, 230], // 3
  [220, 240], // 4
  [230, 250], // 5
  [240, 270], // 6
  [250, 290], // 7
  [260, 320], // 8
  [270, 330], // 9
  [290, 350], // 10
  [310, 350], // 11
  [330, 370], // 12
  [340, 380], // 13
  [350, 390], // 14
  [350, 390], // 15
  [360, 400], // 16
  [370, 410], // 17
  [370, 410], // 18
  [380, 420], // 19
  [390, 430], // 20
  [390, 430], // 21
  [400, 440], // 22
  [410, 450], // 23
  [410, 450], // 24
  [420, 460], // 25
  [430, 470], // 26
  [440, 480], // 27
  [450, 490], // 28
  [460, 500], // 29
  [470, 510], // 30
  [480, 520], // 31
  [490, 530], // 32
  [490, 550], // 33
  [500, 560], // 34
  [510, 570], // 35
  [530, 590], // 36
  [540, 600], // 37
  [550, 610], // 38
  [560, 620], // 39
  [570, 630], // 40
  [590, 650], // 41
  [600, 660], // 42
  [610, 670], // 43
  [620, 680], // 44
  [640, 700], // 45
  [650, 710], // 46
  [660, 720], // 47
  [680, 740], // 48
  [700, 760], // 49
  [710, 770], // 50
  [730, 780], // 51
  [750, 800], // 52
  [770, 800], // 53
  [790, 800], // 54
];

/** The table's own maximum raw score — the domain a fraction is mapped onto. */
export const SAT_TABLE_MAX_RAW = SAT_RAW_SCORE_TABLE.length - 1; // 54

export interface SatScoreBand {
  lower: number;
  upper: number;
}

/** Round to the nearest 10 — the real SAT's score granularity. */
const roundToTen = (n: number): number => Math.round(n / 10) * 10;

const clampBand = (band: SatScoreBand, ceiling: number): SatScoreBand => ({
  lower: Math.min(Math.max(band.lower, SCALE_FLOOR), ceiling),
  upper: Math.min(Math.max(band.upper, SCALE_FLOOR), ceiling),
});

/**
 * Fraction correct (0–1) → the conversion table's band, interpolated.
 *
 * The fraction is mapped onto the table's 0…54 domain so a test of ANY length
 * reads off the same curve (see the table's trap note). The two neighbouring
 * rows are then blended linearly, so a 40-question test doesn't jump in
 * visible steps just because the table is coarser than the paper.
 */
function bandForFraction(fraction: number): SatScoreBand {
  const f = Math.min(1, Math.max(0, fraction));
  const pos = f * SAT_TABLE_MAX_RAW;
  const lowIdx = Math.floor(pos);
  const highIdx = Math.min(SAT_TABLE_MAX_RAW, lowIdx + 1);
  const t = pos - lowIdx;

  const [lo1, hi1] = SAT_RAW_SCORE_TABLE[lowIdx];
  const [lo2, hi2] = SAT_RAW_SCORE_TABLE[highIdx];

  return {
    lower: roundToTen(lo1 + (lo2 - lo1) * t),
    upper: roundToTen(hi1 + (hi2 - hi1) * t),
  };
}

/**
 * Raw correct/total across BOTH modules → the estimated scaled-score BAND.
 *
 * `total === 0` returns the floor rather than dividing by zero (an abandoned
 * sitting). A student routed to the easier Module 2 has both ends clamped to
 * `EASIER_ROUTE_CEIL`, so a perfect easier-route paper reports a single number
 * (590) rather than a band — the cap is hard, and pretending otherwise would
 * promise a ceiling the route cannot reach.
 */
export function estimateScoreBand(
  route: SatModuleRoute,
  correct: number,
  total: number,
): SatScoreBand {
  if (total <= 0) return { lower: SCALE_FLOOR, upper: SCALE_FLOOR };
  const ceiling = route === 'harder' ? SCALE_CEIL : EASIER_ROUTE_CEIL;
  return clampBand(bandForFraction(correct / total), ceiling);
}

/**
 * The single 200–800 number persisted on `SatMathResult.scaledScore` — the
 * MIDPOINT of the band, rounded to 10.
 *
 * Kept as the stored value (rather than storing the band alone) because the
 * teacher results page averages and ranks by one number, and every existing
 * sitting already has this field. The band is stored alongside it, additively.
 */
export function estimateScaledScore(route: SatModuleRoute, correct: number, total: number): number {
  const { lower, upper } = estimateScoreBand(route, correct, total);
  return roundToTen((lower + upper) / 2);
}

/** `"640–700"`, or just `"590"` when the band has collapsed to a point. */
export function formatScoreBand(band: SatScoreBand): string {
  return band.lower === band.upper ? `${band.lower}` : `${band.lower}–${band.upper}`;
}
