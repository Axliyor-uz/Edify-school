// ─── Multi-branch owner view ──────────────────────────────────────────────────
// Lets ONE owner personally operate several `centers` docs by switching which
// one `users/{uid}.centerId` currently points at — confirmed design: the owner
// wears the branch-manager hat for whichever branch is active, one at a time.
// See the "Multi-branch owner view" section of docs/MANAGER.md.
//
// ⚠️ `centers.ownerUid` is UNCHANGED in meaning: it can legitimately repeat
// across several `centers` docs for the same owner, because every existing
// finance/attendance/roster rule and API guard already just compares against
// it — none of them were touched. `center_oversight` below is layered on top
// as an explicit, auditable, revocable GRANT RECORD, not because it's needed
// for today's authorization (a direct `ownerUid` match already suffices).

/**
 * The only value built today. Reserved seam for a future "each branch keeps
 * its own separate manager, the owner only ever VIEWS a rollup" model, which
 * would need a `'view_only'` level here WITHOUT ever touching `centers.ownerUid`.
 */
export type OversightAccessLevel = "operate";

/**
 * `center_oversight/{ownerUid}_{centerId}` — O(1) existence check by
 * construction (mirrors `center_students`/`center_teachers`'s doc-id idiom),
 * never a `list`-with-per-doc-`get()`. `write: if false` — only the super-admin
 * "attach another branch to this owner" route creates these.
 */
export interface CenterOversightLink {
  /** Same as the doc id: `${ownerUid}_${centerId}`. */
  id: string;
  ownerUid: string;
  centerId: string;
  /** Display snapshot so `fetchMyBranches` can render a name without a second read. */
  centerName?: string;
  accessLevel: OversightAccessLevel;
  addedAt?: unknown;
  /** Super-admin uid that granted it. */
  addedBy: string;
}

export const oversightDocId = (ownerUid: string, centerId: string) => `${ownerUid}_${centerId}`;

/** One row of the `/manager/branches` comparison table. */
export interface BranchSummary {
  centerId: string;
  centerName: string;
  status?: "pending" | "active" | "suspended";
  /** True for the branch `users.centerId` currently points at. */
  isActive: boolean;
}
