// ─── Multi-branch owner view (docs/MANAGER.md § "Multi-branch owner view") ───
// Both source collections are already legally client-readable — `centers` is
// `read: if isAuth()` unscoped, and `center_oversight`'s `list` is a plain
// `ownerUid ==` field compare — so listing "my branches" needs no API route.
// Only the WRITE (switching which branch is active) needs the Admin SDK,
// because `users.centerId` is locked against client update after signup.

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { managerApiFetch } from "@/lib/managerApi";
import type { BranchSummary } from "@/types/branch";

/**
 * Every branch this uid can operate: the one it directly owns (`centers` where
 * `ownerUid==uid`) UNION every `center_oversight` grant. Dedupes by centerId —
 * the direct-owner branch never also has an oversight doc in practice, but a
 * union is what makes this robust regardless.
 */
export async function fetchMyBranches(uid: string, activeCenterId: string | null): Promise<BranchSummary[]> {
  const [ownedSnap, oversightSnap] = await Promise.all([
    getDocs(query(collection(db, "centers"), where("ownerUid", "==", uid))),
    getDocs(query(collection(db, "center_oversight"), where("ownerUid", "==", uid))),
  ]);

  const byId = new Map<string, BranchSummary>();
  for (const d of ownedSnap.docs) {
    const data = d.data();
    byId.set(d.id, { centerId: d.id, centerName: data.name || "—", status: data.status, isActive: d.id === activeCenterId });
  }

  const missingIds = oversightSnap.docs.map((d) => d.data().centerId as string).filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const centerDocs = await Promise.all(missingIds.map((id) => getDoc(doc(db, "centers", id))));
    centerDocs.forEach((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      byId.set(snap.id, { centerId: snap.id, centerName: data.name || "—", status: data.status, isActive: snap.id === activeCenterId });
    });
  }

  return [...byId.values()].sort((a, b) => a.centerName.localeCompare(b.centerName));
}

export const switchBranchApi = (centerId: string) =>
  managerApiFetch<{ centerId: string }>("/api/manager/switch-branch", { method: "POST", body: { centerId } });
