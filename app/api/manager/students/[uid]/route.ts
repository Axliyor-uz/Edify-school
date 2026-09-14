import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRADES = ['school_1','school_2','school_3','school_4','school_5','school_6','school_7','school_8','school_9','school_10','school_11','uni', ''];

/**
 * PATCH /api/manager/students/[uid] — manager edits a center student
 * (the student twin of /api/manager/teachers/[uid], docs/MANAGER.md).
 *
 * Profile fields (any student in the manager's center — roster link OR
 * enrolled in a center group): displayName, grade, phone (→ private/contact
 * ONLY), birthDate, gender, institution, bio, region.
 *
 * `password` — STRICTLY center-created accounts: accountType 'center-managed'
 * AND users.centerId == this center (multi-center links don't grant password
 * power; only the HOME center that provisioned the account has it).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { centerId } = await requireActiveCenterManager(request);
    const { uid: targetUid } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Notoʻgʻri soʻrov.' }, { status: 400 });
    }

    const [userSnap, linkSnap] = await Promise.all([
      adminDb.collection('users').doc(targetUid).get(),
      adminDb.collection('center_students').doc(`${centerId}_${targetUid}`).get(),
    ]);
    if (!userSnap.exists || userSnap.data()!.role !== 'student') {
      throw new ManagerApiError('Oʻquvchi topilmadi.', 404);
    }
    if (!linkSnap.exists) {
      // Legacy fallback: enrolled in one of this center's groups but not yet
      // linked. Single-field array-contains query + in-memory centerId check —
      // avoids a composite index (same pattern as the user-photo route).
      const enrolled = await adminDb
        .collection('classes')
        .where('studentIds', 'array-contains', targetUid)
        .select('centerId')
        .get();
      if (!enrolled.docs.some((d) => d.get('centerId') === centerId)) {
        throw new ManagerApiError('Bu oʻquvchi sizning markazingizga tegishli emas.', 403);
      }
    }

    const userUpdates: Record<string, unknown> = {};
    const str = (v: unknown) => String(v).trim();

    if (typeof body.displayName === 'string' && str(body.displayName).length >= 3) {
      userUpdates.displayName = str(body.displayName);
    }
    if (typeof body.grade === 'string' && GRADES.includes(str(body.grade))) {
      userUpdates.grade = str(body.grade);
    }
    if (typeof body.birthDate === 'string') userUpdates.birthDate = str(body.birthDate);
    if (typeof body.gender === 'string') userUpdates.gender = str(body.gender);
    if (typeof body.institution === 'string') userUpdates.institution = str(body.institution);
    if (typeof body.bio === 'string') userUpdates.bio = str(body.bio);
    if (typeof body.region === 'string') {
      const loc = userSnap.data()!.location || { country: 'Uzbekistan', region: '', district: '' };
      userUpdates.location = { ...loc, region: str(body.region) };
    }

    const wantsPasswordReset = typeof body.password === 'string' && body.password.length > 0;
    if (wantsPasswordReset) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'Parol kamida 8 belgidan iborat boʻlishi kerak.' }, { status: 400 });
      }
      const u = userSnap.data()!;
      if (u.accountType !== 'center-managed' || u.centerId !== centerId) {
        return NextResponse.json(
          { error: 'Parolni faqat markaz yaratgan hisoblar uchun oʻzgartirish mumkin.' },
          { status: 403 },
        );
      }
    }

    if (Object.keys(userUpdates).length === 0 && !wantsPasswordReset && typeof body.phone !== 'string') {
      return NextResponse.json({ error: 'Oʻzgartirish uchun hech narsa yuborilmadi.' }, { status: 400 });
    }

    const batch = adminDb.batch();

    if (Object.keys(userUpdates).length > 0) {
      batch.update(adminDb.collection('users').doc(targetUid), userUpdates);
    }
    if (typeof body.phone === 'string') {
      batch.set(
        adminDb.collection('users').doc(targetUid).collection('private').doc('contact'),
        { phone: str(body.phone) },
        { merge: true },
      );
    }
    if (typeof userUpdates.displayName === 'string') {
      // Keep the denormalized name on EVERY center's roster link in sync.
      const links = await adminDb
        .collection('center_students').where('studentId', '==', targetUid).get();
      links.docs.forEach((d) => batch.update(d.ref, { studentName: userUpdates.displayName }));
    }
    if (wantsPasswordReset) {
      batch.set(adminDb.collection('center_student_credentials').doc(targetUid), {
        centerId,
        studentId: targetUid,
        password: body.password,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Auth first — the credentials doc must never record a password that
    // doesn't actually work (same ordering as the teacher route).
    if (wantsPasswordReset) {
      await adminAuth.updateUser(targetUid, { password: body.password });
    }

    await batch.commit();

    if (typeof userUpdates.displayName === 'string') {
      try { await adminAuth.updateUser(targetUid, { displayName: userUpdates.displayName }); } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PATCH /api/manager/students/[uid] error:', error);
    return NextResponse.json({ error: 'Saqlashda xatolik yuz berdi.' }, { status: 500 });
  }
}
