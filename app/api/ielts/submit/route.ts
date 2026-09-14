// POST /api/ielts/submit — the server grading boundary. The answer key never reaches
// the student; grading, band conversion, and the attempt write all happen here.
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { gradeAttempt } from '@/lib/ielts/grading';
import { extrapolatedBand } from '@/lib/ielts/bands';
import {
  IeltsApiError, jsonError, loadAnswerKey, requireUser, TEST_COLLECTIONS,
} from '@/lib/server/ieltsRoute';

export const dynamic = 'force-dynamic';

const GRADED_SKILLS = new Set(['reading', 'listening']);
const WS_SKILLS = new Set(['writing', 'speaking']);

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    const {
      kind, groupId, assignmentId, skill, answers,
      tabSwitches = 0, timeSpentSeconds = 0, startedAt,
      writing, speaking,
    } = body || {};

    if (kind !== 'assignment' && kind !== 'practice') throw new IeltsApiError('kind noto‘g‘ri.', 400);
    if (!GRADED_SKILLS.has(skill) && !WS_SKILLS.has(skill)) throw new IeltsApiError('skill noto‘g‘ri.', 400);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userName = userSnap.exists
      ? (userSnap.data()!.displayName || userSnap.data()!.name || 'Student')
      : 'Student';

    let testId: string = body.testId;
    let mode: string = body.mode === 'simulation' ? 'simulation' : 'practice';
    let resultsVisibility = 'always';
    let allowedAttempts = Infinity;
    let assignmentRef: FirebaseFirestore.DocumentReference | null = null;
    let dueAtMs: number | null = null;

    if (kind === 'assignment') {
      if (!groupId || !assignmentId) throw new IeltsApiError('groupId/assignmentId yetishmayapti.', 400);
      const groupSnap = await adminDb.collection('ielts_groups').doc(groupId).get();
      if (!groupSnap.exists) throw new IeltsApiError('Guruh topilmadi.', 404);
      const group = groupSnap.data()!;
      if (!Array.isArray(group.studentIds) || !group.studentIds.includes(uid)) {
        throw new IeltsApiError('Siz bu guruh a’zosi emassiz.', 403, 'NOT_MEMBER');
      }
      assignmentRef = groupSnap.ref.collection('assignments').doc(assignmentId);
      const aSnap = await assignmentRef.get();
      if (!aSnap.exists) throw new IeltsApiError('Vazifa topilmadi.', 404);
      const a = aSnap.data()!;
      if (a.status && a.status !== 'active') throw new IeltsApiError('Vazifa faol emas.', 403);
      if (Array.isArray(a.assignedTo) && !a.assignedTo.includes(uid)) {
        throw new IeltsApiError('Bu vazifa sizga biriktirilmagan.', 403, 'NOT_ASSIGNED');
      }
      const now = Date.now();
      const openAtMs = a.openAt?.toMillis?.() ?? null;
      dueAtMs = a.dueAt?.toMillis?.() ?? null;
      if (openAtMs && now < openAtMs) throw new IeltsApiError('Vazifa hali ochilmagan.', 403, 'NOT_OPEN');
      if (dueAtMs && now > dueAtMs + 60_000) throw new IeltsApiError('Muddat tugagan.', 403, 'PAST_DUE');
      testId = a.testId; // never trust the client's testId for assignments
      mode = a.mode === 'simulation' ? 'simulation' : 'practice';
      resultsVisibility = a.resultsVisibility || 'always';
      allowedAttempts = a.allowedAttempts || 1;
      if (a.skill !== skill) throw new IeltsApiError('skill mos emas.', 400);
    }
    if (!testId) throw new IeltsApiError('testId yetishmayapti.', 400);

    // ---------- build the attempt payload ----------
    const base: Record<string, unknown> = {
      userId: uid,
      userName,
      kind,
      testId,
      skill,
      mode,
      tabSwitches: Number(tabSwitches) || 0,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      startedAt: typeof startedAt === 'number' ? new Date(startedAt) : FieldValue.serverTimestamp(),
      submittedAt: FieldValue.serverTimestamp(),
    };
    if (kind === 'assignment') {
      base.groupId = groupId;
      base.assignmentId = assignmentId;
    }

    let responsePayload: Record<string, unknown> = {};
    let xpSuggested = 0;

    if (GRADED_SKILLS.has(skill)) {
      if (!answers || typeof answers !== 'object') throw new IeltsApiError('answers yetishmayapti.', 400);
      const { keys, testData } = await loadAnswerKey(testId, skill);
      const result = gradeAttempt({ keys }, answers);
      const band = extrapolatedBand(
        result.rawScore, result.totalQuestions, skill,
        testData.test_category === 'general' ? 'general' : 'academic',
      );
      Object.assign(base, {
        answers,
        rawScore: result.rawScore,
        totalQuestions: result.totalQuestions,
        bandScore: band,
        perQuestion: result.perQuestion,
        typeStats: result.typeStats,
      });
      const showDetail = resultsVisibility === 'always'
        || (resultsVisibility === 'after_due' && dueAtMs != null && Date.now() > dueAtMs);
      responsePayload = {
        rawScore: result.rawScore,
        totalQuestions: result.totalQuestions,
        bandScore: band,
        typeStats: result.typeStats,
        ...(showDetail ? { perQuestion: result.perQuestion } : {}),
        resultsVisible: showDetail,
      };
      xpSuggested = result.rawScore + 10; // 1 XP per correct answer + completion bonus
    } else {
      // writing / speaking — stored for teacher review, no auto-grade
      const testSnap = await adminDb.collection(TEST_COLLECTIONS[skill]).doc(testId).get();
      if (!testSnap.exists) throw new IeltsApiError('Test topilmadi.', 404);
      if (skill === 'writing') {
        if (!writing?.task1Text && !writing?.task2Text) throw new IeltsApiError('Javob bo‘sh.', 400);
        const t1 = String(writing.task1Text || ''); const t2 = String(writing.task2Text || '');
        base.writing = {
          task1Text: t1, task2Text: t2,
          task1Words: t1.split(/\s+/).filter(Boolean).length,
          task2Words: t2.split(/\s+/).filter(Boolean).length,
        };
      } else {
        if (!speaking?.part1AudioUrl && !speaking?.part2AudioUrl && !speaking?.part3AudioUrl) {
          throw new IeltsApiError('Audio yozuv topilmadi.', 400);
        }
        const sp: Record<string, string> = {};
        for (const k of ['part1AudioUrl', 'part2AudioUrl', 'part3AudioUrl'] as const) {
          if (typeof speaking[k] === 'string' && speaking[k]) sp[k] = speaking[k];
        }
        base.speaking = sp;
      }
      base.reviewStatus = kind === 'assignment' ? 'pending_review' : 'graded'; // self-practice: nothing to grade
      responsePayload = { submitted: true, pendingReview: kind === 'assignment' };
      xpSuggested = 15;
    }

    // ---------- write ----------
    if (kind === 'assignment') {
      const attemptRef = adminDb.collection('ielts_attempts').doc(`${uid}_${groupId}_${assignmentId}`);
      await adminDb.runTransaction(async (tx) => {
        const prev = await tx.get(attemptRef);
        const attemptsTaken = (prev.exists ? prev.data()!.attemptsTaken || 0 : 0) + 1;
        if (attemptsTaken > allowedAttempts) throw new IeltsApiError('Urinishlar soni tugagan.', 403, 'NO_ATTEMPTS_LEFT');
        tx.set(attemptRef, { ...base, attemptsTaken, xpEarned: xpSuggested });
        tx.update(assignmentRef!, { completedBy: FieldValue.arrayUnion(uid) });
      });
      responsePayload.attemptId = attemptRef.id;
    } else {
      // practice: unlimited history; XP only for the first attempt on this test
      const prior = await adminDb.collection('ielts_attempts')
        .where('userId', '==', uid).where('testId', '==', testId)
        .where('kind', '==', 'practice').limit(1).get();
      if (!prior.empty) xpSuggested = 0;
      const ref = await adminDb.collection('ielts_attempts')
        .add({ ...base, attemptsTaken: 1, xpEarned: xpSuggested });
      responsePayload.attemptId = ref.id;
    }

    responsePayload.xpSuggested = xpSuggested;
    return Response.json(responsePayload);
  } catch (e) {
    return jsonError(e);
  }
}
