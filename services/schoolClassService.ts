// ─── School Classes (grade + subjects) ────────────────────────────────────────
// A `school_classes/{centerId}_{grade}_{section}` doc (e.g. "5-A") is a grade-level
// container holding several `classes` docs as "subjects" (each still a normal
// teacher-led class doc — finance/attendance/attempts all keep working unmodified).
// The School Class doc is the ROSTER SOURCE OF TRUTH: every subject's `studentIds`
// must mirror it. See docs/MANAGER.md "School Classes" for the full contract —
// this is the same "keep the mirror in sync" invariant as the ielts_groups twin
// (services/ieltsService.ts::managedRosterBatch), just N-way instead of 1:1.

import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTodayKey, toDateKey, monthKeyOf } from "@/lib/dateUtils";
import { patchStudentFinanceApi } from "@/services/financeService";
import { fetchCenterSessions, rateOfSessions, tallyStudent } from "@/services/attendanceService";
import { fetchOpenCharges, fetchPaymentsForMonth, openAmountOf } from "@/services/financeService";
import type { ClassData } from "@/hooks/useCenterClasses";

export interface SchoolClassData {
  id: string;
  centerId: string;
  grade: string; // "1".."11"
  section: string; // manager-entered, trimmed + uppercased
  displayName: string; // `${grade}-${section}`
  studentIds: string[];
  createdAt: any;
  createdBy: string;
}

export const GRADE_OPTIONS = Array.from({ length: 11 }, (_, i) => String(i + 1));

export function schoolClassDocId(centerId: string, grade: string, section: string): string {
  return `${centerId}_${grade}_${section}`;
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/** Partition a center's classes array (from useCenterClasses) with no extra reads. */
export function partitionClasses(classes: ClassData[], schoolClassId?: string) {
  if (schoolClassId) return classes.filter((c) => (c as any).schoolClassId === schoolClassId);
  // "Unlinked" = plain ordinary groups that aren't a school-class subject and aren't an IELTS group.
  return classes.filter((c) => !(c as any).schoolClassId && !c.ieltsGroupId);
}

export async function fetchSchoolClasses(centerId: string): Promise<SchoolClassData[]> {
  const snap = await getDocs(query(collection(db, "school_classes"), where("centerId", "==", centerId)));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SchoolClassData[];
  list.sort((a, b) => Number(a.grade) - Number(b.grade) || a.section.localeCompare(b.section));
  return list;
}

export async function createSchoolClass(
  centerId: string,
  grade: string,
  section: string,
  uid: string
): Promise<SchoolClassData> {
  const cleanSection = section.trim().toUpperCase();
  if (!cleanSection) throw new Error("EMPTY_SECTION");
  const id = schoolClassDocId(centerId, grade, cleanSection);
  const ref = doc(db, "school_classes", id);

  const data: Omit<SchoolClassData, "id"> = {
    centerId,
    grade,
    section: cleanSection,
    displayName: `${grade}-${cleanSection}`,
    studentIds: [],
    createdAt: serverTimestamp(),
    createdBy: uid,
  };
  // A plain getDoc()-then-setDoc() check has a TOCTOU race: once the doc
  // exists, Firestore rules evaluate a setDoc as `update` (not `create`), so
  // a racing duplicate would silently overwrite studentIds instead of
  // failing. A transaction re-reads on conflict and is race-safe.
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) throw new Error("ALREADY_EXISTS");
    tx.set(ref, data);
  });
  return { id, ...data };
}

/** Delete a School Class — caller must ensure it has zero linked subjects first. */
export async function deleteSchoolClass(schoolClassId: string): Promise<void> {
  await deleteDoc(doc(db, "school_classes", schoolClassId));
}

/** New subject slot — inherits the School Class's CURRENT roster immediately. */
export async function addSubjectGroup(
  schoolClass: SchoolClassData,
  title: string,
  teacherId: string,
  teacherName: string
): Promise<string> {
  const ref = await addDoc(collection(db, "classes"), {
    title: title.trim(),
    description: "",
    joinCode: generateJoinCode(), // schema-shape parity only — center-group self-join is rules-blocked
    centerId: schoolClass.centerId,
    teacherId,
    teacherName,
    studentIds: [...schoolClass.studentIds],
    studentCount: 0,
    isLocked: false,
    schedule: [],
    createdAt: serverTimestamp(),
    schoolClassId: schoolClass.id,
    schoolClassName: schoolClass.displayName,
  });
  return ref.id;
}

/** Remove a subject slot. Attendance/attempts history is kept (append-only, same as the IELTS pair-delete). */
export async function removeSubjectGroup(classId: string): Promise<void> {
  await deleteDoc(doc(db, "classes", classId));
}

/**
 * The roster fan-out: one batch updates the School Class doc AND every subject
 * `classes` doc under it. A lone `classes.studentIds` edit on a subject would
 * desync the shared roster — always go through this.
 */
export async function syncSchoolClassRoster(
  centerId: string,
  schoolClassId: string,
  subjectClassIds: string[],
  uids: string[],
  op: "add" | "remove",
  studentNames?: Record<string, string>
): Promise<void> {
  if (uids.length === 0) return;
  const fv = op === "add" ? arrayUnion(...uids) : arrayRemove(...uids);
  const batch = writeBatch(db);
  batch.update(doc(db, "school_classes", schoolClassId), { studentIds: fv });
  for (const classId of subjectClassIds) {
    batch.update(doc(db, "classes", classId), { studentIds: fv });
  }
  if (op === "add") {
    for (const uid of uids) {
      batch.set(
        doc(db, "center_students", `${centerId}_${uid}`),
        { centerId, studentId: uid, studentName: studentNames?.[uid] || "", source: "enrolled", addedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }
  await batch.commit();

  if (op === "add") {
    const today = getTodayKey();
    for (const uid of uids) {
      for (const classId of subjectClassIds) {
        patchStudentFinanceApi(uid, { enrollmentDates: { [classId]: today } }).catch(() => {});
      }
    }
  }
}

/**
 * Migration action: attach an existing standalone center group as a subject.
 * Unions its current roster into the School Class roster, then fans the union
 * out to every subject (including the newly attached one).
 */
export async function attachExistingGroupToSchoolClass(
  schoolClass: SchoolClassData,
  group: { id: string; studentIds: string[] },
  otherSubjectClassIds: string[]
): Promise<void> {
  const unionIds = Array.from(new Set([...schoolClass.studentIds, ...(group.studentIds || [])]));
  const batch = writeBatch(db);
  batch.update(doc(db, "school_classes", schoolClass.id), { studentIds: unionIds });
  batch.update(doc(db, "classes", group.id), {
    schoolClassId: schoolClass.id,
    schoolClassName: schoolClass.displayName,
    studentIds: unionIds,
  });
  for (const classId of otherSubjectClassIds) {
    batch.update(doc(db, "classes", classId), { studentIds: unionIds });
  }
  await batch.commit();
}

// ─── Statistics (attendance + academic + finance rollup) ─────────────────────

export interface SchoolClassSubjectStat {
  classId: string;
  title: string;
  teacherName: string;
  attendanceRate: number | null;
  avgScorePct: number | null;
  collected: number;
  due: number;
}

export interface SchoolClassStudentStat {
  uid: string;
  attendanceRate: number | null;
  avgScorePct: number | null;
  due: number;
}

export interface SchoolClassStats {
  studentCount: number;
  attendanceRate: number | null;
  collected: number;
  due: number;
  avgScorePct: number | null;
  perSubject: SchoolClassSubjectStat[];
  perStudent: Record<string, SchoolClassStudentStat>;
}

function avgOf(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

export async function fetchSchoolClassStats(
  centerId: string,
  schoolClass: SchoolClassData,
  subjects: { id: string; title: string; teacherName: string }[]
): Promise<SchoolClassStats> {
  const subjectClassIds = subjects.map((s) => s.id);
  const todayKey = getTodayKey();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);
  const startKey = toDateKey(windowStart);
  const monthKey = monthKeyOf(todayKey);

  const [allSessions, openCharges, monthPayments, attemptsBySubject] = await Promise.all([
    fetchCenterSessions(centerId, startKey, todayKey),
    fetchOpenCharges(centerId),
    fetchPaymentsForMonth(centerId, monthKey),
    Promise.all(
      subjectClassIds.map(async (classId) => {
        const snap = await getDocs(
          query(collection(db, "attempts"), where("classId", "==", classId), where("type", "==", "assignment"))
        );
        return { classId, attempts: snap.docs.map((d) => d.data() as any) };
      })
    ),
  ]);

  const classSessions = allSessions.filter((s) => subjectClassIds.includes(s.classId));
  const classCharges = openCharges.filter((c) => subjectClassIds.includes(c.classId));
  const due = classCharges.reduce((sum, c) => sum + openAmountOf(c), 0);
  const collected = monthPayments
    .filter((p) => p.status === "confirmed")
    .reduce(
      (sum, p) =>
        sum +
        p.allocations
          .filter((a) => subjectClassIds.includes(a.chargeId.split("_")[0]))
          .reduce((s, a) => s + a.amount, 0),
      0
    );

  const overallRate = rateOfSessions(classSessions, todayKey).rate;

  const allScores = attemptsBySubject.flatMap((s) =>
    s.attempts
      .filter((a) => a.totalQuestions > 0)
      .map((a) => Math.round((a.score / a.totalQuestions) * 100))
  );

  const perSubject: SchoolClassSubjectStat[] = subjects.map((subj) => {
    const subjSessions = classSessions.filter((s) => s.classId === subj.id);
    const subjCharges = classCharges.filter((c) => c.classId === subj.id);
    const subjCollected = monthPayments
      .filter((p) => p.status === "confirmed")
      .reduce(
        (sum, p) => sum + p.allocations.filter((a) => a.chargeId.split("_")[0] === subj.id).reduce((s, a) => s + a.amount, 0),
        0
      );
    const subjAttempts = attemptsBySubject.find((a) => a.classId === subj.id)?.attempts || [];
    const subjScores = subjAttempts.filter((a) => a.totalQuestions > 0).map((a) => Math.round((a.score / a.totalQuestions) * 100));
    return {
      classId: subj.id,
      title: subj.title,
      teacherName: subj.teacherName,
      attendanceRate: rateOfSessions(subjSessions, todayKey).rate,
      avgScorePct: avgOf(subjScores),
      collected: subjCollected,
      due: subjCharges.reduce((sum, c) => sum + openAmountOf(c), 0),
    };
  });

  const perStudent: Record<string, SchoolClassStudentStat> = {};
  for (const uid of schoolClass.studentIds) {
    const tally = tallyStudent(classSessions, uid, todayKey);
    const studentScores = attemptsBySubject
      .flatMap((s) => s.attempts)
      .filter((a) => a.userId === uid && a.totalQuestions > 0)
      .map((a) => Math.round((a.score / a.totalQuestions) * 100));
    const studentDue = classCharges
      .filter((c) => c.studentId === uid)
      .reduce((sum, c) => sum + openAmountOf(c), 0);
    perStudent[uid] = { uid, attendanceRate: tally.rate, avgScorePct: avgOf(studentScores), due: studentDue };
  }

  return {
    studentCount: schoolClass.studentIds.length,
    attendanceRate: overallRate,
    collected,
    due,
    avgScorePct: avgOf(allScores),
    perSubject,
    perStudent,
  };
}
