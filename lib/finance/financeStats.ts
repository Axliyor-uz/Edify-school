// ─── Shared finance stat math — pure, no Firestore/React ─────────────────────
// Extracted from `app/manager/finance/page.tsx`'s `stats` memo, which
// `app/office/page.tsx` had already independently re-implemented byte-for-byte
// (drift risk: two copies of "how do we compute Foyda"). Both now call this;
// `app/manager/dashboard/page.tsx` is a third consumer (docs/FINANCE.md §12).
// Sits beside `billingEngine.ts`/`money.ts` — this file's established home for
// finance-domain pure math.

import { shiftMonthKey } from "@/lib/finance/billingEngine";
import type { Charge, Expense, Payment } from "@/types/finance";

const openAmountOfCharge = (c: Charge) => Math.max(0, c.amount - (c.paidAmount || 0));

export interface FinanceStatsInput {
  /** This period's charges (any status) — `charged` sums the non-cancelled ones. */
  charges: Charge[];
  /** This period's payments/refunds (any status) — `collected` sums the confirmed ones. */
  monthPayments: Payment[];
  /** ALL-TIME open (pending/partial) charges — not period-scoped, matches the Qarzdorlar tab. */
  openCharges: Charge[];
  /** This period's expenses (any status) — `expensesTotal` sums the exact string `'active'` ones. */
  expenses: Expense[];
}

export interface FinanceStatsResult {
  collected: number;
  charged: number;
  debtTotal: number;
  expensesTotal: number;
  profit: number;
}

/**
 * The six `FinanceStats` numbers minus `avansTotal` (that one comes from a
 * separate all-time query, `fetchPositiveBalances` — see `finance/page.tsx`).
 * ⚠️ `expensesTotal` filters the EXACT string `'active'` — `pending_approval`/
 * `rejected` expenses (docs/FINANCE.md §9) must stay excluded from money
 * totals. Do not widen this to `!== 'cancelled'`.
 */
export function computeFinanceStats({ charges, monthPayments, openCharges, expenses }: FinanceStatsInput): FinanceStatsResult {
  const confirmed = monthPayments.filter((p) => p.status === "confirmed");
  const collected = confirmed.reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
  const charged = charges.filter((c) => c.status !== "cancelled").reduce((s, c) => s + c.amount, 0);
  const debtTotal = openCharges.reduce((s, c) => s + openAmountOfCharge(c), 0);
  const expensesTotal = expenses.filter((e) => e.status === "active").reduce((s, e) => s + e.amount, 0);
  return { collected, charged, debtTotal, expensesTotal, profit: collected - expensesTotal };
}

/**
 * Category → total for the month's ACTIVE expenses, sorted descending —
 * extracted verbatim from `ExpensesTab.tsx`'s `byCategory` memo so the
 * category-chip row and the dashboard's pie chart (docs/FINANCE.md §12) never
 * disagree on the grouping.
 */
export function groupExpensesByCategory(expenses: Expense[]): [string, number][] {
  const active = expenses.filter((e) => e.status === "active");
  const map = new Map<string, number>();
  for (const e of active) map.set(e.category, (map.get(e.category) || 0) + e.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * `n` calendar-month keys ending at (and including) `monthKey`, oldest first —
 * e.g. `buildTrailingMonthKeys("2026-09", 6)` → the 6 months up to and
 * including September. Used to build a trend series by calling a per-month
 * fetcher (`fetchPaymentsForMonth`, `fetchExpensesForMonth`, …) once per key.
 */
export function buildTrailingMonthKeys(monthKey: string, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(shiftMonthKey(monthKey, -i));
  return keys;
}
