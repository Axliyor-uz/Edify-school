// lib/RASCHquota.ts
//
// **How often a student may sit the maths Milliy sertifikat paper.**
//
// Two sittings a day, expressed as a **12-hour cooldown after each one** — the
// two statements are the same rule (24h / 12h = 2), and the cooldown is the form
// that can actually be shown on screen: "your next paper unlocks in 7h 12m" is
// something a student can plan around, where "you have 0 of 2 left" is not.
//
// ## Why a limit at all
//
// The paper is not a quiz, it is a **measurement**. `RASCH_levels` estimates
// ability from recent sittings, so an unlimited paper lets a student farm the
// estimate: sit ten papers in an afternoon, keep the lucky ones' effect and grind
// the ability up on familiarity with a 45-item pool rather than on maths. It also
// costs 45 question reads a go. A day's spacing is also how the real exam behaves.
//
// ## What this module is NOT
//
// ⚠️ **A deterrent, not a security boundary.** The timestamps come from the
// database (`RASCH_levels.exams[].at`, written by `saveExamResult`), so clearing
// localStorage does not reset anything — but the comparison happens on the client
// against `Date.now()`, so a student who moves their device clock forward can
// start another paper. Closing that needs the draw to move behind an Admin-SDK
// route; deliberately not done, and the same honesty the exam lockdown carries
// (see hooks/useExamLockdown.ts).
//
// ⚠️ **It gates the SELF-SERVE paper only** (`/raschmodel/exam`). A teacher's
// paper opened by code (`/raschmodel/quiz`) is never blocked — a teacher handing
// out a code to a class must not be defeated by a cooldown. Those sittings *do*
// count toward the next cooldown, because they move the same ability estimate and
// `exams[]` records them identically (`ExamPoint` has no source field).
//
// Pure: no Firestore, no React. The caller passes the timestamp it already has.

import type { ExamPoint } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

/** The wait after a sitting before another paper may be drawn. */
export const EXAM_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** What that cooldown works out to per day, for the copy. Derived, not typed twice. */
export const EXAMS_PER_DAY = Math.floor(24 * 60 * 60 * 1000 / EXAM_COOLDOWN_MS); // 2

export interface ExamQuota {
  /** May a new paper be drawn right now? */
  allowed: boolean;
  /** Epoch ms of the most recent recorded sitting, or null if there is none. */
  lastAt: number | null;
  /** Epoch ms when the next paper unlocks. Null while `allowed`. */
  nextAt: number | null;
  /** Milliseconds until `nextAt`. 0 while `allowed`. */
  msLeft: number;
}

const NO_LIMIT: ExamQuota = { allowed: true, lastAt: null, nextAt: null, msLeft: 0 };

/**
 * The most recent sitting on the chart.
 *
 * ⚠️ `exams` is documented oldest → newest, but this takes the **max** rather
 * than the last element: one out-of-order row (a clock-skewed device, a repaired
 * document) would otherwise hand back a timestamp from days ago and silently
 * disable the limit.
 */
export function lastExamAt(exams: ExamPoint[] | undefined | null): number | null {
  if (!exams || exams.length === 0) return null;
  let max = -Infinity;
  for (const e of exams) if (typeof e.at === 'number' && e.at > max) max = e.at;
  return Number.isFinite(max) ? max : null;
}

/**
 * Whether another paper may be started, and when the next one unlocks.
 *
 * ⚠️ **Fails OPEN.** `lastAt === null` (no sittings, or the levels read failed)
 * means allowed: a network blip must never lock a student out of an exam.
 *
 * ⚠️ A `lastAt` in the FUTURE is treated as "just now", not as a 12-hour-plus
 * lockout. A device whose clock was wrong when the paper was submitted would
 * otherwise ban the student for as long as the skew.
 */
export function examQuota(lastAt: number | null, now: number = Date.now()): ExamQuota {
  if (lastAt === null) return NO_LIMIT;

  const from = Math.min(lastAt, now);
  const nextAt = from + EXAM_COOLDOWN_MS;
  const msLeft = nextAt - now;

  if (msLeft <= 0) return { allowed: true, lastAt, nextAt: null, msLeft: 0 };
  return { allowed: false, lastAt, nextAt, msLeft };
}

const UNITS: Record<Lang, { h: string; m: string }> = {
  uz: { h: 'soat', m: 'daqiqa' },
  ru: { h: 'ч', m: 'мин' },
  en: { h: 'h', m: 'm' },
};

/**
 * "7 soat 12 daqiqa" / "7 ч 12 мин" / "7h 12m".
 *
 * ⚠️ Never renders "0 daqiqa": anything under a minute rounds UP to 1, because a
 * countdown that reads zero while the button is still disabled looks broken.
 */
export function formatCooldown(msLeft: number, lang: Lang): string {
  const u = UNITS[lang] ?? UNITS.uz;
  const totalMinutes = Math.max(1, Math.ceil(msLeft / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} ${u.m}`;
  if (m === 0) return `${h} ${u.h}`;
  return `${h} ${u.h} ${m} ${u.m}`;
}

/**
 * The wall-clock time the next paper unlocks, e.g. "10:04".
 *
 * ⚠️ **Device-local on purpose.** Everything else about this limit is an absolute
 * epoch difference, so it needs no timezone — but "unlocks at 10:04" is only
 * useful in the clock the student is looking at. Don't route it through
 * lib/dateUtils.ts (Asia/Tashkent), which exists for attendance/finance DATE KEYS
 * and would print a time a traveller's phone disagrees with.
 */
export function formatUnlockTime(nextAt: number, lang: Lang): string {
  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB';
  return new Date(nextAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
