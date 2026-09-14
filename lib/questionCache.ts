import type { NormalizedQuestion } from "@/types/question";

/**
 * A module-level, 60s TTL cache for the teacher question bank — the same pattern
 * the student pages use (see CLAUDE.md). Purely in-memory: it disappears on a
 * hard reload, and it never serves stale data across a mutation.
 *
 * What it actually saves (this is the point — Firestore bills per document read):
 *
 *  • **Opening the editor costs 0 reads.** The bank list already has the question
 *    in memory; it hands it over here before navigating, so `fetchQuestionById`
 *    finds it instead of re-reading the doc. Only a cold deep link (a pasted
 *    `?edit=…` URL) actually reads.
 *  • **Re-entering the bank costs 0 reads** within the TTL — coming back from the
 *    editor, or flipping a filter chip back and forth, used to re-read 15 docs
 *    every single time.
 *
 * ⚠️ Any write MUST invalidate: `saveQuestion`/`updateQuestion`/`deleteQuestion`
 * and `saveBlock` all call `invalidateQuestionCache()`. A cache that outlives an
 * edit would show the teacher their OLD question right after they fixed it.
 */

const TTL_MS = 60_000;

interface Entry<T> {
  value: T;
  at: number;
}

const byId = new Map<string, Entry<NormalizedQuestion>>();
const lists = new Map<string, Entry<NormalizedQuestion[]>>();

const fresh = <T>(e: Entry<T> | undefined): e is Entry<T> => !!e && Date.now() - e.at < TTL_MS;

// ─── single questions (the edit hand-off) ───────────────────────────────────

/** Called by a list before it routes to the editor — makes the edit read-free. */
export function cacheQuestion(q: NormalizedQuestion): void {
  if (q?.id) byId.set(q.id, { value: q, at: Date.now() });
}

export function getCachedQuestion(id: string): NormalizedQuestion | null {
  const hit = byId.get(id);
  return fresh(hit) ? hit.value : null;
}

// ─── bank lists (keyed by uid + filter) ─────────────────────────────────────

export const listKey = (creatorId: string, filter: string) => `${creatorId}|${filter}`;

export function cacheList(key: string, questions: NormalizedQuestion[]): void {
  lists.set(key, { value: questions, at: Date.now() });
}

export function getCachedList(key: string): NormalizedQuestion[] | null {
  const hit = lists.get(key);
  return fresh(hit) ? hit.value : null;
}

/**
 * Drops every cached list, and the single question when `id` is given.
 * Call after ANY write — a stale bank is worse than an extra read.
 */
export function invalidateQuestionCache(id?: string): void {
  lists.clear();
  if (id) byId.delete(id);
}
