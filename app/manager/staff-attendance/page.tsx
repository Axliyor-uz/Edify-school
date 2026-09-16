"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { UserCheck, Users, Loader2, ScanFace, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { useCenterEmployees } from "@/hooks/useCenterEmployees";
import StaffAttendanceGrid from "@/components/attendance/StaffAttendanceGrid";
import FaceTerminalStatus from "@/components/attendance/FaceTerminalStatus";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Xodimlar davomati",
    subtitle: "O'qituvchilar davomati, kelish-ketish va soatlarni belgilang",
    staffFallback: "Xodim",
    staffCount: (n: number) => `${n} xodim`,
    faceConfig: "Face ID",
  },
  en: {
    title: "Staff attendance",
    subtitle: "Track teachers' attendance, check-in/out and hours",
    staffFallback: "Staff member",
    staffCount: (n: number) => `${n} staff`,
    faceConfig: "Face ID",
  },
  ru: {
    title: "Посещаемость сотрудников",
    subtitle: "Отмечайте посещаемость, приход-уход и часы учителей",
    staffFallback: "Сотрудник",
    staffCount: (n: number) => `${n} сотрудников`,
    faceConfig: "Face ID",
  },
};
type PageT = typeof TRANSLATIONS.uz;

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { teachers, isLoading: teachersLoading } = useCenterClasses(centerId);
  // 🟢 (docs/EMPLOYEES.md) Non-teaching staff share this SAME grid/collection —
  // an employee's roster doc id doubles as its center_staff_attendance.staffUid.
  const { employees, isLoading: employeesLoading } = useCenterEmployees(centerId);
  const isLoading = teachersLoading || employeesLoading;

  const staff = useMemo(
    () => [
      ...teachers.map((tch) => ({ uid: tch.teacherId, name: tch.teacherName || tch.teacherEmail || t.staffFallback })),
      ...employees.map((e) => ({ uid: e.id, name: e.employeeName || t.staffFallback })),
    ].sort((a, b) => a.name.localeCompare(b.name, "uz", { sensitivity: "base" })),
    [teachers, employees, t]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <UserCheck className="text-primary" size={24} /> {t.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Face terminal status badge */}
          <FaceTerminalStatus />

          {/* Face ID config link */}
          <Link
            href="/manager/face-config"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-bold text-on-surface-variant hover:bg-state-hover hover:text-primary transition-colors"
          >
            <ScanFace size={13} /> {t.faceConfig}
          </Link>

          {!isLoading && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
              <Users size={14} className="text-on-surface-variant" /> {t.staffCount(staff.length)}
            </span>
          )}
        </div>
      </div>

      {!centerId && isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={30} /></div>
      ) : (
        <StaffAttendanceGrid
          centerId={centerId || ""}
          managerId={user?.uid || ""}
          staff={staff}
          loadingStaff={isLoading}
        />
      )}
    </div>
  );
}
