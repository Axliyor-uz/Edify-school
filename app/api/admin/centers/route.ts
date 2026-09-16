import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';
import { oversightDocId } from '@/types/branch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE_REGEX = /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{4,}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * POST /api/admin/centers — create a center. Two modes:
 *
 * 1. **Brand-new owner** (default, unchanged): also creates the manager's Auth
 *    user + `users`/`usernames` docs, mirroring the public `ManagerSignupFlow`
 *    batch. This path is byte-for-byte identical to before this comment.
 * 2. **`attachToOwnerUid` present** (2026-09-16, docs/MANAGER.md § "Multi-branch
 *    owner view"): attach this new branch to an EXISTING manager instead —
 *    skips `adminAuth.createUser`/`users`/`usernames` entirely, sets
 *    `centers.ownerUid` to that existing uid (deliberately allowed to repeat
 *    across several `centers` docs — see docs/MANAGER.md), and records a
 *    `center_oversight` grant.
 */
export async function POST(request: Request) {
  try {
    const superAdminUid = await requireSuperAdmin(request);

    const body = await request.json().catch(() => null);
    const {
      centerName,
      centerSlug,
      size,
      managerEmail,
      managerPassword,
      managerDisplayName,
      username,
      phone,
      attachToOwnerUid,
    } = body || {};

    if (typeof attachToOwnerUid === 'string' && attachToOwnerUid.trim()) {
      return attachBranchToExistingOwner({
        centerName,
        centerSlug,
        size,
        attachToOwnerUid: attachToOwnerUid.trim(),
        addedBy: superAdminUid,
      });
    }

    if (!centerName?.trim() || !centerSlug?.trim() || !size || !managerEmail?.trim() ||
        !managerPassword || !managerDisplayName?.trim() || !username?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }
    if (managerPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      return NextResponse.json({ error: 'Username: min 5 chars, starts with a letter, only a-z, 0-9, _.' }, { status: 400 });
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      return NextResponse.json({ error: 'Phone format: +998 XX XXX XX XX' }, { status: 400 });
    }
    if (!SLUG_REGEX.test(centerSlug.trim())) {
      return NextResponse.json({ error: 'Slug may only contain a-z, 0-9 and dashes.' }, { status: 400 });
    }

    const lowerUsername = username.trim().toLowerCase();
    const usernameRef = adminDb.collection('usernames').doc(lowerUsername);
    if ((await usernameRef.get()).exists) {
      return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
    }

    let managerUid: string | null = null;
    try {
      const userRecord = await adminAuth.createUser({
        email: managerEmail.trim().toLowerCase(),
        password: managerPassword,
        displayName: managerDisplayName.trim(),
      });
      managerUid = userRecord.uid;
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
      }
      throw error;
    }

    try {
      const centerRef = adminDb.collection('centers').doc();
      const batch = adminDb.batch();

      batch.set(centerRef, {
        id: centerRef.id,
        name: centerName.trim(),
        slug: centerSlug.trim(),
        ownerUid: managerUid,
        size,
        // Admin-created centers are trusted — approved from the start.
        status: 'active',
        subscription: {
          plan: 'free_trial',
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date().toISOString(),
      });

      batch.set(adminDb.collection('users').doc(managerUid), {
        uid: managerUid,
        email: managerEmail.trim().toLowerCase(),
        username: lowerUsername,
        displayName: managerDisplayName.trim(),
        phone: phone.trim(),
        role: 'manager',
        centerId: centerRef.id,
        createdAt: new Date().toISOString(),
      });

      batch.set(usernameRef, { uid: managerUid });

      await batch.commit();
      return NextResponse.json({ centerId: centerRef.id, uid: managerUid });
    } catch (error) {
      // Roll back the Auth user if the Firestore batch fails.
      await adminAuth.deleteUser(managerUid).catch(() => {});
      throw error;
    }
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/admin/centers error:', error);
    return NextResponse.json({ error: 'Failed to create center.' }, { status: 500 });
  }
}

/** Mode 2 of the handler above — see its doc comment. */
async function attachBranchToExistingOwner(params: {
  centerName?: string;
  centerSlug?: string;
  size?: string;
  attachToOwnerUid: string;
  addedBy: string;
}): Promise<NextResponse> {
  const { centerName, centerSlug, size, attachToOwnerUid, addedBy } = params;
  if (!centerName?.trim() || !centerSlug?.trim() || !size) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (!SLUG_REGEX.test(centerSlug.trim())) {
    return NextResponse.json({ error: 'Slug may only contain a-z, 0-9 and dashes.' }, { status: 400 });
  }

  const ownerSnap = await adminDb.collection('users').doc(attachToOwnerUid).get();
  const ownerData = ownerSnap.exists ? ownerSnap.data()! : null;
  if (!ownerData || ownerData.role !== 'manager') {
    return NextResponse.json({ error: 'Target user is not an existing manager.' }, { status: 404 });
  }

  const centerRef = adminDb.collection('centers').doc();
  const batch = adminDb.batch();

  batch.set(centerRef, {
    id: centerRef.id,
    name: centerName.trim(),
    slug: centerSlug.trim(),
    ownerUid: attachToOwnerUid,
    size,
    // Admin-created centers are trusted — approved from the start, same as mode 1.
    status: 'active',
    subscription: {
      plan: 'free_trial',
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: new Date().toISOString(),
  });

  batch.set(adminDb.collection('center_oversight').doc(oversightDocId(attachToOwnerUid, centerRef.id)), {
    ownerUid: attachToOwnerUid,
    centerId: centerRef.id,
    centerName: centerName.trim(),
    accessLevel: 'operate',
    addedAt: FieldValue.serverTimestamp(),
    addedBy,
  });

  await batch.commit();
  return NextResponse.json({ centerId: centerRef.id, ownerUid: attachToOwnerUid });
}
