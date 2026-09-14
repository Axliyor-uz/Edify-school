"use client";

import AttendanceGrid from "@/components/attendance/AttendanceGrid";
import type { ScheduleEntry } from "@/types/attendance";

interface Props {
  classId: string;
  centerId: string;
  studentIds: string[];
  managerId: string;
  schedule: ScheduleEntry[];
}

// Thin wrapper — the manager marks attendance through the same shared grid as
// the teacher. `managerId` is the recording user for this view.
export default function AttendanceTab({ classId, centerId, studentIds, managerId, schedule }: Props) {
  return (
    <AttendanceGrid
      classId={classId}
      centerId={centerId}
      studentIds={studentIds}
      recordedBy={managerId}
      schedule={schedule}
    />
  );
}
