"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, GraduationCap, Wallet, Users2 } from "lucide-react";
import { ClassData } from "@/hooks/useCenterClasses";
import { SchoolClassData, fetchSchoolClassStats, SchoolClassStats } from "@/services/schoolClassService";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    students: "O'quvchilar",
    attendance: "Davomat (30 kun)",
    academic: "O'rtacha ball",
    finance: "Moliya (shu oy)",
    collected: "Yig'ildi",
    due: "Qarzdorlik",
    noData: "Ma'lumot yo'q",
    perSubject: "Fanlar kesimida",
    subjectCol: "Fan",
    teacherCol: "O'qituvchi",
    attendanceCol: "Davomat",
    scoreCol: "Ball",
    collectedCol: "Yig'ildi",
    dueCol: "Qarz",
    emptyTitle: "Hali fanlar yo'q",
    emptyDesc: "Statistika ko'rish uchun avval fan qo'shing.",
  },
  en: {
    students: "Students",
    attendance: "Attendance (30d)",
    academic: "Avg. score",
    finance: "Finance (this month)",
    collected: "Collected",
    due: "Due",
    noData: "No data",
    perSubject: "By subject",
    subjectCol: "Subject",
    teacherCol: "Teacher",
    attendanceCol: "Attendance",
    scoreCol: "Score",
    collectedCol: "Collected",
    dueCol: "Due",
    emptyTitle: "No subjects yet",
    emptyDesc: "Add a subject first to see statistics.",
  },
  ru: {
    students: "Ученики",
    attendance: "Посещаемость (30 дн)",
    academic: "Средний балл",
    finance: "Финансы (за месяц)",
    collected: "Собрано",
    due: "Долг",
    noData: "Нет данных",
    perSubject: "По предметам",
    subjectCol: "Предмет",
    teacherCol: "Учитель",
    attendanceCol: "Посещаемость",
    scoreCol: "Балл",
    collectedCol: "Собрано",
    dueCol: "Долг",
    emptyTitle: "Предметов пока нет",
    emptyDesc: "Сначала добавьте предмет, чтобы увидеть статистику.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  centerId: string;
  schoolClass: SchoolClassData;
  subjects: ClassData[];
}

export default function SchoolClassStatsTab({ centerId, schoolClass, subjects }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [stats, setStats] = useState<SchoolClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subjects.length === 0) { setStats(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchSchoolClassStats(centerId, schoolClass, subjects.map((s) => ({ id: s.id, title: s.title, teacherName: s.teacherName })))
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((err) => console.error("Error loading School Class stats:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, schoolClass.id, schoolClass.studentIds.join(","), subjects.map((s) => s.id).join(",")]);

  if (subjects.length === 0) {
    return (
      <div className="py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
          <GraduationCap size={22} />
        </div>
        <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
        <p className="text-[13px] text-on-surface-variant mt-1">{t.emptyDesc}</p>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-20 bg-surface-container-low rounded-m3-lg" />
          ))}
        </div>
        <div className="h-48 bg-surface-container-low rounded-m3-lg" />
      </div>
    );
  }

  const kpis = [
    { icon: Users2, label: t.students, value: String(stats.studentCount) },
    { icon: CalendarCheck2, label: t.attendance, value: stats.attendanceRate !== null ? `${stats.attendanceRate}%` : t.noData },
    { icon: GraduationCap, label: t.academic, value: stats.avgScorePct !== null ? `${stats.avgScorePct}%` : t.noData },
    { icon: Wallet, label: t.finance, value: `${formatUZS(stats.collected)} / ${formatUZS(stats.due)}` },
  ];

  return (
    <div className="p-4 sm:p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-surface-container-low border border-outline-variant rounded-m3-lg p-4">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Icon size={14} />
                <span className="text-[11px] font-bold uppercase tracking-wide">{k.label}</span>
              </div>
              <p className="text-lg font-bold text-on-surface mt-1.5 tabular-nums">{k.value}</p>
              {i === 3 && (
                <p className="text-[11px] text-on-surface-variant mt-0.5">{t.collected} / {t.due}</p>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t.perSubject}</h3>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-on-surface-variant border-b border-outline-variant">
                <th className="py-2 pr-3 font-bold">{t.subjectCol}</th>
                <th className="py-2 pr-3 font-bold">{t.teacherCol}</th>
                <th className="py-2 pr-3 font-bold text-right">{t.attendanceCol}</th>
                <th className="py-2 pr-3 font-bold text-right">{t.scoreCol}</th>
                <th className="py-2 pr-3 font-bold text-right">{t.collectedCol}</th>
                <th className="py-2 font-bold text-right">{t.dueCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {stats.perSubject.map((s) => (
                <tr key={s.classId}>
                  <td className="py-2.5 pr-3 font-semibold text-on-surface whitespace-nowrap">{s.title}</td>
                  <td className="py-2.5 pr-3 text-on-surface-variant whitespace-nowrap">{s.teacherName}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{s.attendanceRate !== null ? `${s.attendanceRate}%` : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{s.avgScorePct !== null ? `${s.avgScorePct}%` : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatUZS(s.collected)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatUZS(s.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
