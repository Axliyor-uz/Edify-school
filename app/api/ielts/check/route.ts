// POST /api/ielts/check — practice-mode self-check. Grades the answers given so far and
// returns per-question correctness WITHOUT accepted answers, so the key never reaches the
// client pre-submit. Platform (self-practice) tests only — assignment tests are excluded so
// a teacher's simulation/practice windows can't be probed before submitting.
import { gradeAttempt } from '@/lib/ielts/grading';
import { IeltsApiError, jsonError, loadAnswerKey, requireUser } from '@/lib/server/ieltsRoute';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = await request.json();
    const { testId, skill, answers } = body || {};
    if (!testId || (skill !== 'reading' && skill !== 'listening')) {
      throw new IeltsApiError('testId/skill noto‘g‘ri.', 400);
    }
    if (!answers || typeof answers !== 'object') throw new IeltsApiError('answers yetishmayapti.', 400);

    const { keys, testData } = await loadAnswerKey(testId, skill);
    if (testData.source !== 'platform') {
      throw new IeltsApiError('Tekshirish faqat platforma testlarida ishlaydi.', 403);
    }

    const result = gradeAttempt({ keys }, answers);
    // Only echo correctness for questions the student actually answered. list_selection spans
    // store the letter array under the base qn — expose one span number per selected letter.
    const answeredQns = new Set<string>();
    for (const [qn, entry] of Object.entries(keys)) {
      const a = (answers as Record<string, unknown>)[qn];
      if (entry.span && entry.span > 1) {
        const n = Array.isArray(a) ? Math.min(a.length, entry.span) : 0;
        for (let i = 0; i < n; i++) answeredQns.add(String(Number(qn) + i));
      } else if (Array.isArray(a) ? a.length > 0 : a !== undefined && a !== '') {
        answeredQns.add(qn);
      }
    }
    const perQuestion: Record<string, { correct: boolean; type: string }> = {};
    for (const [qn, r] of Object.entries(result.perQuestion)) {
      if (answeredQns.has(qn)) perQuestion[qn] = r;
    }
    return Response.json({ perQuestion, checked: Object.keys(perQuestion).length });
  } catch (e) {
    return jsonError(e);
  }
}
