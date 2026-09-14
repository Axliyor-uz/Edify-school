// app/api/manager/parent-links/route.ts
//
// The manager's half of **parent access** (docs/PARENTS.md): list the QR links a
// center has issued, and issue a new one.
//
// ⚠️ `parent_links` is `read, write: if false` in firestore.rules — the Admin SDK
// is the only writer and this route is the only door. `requireActiveCenterManager`
// is what proves the caller owns the center; `users.role`/`centerId` are
// client-writable hints and prove nothing (see lib/server/verifyCenterManager.ts).

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';
import {
  cleanParentLabel,
  generateParentToken,
  normalizeParentScope,
} from '@/lib/parentLinks';
import type { ParentLink } from '@/types/Parent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A center's whole parent-link list in one query — one row per issued QR. */
const LIST_LIMIT = 500;

/**
 * Is this student the center's to expose?
 *
 * ⚠️ **Two independent proofs, either is enough**, and they mirror the panel's own
 * roster derivation (docs/MANAGER.md): a `center_students` link doc, or membership
 * of a class carrying this `centerId`. A student can legitimately be in a center
 * with no groups ("Guruhsiz"), and a legacy class-enrolled student may still have
 * no link doc — refusing either would refuse a real student.
 */
async function assertStudentInCenter(centerId: string, studentId: string): Promise<string> {
  const [linkSnap, userSnap] = await Promise.all([
    adminDb.collection('center_students').doc(`${centerId}_${studentId}`).get(),
    adminDb.collection('users').doc(studentId).get(),
  ]);

  if (!userSnap.exists || (userSnap.data() as { role?: string }).role !== 'student') {
    throw new ManagerApiError("O'quvchi topilmadi.", 404);
  }

  if (!linkSnap.exists) {
    const classes = await adminDb
      .collection('classes')
      .where('studentIds', 'array-contains', studentId)
      .get();
    const inCenter = classes.docs.some((d) => (d.data() as { centerId?: string }).centerId === centerId);
    if (!inCenter) throw new ManagerApiError("Bu o'quvchi sizning markazingizda emas.", 403);
  }

  return String((userSnap.data() as { displayName?: string }).displayName || '');
}

/**
 * GET /api/manager/parent-links[?studentId=…]
 *
 * ⚠️ Sorted in MEMORY, not by Firestore: `centerId ==` alone rides the automatic
 * single-field index, while `centerId + createdAt desc` would need a composite
 * one deployed before this route works at all. One QR per parent per student caps
 * the list far below `LIST_LIMIT`.
 */
export async function GET(request: Request) {
  try {
    const { centerId } = await requireActiveCenterManager(request);
    const studentId = new URL(request.url).searchParams.get('studentId') || '';

    let query = adminDb.collection('parent_links').where('centerId', '==', centerId);
    if (studentId) query = query.where('studentId', '==', studentId);

    const snap = await query.limit(LIST_LIMIT).get();
    const links = snap.docs
      .map((d) => ({ ...(d.data() as ParentLink), token: d.id }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ links });
  } catch (err) {
    const e = err as ManagerApiError;
    return NextResponse.json({ error: e.message || 'Xatolik.' }, { status: e.status || 500 });
  }
}

/**
 * POST /api/manager/parent-links — issue a QR for one student.
 *
 * Body: `{ studentId, label?, scope? }`.
 *
 * ⚠️ **ONE CHILD ⇒ ONE CONNECTED PERSON.** Issuing a link REVOKES every other
 * active link for that student, in the same batch. That is the rule enforced
 * here rather than left to the manager remembering to revoke the old one — and
 * it is what makes "issue a new QR" the recovery path when a parent loses their
 * phone: the new card works, the old one dies the moment it is printed.
 *
 * ⚠️ It also means the button is destructive, so the dialog warns before pressing
 * it when a live link exists.
 *
 * ⚠️ The token is generated here and written as the DOCUMENT ID with `create()`,
 * so a collision (≈2⁻¹¹⁶) fails loudly instead of silently overwriting somebody
 * else's link and pointing their QR at a different child.
 */
export async function POST(request: Request) {
  try {
    const { uid, centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const studentId = String(body?.studentId || '').trim();
    if (!studentId) throw new ManagerApiError("O'quvchi tanlanmagan.", 400);

    const studentName = await assertStudentInCenter(centerId, studentId);

    // Every live link this child already has — they are about to be replaced.
    const existing = await adminDb
      .collection('parent_links')
      .where('centerId', '==', centerId)
      .where('studentId', '==', studentId)
      .where('status', '==', 'active')
      .get();

    const token = generateParentToken();
    const link: ParentLink = {
      token,
      centerId,
      studentId,
      studentName,
      label: cleanParentLabel(body?.label),
      status: 'active',
      scope: normalizeParentScope(body?.scope),
      createdAt: Date.now(),
      createdBy: uid,
      viewCount: 0,
    };

    // ⚠️ ONE batch: the old links must not survive a failure that also created
    // the new one, or the child ends up with two connected people — precisely
    // what this rule exists to prevent.
    const batch = adminDb.batch();
    for (const doc of existing.docs) {
      batch.update(doc.ref, { status: 'revoked', revokedAt: Date.now() });
    }
    batch.create(adminDb.collection('parent_links').doc(token), link);
    await batch.commit();

    return NextResponse.json({ link, replaced: existing.size });
  } catch (err) {
    const e = err as ManagerApiError;
    return NextResponse.json({ error: e.message || 'Xatolik.' }, { status: e.status || 500 });
  }
}
