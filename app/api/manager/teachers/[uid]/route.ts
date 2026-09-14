import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/manager/teachers/[uid] — manager edits a center teacher.
 *
 * Profile fields (any teacher LINKED to the manager's center — same trust
 * level as the user-photo route): displayName, subject, phone, birthDate,
 * gender, experience, institution, bio, region.
 *
 * `password` (STRICTLY center-managed accounts only — accounts the center
 * created via ../create): resetting the password of a teacher who signed up
 * on their own would be account takeover, so it requires
 * users/{uid}.accountType == 'center-managed' AND users.centerId == centerId.
 * A reset updates Auth + the manager-visible center_teacher_credentials doc,
 * so what the manager sees stays the truth.
 *
 * phone goes to users/{uid}/private/contact ONLY — writing it on the public
 * users doc re-opens the contact leak (docs/AUTH.md).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { centerId } = await requireActiveCenterManager(request);
    const { uid: targetUid } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Notoʻgʻri soʻrov.' }, { status: 400 });
    }

    // Target must be a teacher of MY center (teacher-anchored membership).
    const [userSnap, linkSnap] = await Promise.all([
      adminDb.collection('users').doc(targetUid).get(),
      adminDb.collection('center_teachers').doc(targetUid).get(),
    ]);
    if (!userSnap.exists || userSnap.data()!.role !== 'teacher') {
      throw new ManagerApiError('Oʻqituvchi topilmadi.', 404);
    }
    if (!linkSnap.exists || linkSnap.data()!.centerId !== centerId) {
      throw new ManagerApiError('Bu oʻqituvchi sizning markazingizga tegishli emas.', 403);
    }

    const userUpdates: Record<string, unknown> = {};
    const str = (v: unknown) => String(v).trim();

    if (typeof body.displayName === 'string' && str(body.displayName).length >= 3) {
      userUpdates.displayName = str(body.displayName);
    }
    if (typeof body.subject === 'string' && str(body.subject)) userUpdates.subject = str(body.subject);
    if (typeof body.birthDate === 'string') userUpdates.birthDate = str(body.birthDate);
    if (typeof body.gender === 'string') userUpdates.gender = str(body.gender);
    if (typeof body.institution === 'string') userUpdates.institution = str(body.institution);
    if (typeof body.bio === 'string') userUpdates.bio = str(body.bio);
    if (body.experience !== undefined && Number.isFinite(Number(body.experience))) {
      userUpdates.experience = Math.max(0, Number(body.experience));
    }
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
      // Keep every denormalized copy of the name in sync.
      batch.update(adminDb.collection('center_teachers').doc(targetUid), {
        teacherName: userUpdates.displayName,
      });
      const classSnap = await adminDb
        .collection('classes').where('teacherId', '==', targetUid).select().get();
      classSnap.docs.forEach((d) => batch.update(d.ref, { teacherName: userUpdates.displayName }));
    }
    if (wantsPasswordReset) {
      batch.set(adminDb.collection('center_teacher_credentials').doc(targetUid), {
        centerId,
        teacherId: targetUid,
        password: body.password,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Password changes in Auth FIRST — the credentials doc must never record a
    // password that doesn't actually work. If the batch then fails, the stored
    // copy is merely stale and the retry re-aligns both.
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
    console.error('PATCH /api/manager/teachers/[uid] error:', error);
    return NextResponse.json({ error: 'Saqlashda xatolik yuz berdi.' }, { status: 500 });
  }
}
