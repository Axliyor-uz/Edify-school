"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Users, ChevronRight, BookOpenCheck, Link2, GraduationCap, Layers } from "lucide-react";
import { Button } from "@/components/manager-ui";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import { useSchoolClasses } from "@/hooks/useSchoolClasses";
import { partitionClasses, SchoolClassData } from "@/services/schoolClassService";
import CreateSchoolClassModal from "./_components/CreateSchoolClassModal";
import CreateIeltsGroupModal from "./_components/CreateIeltsGroupModal";
import AttachToSchoolClassModal from "./_components/AttachToSchoolClassModal";
import SearchInput from "../_components/SearchInput";
import { useRouter } from "next/navigation";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Sinflar",
    subtitleCounts: (c: number, s: number) => `${c} ta sinf · ${s} ta o'quvchi`,
    subtitleAll: "Markazdagi barcha sinflar",
    newClass: "Yangi sinf",
    newIelts: "Yangi IELTS guruhi",
    searchPlaceholder: "Sinfni qidiring...",
    emptyTitle: "Hali sinflar yo'q",
    emptyDesc: "Birinchi sinfni yarating — masalan 5-A — so'ng fanlarni qo'shasiz.",
    noResultsTitle: "Hech narsa topilmadi",
    noResultsDesc: "Qidiruvni o'zgartirib ko'ring",
    studentSuffix: "o'quvchi",
    subjectSuffix: "fan",
    ieltsGroups: "IELTS guruhlari",
    unlinkedGroups: "Bog'lanmagan guruhlar",
    unlinkedHint: "Bu guruhlar hali biror sinfga biriktirilmagan. Ularni bir sinfning fani sifatida bog'lashingiz mumkin.",
    attach: "Sinfga biriktirish",
    noTeacher: "O'qituvchi yo'q",
  },
  en: {
    title: "Classes",
    subtitleCounts: (c: number, s: number) => `${c} classes · ${s} students`,
    subtitleAll: "All classes in the center",
    newClass: "New class",
    newIelts: "New IELTS group",
    searchPlaceholder: "Search classes...",
    emptyTitle: "No classes yet",
    emptyDesc: "Create your first class — e.g. 5-A — then add subjects.",
    noResultsTitle: "Nothing found",
    noResultsDesc: "Try changing the search",
    studentSuffix: "students",
    subjectSuffix: "subjects",
    ieltsGroups: "IELTS groups",
    unlinkedGroups: "Unlinked groups",
    unlinkedHint: "These groups aren't attached to any class yet. You can attach one as a subject of a class.",
    attach: "Attach to a class",
    noTeacher: "No teacher",
  },
  ru: {
    title: "Классы",
    subtitleCounts: (c: number, s: number) => `Классов: ${c} · учеников: ${s}`,
    subtitleAll: "Все классы учебного центра",
    newClass: "Новый класс",
    newIelts: "Новая IELTS группа",
    searchPlaceholder: "Поиск класса...",
    emptyTitle: "Классов пока нет",
    emptyDesc: "Создайте первый класс — например 5-A — затем добавьте предметы.",
    noResultsTitle: "Ничего не найдено",
    noResultsDesc: "Попробуйте изменить запрос",
    studentSuffix: "учеников",
    subjectSuffix: "предметов",
    ieltsGroups: "IELTS группы",
    unlinkedGroups: "Непривязанные группы",
    unlinkedHint: "Эти группы ещё не привязаны ни к одному классу. Вы можете привязать группу как предмет класса.",
    attach: "Привязать к классу",
    noTeacher: "Без учителя",
  },
};
type T = typeof TRANSLATIONS.uz;

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isIeltsModalOpen, setIsIeltsModalOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<ClassData | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    }).catch((err) => console.error("Profile error:", err));
  }, [user]);

  const { classes, teachers, isLoading: loadingClasses, error, refetch: refetchClasses } = useCenterClasses(centerId);
  const { schoolClasses, isLoading: loadingSchoolClasses, refetch: refetchSchoolClasses } = useSchoolClasses(centerId);
  const isLoading = loadingClasses || loadingSchoolClasses;

  const refetch = () => { refetchClasses(); refetchSchoolClasses(); };

  const subjectsBySchoolClass = useMemo(() => {
    const map = new Map<string, ClassData[]>();
    for (const sc of schoolClasses) map.set(sc.id, partitionClasses(classes, sc.id));
    return map;
  }, [classes, schoolClasses]);

  const ieltsGroups = useMemo(() => classes.filter((c) => c.ieltsGroupId), [classes]);
  const unlinkedGroups = useMemo(() => partitionClasses(classes), [classes]);

  const filteredSchoolClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schoolClasses;
    return schoolClasses.filter((sc) => sc.displayName.toLowerCase().includes(q));
  }, [schoolClasses, search]);

  const totalStudents = schoolClasses.reduce((sum, sc) => sum + sc.studentIds.length, 0);
  const openClass = (id: string) => router.push(`/manager/groups/${id}`);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {!isLoading && schoolClasses.length > 0
              ? t.subtitleCounts(schoolClasses.length, totalStudents)
              : t.subtitleAll}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="tonal" onClick={() => setIsIeltsModalOpen(true)} icon={<BookOpenCheck size={16} />}>
            {t.newIelts}
          </Button>
          <Button onClick={() => setIsClassModalOpen(true)} icon={<Plus size={16} />}>
            {t.newClass}
          </Button>
        </div>
      </div>

      {/* Search */}
      {!isLoading && schoolClasses.length > 0 && (
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
      )}

      {error && (
        <div className="bg-error-container text-on-error-container px-5 py-4 rounded-m3-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-surface-container-highest rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surface-container-highest rounded w-3/4" />
                  <div className="h-3 bg-surface-container rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && schoolClasses.length === 0 && !error && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <GraduationCap size={22} />
          </div>
          <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[280px] mx-auto">{t.emptyDesc}</p>
          <Button className="mt-5" onClick={() => setIsClassModalOpen(true)} icon={<Plus size={16} />}>
            {t.newClass}
          </Button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && schoolClasses.length > 0 && filteredSchoolClasses.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl py-12 px-6 text-center">
          <p className="text-sm font-bold text-on-surface">{t.noResultsTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1">{t.noResultsDesc}</p>
        </div>
      )}

      {/* School Class cards */}
      {!isLoading && filteredSchoolClasses.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredSchoolClasses.map((sc) => (
            <SchoolClassCard
              key={sc.id}
              schoolClass={sc}
              subjects={subjectsBySchoolClass.get(sc.id) || []}
              t={t}
              onOpen={() => openClass(sc.id)}
            />
          ))}
        </div>
      )}

      {/* IELTS groups */}
      {!isLoading && ieltsGroups.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
            <BookOpenCheck size={14} /> {t.ieltsGroups}
          </h2>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
            {ieltsGroups.map((cls) => (
              <IeltsRow key={cls.id} cls={cls} t={t} onOpen={() => router.push(`/manager/groups/detail/${cls.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Unlinked groups — manual migration */}
      {!isLoading && unlinkedGroups.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
            <Link2 size={14} /> {t.unlinkedGroups}
          </h2>
          <p className="text-[12.5px] text-on-surface-variant -mt-1.5">{t.unlinkedHint}</p>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
            {unlinkedGroups.map((cls) => (
              <UnlinkedRow
                key={cls.id}
                cls={cls}
                t={t}
                onOpen={() => router.push(`/manager/groups/detail/${cls.id}`)}
                onAttach={() => setAttachTarget(cls)}
              />
            ))}
          </div>
        </div>
      )}

      {isClassModalOpen && centerId && (
        <CreateSchoolClassModal
          centerId={centerId}
          onClose={() => setIsClassModalOpen(false)}
          onSuccess={(sc) => { setIsClassModalOpen(false); refetch(); router.push(`/manager/groups/${sc.id}`); }}
        />
      )}

      {isIeltsModalOpen && (
        <CreateIeltsGroupModal
          teachers={teachers}
          onClose={() => setIsIeltsModalOpen(false)}
          onSuccess={() => { setIsIeltsModalOpen(false); refetch(); }}
        />
      )}

      {attachTarget && (
        <AttachToSchoolClassModal
          group={attachTarget}
          schoolClasses={schoolClasses}
          allClasses={classes}
          onClose={() => setAttachTarget(null)}
          onSuccess={() => { setAttachTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

function SchoolClassCard({ schoolClass, subjects, t, onOpen }: { schoolClass: SchoolClassData; subjects: ClassData[]; t: T; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group bg-surface-container-lowest rounded-m3-xl border border-outline-variant p-5 hover:shadow-elev-2 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[15px] shrink-0">
          {schoolClass.grade}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-on-surface tracking-tight truncate group-hover:text-primary transition-colors">
            {schoolClass.displayName}
          </h3>
          <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5 flex items-center gap-1">
            <Layers size={11} /> {subjects.length} {t.subjectSuffix}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-outline-variant">
        <div className="flex items-center gap-1.5 text-on-surface">
          <Users size={15} className="text-on-surface-variant" />
          <span className="text-[13px] font-semibold tabular-nums">{schoolClass.studentIds.length}</span>
          <span className="text-xs text-on-surface-variant">{t.studentSuffix}</span>
        </div>
        <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
      </div>
    </div>
  );
}

function IeltsRow({ cls, t, onOpen }: { cls: ClassData; t: T; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-state-hover active:bg-state-hover transition-colors">
      <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-[15px] shrink-0">
        {(cls.title || "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14.5px] font-semibold text-on-surface truncate">{cls.title}</h3>
        <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5">
          {cls.teacherName || t.noTeacher} · {cls.studentIds?.length || 0} {t.studentSuffix}
        </p>
      </div>
      <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
    </button>
  );
}

function UnlinkedRow({ cls, t, onOpen, onAttach }: { cls: ClassData; t: T; onOpen: () => void; onAttach: () => void }) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-state-hover transition-colors">
      <button onClick={onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-[15px] shrink-0">
          {(cls.title || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-semibold text-on-surface truncate">{cls.title}</h3>
          <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5">
            {cls.teacherName || t.noTeacher} · {cls.studentIds?.length || 0} {t.studentSuffix}
          </p>
        </div>
      </button>
      <button
        onClick={onAttach}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary-container rounded-full text-xs font-bold hover:shadow-elev-1 transition-all"
      >
        <Link2 size={12} /> {t.attach}
      </button>
    </div>
  );
}
