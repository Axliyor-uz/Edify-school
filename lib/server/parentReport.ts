// lib/server/parentReport.ts
//
// **The parent report — assembled with the Admin SDK, served as JSON.**
// Contract + traps: docs/PARENTS.md.
//
// ⚠️ **Why this file exists at all.** A parent has no Firebase account, so there
// is no `request.auth` for a security rule to authorize. Every read below would
// be denied to a browser, correctly. The token is checked here, in trusted code,
// and only the fields of `ParentReport` cross the wire — so a field added to
// `users` or `attempts` tomorrow cannot leak into a parent's browser by accident.
// ⚠️ Never mirror any of this into a client-SDK path.
//
// ⚠️ **Cost is the design constraint.** The URL is public and refreshable, so a
// report must stay bounded no matter how big the student's history is: every
// query below is limited, the attendance sweep is per-class over a fixed window
// (never the center-wide `centerId + date` query, which would read every class's
// day-docs), and the route caches the result for PARENT_REPORT_TTL_MS.
//
// ⚠️ **Nothing here writes.** The view counter is bumped by the route, after the
// report is built, and is deliberately fire-and-forget.

import { createHash } from 'node:crypto';

import { adminDb } from '@/lib/firebaseAdmin';
import { getTodayKey, monthKeyOf, toDateKey } from '@/lib/dateUtils';
import {
  PARENT_ATTENDANCE_DAYS,
  PARENT_RECENT_RESULTS,
  PARENT_RESULT_LIMIT,
  PARENT_TREND_MONTHS,
  describeParentDevice,
  generateParentDeviceSecret,
} from '@/lib/parentLinks';
import { thetaToLevel } from '@/lib/RASCHscale';
import { RASCH_TOPICS } from '@/lib/RASCHtopics';
import type {
  ParentAttendanceBlock,
  ParentFinanceBlock,
  ParentGroup,
  ParentLevelsBlock,
  ParentLink,
  ParentReport,
  ParentResultRow,
  ParentResultsBlock,
  ParentTrendPoint,
} from '@/types/Parent';
import type { Lang } from '@/types/Math';

/** How many of the student's groups are swept for attendance / titles. */
const MAX_CLASSES = 8;

// ─── small shared helpers ────────────────────────────────────────────────────

/**
 * Any of this codebase's four timestamp shapes → epoch ms.
 *
 * ⚠️ `attempts.submittedAt` is a `serverTimestamp()` while every RASCH/Milliy
 * result writes a plain number (docs/DATA_MODEL.md), and this report merges the
 * two into one list — sorting them without normalizing would interleave 2026
 * results with 1970.
 */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const ts = value as { toMillis?: () => number; _seconds?: number; seconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    const seconds = ts._seconds ?? ts.seconds;
    if (typeof seconds === 'number') return seconds * 1000;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

const clampPct = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;

const WEEKDAYS: Record<Lang, string[]> = {
  uz: ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Jum', 'Shan'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

// ─── the link ────────────────────────────────────────────────────────────────

/**
 * `parent_links/{token}` → the link, or `null`.
 *
 * ⚠️ The caller must have validated the token's SHAPE first (`isParentToken`) —
 * this is a document `get()` by user input, and an unbounded string reaching
 * Firestore as a document id is how you get 400s in your logs at best.
 *
 * ⚠️ A revoked link is returned, not hidden: the route answers 410 for it so the
 * parent page can say "access was closed" instead of "wrong code", which is the
 * difference between a parent phoning the center and a parent retyping forever.
 */
export async function loadParentLink(token: string): Promise<ParentLink | null> {
  const snap = await adminDb.collection('parent_links').doc(token).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as ParentLink), token: snap.id };
}

// ─── the device claim: one link, one person ──────────────────────────────────

/**
 * sha256 of a device secret.
 *
 * ⚠️ Only the hash is ever stored (types/Parent.ts). A plaintext device secret in
 * the database would be replayable by anyone who reads the document — an
 * operator, a backup, a support export — which would quietly defeat the whole
 * one-person rule. Plain sha256 with no salt or stretching is correct HERE and
 * only here: the input is 156 bits of CSPRNG output, so there is nothing to
 * brute-force and nothing to guess. ⚠️ Never reuse this for a human password.
 */
export const hashParentDevice = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex');

/** What `claimParentLink` decided. */
export type ParentClaim =
  /** This device owns the link — serve the report. `secret` is set only on the
   *  first claim, and is the ONE time it is ever transmitted. */
  | { ok: true; link: ParentLink; secret?: string }
  /** Someone else got here first. */
  | { ok: false; reason: 'claimed' }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'revoked' };

/**
 * Decide whether this browser may read this link, claiming it if it is free.
 *
 * ⚠️ **A TRANSACTION, not a read-then-write.** Two phones opening a forwarded
 * link in the same second would both see `deviceHash` empty and both claim it;
 * the loser would hold a secret that no longer matches and be locked out with no
 * explanation. Inside a transaction exactly one of them claims and the other is
 * told `claimed` immediately — which is the honest answer.
 *
 * ⚠️ The claim writes ONLY the device fields. The view counter is bumped
 * separately and fire-and-forget: a failed counter must never cost a parent
 * their report.
 */
export async function claimParentLink(
  token: string,
  presentedSecret: string | null,
  userAgent: string,
): Promise<ParentClaim> {
  const ref = adminDb.collection('parent_links').doc(token);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'not_found' } as const;

    const link = { ...(snap.data() as ParentLink), token };
    if (link.status !== 'active') return { ok: false, reason: 'revoked' } as const;

    // Already claimed: the presented secret must hash to the stored value.
    if (link.deviceHash) {
      const matches = !!presentedSecret && hashParentDevice(presentedSecret) === link.deviceHash;
      return matches
        ? ({ ok: true, link } as const)
        : ({ ok: false, reason: 'claimed' } as const);
    }

    // Free: this device takes it.
    const secret = generateParentDeviceSecret();
    const claimedAt = Date.now();
    const claimedDevice = describeParentDevice(userAgent);
    tx.update(ref, { deviceHash: hashParentDevice(secret), claimedAt, claimedDevice });

    return { ok: true, link: { ...link, claimedAt, claimedDevice }, secret } as const;
  });
}

// ─── the report ──────────────────────────────────────────────────────────────

/**
 * Everything the parent page renders, for ONE student.
 *
 * The blocks the link's scope excludes are not fetched at all — `scope.finance`
 * off means the finance queries never run, so an operator reading the logs can
 * see that a link with money hidden never touched the money collections.
 */
export async function buildParentReport(link: ParentLink): Promise<ParentReport> {
  const { studentId, centerId, scope } = link;

  const [studentSnap, centerSnap, classesSnap] = await Promise.all([
    adminDb.collection('users').doc(studentId).get(),
    adminDb.collection('centers').doc(centerId).get(),
    adminDb.collection('classes').where('studentIds', 'array-contains', studentId).get(),
  ]);

  const student = studentSnap.exists ? (studentSnap.data() as Record<string, unknown>) : {};
  const center = centerSnap.exists ? (centerSnap.data() as Record<string, unknown>) : {};

  // ⚠️ Center scoping happens HERE, in memory: the array-contains query cannot
  // also filter `centerId` without a composite index, and a student may study at
  // several centers. A link issued by center A must never show group B's work.
  const classDocs = classesSnap.docs
    .filter((d) => (d.data() as { centerId?: string }).centerId === centerId)
    .slice(0, MAX_CLASSES);
  const classIds = classDocs.map((d) => d.id);
  const classTitles = new Map(classDocs.map((d) => [d.id, String((d.data() as { title?: string }).title || '')]));

  const groups: ParentGroup[] = classDocs.map((d) => {
    const data = d.data() as {
      title?: string;
      teacherName?: string;
      schedule?: { dayOfWeek?: number; startTime?: string; endTime?: string; roomName?: string }[];
    };
    return {
      classId: d.id,
      title: data.title || '',
      teacherName: data.teacherName || '',
      schedule: (data.schedule || []).map((s) => {
        const day = WEEKDAYS.uz[(s.dayOfWeek ?? 0) % 7] || '';
        const time = [s.startTime, s.endTime].filter(Boolean).join('–');
        return [day, time, s.roomName].filter(Boolean).join(' ');
      }),
    };
  });

  const [results, levels, attendance, finance] = await Promise.all([
    scope.results ? buildResults(studentId, classIds, classTitles) : Promise.resolve(undefined),
    scope.levels ? buildLevels(studentId) : Promise.resolve(undefined),
    scope.attendance ? buildAttendance(studentId, classIds, classTitles) : Promise.resolve(undefined),
    scope.finance ? buildFinance(centerId, studentId) : Promise.resolve(undefined),
  ]);

  const totalXP = Number(student.totalXP ?? 0) || 0;

  return {
    student: {
      id: studentId,
      name: String(student.displayName || link.studentName || ''),
      photoURL: String(student.photoURL || ''),
      grade: String(student.grade || ''),
      totalXP,
      streak: Number(student.currentStreak ?? 0) || 0,
      // ⚠️ DERIVED, never `users.level` — that field is written 1 at signup and
      // never updated again (docs/DATA_MODEL.md).
      xpLevel: Math.floor(totalXP / 1000) + 1,
      },
    center: { id: centerId, name: String(center.name || '') },
    groups,
    ...(results ? { results } : {}),
    ...(levels ? { levels } : {}),
    ...(attendance ? { attendance } : {}),
    ...(finance ? { finance } : {}),
    generatedAt: Date.now(),
  };
}

// ─── results + the improvement trend ─────────────────────────────────────────

/**
 * Class work (`attempts`) merged with the two exam-paper collections.
 *
 * ⚠️ **`attempts` is polymorphic — branch on `type`** (docs/DATA_MODEL.md). An
 * assignment scores `score/totalQuestions` (POINTS, not question counts), an exam
 * scores `teacherScore/totalPoints` and is **pending until `status:'graded'`**.
 * Treating a pending exam as 0 would tell a parent their child failed a paper the
 * teacher has not marked yet, which is the single worst thing this page could do.
 */
async function buildResults(
  studentId: string,
  classIds: string[],
  classTitles: Map<string, string>,
): Promise<ParentResultsBlock> {
  const [attemptsSnap, milliySnap, raschSnap] = await Promise.all([
    adminDb
      .collection('attempts')
      .where('userId', '==', studentId)
      .orderBy('submittedAt', 'desc')
      .limit(PARENT_RESULT_LIMIT)
      .get(),
    adminDb.collection('milliy_quiz_results').where('studentId', '==', studentId).limit(20).get(),
    adminDb.collection('teacher_rasch_results').where('studentId', '==', studentId).limit(20).get(),
  ]);

  const rows: ParentResultRow[] = [];

  // ⚠️ An EXAM attempt stores no title (the assignment one does — the two shapes
  // differ, docs/DATA_MODEL.md), so the name lives on `classes/{id}/exams/{id}`.
  // Resolved in ONE `getAll` for the exams actually being shown rather than a
  // read per row, and capped: a parent refreshing must not fan out.
  const examRefs = attemptsSnap.docs
    .filter((d) => {
      const a = d.data() as { type?: string; classId?: string };
      return a.type === 'exam' && classIds.includes(String(a.classId || ''));
    })
    .slice(0, PARENT_RECENT_RESULTS)
    .map((d) => {
      const a = d.data() as { classId?: string; assignmentId?: string };
      // ⚠️ `assignmentId` holds the EXAM id on an exam attempt — the overload is
      // deliberate and documented; do not "fix" it to `examId` here.
      return adminDb.collection('classes').doc(String(a.classId)).collection('exams').doc(String(a.assignmentId));
    });

  const examTitles = new Map<string, string>();
  if (examRefs.length > 0) {
    const examDocs = await adminDb.getAll(...examRefs);
    for (const doc of examDocs) {
      if (doc.exists) examTitles.set(doc.id, String((doc.data() as { title?: string }).title || ''));
    }
  }

  for (const doc of attemptsSnap.docs) {
    const a = doc.data() as Record<string, unknown>;
    // Only this center's work. A student's personal/other-center attempts are
    // none of this link's business.
    if (!classIds.includes(String(a.classId || ''))) continue;

    const at = toMillis(a.submittedAt);
    const context = classTitles.get(String(a.classId || '')) || '';

    if (a.type === 'exam') {
      const graded = a.status === 'graded';
      const scored = Number(a.teacherScore ?? 0) || 0;
      const total = Number(a.totalPoints ?? 0) || 0;
      rows.push({
        id: doc.id,
        kind: 'exam',
        title: examTitles.get(String(a.assignmentId || '')) || String(a.testTitle || ''),
        context,
        percent: graded ? pct(scored, total) : null,
        at,
        pending: !graded,
      });
      continue;
    }

    rows.push({
      id: doc.id,
      kind: 'assignment',
      title: String(a.testTitle || ''),
      context,
      percent: pct(Number(a.score ?? 0) || 0, Number(a.totalQuestions ?? 0) || 0),
      at,
      pending: false,
    });
  }

  for (const doc of milliySnap.docs) {
    const r = doc.data() as Record<string, unknown>;
    rows.push({
      id: doc.id,
      kind: 'milliy',
      title: String(r.quizTitle || ''),
      context: String(r.subject || ''),
      percent: clampPct(r.percent),
      at: toMillis(r.submittedAt),
      pending: false,
    });
  }

  for (const doc of raschSnap.docs) {
    const r = doc.data() as Record<string, unknown>;
    rows.push({
      id: doc.id,
      kind: 'rasch',
      title: String(r.quizTitle || ''),
      context: 'Matematika',
      percent: clampPct(r.percent),
      at: toMillis(r.submittedAt),
      pending: false,
    });
  }

  rows.sort((a, b) => b.at - a.at);

  const graded = rows.filter((r) => r.percent !== null);
  const mean = (values: number[]) =>
    values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  // Newest-first, so "recent" is the head and "previous" the slice behind it.
  //
  // ⚠️ The two windows are EQUAL halves of what exists (up to 5 + 5), not a fixed
  // "last 5 vs the 5 before". With exactly 4 results a fixed split leaves the
  // previous window empty and the parent is told "not enough data" while staring
  // at four scores — the halves compare 2 against 2 instead, and only grow to
  // 5v5 once there is that much history.
  const scores = graded.map((r) => r.percent as number);
  const window = scores.slice(0, 10);
  const half = Math.floor(window.length / 2);
  const recentWindow = window.slice(0, half);
  const previousWindow = window.slice(half, half * 2);

  // ⚠️ Fewer than 4 graded results ⇒ NO improvement number. One lucky test would
  // otherwise print "+40%", and a parent would read that as a trend.
  const improvement =
    graded.length >= 4 ? Math.round(mean(recentWindow) - mean(previousWindow)) : null;

  return {
    recent: rows.slice(0, PARENT_RECENT_RESULTS),
    trend: buildTrend(graded),
    improvement,
    averageAll: graded.length ? Math.round(mean(scores)) : null,
    graded: graded.length,
  };
}

/**
 * Monthly averages, oldest → newest, for the little bar chart.
 *
 * ⚠️ A month with no work is **absent, not zero** — an empty month is "nothing
 * was set", not "scored nothing", and a zero bar reads as a catastrophe.
 */
function buildTrend(graded: ParentResultRow[]): ParentTrendPoint[] {
  const buckets = new Map<string, number[]>();

  for (const row of graded) {
    if (!row.at) continue;
    const key = monthKeyOf(toDateKey(new Date(row.at)));
    const list = buckets.get(key) || [];
    list.push(row.percent as number);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-PARENT_TREND_MONTHS)
    .map(([monthKey, values]) => ({
      monthKey,
      average: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
      count: values.length,
    }));
}

// ─── the measured level ──────────────────────────────────────────────────────

/**
 * The 0–5 maths level from `RASCH_levels/{uid}` — ONE document read.
 *
 * ⚠️ **This is the same arithmetic as `mathLevel()` / `dimensions()` in
 * services/RASCHProgressService.ts, deliberately re-stated here**: that module
 * imports the client SDK at load time, which has no business being pulled into a
 * Node API route. The rule it duplicates is small and stable — the mean θ over
 * the dimensions that have ACTUALLY been measured, never over all seven, or a
 * student tested only on geometry is dragged toward the prior by six dimensions
 * nobody has looked at. If the model changes, change both (docs/RASCH_SKILLS.md).
 *
 * ⚠️ Milliy percentages are reported as percentages and NOTHING else. There is no
 * calibrated difficulty for those subjects, so a level there would be a
 * confident-looking number with nothing behind it (docs/MILLIY_QUIZ.md).
 */
async function buildLevels(studentId: string): Promise<ParentLevelsBlock> {
  const [levelsSnap, milliySnap] = await Promise.all([
    adminDb.collection('RASCH_levels').doc(studentId).get(),
    adminDb.collection('milliy_quiz_results').where('studentId', '==', studentId).limit(20).get(),
  ]);

  type StoredTopic = { thetaTrace?: { theta: number }[]; ability?: { theta: number } };
  const doc = levelsSnap.exists ? (levelsSnap.data() as { topics?: Record<string, StoredTopic> }) : null;
  const topics = doc?.topics ?? {};

  const measured: { key: string; label: string; level: number; theta: number }[] = [];
  for (const topic of RASCH_TOPICS) {
    const entry = topics[topic.key];
    const trace = entry?.thetaTrace ?? [];
    if (trace.length === 0) continue; // never measured — not a zero
    const theta = trace[trace.length - 1]?.theta ?? entry?.ability?.theta ?? 0;
    measured.push({
      key: topic.key,
      label: topic.label.uz,
      level: Math.round(thetaToLevel(theta) * 10) / 10,
      theta,
    });
  }

  const mathLevel =
    measured.length > 0
      ? Math.round(thetaToLevel(measured.reduce((s, d) => s + d.theta, 0) / measured.length) * 10) / 10
      : null;

  const milliy = milliySnap.docs
    .map((d) => {
      const r = d.data() as Record<string, unknown>;
      return {
        subject: String(r.subject || ''),
        title: String(r.quizTitle || ''),
        percent: clampPct(r.percent) ?? 0,
        at: toMillis(r.submittedAt),
      };
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  return {
    mathLevel,
    measuredDimensions: measured.length,
    dimensions: measured
      .sort((a, b) => b.level - a.level)
      .map(({ key, label, level }) => ({ key, label, level })),
    milliy,
  };
}

// ─── attendance ──────────────────────────────────────────────────────────────

/**
 * Present/absent/late over the last `PARENT_ATTENDANCE_DAYS`.
 *
 * ⚠️ **Queried per class, never center-wide.** `fetchCenterSessions` (the manager
 * panel's reader) pulls every class's day-doc for the window, which for a
 * 20-group center is over a thousand documents — fine behind a login, absurd
 * behind a public URL. The `classId + date` index makes the per-class form exact.
 *
 * ⚠️ The counting rule is `isCountedLesson` + `tallyStudent` from
 * services/attendanceService.ts, restated for the same client-SDK reason as
 * `buildLevels`: a lesson counts only once it has HAPPENED (`held`/`makeup`, date
 * ≤ today) and `excused` is excluded from the denominator — an excused absence
 * must not read as a missed lesson.
 */
async function buildAttendance(
  studentId: string,
  classIds: string[],
  classTitles: Map<string, string>,
): Promise<ParentAttendanceBlock> {
  const todayKey = getTodayKey();
  const from = toDateKey(new Date(Date.now() - PARENT_ATTENDANCE_DAYS * 86_400_000));

  const snaps = await Promise.all(
    classIds.map((classId) =>
      adminDb
        .collection('center_attendance')
        .where('classId', '==', classId)
        .where('date', '>=', from)
        .where('date', '<=', todayKey)
        .get(),
    ),
  );

  const tally = { present: 0, late: 0, absent: 0, excused: 0 };
  let attended = 0;
  let denom = 0;
  const recent: { date: string; status: string; classTitle: string }[] = [];

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const s = doc.data() as {
        classId?: string;
        date?: string;
        lessonStatus?: string;
        records?: Record<string, unknown>;
      };
      const lessonStatus = s.lessonStatus || 'held';
      const date = s.date || '';
      if (!(lessonStatus === 'held' || lessonStatus === 'makeup') || date > todayKey) continue;

      const raw = s.records?.[studentId];
      const status = typeof raw === 'string' ? raw : (raw as { status?: string } | undefined)?.status;
      if (!status) continue;

      if (status === 'present' || status === 'late' || status === 'absent' || status === 'excused') {
        tally[status] += 1;
        if (status === 'present' || status === 'late') attended += 1;
        if (status !== 'excused') denom += 1;
        recent.push({ date, status, classTitle: classTitles.get(s.classId || '') || '' });
      }
    }
  }

  recent.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    from,
    to: todayKey,
    ...tally,
    rate: denom > 0 ? Math.round((attended / denom) * 100) : null,
    recent: recent.slice(0, 14),
  };
}

// ─── money ───────────────────────────────────────────────────────────────────

/**
 * Balance, open charges and recent payments — only when `scope.finance` is on.
 *
 * ⚠️ **Integer so'm and append-only, like the rest of finance** (docs/FINANCE.md).
 * This function reads and never writes: a parent page is a window, not a till.
 * ⚠️ `balance > 0` means the family OWES — the sign convention comes from
 * `center_student_finance`, and flipping it for display without flipping the
 * label is how a debt becomes a credit on a page nobody can log into to correct.
 * ⚠️ Cancelled/waived charges are shown as their own status rather than dropped:
 * a parent who was told "that month was waived" should see it said so.
 */
async function buildFinance(centerId: string, studentId: string): Promise<ParentFinanceBlock> {
  const [profileSnap, chargesSnap, paymentsSnap] = await Promise.all([
    adminDb.collection('center_student_finance').doc(`${centerId}_${studentId}`).get(),
    adminDb
      .collection('center_charges')
      .where('centerId', '==', centerId)
      .where('studentId', '==', studentId)
      .orderBy('periodStart', 'desc')
      .limit(12)
      .get(),
    adminDb
      .collection('center_payments')
      .where('centerId', '==', centerId)
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get(),
  ]);

  const profile = profileSnap.exists ? (profileSnap.data() as { balance?: number }) : null;

  const charges = chargesSnap.docs.map((d) => {
    const c = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: String(c.classTitle || ''),
      periodKey: String(c.periodKey || ''),
      amount: Number(c.amount ?? 0) || 0,
      paidAmount: Number(c.paidAmount ?? 0) || 0,
      status: String(c.status || 'pending'),
      dueDate: String(c.dueDate || ''),
    };
  });

  const open = charges.filter((c) => c.status === 'pending' || c.status === 'partial');
  const openAmount = open.reduce((sum, c) => sum + Math.max(0, c.amount - c.paidAmount), 0);
  const nextDueDate =
    open
      .map((c) => c.dueDate)
      .filter(Boolean)
      .sort()[0] ?? null;

  const payments = paymentsSnap.docs
    // A cancelled payment is not money the family paid — it must not appear as a
    // receipt on a page they will read as one. Filtered BEFORE mapping, so the
    // status never reaches the shape the parent receives.
    .filter((d) => String((d.data() as { status?: string }).status || 'confirmed') === 'confirmed')
    .map((d) => {
      const p = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        amount: Number(p.amount ?? 0) || 0,
        paidAt: String(p.paidAt || ''),
        method: String(p.method || ''),
      };
    });

  return {
    balance: Number(profile?.balance ?? 0) || 0,
    openAmount,
    nextDueDate,
    charges,
    payments,
  };
}
