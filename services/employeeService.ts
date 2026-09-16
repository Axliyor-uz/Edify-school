// ─── Non-teaching employee roster (docs/EMPLOYEES.md) ────────────────────────
// Plain client Firestore reads/writes, gated by `isActiveCenterManager` rules
// — mirrors the `rooms` collection pattern, NOT the teacher/office-staff
// account pattern: an employee has no Auth account, so there is nothing here
// that goes through an API route (salary is the one exception — that's in
// services/financeService.ts, the finance module's own API-writes-only
// convention for anything payroll-adjacent).

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmployeeRole } from "@/types/employee";
import type { CenterEmployeeLink } from "@/types/employee";

const linkFromDoc = (d: { id: string; data: () => any }): CenterEmployeeLink => ({
  ...(d.data() as CenterEmployeeLink),
  id: d.id,
});

export async function fetchCenterEmployees(centerId: string): Promise<CenterEmployeeLink[]> {
  const snap = await getDocs(query(collection(db, "center_employees"), where("centerId", "==", centerId)));
  return snap.docs.map(linkFromDoc);
}

export async function createEmployee(params: {
  centerId: string;
  employeeName: string;
  role: EmployeeRole;
  phone?: string;
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "center_employees"), {
    centerId: params.centerId,
    employeeName: params.employeeName.trim(),
    role: params.role,
    ...(params.phone?.trim() ? { phone: params.phone.trim() } : {}),
    createdBy: params.createdBy,
    addedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEmployee(
  employeeId: string,
  patch: Partial<Pick<CenterEmployeeLink, "employeeName" | "role" | "phone">>,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (patch.employeeName !== undefined) clean.employeeName = patch.employeeName.trim();
  if (patch.role !== undefined) clean.role = patch.role;
  if (patch.phone !== undefined) clean.phone = patch.phone.trim();
  await updateDoc(doc(db, "center_employees", employeeId), clean);
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await deleteDoc(doc(db, "center_employees", employeeId));
}
