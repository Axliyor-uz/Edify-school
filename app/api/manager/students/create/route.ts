import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';
import { patchStudentProfile } from '@/lib/server/financeOps';
import { getTodayKey } from '@/lib/dateUtils';
import {
  suggestTeacherEmailCandidates,
  suggestTeacherUsername,
  USERNAME_REGEX,
} from '@/lib/teacherProvision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[a-z0-9][a-z0-9._-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const GRADES = ['school_1','school_2','school_3','school_4','school_5','school_6','school_7','school_8','school_9','school_10','school_11','uni'];

async function emailIsFree(email: string): Promise<boolean> {
  try {
    await adminAuth.getUserByEmail(email);
    return false;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return true;
    throw err;
  }
}

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

async function nextFreeUsername(base: string): Promise<string> {
  for (let i = 0; i <= 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const snap = await adminDb.collection('usernames').doc(candidate).get();
    if (!snap.exists) return candidate;
  }
  throw new ManagerApiError('Username yaratib boʻlmadi — qoʻlda kiriting.', 409);
}

/**
 * POST /api/manager/students/create — manager provisions a STUDENT account
 * (the student twin of /api/manager/teachers/create — same generation, same
 * credentials model, docs/MANAGER.md).
 *
 * Body: { fullName, password, email?, username?, phone?, grade?, birthDate?,
 *         gender?, classId? }
 *
 * Writes (atomic batch, Auth user rolled back on failure):
 *   users/{uid}                      — exact StudentSignupFlow shape (incl.
 *                                      gamification zeros) + centerId +
 *                                      accountType:'center-managed'
 *   users/{uid}/private/contact      — {email, phone}
 *   usernames/{username}             — {uid} (batch.create → race-safe)
 *   center_students/{centerId}_{uid} — center roster link (class-free is fine)
 *   center_student_credentials/{uid} — manager-visible password
 * Optional classId (must be a group of THIS center): roster arrayUnion in the
 * same batch + best-effort finance enrollmentDates stamp after commit.
 */
export async function POST(request: Request) {
  try {
    const { uid: managerUid, centerId } = await requireActiveCenterManager(request);

    const body = await request.json().catch(() => null);
    const fullName: string = (body?.fullName || '').trim();
    const password: string = body?.password || '';
    const phone: string = (body?.phone || '').trim();
    const birthDate: string = (body?.birthDate || '').trim();
    const gender: string = (body?.gender || '').trim();
    const grade: string = (body?.grade || '').trim();
    const classId: string = (body?.classId || '').trim();

    if (fullName.length < 3) {
      return NextResponse.json({ error: 'Toʻliq ism kamida 3 harf boʻlishi kerak.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Parol kamida 8 belgidan iborat boʻlishi kerak.' }, { status: 400 });
    }
    if (grade && !GRADES.includes(grade)) {
      return NextResponse.json({ error: 'Sinf qiymati notoʻgʻri.' }, { status: 400 });
    }

    // Optional immediate enrollment — the group must be THIS center's.
    let classRef: FirebaseFirestore.DocumentReference | null = null;
    let classIeltsGroupId: string | null = null;
    if (classId) {
      const classSnap = await adminDb.collection('classes').doc(classId).get();
      if (!classSnap.exists || classSnap.data()!.centerId !== centerId) {
        return NextResponse.json({ error: 'Tanlangan guruh markazingizga tegishli emas.' }, { status: 403 });
      }
      classRef = classSnap.ref;
      classIeltsGroupId = classSnap.data()!.ieltsGroupId || null;
    }

    // ── Email / username: same policy as teachers ──
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

      // Exact StudentSignupFlow payload (docs/AUTH.md) + the manager extras.
      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        email,
        username,
        displayName: fullName,
        role: 'student',
        grade,
        phone: '',
        birthDate,
        gender,
        institution: '',
        location: { country: 'Uzbekistan', region: '', district: '' },
        totalXP: 0,
        currentStreak: 0,
        level: 1,
        dailyHistory: {},
        progress: { completedTopicIndex: 0, completedChapterIndex: 0, completedSubtopicIndex: 0 },
        createdAt: new Date().toISOString(),
        centerId,
        accountType: 'center-managed',
      });

      batch.create(adminDb.collection('usernames').doc(username), { uid });

      batch.set(adminDb.collection('users').doc(uid).collection('private').doc('contact'), {
        email,
        phone,
      });

      batch.set(adminDb.collection('center_students').doc(`${centerId}_${uid}`), {
        centerId,
        studentId: uid,
        studentName: fullName,
        source: 'created',
        addedAt: FieldValue.serverTimestamp(),
      });

      batch.set(adminDb.collection('center_student_credentials').doc(uid), {
        centerId,
        studentId: uid,
        password,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (classRef) {
        batch.update(classRef, { studentIds: FieldValue.arrayUnion(uid) });
        // Center IELTS group — mirror the roster onto the ielts_groups twin.
        if (classIeltsGroupId) {
          batch.update(adminDb.collection('ielts_groups').doc(classIeltsGroupId), {
            studentIds: FieldValue.arrayUnion(uid),
          });
        }
      }

      await batch.commit();
    } catch (batchErr) {
      await adminAuth.deleteUser(uid).catch(() => {});
      throw batchErr;
    }

    // Billing proration stamp — best-effort, same as the client enroll flow.
    if (classRef) {
      try {
        await patchStudentProfile({
          centerId,
          uid: managerUid,
          studentId: uid,
          patch: { enrollmentDates: { [classRef.id]: getTodayKey() } },
        });
      } catch { /* non-fatal */ }
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
    console.error('POST /api/manager/students/create error:', error);
    return NextResponse.json({ error: 'Oʻquvchi yaratishda xatolik yuz berdi.' }, { status: 500 });
  }
}
