"use client";

// Read-only IELTS progress view for a center-managed IELTS group (docs/IELTS.md).
// All data comes from GET /api/manager/ielts-groups/{groupId}/overview (Admin SDK) —
// no client reads on assignments/attempts, so no rules were opened for managers.
// The TEACHER keeps all pedagogical control; this tab only shows outcomes.

import { useEffect, useState } from "react";
import {
  BookOpen, Headphones, PenLine, Mic, Target, Gauge, ClipboardCheck, Users, RefreshCw,
} from "lucide-react";
import { managerApiFetch } from "@/lib/managerApi";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    loadError: "IELTS ma'lumotlarini yuklab bo'lmadi.",
    retry: "Qayta urinish",
    teacherNote: "Testlarni tayinlash va baholash o'qituvchining IELTS panelida bo'ladi — bu sahifa faqat kuzatuv uchun.",
    targetBand: "Maqsad band",
    avgBand: "O'rtacha band",
    pending: "Tekshirilmagan ishlar",
    students: "O'quvchilar",
    assignments: "Tayinlangan testlar",
    noAssignments: "Hali test tayinlanmagan.",
    noStudents: "Guruhda hali o'quvchi yo'q.",
    completed: (a: number, b: number) => `${a}/${b} topshirdi`,
    due: "Muddat:",
    attemptsCol: "Urinishlar",
    latestCol: "Oxirgi band",
    bestCol: "Eng yaxshi",
    noAttempts: "—",
    mode: { simulation: "Imtihon", practice: "Mashq" } as Record<string, string>,
  },
  en: {
    loadError: "Could not load the IELTS data.",
    retry: "Retry",
    teacherNote: "Assigning and grading tests happens in the teacher's IELTS panel — this page is oversight only.",
    targetBand: "Target band",
    avgBand: "Average band",
    pending: "Pending reviews",
    students: "Students",
    assignments: "Assigned tests",
    noAssignments: "No tests assigned yet.",
    noStudents: "No students in the group yet.",
    completed: (a: number, b: number) => `${a}/${b} submitted`,
    due: "Due:",
    attemptsCol: "Attempts",
    latestCol: "Latest band",
    bestCol: "Best",
    noAttempts: "—",
    mode: { simulation: "Exam", practice: "Practice" } as Record<string, string>,
  },
  ru: {
    loadError: "Не удалось загрузить данные IELTS.",
    retry: "Повторить",
    teacherNote: "Назначение и проверка тестов происходят в IELTS-панели учителя — эта страница только для контроля.",
    targetBand: "Целевой band",
    avgBand: "Средний band",
    pending: "Непроверенные работы",
    students: "Ученики",
    assignments: "Назначенные тесты",
    noAssignments: "Тесты пока не назначены.",
    noStudents: "В группе пока нет учеников.",
    completed: (a: number, b: number) => `Сдали: ${a}/${b}`,
    due: "Срок:",
    attemptsCol: "Попытки",
    latestCol: "Последний band",
    bestCol: "Лучший",
    noAttempts: "—",
    mode: { simulation: "Экзамен", practice: "Практика" } as Record<string, string>,
  },
};
type T = typeof TRANSLATIONS.uz;

const SKILL_ICON: Record<string, React.ElementType> = {
  reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic,
};

interface Overview {
  group: { id: string; title: string; targetBand: number | null; teacherName: string; studentCount: number };
  avgBand: number | null;
  pendingReviews: number;
  assignments: {
    id: string; testTitle: string; skill: string; mode: string;
    dueAt: number | null; completed: number; total: number;
  }[];
  students: {
    uid: string; name: string; username: string;
    attempts: number; latestBand: number | null; bestBand: number | null; lastActiveAt: number | null;
  }[];
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: string; tone?: "warn";
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-m3-lg border ${
      tone === "warn"
        ? "bg-warning-container text-on-warning-container border-transparent"
        : "bg-surface-container-low border-outline-variant"
    }`}>
      <Icon size={18} className={tone === "warn" ? "" : "text-primary"} />
      <div className="min-w-0">
        <p className={`text-[11px] font-bold ${tone === "warn" ? "opacity-80" : "text-on-surface-variant"}`}>{label}</p>
        <p className="text-[16px] font-black tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function IeltsOverviewTab({ groupId }: { groupId: string }) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const locale = lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-GB";

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await managerApiFetch<Overview>(`/api/manager/ielts-groups/${groupId}/overview`));
    } catch (e) {
      console.error("IELTS overview load failed:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-16 bg-surface-container rounded-m3-lg" />)}
        </div>
        <div className="h-40 bg-surface-container rounded-m3-lg" />
        <div className="h-56 bg-surface-container rounded-m3-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-14 px-6 text-center">
        <p className="text-sm font-bold text-on-surface">{t.loadError}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 px-5 h-t-control bg-primary text-on-primary font-bold text-sm rounded-full shadow-elev-1"
        >
          <RefreshCw size={15} /> {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-6">
      <p className="text-[12.5px] font-medium text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-m3-md px-4 py-2.5">
        {t.teacherNote}
      </p>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Target} label={t.targetBand} value={data.group.targetBand != null ? data.group.targetBand.toFixed(1) : "—"} />
        <StatCard icon={Gauge} label={t.avgBand} value={data.avgBand != null ? data.avgBand.toFixed(1) : "—"} />
        <StatCard icon={Users} label={t.students} value={String(data.group.studentCount)} />
        <StatCard
          icon={ClipboardCheck}
          label={t.pending}
          value={String(data.pendingReviews)}
          tone={data.pendingReviews > 0 ? "warn" : undefined}
        />
      </div>

      {/* Assignments */}
      <div>
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">{t.assignments}</h3>
        {data.assignments.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">{t.noAssignments}</p>
        ) : (
          <div className="space-y-2">
            {data.assignments.map((a) => {
              const Icon = SKILL_ICON[a.skill] || BookOpen;
              const pct = a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0;
              return (
                <div key={a.id} className="px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-lg">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className="text-primary shrink-0" />
                    <p className="text-[13.5px] font-semibold text-on-surface truncate flex-1">{a.testTitle}</p>
                    <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full shrink-0">
                      {t.mode[a.mode] || a.mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11.5px] font-bold text-on-surface-variant tabular-nums shrink-0">
                      {t.completed(a.completed, a.total)}
                    </span>
                  </div>
                  {a.dueAt != null && (
                    <p className="text-[11.5px] text-on-surface-variant mt-1.5 tabular-nums">
                      {t.due} {new Date(a.dueAt).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Students */}
      <div>
        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">{t.students}</h3>
        {data.students.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">{t.noStudents}</p>
        ) : (
          <div className="border border-outline-variant rounded-m3-lg overflow-hidden divide-y divide-outline-variant">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-surface-container-low text-[10.5px] font-black text-on-surface-variant uppercase tracking-wide">
              <span>{t.students}</span>
              <span className="w-16 text-center">{t.attemptsCol}</span>
              <span className="w-16 text-center">{t.latestCol}</span>
              <span className="w-16 text-center hidden sm:block">{t.bestCol}</span>
            </div>
            {data.students.map((s) => (
              <div key={s.uid} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-on-surface truncate">{s.name}</p>
                  {s.username && <p className="text-[11.5px] text-on-surface-variant truncate">@{s.username}</p>}
                </div>
                <span className="w-16 text-center text-[13px] font-bold tabular-nums text-on-surface-variant">{s.attempts}</span>
                <span className="w-16 text-center">
                  {s.latestBand != null ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-black bg-primary-container text-on-primary-container tabular-nums">
                      {s.latestBand.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[13px] text-on-surface-variant">{t.noAttempts}</span>
                  )}
                </span>
                <span className="w-16 text-center hidden sm:block text-[13px] font-bold tabular-nums text-on-surface-variant">
                  {s.bestBand != null ? s.bestBand.toFixed(1) : t.noAttempts}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
