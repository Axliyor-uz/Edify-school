// Shared helpers for the IELTS group dashboard tabs.
// Attempts are fetched once at page level (fetchGroupAttempts) and passed down.

import type { IeltsAttempt } from '@/lib/ielts/types';

export type GroupAttempt = { id: string } & IeltsAttempt;

/** Firestore Timestamp | Date | number | ISO string → Date (null when unparseable). */
export function toDateSafe(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const ts = v as { toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function submittedMillis(a: IeltsAttempt): number {
  return toDateSafe(a.submittedAt)?.getTime() ?? 0;
}

/** Band of an attempt: auto-graded bandScore, else the teacher's grade (W/S). */
export function effectiveBand(a: IeltsAttempt): number | null {
  if (typeof a.bandScore === 'number') return a.bandScore;
  if (a.teacherGrade && typeof a.teacherGrade.band === 'number') return a.teacherGrade.band;
  return null;
}

const AGO = {
  uz: { now: 'hozirgina', m: (n: number) => `${n} daqiqa oldin`, h: (n: number) => `${n} soat oldin`, d: (n: number) => `${n} kun oldin` },
  en: { now: 'just now', m: (n: number) => `${n} min ago`, h: (n: number) => `${n} h ago`, d: (n: number) => `${n} d ago` },
  ru: { now: 'только что', m: (n: number) => `${n} мин назад`, h: (n: number) => `${n} ч назад`, d: (n: number) => `${n} дн назад` },
};

export function timeAgo(d: Date | null, lang: string): string {
  if (!d) return '—';
  const L = AGO[lang as keyof typeof AGO] || AGO.uz;
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return L.now;
  if (min < 60) return L.m(min);
  const h = Math.floor(min / 60);
  if (h < 24) return L.h(h);
  const days = Math.floor(h / 24);
  if (days < 7) return L.d(days);
  return fmtDate(d, lang);
}

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

export function fmtDate(d: Date | null, lang: string, withTime = false): string {
  if (!d) return '—';
  const locale = LOCALES[lang] || LOCALES.uz;
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}
