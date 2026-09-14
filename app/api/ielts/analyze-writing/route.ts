// POST /api/ielts/analyze-writing — Gemini first-pass band estimate for an IELTS writing
// attempt. Advisory only: `aiEstimate` is written next to (never over) `teacherGrade`.
// Caller: attempt owner (practice feedback) or the group teacher (grading pre-fill).
// Rate limit: server-owned per-day counter `ielts_ai_usage/{uid}_{YYYY-MM-DD}` (UTC, System-C
// pattern from docs/AI.md) — the estimate is cached on the attempt, so re-opens cost nothing.
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { IeltsApiError, jsonError, requireUser } from '@/lib/server/ieltsRoute';

export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';
const DAILY_LIMIT = Number(process.env.IELTS_AI_WRITING_DAILY_LIMIT || 5);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ta: { type: 'NUMBER' }, cc: { type: 'NUMBER' }, lr: { type: 'NUMBER' }, gra: { type: 'NUMBER' },
    feedback: {
      type: 'OBJECT',
      properties: { uz: { type: 'STRING' }, ru: { type: 'STRING' }, en: { type: 'STRING' } },
      required: ['uz', 'ru', 'en'],
    },
  },
  required: ['ta', 'cc', 'lr', 'gra', 'feedback'],
};

const clampBand = (n: unknown): number => {
  const v = Math.round(Number(n) * 2) / 2;
  return Number.isFinite(v) ? Math.min(9, Math.max(1, v)) : 5;
};

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { attemptId } = (await request.json()) || {};
    if (!attemptId || typeof attemptId !== 'string') throw new IeltsApiError('attemptId yetishmayapti.', 400);

    const attemptRef = adminDb.collection('ielts_attempts').doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) throw new IeltsApiError('Urinish topilmadi.', 404);
    const attempt = snap.data()!;
    if (attempt.skill !== 'writing') throw new IeltsApiError('Faqat writing urinishlari tahlil qilinadi.', 400);

    let isTeacher = false;
    if (attempt.groupId) {
      const g = await adminDb.collection('ielts_groups').doc(attempt.groupId).get();
      isTeacher = g.exists && g.data()!.teacherId === uid;
    }
    if (attempt.userId !== uid && !isTeacher) throw new IeltsApiError('Ruxsat yo‘q.', 403);

    // Cached — one Gemini call per attempt, ever.
    if (attempt.aiEstimate) return Response.json({ aiEstimate: attempt.aiEstimate, cached: true });

    const t1 = String(attempt.writing?.task1Text || '');
    const t2 = String(attempt.writing?.task2Text || '');
    if (!t1.trim() && !t2.trim()) throw new IeltsApiError('Insho matni bo‘sh.', 400);

    // Check daily limit BEFORE calling Gemini; increment only after a successful generation
    // (check → generate → deduct-actual, per docs/AI.md).
    const dateKey = new Date().toISOString().split('T')[0]; // UTC, System-C convention
    const usageRef = adminDb.collection('ielts_ai_usage').doc(`${uid}_${dateKey}`);
    const usage = await usageRef.get();
    if ((usage.exists ? usage.data()!.count || 0 : 0) >= DAILY_LIMIT) {
      throw new IeltsApiError('Bugungi AI tahlil limiti tugadi. Ertaga qayta urinib ko‘ring.', 429, 'LIMIT_REACHED');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new IeltsApiError('AI sozlanmagan.', 500);

    const testSnap = await adminDb.collection('ielts_writing_tests').doc(attempt.testId).get();
    const test = testSnap.exists ? testSnap.data()! : {};

    const prompt = [
      'You are a certified IELTS Writing examiner. Assess the candidate work below using the official',
      'IELTS Writing band descriptors. Score each criterion (Task Achievement/Response = ta,',
      'Coherence & Cohesion = cc, Lexical Resource = lr, Grammatical Range & Accuracy = gra)',
      'as a band from 1 to 9 in 0.5 steps. Be realistic and strict — do not inflate.',
      'Also write concise, actionable feedback (max 120 words per language): the 2–3 most',
      'important improvements, with one concrete example from the candidate\'s own text.',
      'Return feedback in Uzbek (uz), Russian (ru) and English (en).',
      '',
      t1.trim() ? `TASK 1 PROMPT:\n${test.task1?.prompt || '(not available)'}\n\nTASK 1 ANSWER (${attempt.writing?.task1Words || 0} words, minimum 150):\n${t1}` : 'TASK 1: not attempted.',
      '',
      t2.trim() ? `TASK 2 PROMPT:\n${test.task2?.prompt || '(not available)'}\n\nTASK 2 ANSWER (${attempt.writing?.task2Words || 0} words, minimum 250):\n${t2}` : 'TASK 2: not attempted.',
      '',
      'If a task is under the word minimum or not attempted, reflect that in ta as the official',
      'descriptors require.',
    ].join('\n');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );
    if (!res.ok) {
      console.error('Gemini analyze-writing failed:', res.status, await res.text().catch(() => ''));
      throw new IeltsApiError('AI tahlil vaqtincha ishlamayapti. Keyinroq urinib ko‘ring.', 502);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new IeltsApiError('AI javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.', 502);
    }

    const criteria = {
      ta: clampBand(parsed.ta), cc: clampBand(parsed.cc),
      lr: clampBand(parsed.lr), gra: clampBand(parsed.gra),
    };
    // Overall = mean of criteria, official .25/.75-rounds-up via doubled Math.round.
    const band = Math.round(((criteria.ta + criteria.cc + criteria.lr + criteria.gra) / 4) * 2) / 2;
    const fb = (parsed.feedback || {}) as Record<string, unknown>;
    const aiEstimate = {
      band,
      criteria,
      feedback: { uz: String(fb.uz || ''), ru: String(fb.ru || ''), en: String(fb.en || '') },
      model: MODEL,
      createdAt: FieldValue.serverTimestamp(),
    };

    await attemptRef.update({ aiEstimate });
    await usageRef.set(
      { count: FieldValue.increment(1), userId: uid, date: dateKey },
      { merge: true },
    );
    // serverTimestamp() isn't JSON-serializable meaningfully — echo with a client-usable stamp.
    return Response.json({ aiEstimate: { ...aiEstimate, createdAt: Date.now() } });
  } catch (e) {
    return jsonError(e);
  }
}
