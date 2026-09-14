import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';
import {
  suggestTeacherEmailCandidates,
  suggestTeacherUsername,
  USERNAME_REGEX,
} from '@/lib/teacherProvision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[a-z0-9][a-z0-9._-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Is this email free in Firebase Auth? (getUserByEmail throws user-not-found when free) */
async function emailIsFree(email: string): Promise<boolean> {
  try {
    await adminAuth.getUserByEmail(email);
    return false;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return true;
    throw err;
  }
}

/** Walk the candidate chain (a.karimov → alisher.karimov), then numeric
 *  suffixes on the SHORT form (a.karimov2, a.karimov3 …). */
async function nextFreeEmail(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (await emailIsFree(candidate)) return candidate;
  }
  const [local, domain] = candidates[0].split('@');
  for (let i = 2; i <= 50; i++) {
    const candidate = `${local}${i}@${domain}`;
    if (await emailIsFree(candidate)) return candidate;
  }
  throw new ManagerApiError('Email yaratib boʻlmadi — qoʻlda kiriting.', 409);
}

/** base "alisher" → first free of alisher, alisher1, alisher2 … */
async function nextFreeUsername(base: string): Promise<string> {
  for (let i = 0; i <= 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const snap = await adminDb.collection('usernames').doc(candidate).get();
    if (!snap.exists) return candidate;
  }
  throw new ManagerApiError('Username yaratib boʻlmadi — qoʻlda kiriting.', 409);
}

/**
 * POST /api/manager/teachers/create — manager provisions a teacher account.
 *
 * Body: { fullName, subject, password, email?, username?, phone?, birthDate?,
 *         gender?, experience?, region? }
 * email/username omitted → generated from the name (a.karimov@edify.uz, with
 * fuller-form/suffix fallbacks); provided explicitly → validated and 409 if taken.
 *
 * Writes (atomic batch, Auth user rolled back on failure):
 *   users/{uid}                    — exact teacher-signup shape + centerId +
 *                                    accountType:'center-managed'
 *   users/{uid}/private/contact    — {email, phone}
 *   usernames/{username}           — {uid} (batch.create → race-safe)
 *   center_teachers/{uid}          — center link (member from birth)
 *   center_teacher_credentials/{uid} — manager-visible password (rules:
 *                                    manager-read-only, never client-written)
 *
 * ⚠️ The synthetic email has no inbox — password reset emails can never reach
 * it. The manager is the account's recovery path (PATCH ../teachers/[uid]).
 */
export async function POST(request: Request) {
  try {
    const { centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const fullName: string = (body?.fullName || '').trim();
    const subject: string = (body?.subject || '').trim();
    const password: string = body?.password || '';
    const phone: string = (body?.phone || '').trim();
    const birthDate: string = (body?.birthDate || '').trim();
    const gender: string = (body?.gender || '').trim();
    const region: string = (body?.region || '').trim();
    const experience: number = Number.isFinite(Number(body?.experience)) ? Number(body?.experience) : 0;

    if (fullName.length < 3) {
      return NextResponse.json({ error: 'Toʻliq ism kamida 3 harf boʻlishi kerak.' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Fan tanlanishi shart.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Parol kamida 8 belgidan iborat boʻlishi kerak.' }, { status: 400 });
    }

    // ── Email: explicit → validate + must be free; omitted → generate short
    // form (a.karimov@edify.uz), fall back to fuller forms / suffixes if taken ──
    let email: string;
    if (body?.email) {
      email = String(body.email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Email formati notoʻgʻri.' }, { status: 400 });
      }
      if (!(await emailIsFree(email))) {
        return NextResponse.json({ error: 'Bu email allaqachon band.' }, { status: 409 });
      }
    } else {
      const candidates = suggestTeacherEmailCandidates(fullName);
      if (candidates.length === 0) {
        return NextResponse.json({ error: 'Ismdan email yaratib boʻlmadi.' }, { status: 400 });
      }
      email = await nextFreeEmail(candidates);
    }

    // ── Username: same policy ──
    let username: string;
    if (body?.username) {
      username = String(body.username).trim().toLowerCase();
      if (!USERNAME_REGEX.test(username)) {
        return NextResponse.json(
          { error: 'Username kamida 5 belgi, harf bilan boshlanishi kerak (a-z, 0-9, _).' },
          { status: 400 },
        );
      }
      const taken = await adminDb.collection('usernames').doc(username).get();
      if (taken.exists) {
        return NextResponse.json({ error: 'Bu username allaqachon band.' }, { status: 409 });
      }
    } else {
      const base = suggestTeacherUsername(fullName);
      if (!base) {
        return NextResponse.json({ error: 'Ismdan username yaratib boʻlmadi.' }, { status: 400 });
      }
      username = await nextFreeUsername(base);
    }

    // ── 1. Auth account ──
    const authUser = await adminAuth.createUser({ email, password, displayName: fullName });
    const uid = authUser.uid;

    // ── 2. Atomic Firestore batch (rollback the Auth user if it fails) ──
    try {
      const batch = adminDb.batch();

      // Exact TeacherSignupFlow payload (docs/AUTH.md) + the manager extras.
      // `email` on the public doc is the same migration mirror signup writes —
      // it leaves with DEPLOY 2's strip script.
      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        email,
        username,
        displayName: fullName,
        role: 'teacher',
        subject,
        phone: '',
        birthDate,
        gender,
        institution: '',
        location: { country: 'Uzbekistan', region, district: '' },
        grade: 'Teacher',
        verifiedTeacher: false,
        experience,
        createdAt: new Date().toISOString(),
        centerId,
        accountType: 'center-managed',
      });

      // create() (not set) → a concurrent signup grabbing the same username
      // fails this batch instead of being silently overwritten.
      batch.create(adminDb.collection('usernames').doc(username), { uid });

      batch.set(adminDb.collection('users').doc(uid).collection('private').doc('contact'), {
        email,
        phone,
      });

      batch.set(adminDb.collection('center_teachers').doc(uid), {
        centerId,
        teacherId: uid,
        teacherName: fullName,
        teacherEmail: email,
        addedAt: FieldValue.serverTimestamp(),
      });

      batch.set(adminDb.collection('center_teacher_credentials').doc(uid), {
        centerId,
        teacherId: uid,
        password,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    } catch (batchErr) {
      await adminAuth.deleteUser(uid).catch(() => {});
      throw batchErr;
    }

    return NextResponse.json({ uid, email, username, password });
  } catch (error: any) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Bu email allaqachon band.' }, { status: 409 });
    }
    if (error?.code === 'auth/invalid-password') {
      return NextResponse.json({ error: 'Parol kamida 8 belgidan iborat boʻlishi kerak.' }, { status: 400 });
    }
    console.error('POST /api/manager/teachers/create error:', error);
    return NextResponse.json({ error: 'Oʻqituvchi yaratishda xatolik yuz berdi.' }, { status: 500 });
  }
}
