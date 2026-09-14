// IELTS data layer. Client SDK for teacher/admin authoring and reads; the graded student
// submission path goes through /api/ielts/* (server holds the answer key).
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getCountFromServer,
  getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { applyUserXp, mirrorLeaderboards, notifyLevelUp } from '@/lib/xp';
import { extractAnswerKey, renumberTest, stripAnswers, typeBreakdown } from '@/lib/ielts/testSchema';
import type {
  IeltsAssignment, IeltsCatalogControls, IeltsListeningTest, IeltsReadingTest, IeltsSkill,
  IeltsSpeakingTest, IeltsWritingCriteria, IeltsWritingTest,
} from '@/lib/ielts/types';

const TEST_COLLECTIONS: Record<IeltsSkill, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

// ---------- platform catalog: admin-managed order + per-audience visibility ----------

/** Who is looking at the platform dataset. `all` = the admin panel (sees everything). */
export type CatalogAudience = 'student' | 'teacher' | 'all';

const CATALOG_KEYS = ['catalogOrder', 'hiddenFromStudents', 'hiddenFromTeachers'] as const;

/** Carry admin catalog controls across a re-save (the builders never send them). */
function carryCatalog(existing: Record<string, unknown> | undefined): IeltsCatalogControls {
  const out: IeltsCatalogControls = {};
  if (!existing) return out;
  for (const k of CATALOG_KEYS) {
    const v = existing[k];
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function isVisibleTo(row: Record<string, unknown>, audience: CatalogAudience): boolean {
  if (audience === 'student') return row.hiddenFromStudents !== true;
  if (audience === 'teacher') return row.hiddenFromTeachers !== true;
  return true;
}

/** Admin order first (dense, 0-based); anything unordered falls to the end, A→Z. */
export function compareCatalog(a: unknown, b: unknown): number {
  const x = (a ?? {}) as { catalogOrder?: unknown; test_title?: unknown };
  const y = (b ?? {}) as { catalogOrder?: unknown; test_title?: unknown };
  const xo = typeof x.catalogOrder === 'number' ? x.catalogOrder : Number.MAX_SAFE_INTEGER;
  const yo = typeof y.catalogOrder === 'number' ? y.catalogOrder : Number.MAX_SAFE_INTEGER;
  if (xo !== yo) return xo - yo;
  return String(x.test_title || '').localeCompare(String(y.test_title || ''));
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in.');
  return user.getIdToken();
}

/** Client-side mirror of the API's structured errors — branch on `code`, never on message text. */
export class IeltsClientError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await idToken();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new IeltsClientError(
      data.error || `Request failed (${res.status})`,
      data.code || 'SERVER_ERROR',
      res.status,
    );
  }
  return data as T;
}

// ---------- authoring (reading / listening) ----------

/**
 * Save a reading or listening test with the answer-key split: the public doc gets
 * `answers_split: true` and no correct_answer anywhere; the key goes to ielts_answer_keys.
 * `asPlatform` (admin dataset) writes teacherId: null + source: 'platform'.
 */
export async function saveIeltsTest(
  testData: IeltsReadingTest | IeltsListeningTest,
  opts?: { asPlatform?: boolean },
) {
  const uid = requireUid();
  renumberTest(testData);
  const keys = extractAnswerKey(testData);
  const publicDoc = stripAnswers(testData);
  const skill = testData.module;
  const owner = opts?.asPlatform ? null : uid;

  const testRef = doc(db, TEST_COLLECTIONS[skill], testData.test_id);
  const keyRef = doc(db, 'ielts_answer_keys', testData.test_id);
  const existing = await getDoc(testRef);
  // Order/visibility are admin state, not authoring state — a re-save must not reset them.
  const catalog = carryCatalog(existing.data());

  const batch = writeBatch(db);
  batch.set(testRef, {
    ...publicDoc,
    ...catalog,
    teacherId: owner,
    source: opts?.asPlatform ? 'platform' : 'teacher',
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'published',
  });
  batch.set(keyRef, { testId: testData.test_id, teacherId: owner, skill, keys });
  // Lightweight library-card summary (never contains answers) — list pages read this
  // instead of downloading every passage/part. Old tests get one on re-save.
  batch.set(doc(db, 'ielts_test_meta', testData.test_id), {
    ...catalog,
    testId: testData.test_id,
    skill,
    test_title: testData.test_title || '',
    teacherId: owner,
    source: opts?.asPlatform ? 'platform' : 'teacher',
    ...(testData.test_category ? { test_category: testData.test_category } : {}),
    total_questions: testData.total_questions || 0,
    total_time_minutes: testData.total_time_minutes || 0,
    typeBreakdown: typeBreakdown(testData),
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { success: true, testId: testData.test_id };
}

/** Load a test WITH its inline answers for editing (owner/admin only — key doc is teacher-read). */
export async function loadTestForEdit(skill: IeltsSkill, testId: string) {
  const [testSnap, keySnap] = await Promise.all([
    getDoc(doc(db, TEST_COLLECTIONS[skill], testId)),
    getDoc(doc(db, 'ielts_answer_keys', testId)),
  ]);
  if (!testSnap.exists()) throw new Error('Test not found');
  const test = testSnap.data() as IeltsReadingTest | IeltsListeningTest;
  if (keySnap.exists()) {
    const keys = keySnap.data().keys || {};
    const containers = test.module === 'listening'
      ? (test.parts || []).map((p) => p.questions)
      : (test.passages || []).map((p) => p.questions);
    for (const blocks of containers) {
      for (const qb of blocks || []) {
        for (const row of qb.questions || []) {
          const k = keys[String(row.question_number)];
          if (k) row.correct_answer = k.a;
        }
      }
    }
  }
  return test;
}

export async function deleteIeltsTest(skill: IeltsSkill, testId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, TEST_COLLECTIONS[skill], testId));
  batch.delete(doc(db, 'ielts_answer_keys', testId));
  batch.delete(doc(db, 'ielts_test_meta', testId));
  await batch.commit();
}

// ---------- writing / speaking authoring ----------

async function saveWSTest(
  skill: 'writing' | 'speaking',
  t: (Partial<IeltsWritingTest> | Partial<IeltsSpeakingTest>) & { test_id: string },
  opts?: { asPlatform?: boolean },
) {
  const uid = requireUid();
  const owner = opts?.asPlatform ? null : uid;
  const source = opts?.asPlatform ? 'platform' : 'teacher';
  const ref = doc(db, TEST_COLLECTIONS[skill], t.test_id);
  const existing = await getDoc(ref);
  const createdAt = existing.exists() ? existing.data().createdAt : serverTimestamp();
  const catalog = carryCatalog(existing.data());
  const batch = writeBatch(db);
  batch.set(ref, {
    ...t,
    ...catalog,
    module: skill,
    teacherId: owner,
    source,
    createdAt,
    updatedAt: serverTimestamp(),
    status: 'published',
  });
  batch.set(doc(db, 'ielts_test_meta', t.test_id), {
    ...catalog,
    testId: t.test_id,
    skill,
    test_title: (t as { test_title?: string }).test_title || '',
    teacherId: owner,
    source,
    total_questions: (t as { total_questions?: number }).total_questions || 0,
    total_time_minutes: (t as { total_time_minutes?: number }).total_time_minutes || 0,
    createdAt,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export const saveWritingTest = (t: Partial<IeltsWritingTest> & { test_id: string }, opts?: { asPlatform?: boolean }) =>
  saveWSTest('writing', t, opts);

export const saveSpeakingTest = (t: Partial<IeltsSpeakingTest> & { test_id: string }, opts?: { asPlatform?: boolean }) =>
  saveWSTest('speaking', t, opts);

// ---------- libraries ----------

export async function fetchTeacherTests(skill: IeltsSkill, teacherId: string) {
  const snap = await getDocs(query(collection(db, TEST_COLLECTIONS[skill]), where('teacherId', '==', teacherId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ({ id: string } & Record<string, unknown>)[];
}

/**
 * Full platform test docs. `audience` applies the admin catalog: teachers never see a
 * test flagged `hiddenFromTeachers`, and everything comes back in the admin's order.
 * The admin panel passes `all` so it can manage hidden entries too.
 */
export async function fetchPlatformTests(skill: IeltsSkill, opts?: { audience?: CatalogAudience }) {
  const audience = opts?.audience ?? 'all';
  const snap = await getDocs(query(collection(db, TEST_COLLECTIONS[skill]), where('source', '==', 'platform')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { id: string } & Record<string, unknown>)
    .filter((t) => isVisibleTo(t, audience))
    .sort(compareCatalog);
}

/** Library-card shape shared by the meta path and the full-doc fallback. */
export interface PlatformTestSummary {
  id: string;
  test_title: string;
  total_questions: number;
  total_time_minutes: number;
  typeBreakdown: Record<string, number>;
  catalogOrder?: number;
  hiddenFromStudents?: boolean;
  hiddenFromTeachers?: boolean;
}

/**
 * Platform library summaries — reads ielts_test_meta (tiny docs) instead of every full
 * test. Legacy tests have no meta until re-saved, so a server-side count guards the
 * switch: any mismatch falls back to the old full-doc fetch (correctness over speed).
 * Filtering/sorting happens client-side on purpose: the catalog is admin-sized (tens of
 * docs) and a `where('hiddenFromStudents','!=',true)` query would drop legacy docs that
 * have no such field at all.
 */
export async function fetchPlatformTestSummaries(
  skill: IeltsSkill,
  opts?: { audience?: CatalogAudience },
): Promise<PlatformTestSummary[]> {
  const audience = opts?.audience ?? 'student';
  const shape = (m: Record<string, unknown>, id: string, breakdown: Record<string, number>): PlatformTestSummary => ({
    id,
    test_title: String(m.test_title || id),
    total_questions: Number(m.total_questions) || 0,
    total_time_minutes: Number(m.total_time_minutes) || 0,
    typeBreakdown: breakdown,
    ...(typeof m.catalogOrder === 'number' ? { catalogOrder: m.catalogOrder } : {}),
    ...(m.hiddenFromStudents === true ? { hiddenFromStudents: true } : {}),
    ...(m.hiddenFromTeachers === true ? { hiddenFromTeachers: true } : {}),
  });

  try {
    const [metaSnap, countSnap] = await Promise.all([
      getDocs(query(collection(db, 'ielts_test_meta'),
        where('skill', '==', skill), where('source', '==', 'platform'))),
      getCountFromServer(query(collection(db, TEST_COLLECTIONS[skill]), where('source', '==', 'platform'))),
    ]);
    if (metaSnap.size >= countSnap.data().count) {
      return metaSnap.docs
        .map((d) => {
          const m = d.data();
          return shape(m, String(m.testId || d.id), (m.typeBreakdown as Record<string, number>) || {});
        })
        .filter((t) => isVisibleTo(t as unknown as Record<string, unknown>, audience))
        .sort(compareCatalog);
    }
  } catch { /* fall through to full fetch */ }
  const { typeBreakdown: computeBreakdown } = await import('@/lib/ielts/testSchema');
  const full = await fetchPlatformTests(skill, { audience });
  return full.map((t) => shape(
    t,
    t.id,
    (skill === 'reading' || skill === 'listening') ? computeBreakdown(t as never) : {},
  ));
}

/**
 * Admin: hide/show a platform test per audience. Writes the flags to BOTH the test doc
 * and its meta doc so the full-doc readers (teacher) and the meta readers (student
 * library) agree. Admin writes bypass rules via the super_admin god-mode wildcard.
 */
export async function setPlatformTestVisibility(
  skill: IeltsSkill,
  testId: string,
  patch: { hiddenFromStudents?: boolean; hiddenFromTeachers?: boolean },
) {
  const clean: Record<string, boolean> = {};
  if (typeof patch.hiddenFromStudents === 'boolean') clean.hiddenFromStudents = patch.hiddenFromStudents;
  if (typeof patch.hiddenFromTeachers === 'boolean') clean.hiddenFromTeachers = patch.hiddenFromTeachers;
  if (!Object.keys(clean).length) return;
  const batch = writeBatch(db);
  batch.set(doc(db, TEST_COLLECTIONS[skill], testId), clean, { merge: true });
  batch.set(doc(db, 'ielts_test_meta', testId), clean, { merge: true });
  await batch.commit();
}

/**
 * Admin: persist the display order of a skill's platform dataset. `orderedIds` is the
 * complete list in the wanted order — every entry is stamped with a dense 0-based
 * `catalogOrder` on both its test doc and its meta doc (2 writes per test; a Firestore
 * batch caps at 500, so this covers 250 tests per skill).
 */
export async function savePlatformTestOrder(skill: IeltsSkill, orderedIds: string[]) {
  if (!orderedIds.length) return;
  if (orderedIds.length > 250) throw new Error('Too many tests to reorder in one batch (max 250).');
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.set(doc(db, TEST_COLLECTIONS[skill], id), { catalogOrder: i }, { merge: true });
    batch.set(doc(db, 'ielts_test_meta', id), { catalogOrder: i }, { merge: true });
  });
  await batch.commit();
}

/** Admin: copy a teacher's test into the platform dataset (test + key). */
export async function promoteTestToPlatform(skill: 'reading' | 'listening' | 'writing' | 'speaking', testId: string) {
  const testSnap = await getDoc(doc(db, TEST_COLLECTIONS[skill], testId));
  if (!testSnap.exists()) throw new Error('Test not found');
  const batch = writeBatch(db);
  batch.set(doc(db, TEST_COLLECTIONS[skill], testId),
    { ...testSnap.data(), teacherId: null, source: 'platform', updatedAt: serverTimestamp() });
  const keySnap = await getDoc(doc(db, 'ielts_answer_keys', testId));
  if (keySnap.exists()) {
    batch.set(doc(db, 'ielts_answer_keys', testId), { ...keySnap.data(), teacherId: null });
  }
  const metaSnap = await getDoc(doc(db, 'ielts_test_meta', testId));
  if (metaSnap.exists()) {
    batch.set(doc(db, 'ielts_test_meta', testId), { ...metaSnap.data(), teacherId: null, source: 'platform' });
  }
  await batch.commit();
}

// ---------- groups: join / requests ----------

/**
 * 6-char join code (2.2B combinations — collisions practically impossible, and
 * /api/ielts/join returns 409 on the freak duplicate). Deliberately NO uniqueness
 * query: group reads are member/teacher-only now, so a joinCode == query from the
 * creating teacher would be denied by rules.
 */
export async function generateUniqueJoinCode(): Promise<string> {
  return 'I-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function joinGroupByCode(code: string) {
  return api<{ status: 'member' | 'pending' | 'requested'; groupTitle: string }>(
    '/api/ielts/join', { method: 'POST', body: JSON.stringify({ code }) },
  );
}

/** Approve a join request atomically (arrayUnion + request delete in one batch). */
export async function approveJoinRequest(groupId: string, requestId: string, studentId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ielts_groups', groupId), { studentIds: arrayUnion(studentId) });
  batch.delete(doc(db, 'ielts_groups', groupId, 'requests', requestId));
  await batch.commit();
}

export async function removeStudentFromGroup(groupId: string, studentId: string) {
  await updateDoc(doc(db, 'ielts_groups', groupId), { studentIds: arrayRemove(studentId) });
}

/**
 * Center-managed IELTS groups (docs/IELTS.md): the manager's roster write must hit
 * BOTH docs of the linked pair atomically — classes/{classId}.studentIds (the
 * source of truth for timetable/attendance/finance) and its ielts_groups mirror.
 * Rules: the manager branch on ielts_groups allows exactly this limited-key update.
 */
export async function managedRosterBatch(
  classId: string, ieltsGroupId: string, studentId: string, op: 'add' | 'remove',
) {
  const fv = op === 'add' ? arrayUnion(studentId) : arrayRemove(studentId);
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', classId), { studentIds: fv });
  batch.update(doc(db, 'ielts_groups', ieltsGroupId), { studentIds: fv });
  await batch.commit();
}

// ---------- assignments ----------

export async function createAssignment(groupId: string, a: Omit<IeltsAssignment, 'createdAt' | 'status' | 'completedBy'>) {
  const payload: Record<string, unknown> = {
    ...a,
    openAt: a.openAt ?? null,
    dueAt: a.dueAt ?? null,
    createdAt: serverTimestamp(),
    status: 'active',
    completedBy: [],
  };
  const ref = await addDoc(collection(db, 'ielts_groups', groupId, 'assignments'), payload);
  return ref.id;
}

export async function deleteAssignment(groupId: string, assignmentId: string) {
  await deleteDoc(doc(db, 'ielts_groups', groupId, 'assignments', assignmentId));
}

export async function fetchAssignments(groupId: string) {
  const snap = await getDocs(query(
    collection(db, 'ielts_groups', groupId, 'assignments'), orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IeltsAssignment) }));
}

// ---------- attempts ----------

export interface SubmitPayload {
  kind: 'assignment' | 'practice';
  groupId?: string;
  assignmentId?: string;
  testId: string;
  skill: IeltsSkill;
  mode?: 'simulation' | 'practice';
  answers?: Record<string, string | string[]>;
  writing?: { task1Text: string; task2Text: string };
  speaking?: { part1AudioUrl?: string; part2AudioUrl?: string; part3AudioUrl?: string };
  tabSwitches: number;
  timeSpentSeconds: number;
  startedAt: number;
}

export interface SubmitResult {
  attemptId: string;
  rawScore?: number;
  totalQuestions?: number;
  bandScore?: number;
  typeStats?: Record<string, { correct: number; total: number }>;
  perQuestion?: Record<string, { correct: boolean; type: string }>;
  resultsVisible?: boolean;
  pendingReview?: boolean;
  xpSuggested: number;
}

/** Submit via the server grading boundary, then apply XP client-side (regular-runner pattern). */
export async function submitIeltsAttempt(payload: SubmitPayload): Promise<SubmitResult> {
  const result = await api<SubmitResult>('/api/ielts/submit', {
    method: 'POST', body: JSON.stringify(payload),
  });
  if (result.xpSuggested > 0) {
    try {
      const uid = requireUid();
      const userRef = doc(db, 'users', uid);
      const xpRes = await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        const r = applyUserXp(tx, userRef, userSnap, {
          xp: result.xpSuggested,
          breakdown: [`IELTS ${payload.skill}: +${result.xpSuggested}`],
          activityEntry: {
            type: 'ielts', skill: payload.skill, testId: payload.testId,
            ...(result.bandScore != null ? { band: result.bandScore } : {}),
            date: new Date().toISOString(),
          },
          activityLimit: 5,
        });
        mirrorLeaderboards(tx, uid, r.finalXp, { displayName: r.latestName, avatar: r.latestAvatar }, []);
        return r;
      });
      if (xpRes.leveledUp) notifyLevelUp(uid, xpRes.newLevel);
    } catch (e) {
      console.error('IELTS XP apply failed (attempt already saved):', e);
    }
  }
  return result;
}

export async function fetchReview(attemptId: string) {
  return api<{ attempt: Record<string, unknown>; correctAnswers?: Record<string, string | string[]> }>(
    `/api/ielts/review?attemptId=${encodeURIComponent(attemptId)}`,
  );
}

export async function fetchMyAttempts(userId: string, opts?: { testId?: string; groupId?: string }) {
  const clauses = [where('userId', '==', userId)] as Parameters<typeof query>[1][];
  if (opts?.testId) clauses.push(where('testId', '==', opts.testId));
  if (opts?.groupId) clauses.push(where('groupId', '==', opts.groupId));
  const snap = await getDocs(query(collection(db, 'ielts_attempts'), ...clauses as never[]));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((b.submittedAt as { toMillis?: () => number })?.toMillis?.() || 0)
      - ((a.submittedAt as { toMillis?: () => number })?.toMillis?.() || 0));
}

export async function fetchGroupAttempts(groupId: string) {
  const snap = await getDocs(query(collection(db, 'ielts_attempts'), where('groupId', '==', groupId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Cross-group grading queue: pending W/S reviews across the teacher's groups.
 *  Per-group queries keep the rules' groupId-equality check provable. */
export async function fetchPendingReviews(groupIds: string[]) {
  const all = await Promise.all(groupIds.map(async (gid) => {
    const snap = await getDocs(query(
      collection(db, 'ielts_attempts'),
      where('groupId', '==', gid),
      where('reviewStatus', '==', 'pending_review'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));
  return all.flat();
}

/** Teacher grades a writing/speaking attempt. Criteria sub-scores (writing rubric) are optional. */
export async function gradeWSAttempt(
  attemptId: string,
  band: number,
  comments: string,
  criteria?: IeltsWritingCriteria,
) {
  await updateDoc(doc(db, 'ielts_attempts', attemptId), {
    reviewStatus: 'graded',
    teacherGrade: {
      band, comments, gradedAt: serverTimestamp(),
      ...(criteria ? { criteria } : {}), // never write undefined to Firestore
    },
  });
}

/** Practice self-check: per-question correctness for the answers given so far (platform tests only). */
export async function checkPracticeAnswers(
  testId: string,
  skill: 'reading' | 'listening',
  answers: Record<string, string | string[]>,
) {
  return api<{ perQuestion: Record<string, { correct: boolean; type: string }>; checked: number }>(
    '/api/ielts/check', { method: 'POST', body: JSON.stringify({ testId, skill, answers }) },
  );
}

export interface AiWritingEstimate {
  band: number;
  criteria: IeltsWritingCriteria;
  feedback: { uz: string; ru: string; en: string };
  model: string;
  createdAt: unknown;
}

/** AI first-pass writing estimate (cached on the attempt server-side — safe to call repeatedly). */
export async function analyzeWritingAttempt(attemptId: string) {
  return api<{ aiEstimate: AiWritingEstimate; cached?: boolean }>(
    '/api/ielts/analyze-writing', { method: 'POST', body: JSON.stringify({ attemptId }) },
  );
}
