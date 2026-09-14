import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { getPeriodIds } from '@/lib/xpDays';

export const dynamic = 'force-dynamic';

// ─── Full self-service account deletion ──────────────────────────────────────
// The client flow used to delete documents directly and broke on the first
// rules denial: students may NOT delete their own `attempts` (teacher-only
// rule), so any student who had ever taken a test could not delete their
// account at all — and even the successful path orphaned social edges (other
// users' counters stayed inflated forever), leaderboard mirrors (ghost
// entries), pending join requests (approvable ghosts), RASCH docs, the
// private/contact doc, the storage photo and the center_students link.
//
// This route runs with the Admin SDK (bypasses rules) and removes everything
// that belongs to the account. Deliberately KEPT: center finance records
// (center_charges / center_payments / center_student_finance) — money history
// is append-only (docs/FINANCE.md iron rules); the manager's roster UNION
// tolerates a missing user doc.
//
// Caller must present their own Bearer id-token; the route only ever deletes
// the caller's uid — there is no way to target another account.

const BATCH_LIMIT = 400; // headroom under Firestore's 500-op cap

async function commitInChunks(ops: ((batch: FirebaseFirestore.WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

export async function POST(request: Request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const username: string | undefined = userSnap.exists ? userSnap.data()?.username : undefined;

    const ops: ((batch: FirebaseFirestore.WriteBatch) => void)[] = [];

    // 1. Attempts + notifications (rules forbid the student deleting attempts —
    //    this was the wall that aborted the old client-side flow).
    const [attempts, notifications] = await Promise.all([
      adminDb.collection('attempts').where('userId', '==', uid).get(),
      adminDb.collection('notifications').where('userId', '==', uid).get(),
    ]);
    [...attempts.docs, ...notifications.docs].forEach((d) => ops.push((b) => b.delete(d.ref)));

    // 2. Classes: membership, per-class leaderboard mirror, pending join
    //    requests (BOTH shapes: deterministic /requests/{uid} and
    //    addDoc-with-studentId — a teacher could approve a ghost otherwise).
    const memberClasses = await adminDb.collection('classes').where('studentIds', 'array-contains', uid).get();
    for (const cls of memberClasses.docs) {
      ops.push((b) => b.update(cls.ref, { studentIds: admin.firestore.FieldValue.arrayRemove(uid) }));
      ops.push((b) => b.delete(cls.ref.collection('leaderboard').doc(uid)));
      // Center IELTS group twin (docs/IELTS.md) — keep the roster mirror in sync.
      const ieltsGroupId = cls.data().ieltsGroupId;
      if (ieltsGroupId) {
        ops.push((b) => b.update(adminDb.collection('ielts_groups').doc(ieltsGroupId), {
          studentIds: admin.firestore.FieldValue.arrayRemove(uid),
        }));
      }
    }
    const requestDocs = await adminDb.collectionGroup('requests').where('studentId', '==', uid).get();
    requestDocs.docs
      .filter((d) => d.ref.path.startsWith('classes/'))
      .forEach((d) => ops.push((b) => b.delete(d.ref)));

    // 3. Global leaderboards: the 4 CURRENT period docs + all_time cover every
    //    row the leaderboard page can display (historical periods are unread).
    const { dayId, weekId, monthId, globalId } = getPeriodIds();
    [dayId, weekId, monthId, globalId].forEach((pid) =>
      ops.push((b) => b.delete(adminDb.collection('leaderboards').doc(pid).collection('users').doc(uid))),
    );

    // 4. Social graph: remove BOTH directions of every edge and decrement the
    //    other side's counter (clamped at 0) — deleted accounts used to inflate
    //    other users' follower counts forever.
    const [following, followers] = await Promise.all([
      userRef.collection('following').get(),
      userRef.collection('followers').get(),
    ]);
    for (const edge of following.docs) {
      const targetRef = adminDb.collection('users').doc(edge.id);
      const target = await targetRef.get();
      ops.push((b) => b.delete(targetRef.collection('followers').doc(uid)));
      if (target.exists) {
        const count = Math.max(0, (target.data()?.followersCount || 0) - 1);
        ops.push((b) => b.update(targetRef, { followersCount: count }));
      }
      ops.push((b) => b.delete(edge.ref));
    }
    for (const edge of followers.docs) {
      const followerRef = adminDb.collection('users').doc(edge.id);
      const follower = await followerRef.get();
      ops.push((b) => b.delete(followerRef.collection('following').doc(uid)));
      if (follower.exists) {
        const count = Math.max(0, (follower.data()?.followingCount || 0) - 1);
        ops.push((b) => b.update(followerRef, { followingCount: count }));
      }
      ops.push((b) => b.delete(edge.ref));
    }

    // 5. Remaining own subcollections (private/contact holds email+phone).
    for (const sub of ['private', 'bookmarks', 'test_stats']) {
      const docs = await userRef.collection(sub).get();
      docs.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    }

    // 6. RASCH progress + attempts.
    ops.push((b) => b.delete(adminDb.collection('RASCH_levels').doc(uid)));
    const raschAttempts = await adminDb.collection('RASCH_attempts').where('userId', '==', uid).get();
    raschAttempts.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));

    // 7. Checkers rooms this user is part of (ghost rooms otherwise).
    const [hostGames, guestGames] = await Promise.all([
      adminDb.collection('active_games').where('host', '==', uid).get(),
      adminDb.collection('active_games').where('guest', '==', uid).get(),
    ]);
    [...hostGames.docs, ...guestGames.docs].forEach((d) => ops.push((b) => b.delete(d.ref)));

    // 8. Center links: roster link + manager-held credential. Finance records
    //    are KEPT on purpose (append-only money — docs/FINANCE.md).
    const centerLinks = await adminDb.collection('center_students').where('studentId', '==', uid).get();
    centerLinks.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    ops.push((b) => b.delete(adminDb.collection('center_student_credentials').doc(uid)));

    // 9. The user doc + username reservation.
    if (username) ops.push((b) => b.delete(adminDb.collection('usernames').doc(username.toLowerCase())));
    ops.push((b) => b.delete(userRef));

    await commitInChunks(ops);

    // 10. Profile photo (best-effort — bucket may not be configured server-side).
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (bucketName) await adminStorage.bucket(bucketName).file(`profile_images/${uid}.jpg`).delete();
    } catch { /* no photo or no bucket — fine */ }

    // 11. Finally the Auth account itself.
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('account deletion failed', e);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
