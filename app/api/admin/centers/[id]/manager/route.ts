import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/centers/[id]/manager — privileged operations on a center's manager.
 * Actions:
 *  - reset-password: returns a one-time password reset link for the owner account.
 *  - transfer-ownership: makes another existing user the center owner/manager.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const centerSnap = await adminDb.collection('centers').doc(centerId).get();
    if (!centerSnap.exists) {
      return NextResponse.json({ error: 'Center not found.' }, { status: 404 });
    }
    const center = centerSnap.data()!;
    const ownerUid: string = center.ownerUid;

    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action === 'reset-password') {
      const ownerSnap = await adminDb.collection('users').doc(ownerUid).get();
      const email = ownerSnap.exists ? ownerSnap.data()!.email : null;
      if (!email) {
        return NextResponse.json({ error: 'Manager account has no email on record.' }, { status: 404 });
      }
      const link = await adminAuth.generatePasswordResetLink(email);
      return NextResponse.json({ link });
    }

    if (action === 'transfer-ownership') {
      const newOwnerEmail = (body?.newOwnerEmail || '').trim().toLowerCase();
      const oldOwnerAction = body?.oldOwnerAction || 'demote-teacher';
      if (!newOwnerEmail) {
        return NextResponse.json({ error: 'newOwnerEmail is required.' }, { status: 400 });
      }
      if (!['demote-teacher', 'demote-student', 'keep'].includes(oldOwnerAction)) {
        return NextResponse.json({ error: 'Invalid oldOwnerAction.' }, { status: 400 });
      }

      const targetQuery = await adminDb.collection('users').where('email', '==', newOwnerEmail).limit(1).get();
      if (targetQuery.empty) {
        return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
      }
      const targetDoc = targetQuery.docs[0];
      const targetUid = targetDoc.id;
      const target = targetDoc.data();

      if (targetUid === ownerUid) {
        return NextResponse.json({ error: 'This user is already the owner.' }, { status: 400 });
      }

      // Block if the target already owns a different center.
      const ownedCenters = await adminDb.collection('centers').where('ownerUid', '==', targetUid).limit(1).get();
      if (!ownedCenters.empty && ownedCenters.docs[0].id !== centerId) {
        return NextResponse.json(
          { error: `This user already owns another center (${ownedCenters.docs[0].data().name || ownedCenters.docs[0].id}).` },
          { status: 409 }
        );
      }
      // Block if the target teaches in a different center (center_teachers doc id = uid).
      const targetTeacherLink = await adminDb.collection('center_teachers').doc(targetUid).get();
      if (targetTeacherLink.exists && targetTeacherLink.data()!.centerId !== centerId) {
        return NextResponse.json(
          { error: 'This user is a teacher in another center. Remove them there first.' },
          { status: 409 }
        );
      }

      const batch = adminDb.batch();
      batch.update(centerSnap.ref, { ownerUid: targetUid });
      batch.set(
        adminDb.collection('users').doc(targetUid),
        { role: 'manager', centerId },
        { merge: true }
      );

      const oldOwnerRef = adminDb.collection('users').doc(ownerUid);
      if ((await oldOwnerRef.get()).exists) {
        if (oldOwnerAction === 'demote-teacher') {
          batch.update(oldOwnerRef, { role: 'teacher', centerId: FieldValue.delete() });
        } else if (oldOwnerAction === 'demote-student') {
          batch.update(oldOwnerRef, { role: 'student', centerId: FieldValue.delete() });
        } else {
          batch.update(oldOwnerRef, { centerId: FieldValue.delete() });
        }
      }

      await batch.commit();
      return NextResponse.json({ ok: true, newOwnerUid: targetUid, previousRole: target.role || null });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/admin/centers/[id]/manager error:', error);
    return NextResponse.json({ error: 'Operation failed.' }, { status: 500 });
  }
}
