import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError } from '@/lib/server/verifyCenterManager';
import { oversightDocId } from '@/types/branch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/manager/switch-branch — the ONLY place `users/{uid}.centerId` is
 * ever rewritten post-signup (docs/MANAGER.md § "Multi-branch owner view").
 * Body: { centerId }.
 *
 * `users.centerId` is locked against client UPDATE (only CREATE, at signup —
 * firestore.rules' privileged-field denylist, docs/AUTH.md), so switching
 * which branch a manager operates needs the Admin SDK.
 *
 * Verifies the caller has OVERSIGHT of the target branch — either they are
 * its direct `ownerUid`, or a `center_oversight` grant exists — then requires
 * the target to be `status:'active'` (the same approval-gate parity every
 * other manager-facing check has). Every existing `/api/manager/*` route and
 * every finance/attendance/roster rule needs ZERO changes after this: they
 * all just re-resolve against the new `centerId` the next time they're called.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) throw new ManagerApiError('Avtorizatsiya talab qilinadi.', 401);

    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(match[1])).uid;
    } catch {
      throw new ManagerApiError('Sessiya muddati tugagan. Qaytadan kiring.', 401);
    }

    const body = await request.json().catch(() => null);
    const targetCenterId = typeof body?.centerId === 'string' ? body.centerId.trim() : '';
    if (!targetCenterId) throw new ManagerApiError("Filial ko'rsatilmagan.", 400);

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data()! : null;
    if (!userData || userData.role !== 'manager') {
      throw new ManagerApiError('Menejer huquqi talab qilinadi.', 403);
    }

    const centerSnap = await adminDb.collection('centers').doc(targetCenterId).get();
    const centerData = centerSnap.exists ? centerSnap.data()! : null;
    if (!centerData) throw new ManagerApiError('Filial topilmadi.', 404);

    const isDirectOwner = centerData.ownerUid === uid;
    let hasOversight = isDirectOwner;
    if (!hasOversight) {
      const linkSnap = await adminDb.collection('center_oversight').doc(oversightDocId(uid, targetCenterId)).get();
      const link = linkSnap.exists ? linkSnap.data()! : null;
      hasOversight = !!link && link.accessLevel === 'operate';
    }
    if (!hasOversight) throw new ManagerApiError("Bu filialga ruxsatingiz yo'q.", 403);

    if (centerData.status !== 'active') {
      throw new ManagerApiError('Bu filial hali faollashtirilmagan.', 403);
    }

    await adminDb.collection('users').doc(uid).update({ centerId: targetCenterId });

    return NextResponse.json({ centerId: targetCenterId });
  } catch (error: any) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/manager/switch-branch error:', error);
    return NextResponse.json({ error: 'Server xatosi yuz berdi.' }, { status: 500 });
  }
}
