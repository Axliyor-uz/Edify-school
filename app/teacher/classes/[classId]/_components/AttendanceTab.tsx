"use client";

import AttendanceGrid from "@/components/attendance/AttendanceGrid";
import type { ScheduleEntry } from "@/types/attendance";

interface Props {
  classId: string;
  centerId: string;
  studentIds: string[];
  recordedBy: string;
  schedule: ScheduleEntry[];
}

// Thin wrapper — the real spreadsheet lives in the shared AttendanceGrid,
// used by both the teacher and manager attendance views.
export default function AttendanceTab({ classId, centerId, studentIds, recordedBy, schedule }: Props) {
  return (
    <AttendanceGrid
      classId={classId}
      centerId={centerId}
      studentIds={studentIds}
      recordedBy={recordedBy}
      schedule={schedule}
    />
  );
}
