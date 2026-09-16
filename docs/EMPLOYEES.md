# EMPLOYEES — non-teaching staff (receptionist, cleaner, security, driver, HR…)

> **Agent workflow:** read this BEFORE touching `app/manager/employees/*`, `hooks/useCenterEmployees.ts`,
> `services/employeeService.ts`, the `center_employees` collection, or the employee half of payroll
> (`calculateEmployeePayroll`/`saveEmployeePayout` in `lib/server/financeOps.ts`). Also read
> [MANAGER.md](MANAGER.md) (teacher/staff roster conventions), [FINANCE.md](FINANCE.md) (payroll/expenses),
> and [ATTENDANCE.md](ATTENDANCE.md) (`center_staff_attendance`, which this feature reuses unchanged).
> Index: [README.md](README.md).

**Last verified:** 2026-09-16 (built).

## Purpose & scope

A center-scoped roster for staff who are neither teachers (`center_teachers`) nor back-office oversight
(`center_staff` — director/accountant, [OFFICE.md](OFFICE.md)): receptionist, cleaner, security, driver,
HR, or "other". They get an attendance record and a payroll line, nothing else.

⚠️ **Deliberately NO login account.** Every other staff-like entity in this app (teacher, director,
accountant) gets a Firebase Auth user because they need to use the app — creating content, viewing a
panel. Nothing in this app needs a cleaner or driver to sign in, so `center_employees` has no Auth user,
no username reservation, no synthetic email, no credentials doc. Its doc id is a plain Firestore
auto-id, not a uid — but it doubles as this employee's stable identifier everywhere else that needs one
(`center_staff_attendance.staffUid`, a payout's `teacherId`). Do not "helpfully" add an account later
without deciding a real login destination for it first — today there is none, and the login page's
role-based redirect (docs/AUTH.md) has no `employee` branch.

## Key files

| File | Responsibility |
|---|---|
| [types/employee.ts](../types/employee.ts) | `EmployeeRole`, `EMPLOYEE_ROLES`, `CenterEmployeeLink` — roster/identity shape |
| [types/finance.ts](../types/finance.ts) | `EmployeeSalaryConfig`, `EmployeePayoutBreakdown`, `EmployeePayrollRow`, `StaffKind` — payroll shapes |
| [services/employeeService.ts](../services/employeeService.ts) | Plain client CRUD: `fetchCenterEmployees`, `createEmployee`, `updateEmployee`, `deleteEmployee` |
| [hooks/useCenterEmployees.ts](../hooks/useCenterEmployees.ts) | Mirrors the teacher half of `useCenterClasses` — kept separate (unrelated roster) |
| [app/manager/employees/page.tsx](../app/manager/employees/page.tsx) | List + create + delete |
| [app/manager/employees/_components/ManagerEmployeeInfoPanel.tsx](../app/manager/employees/_components/ManagerEmployeeInfoPanel.tsx) | Edit name/role/phone + salary config (fixed, hourly, allowances, deductions) |
| [lib/server/financeOps.ts](../lib/server/financeOps.ts) | `updateEmployeeSalary`, `calculateEmployeePayroll`, `saveEmployeePayout` — the employee half of payroll; `markPayoutPaid` is REUSED verbatim (see below) |
| [app/api/manager/finance/employee-salary/route.ts](../app/api/manager/finance/employee-salary/route.ts), `.../payroll/employees/{calculate,save}/route.ts` | Thin routes → the functions above |
| [app/manager/finance/_components/EmployeePayrollTab.tsx](../app/manager/finance/_components/EmployeePayrollTab.tsx) | The employee payroll board — a teacher/employee segmented toggle above the Oyliklar tab (`app/manager/finance/page.tsx`) switches between this and the pre-existing `PayrollTab` |
| [app/manager/staff-attendance/page.tsx](../app/manager/staff-attendance/page.tsx) | Merges `center_employees` into the SAME roster fed to `StaffAttendanceGrid` alongside teachers |
| [app/manager/layout.tsx](../app/manager/layout.tsx) | Nav entry "Xodimlar", beside Teachers |

## Data model

### `center_employees/{autoId}` — the roster doc
```ts
{
  centerId: string,
  employeeName: string,
  role: 'receptionist' | 'cleaner' | 'security' | 'driver' | 'hr' | 'other',
  phone?: string,
  createdBy: string,           // manager uid
  addedAt: Timestamp,
  salary?: {                   // written ONLY via /api/manager/finance/employee-salary
    fixed?: number,
    hourlyRate?: number,
    allowances?: { label: string; amount: number }[],
    deductions?: { label: string; amount: number }[],
  },
}
```
Created/edited/deleted by a **plain client Firestore write** gated by `isActiveCenterManager` —
the exact `rooms` collection pattern (docs/ROOMS.md), not the teacher/office-staff account pattern.
`salary` is the one field NOT client-writable (see below) — everything else on this doc is.

⚠️ **No `percent`/`perLesson`** on `EmployeeSalaryConfig` (unlike `TeacherSalaryConfig`) — a revenue
share of "their groups" or a per-lesson rate has no meaning for a driver or cleaner. Payroll here is
`fixed + hourlyRate × hoursWorked(month) + Σallowances − Σdeductions`.

### Payroll reuses `center_payouts` — no parallel collection

`center_payouts/{employeeId}_{YYYY-MM}` (same collection, same doc-id template as teacher payouts —
`payoutDocId()` is not teacher-specific). A payout gains an optional `staffKind: 'employee'`
discriminator (absent = `'teacher'`, unchanged meaning for every payout written before this field
existed). ⚠️ **`teacherId`/`teacherName` are reused verbatim** for the employee's doc-id/name — this is
deliberate, not a bug: it means `markPayoutPaid` (the function that flips a payout to `'paid'` and
creates the linked salary `center_expenses` doc) needs **zero changes** and is called unchanged for
both teachers and employees. Do not add a parallel `employeeId`/`employeeName` pair to `Payout` — every
reader of that collection already keys off `teacherId`/`teacherName` regardless of who they belong to.

### Hours worked — read from `center_staff_attendance`, not a new collection

`calculateEmployeePayroll` sums `center_staff_attendance/{staffUid}_{date}.hoursWorked` for the month,
where `staffUid == ` the employee's `center_employees` doc id — the SAME collection
[ATTENDANCE.md](ATTENDANCE.md) already documents, already fed by `StaffAttendanceGrid`. No new
attendance shape, no new rules, no new index: an employee is just one more row in the existing staff
roster the grid already renders (`app/manager/staff-attendance/page.tsx` merges `useCenterClasses(...).teachers`
and `useCenterEmployees(...).employees` into one `{uid, name}[]` array before handing it to the grid).

## Flows

### Create / edit / delete
Plain client `addDoc`/`updateDoc`/`deleteDoc` on `center_employees` from `app/manager/employees/page.tsx`
— no API route, no Auth call, no rollback logic to reason about (contrast with
`POST /api/manager/teachers/create`, which needs all of that because it also mints a login account).

### Salary config
`ManagerEmployeeInfoPanel` → `saveEmployeeSalaryApi(employeeId, config)` →
`POST /api/manager/finance/employee-salary` → `updateEmployeeSalary` (`financeOps.ts`) — same
"API-writes-only for anything payroll-adjacent" posture the finance module already holds for
`center_teachers.salary` (`updateTeacherSalary`/`/teacher-salary`). `fixed`/`hourlyRate`: `null` or `0`
clears the part (`FieldValue.delete()`). `allowances`/`deductions`: sent as a full array each time —
the array is REPLACED wholesale, not diffed (no `FieldValue.arrayUnion`/`arrayRemove` semantics).

### Payroll: calculate → approve → pay
1. **Live calculate** — `EmployeePayrollTab` → `calculateEmployeePayrollApi(periodKey)` →
   `POST /api/manager/finance/payroll/employees/calculate` (guarded `office: 'any'`, same as the teacher
   route — read-only, lets a director see live numbers) → `calculateEmployeePayroll`: loads every
   `center_employees` doc for the center, sums this month's `hoursWorked`, computes
   `EmployeePayoutBreakdown` per employee, joins any already-saved `center_payouts` row
   (`staffKind === 'employee'` filtered).
2. **Approve** — `saveEmployeePayoutApi` → `POST .../payroll/employees/save` (manager-only, no office
   option — same as `/payroll/save`) → `saveEmployeePayout`: recomputes server-side (the client never
   sends amounts), applies an optional signed `adjustment` (note required if non-zero, same rule as the
   teacher flow's `ApprovePayoutModal`), writes `center_payouts` with `status: 'approved'`.
3. **Mark paid** — the EXISTING `markPayoutPaidApi` / `POST /api/manager/finance/payroll/mark-paid` /
   `markPayoutPaid` — completely unchanged, works for an employee payout exactly as it does for a
   teacher's, because it only ever reads the payout doc's own fields.

## Security rules

```
match /center_employees/{employeeId} {
  allow get: if isAuth() && (
    resource == null || isCenterManager(resource.data.centerId) || isCenterOffice(resource.data.centerId)
  );
  allow list: if isAuth() && (
    isCenterManager(resource.data.centerId) || isCenterOffice(resource.data.centerId)
  );
  allow create, update: if isAuth() && isActiveCenterManager(request.resource.data.centerId);
  allow delete: if isAuth() && isActiveCenterManager(resource.data.centerId);
}
```
No `center_employee_credentials` collection exists — there is nothing to store. No new composite index
(`centerId ==` equality only, same as `center_teachers`/`rooms`).

## Invariants & traps

- ⚠️ **Don't add an Auth account for employees without deciding a login destination first.** The
  scaffolding (translit email/username generation in `lib/teacherProvision.ts`) is fully reusable if
  that decision is made deliberately later — but doing it "for consistency" with teachers/office staff
  is how you end up with a real account that redirects to the wrong dashboard on login (there is no
  `employee` branch in the login page's role redirect, docs/AUTH.md).
- ⚠️ **`Payout.teacherId`/`teacherName` name an EMPLOYEE when `staffKind === 'employee'`.** Any new
  reader of `center_payouts` that assumes those fields always name a teacher (e.g. looks them up in
  `center_teachers`) will silently fail or mislabel employee payouts — check `staffKind` first.
- ⚠️ **Salary `allowances`/`deductions` are replaced wholesale on every save**, not merged — the UI
  always sends the complete current list.
- The employees list page has no search/pagination — fine at the roster sizes a single learning center
  actually has (a handful to a few dozen), not built for hundreds.

## Known issues / dead code (verified 2026-09-16)

- **The office panel (`/office`) does not show employees anywhere** — `OfficeTeachersTab` is still
  teacher-only. A director/accountant currently has no visibility into non-teaching staff or their
  payroll. Deliberately out of scope for this pass; revisit if the office panel needs it.
- **No rules test for `center_employees`** — `tests/rules/*.test.mjs` has no dedicated suite for this
  collection yet. The rules mirror `rooms`' already-tested shape closely, but this is still a gap.
- No cascade delete: `DELETE /api/admin/centers/[id]` does not clean up `center_employees` for a
  deleted center (same known gap `center_staff` has, docs/OFFICE.md).

## How to verify changes

**App** (`npm run dev`), as a manager:
1. `/manager/employees` → add a "Cleaner" with a name and phone → confirm the card appears immediately
   (plain client write, no loading-a-created-account step).
2. Open the profile → set fixed 500,000 + hourly rate 20,000 + one allowance ("Transport", 100,000) →
   Save → confirm `center_employees/{id}.salary` has the shape above.
3. `/manager/staff-attendance` → confirm the new employee appears in the SAME grid as teachers, in
   alphabetical order together. Mark check-in/check-out for a few days → confirm `hoursWorked`
   populates on `center_staff_attendance`.
4. `/manager/finance` → Oyliklar tab → switch the toggle to "Xodimlar" → confirm the calculated amount
   = fixed + hourlyRate×(summed hours) + allowance. Approve → Mark paid → confirm a `center_expenses`
   doc (`category: 'salary'`, `payoutId` set) is created exactly as it is for a teacher payout, and
   that it's excluded/included in the Xarajatlar totals per the same `status === 'active'` rule
   everything else follows.
5. Delete the employee from `/manager/employees` → confirm the roster doc is gone but the
   already-paid `center_payouts`/`center_expenses` history is untouched (append-only, unaffected by
   roster deletion).
6. Confirm `/office`'s O'qituvchilar tab is unaffected (still teacher-only, as documented above).
