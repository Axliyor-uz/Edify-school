import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTO_PATH = (uid: string) => `profile_images/${uid}.jpg`;
// Client crops+compresses to ≲200KB; anything bigger than this decoded cap is abuse.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * The manager may only touch photos of users in THEIR center:
 *  - teacher → center_teachers/{uid} link (doc ID = teacher uid)
 *  - student → enrolled in a class of the center (classes.centerId — the
 *    membership anchor since 2026-07-15, same as useCenterClasses)
 */
async function assertTargetInCenter(targetUid: string, centerId: string): Promise<void> {
  const targetSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new ManagerApiError('Foydalanuvchi topilmadi.', 404);
  }
  const role = targetSnap.data()!.role;

  if (role === 'teacher') {
    const ct = await adminDb.collection('center_teachers').doc(targetUid).get();
    if (ct.exists && ct.data()!.centerId === centerId) return;
  } else if (role === 'student') {
    const classSnap = await adminDb
      .collection('classes')
      .where('studentIds', 'array-contains', targetUid)
      .select('centerId')
      .get();
    if (classSnap.docs.some((d) => d.get('centerId') === centerId)) return;
  }

  throw new ManagerApiError('Bu foydalanuvchi sizning markazingizga tegishli emas.', 403);
}

function getBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new ManagerApiError('Server sozlamasida xatolik (storage bucket).', 500);
  }
  return adminStorage.bucket(bucketName);
}

/** POST — set/replace a center member's profile photo. Body: { targetUid, imageBase64 }. */
export async function POST(request: Request) {
  try {
    const { centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const targetUid: string = (body?.targetUid || '').trim();
    const imageBase64: string = body?.imageBase64 || '';
    if (!targetUid || !imageBase64) {
      return NextResponse.json({ error: "targetUid va imageBase64 talab qilinadi." }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (buffer.length < 100) {
      return NextResponse.json({ error: "Rasm fayli yaroqsiz." }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Rasm hajmi juda katta." }, { status: 413 });
    }

    await assertTargetInCenter(targetUid, centerId);

    // Same path + token-URL format the client SDK produces on the profile pages,
    // so the user can later replace/delete the photo themselves.
    const bucket = getBucket();
    const file = bucket.file(PHOTO_PATH(targetUid));
    const token = randomUUID();
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const photoURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}&t=${Date.now()}`;

    await adminDb.collection('users').doc(targetUid).update({ photoURL });
    // Mirror to the Auth profile like the profile pages do; Firestore stays the
    // source of truth, so an Auth hiccup must not fail the whole operation.
    try { await adminAuth.updateUser(targetUid, { photoURL }); } catch { /* non-fatal */ }

    return NextResponse.json({ photoURL });
  } catch (error: any) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/manager/user-photo error:', error);
    return NextResponse.json({ error: 'Rasmni saqlashda xatolik yuz berdi.' }, { status: 500 });
  }
}

/** DELETE — remove a center member's profile photo. Body: { targetUid }. */
export async function DELETE(request: Request) {
  try {
    const { centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const targetUid: string = (body?.targetUid || '').trim();
    if (!targetUid) {
      return NextResponse.json({ error: "targetUid talab qilinadi." }, { status: 400 });
    }

    await assertTargetInCenter(targetUid, centerId);

    await getBucket().file(PHOTO_PATH(targetUid)).delete({ ignoreNotFound: true });
    await adminDb.collection('users').doc(targetUid).update({ photoURL: null });
    try { await adminAuth.updateUser(targetUid, { photoURL: null }); } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/manager/user-photo error:', error);
    return NextResponse.json({ error: "Rasmni o'chirishda xatolik yuz berdi." }, { status: 500 });
  }
}
