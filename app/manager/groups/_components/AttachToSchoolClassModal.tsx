"use client";

import { useState } from "react";
import { Link2, Loader2, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { ClassData } from "@/hooks/useCenterClasses";
import { SchoolClassData, attachExistingGroupToSchoolClass, partitionClasses } from "@/services/schoolClassService";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Sinfga biriktirish",
    subtitle: (name: string) => `"${name}" guruhini bir sinfning fani sifatida bog'lang.`,
    classLabel: "Sinf",
    classPlaceholder: "Sinfni tanlang...",
    hint: "Guruhning hozirgi o'quvchilari sinf ro'yxatiga qo'shiladi, sinfning boshqa o'quvchilari esa bu fanga qo'shiladi.",
    noClasses: "Avval bitta sinf yarating.",
    cancel: "Bekor qilish",
    attaching: "Biriktirilmoqda...",
    attach: "Biriktirish",
    success: "Guruh sinfga biriktirildi!",
    error: "Biriktirishda xatolik yuz berdi.",
  },
  en: {
    title: "Attach to a class",
    subtitle: (name: string) => `Attach "${name}" as a subject of a class.`,
    classLabel: "Class",
    classPlaceholder: "Select a class...",
    hint: "The group's current students join the class roster, and the class's other students join this subject.",
    noClasses: "Create a class first.",
    cancel: "Cancel",
    attaching: "Attaching...",
    attach: "Attach",
    success: "The group has been attached!",
    error: "Something went wrong while attaching.",
  },
  ru: {
    title: "Привязать к классу",
    subtitle: (name: string) => `Привяжите «${name}» как предмет класса.`,
    classLabel: "Класс",
    classPlaceholder: "Выберите класс...",
    hint: "Текущие ученики группы попадут в список класса, а остальные ученики класса — в этот предмет.",
    noClasses: "Сначала создайте класс.",
    cancel: "Отмена",
    attaching: "Привязка...",
    attach: "Привязать",
    success: "Группа привязана!",
    error: "Не удалось привязать группу.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  group: ClassData;
  schoolClasses: SchoolClassData[];
  allClasses: ClassData[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AttachToSchoolClassModal({ group, schoolClasses, allClasses, onClose, onSuccess }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [selectedId, setSelectedId] = useState(schoolClasses[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schoolClass = schoolClasses.find((sc) => sc.id === selectedId);
    if (!schoolClass) return;
    setIsSubmitting(true);
    try {
      const otherSubjectIds = partitionClasses(allClasses, schoolClass.id).map((c) => c.id);
      await attachExistingGroupToSchoolClass(schoolClass, { id: group.id, studentIds: group.studentIds || [] }, otherSubjectIds);
      toast.success(t.success);
      onSuccess();
    } catch (error: any) {
      console.error("Attach to School Class error:", error);
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
            <Link2 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h2>
            <p className="text-[13px] text-on-surface-variant font-medium">{t.subtitle(group.title)}</p>
          </div>
        </div>

        {schoolClasses.length === 0 ? (
          <p className="text-[13px] font-bold text-warning bg-warning-container/40 rounded-m3-md px-3 py-2.5">{t.noClasses}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.classLabel}</label>
              <div className="relative">
                <select
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 appearance-none cursor-pointer"
                >
                  <option value="" disabled>{t.classPlaceholder}</option>
                  {schoolClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.displayName}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                  <ChevronDown size={18} />
                </div>
              </div>
              <p className="text-[12px] font-medium text-on-surface-variant ml-1 leading-snug">{t.hint}</p>
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
                disabled={isSubmitting || !selectedId}
                className="flex-1 h-t-control flex items-center justify-center gap-2 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1"
              >
                {isSubmitting ? (<><Loader2 size={18} className="animate-spin" />{t.attaching}</>) : t.attach}
              </button>
            </div>
          </form>
        )}
      </div>
    </ManagerSheet>
  );
}
