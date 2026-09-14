// ─── Pure billing logic — NO Firebase imports ─────────────────────────────────
// Everything here is a deterministic function of its inputs so it can be
// exercised in isolation. Server transactions (lib/server/financeOps.ts) and
// client previews both call these. Rules: docs/FINANCE.md §3–4.

import { formatDateKey, parseDateKey } from "@/lib/dateUtils";
import type { ScheduleEntry } from "@/types/attendance";
import { roundTo1000 } from "./money";

// ─── Price resolution ─────────────────────────────────────────────────────────

export interface ResolvedPrice {
  baseAmount: number;
  discountAmount: number;
  amount: number;
}

/** Order: per-student override (wins outright, no discount on top) → discount% → group fee. */
export function resolvePrice(monthlyFee: number, override?: number, discountPercent?: number): ResolvedPrice {
  if (typeof override === "number") {
    return { baseAmount: override, discountAmount: 0, amount: override };
  }
  const pct = typeof discountPercent === "number" ? Math.min(100, Math.max(0, discountPercent)) : 0;
  const discountAmount = pct > 0 ? roundTo1000((monthlyFee * pct) / 100) : 0;
  return { baseAmount: monthlyFee, discountAmount, amount: monthlyFee - discountAmount };
}

// ─── Periods ──────────────────────────────────────────────────────────────────

export interface BillingPeriod {
  /** Calendar: "YYYY-MM". Rolling: cycle start "YYYY-MM-DD". Used in the charge doc id. */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
}

export function calendarPeriod(periodKey: string): BillingPeriod {
  const [y, m] = periodKey.split("-").map(Number);
  return {
    periodKey,
    periodStart: formatDateKey(new Date(y, m - 1, 1)),
    periodEnd: formatDateKey(new Date(y, m, 0)),
  };
}

/** Add n days to a "YYYY-MM-DD" key. */
export function addDays(dateKey: string, n: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + n);
  return formatDateKey(d);
}

/**
 * Add n months to an anchor key, clamping the day-of-month (Jan 31 + 1mo → Feb 28/29).
 * Always computed from the ORIGINAL anchor so clamping never drifts the cycle day.
 */
export function addMonthsClamped(anchorKey: string, n: number): string {
  const d = parseDateKey(anchorKey);
  const firstOfTarget = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const daysInTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  firstOfTarget.setDate(Math.min(d.getDate(), daysInTarget));
  return formatDateKey(firstOfTarget);
}

/**
 * Rolling mode: every cycle from the enrollment date whose start is <= todayKey.
 * The caller filters out cycles that already have a charge (deterministic ids),
 * which is what makes missed-cycle catch-up automatic.
 */
export function rollingCyclesUpTo(enrollmentDate: string, todayKey: string, maxCycles = 36): BillingPeriod[] {
  const out: BillingPeriod[] = [];
  for (let n = 0; n < maxCycles; n++) {
    const start = addMonthsClamped(enrollmentDate, n);
    if (start > todayKey) break;
    out.push({
      periodKey: start,
      periodStart: start,
      periodEnd: addDays(addMonthsClamped(enrollmentDate, n + 1), -1),
    });
  }
  return out;
}

export function calendarDueDate(periodKey: string, dueDayOfMonth: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, Math.round(dueDayOfMonth) || 1), daysInMonth);
  return `${periodKey}-${String(day).padStart(2, "0")}`;
}

export function rollingDueDate(periodStart: string, dueDaysAfterStart: number): string {
  return addDays(periodStart, Math.max(0, Math.round(dueDaysAfterStart) || 0));
}

// ─── Proration ────────────────────────────────────────────────────────────────

/**
 * Occurrences of the class's scheduled weekdays within [fromKey..toKey] inclusive.
 * With no schedule, every calendar day counts (plain day-ratio fallback).
 */
export function countScheduledDays(
  schedule: ScheduleEntry[] | undefined,
  fromKey: string,
  toKey: string
): number {
  if (fromKey > toKey) return 0;
  const wanted = new Set((schedule || []).map((s) => s.dayOfWeek));
  const to = parseDateKey(toKey);
  let count = 0;
  for (const d = parseDateKey(fromKey); d <= to; d.setDate(d.getDate() + 1)) {
    if (wanted.size === 0 || wanted.has(d.getDay())) count++;
  }
  return count;
}

/**
 * First-period proration: pay only for the part of the period from the join date.
 * Ratio = remaining scheduled lesson days / total scheduled lesson days, rounded
 * to 1,000 so'm. Join before the period → full amount; after it → 0.
 */
export function prorate(
  amount: number,
  period: BillingPeriod,
  joinKey: string,
  schedule?: ScheduleEntry[]
): number {
  if (joinKey <= period.periodStart) return amount;
  if (joinKey > period.periodEnd) return 0;
  const total = countScheduledDays(schedule, period.periodStart, period.periodEnd);
  if (total === 0) return amount;
  const remaining = countScheduledDays(schedule, joinKey, period.periodEnd);
  return roundTo1000((amount * remaining) / total);
}

// ─── Payment allocation ───────────────────────────────────────────────────────

export interface AllocatableCharge {
  id: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
}

export interface AllocationResult {
  allocations: { chargeId: string; amount: number }[];
  unallocated: number;
}

/** Oldest-due-first (FIFO) allocation. Pure — does not mutate the input charges. */
export function allocateOldestFirst(amount: number, openCharges: AllocatableCharge[]): AllocationResult {
  const sorted = [...openCharges].sort((a, b) =>
    a.dueDate === b.dueDate ? a.id.localeCompare(b.id) : a.dueDate < b.dueDate ? -1 : 1
  );
  let left = amount;
  const allocations: { chargeId: string; amount: number }[] = [];
  for (const c of sorted) {
    if (left <= 0) break;
    const open = c.amount - c.paidAmount;
    if (open <= 0) continue;
    const take = Math.min(open, left);
    allocations.push({ chargeId: c.id, amount: take });
    left -= take;
  }
  return { allocations, unallocated: left };
}

/** Charge status from its paid state (never returns waived/cancelled — those are explicit). */
export function statusForPaid(amount: number, paidAmount: number): "pending" | "partial" | "paid" {
  if (paidAmount <= 0) return "pending";
  return paidAmount >= amount ? "paid" : "partial";
}
