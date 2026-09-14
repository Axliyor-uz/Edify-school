// app/teacher/sat/math/_components/draft.ts
//
// The SAT Math test being assembled, kept in the browser.
//
// This exists because the builder SENDS THE TEACHER AWAY: writing a new
// question happens in `/teacher/create/question`, a different route. Without
// this, clicking that link would silently destroy a hand-picked test — the
// builder holds it in component state and those links are ordinary
// navigations. It also closes a hazard that is there anyway: a back-swipe
// used to lose it too. Pattern: app/teacher/milliy-sertifikat/_components/draft.ts.
//
// ⚠️ Own key, own shape — SAT holds THREE item arrays (Module 1, Module 2
// Easier, Module 2 Harder), not one.

import type { SatMathTestStatus, SatQuizItem } from '@/types/SatQuiz';

const KEY = 'teacher:sat:math:draft:v1';

/** Same reasoning as the Milliy sertifikat draft: long enough to survive a
 *  detour to write a batch of questions, short enough not to ambush a new test. */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface SatMathDraft {
  testId: string;
  title: string;
  description: string;
  module1Minutes: number;
  module2Minutes: number;
  routingThreshold: number;
  shuffle: boolean;
  showAnswers: boolean;
  accessCode: string;
  status: SatMathTestStatus;
  module1: SatQuizItem[];
  module2Easier: SatQuizItem[];
  module2Harder: SatQuizItem[];
  savedAt: number;
}

/** ONE draft at a time. The `testId` rides INSIDE the record so the loader can
 *  refuse a draft belonging to another test. */
export function readSatMathDraft(): SatMathDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SatMathDraft;
    if (!draft?.testId || !Array.isArray(draft.module1)) return null;
    if (Date.now() - draft.savedAt > TTL_MS) return null;
    return draft;
  } catch {
    // Private mode, or a shape from an older build — behave as if none.
    return null;
  }
}

export function writeSatMathDraft(draft: Omit<SatMathDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // A long test is a few hundred KB and can hit a full quota. The builder
    // still works in memory — never break assembling a test over the
    // convenience layer that protects it.
  }
}

export function clearSatMathDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
