import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceStatus, CaptureMethod, ScheduleEntry } from "@/types/attendance";
import type { ClassData } from "@/hooks/useCenterClasses";
import type { CenterSession } from "@/services/attendanceService";

// ─── Walk-in (front-desk) check-in ───────────────────────────────────────────
// Student-centric attendance: a student walks in, the manager finds them by name
// and marks them present for every lesson they have today (across all groups).
//
// This is the ENGINE-AGNOSTIC core of attendance capture. The manual search UI
// (`WalkInCheckIn.tsx`) and the future face-recognition kiosk (Phase 4) both call
// `checkInStudent()` — the only difference is where the uid + `method` come from.
//
// Data model is unchanged: writes go to the same `center_attendance/{classId}_{date}`
// docs the grid reads (see docs/ATTENDANCE.md). Writes are SURGICAL — they merge a
// single student's record without disturbing anyone else's marks.

/** One searchable student in the center roster (union of all groups' students). */
export interface RosterStudent {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  phone?: string;
  /** Ids of the center classes this student belongs to. */
  classIds: string[];
}

/** A lesson the selected student has today, with their current mark (if any). */
export interface TodayLesson {
  classId: string;
  title: string;
  teacherName: string;
  /** "HH:MM–HH:MM" for today's slot, or "" if unknown (e.g. makeup with no schedule row). */
  time: string;
  lessonStatus: "held" | "makeup";
  /** The student's existing status for today, if already marked. */
  currentStatus: AttendanceStatus | null;
}

function scheduleToday(schedule: ScheduleEntry[] | undefined, weekday: number): ScheduleEntry | undefined {
  return (schedule || []).find((s) => s.dayOfWeek === weekday);
}

/**
 * Build the center's searchable student roster: the deduped union of `studentIds`
 * across every center class, hydrated with profile fields for name search.
 * Called lazily (only when the walk-in tab opens) — students carry no `centerId`,
 * so the class rosters are the only source of "who belongs to this center".
 */
export async function buildCenterRoster(classes: ClassData[]): Promise<RosterStudent[]> {
  const classIdsByUid = new Map<string, string[]>();
  for (const cls of classes) {
    for (const uid of cls.studentIds || []) {
      const arr = classIdsByUid.get(uid);
      if (arr) arr.push(cls.id);
      else classIdsByUid.set(uid, [cls.id]);
    }
  }

  const uids = Array.from(classIdsByUid.keys());
  if (uids.length === 0) return [];

  const snaps = await Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid))));
  const roster: RosterStudent[] = [];
  snaps.forEach((snap, i) => {
    if (!snap.exists()) return;
    const uid = uids[i];
    const data = snap.data();
    roster.push({
      uid,
      displayName: data?.displayName || "Noma'lum",
      username: data?.username,
      photoURL: data?.photoURL,
      phone: data?.phone,
      classIds: classIdsByUid.get(uid) || [],
    });
  });

  roster.sort((a, b) => a.displayName.localeCompare(b.displayName, "uz", { sensitivity: "base" }));
  return roster;
}

/**
 * Resolve the lessons a student has today. Includes a class when it either has a
 * lesson scheduled today (and isn't cancelled/holiday) or has a persisted makeup
 * lesson for today. Reads each candidate day-doc to surface the current mark.
 */
export async function resolveTodayLessons(
  student: RosterStudent,
  classes: ClassData[],
  todayKey: string,
  todayWeekday: number
): Promise<TodayLesson[]> {
  const studentClasses = classes.filter((c) => student.classIds.includes(c.id));

  const results = await Promise.all(
    studentClasses.map(async (cls) => {
      const slot = scheduleToday(cls.schedule, todayWeekday);
      const ref = doc(db, "center_attendance", `${cls.id}_${todayKey}`);
      let lessonStatus: string = "held";
      let currentStatus: AttendanceStatus | null = null;
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          lessonStatus = (data.lessonStatus as string) || "held";
          const rec = data.records?.[student.uid];
          const status = typeof rec === "string" ? rec : rec?.status;
          if (status) currentStatus = status as AttendanceStatus;
        }
      } catch {
        // read failure → treat as unmarked "held"; the write path will still work.
      }

      const scheduledToday = !!slot;
      const isMakeup = lessonStatus === "makeup";
      const cancelled = lessonStatus === "cancelled" || lessonStatus === "holiday";

      // Not a lesson today: neither scheduled (and held) nor a makeup.
      if ((!scheduledToday || cancelled) && !isMakeup) return null;

      const lesson: TodayLesson = {
        classId: cls.id,
        title: cls.title,
        teacherName: cls.teacherName || "",
        time: slot ? `${slot.startTime}–${slot.endTime}` : "",
        lessonStatus: isMakeup ? "makeup" : "held",
        currentStatus,
      };
      return lesson;
    })
  );

  return results.filter((l): l is TodayLesson => l !== null);
}

/**
 * Pure, read-free version of `resolveTodayLessons` for the UI. Given today's
 * sessions already fetched in ONE query (keyed by classId), compute a student's
 * lessons synchronously — so the check-in dialog opens instantly and the list can
 * show a live "marked / pending / no lesson" status without a read per student.
 */
export function computeTodayLessons(
  student: RosterStudent,
  classes: ClassData[],
  sessionByClass: Map<string, CenterSession>,
  todayWeekday: number
): TodayLesson[] {
  const out: TodayLesson[] = [];
  for (const cls of classes) {
    if (!student.classIds.includes(cls.id)) continue;
    const slot = scheduleToday(cls.schedule, todayWeekday);
    const session = sessionByClass.get(cls.id);
    const lessonStatus = session?.lessonStatus || "held";
    const scheduledToday = !!slot;
    const isMakeup = lessonStatus === "makeup";
    const cancelled = lessonStatus === "cancelled" || lessonStatus === "holiday";
    if ((!scheduledToday || cancelled) && !isMakeup) continue;
    const currentStatus = (session?.records?.[student.uid]?.status as AttendanceStatus) ?? null;
    out.push({
      classId: cls.id,
      title: cls.title,
      teacherName: cls.teacherName || "",
      time: slot ? `${slot.startTime}–${slot.endTime}` : "",
      lessonStatus: isMakeup ? "makeup" : "held",
      currentStatus,
    });
  }
  return out;
}

/** Roll a student's today-lessons into a single board status. */
export type TodayBoardStatus = "none" | "pending" | "done";
export function boardStatusOf(lessons: TodayLesson[]): TodayBoardStatus {
  if (lessons.length === 0) return "none";
  return lessons.every((l) => l.currentStatus !== null) ? "done" : "pending";
}

/**
 * Mark one student in one class for one day — a SURGICAL merge that preserves
 * every other student's record (and `createdAt` / `lessonStatus`). Creates the
 * day-doc as a plain "held" lesson if it doesn't exist yet.
 */
export async function checkInStudent(params: {
  classId: string;
  centerId: string;
  uid: string;
  status: AttendanceStatus;
  markedBy: string;
  date: string; // "YYYY-MM-DD" (Asia/Tashkent)
  weekday: number; // 0-6
  method?: CaptureMethod;
  confidence?: number;
}): Promise<void> {
  const { classId, centerId, uid, status, markedBy, date, weekday } = params;
  const ref = doc(db, "center_attendance", `${classId}_${date}`);

  // Build the record conditionally — Firestore rejects `undefined`.
  const record: Record<string, unknown> = {
    status,
    method: params.method || "manual",
    markedBy,
    markedAt: Timestamp.now(),
  };
  if (typeof params.confidence === "number") record.confidence = params.confidence;

  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      [`records.${uid}`]: record,
      recordedBy: markedBy,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      id: `${classId}_${date}`,
      classId,
      centerId,
      date,
      weekday,
      lessonStatus: "held",
      records: { [uid]: record },
      recordedBy: markedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
