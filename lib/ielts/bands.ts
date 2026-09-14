// Raw score → IELTS band conversion (indicative — official tables vary ±1 mark per version).
// Listening is the same for Academic & General Training; Reading differs.

import type { IeltsSkill, IeltsTestCategory } from './types';

type BandRow = [band: number, minRaw: number];

// Descending; first row whose minRaw <= raw wins.
const LISTENING: BandRow[] = [
  [9, 39], [8.5, 37], [8, 35], [7.5, 32], [7, 30], [6.5, 26], [6, 23],
  [5.5, 18], [5, 16], [4.5, 13], [4, 10], [3.5, 8], [3, 6], [2.5, 4],
];

const ACADEMIC_READING: BandRow[] = [
  [9, 39], [8.5, 37], [8, 35], [7.5, 33], [7, 30], [6.5, 27], [6, 23],
  [5.5, 19], [5, 15], [4.5, 13], [4, 10], [3.5, 8], [3, 6], [2.5, 4],
];

const GT_READING: BandRow[] = [
  [9, 40], [8.5, 39], [8, 37], [7.5, 36], [7, 34], [6.5, 32], [6, 30],
  [5.5, 27], [5, 23], [4.5, 19], [4, 15], [3.5, 12], [3, 9], [2.5, 6],
];

function fromTable(table: BandRow[], raw: number): number {
  for (const [band, min] of table) if (raw >= min) return band;
  return raw > 0 ? 2 : 1;
}

export function rawToBand(
  raw: number,
  skill: IeltsSkill,
  category: IeltsTestCategory = 'academic',
): number {
  if (skill === 'listening') return fromTable(LISTENING, raw);
  return fromTable(category === 'general' ? GT_READING : ACADEMIC_READING, raw);
}

// Partial tests (e.g. one passage, 13 questions): extrapolate to /40, clearly indicative.
export function extrapolatedBand(
  raw: number,
  total: number,
  skill: IeltsSkill,
  category: IeltsTestCategory = 'academic',
): number {
  if (total <= 0) return 1;
  if (total === 40) return rawToBand(raw, skill, category);
  return rawToBand(Math.round((raw / total) * 40), skill, category);
}

// Overall band = mean of skill bands, rounded to nearest 0.5 with .25/.75 rounding UP.
export function overallBand(bands: number[]): number {
  if (!bands.length) return 0;
  const mean = bands.reduce((s, b) => s + b, 0) / bands.length;
  // Math.round halves-up on the doubled value implements the official .25/.75-rounds-up rule.
  return Math.round(mean * 2) / 2;
}
