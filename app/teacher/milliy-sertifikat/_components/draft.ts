// app/teacher/milliy-sertifikat/_components/draft.ts
//
// The Milliy sertifikat subject paper being assembled, kept in the browser.
//
// This exists because the builder SENDS THE TEACHER AWAY: writing a new question
// happens in `/teacher/create/question` (or `/block`), a different route. Without
// this, clicking that link would silently destroy a hand-picked paper — the
// builder holds it in component state and those links are ordinary navigations.
// It also closes a hazard that is there anyway: a back-swipe used to lose it too.
//
// ⚠️ **A separate key from the Rasch draft** (`teacher:rasch:draft:v1`). One
// shared key would mean starting a biology paper silently eats a maths paper a
// teacher is halfway through assembling, and the two hold different item shapes.

import type { MilliyQuizItem, MilliyQuizStatus, MilliySubjectId } from '@/types/MilliyQuiz';

const KEY = 'teacher:milliy:draft:v1';

/**
 * Long enough to survive writing a batch of questions in another tab, going for
 * lunch and coming back; short enough that a paper abandoned last week does not
 * ambush the next new one.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface MilliyDraft {
  quizId: string;
  subject: MilliySubjectId;
  title: string;
  minutes: number;
  target: number;
  shuffle: boolean;
  showAnswers: boolean;
  accessCode: string;
  status: MilliyQuizStatus;
  items: MilliyQuizItem[];
  savedAt: number;
}

/**
 * ONE draft at a time — a teacher assembles one paper at a time, and a per-paper
 * key would quietly accumulate abandoned drafts with nothing ever clearing them.
 * The `quizId` **and the `subject`** ride INSIDE the record, so the loader can
 * refuse a draft that belongs to another paper *or another subject* rather than
 * dropping biology questions onto a chemistry paper.
 */
export function readMilliyDraft(): MilliyDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as MilliyDraft;
    if (!draft?.quizId || !draft?.subject || !Array.isArray(draft.items)) return null;
    if (Date.now() - draft.savedAt > TTL_MS) return null;
    return draft;
  } catch {
    // Private mode, or a shape from an older build — behave as if none.
    return null;
  }
}

export function writeMilliyDraft(draft: Omit<MilliyDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // A long paper is a few hundred KB and can hit a full quota. The builder
    // still works in memory — never break assembling a paper over the
    // convenience layer that protects it.
  }
}

export function clearMilliyDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
