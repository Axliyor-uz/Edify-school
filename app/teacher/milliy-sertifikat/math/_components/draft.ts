// app/teacher/milliy-sertifikat/math/_components/draft.ts
//
// The Rasch paper being assembled, kept in the browser.
//
// This exists because the builder now SENDS THE TEACHER AWAY: writing a new
// question happens in `/teacher/create/question` (or `/block`), which is a
// different route. Without this, clicking that button would silently destroy up
// to 45 hand-picked questions — the worst thing this feature could do to
// somebody, and the same failure the 1 MiB size guard already protects against
// on the other side.
//
// It also closes a hazard that was already there: an accidental back-swipe used
// to lose the whole paper too.

import type { RaschQuizItem, RaschQuizStatus } from '@/types/TeacherRaschQuiz';

const KEY = 'teacher:rasch:draft:v1';

/**
 * Long enough to survive writing a batch of questions in another tab, going for
 * lunch and coming back; short enough that a paper abandoned last week does not
 * ambush the next new one.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface QuizDraft {
  quizId: string;
  title: string;
  minutes: number;
  shuffle: boolean;
  showAnswers: boolean;
  accessCode: string;
  status: RaschQuizStatus;
  items: RaschQuizItem[];
  savedAt: number;
}

/**
 * ONE draft at a time — a teacher assembles one paper at a time, and a
 * per-quiz key would quietly accumulate abandoned papers in localStorage with
 * nothing ever clearing them. The `quizId` rides INSIDE the record instead, so
 * the loader can tell "the draft for the paper I am editing" from "a draft for
 * some other paper" and refuse the wrong one.
 */
export function readDraft(): QuizDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as QuizDraft;
    if (!draft?.quizId || !Array.isArray(draft.items)) return null;
    if (Date.now() - draft.savedAt > TTL_MS) return null;
    return draft;
  } catch {
    // Private mode, or a shape from an older build — behave as if none.
    return null;
  }
}

export function writeDraft(draft: Omit<QuizDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // A 45-question paper is a few hundred KB and can hit a full quota. The
    // builder still works in memory — never break assembling a paper over the
    // convenience layer that protects it.
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
