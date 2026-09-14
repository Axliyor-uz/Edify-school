// lib/Examsession.ts
import type { ExamQuestion, ExamSnapshot } from '@/types/Exam';

/**
 * The paper being sat, kept in the browser.
 *
 * Building an exam costs 45 Firestore reads; resuming one costs zero. The whole
 * paper — questions, answers, flags, deadline — is written to localStorage, so
 * a refresh, a closed tab, or a return trip restores the exact same 45
 * questions without touching the network. Firestore is queried once per exam,
 * and only when the student explicitly starts a new one.
 *
 * Exposed as an external store (subscribe / get) so a page can read it through
 * useSyncExternalStore: that hands the server a null snapshot and the browser the
 * real one, restoring state without a setState-in-effect and without a hydration
 * mismatch.
 *
 * ⚠️ There are TWO stores and they must not share a key: the 45-question mock
 * exam (`raschmodel:exam`) and a teacher-built paper opened by code
 * (`raschmodel:quiz`, docs/RASCH_QUIZ.md). One key would mean starting a teacher
 * quiz silently discards a mock exam that is still running against its clock —
 * and resuming one would restore the other's questions. The store logic itself is
 * written once, below, and instantiated twice.
 */

/** Outlives the 150-minute exam with room to spare, without hoarding forever. */
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * `solutions[].steps` is by far the biggest field on a question doc, and
 * nothing in the exam UI renders it — only `final_answer`, which grades the
 * open (O) answers. Dropping the rest keeps a 45-question paper comfortably
 * inside the localStorage quota.
 */
function slim(q: ExamQuestion): ExamQuestion {
  const finalAnswer = q.solutions?.[0]?.final_answer;
  return {
    ...q,
    solutions: finalAnswer ? [{ final_answer: finalAnswer, method: '', steps: [] }] : [],
    tags: [],
    language: [],
  };
}

export interface SessionStore {
  subscribe: (listener: () => void) => () => void;
  get: () => ExamSnapshot | null;
  getServer: () => ExamSnapshot | null;
  save: (snapshot: Omit<ExamSnapshot, 'version' | 'savedAt'>) => void;
  clear: () => void;
}

function createSessionStore(key: string, version: number): SessionStore {
  const listeners = new Set<() => void>();

  // get() runs on every render, and useSyncExternalStore requires a stable
  // reference, so the parse is memoised against the raw string.
  let cachedRaw: string | null = null;
  let cachedValue: ExamSnapshot | null = null;

  const emit = () => { for (const listener of listeners) listener(); };

  const parse = (raw: string | null): ExamSnapshot | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ExamSnapshot;
      if (parsed.version !== version || !parsed.questions?.length) return null;
      if (Date.now() - parsed.savedAt > TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get() {
      if (typeof window === 'undefined') return null;

      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return null; // private mode — behave as if nothing was stored
      }

      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      cachedValue = parse(raw);
      return cachedValue;
    },

    /** Server render has no localStorage — always start from "no paper stored". */
    getServer() {
      return null;
    },

    save(snapshot) {
      if (typeof window === 'undefined') return;

      const payload: ExamSnapshot = {
        ...snapshot,
        questions: snapshot.questions.map(slim),
        version,
        savedAt: Date.now(),
      };

      try {
        const raw = JSON.stringify(payload);
        window.localStorage.setItem(key, raw);
        cachedRaw = raw;
        cachedValue = payload;
        emit();
      } catch {
        // Private mode or quota exceeded — the paper still works in memory, it
        // just won't survive a reload. Never break a sitting over storage.
      }
    },

    clear() {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      cachedRaw = null;
      cachedValue = null;
      emit();
    },
  };
}

// ─── the mock exam ───────────────────────────────────────────────────────────
// v2: teacher_questions slots (33–45) carry images, blocks and a `stem`. A paper
// drawn under v1 lacks those fields, so an old snapshot is discarded rather than
// resumed — otherwise a mid-flight exam keeps rendering the pre-teacher shape.
const examStore = createSessionStore('raschmodel:exam:v1', 2);

export const subscribeExamSnapshot = examStore.subscribe;
/** The stored exam, or null if there is none / it is stale or unusable. */
export const getExamSnapshot = examStore.get;
export const getServerExamSnapshot = examStore.getServer;
export const saveExamSnapshot = examStore.save;
export const clearExamSnapshot = examStore.clear;

// ─── a teacher-built paper opened by its 6-digit code ────────────────────────
const quizStore = createSessionStore('raschmodel:quiz:v1', 1);

export const subscribeQuizSnapshot = quizStore.subscribe;
export const getQuizSnapshot = quizStore.get;
export const getServerQuizSnapshot = quizStore.getServer;
export const saveQuizSnapshot = quizStore.save;
export const clearQuizSnapshot = quizStore.clear;

// ─── a Milliy sertifikat SUBJECT paper (biology…) opened by its code ──────────
//
// ⚠️ **A third key, deliberately.** One key shared with the mock exam or with a
// maths paper would mean starting a biology paper silently discards an exam still
// running against its clock — and the two are scored completely differently
// (docs/MILLIY_QUIZ.md). The store logic is written once (`createSessionStore`)
// and instantiated three times, which is the whole point of that factory.
const milliyStore = createSessionStore('milliy:quiz:v1', 1);

export const subscribeMilliySnapshot = milliyStore.subscribe;
export const getMilliySnapshot = milliyStore.get;
export const getServerMilliySnapshot = milliyStore.getServer;
export const saveMilliySnapshot = milliyStore.save;
export const clearMilliySnapshot = milliyStore.clear;
