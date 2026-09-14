import type { Timestamp } from "firebase/firestore";

// ─── Shared attendance domain types ──────────────────────────────────────────
// Single source of truth for the attendance system. Import these everywhere
// instead of re-declaring `AttendanceStatus` / `ScheduleEntry` per component.

/** Weekly lesson slot on `classes/{id}.schedule`. dayOfWeek: 0=Sun..6=Sat, times "HH:MM" (24h). */
export interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Assigned room for this slot (center-only; optional so non-center classes are unaffected). */
  roomId?: string;
  roomName?: string;
}

/** Per-student attendance status for a single lesson. */
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

/** Lifecycle of a lesson-day (the whole session, not one student). */
export type LessonStatus = "held" | "cancelled" | "holiday" | "makeup";

/** How a mark was captured. Extensible — face is wired in Phase 4. */
export type CaptureMethod = "manual" | "face";

/** One student's record inside a session's `records` map. */
export interface AttendanceRecord {
  status: AttendanceStatus;
  method: CaptureMethod;
  /** uid of the teacher/manager who set it, or "system:face". */
  markedBy: string;
  /** Client Timestamp set when this specific cell changed (preserved on partial writes). */
  markedAt: Timestamp;
  /** Reason/comment — most useful for `excused` / `absent`. */
  note?: string;
  /** 0-1 match confidence, `method === "face"` only. */
  confidence?: number;
}

/** `center_attendance/{classId}_{YYYY-MM-DD}` — one student session per class per day. */
export interface AttendanceSessionDoc {
  id: string; // `${classId}_${date}`
  classId: string;
  centerId: string;
  date: string; // "YYYY-MM-DD", Asia/Tashkent
  weekday: number; // 0-6
  lessonStatus: LessonStatus;
  cancelReason?: string;
  records: Record<string, AttendanceRecord>; // keyed by student uid
  recordedBy: string; // last editor uid
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Teacher/staff attendance — `center_staff_attendance/{staffUid}_{YYYY-MM-DD}`. */
export type StaffAttendanceStatus = "present" | "late" | "absent" | "leave" | "holiday";

export interface StaffAttendanceDoc {
  id: string; // `${staffUid}_${date}`
  centerId: string;
  staffUid: string;
  staffName: string;
  date: string; // "YYYY-MM-DD", Asia/Tashkent
  weekday: number; // 0-6
  status: StaffAttendanceStatus;
  checkIn?: string; // "HH:MM"
  checkOut?: string; // "HH:MM"
  hoursWorked?: number;
  method: CaptureMethod;
  markedBy: string; // manager uid or "system:face"
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Face enrollment (Phase 4) — `face_enrollments/{uid}`. Shape fixed now; engine chosen later. */
export interface FaceEnrollmentDoc {
  uid: string;
  centerId: string;
  role: "student" | "teacher";
  descriptor: number[]; // face embedding
  photoPath?: string; // Storage: centers/{centerId}/faces/{uid}/{ts}.jpg
  active: boolean;
  version: number;
  enrolledBy: string;
  enrolledAt: Timestamp;
}

/** Monthly rollup for fast analytics reads — `center_attendance_summary/{classId}_{YYYY-MM}`. */
export interface AttendanceSummaryDoc {
  id: string; // `${classId}_${month}`
  classId: string;
  centerId: string;
  month: string; // "YYYY-MM"
  heldSessions: number;
  perStudent: Record<
    string,
    { present: number; late: number; absent: number; excused: number; rate: number }
  >;
  totals: { present: number; late: number; absent: number; excused: number };
  updatedAt: Timestamp;
}

/** Face terminal event — `face_events/{id}`. Written by Cloud Functions (hikPollAttendance). */
export interface FaceEventDoc {
  id: string;
  centerId: string;
  staffUid: string;
  staffName: string;
  role: string;
  /** Local ISO time: 'YYYY-MM-DDTHH:mm:ss' (Asia/Tashkent). */
  at: string;
  kind: "checkin" | "checkout";
  source: string;
  /** Set to true after the client processes it into center_staff_attendance. */
  processed: boolean;
}
