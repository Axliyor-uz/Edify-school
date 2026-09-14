// ─── The single XP write path ────────────────────────────────────────────────
// Both live XP writers (the assignment runner and checkers) run their own
// `runTransaction` but MUST route the user-doc mutation and the leaderboard
// mirrors through these helpers, inside that same transaction. That is what
// keeps `users.totalXP` and the leaderboard `xp` counters atomic — the old
// split "transaction then separate batch" left them permanently desynced when
// the batch failed.
//
// Conventions enforced here (docs/STUDENT.md § Gamification):
//   • dailyHistory keys are UTC (lib/xpDays.ts) and trimmed to 30 entries.
//   • The stored streak advances ONLY on a day that actually earned XP —
//     zero-XP submissions must not keep a streak alive that the displayed
//     streak (recomputed from dailyHistory) would show as broken.
//   • Streak bonuses: day 7 → +30, day 30 → +200.
//   • Daily goal (users.dailyGoal, default 200): first time a day's XP crosses
//     it → +25, once per UTC day (users.dailyGoalRewardedOn).
//   • Level is derived floor(totalXP/1000)+1; crossing a level → +50, and the
//     caller gets `leveledUp` back to notify.

import type { Transaction, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { xpDayKey, getPeriodIds } from '@/lib/xpDays';
import { sendNotification } from '@/services/notificationService';

export const STREAK_BONUS_7 = 30;
export const STREAK_BONUS_30 = 200;
export const DAILY_GOAL_BONUS = 25;
export const LEVEL_UP_BONUS = 50;
/** Max XP a student can earn from games per UTC day (anti-farming). */
export const GAMES_DAILY_XP_CAP = 60;

export const levelFromXP = (totalXP: number) => Math.floor((totalXP || 0) / 1000) + 1;

export interface ApplyUserXpOptions {
  /** Base XP the caller computed (may be 0 — the doc is still touched for activity). */
  xp: number;
  /** Breakdown labels in "Label: +N" form; bonus lines are appended here. */
  breakdown: string[];
  /** Entry prepended to users.recentActivity. */
  activityEntry: Record<string, unknown>;
  /** How many recentActivity entries to keep (5 for tests, 10 for games). */
  activityLimit: number;
  /** Extra fields merged into the same user-doc write (e.g. gamesDaily). */
  extraUserFields?: Record<string, unknown>;
}

export interface ApplyUserXpResult {
  finalXp: number;
  breakdown: string[];
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
  goalReached: boolean;
  latestName: string;
  latestAvatar: string | null;
}

/**
 * Apply an XP award to `users/{uid}` inside the caller's transaction.
 * `userSnap` must come from `transaction.get(userRef)` in that same transaction.
 */
export function applyUserXp(
  transaction: Transaction,
  userRef: DocumentReference,
  userSnap: DocumentSnapshot,
  opts: ApplyUserXpOptions,
): ApplyUserXpResult {
  const userData: Record<string, any> = userSnap.exists() ? userSnap.data()! : {};
  const todayStr = xpDayKey();
  const yesterdayStr = xpDayKey(new Date(Date.now() - 86_400_000));
  const breakdown = [...opts.breakdown];

  let xpToAward = opts.xp;
  let currentStreak = userData.currentStreak || 0;
  const lastActive = userData.lastActiveDate || '';
  let streakAdvanced = false;

  // The streak only moves on a day that actually earns XP (zero-XP submissions
  // used to keep the stored counter alive while the displayed streak broke).
  if (xpToAward > 0) {
    if (lastActive === todayStr) {
      if (currentStreak === 0) currentStreak = 1;
    } else if (lastActive === yesterdayStr) {
      currentStreak += 1;
      streakAdvanced = true;
    } else {
      currentStreak = 1;
    }
    if (streakAdvanced && currentStreak === 7) { xpToAward += STREAK_BONUS_7; breakdown.push(`7 Day Streak!: +${STREAK_BONUS_7}`); }
    if (streakAdvanced && currentStreak === 30) { xpToAward += STREAK_BONUS_30; breakdown.push(`30 Day Streak!: +${STREAK_BONUS_30}`); }
  }

  // Daily-goal bonus — once per UTC day, on the write that crosses the goal.
  const dailyGoal = userData.dailyGoal || 200;
  const earnedTodayBefore = (userData.dailyHistory || {})[todayStr] || 0;
  let goalReached = false;
  if (
    xpToAward > 0 &&
    earnedTodayBefore < dailyGoal &&
    earnedTodayBefore + xpToAward >= dailyGoal &&
    userData.dailyGoalRewardedOn !== todayStr
  ) {
    goalReached = true;
    xpToAward += DAILY_GOAL_BONUS;
    breakdown.push(`Daily Goal!: +${DAILY_GOAL_BONUS}`);
  }

  // Level-up bonus — level is derived from totalXP, never stored.
  const prevTotal = userData.totalXP || 0;
  const levelBefore = levelFromXP(prevTotal);
  let leveledUp = false;
  if (xpToAward > 0 && levelFromXP(prevTotal + xpToAward) > levelBefore) {
    leveledUp = true;
    xpToAward += LEVEL_UP_BONUS;
    breakdown.push(`Level Up!: +${LEVEL_UP_BONUS}`);
  }
  const newLevel = levelFromXP(prevTotal + xpToAward);

  // dailyHistory: UTC keys, trimmed to the last 30 entries on every write.
  let dailyHistory: Record<string, number> = { ...(userData.dailyHistory || {}) };
  if (xpToAward > 0) {
    dailyHistory[todayStr] = (dailyHistory[todayStr] || 0) + xpToAward;
    const sortedDates = Object.keys(dailyHistory).sort();
    if (sortedDates.length > 30) {
      const trimmed: Record<string, number> = {};
      sortedDates.slice(-30).forEach((d) => (trimmed[d] = dailyHistory[d]));
      dailyHistory = trimmed;
    }
  }

  const existingActivity = Array.isArray(userData.recentActivity) ? userData.recentActivity : [];
  const recentActivity = [opts.activityEntry, ...existingActivity].slice(0, opts.activityLimit);

  // ⚠️ Never write `email` (or any contact field) here — users/{uid} is
  // world-readable; contact lives in users/{uid}/private/contact (docs/AUTH.md).
  const update: Record<string, unknown> = {
    totalXP: increment(xpToAward),
    recentActivity,
    lastActiveTimestamp: serverTimestamp(),
    ...(xpToAward > 0
      ? {
          currentStreak,
          dailyHistory,
          lastActiveDate: todayStr,
          ...(goalReached ? { dailyGoalRewardedOn: todayStr } : {}),
        }
      : {}),
    ...(opts.extraUserFields || {}),
  };
  transaction.set(userRef, update, { merge: true });

  return {
    finalXp: xpToAward,
    breakdown,
    currentStreak,
    leveledUp,
    newLevel,
    goalReached,
    latestName: userData.displayName || 'Student',
    latestAvatar: userData.photoURL || null,
  };
}

/**
 * Mirror an XP award onto the 4 global leaderboard period docs and each
 * per-class leaderboard, INSIDE the same transaction as the user-doc write.
 * No-op when xp is 0 (zero-XP events never touch leaderboards — documented).
 */
export function mirrorLeaderboards(
  transaction: Transaction,
  uid: string,
  xp: number,
  identity: { displayName: string | null; avatar: string | null; classId?: string | null },
  classIds: string[],
) {
  if (xp <= 0) return;
  const { dayId, weekId, monthId, globalId } = getPeriodIds();
  const lbData = {
    uid,
    displayName: identity.displayName || 'Student',
    avatar: identity.avatar || null,
    ...(identity.classId ? { classId: identity.classId } : {}),
    xp: increment(xp),
    lastActive: serverTimestamp(),
  };
  [dayId, weekId, monthId, globalId].forEach((pid) =>
    transaction.set(doc(db, 'leaderboards', pid, 'users', uid), lbData, { merge: true }),
  );
  classIds.forEach((cid) =>
    transaction.set(doc(db, 'classes', cid, 'leaderboard', uid), lbData, { merge: true }),
  );
}

/** Fire-and-forget level-up notification (call AFTER the transaction commits). */
export function notifyLevelUp(uid: string, newLevel: number) {
  sendNotification(
    uid,
    'levelup',
    `Level ${newLevel}!`,
    `You reached level ${newLevel} — +${LEVEL_UP_BONUS} XP bonus. Keep it up!`,
    '/profile',
  ).catch(() => {});
}
