"use client";

import { useState } from "react";
import { BookOpenCheck, Loader2, ChevronDown } from "lucide-react";
import { CenterTeacher } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import { managerApiFetch } from "@/lib/managerApi";

const TRANSLATIONS = {
  uz: {
    createSuccess: "IELTS guruh muvaffaqiyatli yaratildi!",
    createError: "Guruh yaratishda xatolik yuz berdi.",
    title: "Yangi IELTS guruhi",
    subtitle: "O'qituvchini tanlang va guruh nomini kiriting.",
    hint: "IELTS guruhda o'qituvchi mock testlar tayinlaydi; jadval, davomat va to'lovlar oddiy guruhdagidek ishlaydi. O'quvchilarni faqat menejer qo'shadi.",
    nameLabel: "Guruh nomi",
    namePlaceholder: "Masalan: IELTS 1",
    descriptionLabel: "Tavsif (ixtiyoriy)",
    descriptionPlaceholder: "Ertalabki guruh...",
    teacherLabel: "O'qituvchi",
    teacherPlaceholder: "O'qituvchini tanlang...",
    noTeachersHint: "Avval \"O'qituvchilar\" bo'limidan o'qituvchi qo'shing.",
    cancel: "Bekor qilish",
    creating: "Yaratilmoqda...",
    create: "Yaratish",
    targetBandLabel: "Maqsad band",
  },
  en: {
    createSuccess: "IELTS group created successfully!",
    createError: "Something went wrong while creating the group.",
    title: "New IELTS group",
    subtitle: "Pick a teacher and enter the group name.",
    hint: "In an IELTS group the teacher assigns mock tests; schedule, attendance and billing work like any other group. Only the manager enrolls students.",
    nameLabel: "Group name",
    namePlaceholder: "e.g. IELTS 1",
    descriptionLabel: "Description (optional)",
    descriptionPlaceholder: "Morning group...",
    teacherLabel: "Teacher",
    teacherPlaceholder: "Select a teacher...",
    noTeachersHint: "Add a teacher in the \"Teachers\" section first.",
    cancel: "Cancel",
    creating: "Creating...",
    create: "Create",
    targetBandLabel: "Target band",
  },
  ru: {
    createSuccess: "IELTS группа успешно создана!",
    createError: "Не удалось создать группу.",
    title: "Новая IELTS группа",
    subtitle: "Выберите учителя и введите название группы.",
    hint: "В IELTS-группе учитель назначает mock-тесты; расписание, посещаемость и оплата работают как в обычной группе. Учеников добавляет только менеджер.",
    nameLabel: "Название группы",
    namePlaceholder: "Например: IELTS 1",
    descriptionLabel: "Описание (необязательно)",
    descriptionPlaceholder: "Утренняя группа...",
    teacherLabel: "Учитель",
    teacherPlaceholder: "Выберите учителя...",
    noTeachersHint: "Сначала добавьте учителя в разделе «Учителя».",
    cancel: "Отмена",
    creating: "Создание...",
    create: "Создать",
    targetBandLabel: "Целевой band",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  teachers: CenterTeacher[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateIeltsGroupModal({ teachers, onClose, onSuccess }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [targetBand, setTargetBand] = useState("6.5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedTeacherId) return;

    setIsSubmitting(true);

    try {
      // Linked pair (class + ielts_groups twin) — server-side batch, Admin SDK.
      await managerApiFetch("/api/manager/ielts-groups", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          teacherId: selectedTeacherId,
          targetBand: parseFloat(targetBand),
        },
      });

      toast.success(t.createSuccess);
      onSuccess();
    } catch (error: any) {
      console.error("Create IELTS Group Error:", error);
      toast.error(error?.message || t.createError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!isSubmitting}>
      <div className="p-6 sm:p-7">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
            <BookOpenCheck size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface tracking-tight">
              {t.title}
            </h2>
            <p className="text-[13px] text-on-surface-variant font-medium">
              {t.subtitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <p className="text-[12px] font-medium text-on-surface-variant leading-snug bg-surface-container-low border border-outline-variant rounded-m3-md px-3 py-2.5">
            {t.hint}
          </p>

          {/* Target band */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">
              {t.targetBandLabel} <span className="text-error">*</span>
            </label>
            <div className="relative">
              <select
                value={targetBand}
                onChange={(e) => setTargetBand(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 h-t-control bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 appearance-none cursor-pointer"
              >
                {["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"].map((b) => (
                  <option key={b} value={b}>Band {b}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          {/* Title Input */}
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

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">
              {t.descriptionLabel}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder={t.descriptionPlaceholder}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none disabled:opacity-60 placeholder:text-on-surface-variant"
            />
          </div>

          {/* Teacher Selector */}
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
              <p className="text-[12px] font-bold text-warning mt-1.5 px-1">
                {t.noTeachersHint}
              </p>
            )}
          </div>

          {/* Buttons */}
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
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.creating}
                </>
              ) : (
                t.create
              )}
            </button>
          </div>
        </form>

      </div>
    </ManagerSheet>
  );
}
