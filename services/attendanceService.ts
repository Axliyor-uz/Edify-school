import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceStatus, LessonStatus, StaffAttendanceStatus } from "@/types/attendance";

// ─── Attendance analytics helpers ────────────────────────────────────────────
// Pure aggregation logic + center-wide fetch, shared by the grid (per-student %)
// and the manager dashboard. Keep data logic here, not inline in components.

/** A session flattened to just what analytics needs. */
export interface CenterSession {
  id: string;
  classId: string;
  centerId: string;
  date: string; // YYYY-MM-DD
  weekday: number;
  lessonStatus: LessonStatus;
  records: Record<string, { status: AttendanceStatus }>;
}

export interface StudentTally {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** present + late */
  attended: number;
  /** attended + absent (excused excluded) */
  denom: number;
  /** attended / denom, or null when no counted lessons yet. */
  rate: number | null;
}

const EMPTY_TALLY: StudentTally = { present: 0, late: 0, absent: 0, excused: 0, attended: 0, denom: 0, rate: null };

/** A lesson counts toward stats once it has actually occurred (past/today) and wasn't cancelled/holiday. */
export function isCountedLesson(lessonStatus: LessonStatus, date: string, todayKey: string): boolean {
  return (lessonStatus === "held" || lessonStatus === "makeup") && date <= todayKey;
}

function finalize(t: Omit<StudentTally, "rate">): StudentTally {
  return { ...t, rate: t.denom > 0 ? Math.round((t.attended / t.denom) * 100) : null };
}

/**
 * Per-student tally from any set of sessions the student may appear in.
 * `records` values are already normalized to `{ status }`.
 */
export function tallyStudent(sessions: CenterSession[], uid: string, todayKey: string): StudentTally {
  const t = { ...EMPTY_TALLY };
  for (const s of sessions) {
    if (!isCountedLesson(s.lessonStatus, s.date, todayKey)) continue;
    const status = s.records[uid]?.status;
    if (!status) continue;
    t[status] += 1;
    if (status === "present" || status === "late") t.attended += 1;
    if (status !== "excused") t.denom += 1;
  }
  return finalize(t);
}

/** Aggregate a rate over many records (e.g. a whole group or the whole center). */
export function rateOfSessions(sessions: CenterSession[], todayKey: string): { attended: number; denom: number; rate: number | null } {
  let attended = 0, denom = 0;
  for (const s of sessions) {
    if (!isCountedLesson(s.lessonStatus, s.date, todayKey)) continue;
    for (const uid of Object.keys(s.records)) {
      const status = s.records[uid].status;
      if (status === "present" || status === "late") { attended += 1; denom += 1; }
      else if (status === "absent") { denom += 1; }
      // excused excluded
    }
  }
  return { attended, denom, rate: denom > 0 ? Math.round((attended / denom) * 100) : null };
}

/** Normalize a raw Firestore records map (tolerates the legacy string shape). */
export function normalizeRecords(raw: unknown): Record<string, { status: AttendanceStatus }> {
  const out: Record<string, { status: AttendanceStatus }> = {};
  if (raw && typeof raw === "object") {
    for (const uid of Object.keys(raw as Record<string, unknown>)) {
      const v = (raw as Record<string, unknown>)[uid];
      const status = typeof v === "string" ? v : (v as { status?: string } | null)?.status;
      if (status) out[uid] = { status: status as AttendanceStatus };
    }
  }
  return out;
}

/** Fetch every session for a center within [startKey, endKey] (needs the centerId+date index). */
export async function fetchCenterSessions(centerId: string, startKey: string, endKey: string): Promise<CenterSession[]> {
  const qy = query(
    collection(db, "center_attendance"),
    where("centerId", "==", centerId),
    where("date", ">=", startKey),
    where("date", "<=", endKey)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      classId: data.classId,
      centerId: data.centerId,
      date: data.date,
      weekday: data.weekday ?? 0,
      lessonStatus: (data.lessonStatus as LessonStatus) || "held",
      records: normalizeRecords(data.records),
    };
  });
}

// ─── Staff (teacher) attendance ──────────────────────────────────────────────

export interface StaffSession {
  id: string; // `${staffUid}_${date}`
  centerId: string;
  staffUid: string;
  date: string;
  weekday: number;
  status: StaffAttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  note?: string;
}

/** Hours between two "HH:MM" times, 1-decimal; null if invalid/negative. */
export function hoursBetween(checkIn?: string, checkOut?: string): number | null {
  if (!checkIn || !checkOut) return null;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return null;
  const mins = oh * 60 + om - (ih * 60 + im);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 10) / 10;
}

/** Fetch staff attendance for a center within [startKey, endKey] (needs centerId+date index). */
export async function fetchStaffSessions(centerId: string, startKey: string, endKey: string): Promise<StaffSession[]> {
  const qy = query(
    collection(db, "center_staff_attendance"),
    where("centerId", "==", centerId),
    where("date", ">=", startKey),
    where("date", "<=", endKey)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      centerId: data.centerId,
      staffUid: data.staffUid,
      date: data.date,
      weekday: data.weekday ?? 0,
      status: (data.status as StaffAttendanceStatus) || "present",
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      hoursWorked: data.hoursWorked,
      note: data.note,
    };
  });
}
