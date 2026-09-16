"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { Activity, Settings, ArrowLeft, DoorOpen, CalendarDays } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { ScheduleEntry } from "@/types/attendance";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

import ScheduleTab from "../../../_shared/ScheduleTab";
import ManagerOversightTab from "../../../_shared/ManagerOversightTab";
import SubjectSettingsTab from "./_components/SubjectSettingsTab";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TRANSLATIONS = {
  uz: {
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    tabs: { schedule: "Jadval", oversight: "Nazorat", settings: "Sozlamalar" },
    centerNotFound: "Manager centerId topilmadi.",
    noAccess: "Sizda bu fanni ko'rish huquqi yo'q.",
    genericError: "Xatolik yuz berdi",
    backToClass: (name: string) => `${name} sinfiga qaytish`,
    teacherLabel: "O'qituvchi:",
    noSchedule: "Jadval belgilanmagan",
  },
  en: {
    dayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    tabs: { schedule: "Schedule", oversight: "Oversight", settings: "Settings" },
    centerNotFound: "Manager centerId not found.",
    noAccess: "You don't have permission to view this subject.",
    genericError: "Something went wrong",
    backToClass: (name: string) => `Back to ${name}`,
    teacherLabel: "Teacher:",
    noSchedule: "No schedule set",
  },
  ru: {
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    tabs: { schedule: "Расписание", oversight: "Контроль", settings: "Настройки" },
    centerNotFound: "Не найден centerId менеджера.",
    noAccess: "У вас нет прав для просмотра этого предмета.",
    genericError: "Произошла ошибка",
    backToClass: (name: string) => `Назад к ${name}`,
    teacherLabel: "Учитель:",
    noSchedule: "Расписание не задано",
  },
};
type T = typeof TRANSLATIONS.uz;

export interface SubjectClassDocument {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  isLocked: boolean;
  createdAt: any;
  schedule?: ScheduleEntry[];
  monthlyFee?: number;
  centerId?: string;
  schoolClassId?: string;
  schoolClassName?: string;
}

type TabKey = "schedule" | "oversight" | "settings";
const TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "schedule", icon: CalendarDays },
  { key: "oversight", icon: Activity },
  { key: "settings", icon: Settings },
];

export default function SubjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolClassId = params.schoolClassId as string;
  const classId = params.classId as string;
  const { user } = useAuth() as any;
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [managerCenterId, setManagerCenterId] = useState<string | null>(null);
  const [classData, setClassData] = useState<SubjectClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");

  const loadData = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const profile = await getUserProfile(user.uid);
      if (!profile?.centerId) throw new Error(t.centerNotFound);
      setManagerCenterId(profile.centerId);

      const classSnap = await getDoc(doc(db, "classes", classId));
      if (!classSnap.exists()) { setMissing(true); return; }
      const data = { id: classSnap.id, ...classSnap.data() } as SubjectClassDocument;

      if (data.centerId !== profile.centerId || data.schoolClassId !== schoolClassId) {
        throw new Error(t.noAccess);
      }

      setClassData(data);
    } catch (err: any) {
      console.error("Error loading subject details:", err);
      toast.error(err.message || t.genericError);
      router.push(`/manager/groups/${schoolClassId}`);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !classId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, classId, schoolClassId, router]);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-4 w-40 bg-surface-container-highest rounded" />
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-5 sm:p-6 space-y-3">
          <div className="h-6 w-1/2 bg-surface-container-highest rounded" />
          <div className="h-4 w-1/3 bg-surface-container rounded" />
        </div>
        <div className="h-14 bg-surface-container rounded-m3-lg" />
        <div className="h-64 bg-surface-container-lowest border border-outline-variant rounded-m3-lg" />
      </div>
    );
  }

  if (missing) notFound();
  if (!classData) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/manager/groups/${schoolClassId}`}
          className="inline-flex items-center gap-2 text-[13px] font-bold text-on-surface-variant hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> {t.backToClass(classData.schoolClassName || "")}
        </Link>
        <div className="bg-surface-container-lowest rounded-m3-xl p-5 sm:p-6 border border-outline-variant">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight leading-tight">
              {classData.title}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {t.teacherLabel} <span className="font-semibold text-on-surface">{classData.teacherName}</span>
            </p>
          </div>

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

      <div className="grid grid-cols-3 gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-m3-lg">
        {TABS.map((tab) => {
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

      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl min-h-[400px] overflow-hidden">
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
          <SubjectSettingsTab
            classData={classData}
            centerId={managerCenterId}
            schoolClassId={schoolClassId}
            onUpdate={(updatedFields) => setClassData((prev) => prev ? { ...prev, ...updatedFields } : null)}
          />
        )}
      </div>
    </div>
  );
}
