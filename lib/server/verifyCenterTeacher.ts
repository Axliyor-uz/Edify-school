import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Thrown when the caller of an /api/teacher/* route fails a check.
 * `status` maps directly to the HTTP status the route should respond with.
 * Messages are user-facing (Uzbek) — they surface in teacher-panel toasts.
 */
export class TeacherApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies `Authorization: Bearer <idToken>` and resolves the caller's center
 * from `center_teachers/{uid}` — the server-side twin of the `isTeacherOfCenter()`
 * rules helper.
 *
 * ⚠️ The link doc is the security boundary, NOT `users/{uid}.centerId`. The user
 * doc is client-writable, so its `centerId`/`role` are attacker-controlled hints;
 * `center_teachers` is writable only by an active center manager (rules) and its
 * **doc id must equal the teacher uid** (rules-enforced), which is exactly what
 * makes `doc(uid)` a trustworthy lookup. Never relax this to the user doc.
 *
 * Returns `centerId: null` for a teacher who simply isn't linked to any center —
 * that is a normal state (most teachers are solo), so callers should answer with
 * an empty payload, never an error.
 */
export async function requireCenterTeacher(
  request: Request,
): Promise<{ uid: string; centerId: string | null }> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new TeacherApiError('Avtorizatsiya talab qilinadi.', 401);

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    throw new TeacherApiError('Sessiya muddati tugagan. Qaytadan kiring.', 401);
  }

  const linkSnap = await adminDb.collection('center_teachers').doc(uid).get();
  const centerId = linkSnap.exists ? (linkSnap.data()!.centerId as string) || null : null;

  return { uid, centerId };
}
