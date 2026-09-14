// lib/social.ts
import { runTransaction, doc, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Toggles a follow/unfollow relationship inside a transaction.
 *
 * The transaction reads the edge (and both user docs) first and NO-OPS when the
 * stored state already matches the requested action — the old blind
 * `increment(±1)` batch let a stale UI double-follow (inflating counters) or
 * unfollow a non-existent edge (driving counters negative). Counters are
 * written as clamped computed values, so they can never go below 0, and the
 * ±1 delta stays within the rules carve-out (firestore.rules users update).
 *
 * @param currentUid - The user clicking the button
 * @param targetUid  - The user being followed/unfollowed
 * @param isCurrentlyFollowing - UI's belief of the CURRENT state before the click
 * @returns the actual follow state after the call
 */
export const toggleFollowUser = async (
  currentUid: string,
  targetUid: string,
  isCurrentlyFollowing: boolean,
): Promise<{ following: boolean }> => {
  if (currentUid === targetUid) {
    throw new Error("You cannot follow yourself.");
  }

  const currentUserRef = doc(db, 'users', currentUid);
  const targetUserRef = doc(db, 'users', targetUid);
  const followingEdgeRef = doc(db, 'users', currentUid, 'following', targetUid);
  const followerEdgeRef = doc(db, 'users', targetUid, 'followers', currentUid);

  const result = await runTransaction(db, async (transaction) => {
    const [edgeSnap, meSnap, targetSnap] = await Promise.all([
      transaction.get(followingEdgeRef),
      transaction.get(currentUserRef),
      transaction.get(targetUserRef),
    ]);
    const edgeExists = edgeSnap.exists();

    if (isCurrentlyFollowing) {
      // UNFOLLOW — only if the edge really exists (stale UI otherwise no-ops).
      if (!edgeExists) return { following: false, didFollow: false };
      transaction.delete(followingEdgeRef);
      transaction.delete(followerEdgeRef);
      transaction.update(currentUserRef, {
        followingCount: Math.max(0, (meSnap.data()?.followingCount || 0) - 1),
      });
      transaction.update(targetUserRef, {
        followersCount: Math.max(0, (targetSnap.data()?.followersCount || 0) - 1),
      });
      return { following: false, didFollow: false };
    }

    // FOLLOW — only if the edge doesn't exist yet (double-click no-ops).
    if (edgeExists) return { following: true, didFollow: false };
    const timestamp = serverTimestamp();
    transaction.set(followingEdgeRef, { followedAt: timestamp });
    transaction.set(followerEdgeRef, { followedAt: timestamp });
    transaction.update(currentUserRef, {
      followingCount: (meSnap.data()?.followingCount || 0) + 1,
    });
    transaction.update(targetUserRef, {
      followersCount: (targetSnap.data()?.followersCount || 0) + 1,
    });
    return { following: true, didFollow: true };
  });

  // The follow notification stays OUTSIDE the transaction: its rules allow any
  // authed create, but a transaction retry would duplicate it. Best-effort.
  if (result.didFollow) {
    setDoc(doc(collection(db, 'notifications')), {
      userId: targetUid,
      type: 'request',
      title: 'New Follower!',
      message: 'Someone just started following you.',
      read: false,
      createdAt: serverTimestamp(),
      link: `/profile/${currentUid}`,
    }).catch(() => {});
  }

  return { following: result.following };
};

/**
 * Removes one of MY followers (the reverse edge direction of unfollow), with
 * the same existence check + clamped counters as toggleFollowUser.
 */
export const removeFollower = async (currentUid: string, followerUid: string): Promise<void> => {
  if (currentUid === followerUid) return;

  const meRef = doc(db, 'users', currentUid);
  const followerRef = doc(db, 'users', followerUid);
  const myFollowerEdgeRef = doc(db, 'users', currentUid, 'followers', followerUid);
  const theirFollowingEdgeRef = doc(db, 'users', followerUid, 'following', currentUid);

  await runTransaction(db, async (transaction) => {
    const [edgeSnap, meSnap, themSnap] = await Promise.all([
      transaction.get(myFollowerEdgeRef),
      transaction.get(meRef),
      transaction.get(followerRef),
    ]);
    if (!edgeSnap.exists()) return; // stale UI — nothing to remove

    transaction.delete(myFollowerEdgeRef);
    transaction.delete(theirFollowingEdgeRef);
    transaction.update(meRef, {
      followersCount: Math.max(0, (meSnap.data()?.followersCount || 0) - 1),
    });
    transaction.update(followerRef, {
      followingCount: Math.max(0, (themSnap.data()?.followingCount || 0) - 1),
    });
  });
};
