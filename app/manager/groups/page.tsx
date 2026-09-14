"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Users, Copy, Lock, ChevronRight, CalendarX2, BookOpenCheck } from "lucide-react";
import { Button } from "@/components/manager-ui";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import CreateGroupModal from "./_components/CreateGroupModal";
import SearchInput from "../_components/SearchInput";
import FilterSelect from "../_components/FilterSelect";
import { useRouter } from "next/navigation";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Guruhlar",
    subtitleCounts: (g: number, s: number) => `${g} ta guruh · ${s} ta o'quvchi`,
    subtitleAll: "Markazdagi barcha guruhlar",
    newGroup: "Yangi guruh",
    searchPlaceholder: "Guruh yoki o'qituvchini qidiring...",
    allTeachers: "Barcha o'qituvchilar",
    groupCount: (n: number) => `${n} ta guruh`,
    codeCopied: "Kod nusxalandi!",
    emptyTitle: "Hali guruhlar yo'q",
    emptyDesc: "Birinchi guruhni yarating — o'qituvchi va o'quvchilarni keyin qo'shasiz.",
    noResultsTitle: "Hech narsa topilmadi",
    noResultsDesc: "Filtr yoki qidiruvni o'zgartirib ko'ring",
    noTeacher: "O'qituvchi yo'q",
    studentSuffix: "o'quvchi",
    locked: "Qulflangan",
    active: "Faol",
    copyJoinCode: "Kirish kodini nusxalash",
  },
  en: {
    title: "Groups",
    subtitleCounts: (g: number, s: number) => `${g} groups · ${s} students`,
    subtitleAll: "All groups in the center",
    newGroup: "New group",
    searchPlaceholder: "Search by group or teacher...",
    allTeachers: "All teachers",
    groupCount: (n: number) => `${n} groups`,
    codeCopied: "Code copied!",
    emptyTitle: "No groups yet",
    emptyDesc: "Create your first group — you can add the teacher and students later.",
    noResultsTitle: "Nothing found",
    noResultsDesc: "Try changing the filter or the search",
    noTeacher: "No teacher",
    studentSuffix: "students",
    locked: "Locked",
    active: "Active",
    copyJoinCode: "Copy join code",
  },
  ru: {
    title: "Группы",
    subtitleCounts: (g: number, s: number) => `Групп: ${g} · учеников: ${s}`,
    subtitleAll: "Все группы учебного центра",
    newGroup: "Новая группа",
    searchPlaceholder: "Поиск по группе или учителю...",
    allTeachers: "Все учителя",
    groupCount: (n: number) => `Групп: ${n}`,
    codeCopied: "Код скопирован!",
    emptyTitle: "Групп пока нет",
    emptyDesc: "Создайте первую группу — учителя и учеников можно добавить позже.",
    noResultsTitle: "Ничего не найдено",
    noResultsDesc: "Попробуйте изменить фильтр или запрос",
    noTeacher: "Без учителя",
    studentSuffix: "учеников",
    locked: "Заблокирована",
    active: "Активна",
    copyJoinCode: "Скопировать код доступа",
  },
};
type T = typeof TRANSLATIONS.uz;

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    }).catch((err) => console.error("Profile error:", err));
  }, [user]);

  const { classes, teachers, isLoading, error, refetch } = useCenterClasses(centerId);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.codeCopied);
  };

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentIds?.length || 0), 0);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (c.teacherId && !map.has(c.teacherId)) map.set(c.teacherId, c.teacherName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (teacherFilter && c.teacherId !== teacherFilter) return false;
      if (q && !(c.title || "").toLowerCase().includes(q) && !(c.teacherName || "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [classes, search, teacherFilter]);

  const hasFilters = search.trim() !== "" || teacherFilter !== "";
  const openGroup = (id: string) => router.push(`/manager/groups/${id}`);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {!isLoading && classes.length > 0
              ? t.subtitleCounts(classes.length, totalStudents)
              : t.subtitleAll}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
          {t.newGroup}
        </Button>
      </div>

      {/* Search + teacher filter */}
      {!isLoading && classes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
          {teacherOptions.length > 1 && (
            <FilterSelect
              value={teacherFilter}
              onChange={setTeacherFilter}
              options={teacherOptions}
              allLabel={t.allTeachers}
            />
          )}
          {hasFilters && (
            <p className="text-[12.5px] text-on-surface-variant ml-auto">{t.groupCount(filtered.length)}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error-container text-on-error-container px-5 py-4 rounded-m3-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <>
          <div className="sm:hidden bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden animate-pulse">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 bg-surface-container-highest rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surface-container-highest rounded w-2/3" />
                  <div className="h-3 bg-surface-container rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-surface-container-highest rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-surface-container-highest rounded w-3/4" />
                    <div className="h-3 bg-surface-container rounded w-1/2" />
                  </div>
                </div>
                <div className="h-px bg-surface-container my-4" />
                <div className="flex justify-between">
                  <div className="h-3 bg-surface-container rounded w-20" />
                  <div className="h-6 bg-surface-container rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty */}
      {!isLoading && classes.length === 0 && !error && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <CalendarX2 size={22} />
          </div>
          <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[280px] mx-auto">
            {t.emptyDesc}
          </p>
          <Button className="mt-5" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
            {t.newGroup}
          </Button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && classes.length > 0 && filtered.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl py-12 px-6 text-center">
          <p className="text-sm font-bold text-on-surface">{t.noResultsTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1">{t.noResultsDesc}</p>
        </div>
      )}

      {/* Mobile: compact rows */}
      {!isLoading && filtered.length > 0 && (
        <div className="sm:hidden bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
          {filtered.map((cls) => (
            <GroupRow key={cls.id} cls={cls} t={t} onOpen={() => openGroup(cls.id)} />
          ))}
        </div>
      )}

      {/* Desktop: cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((cls) => (
            <GroupCard key={cls.id} cls={cls} t={t} onOpen={() => openGroup(cls.id)} onCopy={handleCopyCode} />
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {isModalOpen && centerId && (
        <CreateGroupModal
          centerId={centerId}
          teachers={teachers}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function Avatar({ title }: { title: string }) {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[15px] shrink-0">
      {(title || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function GroupRow({ cls, t, onOpen }: { cls: ClassData; t: T; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-state-hover active:bg-state-hover transition-colors"
    >
      <Avatar title={cls.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14.5px] font-semibold text-on-surface truncate">{cls.title}</h3>
          {cls.ieltsGroupId && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-m3-xs text-[10px] font-black bg-tertiary-container text-on-tertiary-container shrink-0">
              IELTS
            </span>
          )}
          {cls.isLocked && <Lock size={13} className="text-error shrink-0" />}
        </div>
        <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5">
          {cls.teacherName || t.noTeacher} · {cls.studentIds?.length || 0} {t.studentSuffix}
        </p>
      </div>
      <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
    </button>
  );
}

function GroupCard({ cls, t, onOpen, onCopy }: { cls: ClassData; t: T; onOpen: () => void; onCopy: (code: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group bg-surface-container-lowest rounded-m3-xl border border-outline-variant p-5 hover:shadow-elev-2 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar title={cls.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[14.5px] font-semibold text-on-surface tracking-tight truncate group-hover:text-primary transition-colors">
              {cls.title}
            </h3>
            {cls.ieltsGroupId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-m3-xs text-[10px] font-black bg-tertiary-container text-on-tertiary-container shrink-0">
                IELTS
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5">{cls.teacherName || t.noTeacher}</p>
        </div>

        {cls.isLocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-error-container text-on-error-container shrink-0">
            <Lock size={11} /> {t.locked}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success-container text-on-success-container shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> {t.active}
          </span>
        )}
      </div>

      {/* Footer: students + join code */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-outline-variant">
        <div className="flex items-center gap-1.5 text-on-surface">
          <Users size={15} className="text-on-surface-variant" />
          <span className="text-[13px] font-semibold tabular-nums">{cls.studentIds?.length || 0}</span>
          <span className="text-xs text-on-surface-variant">{t.studentSuffix}</span>
        </div>

        {cls.ieltsGroupId ? (
          // Managed IELTS group: enrollment is manager-only — the join code is
          // meaningless, show the group type instead.
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary-container text-on-tertiary-container rounded-full text-xs font-bold">
            <BookOpenCheck size={12} /> IELTS
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(cls.joinCode); }}
            title={t.copyJoinCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-state-hover border border-outline-variant rounded-full transition-colors group/code"
          >
            <span className="text-xs font-mono font-bold text-on-surface tracking-widest">{cls.joinCode}</span>
            <Copy size={12} className="text-on-surface-variant group-hover/code:text-primary" />
          </button>
        )}
      </div>
    </div>
  );
}
