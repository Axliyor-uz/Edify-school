// ─── Shared date helpers for attendance ──────────────────────────────────────
// The app previously computed attendance date-keys from device-local time, while
// AI limits used Asia/Tashkent. This standardizes attendance on Asia/Tashkent.

export const CENTER_TZ = "Asia/Tashkent";

/** Today's date key "YYYY-MM-DD" in center time (Asia/Tashkent). */
export function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: CENTER_TZ });
}

/** "YYYY-MM-DD" for an arbitrary Date, in center time. */
export function toDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CENTER_TZ });
}

/**
 * Format a local calendar Date to a "YYYY-MM-DD" key using its own fields
 * (no timezone shift). Used when iterating a locally-built calendar grid, where
 * each Date already represents the intended day.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Month bucket "YYYY-MM" for a date key. */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}
