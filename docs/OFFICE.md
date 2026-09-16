# OFFICE — Director & Buxgalter (back-office roles)

> **Agent workflow:** read this BEFORE touching `app/office/*`, `center_staff`, `lib/server/verifyCenterOffice.ts`, the `isCenterOffice()` rules helper, `app/admin/centers/[id]/_components/StaffTab.tsx`, or `/api/admin/centers/[id]/staff`. Update it in the same change whenever you alter behavior described here. Index: [README.md](README.md).
>
> Money model: [FINANCE.md](FINANCE.md). Roles & guards: [AUTH.md](AUTH.md). Provisioning surface: [ADMIN.md](ADMIN.md).

**Last verified:** 2026-09-16 (expense approval — the director's first WRITE capability, [FINANCE.md](FINANCE.md) §9; previously 2026-09-15, built on top of `90fcba7`). ⚠️ `tests/rules/centerStaff.rules.test.mjs` was written with this change but **has not been executed** — the dev machine has no Java, so the Firestore emulator could not start. Run `npm run test:rules` before deploying the ruleset.

## Purpose & scope

Two center-scoped back-office roles that sit **beside** the center manager, not under it:

| Role | `users.role` / `center_staff.staffRole` | Can |
|---|---|---|
| **Director** (direktor) | `director` | Read everything below. Writes **nothing** — except approving/rejecting a buxgalter's pending expense (2026-09-16, [FINANCE.md](FINANCE.md) §9). Never creates one. |
| **Buxgalter** (accountant) | `accountant` | The same reads, **plus** recording and cancelling payments and expenses. An expense THEY record starts `pending_approval` and waits for the manager or director. |

Both see one page, `/office`: the month's money summary, payments, expenses, debtors, and the teaching staff with their attendance and salaries.

## The authorization model (read this before anything else)

⚠️ **`center_staff/{uid}` is the boundary. `users/{uid}.role` is not.**

`users/{uid}` is client-writable ([AUTH.md](AUTH.md) § privileged-field denylist), so anyone could set `role: 'director'` + `centerId: <someone else's>` on their own document. `role` is kept **only** so the login page knows where to redirect; every real decision goes through the link doc:

- `center_staff/{uid}` is `allow write: if false` for every client — the Admin SDK is the only writer.
- Its **doc id must equal the staff uid**, which is what makes `doc(uid)` a trustworthy lookup.

This is the exact `center_teachers` pattern, for the exact same reason. Three enforcement points, all reading the link doc:

| Layer | Where |
|---|---|
| Rules | `isCenterOffice(centerId)` in [firestore.rules](../firestore.rules) |
| Server | `requireCenterOffice(request, roles?)` in [lib/server/verifyCenterOffice.ts](../lib/server/verifyCenterOffice.ts) |
| Client (UX only) | `app/office/layout.tsx`'s guard → `fetchOfficeLink(uid)` |

`isCenterOffice()` looks up the **constant** path `/center_staff/$(request.auth.uid)`, so it costs a fixed number of document accesses no matter how many documents a query returns. That is what keeps it legal inside the finance `list` rules — a per-document `get()` there blows Firestore's access limit (rule #2 in [ATTENDANCE.md](ATTENDANCE.md)).

## Key files

| File | Responsibility |
|---|---|
| [types/office.ts](../types/office.ts) | `OfficeRole`, `CenterStaffLink`, `isOfficeRole`, role labels — single source of truth |
| [lib/server/verifyCenterOffice.ts](../lib/server/verifyCenterOffice.ts) | `requireCenterOffice(request, roles?)` — link doc + approval gate; `OfficeApiError` |
| [lib/server/financeRoute.ts](../lib/server/financeRoute.ts) | `financePostHandler(label, op, { office })` — manager-first, then office fallback |
| [services/officeService.ts](../services/officeService.ts) | `fetchOfficeLink(uid)` (the guard's read), `fetchCenterOfficeStaff(centerId)` |
| [app/office/layout.tsx](../app/office/layout.tsx) | Guard (fails CLOSED) + thin shell; publishes `useOfficeSession()` |
| [app/office/page.tsx](../app/office/page.tsx) | The page: stat header + 4 tabs, reusing the manager's finance components |
| [app/office/_components/OfficeTeachersTab.tsx](../app/office/_components/OfficeTeachersTab.tsx) | Teachers × attendance × salary, read-only |
| [app/api/admin/centers/[id]/staff/route.ts](../app/api/admin/centers/%5Bid%5D/staff/route.ts) | GET list · POST create · PATCH reset password · DELETE revoke (all `requireSuperAdmin`) |
| [app/admin/centers/[id]/_components/StaffTab.tsx](../app/admin/centers/%5Bid%5D/_components/StaffTab.tsx) | The "Office staff" tab in the admin center detail |
| `tests/rules/centerStaff.rules.test.mjs` | Rules regression suite (see the ⚠️ above — not yet run) |

## Data model

### `center_staff/{uid}` — the link doc. **Doc id MUST equal the uid.**
```ts
{
  uid: string,                 // == doc id
  centerId: string,
  staffRole: 'director' | 'accountant',
  name: string,
  email: string,               // synthetic login email (no inbox — see below)
  username: string,
  createdAt: Timestamp,        // serverTimestamp
  createdBy: string,           // super-admin uid
}
```
Rules: `get` = own doc, or the center's manager. `list` = the center's manager, `centerId ==` filtered. `write: if false` — **including for the manager**.

### `center_staff_credentials/{uid}` — the admin-held password
```ts
{ uid, centerId, password: string, updatedAt: Timestamp }
```
Rules: `read, write: if false` — denied to **every** client, manager included. Only the super admin reaches it (god mode / Admin SDK), because the super admin is this account's only recovery path.

⚠️ The generated login email is synthetic (`f.surname@edify.uz`, same `TEACHER_EMAIL_DOMAIN` as manager-created teachers) and **has no inbox** — a password-reset email can never arrive. Do not add self-service password change for these accounts without deciding the recovery story deliberately.

**No new indexes.** Both collections are only ever queried by `centerId ==` (single-field) or fetched by id.

## Provisioning — super admin ONLY

A director outranks the center manager, so letting the manager create one would let them appoint their own oversight. There is deliberately **no `/api/manager/...` twin** of the staff route.

`/admin/centers/{id}` → **Office staff** tab → `POST /api/admin/centers/{id}/staff`:

1. Validate `fullName` (≥3), `staffRole ∈ {director, accountant}`, `password` (≥8).
2. Email / username: explicit → validated, 409 if taken; omitted → generated from the name via [lib/teacherProvision.ts](../lib/teacherProvision.ts) (the same translit + collision-walk the create-teacher route uses, so the admin UI's live preview matches what the server produces).
3. `adminAuth.createUser`, then ONE batch — rolled back (`deleteUser`) if it fails:
   `users/{uid}` (role hint + `accountType:'center-managed'`) · `usernames/{username}` (`batch.create`, race-safe) · `users/{uid}/private/contact` · **`center_staff/{uid}`** · `center_staff_credentials/{uid}`.

- **PATCH** `{uid, password}` — scoped to this center; updates **Auth first**, then the credential doc (the stored password must never claim something that doesn't work).
- **DELETE** `{uid, deleteAccount?}` — deleting the **link** is what revokes access (both guards key off it), so the panel closes immediately even if the Auth user survives. `deleteAccount` defaults to `true` and additionally removes `usernames`, `private/contact`, the user doc and the Auth user.

⚠️ The rules' `users` create allowlist is still `['student', 'teacher', 'manager']` — deliberately. `director`/`accountant` can only ever be written by the Admin SDK; no client can self-serve one.

## What the office panel reads, and how

Reads are plain client-side Firestore, exactly like the manager panel — the rules, not a second data layer, decide who may read. The page therefore reuses [services/financeService.ts](../services/financeService.ts) and [services/attendanceService.ts](../services/attendanceService.ts) **verbatim**, and iron rule #5 still holds: every query filters `centerId ==`.

Collections whose read rules gained `|| isCenterOffice(...)`:
`center_finance_settings` · `center_student_finance` · `center_charges` · `center_payments` · `center_expenses` · `center_payouts` · `center_teachers`.

Already readable without a change: `classes`, `users`, `centers` (`read: if isAuth()`), and `center_attendance` / `center_staff_attendance` (`list: if isAuth()`, the attendance rule-#2 relaxation).

⚠️ **`write: if false` stays absolute on every money collection.** The accountant's ability to record is granted by the API route, never by rules — if a client can write a money doc directly, [FINANCE.md](FINANCE.md) iron rule #4 is broken.

## Writes — the accountant only, through the existing finance routes

No new money code was written. `financePostHandler` gained an `office` option, and five existing routes opt in:

| Route | `office` | Why |
|---|---|---|
| `/api/manager/finance/payments` | `'accountant'` | recording a payment |
| `/api/manager/finance/payments/cancel` | `'accountant'` | money is append-only: cancel + re-enter IS the correction path ([FINANCE.md](FINANCE.md) §4.3), so whoever may record must be able to reverse their own typo |
| `/api/manager/finance/expenses` | `'accountant'` | recording an expense |
| `/api/manager/finance/expenses/cancel` | `'accountant'` | same correction argument |
| `/api/manager/finance/payroll/calculate` | `'any'` | pure computation, writes nothing — lets the **director** see live salaries |
| `/api/manager/finance/expenses/approve` | `'director'` | 🟢 (2026-09-16) manager or director approve a pending expense — **accountant excluded**, a submitter cannot approve their own entry |
| `/api/manager/finance/expenses/reject` | `'director'` | same, rejects with a mandatory reason |

`'director'` is a THIRD `FinanceOfficeAccess` value (beside `'accountant'`/`'any'`) — it means "manager or director, accountant excluded", the opposite selection from `'accountant'`. It exists only for these two routes.

Everything else (`charges/*`, `settings`, `student`, `group-fees`, `payroll/save`, `payroll/mark-paid`, `teacher-salary`) stays **manager-only** by omitting the option.

Resolution order in `resolveFinanceCaller`: try `requireActiveCenterManager` first (the common caller). Only a **403** — authenticated but not this center's manager — falls through to `requireCenterOffice`; a 401 propagates as-is.

⚠️ `uid` in the op context is the **real caller**, so an accountant's uid lands in `receivedBy`/`createdBy`. The audit trail names the person who typed it, not the manager.

## The page

`/office` — stat header (the manager's `FinanceStats`, six cards) pinned above four tabs:

| Tab | Component | Notes |
|---|---|---|
| To'lovlar | `PaymentsTab` (manager's) | `canRecord={session.canRecord}` |
| Xarajatlar | `ExpensesTab` (manager's) | `canRecord={session.canRecord}` |
| Qarzdorlar | `DebtorsTab` (manager's) | all-time open charges + this month's attendance %, same as the manager tab |
| O'qituvchilar | `OfficeTeachersTab` (new) | roster × attendance × salary |

**Reusing the manager's components is deliberate**: the number a director questions must be the exact number the manager sees, and a parallel implementation is how those drift. Each reused component gained an **additive** capability flag that **defaults to the manager's full behavior**, so this page only ever subtracts:

- `PaymentsTab` / `ExpensesTab`: `canRecord?: boolean = true` — hides the add button and the per-row cancel.
- `ExpensesTab` additionally: `canApprove?: boolean = true` (approve/reject buttons on a pending row — the office page passes `staffRole === 'director'`) and `currentUid` (lets the accountant withdraw their OWN still-pending expense).
- `StudentInfoDialog`: `canManage?: boolean = true` (hides discount + freeze, which are manager-only writes) and `onRecordPayment` now accepts `null` (hides the button).

There is no "Umumiy" tab — `FinanceStats` sits above the tab bar and is visible on all of them.

`OfficeTeachersTab` merges three sources per teacher: `center_teachers` (roster, via `useCenterClasses`), `center_staff_attendance` for the month (`fetchStaffSessions`), and `calculatePayrollApi(monthKey)`. The two async halves are `Promise.allSettled`ed so a payroll failure never blanks the attendance column. ⚠️ Rows carry the payout status (`Tasdiqlanmagan` / `Tasdiqlangan` / `To'langan`) so a **live-calculated amount is never mistaken for an agreed salary** — the same care [FINANCE.md](FINANCE.md) §9.1 takes with the teacher's own view.

The shell (`app/office/layout.tsx`) reuses `ManagerThemeProvider` + `ManagerLanguageProvider` + `components/manager-ui/theme.css`, because the reused finance components call `useManagerLanguage()` internally. It has no navigation — the panel is one page.

## Invariants & traps

- ⚠️ **Never authorize off `users.role`.** Add any new office capability behind `center_staff`, in all three layers.
- ⚠️ **Don't relax the money `write` rules** to let an accountant write directly. The API route is the whole design.
- ⚠️ A new reusable manager component consumed by `/office` must default its capability flag to the **manager's** behavior — an opt-out, never an opt-in, or the manager page silently loses a button.
- ⚠️ `center_staff` vs `center_staff_attendance` are unrelated despite the names: the former is office-role links, the latter is teachers' daily attendance ([ATTENDANCE.md](ATTENDANCE.md)).
- The approval gate applies: `requireCenterOffice` rejects a non-`active` center, so a suspended center can't move money through its accountant either. Reads still work (rules use the read-level check), matching manager behavior.
- A director's finance query costs ~3 document accesses (`get(centers/X)` for the failing manager check, then `exists`+`get` on the link). Well under the limit, but don't add more `get()`-based branches to those rules without recounting.
- Office accounts are `accountType: 'center-managed'`, so the student-settings self-service password rule ([AUTH.md](AUTH.md)) would apply if they ever reached that UI. They don't — they only see `/office`.

## Known issues / dead code (verified 2026-09-15)

- **The rules test suite has not been run** (no Java → no emulator). This is the one real gap in this change.
- One office role per person: `center_staff/{uid}` is keyed by uid, so someone cannot be the buxgalter of two centers (same constraint `center_teachers` has). Not enforced with a friendly error — the create call just fails on the Auth email/username, or silently overwrites if the same uid were reused (it can't be, since creation always mints a new Auth user).
- **The admin cascade-delete (`DELETE /api/admin/centers/[id]`) does NOT yet delete `center_staff` / `center_staff_credentials`.** Deleting a center leaves orphaned office links whose `centerId` points nowhere; the guard then fails on the missing center doc, so access is closed, but the documents linger. Worth adding to the cascade's bucket list ([ADMIN.md](ADMIN.md)).
- No office-staff activity log — an accountant's payments are attributable via `receivedBy`, but there is no separate audit view.
- The manager cannot see office staff in the manager panel yet; the `center_staff` list rule permits it and `fetchCenterOfficeStaff()` exists, but no manager page renders it.

## How to verify changes

**Rules:** `npm run test:rules` (or the Java-free-machine caveat above: install a JDK first). `tests/rules/centerStaff.rules.test.mjs` covers the happy path, cross-center isolation, both escalation attempts (self-written link; `role:'director'` on one's own user doc), the write-closed money collections, and that manager/teacher/student access is unchanged.

**App** (`npm run dev`), as a super admin:
1. `/admin/centers/{id}` → **Office staff** → create a **director** (watch email/username auto-fill from the name) → copy the credentials.
2. Log in as that director *with the username*. You should land on `/office`, not `/dashboard`.
3. Confirm the six stat cards match `/manager/finance` for the same month, then check every tab: **no** "To'lov qabul qilish" button, **no** add-expense button, **no** per-row cancel (↩) icons, **no** FAB on mobile. Open a debtor → the dialog shows history but **no** discount/freeze controls and **no** record-payment button.
4. O'qituvchilar tab: teacher rows show groups, this month's attendance %, and a salary with a status chip. Expand one → breakdown lines. Shift the month back and forth.
5. Create an **accountant** in the same center and log in: the same page now has the record/cancel affordances. Record a payment → check the `center_payments` doc's `receivedBy` is the **accountant's** uid, and that the manager's Moliya page shows it. Record an EXPENSE → confirm it shows "Tasdiq kutilmoqda" and is excluded from the Xarajatlar/Foyda stat cards and the Excel export total.
6. As the accountant, hit a manager-only route directly (e.g. `POST /api/manager/finance/charges/generate` with their bearer token) → **403**. As the director, hit `POST /api/manager/finance/payments` → **403**. As the accountant, hit `POST /api/manager/finance/expenses/approve` → **403** (director/manager only).
6b. Log back in as the director → confirm Approve/Reject buttons appear on the accountant's pending expense (and only that row). Reject one with a reason → chip shows the reason, still excluded from totals. Approve the other → flips to `active`, immediately appears in the stat cards. Log back in as the accountant → confirm they can Withdraw a still-pending expense of their own, but have no Approve/Reject buttons on anyone else's.
7. Back in `/admin`, "New password" on a row → log in with the new one. "Remove" → the user can no longer reach `/office`.
8. Regression: a manager, a teacher and a student each still land on their own dashboard, and `/manager/finance` is byte-for-byte as before (record, cancel, discount, freeze all still present).
