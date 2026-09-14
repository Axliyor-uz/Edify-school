// types/Parent.ts
//
// **Parent access — a read-only window into ONE student, opened by a QR code.**
// Contract + traps: docs/PARENTS.md.
//
// ⚠️ **A parent has no account, and that is the whole design.** Every other actor
// in this app is a Firebase user with a `role` (docs/AUTH.md); a parent is a
// person holding a link. There is nothing to sign up for, nothing to remember and
// nothing to reset — the manager issues a QR, the parent scans it, and the link
// IS the credential.
//
// The consequences, all of them deliberate:
//
// - ⚠️ **The token is a bearer credential.** Anyone holding the URL sees the
//   report. It is 24 random chars from a 29-char alphabet (≈117 bits) so it
//   cannot be guessed, but it CAN be forwarded — which is why the manager can
//   revoke it, why every view is counted, and why `scope.finance` exists.
// - ⚠️ **The report is assembled by the Admin SDK and served as JSON.** No
//   Firestore rule can authorize a request with no `request.auth`, so
//   `parent_links` is `read, write: if false` for every client and the ONLY way
//   in is `GET /api/parent/[token]`. Never add a client-SDK read path for this.
// - ⚠️ **The parent sees an EXPORT, never a live document.** The route returns
//   exactly the fields below, so a field added to `users` or `attempts` later
//   cannot leak by accident. Widening this type is the only way to widen what a
//   parent sees.

import type { Lang } from './Math';

/** Doc id of a link is its token — see `parent_links` in docs/DATA_MODEL.md. */
export type ParentLinkStatus = 'active' | 'revoked';

/**
 * What a link is allowed to show.
 *
 * Results, levels and attendance are the point of the feature and are always on.
 * **Money is the one thing a manager may withhold**: a forwarded link would
 * otherwise expose the family's debt to whoever received it, and some centers
 * discuss fees with one parent only.
 */
export interface ParentScope {
  /** Assignment/exam attempts + the improvement trend. */
  results: boolean;
  /** The measured 0–5 maths level and Milliy sertifikat papers. */
  levels: boolean;
  /** Present/absent/late tallies for the last weeks. */
  attendance: boolean;
  /** ⚠️ Balance, charges and payments. Off ⇒ the block is not even fetched. */
  finance: boolean;
}

/**
 * One issued QR link — `parent_links/{token}`.
 *
 * ⚠️ **The doc id IS the secret**, which is what makes a parent page cost one
 * `get()` instead of a query. The collection is denied to every client in
 * `firestore.rules`, so the id is never enumerable from the browser.
 */
export interface ParentLink {
  /** The token — also the document id. URL-safe by construction. */
  token: string;
  centerId: string;
  studentId: string;
  /** Denormalized so the manager's list needs no `users` read. */
  studentName: string;
  /**
   * Who this QR was handed to — "Onasi", "Otasi", "Buvisi". Free text, optional.
   * ⚠️ A student has ONE active link at a time (see `createdAt` below), so this
   * is a note about who holds it, not a way to tell two live links apart.
   */
  label: string;
  status: ParentLinkStatus;
  scope: ParentScope;
  /**
   * Epoch ms. ⚠️ A plain number, like every exam-side timestamp.
   *
   * ⚠️ **Issuing a new link REVOKES the student's previous active one.** One
   * child ⇒ one connected person: that is the rule the manager asked for, and it
   * is enforced at creation rather than by hoping nobody presses the button twice.
   */
  createdAt: number;
  createdBy: string;
  revokedAt?: number;
  /** Epoch ms of the last successful report fetch — the manager's audit trail. */
  lastViewedAt?: number;
  viewCount: number;

  // ─── one device, one person ────────────────────────────────────────────────
  //
  // ⚠️ **The link is CLAIMED by the first browser that opens it.** Without this
  // a forwarded URL works for everyone who receives it; with it, forwarding is
  // only a delivery mechanism — whoever opens it first becomes *the* connected
  // person and every later device is refused (409).
  //
  // The device proves itself with a secret the server mints at claim time and
  // the browser keeps in localStorage. ⚠️ Only the HASH is stored here: the
  // stored value must not be replayable by anyone who ever reads this document
  // (an operator, a backup, a support export).

  /** sha256 of the device secret. Absent ⇒ the link has never been opened. */
  deviceHash?: string;
  /** Epoch ms of the claim — "connected since" in the manager's list. */
  claimedAt?: number;
  /**
   * A coarse "iPhone · Safari"-style note about the claiming device, so the
   * manager can tell a parent which phone is connected.
   * ⚠️ Deliberately coarse — the full user-agent is a fingerprint, and this is
   * shown in a panel other staff can read.
   */
  claimedDevice?: string;
}

/** What the manager list shows. Identical to the stored doc today. */
export type ParentLinkRow = ParentLink;

// ─── the report ──────────────────────────────────────────────────────────────

export interface ParentGroup {
  classId: string;
  title: string;
  teacherName: string;
  /** "Du, Chor 15:00–16:30" — pre-rendered server-side; the parent page has no
   *  weekday vocabulary of its own. */
  schedule: string[];
}

/** One graded piece of work, whatever produced it. */
export interface ParentResultRow {
  id: string;
  /** Which surface it came from — the parent page groups and labels by this. */
  kind: 'assignment' | 'exam' | 'milliy' | 'rasch';
  title: string;
  /** Group title for class work, subject for a Milliy paper. May be empty. */
  context: string;
  /** 0–100, rounded. `null` while an exam is waiting for the teacher's grade. */
  percent: number | null;
  /** Epoch ms. */
  at: number;
  /** True when the teacher has not finished grading — shown, never scored. */
  pending: boolean;
}

/** One month of the trend chart. */
export interface ParentTrendPoint {
  /** `YYYY-MM`. */
  monthKey: string;
  /** Mean percent of the graded work submitted that month. */
  average: number;
  count: number;
}

export interface ParentResultsBlock {
  recent: ParentResultRow[];
  trend: ParentTrendPoint[];
  /**
   * The improvement headline: the newer half of the last up-to-10 graded results
   * minus the older half (2v2 at four results, growing to 5v5).
   *
   * ⚠️ `null` when there are fewer than 4 graded results — two points are a
   * coin-flip, and "improving by 40%" from one lucky test is worse than
   * saying nothing.
   */
  improvement: number | null;
  averageAll: number | null;
  graded: number;
}

/** The measured maths ability — see docs/RASCH_SKILLS.md for what θ means. */
export interface ParentLevelsBlock {
  /** 0–5, one decimal. `null` when the student has never sat a measured paper. */
  mathLevel: number | null;
  /** How many of the seven dimensions have any evidence. */
  measuredDimensions: number;
  /** Per-dimension 0–5 levels, strongest first. Empty when nothing is measured. */
  dimensions: { key: string; label: string; level: number }[];
  /** Milliy sertifikat sittings, newest first. */
  milliy: { subject: string; title: string; percent: number; at: number }[];
}

export interface ParentAttendanceBlock {
  /** `YYYY-MM-DD` bounds of the window the tallies cover. */
  from: string;
  to: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Present+late over counted lessons, 0–100. `null` when nothing is counted. */
  rate: number | null;
  /** Newest first, capped — the little strip of recent days. */
  recent: { date: string; status: string; classTitle: string }[];
}

export interface ParentFinanceBlock {
  /**
   * Integer so'm. ⚠️ **Positive = the family OWES money**, matching
   * `center_student_finance.balance` (docs/FINANCE.md) — do not flip the sign
   * for display without changing the label with it.
   */
  balance: number;
  /** Sum of what is still open across unpaid/partial charges. */
  openAmount: number;
  /** `YYYY-MM-DD` of the nearest unpaid due date, if any. */
  nextDueDate: string | null;
  charges: { id: string; title: string; periodKey: string; amount: number; paidAmount: number; status: string; dueDate: string }[];
  payments: { id: string; amount: number; paidAt: string; method: string }[];
}

/**
 * Everything `GET /api/parent/[token]` returns.
 *
 * ⚠️ Blocks the link's scope excludes are **absent**, not empty — the parent page
 * hides a section it was not given, and "0 so'm balance" must never be shown to
 * someone who was not meant to see money at all.
 */
export interface ParentReport {
  student: {
    id: string;
    name: string;
    photoURL: string;
    grade: string;
    /** Gamification, always shown: it is the friendliest number on the page. */
    totalXP: number;
    streak: number;
    /** Derived `floor(totalXP/1000)+1` — never `users.level`, which is dead. */
    xpLevel: number;
  };
  center: { id: string; name: string };
  groups: ParentGroup[];
  results?: ParentResultsBlock;
  levels?: ParentLevelsBlock;
  attendance?: ParentAttendanceBlock;
  finance?: ParentFinanceBlock;
  /** Epoch ms the report was assembled — the parent page prints it. */
  generatedAt: number;
}

/** What the parent's browser remembers, so one phone can hold several children. */
export interface ParentSavedChild {
  token: string;
  name: string;
  /** Epoch ms this device first opened the link. */
  addedAt: number;
}

/** The parent page speaks the same three languages as the rest of the app. */
export type ParentLang = Lang;
