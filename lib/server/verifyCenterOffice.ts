import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { isOfficeRole, type OfficeRole } from '@/types/office';

/**
 * Thrown when the caller of an office-facing route fails a check.
 * `status` maps directly to the HTTP status the route should respond with.
 * Messages are user-facing (Uzbek) — they surface in office-panel toasts.
 */
export class OfficeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface OfficeContext {
  uid: string;
  centerId: string;
  staffRole: OfficeRole;
}

/**
 * Verifies `Authorization: Bearer <idToken>` and resolves the caller's center
 * from `center_staff/{uid}` — the server-side twin of the `isCenterOffice()`
 * rules helper (docs/OFFICE.md).
 *
 * ⚠️ The link doc is the security boundary, NOT `users/{uid}.role`/`.centerId`.
 * The user doc is client-writable, so anyone could set `role: 'accountant'` on
 * themselves and point `centerId` at a stranger's center; these routes use the
 * Admin SDK and bypass rules, so trusting it would hand every center's money to
 * any signed-in user. `center_staff` is `write: if false` for every client and
 * its **doc id must equal the staff uid** (rules-enforced), which is exactly
 * what makes `doc(uid)` trustworthy. Never relax this to the user doc.
 *
 * Also enforces the approval gate (`centers.status == 'active'`), matching
 * `requireActiveCenterManager`: a suspended center must not move money through
 * its accountant either.
 *
 * @param roles Optional allowlist. Omit to accept any office role; pass
 *              `['accountant']` for the record-money routes so a **director
 *              stays strictly read-only**.
 */
export async function requireCenterOffice(
  request: Request,
  roles?: OfficeRole[],
): Promise<OfficeContext> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new OfficeApiError('Avtorizatsiya talab qilinadi.', 401);

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    throw new OfficeApiError('Sessiya muddati tugagan. Qaytadan kiring.', 401);
  }

  const linkSnap = await adminDb.collection('center_staff').doc(uid).get();
  const link = linkSnap.exists ? linkSnap.data()! : null;
  const staffRole = link?.staffRole;
  const centerId: string = link?.centerId || '';
  if (!link || !centerId || !isOfficeRole(staffRole)) {
    throw new OfficeApiError('Ruxsat yoʻq.', 403);
  }
  if (roles && !roles.includes(staffRole)) {
    throw new OfficeApiError('Bu amal uchun ruxsatingiz yoʻq.', 403);
  }

  const centerSnap = await adminDb.collection('centers').doc(centerId).get();
  const center = centerSnap.exists ? centerSnap.data()! : null;
  if (!center) throw new OfficeApiError('Markaz topilmadi.', 403);
  if (center.status !== 'active') {
    throw new OfficeApiError('Markazingiz hali faollashtirilmagan.', 403);
  }

  return { uid, centerId, staffRole };
}
