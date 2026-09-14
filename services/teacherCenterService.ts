import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScheduleEntry } from '@/types/attendance';

// ─── Teacher ↔ center data (client-side) ─────────────────────────────────────
// The teacher's center groups. Membership is `classes.centerId`-anchored
// (docs/MANAGER.md — this replaced the old teacher-anchored derivation), so a
// group counts only when it carries BOTH this teacher's uid and this centerId:
// the teacher's personal classes and any other center's classes stay out.
//
// ⚠️ Never `where('teacherId','==',uid)`-query `center_teachers` from the teacher
// side — the list rule checks the doc-id wildcard, so it is not provable and
// fails with permission-denied. Resolve the center via `useTeacherCenter`
// (a direct `getDoc` on the uid-keyed doc) and pass the centerId in here.

export interface TeacherCenterGroup {
  id: string;
  title: string;
  description: string;
  studentIds: string[];
  schedule: ScheduleEntry[];
  /** Set on center IELTS groups — the group lives at /teacher/ielts/groups/{id}. */
  ieltsGroupId?: string;
}

/** Where the teacher opens this group. IELTS twins are hidden from /teacher/classes. */
export function groupHref(group: TeacherCenterGroup): string {
  return group.ieltsGroupId
    ? `/teacher/ielts/groups/${group.ieltsGroupId}`
    : `/teacher/classes/${group.id}`;
}

const cache: Record<string, { groups: TeacherCenterGroup[]; timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000;

/**
 * The teacher's groups in this center. Cached 60s per (teacher, center) —
 * the hub renders several tabs off the same list and the dashboard reads it too.
 */
export async function fetchTeacherCenterGroups(
  teacherId: string,
  centerId: string,
): Promise<TeacherCenterGroup[]> {
  if (!teacherId || !centerId) return [];

  const key = `${teacherId}_${centerId}`;
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_LIFESPAN) return cached.groups;

  // Single-field equality query (auto-indexed); the centerId filter is applied
  // client-side so no composite index is needed for this new read path.
  const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)));

  const groups: TeacherCenterGroup[] = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((c) => c.centerId === centerId)
    .map((c) => ({
      id: c.id,
      title: c.title || '',
      description: c.description || '',
      studentIds: Array.isArray(c.studentIds) ? c.studentIds : [],
      schedule: Array.isArray(c.schedule) ? c.schedule : [],
      ...(c.ieltsGroupId ? { ieltsGroupId: c.ieltsGroupId } : {}),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  cache[key] = { groups, timestamp: Date.now() };
  return groups;
}

/** Drop the cached groups for a teacher+center (call after a roster/schedule write). */
export function invalidateTeacherCenterGroups(teacherId: string, centerId: string): void {
  delete cache[`${teacherId}_${centerId}`];
}

/** Unique students across the teacher's center groups (one student, many groups → 1). */
export function uniqueStudentCount(groups: TeacherCenterGroup[]): number {
  const seen = new Set<string>();
  for (const g of groups) for (const uid of g.studentIds) seen.add(uid);
  return seen.size;
}
