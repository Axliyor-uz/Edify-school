// app/(student)/ielts/_components/hubData.ts — shared attempt helpers for the IELTS hub tabs.

/** `ielts_attempts` doc as the hub reads it (server-written; see docs/IELTS.md). */
export type AttemptDoc = { id: string } & Record<string, unknown>;

/** Band of an attempt: server grade (R/L) or teacher grade (W/S). */
export function attemptBand(a: AttemptDoc): number | null {
  if (typeof a.bandScore === 'number') return a.bandScore;
  const tg = (a.teacherGrade as { band?: number } | undefined)?.band;
  return typeof tg === 'number' ? tg : null;
}
