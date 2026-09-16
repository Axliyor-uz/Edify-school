import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';
import {
  suggestTeacherEmailCandidates,
  suggestTeacherUsername,
  USERNAME_REGEX,
} from '@/lib/teacherProvision';
import { isOfficeRole, type OfficeRole } from '@/types/office';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[a-z0-9][a-z0-9._-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * Office-staff provisioning — director & buxgalter (docs/OFFICE.md).
 *
 * ⚠️ SUPER ADMIN ONLY, deliberately. A director outranks the center manager, so
 * letting the manager mint one would let them appoint their own oversight. The
 * manager can SEE the center's office accounts (the `center_staff` list rule)
 * but cannot create, change, or delete one — that is why there is no
 * `/api/manager/...` twin of this route, and why `center_staff` is
 * `write: if false` for every client.
 *
 * Mirrors the manager's create-teacher route (same translit email/username
 * generation, same synthetic `f.surname@edify.uz` domain, same batch + Auth
 * rollback), with one difference: the password lands in
 * `center_staff_credentials`, which is denied to ALL clients — only the super
 * admin (god mode) sees it, because the super admin is the recovery path here.
 *
 *   GET    ?  → list this center's office staff
 *   POST      → create an account  { fullName, staffRole, password, email?, username?, phone? }
 *   PATCH     → reset password     { uid, password }
 *   DELETE    → revoke access      { uid, deleteAccount? }
 */

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
  throw new AdminAuthError('Could not generate a free email — enter one manually.', 409);
}

async function nextFreeUsername(base: string): Promise<string> {
  for (let i = 0; i <= 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const snap = await adminDb.collection('usernames').doc(candidate).get();
    if (!snap.exists) return candidate;
  }
  throw new AdminAuthError('Could not generate a free username — enter one manually.', 409);
}

/** The center must exist; everything written below snapshots its id. */
async function assertCenter(centerId: string) {
  const snap = await adminDb.collection('centers').doc(centerId).get();
  if (!snap.exists) throw new AdminAuthError('Center not found.', 404);
}

function fail(error: unknown, label: string, fallback: string) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const code = (error as any)?.code;
  if (code === 'auth/email-already-exists') {
    return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
  }
  if (code === 'auth/invalid-password') {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// ─── GET — list ───────────────────────────────────────────────────────────────
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const snap = await adminDb.collection('center_staff').where('centerId', '==', centerId).get();
    const staff = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        // The password is shown in the admin UI on purpose: these accounts have
        // a synthetic email with no inbox, so a reset link can never arrive and
        // the super admin IS the recovery path (same stance as
        // center_teacher_credentials for manager-created teachers).
        const cred = await adminDb.collection('center_staff_credentials').doc(d.id).get();
        return {
          uid: d.id,
          centerId: data.centerId,
          staffRole: data.staffRole,
          name: data.name || '',
          email: data.email || '',
          username: data.username || '',
          password: cred.exists ? (cred.data()!.password as string) : null,
          createdAt: data.createdAt?.toMillis?.() ?? null,
        };
      }),
    );
    staff.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ staff });
  } catch (error) {
    return fail(error, 'GET /api/admin/centers/[id]/staff', 'Failed to load office staff.');
  }
}

// ─── POST — create ────────────────────────────────────────────────────────────
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let createdUid: string | null = null;
  try {
    const adminUid = await requireSuperAdmin(request);
    const { id: centerId } = await params;
    await assertCenter(centerId);

    const body = await request.json().catch(() => null);
    const fullName: string = (body?.fullName || '').trim();
    const staffRole: OfficeRole = body?.staffRole;
    const password: string = body?.password || '';
    const phone: string = (body?.phone || '').trim();

    if (fullName.length < 3) {
      return NextResponse.json({ error: 'Full name must be at least 3 characters.' }, { status: 400 });
    }
    if (!isOfficeRole(staffRole)) {
      return NextResponse.json({ error: 'Role must be director or accountant.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    let email: string;
    if (body?.email) {
      email = String(body.email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
      }
      if (!(await emailIsFree(email))) {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
      }
    } else {
      const candidates = suggestTeacherEmailCandidates(fullName);
      if (candidates.length === 0) {
        return NextResponse.json({ error: 'Could not derive an email from the name.' }, { status: 400 });
      }
      email = await nextFreeEmail(candidates);
    }

    let username: string;
    if (body?.username) {
      username = String(body.username).trim().toLowerCase();
      if (!USERNAME_REGEX.test(username)) {
        return NextResponse.json(
          { error: 'Username: min 5 chars, starts with a letter, only a-z, 0-9, _.' },
          { status: 400 },
        );
      }
      if ((await adminDb.collection('usernames').doc(username).get()).exists) {
        return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
      }
    } else {
      const base = suggestTeacherUsername(fullName);
      if (!base) {
        return NextResponse.json({ error: 'Could not derive a username from the name.' }, { status: 400 });
      }
      username = await nextFreeUsername(base);
    }

    const authUser = await adminAuth.createUser({ email, password, displayName: fullName });
    createdUid = authUser.uid;
    const uid = authUser.uid;

    try {
      const batch = adminDb.batch();

      // users/{uid}: `role` here is a REDIRECT HINT ONLY (the login page reads
      // it to decide where to send them). Authorization always goes through
      // center_staff — see types/office.ts. The rules' create-role allowlist
      // deliberately does NOT include these values, so no client can self-serve
      // one; only this Admin SDK write can.
      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        email,
        username,
        displayName: fullName,
        role: staffRole,
        centerId,
        accountType: 'center-managed',
        createdAt: new Date().toISOString(),
      });

      // create() (not set) → a concurrent signup taking the same username
      // fails this batch instead of being silently overwritten.
      batch.create(adminDb.collection('usernames').doc(username), { uid });

      batch.set(adminDb.collection('users').doc(uid).collection('private').doc('contact'), {
        email,
        phone,
      });

      // THE authorization anchor. Doc id == uid is what makes isCenterOffice()
      // and requireCenterOffice() trustworthy (rules enforce nothing else can
      // write here at all).
      batch.set(adminDb.collection('center_staff').doc(uid), {
        uid,
        centerId,
        staffRole,
        name: fullName,
        email,
        username,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: adminUid,
      });

      batch.set(adminDb.collection('center_staff_credentials').doc(uid), {
        uid,
        centerId,
        password,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    } catch (batchErr) {
      await adminAuth.deleteUser(uid).catch(() => {});
      createdUid = null;
      throw batchErr;
    }

    return NextResponse.json({ uid, email, username, password, staffRole });
  } catch (error) {
    if (createdUid) await adminAuth.deleteUser(createdUid).catch(() => {});
    return fail(error, 'POST /api/admin/centers/[id]/staff', 'Failed to create the office account.');
  }
}

// ─── PATCH — reset password ───────────────────────────────────────────────────
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const body = await request.json().catch(() => null);
    const uid: string = (body?.uid || '').trim();
    const password: string = body?.password || '';
    if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Scope the write to THIS center, so an id from another center's panel
    // can't be used to reset an unrelated account.
    const linkSnap = await adminDb.collection('center_staff').doc(uid).get();
    if (!linkSnap.exists || linkSnap.data()!.centerId !== centerId) {
      return NextResponse.json({ error: 'Office account not found in this center.' }, { status: 404 });
    }

    // Auth first: the stored credential must never claim a password that does
    // not actually work (same ordering as the manager's teacher-password reset).
    await adminAuth.updateUser(uid, { password });
    await adminDb.collection('center_staff_credentials').doc(uid).set(
      { uid, centerId, password, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return NextResponse.json({ ok: true, password });
  } catch (error) {
    return fail(error, 'PATCH /api/admin/centers/[id]/staff', 'Failed to reset the password.');
  }
}

// ─── DELETE — revoke ──────────────────────────────────────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const body = await request.json().catch(() => null);
    const uid: string = (body?.uid || '').trim();
    const deleteAccount: boolean = body?.deleteAccount !== false; // default: full teardown
    if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });

    const linkSnap = await adminDb.collection('center_staff').doc(uid).get();
    if (!linkSnap.exists || linkSnap.data()!.centerId !== centerId) {
      return NextResponse.json({ error: 'Office account not found in this center.' }, { status: 404 });
    }

    // Deleting the LINK is what actually revokes access — isCenterOffice() and
    // requireCenterOffice() both key off it, so the panel closes immediately
    // even if the Auth user survives.
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('center_staff').doc(uid));
    batch.delete(adminDb.collection('center_staff_credentials').doc(uid));

    if (deleteAccount) {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      const username = userSnap.exists ? (userSnap.data()!.username as string) : '';
      if (username) batch.delete(adminDb.collection('usernames').doc(username));
      batch.delete(adminDb.collection('users').doc(uid).collection('private').doc('contact'));
      batch.delete(adminDb.collection('users').doc(uid));
    }

    await batch.commit();
    if (deleteAccount) await adminAuth.deleteUser(uid).catch(() => {});

    return NextResponse.json({ ok: true, deletedAccount: deleteAccount });
  } catch (error) {
    return fail(error, 'DELETE /api/admin/centers/[id]/staff', 'Failed to remove the office account.');
  }
}
