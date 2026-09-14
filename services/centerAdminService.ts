import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import type { ClassData, CenterTeacher } from '@/hooks/useCenterClasses';

// ─── Types ────────────────────────────────────────────────────
export type CenterStatus = 'pending' | 'active' | 'suspended';

export interface CenterDoc {
  id: string;
  name: string;
  slug: string;
  ownerUid: string;
  size?: string;
  // Approval gate: manager writes are rules-blocked unless 'active'.
  // Missing (legacy docs) counts as pending.
  status?: CenterStatus;
  subscription?: { plan?: string; validUntil?: string };
  createdAt?: any; // usually ISO string, but legacy docs hold Firestore Timestamps
  // Admin-only bookkeeping — never read outside the admin panel.
  adminStatus?: 'active' | 'archived';
  adminNotes?: string;
}

/** Normalizes the approval status (legacy docs have no field → pending). */
export function centerStatusOf(center: CenterDoc): CenterStatus {
  return center.status === 'active' || center.status === 'suspended' ? center.status : 'pending';
}

/**
 * Timestamps are inconsistent across this codebase (ISO string, Firestore
 * Timestamp, or epoch number). Normalize to millis for sorting/formatting;
 * unparseable/missing → 0.
 */
export function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return isNaN(t) ? 0 : t;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  return 0;
}

export interface ManagerInfo {
  uid: string;
  displayName?: string;
  email?: string;
  username?: string;
  phone?: string;
  photoURL?: string;
  isActive?: boolean;
  createdAt?: string;
  /** 'center-managed' = account provisioned by a center (docs/MANAGER.md). */
  accountType?: string;
}

export interface CenterSummary extends CenterDoc {
  manager: ManagerInfo | null;
  teacherCount: number;
  groupCount: number;
  studentCount: number; // unique students across all center groups
}

export interface CenterTeacherDetailed extends CenterTeacher {
  profile: ManagerInfo | null; // hydrated users/{teacherId} doc (same display fields)
  groupCount: number;
  studentCount: number;
}

export interface CenterDetailData {
  center: CenterDoc;
  manager: ManagerInfo | null;
  teachers: CenterTeacherDetailed[];
  classes: ClassData[];
  roomCount: number;
  uniqueStudentCount: number;
}

// ─── Utils ────────────────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/** Fetch users/{uid} docs for a uid list (chunked `documentId in` queries). */
async function fetchUsersByIds(uids: string[]): Promise<Map<string, ManagerInfo>> {
  const result = new Map<string, ManagerInfo>();
  if (uids.length === 0) return result;

  const snapshots = await Promise.all(
    chunkArray(Array.from(new Set(uids)), 10).map((chunk) =>
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
    )
  );
  for (const snap of snapshots) {
    for (const d of snap.docs) {
      const data = d.data();
      result.set(d.id, {
        uid: d.id,
        displayName: data.displayName,
        email: data.email,
        username: data.username,
        phone: data.phone,
        photoURL: data.photoURL,
        isActive: data.isActive,
        createdAt: data.createdAt,
        accountType: data.accountType,
      });
    }
  }
  return result;
}

/** Fetch all classes belonging to a set of centers (chunked `centerId in`) —
 *  centerId-anchored membership (2026-07-15), same as useCenterClasses. */
async function fetchClassesForCenters(centerIds: string[]): Promise<ClassData[]> {
  if (centerIds.length === 0) return [];
  const snapshots = await Promise.all(
    chunkArray(centerIds, 10).map((chunk) =>
      getDocs(query(collection(db, 'classes'), where('centerId', 'in', chunk)))
    )
  );
  const seen = new Set<string>();
  const classes: ClassData[] = [];
  for (const snap of snapshots) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        classes.push({ id: d.id, ...d.data() } as ClassData);
      }
    }
  }
  return classes;
}

// ─── Directory ────────────────────────────────────────────────
/**
 * Loads every center with its manager profile and teacher/group/student counts.
 * Query cost is flat: 1 (centers) + 1 (center_teachers) + ceil(T/10) (classes)
 * + ceil(M/10) (manager users) — fine for an internal directory.
 */
export async function fetchAllCenters(): Promise<CenterSummary[]> {
  const [centersSnap, ctSnap] = await Promise.all([
    getDocs(collection(db, 'centers')),
    getDocs(collection(db, 'center_teachers')),
  ]);

  const centers: CenterDoc[] = centersSnap.docs.map(
    (d) => ({ ...d.data(), id: d.id } as CenterDoc)
  );

  // teacherId → centerId (doc ID of center_teachers IS the teacher uid)
  const teacherToCenter = new Map<string, string>();
  const teachersPerCenter = new Map<string, number>();
  for (const d of ctSnap.docs) {
    const data = d.data();
    teacherToCenter.set(d.id, data.centerId);
    teachersPerCenter.set(data.centerId, (teachersPerCenter.get(data.centerId) || 0) + 1);
  }

  const [classes, managers] = await Promise.all([
    fetchClassesForCenters(centers.map((c) => c.id)),
    fetchUsersByIds(centers.map((c) => c.ownerUid).filter(Boolean)),
  ]);

  const groupsPerCenter = new Map<string, number>();
  const studentsPerCenter = new Map<string, Set<string>>();
  for (const cls of classes) {
    const centerId = cls.centerId;
    if (!centerId) continue;
    groupsPerCenter.set(centerId, (groupsPerCenter.get(centerId) || 0) + 1);
    const set = studentsPerCenter.get(centerId) || new Set<string>();
    (cls.studentIds || []).forEach((uid) => set.add(uid));
    studentsPerCenter.set(centerId, set);
  }

  const summaries: CenterSummary[] = centers.map((c) => ({
    ...c,
    manager: managers.get(c.ownerUid) || null,
    teacherCount: teachersPerCenter.get(c.id) || 0,
    groupCount: groupsPerCenter.get(c.id) || 0,
    studentCount: studentsPerCenter.get(c.id)?.size || 0,
  }));

  summaries.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return summaries;
}

// ─── Detail ───────────────────────────────────────────────────
export async function fetchCenterDetailData(centerId: string): Promise<CenterDetailData | null> {
  const centerSnap = await getDoc(doc(db, 'centers', centerId));
  if (!centerSnap.exists()) return null;
  const center = { ...centerSnap.data(), id: centerSnap.id } as CenterDoc;

  const [ctSnap, roomsSnap, managerMap] = await Promise.all([
    getDocs(query(collection(db, 'center_teachers'), where('centerId', '==', centerId))),
    getDocs(query(collection(db, 'rooms'), where('centerId', '==', centerId))),
    fetchUsersByIds(center.ownerUid ? [center.ownerUid] : []),
  ]);

  const centerTeachers: CenterTeacher[] = ctSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as CenterTeacher)
  );
  const teacherIds = centerTeachers.map((t) => t.teacherId);

  const [classes, teacherProfiles] = await Promise.all([
    fetchClassesForCenters([centerId]),
    fetchUsersByIds(teacherIds),
  ]);

  const uniqueStudents = new Set<string>();
  const groupsPerTeacher = new Map<string, number>();
  const studentsPerTeacher = new Map<string, Set<string>>();
  for (const cls of classes) {
    groupsPerTeacher.set(cls.teacherId, (groupsPerTeacher.get(cls.teacherId) || 0) + 1);
    const set = studentsPerTeacher.get(cls.teacherId) || new Set<string>();
    (cls.studentIds || []).forEach((uid) => {
      set.add(uid);
      uniqueStudents.add(uid);
    });
    studentsPerTeacher.set(cls.teacherId, set);
  }

  const teachers: CenterTeacherDetailed[] = centerTeachers.map((t) => ({
    ...t,
    profile: teacherProfiles.get(t.teacherId) || null,
    groupCount: groupsPerTeacher.get(t.teacherId) || 0,
    studentCount: studentsPerTeacher.get(t.teacherId)?.size || 0,
  }));

  return {
    center,
    manager: managerMap.get(center.ownerUid) || null,
    teachers,
    classes,
    roomCount: roomsSnap.size,
    uniqueStudentCount: uniqueStudents.size,
  };
}
