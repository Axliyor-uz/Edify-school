// ─── Finance client service ───────────────────────────────────────────────────
// READS go straight to Firestore — every query MUST filter `centerId ==`
// (tenancy + the list rules are only provable with it — FINANCE.md §6).
// MUTATIONS go through /api/manager/finance/* (the client never writes money docs).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { managerApiFetch as apiFetch } from "@/lib/managerApi";
import {
  DEFAULT_FINANCE_SETTINGS,
  studentFinanceDocId,
  type BillingAnchor,
  type CalculatePayrollResult,
  type Charge,
  type Expense,
  type FinanceSettings,
  type GenerateChargesRequest,
  type GenerateChargesResult,
  type Payment,
  type RecordPaymentRequest,
  type RecordPaymentResult,
  type StudentFinancePatch,
  type StudentFinanceProfile,
  type TeacherSalaryConfig,
} from "@/types/finance";

const chargeFromDoc = (d: { id: string; data: () => any }): Charge => ({ ...(d.data() as Charge), id: d.id });
const paymentFromDoc = (d: { id: string; data: () => any }): Payment => ({ ...(d.data() as Payment), id: d.id });

/** Unpaid remainder of a charge. */
export const openAmountOf = (c: Charge) => Math.max(0, c.amount - (c.paidAmount || 0));

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function fetchFinanceSettings(centerId: string): Promise<FinanceSettings> {
  const snap = await getDoc(doc(db, "center_finance_settings", centerId));
  return { ...DEFAULT_FINANCE_SETTINGS, ...(snap.data() || {}), centerId } as FinanceSettings;
}

/**
 * Charges belonging to a month: calendar mode matches periodKey; rolling mode
 * matches cycles STARTING within the month (periodStart range).
 */
export async function fetchChargesForMonth(
  centerId: string,
  monthKey: string,
  anchor: BillingAnchor
): Promise<Charge[]> {
  const base = collection(db, "center_charges");
  const q =
    anchor === "calendar"
      ? query(base, where("centerId", "==", centerId), where("periodKey", "==", monthKey))
      : query(
          base,
          where("centerId", "==", centerId),
          where("periodStart", ">=", `${monthKey}-01`),
          where("periodStart", "<=", `${monthKey}-31`)
        );
  const snap = await getDocs(q);
  return snap.docs
    .map(chargeFromDoc)
    .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.classTitle.localeCompare(b.classTitle));
}

/** All open (pending|partial) charges of the center, oldest due first — the debtor feed. */
export async function fetchOpenCharges(centerId: string): Promise<Charge[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_charges"),
      where("centerId", "==", centerId),
      where("status", "in", ["pending", "partial"]),
      orderBy("dueDate", "asc")
    )
  );
  return snap.docs.map(chargeFromDoc);
}

export async function fetchStudentCharges(centerId: string, studentId: string): Promise<Charge[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_charges"),
      where("centerId", "==", centerId),
      where("studentId", "==", studentId),
      orderBy("periodStart", "desc")
    )
  );
  return snap.docs.map(chargeFromDoc);
}

export async function fetchRecentPayments(centerId: string, max = 50): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_payments"),
      where("centerId", "==", centerId),
      orderBy("createdAt", "desc"),
      fbLimit(max)
    )
  );
  return snap.docs.map(paymentFromDoc);
}

export async function fetchStudentPayments(centerId: string, studentId: string, max = 100): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_payments"),
      where("centerId", "==", centerId),
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc"),
      fbLimit(max)
    )
  );
  return snap.docs.map(paymentFromDoc);
}

/** Payments whose BUSINESS date (paidAt) falls in the month — for collected totals. Includes cancelled; filter by status. */
export async function fetchPaymentsForMonth(centerId: string, monthKey: string): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_payments"),
      where("centerId", "==", centerId),
      where("paidAt", ">=", `${monthKey}-01`),
      where("paidAt", "<=", `${monthKey}-31`)
    )
  );
  return snap.docs.map(paymentFromDoc);
}

/** Profiles with avans (positive balance) — the prepayment pot shown on the dashboard. */
export async function fetchPositiveBalances(centerId: string): Promise<StudentFinanceProfile[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_student_finance"),
      where("centerId", "==", centerId),
      where("balance", ">", 0)
    )
  );
  return snap.docs.map((d) => d.data() as StudentFinanceProfile);
}

export async function fetchStudentFinanceProfile(
  centerId: string,
  studentId: string
): Promise<StudentFinanceProfile | null> {
  const snap = await getDoc(doc(db, "center_student_finance", studentFinanceDocId(centerId, studentId)));
  return snap.exists() ? (snap.data() as StudentFinanceProfile) : null;
}

/** Expenses whose business date falls in the month. Includes cancelled; filter by status. */
export async function fetchExpensesForMonth(centerId: string, monthKey: string): Promise<Expense[]> {
  const snap = await getDocs(
    query(
      collection(db, "center_expenses"),
      where("centerId", "==", centerId),
      where("date", ">=", `${monthKey}-01`),
      where("date", "<=", `${monthKey}-31`)
    )
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as Expense), id: d.id }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Mutations (API routes) ───────────────────────────────────────────────────

export const generateChargesApi = (body: GenerateChargesRequest) =>
  apiFetch<GenerateChargesResult>("/api/manager/finance/charges/generate", { method: "POST", body });

export const recordPaymentApi = (body: RecordPaymentRequest) =>
  apiFetch<RecordPaymentResult>("/api/manager/finance/payments", { method: "POST", body });

export const cancelPaymentApi = (paymentId: string, reason: string) =>
  apiFetch("/api/manager/finance/payments/cancel", { method: "POST", body: { paymentId, reason } });

export const waiveChargeApi = (chargeId: string, reason: string) =>
  apiFetch("/api/manager/finance/charges/waive", { method: "POST", body: { chargeId, reason } });

export const cancelChargeApi = (chargeId: string, reason: string) =>
  apiFetch("/api/manager/finance/charges/cancel", { method: "POST", body: { chargeId, reason } });

export const adjustChargeApi = (chargeId: string, amount: number, note?: string) =>
  apiFetch("/api/manager/finance/charges/adjust", { method: "POST", body: { chargeId, amount, note } });

export const patchStudentFinanceApi = (studentId: string, patch: StudentFinancePatch) =>
  apiFetch("/api/manager/finance/student", { method: "POST", body: { studentId, patch } });

export const saveFinanceSettingsApi = (patch: Partial<FinanceSettings>) =>
  apiFetch<FinanceSettings>("/api/manager/finance/settings", { method: "POST", body: patch });

export const saveGroupFeesApi = (fees: Record<string, number>) =>
  apiFetch<{ updated: number }>("/api/manager/finance/group-fees", { method: "POST", body: { fees } });

// ─── Phase 3: expenses + payroll ──────────────────────────────────────────────

export const createExpenseApi = (body: { category: string; amount: number; date?: string; note?: string }) =>
  apiFetch<{ expenseId: string }>("/api/manager/finance/expenses", { method: "POST", body });

export const cancelExpenseApi = (expenseId: string, reason: string) =>
  apiFetch("/api/manager/finance/expenses/cancel", { method: "POST", body: { expenseId, reason } });

export const calculatePayrollApi = (periodKey: string) =>
  apiFetch<CalculatePayrollResult>("/api/manager/finance/payroll/calculate", { method: "POST", body: { periodKey } });

export const savePayoutApi = (body: { teacherId: string; periodKey: string; adjustment?: number; adjustmentNote?: string }) =>
  apiFetch("/api/manager/finance/payroll/save", { method: "POST", body });

export const markPayoutPaidApi = (payoutId: string) =>
  apiFetch("/api/manager/finance/payroll/mark-paid", { method: "POST", body: { payoutId } });

export const saveTeacherSalaryApi = (teacherId: string, config: Partial<Record<keyof TeacherSalaryConfig, number | null>>) =>
  apiFetch("/api/manager/finance/teacher-salary", { method: "POST", body: { teacherId, config } });
