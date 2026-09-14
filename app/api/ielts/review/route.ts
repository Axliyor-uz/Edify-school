// GET /api/ielts/review?attemptId= — graded detail + correct answers for review mode,
// gated by the assignment's resultsVisibility (owner) or teacher ownership of the group.
import { adminDb } from '@/lib/firebaseAdmin';
import { IeltsApiError, jsonError, loadAnswerKey, requireUser } from '@/lib/server/ieltsRoute';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const attemptId = new URL(request.url).searchParams.get('attemptId') || '';
    if (!attemptId) throw new IeltsApiError('attemptId yetishmayapti.', 400);

    const snap = await adminDb.collection('ielts_attempts').doc(attemptId).get();
    if (!snap.exists) throw new IeltsApiError('Urinish topilmadi.', 404);
    const attempt = snap.data()!;

    let isTeacher = false;
    if (attempt.groupId) {
      const g = await adminDb.collection('ielts_groups').doc(attempt.groupId).get();
      isTeacher = g.exists && g.data()!.teacherId === uid;
    }
    if (attempt.userId !== uid && !isTeacher) throw new IeltsApiError('Ruxsat yo‘q.', 403);

    // Visibility gate for the student on assignment attempts
    if (!isTeacher && attempt.kind === 'assignment') {
      const aSnap = await adminDb.collection('ielts_groups').doc(attempt.groupId)
        .collection('assignments').doc(attempt.assignmentId).get();
      const vis = aSnap.exists ? (aSnap.data()!.resultsVisibility || 'always') : 'always';
      const dueMs = aSnap.exists ? (aSnap.data()!.dueAt?.toMillis?.() ?? null) : null;
      if (vis === 'never') throw new IeltsApiError('Natijalar yopiq.', 403, 'RESULTS_HIDDEN');
      if (vis === 'after_due' && (!dueMs || Date.now() < dueMs)) {
        throw new IeltsApiError('Natijalar muddat tugagach ochiladi.', 403, 'RESULTS_AFTER_DUE');
      }
    }

    const payload: Record<string, unknown> = { attempt: { ...attempt, id: snap.id } };
    if (attempt.skill === 'reading' || attempt.skill === 'listening') {
      const { keys } = await loadAnswerKey(attempt.testId, attempt.skill);
      // Only the accepted answers — enough for "your answer vs correct answer" + Locate.
      payload.correctAnswers = Object.fromEntries(
        Object.entries(keys).map(([qn, k]) => [qn, k.a]),
      );
    }
    return Response.json(payload);
  } catch (e) {
    return jsonError(e);
  }
}
