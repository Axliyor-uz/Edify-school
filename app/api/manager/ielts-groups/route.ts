import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const dynamic = 'force-dynamic';

/**
 * POST /api/manager/ielts-groups — create a CENTER IELTS group as a linked pair
 * (docs/IELTS.md + docs/MANAGER.md):
 *
 *   classes/{classId}      — ordinary center class (timetable / attendance / rooms /
 *                            finance machinery works untouched) + `ieltsGroupId` link
 *   ielts_groups/{groupId} — the IELTS twin: `centerId`, `classId`, `managed: true`;
 *                            roster mirrors classes.studentIds (manager-owned)
 *
 * The teacher must be linked to THIS center (center_teachers). Join-by-code is
 * refused for managed groups (/api/ielts/join → CENTER_MANAGED), so the joinCode
 * written here is shape-compat only and never shown to students.
 */
export async function POST(request: Request) {
  try {
    const { centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const title: string = (body?.title || '').trim();
    const description: string = (body?.description || '').trim();
    const teacherId: string = (body?.teacherId || '').trim();
    const targetBand = Number(body?.targetBand);

    if (title.length < 2) {
      return NextResponse.json({ error: 'Guruh nomi juda qisqa.' }, { status: 400 });
    }
    if (!teacherId) {
      return NextResponse.json({ error: 'Oʻqituvchi tanlanishi shart.' }, { status: 400 });
    }
    if (!(targetBand >= 1 && targetBand <= 9)) {
      return NextResponse.json({ error: 'Maqsad band 1–9 oraligʻida boʻlishi kerak.' }, { status: 400 });
    }

    // Teacher must be employed by THIS center (doc id == teacher uid).
    const linkSnap = await adminDb.collection('center_teachers').doc(teacherId).get();
    if (!linkSnap.exists || linkSnap.data()!.centerId !== centerId) {
      return NextResponse.json({ error: 'Oʻqituvchi markazingizga bogʻlanmagan.' }, { status: 403 });
    }
    const teacherName: string = linkSnap.data()!.teacherName || "Noma'lum O'qituvchi";

    const classRef = adminDb.collection('classes').doc();
    const groupRef = adminDb.collection('ielts_groups').doc();

    const classJoinCode = Array.from({ length: 6 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

    const batch = adminDb.batch();
    batch.set(classRef, {
      title,
      description,
      joinCode: classJoinCode,
      centerId,
      teacherId,
      teacherName,
      studentIds: [],
      studentCount: 0,
      isLocked: false,
      ieltsGroupId: groupRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(groupRef, {
      title,
      description,
      targetBand,
      joinCode: 'I-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      teacherId,
      teacherName,
      studentIds: [],
      centerId,
      classId: classRef.id,
      managed: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ classId: classRef.id, groupId: groupRef.id });
  } catch (error) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/manager/ielts-groups error:', error);
    return NextResponse.json({ error: 'IELTS guruh yaratishda xatolik yuz berdi.' }, { status: 500 });
  }
}
