"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Info } from "lucide-react";
import toast from "react-hot-toast";
import { SchoolClassData, deleteSchoolClass } from "@/services/schoolClassService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";

const TRANSLATIONS = {
  uz: {
    infoTitle: "Sinf nomi o'zgartirilmaydi",
    infoDesc: "Daraja va bo'lim (masalan \"5-A\") yaratilgandan keyin o'zgartirilmaydi — xato bo'lsa, sinfni o'chirib qaytadan yarating.",
    dangerSection: "Sinfni o'chirish",
    deleteWarning: "Sinfni o'chirish uchun avval barcha fanlarni o'chiring.",
    deleteButton: "Sinfni o'chirish",
    deleteConfirmTitle: "Sinfni o'chirish",
    deleteConfirmMessage: (name: string) => `"${name}" sinfi butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`,
    deleteConfirmLabel: "O'chirish",
    deleted: "Sinf o'chirildi.",
    deleteError: "Sinfni o'chirishda xatolik yuz berdi.",
    hasSubjects: (n: number) => `Avval ${n} ta fanni o'chiring.`,
  },
  en: {
    infoTitle: "The class name can't be renamed",
    infoDesc: "Grade and section (e.g. \"5-A\") are fixed at creation — delete and recreate the class if it's wrong.",
    dangerSection: "Delete class",
    deleteWarning: "Delete every subject first before deleting the class.",
    deleteButton: "Delete class",
    deleteConfirmTitle: "Delete class",
    deleteConfirmMessage: (name: string) => `"${name}" will be permanently deleted. This cannot be undone.`,
    deleteConfirmLabel: "Delete",
    deleted: "The class has been deleted.",
    deleteError: "Something went wrong while deleting the class.",
    hasSubjects: (n: number) => `Delete its ${n} subjects first.`,
  },
  ru: {
    infoTitle: "Название класса нельзя изменить",
    infoDesc: "Класс и буква (например «5-A») фиксируются при создании — при ошибке удалите класс и создайте заново.",
    dangerSection: "Удаление класса",
    deleteWarning: "Сначала удалите все предметы, чтобы удалить класс.",
    deleteButton: "Удалить класс",
    deleteConfirmTitle: "Удаление класса",
    deleteConfirmMessage: (name: string) => `Класс «${name}» будет удалён безвозвратно. Это действие нельзя отменить.`,
    deleteConfirmLabel: "Удалить",
    deleted: "Класс удалён.",
    deleteError: "Не удалось удалить класс.",
    hasSubjects: (n: number) => `Сначала удалите предметы (${n}).`,
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  schoolClass: SchoolClassData;
  subjectCount: number;
}

export default function SchoolClassSettingsTab({ schoolClass, subjectCount }: Props) {
  const { lang } = useManagerLanguage();
  const router = useRouter();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = subjectCount === 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSchoolClass(schoolClass.id);
      toast.success(t.deleted);
      router.push("/manager/groups");
    } catch (err: any) {
      toast.error(err?.message || t.deleteError);
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 max-w-2xl space-y-6">
      <div className="flex items-start gap-3 bg-surface-container-low border border-outline-variant rounded-m3-lg p-4">
        <Info size={18} className="text-on-surface-variant shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-bold text-on-surface">{t.infoTitle}</p>
          <p className="text-[12.5px] text-on-surface-variant mt-0.5 leading-snug">{t.infoDesc}</p>
        </div>
      </div>

      <div className="pt-6 border-t border-outline-variant space-y-3">
        <h3 className="text-[11px] font-bold text-error uppercase tracking-wider flex items-center gap-2">
          <Trash2 size={14} /> {t.dangerSection}
        </h3>
        <p className="text-[12.5px] font-medium text-on-surface-variant leading-snug">
          {canDelete ? t.deleteWarning : t.hasSubjects(subjectCount)}
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={!canDelete || isDeleting}
          className="px-6 h-t-control bg-error-container text-on-error-container font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Trash2 size={16} /> {t.deleteButton}
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t.deleteConfirmTitle}
          message={t.deleteConfirmMessage(schoolClass.displayName)}
          confirmLabel={t.deleteConfirmLabel}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
