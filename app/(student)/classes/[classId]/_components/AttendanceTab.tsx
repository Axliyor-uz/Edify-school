'use client';

// Thin wrapper — the real view lives in components/attendance/StudentAttendanceView,
// shared with the IELTS group page's attendance tab (docs/ATTENDANCE.md).
import StudentAttendanceView from '@/components/attendance/StudentAttendanceView';

export default function AttendanceTab({ classId, userId }: { classId: string; userId: string }) {
  return <StudentAttendanceView classId={classId} userId={userId} />;
}
