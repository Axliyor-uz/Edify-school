// ─── Non-teaching employees (receptionist, cleaner, security, driver, HR…) ───
// A center-scoped roster/HR record BESIDE `center_teachers` (teaching staff)
// and `center_staff` (director/accountant back-office) — for everyone else on
// the payroll. Created directly by the MANAGER (unlike director/accountant,
// which is super-admin-only). See docs/EMPLOYEES.md.
//
// ⚠️ UNLIKE teachers/office staff, an employee gets NO login account — nothing
// in this app needs a cleaner or driver to sign in, so there is no Auth user,
// no username, no credentials doc. The doc id is a plain Firestore auto-id
// (not a uid) that doubles as this employee's stable identifier everywhere
// else that needs one: `center_staff_attendance.staffUid`, a payout's
// `teacherId` (types/finance.ts `Payout`, `staffKind: 'employee'`).
//
// Salary/payroll shapes live in types/finance.ts (EmployeeSalaryConfig,
// EmployeePayoutBreakdown) — this file is the roster/identity half only.

import type { EmployeeSalaryConfig } from "@/types/finance";

export type EmployeeRole = "receptionist" | "cleaner" | "security" | "driver" | "hr" | "other";

export const EMPLOYEE_ROLES: EmployeeRole[] = ["receptionist", "cleaner", "security", "driver", "hr", "other"];

export const isEmployeeRole = (v: unknown): v is EmployeeRole =>
  typeof v === "string" && (EMPLOYEE_ROLES as string[]).includes(v);

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, { uz: string; ru: string; en: string }> = {
  receptionist: { uz: "Qabulxona", ru: "Ресепшн", en: "Receptionist" },
  cleaner: { uz: "Farrosh", ru: "Уборщик", en: "Cleaner" },
  security: { uz: "Qo'riqchi", ru: "Охрана", en: "Security" },
  driver: { uz: "Haydovchi", ru: "Водитель", en: "Driver" },
  hr: { uz: "HR", ru: "HR", en: "HR" },
  other: { uz: "Boshqa", ru: "Другое", en: "Other" },
};

/**
 * `center_employees/{autoId}` — the roster doc, created by a plain client
 * write (mirrors the `rooms` collection pattern — `isActiveCenterManager`,
 * no Auth account involved). `salary` lives here too
 * (types/finance.ts `EmployeeSalaryConfig`), edited only via
 * `POST /api/manager/finance/employee-salary` (the finance module's
 * API-writes-only convention for anything payroll-adjacent).
 */
export interface CenterEmployeeLink {
  /** Same as the doc id. */
  id: string;
  centerId: string;
  employeeName: string;
  role: EmployeeRole;
  phone?: string;
  createdBy: string;
  /** Firestore Timestamp (serverTimestamp at create). */
  addedAt?: unknown;
  /** Written ONLY via POST /api/manager/finance/employee-salary — plain
   *  client reads still see it like every other field on this doc. */
  salary?: EmployeeSalaryConfig;
}
