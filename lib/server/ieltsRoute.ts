import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { extractAnswerKey } from '@/lib/ielts/testSchema';
import type { IeltsAnswerKeyDoc } from '@/lib/ielts/types';

// Stable machine-readable codes — clients branch on `code`, never on the (Uzbek) message text.
export type IeltsApiErrorCode =
  | 'AUTH_REQUIRED' | 'SESSION_EXPIRED' | 'BAD_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN'
  | 'NOT_MEMBER' | 'NOT_ASSIGNED' | 'NOT_OPEN' | 'PAST_DUE' | 'NO_ATTEMPTS_LEFT'
  | 'RESULTS_HIDDEN' | 'RESULTS_AFTER_DUE' | 'DUPLICATE_CODE' | 'LIMIT_REACHED'
  | 'CENTER_MANAGED' | 'SERVER_ERROR';

export class IeltsApiError extends Error {
  status: number;
  code: IeltsApiErrorCode;
  constructor(message: string, status: number, code?: IeltsApiErrorCode) {
    super(message);
    this.status = status;
    this.code = code
      || (status === 400 ? 'BAD_REQUEST' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR');
  }
}

/** Verify Authorization: Bearer <idToken>. Any signed-in user; per-route checks follow. */
export async function requireUser(request: Request): Promise<{ uid: string }> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new IeltsApiError('Avtorizatsiya talab qilinadi.', 401, 'AUTH_REQUIRED');
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return { uid: decoded.uid };
  } catch {
    throw new IeltsApiError('Sessiya muddati tugagan. Qaytadan kiring.', 401, 'SESSION_EXPIRED');
  }
}

export const TEST_COLLECTIONS: Record<string, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

/** Load the answer key for a graded skill. Prefers ielts_answer_keys; falls back to
 * extracting inline answers from legacy test docs that were never re-saved. */
export async function loadAnswerKey(
  testId: string,
  skill: 'reading' | 'listening',
): Promise<{ keys: IeltsAnswerKeyDoc['keys']; testData: FirebaseFirestore.DocumentData }> {
  const testSnap = await adminDb.collection(TEST_COLLECTIONS[skill]).doc(testId).get();
  if (!testSnap.exists) throw new IeltsApiError('Test topilmadi.', 404);
  const testData = testSnap.data()!;

  const keySnap = await adminDb.collection('ielts_answer_keys').doc(testId).get();
  if (keySnap.exists) {
    return { keys: (keySnap.data() as IeltsAnswerKeyDoc).keys || {}, testData };
  }
  // Legacy fallback — answers still inline in the test doc.
  const keys = extractAnswerKey(testData as never);
  if (!Object.keys(keys).length) throw new IeltsApiError('Test javoblari topilmadi.', 500);
  return { keys, testData };
}

export function jsonError(e: unknown): Response {
  if (e instanceof IeltsApiError) {
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error('IELTS API error:', e);
  return Response.json({ error: 'Server xatosi. Qayta urinib ko‘ring.', code: 'SERVER_ERROR' }, { status: 500 });
}
