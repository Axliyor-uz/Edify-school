// ─── Finance module types — single source of truth ───────────────────────────
// Data model + iron rules: docs/FINANCE.md. Import from here; don't
// re-declare finance shapes elsewhere. All money values are INTEGER so'm.
// Timestamp fields are `any` because docs cross the client/Admin SDK boundary.

export type BillingAnchor = "calendar" | "enrollment";
export type PercentBase = "collected" | "charged";

export interface FinanceSettings {
  centerId: string;
  /** 'calendar' = everyone billed per calendar month; 'enrollment' = rolling cycle from each student's join date. */
  billingAnchor: BillingAnchor;
  /** Prorate the first charge when a student joins mid-period. */
  prorateFirstMonth: boolean;
  /** Calendar mode: charges are due on this day of the billed month (clamped to month length). */
  dueDayOfMonth: number;
  /** Rolling mode: charges are due N days after the cycle start. */
  dueDaysAfterStart: number;
  /** Phase 3 payroll: teacher % is computed from collected or charged money. Stored now, used later. */
  percentBase: PercentBase;
  /** Phase 3 expenses: editable category list. Stored now, used later. */
  expenseCategories: string[];
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_FINANCE_SETTINGS: Omit<FinanceSettings, "centerId" | "createdAt" | "updatedAt"> = {
  billingAnchor: "calendar",
  prorateFirstMonth: true,
  dueDayOfMonth: 5,
  dueDaysAfterStart: 5,
  percentBase: "collected",
  expenseCategories: ["ijara", "kommunal", "marketing", "jihozlar", "boshqa"],
};

// ─── Charges ──────────────────────────────────────────────────────────────────

export type ChargeStatus = "pending" | "partial" | "paid" | "waived" | "cancelled";

/** Doc: center_charges/{classId}_{studentId}_{periodKey} — append-only, cancel-not-delete. */
export interface Charge {
  id: string;
  centerId: string;
  classId: string;
  studentId: string;
  /** Snapshots at generation time — fast lists without N user reads; never updated. */
  classTitle: string;
  studentName: string;
  /** Calendar mode: "YYYY-MM". Rolling mode: cycle start "YYYY-MM-DD". */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  /** Resolved price BEFORE discount/proration (override or group monthlyFee). */
  baseAmount: number;
  discountAmount: number;
  /** Set when the first period was prorated: the enrollment date proration started from. */
  proratedFrom?: string;
  /** What the student owes. Waiving rewrites amount := paidAmount (see FINANCE.md §2). */
  amount: number;
  /** Cached Σ of confirmed payment allocations. */
  paidAmount: number;
  status: ChargeStatus;
  dueDate: string;
  note?: string;
  createdAt?: any;
  createdBy: string;
  adjustedAt?: any;
  adjustedBy?: string;
  waivedAt?: any;
  waivedBy?: string;
  waiveReason?: string;
  /** Remainder forgiven at waive time (amount − paidAmount then) — for reports. */
  forgivenAmount?: number;
  cancelledAt?: any;
  cancelledBy?: string;
  cancelReason?: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type PaymentType = "payment" | "refund";
export type PaymentMethod = "cash" | "card" | "click" | "payme" | "transfer" | "other";
export type PaymentStatus = "confirmed" | "cancelled";
export type PaymentSource = "manual" | "payme_gateway" | "click_gateway";

export interface PaymentAllocation {
  chargeId: string;
  amount: number;
}

/**
 * One line of a payment/expense split across several methods — e.g. 500,000
 * so'm as 300,000 by card + 200,000 cash. `label` is a free-text tag for a
 * `card`/`transfer`/`other` line (e.g. "AAA karta") — there is no named-account
 * registry, so it is typed fresh on every entry and simply snapshotted here.
 * Sibling lines' `amount`s must sum to the payment/expense's own `amount`
 * (enforced server-side — `lib/server/financeOps.ts::normalizeMethodSplit`).
 */
export interface PaymentMethodSplit {
  method: PaymentMethod;
  amount: number;
  label?: string;
}

/** Doc: center_payments/{autoId} — append-only, cancel-not-delete. `amount` is always positive; direction = `type`. */
export interface Payment {
  id: string;
  centerId: string;
  studentId: string;
  studentName: string;
  type: PaymentType;
  amount: number;
  /** The single method, OR — when `methodSplit` has more than one distinct
   *  method — `"other"`. Kept so every existing reader that only knows this
   *  scalar field still shows something sane; `methodSplit` (below) is the
   *  detailed, authoritative breakdown when present. */
  method: PaymentMethod;
  /** Present only when the manager entered more than one method/line. Absent
   *  on every payment recorded before this field existed, and on a plain
   *  single-method payment recorded after — both read as "just `method`". */
  methodSplit?: PaymentMethodSplit[];
  source: PaymentSource;
  /** Future gateway transaction id. */
  externalId?: string;
  allocations: PaymentAllocation[];
  /** The avans (prepayment) part — consumed by future charge generation. */
  unallocatedAmount: number;
  /** Business date "YYYY-MM-DD" — backdatable for paper-notebook onboarding. */
  paidAt: string;
  note?: string;
  receivedBy: string;
  createdAt?: any;
  status: PaymentStatus;
  cancelledAt?: any;
  cancelledBy?: string;
  cancelReason?: string;
}

// ─── Student finance profile ──────────────────────────────────────────────────

export type StudentFinanceStatus = "active" | "frozen";

/**
 * Doc: center_student_finance/{centerId}_{studentUid} — created lazily.
 * balance = Σ payments − Σ refunds − Σ amount of non-cancelled charges (cached, kept in
 * the same transaction as every mutation). balance < 0 = qarz, > 0 = avans.
 */
export interface StudentFinanceProfile {
  centerId: string;
  studentId: string;
  balance: number;
  /** 0–100; applies to every group unless a priceOverride wins. */
  discountPercent?: number;
  /** Absolute monthly price per classId — beats monthlyFee AND discountPercent. */
  priceOverrides?: Record<string, number>;
  /** frozen → skipped at charge generation. */
  financeStatus: StudentFinanceStatus;
  frozenAt?: string;
  /** classId → "YYYY-MM-DD" join date; drives rolling cycles + first-month proration. */
  enrollmentDates?: Record<string, string>;
  updatedAt?: any;
}

export const studentFinanceDocId = (centerId: string, studentId: string) => `${centerId}_${studentId}`;
export const chargeDocId = (classId: string, studentId: string, periodKey: string) =>
  `${classId}_${studentId}_${periodKey}`;

// ─── API payloads (client ⇄ /api/manager/finance/*) ──────────────────────────

export interface GenerateChargesRequest {
  /** Calendar mode: which "YYYY-MM" to generate (default: current month). Ignored in rolling mode. */
  periodKey?: string;
  dryRun?: boolean;
}

export interface GenerateChargesResult {
  dryRun: boolean;
  created: number;
  skipped: number;
  frozenSkipped: number;
  totalAmount: number;
  perClass: { classId: string; classTitle: string; created: number; amount: number }[];
}

export interface RecordPaymentRequest {
  studentId: string;
  amount: number;
  type: PaymentType;
  /** Ignored server-side when `methodSplit` is a non-empty array (the method
   *  is then derived from it) — still required on the wire so an older caller
   *  that never learned about splitting keeps working unchanged. */
  method: PaymentMethod;
  /** Optional: pay/refund this `amount` across 2+ methods at once. Each line's
   *  `amount` must be a positive integer, and every line together must sum to
   *  exactly `amount` — validated in `recordPayment`. */
  methodSplit?: PaymentMethodSplit[];
  paidAt?: string;
  note?: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  allocations: PaymentAllocation[];
  unallocatedAmount: number;
  newBalance: number;
}

/** Patch for /api/manager/finance/student — `null` deletes a map entry / clears a field. */
export interface StudentFinancePatch {
  discountPercent?: number | null;
  priceOverrides?: Record<string, number | null>;
  financeStatus?: StudentFinanceStatus;
  enrollmentDates?: Record<string, string | null>;
}

// ─── Expenses (Phase 3) ───────────────────────────────────────────────────────

export type ExpenseStatus = "active" | "cancelled";

/** Doc: center_expenses/{autoId} — append-only, cancel-not-delete. Salary payouts land here too. */
export interface Expense {
  id: string;
  centerId: string;
  /** One of settings.expenseCategories, or the reserved "salary" for payroll. */
  category: string;
  amount: number;
  /** Business date "YYYY-MM-DD" (backdatable, not future). */
  date: string;
  note?: string;
  /** Absent on every expense recorded before this field existed (incl. salary
   *  payouts, which never set it) — those simply show no method. Same
   *  single-vs-split relationship to `methodSplit` as `Payment.method`. */
  method?: PaymentMethod;
  methodSplit?: PaymentMethodSplit[];
  /** Set on salary expenses — links back to the payout. */
  teacherId?: string;
  payoutId?: string;
  createdBy: string;
  createdAt?: any;
  status: ExpenseStatus;
  cancelledAt?: any;
  cancelledBy?: string;
  cancelReason?: string;
}

// ─── Payroll (Phase 3) ────────────────────────────────────────────────────────

/** Stored as the `salary` map on center_teachers/{uid}. All parts optional; payout = sum of configured parts. */
export interface TeacherSalaryConfig {
  /** Fixed monthly amount (so'm). */
  fixed?: number;
  /** % of the teacher's groups' revenue; base = settings.percentBase. 0–100. */
  percent?: number;
  /** Per held/makeup lesson (so'm), counted from center_attendance. */
  perLesson?: number;
}

export interface PayoutBreakdown {
  fixed: number;
  percent: { rate: number; base: PercentBase; baseAmount: number; amount: number };
  perLesson: { count: number; rate: number; amount: number };
}

export type PayoutStatus = "approved" | "paid";

/** Doc: center_payouts/{teacherUid}_{YYYY-MM} — saved (approved) salary for one teacher+month. */
export interface Payout {
  id: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  periodKey: string; // "YYYY-MM" — payroll is always calendar-monthly
  breakdown: PayoutBreakdown;
  calculatedAmount: number;
  adjustment: number; // signed: bonus (+) / penalty (−)
  adjustmentNote?: string;
  finalAmount: number;
  status: PayoutStatus;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
  paidAt?: string; // YYYY-MM-DD
  expenseId?: string;
}

export const payoutDocId = (teacherId: string, periodKey: string) => `${teacherId}_${periodKey}`;

/** One row of the payroll screen: live calculation + the saved payout if any. */
export interface PayrollRow {
  teacherId: string;
  teacherName: string;
  config: TeacherSalaryConfig;
  breakdown: PayoutBreakdown;
  calculatedAmount: number;
  payout: Payout | null;
}

export interface CalculatePayrollResult {
  periodKey: string;
  percentBase: PercentBase;
  rows: PayrollRow[];
}

// ─── UI labels (uz) ───────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Naqd",
  card: "Karta",
  click: "Click",
  payme: "Payme",
  transfer: "O'tkazma",
  other: "Boshqa",
};

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  pending: "To'lanmagan",
  partial: "Qisman",
  paid: "To'langan",
  waived: "Kechirilgan",
  cancelled: "Bekor qilingan",
};
