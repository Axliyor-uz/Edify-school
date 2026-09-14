// ─── Finance server operations — the ONLY writer of finance collections ──────
// Every mutation is a Firestore transaction that keeps the cached
// `center_student_finance.balance` consistent with the charge/payment ledger:
//   balance = Σ payments − Σ refunds − Σ amount of non-cancelled charges
// (docs/FINANCE.md §2). Called by the /api/manager/finance/* routes and,
// later, by payment-gateway webhooks. Client code never writes these docs.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError } from '@/lib/server/verifyCenterManager';
import { getTodayKey, monthKeyOf } from '@/lib/dateUtils';
import type { ScheduleEntry } from '@/types/attendance';
import {
  DEFAULT_FINANCE_SETTINGS,
  chargeDocId,
  studentFinanceDocId,
  type Charge,
  type FinanceSettings,
  type GenerateChargesResult,
  type Payment,
  type PaymentAllocation,
  type RecordPaymentRequest,
  type RecordPaymentResult,
  type StudentFinancePatch,
  type StudentFinanceProfile,
} from '@/types/finance';
import {
  allocateOldestFirst,
  calendarDueDate,
  calendarPeriod,
  prorate,
  resolvePrice,
  rollingCyclesUpTo,
  rollingDueDate,
  statusForPaid,
  type BillingPeriod,
} from '@/lib/finance/billingEngine';
import { roundTo1000 } from '@/lib/finance/money';
import type {
  CalculatePayrollResult,
  Expense,
  Payout,
  PayoutBreakdown,
  PayrollRow,
  TeacherSalaryConfig,
} from '@/types/finance';
import { payoutDocId } from '@/types/finance';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
/** Sanity cap: 1 mlrd so'm per single charge/payment. */
const MAX_AMOUNT = 1_000_000_000;
const PAYMENT_METHODS = ['cash', 'card', 'click', 'payme', 'transfer', 'other'] as const;

const settingsRef = (centerId: string) => adminDb.collection('center_finance_settings').doc(centerId);
const chargeRef = (id: string) => adminDb.collection('center_charges').doc(id);
const paymentRef = (id?: string) =>
  id ? adminDb.collection('center_payments').doc(id) : adminDb.collection('center_payments').doc();
const profileRef = (centerId: string, studentId: string) =>
  adminDb.collection('center_student_finance').doc(studentFinanceDocId(centerId, studentId));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Run `fn` over items with bounded concurrency (generation = 1 transaction per student). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const idx = next++;
        results[idx] = await fn(items[idx]);
      }
    })
  );
  return results;
}

function requireValidMoney(amount: unknown, label = 'Summa'): number {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new ManagerApiError(`${label} noto'g'ri kiritildi.`, 400);
  }
  return amount;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(centerId: string): Promise<FinanceSettings> {
  const snap = await settingsRef(centerId).get();
  return { ...DEFAULT_FINANCE_SETTINGS, ...(snap.data() || {}), centerId } as FinanceSettings;
}

export async function upsertSettings(centerId: string, patch: Record<string, unknown>): Promise<FinanceSettings> {
  const cleaned: Record<string, unknown> = {};
  if ('billingAnchor' in patch) {
    if (patch.billingAnchor !== 'calendar' && patch.billingAnchor !== 'enrollment') {
      throw new ManagerApiError("Hisob-kitob turi noto'g'ri.", 400);
    }
    cleaned.billingAnchor = patch.billingAnchor;
  }
  if ('prorateFirstMonth' in patch) {
    if (typeof patch.prorateFirstMonth !== 'boolean') throw new ManagerApiError("Sozlama qiymati noto'g'ri.", 400);
    cleaned.prorateFirstMonth = patch.prorateFirstMonth;
  }
  if ('dueDayOfMonth' in patch) {
    const v = patch.dueDayOfMonth;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 31) {
      throw new ManagerApiError("To'lov kuni 1–31 oralig'ida bo'lishi kerak.", 400);
    }
    cleaned.dueDayOfMonth = v;
  }
  if ('dueDaysAfterStart' in patch) {
    const v = patch.dueDaysAfterStart;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 30) {
      throw new ManagerApiError("Muddat 0–30 kun oralig'ida bo'lishi kerak.", 400);
    }
    cleaned.dueDaysAfterStart = v;
  }
  if ('percentBase' in patch) {
    if (patch.percentBase !== 'collected' && patch.percentBase !== 'charged') {
      throw new ManagerApiError("Foiz bazasi noto'g'ri.", 400);
    }
    cleaned.percentBase = patch.percentBase;
  }
  if ('expenseCategories' in patch) {
    const v = patch.expenseCategories;
    if (!Array.isArray(v) || v.length > 30 || v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 40)) {
      throw new ManagerApiError("Xarajat kategoriyalari noto'g'ri.", 400);
    }
    cleaned.expenseCategories = v.map((s: string) => s.trim());
  }
  if (Object.keys(cleaned).length === 0) throw new ManagerApiError("O'zgartirish uchun maydon yo'q.", 400);

  const ref = settingsRef(centerId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        centerId,
        ...DEFAULT_FINANCE_SETTINGS,
        ...cleaned,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, { ...cleaned, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  return getSettings(centerId);
}

// ─── Center roster resolution ─────────────────────────────────────────────────
// centerId-anchored membership (2026-07-15): a class belongs to the center iff
// classes.centerId == centerId — same as the client useCenterClasses. A linked
// teacher's personal groups are NOT the center's and must never be billed.

export interface CenterClass {
  id: string;
  title: string;
  teacherId: string;
  studentIds: string[];
  schedule?: ScheduleEntry[];
  monthlyFee?: number;
}

export async function resolveCenterClasses(centerId: string): Promise<CenterClass[]> {
  const snap = await adminDb.collection('classes').where('centerId', '==', centerId).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: (data.title as string) || 'Guruh',
      teacherId: data.teacherId,
      studentIds: (data.studentIds as string[]) || [],
      schedule: data.schedule,
      monthlyFee: typeof data.monthlyFee === 'number' ? data.monthlyFee : undefined,
    };
  });
}

async function fetchDisplayNames(uids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const part of chunk(uids, 300)) {
    const snaps = await adminDb.getAll(...part.map((uid) => adminDb.collection('users').doc(uid)));
    snaps.forEach((s, i) => names.set(part[i], (s.data()?.displayName as string) || "Noma'lum"));
  }
  return names;
}

async function fetchProfiles(centerId: string, uids: string[]): Promise<Map<string, StudentFinanceProfile | undefined>> {
  const map = new Map<string, StudentFinanceProfile | undefined>();
  for (const part of chunk(uids, 300)) {
    const snaps = await adminDb.getAll(...part.map((uid) => profileRef(centerId, uid)));
    snaps.forEach((s, i) => map.set(part[i], s.exists ? (s.data() as StudentFinanceProfile) : undefined));
  }
  return map;
}

// ─── Charge generation (idempotent — deterministic doc ids + tx.create) ──────

interface ChargeCandidate {
  id: string;
  classId: string;
  classTitle: string;
  studentId: string;
  studentName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  discountAmount: number;
  amount: number;
  dueDate: string;
  proratedFrom?: string;
}

export async function generateCharges(params: {
  centerId: string;
  uid: string;
  periodKey?: string;
  dryRun?: boolean;
}): Promise<GenerateChargesResult> {
  const { centerId, uid, dryRun = false } = params;
  const todayKey = getTodayKey();
  const currentMonth = monthKeyOf(todayKey);

  const settings = await getSettings(centerId);

  let monthKey = currentMonth;
  if (settings.billingAnchor === 'calendar' && params.periodKey) {
    if (!MONTH_KEY_RE.test(params.periodKey)) throw new ManagerApiError("Davr formati noto'g'ri.", 400);
    // Guard against typos: allow history entry (paper-notebook onboarding) and next month only.
    const [y, m] = params.periodKey.split('-').map(Number);
    const [cy, cm] = currentMonth.split('-').map(Number);
    const diff = (y - cy) * 12 + (m - cm);
    if (diff > 1 || diff < -24) throw new ManagerApiError('Bu davr uchun hisob-kitob yaratib bo\'lmaydi.', 400);
    monthKey = params.periodKey;
  }

  const empty: GenerateChargesResult = {
    dryRun, created: 0, skipped: 0, frozenSkipped: 0, totalAmount: 0, perClass: [],
  };

  const classes = (await resolveCenterClasses(centerId)).filter(
    (c) => typeof c.monthlyFee === 'number' && c.monthlyFee > 0 && c.studentIds.length > 0
  );
  if (classes.length === 0) return empty;

  const uids = [...new Set(classes.flatMap((c) => c.studentIds))];
  const [profiles, names] = await Promise.all([fetchProfiles(centerId, uids), fetchDisplayNames(uids)]);

  // Plan phase: pure computation of every charge that SHOULD exist.
  const frozenUids = new Set<string>();
  const candidates: ChargeCandidate[] = [];
  for (const cls of classes) {
    for (const studentId of cls.studentIds) {
      const profile = profiles.get(studentId);
      if (profile?.financeStatus === 'frozen') {
        frozenUids.add(studentId);
        continue;
      }
      const enrollment = profile?.enrollmentDates?.[cls.id];

      let periods: BillingPeriod[];
      let prorationJoin: string | undefined;
      if (settings.billingAnchor === 'calendar') {
        const period = calendarPeriod(monthKey);
        if (enrollment && enrollment > period.periodEnd) continue; // joins after this month
        periods = [period];
        if (settings.prorateFirstMonth && enrollment && enrollment > period.periodStart) {
          prorationJoin = enrollment;
        }
      } else {
        // Rolling: missing enrollment date falls back to the current month's 1st —
        // the manager should set real dates before first generation (FINANCE.md §3.3).
        periods = rollingCyclesUpTo(enrollment || `${currentMonth}-01`, todayKey);
      }

      const price = resolvePrice(cls.monthlyFee!, profile?.priceOverrides?.[cls.id], profile?.discountPercent);
      for (const period of periods) {
        let amount = price.amount;
        let proratedFrom: string | undefined;
        if (prorationJoin) {
          const prorated = prorate(amount, period, prorationJoin, cls.schedule);
          if (prorated !== amount) {
            amount = prorated;
            proratedFrom = prorationJoin;
          }
        }
        if (amount <= 0) continue;
        candidates.push({
          id: chargeDocId(cls.id, studentId, period.periodKey),
          classId: cls.id,
          classTitle: cls.title,
          studentId,
          studentName: names.get(studentId) || "Noma'lum",
          periodKey: period.periodKey,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          baseAmount: price.baseAmount,
          discountAmount: price.discountAmount,
          amount,
          dueDate:
            settings.billingAnchor === 'calendar'
              ? calendarDueDate(period.periodKey, settings.dueDayOfMonth)
              : rollingDueDate(period.periodStart, settings.dueDaysAfterStart),
          ...(proratedFrom ? { proratedFrom } : {}),
        });
      }
    }
  }

  // Existence pre-check (deterministic ids make this exact; re-verified inside each tx).
  const existing = new Set<string>();
  for (const part of chunk(candidates, 300)) {
    const snaps = await adminDb.getAll(...part.map((c) => chargeRef(c.id)));
    snaps.forEach((s) => {
      if (s.exists) existing.add(s.id);
    });
  }
  const missing = candidates.filter((c) => !existing.has(c.id));

  const aggregate = (list: ChargeCandidate[]): GenerateChargesResult => {
    const perClassMap = new Map<string, { classId: string; classTitle: string; created: number; amount: number }>();
    for (const c of list) {
      const entry = perClassMap.get(c.classId) || { classId: c.classId, classTitle: c.classTitle, created: 0, amount: 0 };
      entry.created++;
      entry.amount += c.amount;
      perClassMap.set(c.classId, entry);
    }
    return {
      dryRun,
      created: list.length,
      skipped: candidates.length - missing.length,
      frozenSkipped: frozenUids.size,
      totalAmount: list.reduce((s, c) => s + c.amount, 0),
      perClass: [...perClassMap.values()],
    };
  };

  if (dryRun || missing.length === 0) return aggregate(missing);

  // Write phase: one transaction per student → charge creation, avans
  // auto-apply, and the balance decrement land atomically together.
  const byStudent = new Map<string, ChargeCandidate[]>();
  for (const c of missing) {
    const group = byStudent.get(c.studentId);
    if (group) group.push(c);
    else byStudent.set(c.studentId, [c]);
  }

  const createdPerStudent = await mapWithConcurrency([...byStudent.entries()], 6, async ([studentId, group]) => {
    return adminDb.runTransaction(async (tx) => {
      const pRef = profileRef(centerId, studentId);
      const [profileSnap, ...chargeSnaps] = await tx.getAll(pRef, ...group.map((c) => chargeRef(c.id)));
      const profile = profileSnap.data() as StudentFinanceProfile | undefined;
      if (profile?.financeStatus === 'frozen') return [] as ChargeCandidate[];

      const toCreate = group.filter((_, i) => !chargeSnaps[i].exists);
      if (toCreate.length === 0) return [] as ChargeCandidate[];

      // Avans auto-apply: consume unallocated confirmed payments, oldest first.
      const pool = toCreate.map((c) => ({ id: c.id, amount: c.amount, paidAmount: 0, dueDate: c.dueDate }));
      const paymentUpdates: { ref: DocumentReference; allocations: PaymentAllocation[]; unallocatedAmount: number }[] = [];
      if ((profile?.balance ?? 0) > 0) {
        const paySnap = await tx.get(
          adminDb
            .collection('center_payments')
            .where('centerId', '==', centerId)
            .where('studentId', '==', studentId)
            .where('status', '==', 'confirmed')
        );
        const openPayments = paySnap.docs
          .map((d) => ({ ref: d.ref, data: d.data() as Payment }))
          .filter((p) => p.data.type === 'payment' && (p.data.unallocatedAmount || 0) > 0)
          .sort((a, b) => (a.data.paidAt < b.data.paidAt ? -1 : a.data.paidAt > b.data.paidAt ? 1 : 0));
        for (const p of openPayments) {
          const result = allocateOldestFirst(p.data.unallocatedAmount, pool);
          if (result.allocations.length === 0) break; // pool fully covered
          for (const a of result.allocations) {
            const item = pool.find((x) => x.id === a.chargeId)!;
            item.paidAmount += a.amount;
          }
          paymentUpdates.push({
            ref: p.ref,
            allocations: [...(p.data.allocations || []), ...result.allocations],
            unallocatedAmount: result.unallocated,
          });
          if (pool.every((x) => x.paidAmount >= x.amount)) break;
        }
      }

      for (const c of toCreate) {
        const poolItem = pool.find((x) => x.id === c.id)!;
        tx.create(chargeRef(c.id), {
          centerId,
          classId: c.classId,
          classTitle: c.classTitle,
          studentId: c.studentId,
          studentName: c.studentName,
          periodKey: c.periodKey,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          baseAmount: c.baseAmount,
          discountAmount: c.discountAmount,
          amount: c.amount,
          paidAmount: poolItem.paidAmount,
          status: statusForPaid(c.amount, poolItem.paidAmount),
          dueDate: c.dueDate,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: uid,
          ...(c.proratedFrom ? { proratedFrom: c.proratedFrom } : {}),
        });
      }
      for (const u of paymentUpdates) {
        tx.update(u.ref, { allocations: u.allocations, unallocatedAmount: u.unallocatedAmount });
      }
      const delta = -toCreate.reduce((s, c) => s + c.amount, 0);
      tx.set(
        pRef,
        {
          centerId,
          studentId,
          balance: FieldValue.increment(delta),
          updatedAt: FieldValue.serverTimestamp(),
          ...(profileSnap.exists ? {} : { financeStatus: 'active' }),
        },
        { merge: true }
      );
      return toCreate;
    });
  });

  return { ...aggregate(createdPerStudent.flat()), dryRun: false };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function recordPayment(params: {
  centerId: string;
  uid: string;
  request: RecordPaymentRequest;
}): Promise<RecordPaymentResult> {
  const { centerId, uid, request } = params;
  const studentId = typeof request.studentId === 'string' ? request.studentId.trim() : '';
  if (!studentId) throw new ManagerApiError("O'quvchi tanlanmagan.", 400);
  const amount = requireValidMoney(request.amount);
  if (request.type !== 'payment' && request.type !== 'refund') {
    throw new ManagerApiError("Amal turi noto'g'ri.", 400);
  }
  if (!PAYMENT_METHODS.includes(request.method as any)) {
    throw new ManagerApiError("To'lov usuli noto'g'ri.", 400);
  }
  const todayKey = getTodayKey();
  const paidAt = request.paidAt || todayKey;
  if (!DATE_KEY_RE.test(paidAt)) throw new ManagerApiError("Sana formati noto'g'ri.", 400);
  if (paidAt > todayKey) throw new ManagerApiError("Kelajak sanasiga to'lov kiritib bo'lmaydi.", 400);
  const note = typeof request.note === 'string' ? request.note.trim().slice(0, 500) : '';
  if (request.type === 'refund' && !note) {
    throw new ManagerApiError('Qaytarim uchun izoh majburiy.', 400);
  }

  // Eligibility: an existing finance profile (old debt / avans) or current roster membership.
  const [profileSnap, userSnap] = await Promise.all([
    profileRef(centerId, studentId).get(),
    adminDb.collection('users').doc(studentId).get(),
  ]);
  if (!profileSnap.exists) {
    const classes = await resolveCenterClasses(centerId);
    const inRoster = classes.some((c) => c.studentIds.includes(studentId));
    if (!inRoster) throw new ManagerApiError("O'quvchi markazingizda topilmadi.", 404);
  }
  const studentName = (userSnap.data()?.displayName as string) || "Noma'lum";

  return adminDb.runTransaction(async (tx) => {
    const pRef = profileRef(centerId, studentId);
    const profSnap = await tx.get(pRef);
    const currentBalance = (profSnap.data()?.balance as number) ?? 0;

    let allocations: PaymentAllocation[] = [];
    let unallocated = 0;
    const chargeWrites: { ref: DocumentReference; paidAmount: number; status: string }[] = [];

    if (request.type === 'payment') {
      const openSnap = await tx.get(
        adminDb
          .collection('center_charges')
          .where('centerId', '==', centerId)
          .where('studentId', '==', studentId)
          .where('status', 'in', ['pending', 'partial'])
      );
      const open = openSnap.docs.map((d) => ({
        ref: d.ref,
        id: d.id,
        amount: d.data().amount as number,
        paidAmount: (d.data().paidAmount as number) || 0,
        dueDate: d.data().dueDate as string,
      }));
      const result = allocateOldestFirst(amount, open);
      allocations = result.allocations;
      unallocated = result.unallocated;
      for (const a of allocations) {
        const c = open.find((x) => x.id === a.chargeId)!;
        const newPaid = c.paidAmount + a.amount;
        chargeWrites.push({ ref: c.ref, paidAmount: newPaid, status: statusForPaid(c.amount, newPaid) });
      }
    }

    const payRef = paymentRef();
    tx.create(payRef, {
      centerId,
      studentId,
      studentName,
      type: request.type,
      amount,
      method: request.method,
      source: 'manual',
      allocations,
      unallocatedAmount: unallocated,
      paidAt,
      receivedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      status: 'confirmed',
      ...(note ? { note } : {}),
    });
    for (const w of chargeWrites) {
      tx.update(w.ref, { paidAmount: w.paidAmount, status: w.status });
    }
    const delta = request.type === 'payment' ? amount : -amount;
    tx.set(
      pRef,
      {
        centerId,
        studentId,
        balance: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
        ...(profSnap.exists ? {} : { financeStatus: 'active' }),
      },
      { merge: true }
    );

    return {
      paymentId: payRef.id,
      allocations,
      unallocatedAmount: unallocated,
      newBalance: currentBalance + delta,
    };
  });
}

export async function cancelPayment(params: {
  centerId: string;
  uid: string;
  paymentId: string;
  reason: string;
}): Promise<void> {
  const { centerId, uid, paymentId } = params;
  const reason = (params.reason || '').trim().slice(0, 500);
  if (!reason) throw new ManagerApiError('Bekor qilish sababi majburiy.', 400);

  await adminDb.runTransaction(async (tx) => {
    const payRef = paymentRef(paymentId);
    const paySnap = await tx.get(payRef);
    const payment = paySnap.data() as Payment | undefined;
    if (!payment || payment.centerId !== centerId) throw new ManagerApiError("To'lov topilmadi.", 404);
    if (payment.status !== 'confirmed') throw new ManagerApiError("Bu to'lov allaqachon bekor qilingan.", 400);

    const allocations = payment.allocations || [];
    const chargeSnaps = allocations.length
      ? await tx.getAll(...allocations.map((a) => chargeRef(a.chargeId)))
      : [];

    // balance = payments − refunds − Σ non-cancelled charge amounts. Removing the
    // payment shifts it by −amount; waived charges also shrink `amount` (to keep
    // the waived invariant amount == paidAmount), shifting it back by that much.
    let waivedAmountReduction = 0;
    chargeSnaps.forEach((snap, i) => {
      const alloc = allocations[i];
      const charge = snap.data() as Charge | undefined;
      if (!charge) throw new ManagerApiError("Bog'liq hisob topilmadi — administratorga murojaat qiling.", 500);
      const newPaid = Math.max(0, (charge.paidAmount || 0) - alloc.amount);
      if (charge.status === 'waived') {
        waivedAmountReduction += alloc.amount;
        tx.update(snap.ref, { paidAmount: newPaid, amount: Math.max(0, charge.amount - alloc.amount) });
      } else {
        tx.update(snap.ref, { paidAmount: newPaid, status: statusForPaid(charge.amount, newPaid) });
      }
    });

    tx.update(payRef, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: uid,
      cancelReason: reason,
    });

    const delta = payment.type === 'payment' ? -payment.amount + waivedAmountReduction : payment.amount;
    tx.set(
      profileRef(centerId, payment.studentId),
      { centerId, studentId: payment.studentId, balance: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

// ─── Charge lifecycle ─────────────────────────────────────────────────────────

async function loadOwnCharge(tx: Transaction, centerId: string, chargeId: string) {
  const ref = chargeRef(chargeId);
  const snap = await tx.get(ref);
  const charge = snap.data() as Charge | undefined;
  if (!charge || charge.centerId !== centerId) throw new ManagerApiError('Hisob topilmadi.', 404);
  return { ref, charge };
}

export async function waiveCharge(params: { centerId: string; uid: string; chargeId: string; reason: string }): Promise<void> {
  const reason = (params.reason || '').trim().slice(0, 500);
  if (!reason) throw new ManagerApiError('Kechirish sababi majburiy.', 400);

  await adminDb.runTransaction(async (tx) => {
    const { ref, charge } = await loadOwnCharge(tx, params.centerId, params.chargeId);
    if (charge.status !== 'pending' && charge.status !== 'partial') {
      throw new ManagerApiError("Faqat to'lanmagan hisobni kechirish mumkin.", 400);
    }
    const forgiven = charge.amount - (charge.paidAmount || 0);
    if (forgiven <= 0) throw new ManagerApiError('Bu hisobda kechiriladigan qoldiq yo\'q.', 400);

    tx.update(ref, {
      amount: charge.paidAmount || 0,
      status: 'waived',
      forgivenAmount: forgiven,
      waivedAt: FieldValue.serverTimestamp(),
      waivedBy: params.uid,
      waiveReason: reason,
    });
    tx.set(
      profileRef(params.centerId, charge.studentId),
      { centerId: params.centerId, studentId: charge.studentId, balance: FieldValue.increment(forgiven), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

export async function cancelCharge(params: { centerId: string; uid: string; chargeId: string; reason: string }): Promise<void> {
  const reason = (params.reason || '').trim().slice(0, 500);
  if (!reason) throw new ManagerApiError('Bekor qilish sababi majburiy.', 400);

  await adminDb.runTransaction(async (tx) => {
    const { ref, charge } = await loadOwnCharge(tx, params.centerId, params.chargeId);
    if (charge.status !== 'pending' || (charge.paidAmount || 0) > 0) {
      throw new ManagerApiError("Faqat to'lov qilinmagan hisobni bekor qilish mumkin.", 400);
    }
    tx.update(ref, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: params.uid,
      cancelReason: reason,
    });
    tx.set(
      profileRef(params.centerId, charge.studentId),
      { centerId: params.centerId, studentId: charge.studentId, balance: FieldValue.increment(charge.amount), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

export async function adjustCharge(params: {
  centerId: string;
  uid: string;
  chargeId: string;
  amount: number;
  note?: string;
}): Promise<void> {
  const newAmount = requireValidMoney(params.amount);
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 500) : '';

  await adminDb.runTransaction(async (tx) => {
    const { ref, charge } = await loadOwnCharge(tx, params.centerId, params.chargeId);
    if (charge.status !== 'pending' || (charge.paidAmount || 0) > 0) {
      throw new ManagerApiError("To'lov boshlangan hisobni o'zgartirib bo'lmaydi.", 400);
    }
    tx.update(ref, {
      amount: newAmount,
      adjustedAt: FieldValue.serverTimestamp(),
      adjustedBy: params.uid,
      ...(note ? { note } : {}),
    });
    tx.set(
      profileRef(params.centerId, charge.studentId),
      { centerId: params.centerId, studentId: charge.studentId, balance: FieldValue.increment(charge.amount - newAmount), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

// ─── Student finance profile ──────────────────────────────────────────────────

export async function patchStudentProfile(params: {
  centerId: string;
  uid: string;
  studentId: string;
  patch: StudentFinancePatch;
}): Promise<void> {
  const { centerId, studentId, patch } = params;
  if (!studentId || typeof studentId !== 'string') throw new ManagerApiError("O'quvchi tanlanmagan.", 400);

  const payload: Record<string, unknown> = {
    centerId,
    studentId,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if ('discountPercent' in patch) {
    const v = patch.discountPercent;
    if (v === null || v === 0) payload.discountPercent = FieldValue.delete();
    else if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100) payload.discountPercent = v;
    else throw new ManagerApiError('Chegirma 1–100% oralig\'ida bo\'lishi kerak.', 400);
  }

  if (patch.priceOverrides !== undefined) {
    const entries: Record<string, unknown> = {};
    for (const [classId, value] of Object.entries(patch.priceOverrides || {})) {
      if (!classId) continue;
      if (value === null) entries[classId] = FieldValue.delete();
      else entries[classId] = requireValidMoney(value, 'Maxsus narx');
    }
    if (Object.keys(entries).length) payload.priceOverrides = entries;
  }

  if (patch.enrollmentDates !== undefined) {
    const entries: Record<string, unknown> = {};
    for (const [classId, value] of Object.entries(patch.enrollmentDates || {})) {
      if (!classId) continue;
      if (value === null) entries[classId] = FieldValue.delete();
      else if (typeof value === 'string' && DATE_KEY_RE.test(value)) entries[classId] = value;
      else throw new ManagerApiError("Qo'shilgan sana formati noto'g'ri.", 400);
    }
    if (Object.keys(entries).length) payload.enrollmentDates = entries;
  }

  if (patch.financeStatus !== undefined) {
    if (patch.financeStatus !== 'active' && patch.financeStatus !== 'frozen') {
      throw new ManagerApiError("Holat qiymati noto'g'ri.", 400);
    }
    payload.financeStatus = patch.financeStatus;
    payload.frozenAt = patch.financeStatus === 'frozen' ? getTodayKey() : FieldValue.delete();
  }

  const ref = profileRef(centerId, studentId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { balance: 0, financeStatus: 'active', ...stripDeletes(payload) });
    } else {
      tx.set(ref, payload, { merge: true });
    }
  });
}

/**
 * Batch-set group monthly fees. Ownership is verified via resolveCenterClasses
 * (the teacherId FIELD on center_teachers) — deliberately NOT the client-rules
 * path, which depends on center_teachers doc ids and broke on legacy data.
 */
export async function updateGroupFees(params: {
  centerId: string;
  fees: Record<string, unknown>;
}): Promise<{ updated: number }> {
  const entries = Object.entries(params.fees || {});
  if (entries.length === 0) throw new ManagerApiError("O'zgartirish uchun guruh yo'q.", 400);
  if (entries.length > 200) throw new ManagerApiError("Juda ko'p guruh bir vaqtda.", 400);

  const cleaned: [string, number][] = entries.map(([classId, fee]) => {
    if (typeof fee !== 'number' || !Number.isInteger(fee) || fee < 0 || fee > MAX_AMOUNT) {
      throw new ManagerApiError("Narx noto'g'ri kiritildi.", 400);
    }
    return [classId, fee];
  });

  const centerClassIds = new Set((await resolveCenterClasses(params.centerId)).map((c) => c.id));
  for (const [classId] of cleaned) {
    if (!centerClassIds.has(classId)) throw new ManagerApiError('Guruh markazingizda topilmadi.', 404);
  }

  const batch = adminDb.batch();
  for (const [classId, fee] of cleaned) {
    batch.update(adminDb.collection('classes').doc(classId), { monthlyFee: fee });
  }
  await batch.commit();
  return { updated: cleaned.length };
}

// ─── Expenses (Phase 3) ───────────────────────────────────────────────────────

const expenseRef = (id?: string) =>
  id ? adminDb.collection('center_expenses').doc(id) : adminDb.collection('center_expenses').doc();

export async function createExpense(params: {
  centerId: string;
  uid: string;
  category: string;
  amount: number;
  date?: string;
  note?: string;
}): Promise<{ expenseId: string }> {
  const category = typeof params.category === 'string' ? params.category.trim() : '';
  if (!category || category.length > 40) throw new ManagerApiError("Kategoriya noto'g'ri.", 400);
  const amount = requireValidMoney(params.amount);
  const todayKey = getTodayKey();
  const date = params.date || todayKey;
  if (!DATE_KEY_RE.test(date)) throw new ManagerApiError("Sana formati noto'g'ri.", 400);
  if (date > todayKey) throw new ManagerApiError("Kelajak sanasiga xarajat kiritib bo'lmaydi.", 400);
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 500) : '';

  const ref = expenseRef();
  await ref.set({
    centerId: params.centerId,
    category,
    amount,
    date,
    createdBy: params.uid,
    createdAt: FieldValue.serverTimestamp(),
    status: 'active',
    ...(note ? { note } : {}),
  });
  return { expenseId: ref.id };
}

export async function cancelExpense(params: {
  centerId: string;
  uid: string;
  expenseId: string;
  reason: string;
}): Promise<void> {
  const reason = (params.reason || '').trim().slice(0, 500);
  if (!reason) throw new ManagerApiError('Bekor qilish sababi majburiy.', 400);

  await adminDb.runTransaction(async (tx) => {
    const ref = expenseRef(params.expenseId);
    const snap = await tx.get(ref);
    const expense = snap.data() as Expense | undefined;
    if (!expense || expense.centerId !== params.centerId) throw new ManagerApiError('Xarajat topilmadi.', 404);
    if (expense.status !== 'active') throw new ManagerApiError('Bu xarajat allaqachon bekor qilingan.', 400);
    if (expense.payoutId) {
      throw new ManagerApiError("Oylik to'loviga bog'langan xarajatni bekor qilib bo'lmaydi.", 400);
    }
    tx.update(ref, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: params.uid,
      cancelReason: reason,
    });
  });
}

// ─── Payroll (Phase 3) ────────────────────────────────────────────────────────
// Salary config lives on center_teachers/{uid}.salary. A payout is always
// recomputed from live data at save time (never trusted from the client), then
// frozen once marked paid — paying also creates the linked `salary` expense.

export async function updateTeacherSalary(params: {
  centerId: string;
  uid: string;
  teacherId: string;
  config: Record<string, unknown>;
}): Promise<void> {
  const { centerId, teacherId, config } = params;
  const ctRef = adminDb.collection('center_teachers').doc(teacherId);
  const ctSnap = await ctRef.get();
  if (!ctSnap.exists || ctSnap.data()!.centerId !== centerId) {
    throw new ManagerApiError("O'qituvchi markazingizda topilmadi.", 404);
  }

  const salary: Record<string, unknown> = {};
  for (const key of ['fixed', 'perLesson'] as const) {
    if (!(key in config)) continue;
    const v = config[key];
    if (v === null || v === 0) salary[key] = FieldValue.delete();
    else salary[key] = requireValidMoney(v, key === 'fixed' ? 'Fiks oylik' : 'Dars narxi');
  }
  if ('percent' in config) {
    const v = config.percent;
    if (v === null || v === 0) salary.percent = FieldValue.delete();
    else if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100) salary.percent = v;
    else throw new ManagerApiError("Foiz 1–100 oralig'ida bo'lishi kerak.", 400);
  }
  if (Object.keys(salary).length === 0) throw new ManagerApiError("O'zgartirish uchun maydon yo'q.", 400);

  await ctRef.set({ salary }, { merge: true });
}

export async function calculatePayroll(params: { centerId: string; periodKey: string }): Promise<CalculatePayrollResult> {
  const { centerId, periodKey } = params;
  if (!MONTH_KEY_RE.test(periodKey)) throw new ManagerApiError("Davr formati noto'g'ri.", 400);
  const todayKey = getTodayKey();
  const monthStart = `${periodKey}-01`;
  const monthEnd = `${periodKey}-31`;

  const settings = await getSettings(centerId);
  const percentBase = settings.percentBase;

  const [ctSnap, classes] = await Promise.all([
    adminDb.collection('center_teachers').where('centerId', '==', centerId).get(),
    resolveCenterClasses(centerId),
  ]);
  const teachers = ctSnap.docs.map((d) => ({
    teacherId: (d.data().teacherId as string) || d.id,
    teacherName: (d.data().teacherName as string) || "O'qituvchi",
    config: (d.data().salary || {}) as TeacherSalaryConfig,
  }));
  const classIdsByTeacher = new Map<string, string[]>();
  for (const cls of classes) {
    const arr = classIdsByTeacher.get(cls.teacherId);
    if (arr) arr.push(cls.id);
    else classIdsByTeacher.set(cls.teacherId, [cls.id]);
  }

  // Revenue base per class. 'collected' = this month's confirmed payment
  // allocations (chargeId encodes classId — Firestore auto-ids and auth uids
  // never contain "_", so the first segment is always the classId).
  const revenueByClass = new Map<string, number>();
  if (percentBase === 'collected') {
    const paySnap = await adminDb
      .collection('center_payments')
      .where('centerId', '==', centerId)
      .where('paidAt', '>=', monthStart)
      .where('paidAt', '<=', monthEnd)
      .get();
    for (const doc of paySnap.docs) {
      const p = doc.data() as Payment;
      if (p.status !== 'confirmed' || p.type !== 'payment') continue;
      for (const a of p.allocations || []) {
        const classId = a.chargeId.split('_')[0];
        revenueByClass.set(classId, (revenueByClass.get(classId) || 0) + a.amount);
      }
    }
  } else {
    // 'charged' = this month's non-cancelled charge amounts.
    const base = adminDb.collection('center_charges').where('centerId', '==', centerId);
    const chargeSnap =
      settings.billingAnchor === 'calendar'
        ? await base.where('periodKey', '==', periodKey).get()
        : await base.where('periodStart', '>=', monthStart).where('periodStart', '<=', monthEnd).get();
    for (const doc of chargeSnap.docs) {
      const c = doc.data() as Charge;
      if (c.status === 'cancelled') continue;
      revenueByClass.set(c.classId, (revenueByClass.get(c.classId) || 0) + c.amount);
    }
  }

  // Held/makeup lessons per class this month (same counting rule as attendance stats).
  const lessonsByClass = new Map<string, number>();
  const attSnap = await adminDb
    .collection('center_attendance')
    .where('centerId', '==', centerId)
    .where('date', '>=', monthStart)
    .where('date', '<=', monthEnd)
    .get();
  for (const doc of attSnap.docs) {
    const s = doc.data();
    if ((s.lessonStatus === 'held' || s.lessonStatus === 'makeup') && s.date <= todayKey) {
      lessonsByClass.set(s.classId, (lessonsByClass.get(s.classId) || 0) + 1);
    }
  }

  const payoutSnap = await adminDb
    .collection('center_payouts')
    .where('centerId', '==', centerId)
    .where('periodKey', '==', periodKey)
    .get();
  const payoutByTeacher = new Map<string, Payout>();
  payoutSnap.docs.forEach((d) => payoutByTeacher.set((d.data() as Payout).teacherId, { ...(d.data() as Payout), id: d.id }));

  const rows: PayrollRow[] = teachers.map((t) => {
    const classIds = classIdsByTeacher.get(t.teacherId) || [];
    const fixed = t.config.fixed || 0;
    const baseAmount = classIds.reduce((s, id) => s + (revenueByClass.get(id) || 0), 0);
    const percentAmount = t.config.percent ? roundTo1000((baseAmount * t.config.percent) / 100) : 0;
    const lessonCount = classIds.reduce((s, id) => s + (lessonsByClass.get(id) || 0), 0);
    const perLessonAmount = t.config.perLesson ? lessonCount * t.config.perLesson : 0;
    const breakdown: PayoutBreakdown = {
      fixed,
      percent: { rate: t.config.percent || 0, base: percentBase, baseAmount, amount: percentAmount },
      perLesson: { count: lessonCount, rate: t.config.perLesson || 0, amount: perLessonAmount },
    };
    return {
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      config: t.config,
      breakdown,
      calculatedAmount: fixed + percentAmount + perLessonAmount,
      payout: payoutByTeacher.get(t.teacherId) || null,
    };
  });

  return { periodKey, percentBase, rows };
}

export async function savePayout(params: {
  centerId: string;
  uid: string;
  teacherId: string;
  periodKey: string;
  adjustment?: number;
  adjustmentNote?: string;
}): Promise<void> {
  const adjustment = params.adjustment ?? 0;
  if (!Number.isInteger(adjustment) || Math.abs(adjustment) > MAX_AMOUNT) {
    throw new ManagerApiError("Qo'shimcha/jarima summasi noto'g'ri.", 400);
  }
  const adjustmentNote = typeof params.adjustmentNote === 'string' ? params.adjustmentNote.trim().slice(0, 500) : '';
  if (adjustment !== 0 && !adjustmentNote) {
    throw new ManagerApiError("Qo'shimcha/jarima uchun izoh majburiy.", 400);
  }

  // Always recompute server-side — the client never sends amounts.
  const calc = await calculatePayroll({ centerId: params.centerId, periodKey: params.periodKey });
  const row = calc.rows.find((r) => r.teacherId === params.teacherId);
  if (!row) throw new ManagerApiError("O'qituvchi markazingizda topilmadi.", 404);
  const finalAmount = row.calculatedAmount + adjustment;
  if (finalAmount < 0) throw new ManagerApiError("Yakuniy summa manfiy bo'lishi mumkin emas.", 400);

  const ref = adminDb.collection('center_payouts').doc(payoutDocId(params.teacherId, params.periodKey));
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data() as Payout | undefined;
    if (existing && existing.status === 'paid') {
      throw new ManagerApiError("To'langan oylikni o'zgartirib bo'lmaydi.", 400);
    }
    tx.set(ref, {
      centerId: params.centerId,
      teacherId: params.teacherId,
      teacherName: row.teacherName,
      periodKey: params.periodKey,
      breakdown: row.breakdown,
      calculatedAmount: row.calculatedAmount,
      adjustment,
      ...(adjustmentNote ? { adjustmentNote } : {}),
      finalAmount,
      status: 'approved',
      createdBy: existing?.createdBy || params.uid,
      createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function markPayoutPaid(params: { centerId: string; uid: string; payoutId: string }): Promise<void> {
  const todayKey = getTodayKey();
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.collection('center_payouts').doc(params.payoutId);
    const snap = await tx.get(ref);
    const payout = snap.data() as Payout | undefined;
    if (!payout || payout.centerId !== params.centerId) throw new ManagerApiError('Oylik topilmadi.', 404);
    if (payout.status !== 'approved') throw new ManagerApiError("Bu oylik allaqachon to'langan.", 400);

    // A zero-sum payout is legitimate (e.g. full penalty) — just no expense doc.
    if (payout.finalAmount > 0) {
      const eRef = expenseRef();
      tx.create(eRef, {
        centerId: params.centerId,
        category: 'salary',
        amount: payout.finalAmount,
        date: todayKey,
        note: `Oylik: ${payout.teacherName} (${payout.periodKey})`,
        teacherId: payout.teacherId,
        payoutId: ref.id,
        createdBy: params.uid,
        createdAt: FieldValue.serverTimestamp(),
        status: 'active',
      });
      tx.update(ref, { status: 'paid', paidAt: todayKey, expenseId: eRef.id, updatedAt: FieldValue.serverTimestamp() });
    } else {
      tx.update(ref, { status: 'paid', paidAt: todayKey, updatedAt: FieldValue.serverTimestamp() });
    }
  });
}

/** On first creation there is nothing to delete — drop FieldValue.delete() sentinels. */
function stripDeletes(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v instanceof FieldValue && v.isEqual(FieldValue.delete())) continue;
    if (v && typeof v === 'object' && !(v instanceof FieldValue) && !(v instanceof Timestamp) && !Array.isArray(v)) {
      const nested = stripDeletes(v as Record<string, unknown>);
      if (Object.keys(nested).length) out[k] = nested;
      continue;
    }
    out[k] = v;
  }
  return out;
}
