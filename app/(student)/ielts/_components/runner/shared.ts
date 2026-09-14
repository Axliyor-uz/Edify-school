// Shared pure helpers for the student IELTS runner family (runner, writing,
// speaking, review). No React here — keep it importable from anywhere.
import type { IeltsQuestionBlock } from '@/lib/ielts/types';

export type AnswerMap = Record<string, string | string[]>;

/** Public test collections (mirrors the private map in services/ieltsService.ts). */
export const TEST_COLLECTIONS: Record<string, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

// ---------------------------------------------------------------------------
// Session resilience (regular-runner pattern: restore on reload, clear only
// after a successful submit).
// ---------------------------------------------------------------------------

export const sessionKey = (uid: string, assignmentId: string | undefined, testId: string) =>
  `ielts_session_${uid}_${assignmentId || 'practice_' + testId}`;

export interface RunnerSession {
  answers?: AnswerMap;
  flags?: string[];
  endTime?: number;
  startedAt?: number;
  tabSwitches?: number;
  /** Listening simulation: approximate audio position for restore. */
  audio?: { part: number; elapsed: number; phase: 'playing' | 'check' };
  writing?: { task1: string; task2: string };
  /** Speaking: parts already uploaded survive a reload. */
  speakingUrls?: Record<string, string>;
  /** Reading highlighter: per passage index, the innerHTML of each text block
   *  (spans carry data-hl; removal is event-delegated, so serialized HTML survives). */
  highlights?: Record<string, string[]>;
}

export function loadSession(key: string): RunnerSession | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as RunnerSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(key: string, s: RunnerSession) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* quota/private */ }
}

export function clearSession(key: string) {
  try { localStorage.removeItem(key); } catch { /* private */ }
}

// ---------------------------------------------------------------------------
// Question numbering / palette
// ---------------------------------------------------------------------------

/** list_selection spans end−start+1 numbers; public docs have no correct_answer
 *  to count, so the span comes from the numbering itself. */
export const listSpan = (qb: IeltsQuestionBlock | Record<string, unknown>): number => {
  const b = qb as { start_question?: number; end_question?: number };
  return Math.max(1, (b.end_question || 0) - (b.start_question || 0) + 1);
};

export const listBaseQn = (qb: { questions?: { question_number?: number }[]; start_question?: number }): number =>
  qb.questions?.[0]?.question_number ?? qb.start_question ?? 1;

export interface PaletteNumber {
  qn: number;
  groupIdx: number;      // passage / part index
  blockKey: string;      // `g{groupIdx}b{blockIdx}` — flag unit
  targetQn: number;      // element id to scroll to (list_selection → base)
  isList: boolean;
  listBase: number;
  listNeed: number;      // selections required to light this number up
}

export function buildPalette(groups: IeltsQuestionBlock[][]): PaletteNumber[] {
  const out: PaletteNumber[] = [];
  groups.forEach((blocks, groupIdx) => {
    (blocks || []).forEach((qb, blockIdx) => {
      const start = qb.start_question || 0;
      const end = qb.end_question || start;
      const isList = qb.type === 'list_selection';
      const base = isList ? listBaseQn(qb) : 0;
      for (let qn = start; qn <= end; qn++) {
        out.push({
          qn,
          groupIdx,
          blockKey: `g${groupIdx}b${blockIdx}`,
          targetQn: isList ? base : qn,
          isList,
          listBase: base,
          listNeed: qn - start + 1,
        });
      }
    });
  });
  return out;
}

export function isNumberAnswered(n: PaletteNumber, answers: AnswerMap): boolean {
  if (n.isList) {
    const sel = answers[String(n.listBase)];
    return Array.isArray(sel) && sel.length >= n.listNeed;
  }
  const v = answers[String(n.qn)];
  if (v === undefined || v === '') return false;
  return Array.isArray(v) ? v.length > 0 : true;
}

// ---------------------------------------------------------------------------
// Gap tokens — `[0]`, `[ 1 ]`, `[_]`, `[]` are POSITIONAL: the i-th token in a
// block-scoped text maps to start_question + i (numbers inside are ignored).
// ---------------------------------------------------------------------------

export const GAP_TOKEN_SPLIT = /(\[\s*\d*\s*\]|\[_\]|\[\])/g;
export const isGapToken = (s: string) => /^\[\s*[\d_]*\s*\]$/.test(s);

// ---------------------------------------------------------------------------
// Misc formatting
// ---------------------------------------------------------------------------

/** m:ss, supports negative (overtime) as "-m:ss". */
export function formatClock(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const s = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${neg ? '-' : ''}${m}:${sec.toString().padStart(2, '0')}`;
}

/** Human display for a stored correct answer ("taxi/cab", ["A","C"], …). */
export function fmtAnswer(a: string | string[] | undefined | null): string {
  if (a == null) return '—';
  return Array.isArray(a) ? a.join(', ') : String(a);
}

export const wordCount = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

/** Firestore Timestamp-ish → epoch ms (tolerates {seconds}, {toMillis}, null). */
export function tsToMs(v: unknown): number | null {
  if (!v) return null;
  const t = v as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return null;
}

/** Short exam-content labels for the 13 question types (stat chips). */
export { IELTS_TYPE_LABELS as TYPE_LABELS } from '@/lib/ielts/typeLabels';
