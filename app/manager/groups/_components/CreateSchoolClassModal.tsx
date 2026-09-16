"use client";

import { useState } from "react";
import { Layers, Loader2, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { createSchoolClass, GRADE_OPTIONS, SchoolClassData } from "@/services/schoolClassService";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Yangi sinf yaratish",
    subtitle: "Daraja va bo'limni tanlang, masalan 5-A.",
    gradeLabel: "Daraja",
    sectionLabel: "Bo'lim",
    sectionPlaceholder: "Masalan: A",
    cancel: "Bekor qilish",
    creating: "Yaratilmoqda...",
    create: "Yaratish",
    success: (name: string) => `${name} sinfi yaratildi!`,
    error: "Sinf yaratishda xatolik yuz berdi.",
    alreadyExists: "Bu sinf allaqachon mavjud.",
    emptySection: "Bo'limni kiriting.",
  },
  en: {
    title: "Create a new class",
    subtitle: "Pick a grade and a section, e.g. 5-A.",
    gradeLabel: "Grade",
    sectionLabel: "Section",
    sectionPlaceholder: "e.g. A",
    cancel: "Cancel",
    creating: "Creating...",
    create: "Create",
    success: (name: string) => `Class ${name} created!`,
    error: "Something went wrong while creating the class.",
    alreadyExists: "This class already exists.",
    emptySection: "Enter a section.",
  },
  ru: {
    title: "Создание нового класса",
    subtitle: "Выберите класс и букву, например 5-A.",
    gradeLabel: "Класс",
    sectionLabel: "Буква",
    sectionPlaceholder: "Например: A",
    cancel: "Отмена",
    creating: "Создание...",
    create: "Создать",
    success: (name: string) => `Класс ${name} создан!`,
    error: "Не удалось создать класс.",
    alreadyExists: "Такой класс уже существует.",
    emptySection: "Введите букву.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  centerId: string;
  onClose: () => void;
  onSuccess: (schoolClass: SchoolClassData) => void;
}

export default function CreateSchoolClassModal({ centerId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [grade, setGrade] = useState("1");
  const [section, setSection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const sc = await createSchoolClass(centerId, grade, section, user.uid);
      toast.success(t.success(sc.displayName));
      onSuccess(sc);
    } catch (error: any) {
      console.error("Create School Class error:", error);
      if (error?.message === "ALREADY_EXISTS") toast.error(t.alreadyExists);
      else if (error?.message === "EMPTY_SECTION") toast.error(t.emptySection);
      else toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!isSubmitting}>
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
            <Layers size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h2>
            <p className="text-[13px] text-on-surface-variant font-medium">{t.subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.gradeLabel}</label>
              <div className="relative">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 appearance-none cursor-pointer"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant ml-1">
                {t.sectionLabel} <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={isSubmitting}
                placeholder={t.sectionPlaceholder}
                className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 placeholder:text-on-surface-variant uppercase"
              />
            </div>
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
              disabled={isSubmitting || !section.trim()}
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
