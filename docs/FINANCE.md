# FINANCE — Charges, Payments, Payroll & Expenses

> **Agent workflow:** read this BEFORE touching anything under `app/manager/finance/`, `app/api/manager/finance/*`, `lib/finance/*`, `lib/server/financeOps.ts`, or the finance collections. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).
>
> **Quick reference:** [FINANCE_DATABASE.md](FINANCE_DATABASE.md) maps every collection and,
> per UI action, exactly which documents change — read that first for "where does my data go".

**Last verified:** 2026-09-16 (expense approval workflow — §9, the director's first WRITE capability; previously 2026-09-15, the buxgalter/director back-office got read access + an accountant write path — §5.1, [OFFICE.md](OFFICE.md); previously 2026-09-14, the multi-method split §4.2a). Tuition core (Phase 1) and payroll & expenses (Phase 3) are **built — this is a current-state reference**; §10 lists what remains future. (Formerly `FINANCE_PLAN.md`.)

## 0. Locked product decisions

| Decision | Choice |
|---|---|
| Billing model | Monthly fixed fee per group (`classes.monthlyFee`) + per-student overrides/discounts |
| Billing cycle | Per-center setting: `calendar` month **or** `enrollment` (rolling from join date) |
| Money out | Salaries + expenses (Phase 3) |
| Salary % base | Per-center setting: % of collected vs % of charged (Phase 3) |
| Collection | Manual recording by manager, integration-ready for Payme/Click |
| Visibility | Manager UI + a read-only student self-view: `GET /api/student/finance` (Admin SDK, caller's own uid only) feeding `app/(student)/payments/page.tsx` — the client-side rules stay manager-only |
| Receipts / SMS reminders | Later phases |
| Contracts / branches / multi-currency / cashier role | Out of scope; UZS only; manager records payments |

## 1. Iron rules (violating these creates money bugs)

1. **Append-only money.** `center_charges` and `center_payments` are never edited or deleted —
   only status-cancelled (`cancelledBy`, `cancelledAt`, `cancelReason`). Corrections = cancel + re-enter.
2. **Charges are snapshots.** Price, student name, class title are *copied into* the charge at
   generation. Later price/discount changes never touch existing charges.
3. **All money is integer so'm.** No floats, no decimals. Proration rounds to the nearest 1,000 so'm.
4. **All writes go through `/api/manager/finance/*`** (Admin SDK, transactions). The client never
   writes finance collections directly — this is what makes a Payme/Click webhook a drop-in later.
5. **Every client query filters `where('centerId','==',X)`.** Both for tenancy and because the
   security list rules are only provable with that filter (see §6).
6. **Deterministic charge IDs** — `${classId}_${studentId}_${periodKey}` — make generation
   idempotent. Server uses Admin SDK `create()` (fails if exists) so double-clicks/races cannot double-charge.
7. **Dates**: `YYYY-MM-DD` keys in Asia/Tashkent via `lib/dateUtils.ts` (same as attendance).
   Timestamps for audit fields (`createdAt` etc.) are Firestore `Timestamp`s.
8. **Never write `undefined`** (Firestore throws). Build optional fields conditionally.
9. **Center classes = `classes.centerId == centerId`** (centerId-anchored membership,
   2026-07-15 — see [MANAGER.md](MANAGER.md)). `resolveCenterClasses` is ONE query; a linked
   teacher's personal groups are NOT the center's and must never be billed. Every finance
   doc still stores `centerId` explicitly (snapshot at write time).

## 2. Balance semantics (sign convention)

`center_student_finance.balance` is a **cached** value, maintained transactionally:

```
balance = Σ confirmed payments − Σ confirmed refunds − Σ amount of all NON-CANCELLED charges
```

- `balance < 0` → student owes money (qarz)
- `balance > 0` → prepayment credit (avans)
- Waiving a charge forgives only its **unpaid remainder**: balance += (amount − paidAmount), then
  **amount is reduced to paidAmount** and status → `waived`. A waived charge therefore stays in the
  balance sum contributing exactly −paidAmount (the money actually consumed) — this is why the sum
  is over non-cancelled charges, not just pending|partial|paid. Cancelling requires `paidAmount == 0`
  (a cancelled charge contributes 0). If a payment allocated to a waived charge is later cancelled,
  decrement both `paidAmount` and `amount` to keep the waived invariant `amount == paidAmount`.
- The debtor list is driven by **charge docs** (per-month rows), not by balance — balance is the
  headline number, charges are the receipts behind it.
- (Phase 2: an admin "recalculate balance" repair that re-derives from the ledger.)

## 3. Data model

### 3.1 `center_finance_settings/{centerId}` — created lazily with defaults on first finance visit
```ts
{
  centerId: string,
  billingAnchor: 'calendar' | 'enrollment',   // default 'calendar'
  prorateFirstMonth: boolean,                 // default true
  dueDayOfMonth: number,                      // calendar mode: charge due on this day (default 5)
  dueDaysAfterStart: number,                  // rolling mode: due N days after periodStart (default 5)
  percentBase: 'collected' | 'charged',       // Phase 3 payroll; stored now (default 'collected')
  expenseCategories: string[],                // Phase 3; seeded defaults
  createdAt, updatedAt: Timestamp,
}
```

### 3.2 `classes/{classId}` — one new field
```ts
monthlyFee?: number   // integer so'm; missing or 0 → group is not billed
```
Edited in the group settings tab (client write — `classes` is already manager-writable).

### 3.3 `center_student_finance/{centerId}_{studentUid}` — per-student finance profile (lazy)
```ts
{
  centerId, studentId: string,
  balance: number,                            // cached; see §2
  discountPercent?: number,                   // 0–100, applies to every group the student is in
  priceOverrides?: { [classId]: number },     // absolute monthly price for that group (wins over discount)
  financeStatus: 'active' | 'frozen',         // frozen → skipped at charge generation
  frozenAt?: string,                          // YYYY-MM-DD
  enrollmentDates?: { [classId]: string },    // YYYY-MM-DD; needed for rolling cycles + proration
  updatedAt: Timestamp,
}
```
`enrollmentDates` is stamped best-effort when the manager adds a student
(`ManagerAddStudentModal`); if missing at generation time (student joined via join-code, or
pre-finance data), the engine assumes "enrolled before period start" (full charge) and the manager
can correct the date or waive/adjust the charge.

### 3.4 `center_charges/{classId}_{studentId}_{periodKey}`
`periodKey`: calendar → `"2026-07"` (`monthKeyOf`); rolling → the cycle's start date `"2026-07-15"`.
```ts
{
  centerId, classId, studentId: string,
  classTitle, studentName: string,            // snapshots for fast lists (no N user reads)
  periodKey: string,
  periodStart, periodEnd: string,             // YYYY-MM-DD inclusive
  baseAmount: number,                         // resolved price BEFORE discount/proration
  discountAmount: number,                     // 0 if none
  proratedFrom?: string,                      // set when first month was prorated (actual start date)
  amount: number,                             // what the student owes (after discount + proration)
  paidAmount: number,                         // cached Σ of confirmed allocations
  status: 'pending' | 'partial' | 'paid' | 'waived' | 'cancelled',
  dueDate: string,                            // YYYY-MM-DD
  note?: string,
  createdAt: Timestamp, createdBy: string,    // manager uid (generation is manager-triggered)
  adjustedAt?, adjustedBy?: ...,              // only while paidAmount == 0
  cancelledAt?, cancelledBy?, cancelReason?: ...,
}
```
**Price resolution order:** `priceOverrides[classId]` → `monthlyFee × (1 − discountPercent/100)`
→ `monthlyFee`. Result rounded to nearest 1,000.

**Proration (first period only, when enabled):** count the class's scheduled lesson weekdays
(`classes.schedule`) remaining in the period from the enrollment date ÷ total scheduled weekdays in
the period; fall back to calendar-day ratio when the class has no schedule. Round to nearest 1,000.

### 3.5 `center_payments/{autoId}`
```ts
{
  centerId, studentId: string,
  studentName: string,                        // snapshot
  type: 'payment' | 'refund',
  amount: number,                             // always positive; direction comes from `type`
  method: 'cash' | 'card' | 'click' | 'payme' | 'transfer' | 'other',
  methodSplit?: { method, amount, label? }[], // ⚠️ (2026-09-14) present only when paid across 2+ methods — see 4.2a
  source: 'manual',                           // future: 'payme_gateway' | 'click_gateway'
  externalId?: string,                        // future gateway transaction id
  allocations: { chargeId: string, amount: number }[],
  unallocatedAmount: number,                  // the avans part
  paidAt: string,                             // YYYY-MM-DD business date — BACKDATABLE (paper-notebook onboarding)
  note?: string,
  receivedBy: string,                         // manager uid
  createdAt: Timestamp,
  status: 'confirmed' | 'cancelled',
  cancelledAt?, cancelledBy?, cancelReason?: ...,
}
```

### 3.6 Phase 3 — payroll & expenses schemas
Built — see **§9** for the as-built shapes (`center_expenses`, `center_payouts`,
`center_teachers.salary` map) and the calculation rules. Types live in `types/finance.ts`
(`Expense`, `Payout`, `TeacherSalaryConfig`, `PayrollRow`).

## 4. Core flows

### 4.1 Charge generation (manager-triggered, idempotent)
Trigger: banner on the finance page — *"Iyul uchun hisob-kitob yaratilmagan — N ta o'quvchi,
jami X so'm. [Yaratish]"*. `POST /charges/generate { dryRun: true }` computes the preview; the
button repeats it with `dryRun: false`.

Server algorithm:
1. Resolve center classes (rule #9). Skip classes with no/zero `monthlyFee`.
2. Load all `center_student_finance` profiles for the roster (chunked `in`).
3. For each (class, student): skip `frozen`; compute the period —
   **calendar**: the requested month's bounds; **rolling**: walk cycles from
   `enrollmentDates[classId]` (missing → treat as pre-existing) and emit every cycle whose
   `periodStart <= today` that has no charge yet (catches up missed cycles).
4. Resolve price (§3.4), prorate the first period if applicable, compute `dueDate` from settings.
5. Per student, in one transaction: `create()` the charge docs (idempotent — existing IDs are
   skipped, never overwritten) + decrement `balance` (creating the profile doc if missing).
6. **Avans auto-apply:** if the student has payments with `unallocatedAmount > 0`, allocate them
   (oldest `paidAt` first) to the new charges inside the same transaction — updating the payments'
   `allocations`/`unallocatedAmount` and the charges' `paidAmount`/`status`. Balance is unchanged
   by allocation (it already counted the payment).
7. Return `{ created, skipped, frozenSkipped, totalAmount, perClass[], dryRun }` for the toast/banner.

### 4.2 Recording a payment
`POST /payments { studentId, amount, method, type, paidAt?, note? }` — one transaction:
1. Guard: student has a finance profile in this center OR is on a center class roster (allows
   prepay before first charge; profile created lazily).
2. Load the student's `pending|partial` charges ordered by `dueDate` asc; allocate oldest-first;
   remainder → `unallocatedAmount`.
3. Write the payment; update touched charges (`paidAmount`, `partial`/`paid` status); update
   `balance` (+amount for payment, −amount for refund; refunds don't allocate — they're records
   of money returned, with mandatory `note`).
4. Response includes the post-payment state for the confirmation screen ("Iyul to'landi ✓,
   avans: 200 000 so'm").

### 4.2a Splitting one payment/expense across several methods (2026-09-14)
The manager panel now lets ONE payment (`RecordPaymentModal`) or expense (`ExpensesTab`'s
`AddExpenseModal`) be paid across more than one method in a single entry — e.g. 500,000 so'm as
300,000 by card + 200,000 cash — via the shared
[`MethodSplitEditor`](../app/manager/finance/_components/MethodSplitEditor.tsx) component. The
common single-method case is UNCHANGED (it still renders as one button row and sends no split at
all); the split UI only appears once the manager opts in.

- **Wire shape**: an optional `methodSplit: { method, amount, label? }[]` alongside the existing
  `amount`/`method` on both `RecordPaymentRequest` and `createExpense`'s params. `label` is
  FREE TEXT (e.g. "AAA karta") — ⚠️ **there is no named-card/account registry anywhere in this
  repo**; a manager types the label fresh every time and it is simply snapshotted onto that one
  split line, exactly like every other snapshot field in this module. Deliberate: adding a
  reusable "cards" list was considered and explicitly deferred.
- **Server validation is the source of truth** (`lib/server/financeOps.ts::normalizeMethodSplit`,
  shared by `recordPayment` and `createExpense`): every line's `method` must be one of
  `PAYMENT_METHODS`, every `amount` a positive integer (`requireValidMoney`), the lines must sum
  to **exactly** the payment/expense's own `amount` (400 if not), and at most `MAX_SPLIT_LINES` (8)
  lines are accepted. When `methodSplit` is absent/empty, behavior is byte-for-byte what it was
  before this field existed.
- **The stored scalar `method` is DERIVED, never the caller's raw input, once `methodSplit` is
  present**: all lines sharing one method → that method; more than one distinct method → `'other'`.
  This is why every pre-existing reader that only knows the scalar field (the old Excel export
  column, an older Android client, a future report) still shows something sane — `methodSplit`
  is the detailed, authoritative breakdown layered on top, not a replacement.
- **Expenses gained the `method`/`methodSplit` fields from scratch** — they had NO method concept
  at all before. Both are optional; an expense recorded before this change, or via a caller that
  never sets them, simply has neither and reads/displays as "—".
- Display: `formatMethodSplit()` in
  [`financeFormat.ts`](../app/manager/finance/_components/financeFormat.ts) — "Karta" for a plain
  entry, "Naqd 200 000 + Karta (AAA karta) 300 000" once split. The Excel export
  ([`lib/finance/exportExcel.ts`](../lib/finance/exportExcel.ts)) has its OWN small equivalent
  (`methodSummary`) by design — that file is deliberately kept free of `app/`-level imports.

### 4.3 Cancellations
- **Cancel payment**: reverse its allocations (decrement charges' `paidAmount`, recompute statuses),
  set status + audit fields, adjust balance. One transaction.
- **Waive charge**: forgive unpaid remainder (§2).
- **Cancel charge**: only while `paidAmount == 0`; else the manager must cancel/reallocate payments first.
- **Adjust charge** (`amount` only — no `discountAmount` param exists): only while `paidAmount == 0`; stamps `adjustedBy/At`.

## 5. API routes — all `POST`, all start with `requireActiveCenterManager(request)`

| Route | Body | Notes |
|---|---|---|
| `/api/manager/finance/settings` | full settings patch | upsert |
| `/api/manager/finance/charges/generate` | `{ periodKey?, dryRun? }` | §4.1; `periodKey` only meaningful for calendar mode |
| `/api/manager/finance/charges/waive` | `{ chargeId, reason }` | verifies `charge.centerId` matches caller |
| `/api/manager/finance/charges/cancel` | `{ chargeId, reason }` | `paidAmount == 0` guard |
| `/api/manager/finance/charges/adjust` | `{ chargeId, amount, note? }` | `paidAmount == 0` guard |
| `/api/manager/finance/payments` | `{ studentId, amount, type, method, methodSplit?, paidAt?, note? }` | §4.2, §4.2a |
| `/api/manager/finance/payments/cancel` | `{ paymentId, reason }` | §4.3 |
| `/api/manager/finance/student` | `{ studentId, patch }` | discount, overrides, freeze/unfreeze, enrollmentDates fixes |
| `/api/manager/finance/group-fees` | bulk `classes.monthlyFee` update | `updateGroupFees` in `financeOps.ts`; ownership check via server-side `resolveCenterClasses` (deliberately not client rules); used by Sozlamalar "Guruh narxlari" (`GroupPricesSection.tsx`) |

### 5.1 Office staff on these routes (2026-09-15)

Five of the routes above also accept a **buxgalter** or a **director** ([OFFICE.md](OFFICE.md)), via a
new `options.office` argument on the `financePostHandler` factory:

| Route | `office` | Who |
|---|---|---|
| `/payments`, `/payments/cancel`, `/expenses`, `/expenses/cancel` | `'accountant'` | manager **or** buxgalter |
| `/payroll/calculate` | `'any'` | manager **or** any office role (it writes nothing) |
| `/expenses/approve`, `/expenses/reject` (2026-09-16, §9) | `'director'` | manager **or** director — buxgalter excluded |
| everything else | *(omitted)* | manager only — unchanged |

`office: 'director'` is the third `FinanceOfficeAccess` value: "manager or director, buxgalter
excluded" — the mirror image of `'accountant'`. It exists only for the two approve/reject routes,
since a submitter must never be able to approve their own entry.

`resolveFinanceCaller` tries `requireActiveCenterManager` first and only falls through to
`requireCenterOffice` on a **403** (authenticated but not this center's manager); a 401 propagates.
⚠️ `uid` in the op context is the REAL caller, so an accountant's payments carry **their** uid in
`receivedBy`/`createdBy` — the audit trail names who typed it. Cancel is included deliberately:
money is append-only, so cancel + re-enter IS the correction path (§4.3), and an accountant who may
record must be able to reverse their own typo. `write: if false` on the collections is untouched —
the route is the only write path, exactly as iron rule #4 requires.

Guard: the PRE-EXISTING `lib/server/verifyCenterManager.ts` (`requireActiveCenterManager`,
throws `ManagerApiError` with user-facing Uzbek messages) — verifies the bearer ID token,
requires `users/{uid}.role == 'manager'` + a `centerId`, and the center's `status == 'active'`
(approval-gate parity: pending/suspended centers cannot move money). All finance routes go
through the `financePostHandler` factory in `lib/server/financeRoute.ts`.

Client transport: the pre-existing `lib/managerApi.ts` (`managerApiFetch`, a re-export of
`adminApiFetch`) — attaches the ID token and normalizes JSON errors for toasts.

## 6. Security rules & indexes

Reads are client-side (codebase convention); writes are API-only:

```
// FINANCE — reads: center manager only. Writes: API routes (Admin SDK) only.
match /center_finance_settings/{centerId} {
  allow read: if isCenterManager(centerId);
  allow write: if false;
}
match /center_student_finance/{profileId} {
  allow get: if isAuth() && (resource == null || isCenterManager(resource.data.centerId));
  allow list: if isCenterManager(resource.data.centerId);   // provable: queries filter centerId ==
  allow write: if false;
}
match /center_charges/{chargeId} {
  allow get: if isAuth() && (resource == null || isCenterManager(resource.data.centerId));
  allow list: if isCenterManager(resource.data.centerId);
  allow write: if false;
}
match /center_payments/{paymentId} {
  allow get: if isAuth() && (resource == null || isCenterManager(resource.data.centerId));
  allow list: if isCenterManager(resource.data.centerId);
  allow write: if false;
}
```

🟢 **2026-09-15**: every `read`/`get`/`list` above also admits `|| isCenterOffice(<centerId>)` — the
center's director and buxgalter ([OFFICE.md](OFFICE.md)). That helper looks up the CONSTANT path
`center_staff/$(request.auth.uid)`, so it adds a fixed couple of document accesses per query and the
limit argument below still holds. **`write: if false` was NOT touched on any collection.**

Unlike attendance, finance list rules must **not** relax to `isAuth()` — payments are the most
sensitive data in the app. The `list` rules above stay within the document-access limit because the
mandatory `centerId ==` filter (iron rule #5) makes `resource.data.centerId` provable, so
`isCenterManager` performs exactly **one** `get()` per query (constant path — unlike the per-doc
varying `classes/$(resource.data.classId)` lookups that broke attendance lists).
**Contingency:** if real-world queries still hit permission errors, flip reads to
`GET /api/manager/finance/*` routes — the data model doesn't change.

New composite indexes (`firestore.indexes.json`, confirm exact set during build):
- `center_charges`: `centerId ASC, status ASC, dueDate ASC` (debtors: `status in [pending,partial]` ordered by due date)
- `center_charges`: `centerId ASC, studentId ASC, periodStart DESC` (student history panel)
- `center_payments`: `centerId ASC, createdAt DESC` (recent payments feed)
- `center_payments`: `centerId ASC, studentId ASC, createdAt DESC` (student payment history)
- `center_payments`: `centerId ASC, paidAt ASC` (monthly collected-total range query)
- `center_charges`: `centerId ASC, periodStart ASC` (rolling-mode month view: charges whose cycle starts within a month)
- `center_student_finance`: `centerId ASC, balance ASC` (avans total: `balance > 0`)
- `center_expenses`: `centerId ASC, date ASC` (month expense list — Phase 3)

`center_expenses` and `center_payouts` have the same rules blocks as above (manager-only read,
`write: if false`). Calendar month view of charges and payout-by-month queries are equality-only —
no composite needed.

Deploy: `firebase deploy --only firestore:rules,firestore:indexes`.

## 7. New/changed files (Phase 1)

| File | Purpose |
|---|---|
| `types/finance.ts` | Single source of truth for all finance types (like `types/attendance.ts`) |
| `lib/finance/billingEngine.ts` | **Pure** logic, no Firestore: `resolvePrice`, `computeCalendarPeriod`, `nextRollingCycles`, `prorate`, `allocate` — testable/verifiable in isolation |
| `lib/finance/money.ts` | `formatUZS` (e.g. `400 000 so'm`), `roundTo1000` |
| `lib/managerApi.ts` (pre-existing) | Token-attaching fetch (`managerApiFetch`) used by `financeService` |
| `lib/server/verifyCenterManager.ts` (pre-existing) | `requireActiveCenterManager` guard (§5) |
| `lib/server/financeRoute.ts` | `financePostHandler` route factory (guard + body parse + error mapping) |
| `app/api/manager/finance/*` | The **15** routes (§5 + §9) — thin handlers around `lib/server/financeOps.ts` |
| `lib/server/financeOps.ts` | Server-side transactions: generation, payment+allocation, cancellations. **The future Payme/Click webhook calls these same functions.** |
| `services/financeService.ts` | Client reads (charges by period, debtors, payments feed, student history, settings) + typed wrappers around the API routes |
| `app/manager/finance/page.tsx` | Stat header + **6 tabs**: To'lovlar · Qarzdorlar · Hisob-kitob · Oyliklar · Xarajatlar · Sozlamalar |
| `app/manager/finance/_components/` | `FinanceStats`, `GenerateChargesBanner`, `ChargesTab`, `PaymentsTab`, `RecordPaymentModal`, `PaymentKindSheet`, `RecordTeacherPayoutModal`, `ExportFinanceButton`, `DebtorsTab`, `SettingsTab`, `StudentFinanceSection`, `PayrollTab`, `ExpensesTab`, `GroupPricesSection`, `StartGuide`, `MonthNav`, `StudentInfoDialog`, `ReasonDialog`, `MethodSplitEditor` (§4.2a), `financeFormat.ts` |
| `lib/finance/exportExcel.ts` | Pure `.xlsx` workbook builder (SheetJS `xlsx` package) — no Firestore |
| `app/manager/students/_components/ManagerStudentInfoPanel.tsx` | Embed `StudentFinanceSection` (balance, history, discount, freeze) |
| `app/manager/groups/detail/[classId]/_components/ManagerSettingsTab.tsx`, `[schoolClassId]/subjects/[classId]/_components/SubjectSettingsTab.tsx` | `monthlyFee` field (2026-09-14: same field, now editable from either the flat group view or a School Class subject's settings) |
| `app/manager/groups/detail/[classId]/_components/ManagerAddStudentModal.tsx`, `services/schoolClassService.ts` (`syncSchoolClassRoster`) | Best-effort enrollment-date stamp via `/finance/student` after add — the School Class roster fan-out stamps it per subject |
| `firestore.rules`, `firestore.indexes.json` | §6 |

## 8. Build order (historical — the module is built; §8.6 remains useful as a manual verification script)

1. **Foundations** — `types/finance.ts`, `lib/finance/*` (pure engine), `lib/managerApi.ts`,
   `lib/server/verifyCenterManager.ts`.
2. **Rules + indexes** — add §6 blocks, deploy.
3. **Server ops + routes** — `financeOps.ts`: settings upsert → generation (with dryRun) →
   payment/allocation → cancellations/waive/adjust → student profile patch; one thin route each.
4. **Client service** — `financeService.ts` reads + mutation wrappers.
5. **UI, in usage order** — SettingsTab → group `monthlyFee` field → GenerateChargesBanner +
   ChargesTab → RecordPaymentModal + PaymentsTab → DebtorsTab (with attendance % per student via
   existing `attendanceService`) → FinanceStats → StudentFinanceSection + info-panel embed +
   enrollment stamping.
6. **Verification walkthrough** (no test suite — dev-server script):
   set fee → generate July (twice: second is a no-op) → full payment → partial → overpay (avans
   appears) → generate August (avans auto-applies) → cancel a payment (charge reverts) → waive →
   freeze student → regenerate (skipped) → rolling-mode center: enroll mid-month, prorated first
   charge, catch-up cycles → debtor list ordering → backdated payment → dashboard totals match a
   hand-computed sum.

## 9. Phase 3 — payroll & expenses (BUILT)

- **`center_expenses/{autoId}`** — `{ centerId, category, amount, date (YYYY-MM-DD, not future),
  note?, method?, methodSplit?, teacherId?, payoutId?, createdBy, createdAt, status:
  'active'|'pending_approval'|'rejected'|'cancelled' + approve/reject/cancel audit }`.
  `method`/`methodSplit` (2026-09-14, see §4.2a) are optional — absent on every expense recorded
  before that date, incl. every salary payout expense (payroll never sets them). Append-only.
  Salary payouts create expenses with the reserved category `'salary'` and a `payoutId` link —
  **salary-linked expenses cannot be cancelled** (v1). Index: `centerId+date`.
  - **Approval workflow (2026-09-16)**: `createExpense` picks the starting status from WHO is
    calling — manager (or, historically, before this feature, no one else) → `'active'` immediately,
    unchanged. **Buxgalter → `'pending_approval'`**: a manager or director must
    `approveExpense`/`rejectExpense` (`/expenses/approve`, `/expenses/reject`, §5.1) before it counts
    as money spent. The submitter may `cancelExpense` their own still-pending row (a self-withdraw —
    `cancelExpense` now accepts `pending_approval` too, but ONLY when `caller.uid === createdBy`; the
    pre-existing `active` branch is untouched). Rejecting requires a reason, same as cancelling.
    ⚠️ **Every money-sum site in the app filters the exact string `'active'`** (never
    `!== 'cancelled'`) — `pending_approval`/`rejected` rows are therefore excluded from
    `expensesTotal`/`profit`/the Excel total/the category chips automatically. Don't "helpfully"
    widen any of those filters to `!== 'cancelled'`.
- **Salary config** = `salary: { fixed?, percent?, perLesson? }` map on `center_teachers/{uid}` —
  all parts optional, the payout is the SUM of configured parts (no salaryType enum). Edited via
  `POST /teacher-salary`.
- **`center_payouts/{teacherUid}_{YYYY-MM}`** — deterministic id; payroll is always
  calendar-monthly regardless of billing anchor. Lifecycle: live calculation (nothing stored) →
  **approve** (`/payroll/save` recomputes SERVER-SIDE — the client never sends amounts — and
  persists breakdown + adjustment) → **mark paid** (`/payroll/mark-paid`, one transaction: status
  'paid' + the linked salary expense; a zero-sum payout just flips status). Paid payouts are immutable.
- **Calculation** (`financeOps.calculatePayroll`): fixed = config; % base per
  `settings.percentBase` — `'collected'` = this month's confirmed payment **allocations** summed
  per class (chargeId's first `_`-segment IS the classId — Firestore auto-ids and auth uids never
  contain `_`; avans stays unattributed until allocated, refunds are ignored), `'charged'` = this
  month's non-cancelled charge amounts per class; per-lesson = `center_attendance` docs with
  `lessonStatus held|makeup` and `date <= today` per class. Teacher→class mapping is resolved at
  calc time (current `classes.teacherId`).
- **Profit** on the dashboard = month collected − month active expenses. Six stat cards.
- Phase 3 routes (same guard/factory as §5): `/expenses`, `/expenses/cancel`,
  `/payroll/calculate`, `/payroll/save`, `/payroll/mark-paid`, `/teacher-salary`.
  UI: `PayrollTab` (config modal + approve modal + mark-paid), `ExpensesTab` (add modal,
  category totals, cancel), `percentBase` picker in `SettingsTab`.

### 9.1 Teacher-visible salary (2026-07-29)

`GET /api/teacher/payroll` — read-only, Admin SDK, guarded by `requireCenterTeacher`
([lib/server/verifyCenterTeacher.ts](../lib/server/verifyCenterTeacher.ts)). Rendered by the **Maosh**
tab of the teacher center hub (`app/teacher/center/_components/SalaryTab.tsx`).

- **Why an API at all**: `center_payouts` is manager-only in the rules (`list: isCenterManager`,
  `write: if false`) and listing it client-side would expose every colleague's salary. Same posture as
  `/api/student/finance` — **the finance rules were NOT relaxed**, and never should be.
- **The guard's boundary is the `center_teachers/{uid}` link doc**, not `users/{uid}.centerId` — the
  user doc is client-writable, so its `centerId`/`role` are attacker-controlled hints. The link doc's
  **id must equal the teacher uid** (rules-enforced), which is what makes `doc(uid)` trustworthy.
  A teacher with no link gets `{ linked: false }`, **not** an error — being solo is the normal case.
- **Returns**: `salary` config (from the link doc), `payouts[]` (own `teacherId ==` only, re-filtered
  on `centerId` so a teacher who moved centers can't see the old center's payouts), `totalPaid`.
- ⚠️ **Deliberately NOT returned: any un-approved amount.** `calculatePayroll` needs the whole
  center's revenue, so running it here would leak other groups' money AND show a figure the manager
  has not agreed to. The teacher sees only persisted (approved/paid) payouts; the current month reads
  "not yet approved" until the manager approves it. Don't "helpfully" add a live estimate.
- The `percent.baseAmount` inside a payout's breakdown IS shown — it is the revenue of that teacher's
  own groups and they cannot verify a % salary without it.

### 9.2 Pay a teacher from the Payments entry point (2026-09-05)

"To'lov qabul qilish" (the FAB, and the button on the To'lovlar/PaymentsTab and StartGuide) now opens
a `PaymentKindSheet` chooser first: **O'quvchi** (unchanged — opens `RecordPaymentModal`) or
**O'qituvchi** (`RecordTeacherPayoutModal`). Debtor-row and student-panel "To'lov" buttons already know
they mean a student and skip the chooser.

`RecordTeacherPayoutModal` is **not** a new money path — it is a shortcut into the existing §9 payroll
cycle, always scoped to the **current calendar month** (never the page's browsed billing month):
search a teacher → live `calculatePayrollApi` breakdown for this month (same numbers the Oyliklar tab
shows, `perLesson` already only counts held/makeup lessons so a teacher who misses lessons is
automatically paid for fewer of them — no separate "penalty" concept was added) → optional signed
bonus/penalty (only while nothing is approved yet this month; note required if non-zero, same rule as
`ApprovePayoutModal`) → **Pay**, gated by the same `ConfirmDialog` immutability warning as the
Oyliklar tab's "To'landi". Submitting calls `savePayoutApi` (only if not yet approved) then
`markPayoutPaidApi` — the exact same two server functions §9's Approve+To'landi buttons call, so it
writes the same `center_payouts`/`center_expenses` docs and inherits every existing guarantee
(server-recomputed amounts, paid payouts immutable, zero-sum payouts legitimate). If the teacher's
payout is already `paid` for the month, the modal only shows the paid amount/date — no double-pay.

No schema, API route, or `financeOps.ts` change was needed for this — it's UI-only, reusing
`calculatePayrollApi`/`savePayoutApi`/`markPayoutPaidApi` from `services/financeService.ts` verbatim.

### 9.3 Excel export (2026-09-05, revised same day — now a picker)

`ExportFinanceButton` sits in the Moliya page header (visible on every tab, next to the title). Clicking
it opens a picker, not an immediate export — a checklist of **five money-cycle sections**
(`FinanceExportSection` in `lib/finance/exportExcel.ts`: `charges`, `payments`, `debtors`, `payroll`,
`expenses`), all checked by default, "Hammasi" toggles all. Only the checked sections become sheets in
the `.xlsx` — the manager can export just one (e.g. only Oyliklar) or the full picture.

All sections but `debtors` are scoped to the **currently browsed month** (`page.tsx`'s `monthKey` — the
same month Hisob-kitob/To'lovlar/Xarajatlar/Oyliklar are already showing, navigated via their own
`MonthNav`), reusing data the page already has in state (`charges`, `monthPayments`, `expenses`) — no
extra reads for those. `debtors` is deliberately **not** month-scoped: it's `openCharges`, the same
all-time pending/partial snapshot the Qarzdorlar tab shows (a debtor from three months ago still owes
money today, so bucketing it into "this month" would misrepresent it) — the sheet is a current-state
snapshot layered onto an otherwise month-scoped report, and is labeled as such. `payroll` is the one
section requiring a fresh read: `calculatePayrollApi(monthKey)` is only called when that box is checked.
Every sheet keeps a raw, sortable `status`/`type` column (including cancelled charges/payments/expenses)
rather than only totals — this is meant as an audit trail, not just a summary. Entirely read-only: builds
the workbook client-side via `lib/finance/exportExcel.ts` (SheetJS `xlsx` package — a new dependency, no
server component), never writes anything.

Delivery: `navigator.canShare({ files })` (Web Share Level 2, most mobile browsers over HTTPS) shares
the actual file through the OS share sheet — Telegram shows up there like any other installed app,
same mechanism `ParentQrDialog.tsx` already uses for link sharing, just extended to a real file instead
of a URL. Everywhere else (desktop, unsupported browsers) it falls back to a plain blob download.
There is no Telegram-bot integration — no bot token, no chat id, no server upload step — deliberately,
to avoid new secrets/infra for what the OS share sheet already does on the devices managers actually
carry to send a report to a colleague.

### 9.4 Non-teaching employee payroll (2026-09-16, docs/EMPLOYEES.md)

Reuses `center_payouts` — no parallel collection. A payout gains an optional `staffKind: 'employee'`
(absent = `'teacher'`); `teacherId`/`teacherName` are reused verbatim for the employee's roster-doc-id
and name. `calculateEmployeePayroll`/`saveEmployeePayout` (`financeOps.ts`) are the employee-shaped
siblings of `calculatePayroll`/`savePayout` — fixed + `hourlyRate` × hours worked (summed from
`center_staff_attendance`, the SAME collection teacher/staff attendance already writes) + allowances −
deductions, never percent/perLesson. **`markPayoutPaid` is called completely unchanged** for both —
it only ever reads the payout doc's own fields, so it needed zero changes to support a second staff
kind. UI: a teacher/employee segmented toggle above the Oyliklar tab
(`app/manager/finance/_components/EmployeePayrollTab.tsx`) switches between the pre-existing
`PayrollTab` and this new one. Routes: `/api/manager/finance/employee-salary`,
`/api/manager/finance/payroll/employees/{calculate,save}` (mirror the teacher routes' guards exactly —
`calculate` is `office: 'any'`, `save` is manager-only); `payroll/mark-paid` is the existing route,
unchanged.

## 10. Later phases (context for reviewers)

- **Phase 2 polish (NOT built)**: printable receipt, balance-recalculate repair (no route re-derives
  `balance` from the ledger yet), discount UI polish, richer student-side proration options,
  editable expense-categories UI.
- **Phase 4 (NOT built)**: Payme/Click gateway (webhook → `financeOps.recordPayment` with
  `source: 'payme_gateway'` — the `PaymentSource` type already includes the gateway values but
  nothing produces them), SMS reminders (Eskiz.uz),
  un-pay/cancel flow for paid payouts (paid payouts are currently immutable).
  🟢 The **student-visible balance** part of Phase 4 shipped 2026-07-20 as `GET /api/student/finance`
  (read-only, Admin SDK, uid from the verified token; centers resolved via `center_students`) +
  `app/(student)/payments/page.tsx`. The rules on the finance collections were NOT relaxed.
  🟢 **Teacher-visible salary** shipped 2026-07-29 as `GET /api/teacher/payroll` (read-only, Admin
  SDK) + the Maosh tab of `app/teacher/center/` — see §9.1 below. Rules unchanged there too.

## 11. Legacy note

`firestore.rules` still contains a `center_finances/{financeId}` block that predates this module.
**No code reads or writes that collection** — do not build on it; it's a cleanup candidate.

## 12. Unified manager dashboard (2026-09-16)

`app/manager/dashboard/page.tsx` was attendance-only historically (docs/ATTENDANCE.md); it now also
shows finance — the income/debt KPI cards are computed via the shared `computeFinanceStats`
(`lib/finance/financeStats.ts`, extracted from this file's own `stats` memo — `app/office/page.tsx`
had already independently re-implemented the same calculation, so this extraction removes a
duplicate rather than adding a third copy) fed by the same four fetchers (`fetchChargesForMonth`,
`fetchPaymentsForMonth`, `fetchOpenCharges`, `fetchExpensesForMonth`) `finance/page.tsx` uses.

Three new charts, all through `components/ChartFrame.tsx` (CLAUDE.md — never a raw
`<ResponsiveContainer>`), the **first manager-side charts in the repo**:
- **Revenue vs. expenses, trailing 6 months** (`RevenueExpenseTrendChart.tsx`) — loops
  `buildTrailingMonthKeys` + `computeFinanceStats` per month (with empty `charges`/`openCharges`,
  since only `collected`/`expensesTotal` are needed).
- **Attendance rate, trailing 6 months** (`AttendanceTrendChart.tsx`) — a SEPARATE, wider
  `fetchCenterSessions` call from the existing current-month-only `sessions` state, bucketed by month
  and reduced through the existing `rateOfSessions` (never re-implement the rate formula,
  docs/ATTENDANCE.md rule #6).
- **Expense-category distribution, current month** (`ExpenseCategoryPieChart.tsx`) — the **first
  pie/donut chart in the repo** — fed by `groupExpensesByCategory` (also in `financeStats.ts`,
  extracted verbatim from `ExpensesTab.tsx`'s `byCategory` memo).

`monthLabelOf`/`MONTHS` (trilingual month names) moved from the route-local
`app/manager/finance/_components/financeFormat.ts` to `app/manager/_components/monthLabels.ts`, and
`shiftMonthKey` moved to `lib/finance/billingEngine.ts` (no `LangType` dependency) — `financeFormat.ts`
re-exports both so its existing importers need no changes. `app/office/page.tsx` already imported
`monthLabelOf`/`shiftMonthKey` cross-route from `financeFormat.ts` before this change; the dashboard
becoming a third consumer is what triggered giving these a shared home instead of a second copy.

If this feature ships a multi-branch owner view later, `/manager/branches` is the natural place to
reuse `computeFinanceStats` and these three chart components looped over several `centerId`s for a
branch-comparison view — this is why the extraction happened now rather than being built directly
into a future multi-branch page.
