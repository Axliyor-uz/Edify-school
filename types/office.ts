// ─── Office staff (director / buxgalter) ─────────────────────────────────────
// Two center-scoped back-office roles that sit BESIDE the manager, not under it:
// a **director** (read-only owner view of money + staff) and an **accountant**
// ("buxgalter" — the same view, plus the ability to record payments/expenses).
//
// ⚠️ THE SECURITY BOUNDARY IS `center_staff/{uid}`, NOT `users/{uid}.role`.
// `users/{uid}` is client-writable (docs/AUTH.md § privileged-field denylist),
// so `role`/`centerId` there are attacker-controlled hints kept only so the
// login page knows where to redirect. `center_staff` is `write: if false` for
// every client — only the Admin SDK (super-admin routes) writes it — and its
// **doc id must equal the staff uid** (rules-enforced), which is what makes
// `doc(uid)` a trustworthy lookup. Exactly the `center_teachers` pattern.
//
// See docs/OFFICE.md.

/** The two back-office roles. Stored on `center_staff.staffRole` AND mirrored
 *  onto `users.role` (hint only — never an authorization source). */
export type OfficeRole = "director" | "accountant";

export const OFFICE_ROLES: OfficeRole[] = ["director", "accountant"];

export const isOfficeRole = (v: unknown): v is OfficeRole =>
  v === "director" || v === "accountant";

/**
 * `center_staff/{uid}` — the link doc. Doc id MUST equal `uid`.
 * Created only by `POST /api/admin/centers/[id]/staff` (Admin SDK).
 */
export interface CenterStaffLink {
  /** Same as the doc id. */
  uid: string;
  centerId: string;
  staffRole: OfficeRole;
  name: string;
  /** Login email — synthetic (`f.surname@edify.uz`) unless the admin typed one. */
  email: string;
  username: string;
  /** Firestore Timestamp (serverTimestamp at create). */
  createdAt?: unknown;
  /** Super-admin uid that provisioned the account. */
  createdBy?: string;
}

/** `center_staff_credentials/{uid}` — admin-held password. God-mode read only. */
export interface CenterStaffCredentials {
  uid: string;
  centerId: string;
  password: string;
  updatedAt?: unknown;
}

/** Can this role record payments/expenses, or is it strictly read-only? */
export const canRecordMoney = (role: OfficeRole) => role === "accountant";

export const OFFICE_ROLE_LABELS: Record<OfficeRole, { uz: string; ru: string; en: string }> = {
  director: { uz: "Direktor", ru: "Директор", en: "Director" },
  accountant: { uz: "Buxgalter", ru: "Бухгалтер", en: "Accountant" },
};
