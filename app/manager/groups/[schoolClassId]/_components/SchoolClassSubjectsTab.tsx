"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BookOpen, Plus, ChevronRight, Trash2, Users } from "lucide-react";
import { Button } from "@/components/manager-ui";
import { ClassData, CenterTeacher } from "@/hooks/useCenterClasses";
import { SchoolClassData, removeSubjectGroup } from "@/services/schoolClassService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";
import AddSubjectModal from "./AddSubjectModal";

const TRANSLATIONS = {
  uz: {
    addSubject: "Fan qo'shish",
    emptyTitle: "Hali fanlar yo'q",
    emptyDesc: "Birinchi fanni qo'shing — o'qituvchini tanlaysiz, o'quvchilar avtomatik qo'shiladi.",
    noTeacher: "O'qituvchi yo'q",
    studentSuffix: "o'quvchi",
    removeTitle: "Fanni o'chirish",
    confirmTitle: "Fanni o'chirish",
    confirmMessage: (name: string) => `"${name}" fani sinfdan butunlay o'chiriladi. Davomat va natijalar tarixi saqlanadi.`,
    confirmLabel: "O'chirish",
    removed: (name: string) => `"${name}" o'chirildi.`,
    removeError: "Fanni o'chirishda xatolik yuz berdi.",
  },
  en: {
    addSubject: "Add subject",
    emptyTitle: "No subjects yet",
    emptyDesc: "Add the first subject — pick a teacher, students are added automatically.",
    noTeacher: "No teacher",
    studentSuffix: "students",
    removeTitle: "Delete subject",
    confirmTitle: "Delete subject",
    confirmMessage: (name: string) => `"${name}" will be permanently removed from the class. Attendance and score history are kept.`,
    confirmLabel: "Delete",
    removed: (name: string) => `"${name}" was deleted.`,
    removeError: "Something went wrong while deleting the subject.",
  },
  ru: {
    addSubject: "Добавить предмет",
    emptyTitle: "Предметов пока нет",
    emptyDesc: "Добавьте первый предмет — выберите учителя, ученики добавятся автоматически.",
    noTeacher: "Без учителя",
    studentSuffix: "учеников",
    removeTitle: "Удалить предмет",
    confirmTitle: "Удаление предмета",
    confirmMessage: (name: string) => `Предмет «${name}» будет удалён из класса. История посещаемости и результатов сохранится.`,
    confirmLabel: "Удалить",
    removed: (name: string) => `«${name}» удалён.`,
    removeError: "Не удалось удалить предмет.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  schoolClass: SchoolClassData;
  subjects: ClassData[];
  teachers: CenterTeacher[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function SchoolClassSubjectsTab({ schoolClass, subjects, teachers, isLoading, onRefresh }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toRemove, setToRemove] = useState<ClassData | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (!toRemove) return;
    setIsRemoving(true);
    try {
      await removeSubjectGroup(toRemove.id);
      toast.success(t.removed(toRemove.title));
      setToRemove(null);
      onRefresh();
    } catch (err) {
      console.error("Error removing subject:", err);
      toast.error(t.removeError);
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        {Array(3).fill(0).map((_, i) => (
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

  return (
    <div className="flex flex-col">
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-outline-variant">
        <p className="text-[13px] text-on-surface-variant">{subjects.length}</p>
        <Button onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
          {t.addSubject}
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <BookOpen size={22} />
          </div>
          <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[320px] mx-auto">{t.emptyDesc}</p>
          <Button className="mt-5" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />}>
            {t.addSubject}
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant">
          {subjects.map((subj) => (
            <div key={subj.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-state-hover transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[14px] shrink-0">
                {(subj.title || "?").charAt(0).toUpperCase()}
              </div>
              <Link href={`/manager/groups/${schoolClass.id}/subjects/${subj.id}`} className="min-w-0 flex-1">
                <h4 className="text-[14.5px] font-semibold text-on-surface truncate">{subj.title}</h4>
                <p className="text-[12.5px] text-on-surface-variant truncate mt-0.5 flex items-center gap-1.5">
                  {subj.teacherName || t.noTeacher}
                  <span className="inline-flex items-center gap-1">
                    <Users size={11} /> {subj.studentIds?.length || 0} {t.studentSuffix}
                  </span>
                </p>
              </Link>
              <button
                onClick={() => setToRemove(subj)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors shrink-0"
                title={t.removeTitle}
              >
                <Trash2 size={15} />
              </button>
              <Link href={`/manager/groups/${schoolClass.id}/subjects/${subj.id}`}>
                <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <AddSubjectModal
          schoolClass={schoolClass}
          teachers={teachers}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); onRefresh(); }}
        />
      )}

      {toRemove && (
        <ConfirmDialog
          title={t.confirmTitle}
          message={t.confirmMessage(toRemove.title)}
          confirmLabel={t.confirmLabel}
          isLoading={isRemoving}
          onConfirm={handleRemove}
          onClose={() => setToRemove(null)}
        />
      )}
    </div>
  );
}
