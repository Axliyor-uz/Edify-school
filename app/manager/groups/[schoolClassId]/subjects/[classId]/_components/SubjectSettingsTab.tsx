"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Loader2, Settings, Users, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { SubjectClassDocument } from "../page";
import { CenterTeacher } from "@/hooks/useCenterClasses";
import { removeSubjectGroup } from "@/services/schoolClassService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";

const TRANSLATIONS = {
  uz: {
    feeInvalid: "Oylik narx noto'g'ri kiritildi.",
    saved: "Fan sozlamalari saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi",
    generalSection: "Umumiy ma'lumotlar",
    nameLabel: "Fan nomi",
    feeLabel: "Oylik narx (so'm)",
    feePlaceholder: "Masalan: 400000",
    feeHint: "Hisob-kitob shu narxdan hisoblanadi. Bo'sh yoki 0 — fandan pul olinmaydi.",
    changeTeacherSection: "O'qituvchini almashtirish",
    beCareful: "Ehtiyot bo'ling",
    teacherLabel: "Mas'ul o'qituvchi",
    teacherPlaceholder: "O'qituvchini tanlang...",
    loadingTeachers: "O'qituvchilar yuklanmoqda...",
    saveButton: "Sozlamalarni saqlash",
    dangerSection: "Fanni o'chirish",
    deleteWarning: "Fan sinfdan olib tashlanadi. Davomat va o'quvchi natijalari tarixi saqlanib qoladi.",
    deleteButton: "Fanni o'chirish",
    deleteConfirmTitle: "Fanni o'chirish",
    deleteConfirmMessage: (name: string) => `"${name}" fani butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`,
    deleteConfirmLabel: "O'chirish",
    deleted: "Fan o'chirildi.",
    deleteError: "Fanni o'chirishda xatolik yuz berdi.",
  },
  en: {
    feeInvalid: "The monthly fee is invalid.",
    saved: "Subject settings saved!",
    saveError: "Something went wrong while saving",
    generalSection: "General information",
    nameLabel: "Subject name",
    feeLabel: "Monthly fee (so'm)",
    feePlaceholder: "e.g. 400000",
    feeHint: "Billing is calculated from this fee. Empty or 0 — the subject is not billed.",
    changeTeacherSection: "Change teacher",
    beCareful: "Be careful",
    teacherLabel: "Assigned teacher",
    teacherPlaceholder: "Select a teacher...",
    loadingTeachers: "Loading teachers...",
    saveButton: "Save settings",
    dangerSection: "Delete subject",
    deleteWarning: "The subject will be removed from the class. Attendance and score history are kept.",
    deleteButton: "Delete subject",
    deleteConfirmTitle: "Delete subject",
    deleteConfirmMessage: (name: string) => `"${name}" will be permanently deleted. This cannot be undone.`,
    deleteConfirmLabel: "Delete",
    deleted: "The subject has been deleted.",
    deleteError: "Something went wrong while deleting the subject.",
  },
  ru: {
    feeInvalid: "Ежемесячная стоимость указана неверно.",
    saved: "Настройки предмета сохранены!",
    saveError: "Не удалось сохранить изменения",
    generalSection: "Общие сведения",
    nameLabel: "Название предмета",
    feeLabel: "Стоимость в месяц (so'm)",
    feePlaceholder: "Например: 400000",
    feeHint: "Расчёты ведутся по этой стоимости. Пусто или 0 — оплата не взимается.",
    changeTeacherSection: "Смена учителя",
    beCareful: "Будьте внимательны",
    teacherLabel: "Ответственный учитель",
    teacherPlaceholder: "Выберите учителя...",
    loadingTeachers: "Загрузка учителей...",
    saveButton: "Сохранить настройки",
    dangerSection: "Удаление предмета",
    deleteWarning: "Предмет будет удалён из класса. История посещаемости и результатов сохранится.",
    deleteButton: "Удалить предмет",
    deleteConfirmTitle: "Удаление предмета",
    deleteConfirmMessage: (name: string) => `Предмет «${name}» будет удалён безвозвратно. Это действие нельзя отменить.`,
    deleteConfirmLabel: "Удалить",
    deleted: "Предмет удалён.",
    deleteError: "Не удалось удалить предмет.",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  classData: SubjectClassDocument;
  centerId: string;
  schoolClassId: string;
  onUpdate: (data: Partial<SubjectClassDocument>) => void;
}

export default function SubjectSettingsTab({ classData, centerId, schoolClassId, onUpdate }: Props) {
  const { lang } = useManagerLanguage();
  const router = useRouter();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [title, setTitle] = useState(classData.title);
  const [monthlyFee, setMonthlyFee] = useState(classData.monthlyFee ? String(classData.monthlyFee) : "");
  const [selectedTeacherId, setSelectedTeacherId] = useState(classData.teacherId);

  const [centerTeachers, setCenterTeachers] = useState<CenterTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "center_teachers"), where("centerId", "==", centerId)));
        const teachersData = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CenterTeacher[];
        if (isMounted) setCenterTeachers(teachersData);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      } finally {
        if (isMounted) setLoadingTeachers(false);
      }
    })();
    return () => { isMounted = false; };
  }, [centerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedTeacherId) return;

    const feeNum = monthlyFee.trim() === "" ? 0 : parseInt(monthlyFee, 10);
    if (!Number.isInteger(feeNum) || feeNum < 0) {
      toast.error(t.feeInvalid);
      return;
    }

    setIsSaving(true);
    try {
      const selectedTeacher = centerTeachers.find((c) => c.teacherId === selectedTeacherId);
      const teacherName = selectedTeacher?.teacherName || classData.teacherName;

      const updates: Partial<SubjectClassDocument> = {
        title: title.trim(),
        monthlyFee: feeNum,
        teacherId: selectedTeacherId,
        teacherName,
      };
      await updateDoc(doc(db, "classes", classData.id), updates);
      toast.success(t.saved);
      onUpdate(updates);
    } catch (err: any) {
      console.error("Error updating subject settings:", err);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeSubjectGroup(classData.id);
      toast.success(t.deleted);
      router.push(`/manager/groups/${schoolClassId}`);
    } catch (err: any) {
      toast.error(err?.message || t.deleteError);
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> {t.generalSection}
          </h3>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.nameLabel} <span className="text-error">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.feeLabel}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              disabled={isSaving}
              placeholder={t.feePlaceholder}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
            <p className="text-[12px] font-medium text-on-surface-variant ml-1 leading-snug">{t.feeHint}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> {t.changeTeacherSection}
            </h3>
            <span className="text-[11px] font-bold text-on-warning-container bg-warning-container px-2.5 py-1 rounded-full">
              {t.beCareful}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.teacherLabel} <span className="text-error">*</span></label>
            <select
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isSaving || loadingTeachers}
              className="w-full px-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            >
              <option value="" disabled>{t.teacherPlaceholder}</option>
              {centerTeachers.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName} ({teacher.teacherEmail})
                </option>
              ))}
            </select>
            {loadingTeachers && <p className="text-[12px] text-on-surface-variant mt-1 ml-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {t.loadingTeachers}</p>}
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !selectedTeacherId}
            className="w-full sm:w-auto px-8 h-t-control bg-primary text-on-primary font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all shadow-elev-1 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {t.saveButton}
          </button>
        </div>

        <div className="pt-6 border-t border-outline-variant space-y-3">
          <h3 className="text-[11px] font-bold text-error uppercase tracking-wider flex items-center gap-2">
            <Trash2 size={14} /> {t.dangerSection}
          </h3>
          <p className="text-[12.5px] font-medium text-on-surface-variant leading-snug">{t.deleteWarning}</p>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isSaving || isDeleting}
            className="px-6 h-t-control bg-error-container text-on-error-container font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Trash2 size={16} /> {t.deleteButton}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <ConfirmDialog
          title={t.deleteConfirmTitle}
          message={t.deleteConfirmMessage(classData.title)}
          confirmLabel={t.deleteConfirmLabel}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
