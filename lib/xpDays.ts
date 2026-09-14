// ─── The day-keys of `users/{uid}.dailyHistory` ─────────────────────────────
// Every XP writer keys the day in **UTC** — `new Date().toISOString().split('T')[0]`
// (services/userService.ts, the test runner, the games). The readers used to
// build their keys from device-local time instead, so east of UTC (Tashkent is
// UTC+5) every key between 00:00 and 05:00 local pointed at a day the writers
// never wrote: today's XP read as 0 and the streak broke overnight.
//
// One helper, one convention: UTC, matching the writers.

const DAY_MS = 86_400_000;

/** The `dailyHistory` key for a moment in time — "YYYY-MM-DD" in UTC. */
export function xpDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days with XP, counting back from today.
 *
 * Today not being logged yet does not break a streak — the day is still open,
 * so the count starts at yesterday. Two silent days do break it.
 */
export function calculateStreak(dailyHistory: Record<string, number> | undefined): number {
  if (!dailyHistory) return 0;

  const now = Date.now();
  const earned = (at: number) => (dailyHistory[xpDayKey(new Date(at))] ?? 0) > 0;

  let cursor: number;
  if (earned(now)) cursor = now;
  else if (earned(now - DAY_MS)) cursor = now - DAY_MS;
  else return 0;

  let streak = 0;
  while (earned(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

/**
 * The four leaderboard period doc IDs for "now" — all UTC, matching the day-key
 * convention above. Every leaderboard writer AND reader must use this one copy:
 * the ISO-week formula in particular must never be re-derived locally, or the
 * writers and readers silently address different `week_*` documents.
 */
export function getPeriodIds(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const oneJan = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((now.getTime() - oneJan.getTime()) / DAY_MS);
  const weekNum = Math.ceil((days + oneJan.getUTCDay() + 1) / 7);
  return {
    dayId: `day_${year}_${month}_${day}`,
    weekId: `week_${year}_${String(weekNum).padStart(2, '0')}`,
    monthId: `month_${year}_${month}`,
    globalId: 'all_time',
  };
}

/** The last 7 UTC days, oldest first — the shape the XP area charts consume. */
export function last7Days(
  dailyHistory: Record<string, number> | undefined,
  lang: string,
): { name: string; XP: number }[] {
  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
  const now = Date.now();

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now - (6 - i) * DAY_MS);
    return {
      // The label must name the same day the key names, so it is read in UTC too.
      name: day.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
      XP: dailyHistory?.[xpDayKey(day)] ?? 0,
    };
  });
}
