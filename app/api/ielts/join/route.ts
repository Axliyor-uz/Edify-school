// POST /api/ielts/join — join a group by code, server-side. Replaces the client query
// (which required world-readable groups and took snap.docs[0] blindly on duplicate codes).
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { IeltsApiError, jsonError, requireUser } from '@/lib/server/ieltsRoute';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { code } = await request.json();
    const clean = String(code || '').trim().toUpperCase();
    if (!/^I-[A-Z0-9]{4,6}$/.test(clean)) throw new IeltsApiError('Kod formati noto‘g‘ri.', 400);

    const snap = await adminDb.collection('ielts_groups').where('joinCode', '==', clean).get();
    if (snap.empty) throw new IeltsApiError('Bunday kodli guruh topilmadi.', 404);
    if (snap.size > 1) throw new IeltsApiError('Kod bo‘yicha bir nechta guruh topildi. O‘qituvchingizga murojaat qiling.', 409, 'DUPLICATE_CODE');

    const groupSnap = snap.docs[0];
    const group = groupSnap.data();
    if (Array.isArray(group.studentIds) && group.studentIds.includes(uid)) {
      return Response.json({ status: 'member', groupTitle: group.title });
    }
    // Center-managed groups: the roster is manager-owned — no self-join, even
    // with a leaked code (the manager enrolls from the center roster instead).
    if (group.managed || group.centerId) {
      throw new IeltsApiError(
        "Bu guruh o'quv markazi tomonidan boshqariladi — qo'shilish uchun markaz menejeriga murojaat qiling.",
        403, 'CENTER_MANAGED',
      );
    }

    const existing = await groupSnap.ref.collection('requests').where('studentId', '==', uid).limit(1).get();
    if (!existing.empty) return Response.json({ status: 'pending', groupTitle: group.title });

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const u = userSnap.exists ? userSnap.data()! : {};
    await groupSnap.ref.collection('requests').add({
      studentId: uid,
      displayName: u.displayName || u.name || "O'quvchi",
      username: u.username || (u.email ? String(u.email).split('@')[0] : ''),
      photoUrl: u.photoUrl || u.photoURL || null,
      requestedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ status: 'requested', groupTitle: group.title });
  } catch (e) {
    return jsonError(e);
  }
}
