import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const dynamic = 'force-dynamic';

async function requireManagedGroup(request: Request, groupId: string) {
  const { uid, centerId } = await requireActiveCenterManager(request);
  const groupSnap = await adminDb.collection('ielts_groups').doc(groupId).get();
  if (!groupSnap.exists) throw new ManagerApiError('Guruh topilmadi.', 404);
  const group = groupSnap.data()!;
  if (group.centerId !== centerId) throw new ManagerApiError('Bu guruh markazingizga tegishli emas.', 403);
  return { uid, centerId, groupSnap, group };
}

/**
 * DELETE /api/manager/ielts-groups/{groupId} — delete the linked pair
 * (ielts_groups doc + its assignments/requests subcollections + the classes twin).
 * Attempts (ielts_attempts) and finance docs are deliberately KEPT — history.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await ctx.params;
    const { groupSnap, group, centerId } = await requireManagedGroup(request, groupId);

    const [assignments, requests] = await Promise.all([
      groupSnap.ref.collection('assignments').get(),
      groupSnap.ref.collection('requests').get(),
    ]);

    const batch = adminDb.batch();
    assignments.docs.forEach((d) => batch.delete(d.ref));
    requests.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(groupSnap.ref);

    if (group.classId) {
      const classSnap = await adminDb.collection('classes').doc(group.classId).get();
      // Only delete the twin if it is still THIS center's class (paranoia guard).
      if (classSnap.exists && classSnap.data()!.centerId === centerId) {
        batch.delete(classSnap.ref);
      }
    }
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/manager/ielts-groups/[groupId] error:', error);
    return NextResponse.json({ error: 'Guruhni oʻchirishda xatolik yuz berdi.' }, { status: 500 });
  }
}
