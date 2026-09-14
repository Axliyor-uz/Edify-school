"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { Users, Activity, Settings, ArrowLeft, DoorOpen, CalendarDays, Copy, BookOpenCheck } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { ScheduleEntry } from "@/types/attendance";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

import ManagerRosterTab from "./_components/ManagerRosterTab";
import ManagerOversightTab from "./_components/ManagerOversightTab";
import ManagerSettingsTab from "./_components/ManagerSettingsTab";
import ScheduleTab from "./_components/ScheduleTab";
import IeltsOverviewTab from "./_components/IeltsOverviewTab";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TRANSLATIONS = {
  uz: {
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    tabs: { roster: "O'quvchilar", schedule: "Jadval", oversight: "Nazorat", settings: "Sozlamalar", ielts: "IELTS" },
    centerNotFound: "Manager centerId topilmadi.",
    noAccess: "Sizda bu guruhni ko'rish huquqi yo'q.",
    genericError: "Xatolik yuz berdi",
    codeCopied: "Kod nusxalandi!",
    backToGroups: "Guruhlar ro'yxatiga qaytish",
    teacherLabel: "O'qituvchi:",
    copyJoinCode: "Kirish kodini nusxalash",
    codeLabel: "Kod:",
    noSchedule: "Jadval belgilanmagan",
  },
  en: {
    dayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    tabs: { roster: "Students", schedule: "Schedule", oversight: "Oversight", settings: "Settings", ielts: "IELTS" },
    centerNotFound: "Manager centerId not found.",
    noAccess: "You don't have permission to view this group.",
    genericError: "Something went wrong",
    codeCopied: "Code copied!",
    backToGroups: "Back to the groups list",
    teacherLabel: "Teacher:",
    copyJoinCode: "Copy join code",
    codeLabel: "Code:",
    noSchedule: "No schedule set",
  },
  ru: {
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    tabs: { roster: "Ученики", schedule: "Расписание", oversight: "Контроль", settings: "Настройки", ielts: "IELTS" },
    centerNotFound: "Не найден centerId менеджера.",
    noAccess: "У вас нет прав для просмотра этой группы.",
    genericError: "Произошла ошибка",
    codeCopied: "Код скопирован!",
    backToGroups: "Назад к списку групп",
    teacherLabel: "Учитель:",
    copyJoinCode: "Скопировать код доступа",
    codeLabel: "Код:",
    noSchedule: "Расписание не задано",
  },
};
type T = typeof TRANSLATIONS.uz;

export interface ClassDocument {
  id: string;
  title: string;
  description: string;
  joinCode: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  studentCount: number;
  isLocked: boolean;
  createdAt: any;
  schedule?: ScheduleEntry[];
  /** Finance: integer so'm per month; missing/0 → group is not billed. */
  monthlyFee?: number;
  /** Center membership anchor (2026-07-15). */
  centerId?: string;
  /** Linked ielts_groups doc id — present only on center IELTS groups (2026-07-29). */
  ieltsGroupId?: string;
}

type TabKey = "roster" | "schedule" | "oversight" | "settings" | "ielts";

const BASE_TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "roster", icon: Users },
  { key: "schedule", icon: CalendarDays },
  { key: "oversight", icon: Activity },
  { key: "settings", icon: Settings },
];

const IELTS_TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "roster", icon: Users },
  { key: "schedule", icon: CalendarDays },
  { key: "ielts", icon: BookOpenCheck },
  { key: "oversight", icon: Activity },
  { key: "settings", icon: Settings },
];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { user } = useAuth() as any;
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [managerCenterId, setManagerCenterId] = useState<string | null>(null);
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // bad classId → branded 404
  const [activeTab, setActiveTab] = useState<TabKey>("roster");

  // silent: refresh data without tearing the page down (keeps modals/tabs mounted)
  const loadData = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const profile = await getUserProfile(user.uid);
      if (!profile?.centerId) throw new Error(t.centerNotFound);
      setManagerCenterId(profile.centerId);

      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) { setMissing(true); return; } // → not-found boundary

      const data = { id: classSnap.id, ...classSnap.data() } as ClassDocument;

      // centerId-anchored membership (2026-07-15): the group must carry MY
      // centerId — a linked teacher's personal groups are not the center's.
      if (data.centerId !== profile.centerId) {
        throw new Error(t.noAccess);
      }

      setClassData(data);
    } catch (err: any) {
      console.error("Error loading group details:", err);
      toast.error(err.message || t.genericError);
      router.push("/manager/groups");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !classId) return;
    loadData();
  }, [user, classId, router]);

  const handleCopyCode = () => {
    if (!classData) return;
    navigator.clipboard.writeText(classData.joinCode);
    toast.success(t.codeCopied);
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-4 w-40 bg-surface-container-highest rounded" />
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-5 sm:p-6 space-y-3">
          <div className="h-6 w-1/2 bg-surface-container-highest rounded" />
          <div className="h-4 w-1/3 bg-surface-container rounded" />
          <div className="h-4 w-2/3 bg-surface-container rounded" />
        </div>
        <div className="h-14 bg-surface-container rounded-m3-lg" />
        <div className="h-64 bg-surface-container-lowest border border-outline-variant rounded-m3-lg" />
      </div>
    );
  }

  if (missing) notFound(); // renders app/manager/not-found.tsx
  if (!classData) return null;

  return (
    <div className="space-y-5">
      {/* Back Button & Header */}
      <div>
        <Link
          href="/manager/groups"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-on-surface-variant hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> {t.backToGroups}
        </Link>
        <div className="bg-surface-container-lowest rounded-m3-xl p-5 sm:p-6 border border-outline-variant">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight leading-tight">
                {classData.title}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                {t.teacherLabel} <span className="font-semibold text-on-surface">{classData.teacherName}</span>
              </p>
            </div>
            {classData.ieltsGroupId ? (
              // Managed IELTS group — enrollment is manager-only; no join code to share.
              <span className="self-start flex items-center gap-1.5 px-3.5 py-2 bg-tertiary-container text-on-tertiary-container rounded-full text-[13px] font-bold shrink-0">
                <BookOpenCheck size={14} /> IELTS
              </span>
            ) : (
              <button
                onClick={handleCopyCode}
                title={t.copyJoinCode}
                className="self-start flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-low hover:bg-state-hover border border-outline-variant rounded-full transition-colors shrink-0"
              >
                <span className="text-[11px] font-semibold text-on-surface-variant">{t.codeLabel}</span>
                <span className="text-[13px] font-mono font-bold text-on-surface tracking-widest">{classData.joinCode}</span>
                <Copy size={13} className="text-on-surface-variant ml-0.5" />
              </button>
            )}
          </div>

          {/* Schedule + room summary */}
          {classData.schedule && classData.schedule.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {[...classData.schedule]
                .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek))
                .map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-low border border-outline-variant rounded-full text-xs">
                    <span className="font-bold text-on-surface">{t.dayShort[s.dayOfWeek]}</span>
                    <span className="text-on-surface-variant tabular-nums">{s.startTime}</span>
                    {s.roomName && (
                      <span className="inline-flex items-center gap-1 text-primary font-semibold border-l border-outline-variant pl-1.5">
                        <DoorOpen size={11} /> {s.roomName}
                      </span>
                    )}
                  </span>
                ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-on-surface-variant mt-3 flex items-center gap-1.5"><CalendarDays size={13} /> {t.noSchedule}</p>
          )}
        </div>
      </div>

      {/* Segmented tabs — all always visible, no horizontal scroll */}
      <div className={`grid ${classData.ieltsGroupId ? "grid-cols-5" : "grid-cols-4"} gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-m3-lg`}>
        {(classData.ieltsGroupId ? IELTS_TABS : BASE_TABS).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 rounded-m3-md text-[11px] sm:text-[13px] font-bold transition-colors ${
                isActive
                  ? "bg-primary text-on-primary shadow-elev-1"
                  : "text-on-surface-variant hover:bg-state-hover hover:text-on-surface"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate max-w-full">{t.tabs[tab.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl min-h-[400px] overflow-hidden">
        {activeTab === "roster" && managerCenterId && (
          <ManagerRosterTab
            classId={classData.id}
            centerId={managerCenterId}
            studentIds={classData.studentIds}
            ieltsGroupId={classData.ieltsGroupId}
            onRefresh={() => loadData({ silent: true })}
          />
        )}
        {activeTab === "ielts" && classData.ieltsGroupId && (
          <IeltsOverviewTab groupId={classData.ieltsGroupId} />
        )}
        {activeTab === "schedule" && managerCenterId && (
          <ScheduleTab
            classId={classData.id}
            centerId={managerCenterId}
            teacherId={classData.teacherId}
            studentCount={classData.studentIds?.length || 0}
            currentSchedule={classData.schedule || []}
            onUpdate={(newSchedule) => setClassData((prev) => prev ? { ...prev, schedule: newSchedule } : null)}
          />
        )}
        {activeTab === "oversight" && <ManagerOversightTab classId={classData.id} />}
        {activeTab === "settings" && managerCenterId && (
          <ManagerSettingsTab
            classData={classData}
            centerId={managerCenterId}
            onUpdate={(updatedFields) => setClassData(prev => prev ? { ...prev, ...updatedFields } : null)}
          />
        )}
      </div>
    </div>
  );
}
