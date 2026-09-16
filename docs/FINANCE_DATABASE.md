# FINANCE_DATABASE — Collections & What Changes When

> **Agent workflow:** read this (and [FINANCE.md](FINANCE.md)) BEFORE touching finance code; update it in the same change whenever a UI action's writes change. Simple map of every Firestore collection the **Moliya** module touches, and — for every button in the UI — exactly which documents are written. Design decisions and deeper rules live in [FINANCE.md](FINANCE.md). Index: [README.md](README.md).

**Last verified:** 2026-09-16 (`center_expenses` gained the approval workflow — `pending_approval`/`rejected` statuses, see docs/FINANCE.md §9; previously 2026-09-14, `methodSplit` §4.2a; previously 2026-07-12, commit `7c31a96`).

---

## 1. The big picture (30 seconds)

Finance is a **notebook (ledger)**, not a single number:

- Every month the system writes *"student owes X"* → a **charge** (`center_charges`).
- Every time a student brings money it writes *"student paid X"* → a **payment** (`center_payments`).
- A student's **balance** = all payments − all charges, cached on their profile (`center_student_finance`).
- Money going out is an **expense** (`center_expenses`); teacher salaries are **payouts**
  (`center_payouts`) that become expenses when paid.

Two writing rules that explain everything below:

1. 🔒 **Money documents are only written by the server** (API routes `/api/manager/finance/*`
   using the Admin SDK). The browser can only *read* them. Wrong entries are never deleted —
   they get `status: 'cancelled'` with a reason.
2. ✏️ A few **non-money fields** are still written directly from the browser
   (`classes.studentIds` when adding a student — plus `classes.monthlyFee` when edited from the
   group's own settings page; the Moliya price list writes it through the API).

Legend used below: 🔒 = API-only writes · ✏️ = client writes allowed · 👁 = finance only reads it.

---

## 2. The collections

### 2.1 `center_finance_settings/{centerId}` 🔒 — the center's finance rules
One document per center. Created automatically with defaults the first time settings are saved.

| Field | Meaning |
|---|---|
| `billingAnchor` | `'calendar'` (everyone pays for July, August…) or `'enrollment'` (each student's own monthly cycle from their join date) |
| `prorateFirstMonth` | `true` → student joining mid-month pays only for the remaining part |
| `dueDayOfMonth` | calendar mode: payment due by this day of the month |
| `dueDaysAfterStart` | rolling mode: payment due N days after the cycle starts |
| `percentBase` | teacher % salary is computed from `'collected'` (real money) or `'charged'` (expected money) |
| `expenseCategories` | list of expense categories shown in the Xarajatlar tab |

### 2.2 `classes/{classId}` — one finance field on an existing collection
| Field | Meaning |
|---|---|
| `monthlyFee` ✏️/🔒 | the group's monthly price in so'm. Missing or `0` → the group is **not billed**. Editable in two places that write the same field: group settings page (client write) and Moliya → Sozlamalar (API write via `/group-fees`) |

> ⚠️ `classes` docs have **no `centerId`** — the server finds a center's classes through
> `center_teachers` (by the `teacherId` field). That's why every finance document below stores
> its own `centerId` copy.

### 2.3 `center_student_finance/{centerId}_{studentUid}` 🔒 — one student's money profile
Created lazily the first time a student is charged, pays, or gets a discount.

| Field | Meaning |
|---|---|
| `balance` | cached: Σ payments − Σ refunds − Σ non-cancelled charge amounts. **Negative = qarz (owes), positive = avans (prepaid credit)** |
| `discountPercent` | 1–100, applied to every group's price for this student |
| `priceOverrides` | `{classId: price}` — a personal absolute price for one group; beats the group fee AND the discount |
| `financeStatus` | `'active'` or `'frozen'` — frozen students are **skipped** at charge generation |
| `frozenAt` | date the freeze started |
| `enrollmentDates` | `{classId: "YYYY-MM-DD"}` — when the student joined each group; drives rolling cycles and first-month proration |

### 2.4 `center_charges/{classId}_{studentId}_{periodKey}` 🔒 — "student owes X for this period"
The heart of the system. The document ID is **predictable** (`class + student + period`), which is
why clicking "Yaratish" twice can never create the same charge twice.

| Field | Meaning |
|---|---|
| `periodKey`, `periodStart`, `periodEnd` | which period: calendar → `"2026-07"`, rolling → cycle start date |
| `baseAmount`, `discountAmount`, `amount` | price snapshot **copied at generation time** — later price changes never touch old charges |
| `proratedFrom` | set when the first month was partial (join date proration) |
| `paidAmount` | how much of it is already covered by payments |
| `status` | `pending` → `partial` → `paid` · or `waived` (remainder forgiven) · or `cancelled` |
| `dueDate` | when it's late → shows in Qarzdorlar with "Muddati o'tgan" |
| `classTitle`, `studentName` | snapshots so lists render without extra reads |
| audit fields | `createdBy/At`, `adjustedBy/At`, `waivedBy/At/waiveReason/forgivenAmount`, `cancelledBy/At/cancelReason` |

### 2.5 `center_payments/{autoId}` 🔒 — "student brought X money"
| Field | Meaning |
|---|---|
| `type` | `'payment'` or `'refund'` (money returned; needs a note) |
| `amount`, `method` | so'm + `cash / card / click / payme / transfer / other` — `method` is DERIVED when `methodSplit` is set (single method shared by every line, else `'other'`) |
| `methodSplit?` | ⚠️ (2026-09-14) `[{method, amount, label?}]` — set only when the manager split this payment across 2+ methods; lines sum to `amount`. `label` is free text (e.g. "AAA karta") — no named-card registry exists. Absent = plain single-method payment, same as before this field existed |
| `allocations` | `[{chargeId, amount}]` — which months this money covered (oldest debt first, automatic) |
| `unallocatedAmount` | leftover = **avans**; automatically consumed by future charge generation |
| `paidAt` | business date — **backdatable** (for entering old paper-notebook records) |
| `source`, `externalId` | `'manual'` now; a future Payme/Click webhook fills these |
| `status` | `'confirmed'` or `'cancelled'` (+ audit fields) |

### 2.6 `center_expenses/{autoId}` 🔒 — money going out
| Field | Meaning |
|---|---|
| `category` | from settings (`ijara`, `kommunal`…) or the reserved `'salary'` |
| `amount`, `date`, `note` | so'm, business date (backdatable, not future), optional note |
| `method?`, `methodSplit?` | ⚠️ (2026-09-14) same shape and same derivation rule as `center_payments` above — NEW fields, both optional. Absent on every expense recorded before this date, and always absent on salary-linked expenses (payroll never sets them) |
| `teacherId`, `payoutId` | set only on salary expenses — links back to the payout. **Salary-linked expenses cannot be cancelled manually** |
| `status` | `'active'` or `'cancelled'` (+ audit fields) |

### 2.7 `center_payouts/{teacherUid}_{YYYY-MM}` 🔒 — one teacher's (or employee's) salary for one month
| Field | Meaning |
|---|---|
| `staffKind` | 🟢 (2026-09-16) `'teacher'` (absent = default) or `'employee'` — see docs/EMPLOYEES.md. `teacherId`/`teacherName` are reused verbatim for an employee's roster-doc-id/name |
| `breakdown` | teacher: `fixed` + `percent {rate, base, baseAmount, amount}` + `perLesson {count, rate, amount}`. Employee: `fixed` + `hourly {rate, hours, amount}` + `allowances[]`/`allowancesTotal` + `deductions[]`/`deductionsTotal` |
| `calculatedAmount`, `adjustment`, `finalAmount` | computed sum ± bonus/jarima (note required) |
| `status` | `'approved'` (saved, editable) → `'paid'` (**immutable**, salary expense created) |
| `paidAt`, `expenseId` | set when marked paid |

### 2.8 `center_teachers/{teacherUid}` — one finance field on an existing collection
| Field | Meaning |
|---|---|
| `salary` 🔒 | `{fixed?, percent?, perLesson?}` — the teacher's salary formula. Payout = sum of whichever parts are set. Edited from the Oyliklar tab ⚙ button |

### 2.8a `center_employees/{autoId}` — one finance field on an existing collection (🟢 2026-09-16, docs/EMPLOYEES.md)
Otherwise a manager-panel roster collection (client-writable, `isActiveCenterManager` rules — NOT
finance-gated); only the `salary` field is finance's to write.
| Field | Meaning |
|---|---|
| `salary` 🔒 | `{fixed?, hourlyRate?, allowances?, deductions?}` — the employee's salary formula. Payout = fixed + hourlyRate×hours + allowances − deductions. Edited from the employee's info panel, via `/api/manager/finance/employee-salary` |

### 2.9 Read-only neighbors 👁
| Collection | Why finance reads it |
|---|---|
| `center_attendance` | per-lesson salaries count `held`/`makeup` lessons; debtor list shows attendance % |
| `center_staff_attendance` | 🟢 employee payroll sums `hoursWorked` for the month (docs/EMPLOYEES.md) |
| `center_teachers` | finding the center's classes; payroll teacher list |
| `center_employees` | payroll employee list (roster fields other than `salary`) |
| `users` | student display names (snapshotted into charges/payments) |
| `centers` | the API guard checks `status == 'active'` before any money operation |

---

## 3. Action map — what changes when you click things in Moliya

### Page header (every tab)
| Action | Writes |
|---|---|
| **Excelga eksport** | Nothing — 👁 read-only. Opens a picker (Hisob-kitob / To'lovlar / Qarzdorlar / Oyliklar / Xarajatlar, all checked by default); only checked sections become sheets. Four reuse data already loaded on the page for the browsed month (`charges`, `monthPayments`, `expenses`) — `debtors` uses the all-time `openCharges` snapshot (same as Qarzdorlar tab, not month-scoped) — `payroll` is the one fresh read, a `calculatePayrollApi` call, only made when that box is checked. Bundled into one `.xlsx` client-side, then shares (Web Share, files) or downloads it |

### Sozlamalar tab
| Action | Writes |
|---|---|
| **Guruh narxlari → Saqlash** | `classes.monthlyFee` on each changed group (one atomic batch, via `/group-fees`) |
| **Sozlamalarni saqlash** | `center_finance_settings/{centerId}` |

### Hisob-kitob tab
| Action | Writes |
|---|---|
| **Yaratish** (amber banner) | ➊ creates missing `center_charges` (one per student per group per period) ➋ decreases each student's `center_student_finance.balance` ➌ if the student had avans: updates old `center_payments.allocations/unallocatedAmount` and the new charges' `paidAmount/status`. All per-student atomic. Skips frozen students and priceless groups |
| **✏ Summani o'zgartirish** | that `center_charges` doc (`amount`, audit) + student `balance` (only while nothing is paid on it) |
| **🤝 Qoldiqni kechirish (waive)** | that `center_charges` doc (`amount := paidAmount`, `status: waived`, `forgivenAmount`) + student `balance` |
| **✖ Hisobni bekor qilish** | that `center_charges` doc (`status: cancelled`) + student `balance` (only while fully unpaid) |

### To'lovlar tab
| Action | Writes |
|---|---|
| **To'lov qabul qilish → O'quvchi** | ➊ creates a `center_payments` doc ➋ updates covered `center_charges` (`paidAmount`, `pending→partial→paid`) ➌ increases `center_student_finance.balance` (creates the profile if it's the student's first money event). One transaction |
| **↩ To'lovni bekor qilish** | ➊ that `center_payments` doc (`status: cancelled`) ➋ reverses the touched `center_charges` ➌ decreases `balance`. One transaction |
| Refund (Qaytarim in the modal) | creates `center_payments` with `type: 'refund'` (no allocations) + decreases `balance` |
| **To'lov qabul qilish → O'qituvchi → To'lash** | **Not a new write path** — same writes as Oyliklar's Tasdiqlash+To'landi below: `center_payouts/{teacherUid}_{thisMonth}` (approve if not already) then `status: 'paid'` + a linked `center_expenses` (`category: 'salary'`) doc. Always the current calendar month, regardless of the page's browsed billing month |

### Qarzdorlar tab
| Action | Writes |
|---|---|
| **To'lov** button on a debtor | same as "To'lov qabul qilish" (opens the modal preselected) |
| (the list itself) | nothing — 👁 reads open `center_charges` + current-month `center_attendance` |

### Oyliklar tab
| Action | Writes |
|---|---|
| **⚙ Oylik sozlamalari** | `center_teachers/{uid}.salary` |
| **Tasdiqlash** | creates/updates `center_payouts/{teacherUid}_{month}` (`status: approved`) — amounts recomputed on the server from payments/charges/attendance, never trusted from the browser |
| **To'landi** | ➊ that payout → `status: 'paid'` (immutable) ➋ creates a `center_expenses` doc (`category: 'salary'`, linked). One transaction |
| (the calculation itself) | nothing — 👁 reads `center_payments`, `center_charges`, `center_attendance`, `center_teachers` |

### Xarajatlar tab
| Action | Writes |
|---|---|
| **Xarajat qo'shish** | creates a `center_expenses` doc — `status: 'active'` if a manager/director records it, `'pending_approval'` if a buxgalter does (2026-09-16) |
| **✓ Tasdiqlash** (manager/director, on a pending row) | that doc (`status: active`, `approvedBy/At`) |
| **✗ Rad etish** (manager/director, on a pending row) | that doc (`status: rejected`, `rejectedBy/At/rejectReason`) |
| **↩ Xarajatni bekor qilish** | that `center_expenses` doc (`status: cancelled`; refused for salary-linked ones; on a `pending_approval` row, only the submitter may) |

### O'quvchilar page → student panel (Moliya section)
| Action | Writes |
|---|---|
| **Chegirma qo'shish** | `center_student_finance.discountPercent` (applies to FUTURE charges only) |
| **Muzlatish / aktivlashtirish** | `center_student_finance.financeStatus` + `frozenAt` |

### Guruh page (outside Moliya, but finance-relevant)
| Action | Writes |
|---|---|
| **O'quvchi qo'shish** | ✏️ `classes.studentIds` (client) + 🔒 `center_student_finance.enrollmentDates[classId]` (best-effort; generation falls back to a full charge if missing) |
| **Group settings → Oylik narx** | ✏️ `classes.monthlyFee` (client write — same field as the Moliya price list) |

### Dashboard cards (top of Moliya) 👁 — reads only
| Card | Source |
|---|---|
| Tushum (month) | `center_payments` where `paidAt` in month, confirmed (payments − refunds) |
| Hisoblangan (month) | `center_charges` of the month, non-cancelled |
| Xarajatlar / Foyda (month) | `center_expenses` of the month, active; foyda = tushum − xarajatlar |
| Jami qarzdorlik | open remainder of all `pending/partial` `center_charges` |
| Avans | `center_student_finance` docs with `balance > 0` |

---

## 4. Status lifecycles (nothing is ever deleted)

```
center_charges:    pending ──payment──▶ partial ──payment──▶ paid
                      │  │
                      │  └──waive──▶ waived        (unpaid remainder forgiven)
                      └──cancel──▶ cancelled       (only while fully unpaid)

center_payments:   confirmed ──cancel──▶ cancelled (allocations reversed)

center_payouts:    (live calculation) ──Tasdiqlash──▶ approved ──To'landi──▶ paid (immutable)

center_expenses:   active ──cancel──▶ cancelled    (salary-linked: protected)
                   pending_approval ──approve──▶ active
                                    ──reject───▶ rejected
                                    ──cancel───▶ cancelled   (submitter-only self-withdraw)
```

**The balance invariant** (kept true by every transaction above):

```
balance = Σ confirmed payments − Σ confirmed refunds − Σ amount of all NON-CANCELLED charges
```

---

## 5. Reading the data safely (for future code)

- Every client query **must** filter `where('centerId', '==', X)` — the security rules are only
  provable with it, and it's the tenancy boundary.
- Reads are allowed only to the center's manager; **all writes from the browser are rejected**
  (`allow write: if false`) except the two ✏️ fields on `classes`.
- Charge IDs are parseable: `chargeId.split('_')[0]` is always the `classId` (Firestore auto-ids
  and Auth uids never contain `_`) — payroll uses this to attribute collected money to teachers.
- Dates are `YYYY-MM-DD` strings in **Asia/Tashkent** (`lib/dateUtils.ts`); all money is
  **integer so'm**.

| Where the code lives | File |
|---|---|
| All money math (pure, no Firebase) | `lib/finance/billingEngine.ts` |
| All writes (transactions) | `lib/server/financeOps.ts` |
| All client reads + API wrappers | `services/financeService.ts` |
| Types for every document above | `types/finance.ts` |
