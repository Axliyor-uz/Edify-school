// ─── Office staff client service (docs/OFFICE.md) ────────────────────────────
// The director / buxgalter panel reads exactly the same Firestore documents the
// manager panel does — `services/financeService.ts` and `attendanceService.ts`
// are reused verbatim, because the rules (not a second data layer) are what
// decide who may read them. This module only resolves WHO the caller is.

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOfficeRole, type CenterStaffLink } from "@/types/office";

/**
 * Resolve the signed-in user's office link — the panel's authorization anchor.
 *
 * ⚠️ Read `center_staff/{uid}`, never `users/{uid}.role`: the user doc is
 * client-writable, so anyone could paint themselves a `role: 'director'` and
 * walk into the panel. `center_staff` is `write: if false` for every client and
 * its doc id must equal the uid, so a doc coming back here was necessarily
 * written by the Admin SDK for THIS user. Returns null for everyone else —
 * the layout treats that as "not office staff" and redirects.
 */
export async function fetchOfficeLink(uid: string): Promise<CenterStaffLink | null> {
  const snap = await getDoc(doc(db, "center_staff", uid));
  if (!snap.exists()) return null;
  const data = snap.data() as CenterStaffLink;
  if (!data.centerId || !isOfficeRole(data.staffRole)) return null;
  return { ...data, uid: snap.id };
}

/** Every office account attached to a center — the manager's / admin's view. */
export async function fetchCenterOfficeStaff(centerId: string): Promise<CenterStaffLink[]> {
  const snap = await getDocs(query(collection(db, "center_staff"), where("centerId", "==", centerId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as CenterStaffLink), uid: d.id }))
    .filter((s) => isOfficeRole(s.staffRole))
    .sort((a, b) => a.name.localeCompare(b.name));
}
