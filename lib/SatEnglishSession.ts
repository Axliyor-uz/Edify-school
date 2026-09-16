// lib/SatEnglishSession.ts
//
// The SAT English (Reading & Writing) sitting being run, kept in the browser
// — a SIBLING instantiation of the same factory pattern as `lib/SatSession.ts`
// (itself a sibling of `lib/Examsession.ts::createSessionStore`), for SAT
// English's own localStorage key. Own key so starting an English sitting can
// never discard a Math sitting (or a mock exam, or a Milliy sertifikat paper)
// still running against its own clock, and vice versa.
//
// Exposed as an external store (subscribe / get) so the runner can read it
// through `useSyncExternalStore`: the server gets a null snapshot, the browser
// gets the real one, with no setState-in-effect and no hydration mismatch.

import type { SatExamSnapshot } from '@/types/SatQuiz';

/** Outlives a two-module sitting (35+35 min plus review time) with room to spare. */
const TTL_MS = 4 * 60 * 60 * 1000;

const KEY = 'sat:english:v1';
const VERSION = 1;

let cachedRaw: string | null = null;
let cachedValue: SatExamSnapshot | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

function parse(raw: string | null): SatExamSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SatExamSnapshot;
    if (parsed.version !== VERSION || !parsed.module1?.length) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const subscribeSatEnglishSnapshot = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function getSatEnglishSnapshot(): SatExamSnapshot | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null; // private mode — behave as if nothing was stored
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = parse(raw);
  return cachedValue;
}

/** Server render has no localStorage — always start from "no sitting stored". */
export const getServerSatEnglishSnapshot = (): SatExamSnapshot | null => null;

export function saveSatEnglishSnapshot(snapshot: Omit<SatExamSnapshot, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const payload: SatExamSnapshot = { ...snapshot, version: VERSION, savedAt: Date.now() };
  try {
    const raw = JSON.stringify(payload);
    window.localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedValue = payload;
    emit();
  } catch {
    // Private mode or quota exceeded — the sitting still works in memory, it
    // just won't survive a reload. Never break a sitting over storage.
  }
}

export function clearSatEnglishSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedValue = null;
  emit();
}
