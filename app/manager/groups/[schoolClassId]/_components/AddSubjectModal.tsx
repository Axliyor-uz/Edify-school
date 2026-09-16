"use client";

import { useState } from "react";
import { BookOpen, Loader2, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { CenterTeacher } from "@/hooks/useCenterClasses";
import { SchoolClassData, addSubjectGroup } from "@/services/schoolClassService";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Yangi fan qo'shish",
    subtitle: (n: number) => `Sinfdagi ${n} ta o'quvchi avtomatik qo'shiladi.`,
    nameLabel: "Fan nomi",
    namePlaceholder: "Masalan: Matematika",
    teacherLabel: "O'qituvchi",
    teacherPlaceholder: "O'qituvchini tanlang...",
    noTeachersHint: "Avval \"O'qituvchilar\" bo'limidan o'qituvchi qo'shing.",
    cancel: "Bekor qilish",
    creating: "Qo'shilmoqda...",
    create: "Qo'shish",
    success: "Fan qo'shildi!",
    error: "Fan qo'shishda xatolik yuz berdi.",
  },
  en: {
    title: "Add a subject",
    subtitle: (n: number) => `${n} students already in the class will be added automatically.`,
    nameLabel: "Subject name",
    namePlaceholder: "e.g. Mathematics",
    teacherLabel: "Teacher",
    teacherPlaceholder: "Select a teacher...",
    noTeachersHint: "Add a teacher in the \"Teachers\" section first.",
    cancel: "Cancel",
    creating: "Adding...",
    create: "Add",
    success: "Subject added!",
    error: "Something went wrong while adding the subject.",
  },
  ru: {
    title: "Добавить предмет",
    subtitle: (n: number) => `${n} учеников класса будут добавлены автоматически.`,
    nameLabel: "Название предмета",
    namePlaceholder: "Например: Математика",
    teacherLabel: "Учитель",
    teacherPlaceholder: "Выберите учителя...",
    noTeachersHint: "Сначала добавьте учителя в разделе «Учителя».",
    cancel: "Отмена",
    creating: "Добавление...",
    create: "Добавить",
    success: "Предмет добавлен!",
    error: "Не удалось добавить предмет.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  schoolClass: SchoolClassData;
  teachers: CenterTeacher[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSubjectModal({ schoolClass, teachers, onClose, onSuccess }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [title, setTitle] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedTeacherId) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find((tc) => tc.teacherId === selectedTeacherId);
      await addSubjectGroup(schoolClass, title.trim(), selectedTeacherId, teacher?.teacherName || "");
      toast.success(t.success);
      onSuccess();
    } catch (error: any) {
      console.error("Add subject error:", error);
      toast.error(error?.message || t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!isSubmitting}>
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
            <BookOpen size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h2>
            <p className="text-[13px] text-on-surface-variant font-medium">{t.subtitle(schoolClass.studentIds.length)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">
              {t.nameLabel} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder={t.namePlaceholder}
              className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 placeholder:text-on-surface-variant"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">
              {t.teacherLabel} <span className="text-error">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 appearance-none cursor-pointer"
              >
                <option value="">{t.teacherPlaceholder}</option>
                {teachers.map((tc) => (
                  <option key={tc.teacherId} value={tc.teacherId}>
                    {tc.teacherName} ({tc.teacherEmail})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                <ChevronDown size={18} />
              </div>
            </div>
            {teachers.length === 0 && (
              <p className="text-[12px] font-bold text-warning mt-1.5 px-1">{t.noTeachersHint}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-t-control flex items-center justify-center bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-60"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !selectedTeacherId}
              className="flex-1 h-t-control flex items-center justify-center gap-2 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1"
            >
              {isSubmitting ? (<><Loader2 size={18} className="animate-spin" />{t.creating}</>) : t.create}
            </button>
          </div>
        </form>
      </div>
    </ManagerSheet>
  );
}
