import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { DirectoryError, identifyCaller } from '@/lib/server/directory';
import { checkAuthRateLimit, requestIp } from '@/lib/server/authRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { email } → { uid, displayName, username, photoURL, role }
 *
 * Resolves an email to an account so a manager can add a teacher, or an admin can
 * transfer center ownership. Replaces the client-side
 * `query(users, where('email','==', …))` calls, which (a) stop working once email
 * leaves the `users` doc, and (b) were themselves a leak: ANY signed-in user could
 * resolve an arbitrary email to an account.
 *
 * Restricted to teachers/managers/super admins, and rate-limited, because it is an
 * existence oracle for email addresses. Never returns contact details.
 */
export async function POST(request: Request) {
  try {
    const caller = await identifyCaller(request);
    if (!caller.isSuperAdmin && caller.role !== 'manager' && caller.role !== 'teacher') {
      return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });
    }

    if (!checkAuthRateLimit(`lookup:${caller.uid}:${requestIp(request)}`, 30, 10 * 60_000)) {
      return NextResponse.json({ error: 'Juda ko\'p urinish.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email talab qilinadi.' }, { status: 400 });
    }

    // Resolve via Firebase Auth, not Firestore: Auth is the real source of truth
    // for an email→account mapping, it needs no index, and it keeps working
    // unchanged when DEPLOY 2 strips `users.email`.
    let uid: string;
    try {
      uid = (await adminAuth.getUserByEmail(email)).uid;
    } catch {
      return NextResponse.json({ error: 'Bu email tizimda topilmadi.' }, { status: 404 });
    }

    const profile = (await adminDb.doc(`users/${uid}`).get()).data();
    if (!profile) {
      return NextResponse.json({ error: 'Bu email tizimda topilmadi.' }, { status: 404 });
    }

    return NextResponse.json({
      uid,
      displayName: profile.displayName ?? '',
      username: profile.username ?? '',
      photoURL: profile.photoURL ?? null,
      role: profile.role ?? null,
      email,
    });
  } catch (error) {
    if (error instanceof DirectoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/directory/lookup error:', error);
    return NextResponse.json({ error: 'Server xatosi yuz berdi.' }, { status: 500 });
  }
}
