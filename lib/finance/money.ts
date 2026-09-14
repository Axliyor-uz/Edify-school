// ─── Money helpers — integer so'm only (FINANCE.md iron rule #3) ─────────

/** Proration/discount rounding: nearest 1,000 so'm. */
export function roundTo1000(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/** "400 000 so'm" (space-grouped). Negative values get a leading minus. */
export function formatUZS(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("ru-RU")} so'm`;
}

/** Bare grouped number without the currency word — for table cells. */
export function formatSum(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("ru-RU")}`;
}

/** True for a usable money input: positive integer so'm. */
export function isValidAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}
