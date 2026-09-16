"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Users, Layers, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { fetchSchoolClasses, partitionClasses, SchoolClassData } from "@/services/schoolClassService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

import SchoolClassSubjectsTab from "./_components/SchoolClassSubjectsTab";
import SchoolClassRosterTab from "./_components/SchoolClassRosterTab";
import SchoolClassStatsTab from "./_components/SchoolClassStatsTab";
import SchoolClassSettingsTab from "./_components/SchoolClassSettingsTab";

const TRANSLATIONS = {
  uz: {
    tabs: { subjects: "Fanlar", roster: "O'quvchilar", stats: "Statistika", settings: "Sozlamalar" },
    centerNotFound: "Manager centerId topilmadi.",
    noAccess: "Sizda bu sinfni ko'rish huquqi yo'q.",
    genericError: "Xatolik yuz berdi",
    backToClasses: "Sinflar ro'yxatiga qaytish",
    studentsSuffix: (n: number) => `${n} ta o'quvchi`,
    subjectsSuffix: (n: number) => `${n} ta fan`,
  },
  en: {
    tabs: { subjects: "Subjects", roster: "Students", stats: "Statistics", settings: "Settings" },
    centerNotFound: "Manager centerId not found.",
    noAccess: "You don't have permission to view this class.",
    genericError: "Something went wrong",
    backToClasses: "Back to the classes list",
    studentsSuffix: (n: number) => `${n} students`,
    subjectsSuffix: (n: number) => `${n} subjects`,
  },
  ru: {
    tabs: { subjects: "Предметы", roster: "Ученики", stats: "Статистика", settings: "Настройки" },
    centerNotFound: "Не найден centerId менеджера.",
    noAccess: "У вас нет прав для просмотра этого класса.",
    genericError: "Произошла ошибка",
    backToClasses: "Назад к списку классов",
    studentsSuffix: (n: number) => `Учеников: ${n}`,
    subjectsSuffix: (n: number) => `Предметов: ${n}`,
  },
};
type T = typeof TRANSLATIONS.uz;

type TabKey = "subjects" | "roster" | "stats" | "settings";
const TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "subjects", icon: Layers },
  { key: "roster", icon: Users },
  { key: "stats", icon: BarChart3 },
  { key: "settings", icon: Settings },
];

export default function SchoolClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolClassId = params.schoolClassId as string;
  const { user } = useAuth() as any;
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [centerId, setCenterId] = useState<string | null>(null);
  const [schoolClass, setSchoolClass] = useState<SchoolClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("subjects");

  const { classes, teachers, isLoading: loadingClasses, refetch: refetchClasses } = useCenterClasses(centerId);
  const subjects = useMemo(() => partitionClasses(classes, schoolClassId), [classes, schoolClassId]);

  const loadSchoolClass = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const profile = await getUserProfile(user.uid);
      if (!profile?.centerId) throw new Error(t.centerNotFound);
      setCenterId(profile.centerId);

      const list = await fetchSchoolClasses(profile.centerId);
      const found = list.find((sc) => sc.id === schoolClassId);
      if (!found) { setMissing(true); return; }

      setSchoolClass(found);
    } catch (err: any) {
      console.error("Error loading School Class:", err);
      toast.error(err.message || t.genericError);
      router.push("/manager/groups");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !schoolClassId) return;
    loadSchoolClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, schoolClassId, router]);

  const refresh = (silent = true) => {
    loadSchoolClass({ silent });
    refetchClasses();
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-4 w-40 bg-surface-container-highest rounded" />
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-5 sm:p-6 space-y-3">
          <div className="h-6 w-1/3 bg-surface-container-highest rounded" />
          <div className="h-4 w-1/4 bg-surface-container rounded" />
        </div>
        <div className="h-14 bg-surface-container rounded-m3-lg" />
        <div className="h-64 bg-surface-container-lowest border border-outline-variant rounded-m3-lg" />
      </div>
    );
  }

  if (missing) notFound();
  if (!schoolClass || !centerId) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/manager/groups"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-on-surface-variant hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> {t.backToClasses}
        </Link>
        <div className="bg-surface-container-lowest rounded-m3-xl p-5 sm:p-6 border border-outline-variant">
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight leading-tight">
            {schoolClass.displayName}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t.studentsSuffix(schoolClass.studentIds.length)} · {t.subjectsSuffix(subjects.length)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-m3-lg">
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
        {activeTab === "subjects" && (
          <SchoolClassSubjectsTab
            schoolClass={schoolClass}
            subjects={subjects}
            teachers={teachers}
            isLoading={loadingClasses}
            onRefresh={refresh}
          />
        )}
        {activeTab === "roster" && (
          <SchoolClassRosterTab
            schoolClass={schoolClass}
            centerId={centerId}
            subjectClassIds={subjects.map((s) => s.id)}
            allClasses={classes}
            onRefresh={refresh}
          />
        )}
        {activeTab === "stats" && (
          <SchoolClassStatsTab centerId={centerId} schoolClass={schoolClass} subjects={subjects} />
        )}
        {activeTab === "settings" && (
          <SchoolClassSettingsTab schoolClass={schoolClass} subjectCount={subjects.length} />
        )}
      </div>
    </div>
  );
}
