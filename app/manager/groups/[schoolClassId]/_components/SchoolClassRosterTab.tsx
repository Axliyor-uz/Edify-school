"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Users, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/manager-ui";
import toast from "react-hot-toast";
import { ClassData } from "@/hooks/useCenterClasses";
import { SchoolClassData, syncSchoolClassRoster } from "@/services/schoolClassService";
import SchoolClassAddStudentModal from "./SchoolClassAddStudentModal";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";
import SearchInput from "@/app/manager/_components/SearchInput";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    unknownName: "Noma'lum",
    unknownUsername: "noma'lum",
    removed: (name: string) => `${name} sinfdan o'chirildi.`,
    removeError: "O'quvchini o'chirishda xatolik yuz berdi.",
    emptyTitle: "Sinf bo'sh",
    emptyDesc: "Birinchi o'quvchini qo'shing",
    addStudent: "O'quvchi qo'shish",
    searchPlaceholder: "O'quvchini qidiring...",
    studentCount: (n: number) => `${n} ta o'quvchi`,
    noResultsTitle: "Hech narsa topilmadi",
    noResultsDesc: "Qidiruvni o'zgartirib ko'ring",
    removeFromClassTitle: "Sinfdan o'chirish",
    confirmTitle: "O'quvchini o'chirish",
    confirmMessage: (name: string) => `${name} sinfdan va uning barcha fanlaridan o'chiriladi. Uni keyinchalik qayta qo'shishingiz mumkin.`,
    confirmLabel: "O'chirish",
  },
  en: {
    unknownName: "Unknown",
    unknownUsername: "unknown",
    removed: (name: string) => `${name} was removed from the class.`,
    removeError: "Something went wrong while removing the student.",
    emptyTitle: "The class is empty",
    emptyDesc: "Add the first student",
    addStudent: "Add student",
    searchPlaceholder: "Search for a student...",
    studentCount: (n: number) => `${n} students`,
    noResultsTitle: "Nothing found",
    noResultsDesc: "Try changing the search",
    removeFromClassTitle: "Remove from class",
    confirmTitle: "Remove student",
    confirmMessage: (name: string) => `${name} will be removed from the class and every one of its subjects. You can add them back later.`,
    confirmLabel: "Remove",
  },
  ru: {
    unknownName: "Неизвестно",
    unknownUsername: "неизвестно",
    removed: (name: string) => `${name} удалён(а) из класса.`,
    removeError: "Не удалось удалить ученика.",
    emptyTitle: "Класс пуст",
    emptyDesc: "Добавьте первого ученика",
    addStudent: "Добавить ученика",
    searchPlaceholder: "Поиск ученика...",
    studentCount: (n: number) => `Учеников: ${n}`,
    noResultsTitle: "Ничего не найдено",
    noResultsDesc: "Попробуйте изменить запрос",
    removeFromClassTitle: "Удалить из класса",
    confirmTitle: "Удаление ученика",
    confirmMessage: (name: string) => `${name} будет удалён(а) из класса и всех его предметов. Позже его можно добавить снова.`,
    confirmLabel: "Удалить",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  schoolClass: SchoolClassData;
  centerId: string;
  subjectClassIds: string[];
  allClasses: ClassData[];
  onRefresh: () => void;
}

interface StudentProfile {
  uid: string;
  displayName: string;
  username: string;
  totalXP: number;
}

export default function SchoolClassRosterTab({ schoolClass, centerId, subjectClassIds, allClasses, onRefresh }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [studentToRemove, setStudentToRemove] = useState<StudentProfile | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const studentIds = schoolClass.studentIds;

  useEffect(() => {
    let isMounted = true;
    async function fetchStudents() {
      if (!studentIds || studentIds.length === 0) {
        if (isMounted) { setStudents([]); setLoading(false); }
        return;
      }
      setLoading(true);
      try {
        const results = (
          await Promise.all(
            studentIds.map(async (uid) => {
              const sSnap = await getDoc(doc(db, "users", uid));
              if (!sSnap.exists()) return null;
              const data = sSnap.data();
              return {
                uid,
                displayName: data.displayName || t.unknownName,
                username: data.username || t.unknownUsername,
                totalXP: data.totalXP || 0,
              } as StudentProfile;
            })
          )
        ).filter(Boolean) as StudentProfile[];
        results.sort((a, b) => b.totalXP - a.totalXP);
        if (isMounted) setStudents(results);
      } catch (err) {
        console.error("Error fetching roster:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStudents();
    return () => { isMounted = false; };
  }, [studentIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace("@", "");
    if (!q) return students;
    return students.filter((s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }, [students, search]);

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemoving(true);
    try {
      await syncSchoolClassRoster(centerId, schoolClass.id, subjectClassIds, [studentToRemove.uid], "remove");
      toast.success(t.removed(studentToRemove.displayName));
      setStudentToRemove(null);
      onRefresh();
    } catch (err) {
      console.error("Error removing student:", err);
      toast.error(t.removeError);
    } finally {
      setIsRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-surface-container-low rounded-m3-lg">
            <div className="w-10 h-10 bg-surface-container-highest rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-surface-container-highest rounded w-1/3" />
              <div className="h-3 bg-surface-container rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
          <Users size={22} />
        </div>
        <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
        <p className="text-[13px] text-on-surface-variant mt-1">{t.emptyDesc}</p>
        <Button className="mt-5" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
          {t.addStudent}
        </Button>
        {isModalOpen && (
          <SchoolClassAddStudentModal
            schoolClass={schoolClass}
            centerId={centerId}
            subjectClassIds={subjectClassIds}
            allClasses={allClasses}
            existingStudentIds={studentIds || []}
            onClose={() => setIsModalOpen(false)}
            onAdded={onRefresh}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="p-4 sm:p-5 flex flex-wrap gap-3 items-center justify-between border-b border-outline-variant">
        {students.length > 8 ? (
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        ) : (
          <p className="text-[13px] text-on-surface-variant">{t.studentCount(students.length)}</p>
        )}
        <Button className="shrink-0" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
          {t.addStudent}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <p className="text-sm font-bold text-on-surface">{t.noResultsTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1">{t.noResultsDesc}</p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant">
          {filtered.map((student) => (
            <div key={student.uid} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-state-hover transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[14px] shrink-0">
                {student.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[14.5px] font-semibold text-on-surface truncate">{student.displayName}</h4>
                <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5">@{student.username}</p>
              </div>
              <span className="px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold tabular-nums shrink-0">
                {student.totalXP} XP
              </span>
              <button
                onClick={() => setStudentToRemove(student)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors shrink-0"
                title={t.removeFromClassTitle}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <SchoolClassAddStudentModal
          schoolClass={schoolClass}
          centerId={centerId}
          subjectClassIds={subjectClassIds}
          allClasses={allClasses}
          existingStudentIds={studentIds || []}
          onClose={() => setIsModalOpen(false)}
          onAdded={onRefresh}
        />
      )}

      {studentToRemove && (
        <ConfirmDialog
          title={t.confirmTitle}
          message={t.confirmMessage(studentToRemove.displayName)}
          confirmLabel={t.confirmLabel}
          isLoading={isRemoving}
          onConfirm={handleRemoveStudent}
          onClose={() => setStudentToRemove(null)}
        />
      )}
    </div>
  );
}
