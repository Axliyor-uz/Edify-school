"use client";

/**
 * Student profile DIALOG for the manager (mobile-first: bottom sheet on
 * phones, centered card on desktop — the student twin of the teacher dialog):
 * profile view + EDIT (via PATCH /api/manager/students/[uid]), center groups
 * with schedule times, finance state (StudentFinanceSection), photo
 * management, remove-from-center, and — for center-created accounts — the
 * credentials card with the manager-visible password
 * (center_student_credentials — docs/MANAGER.md).
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, updateDoc, arrayRemove } from "firebase/firestore";
import {
  X, Loader2, User, Phone, MapPin, AtSign, Calendar, Info, Layers,
  Flame, Star, Briefcase, Camera, Trash2, Pencil, KeyRound, Copy,
  Eye, EyeOff, RefreshCw, Check, ChevronDown, Mail, Clock,
  ArrowRight, GraduationCap, UserMinus, Wallet, QrCode,
} from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import StudentFinanceSection from "@/app/manager/finance/_components/StudentFinanceSection";
import ParentQrDialog from "@/app/manager/parents/_components/ParentQrDialog";
import { fetchParentLinks } from "@/services/parentLinkService";
import type { ParentLink } from "@/types/Parent";
import { managerApiFetch } from "@/lib/managerApi";
import { getContactOf } from "@/lib/directory";
import { generateFriendlyPassword } from "@/lib/teacherProvision";
import type { ClassData } from "@/hooks/useCenterClasses";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

// Same weekday convention as the group detail page (0 = Sunday).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Grade select options — stored values stay language-independent
// (`school_N` / `uni`); only the labels are localized.
const GRADE_LABELS: Record<LangType, { school: (n: number) => string; uni: string }> = {
  uz: { school: (n) => `${n} - Sinf`, uni: "Universitet / Boshqa" },
  en: { school: (n) => `Grade ${n}`, uni: "University / Other" },
  ru: { school: (n) => `${n} класс`, uni: "Университет / Другое" },
};
export function gradeOptionsFor(lang: LangType) {
  const labels = GRADE_LABELS[lang] || GRADE_LABELS.uz;
  return [
    ...Array.from({ length: 11 }, (_, i) => ({ value: `school_${i + 1}`, label: labels.school(i + 1) })),
    { value: "uni", label: labels.uni },
  ];
}
const gradeLabelFor = (g: string, lang: LangType) =>
  gradeOptionsFor(lang).find((o) => o.value === g)?.label || "";

const TRANSLATIONS = {
  uz: {
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    notProvided: "Kiritilmagan",
    profileNotFound: "O'quvchi ma'lumotlari topilmadi.",
    loadError: "Yuklashda xatolik yuz berdi.",
    nameTooShort: "To'liq ism kamida 3 harf bo'lishi kerak.",
    saved: "Ma'lumotlar saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi.",
    passwordSet: "Yangi parol o'rnatildi!",
    passwordError: "Parolni o'zgartirishda xatolik.",
    removedFromCenter: "O'quvchi markazdan chiqarildi.",
    removeError: "Chiqarishda xatolik yuz berdi.",
    copied: (label: string) => `${label} nusxalandi`,
    fileReadError: "Faylni o'qib bo'lmadi.",
    photoUpdated: "Rasm yangilandi!",
    photoUploadError: "Rasm yuklashda xatolik",
    photoDeleted: "Rasm o'chirildi!",
    photoDeleteError: "O'chirishda xatolik",
    genderMale: "O'g'il bola",
    genderFemale: "Qiz bola",
    headerTitle: "O'quvchi Ma'lumotlari",
    headerEditMode: "Tahrirlash rejimi",
    headerViewMode: "Batafsil ma'lumotlar ko'rinishi",
    editButton: "Tahrirlash",
    viewFullPhoto: "To'liq ko'rish",
    setPhoto: "Rasm o'rnatish",
    centerAccountHint: "Bu hisobni markaz yaratgan",
    centerAccount: "Markaz hisobi",
    credentialsTitle: "Login Ma'lumotlari",
    newPassword: "Yangi parol",
    passwordLabel: "Parol",
    hide: "Yashirish",
    show: "Ko'rsatish",
    copy: "Nusxalash",
    credentialsNote: "Bu hisob markaz tomonidan boshqariladi — parolni faqat siz ko'rasiz va o'zgartira olasiz.",
    editSection: "Ma'lumotlarni Tahrirlash",
    fullName: "To'liq Ism",
    grade: "Sinf",
    notSelected: "Tanlanmagan",
    phone: "Telefon",
    birthDate: "Tug'ilgan sana",
    gender: "Jinsi",
    institutionSchool: "Muassasa (maktab)",
    region: "Viloyat",
    bio: "Bio",
    cancel: "Bekor qilish",
    saving: "Saqlanmoqda...",
    save: "Saqlash",
    groupsSection: "Guruhlar",
    noGroupsTitle: "Hozircha guruhga qo'shilmagan",
    noGroupsDesc: "Guruh sahifasidagi \"O'quvchi qo'shish\" orqali biriktiring.",
    noScheduleSet: "Dars jadvali kiritilmagan",
    goToGroup: "Guruhga o'tish",
    financeSection: "Moliya",
    parentSection: "Ota-ona kirishi",
    parentDesc: "Ota-ona QR ni skanerlab, faqat shu farzandining natijalarini ko'radi. Ro'yxatdan o'tish shart emas.",
    parentNew: "QR yaratish",
    parentActive: "faol havola",
    parentNone: "Havola berilmagan",
    parentAll: "Barcha havolalar",
    personalSection: "Shaxsiy Ma'lumotlar",
    username: "Username",
    email: "Email",
    institution: "Muassasa",
    removeConfirm: "Rostdan ham markazdan chiqarilsinmi? Barcha guruhlardan ham chiqariladi.",
    removeAction: "Chiqarish",
    removeTitle: "Markazdan chiqarish",
    removeDesc: "Ro'yxatdan va barcha guruhlardan olib tashlanadi. Hisob o'chirilmaydi.",
    deletePhoto: "Rasmni o'chirish",
  },
  en: {
    dayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    notProvided: "Not provided",
    profileNotFound: "Student details could not be found.",
    loadError: "Something went wrong while loading.",
    nameTooShort: "The full name must be at least 3 characters long.",
    saved: "Details saved!",
    saveError: "Something went wrong while saving.",
    passwordSet: "New password set!",
    passwordError: "Something went wrong while changing the password.",
    removedFromCenter: "The student was removed from the center.",
    removeError: "Something went wrong while removing.",
    copied: (label: string) => `${label} copied`,
    fileReadError: "The file could not be read.",
    photoUpdated: "Photo updated!",
    photoUploadError: "Something went wrong while uploading the photo",
    photoDeleted: "Photo removed!",
    photoDeleteError: "Something went wrong while deleting",
    genderMale: "Boy",
    genderFemale: "Girl",
    headerTitle: "Student Details",
    headerEditMode: "Edit mode",
    headerViewMode: "Detailed view",
    editButton: "Edit",
    viewFullPhoto: "View full size",
    setPhoto: "Set photo",
    centerAccountHint: "This account was created by the center",
    centerAccount: "Center account",
    credentialsTitle: "Login Credentials",
    newPassword: "New password",
    passwordLabel: "Password",
    hide: "Hide",
    show: "Show",
    copy: "Copy",
    credentialsNote: "This account is managed by the center — only you can see and change the password.",
    editSection: "Edit Details",
    fullName: "Full Name",
    grade: "Grade",
    notSelected: "Not selected",
    phone: "Phone",
    birthDate: "Date of birth",
    gender: "Gender",
    institutionSchool: "Institution (school)",
    region: "Region",
    bio: "Bio",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    groupsSection: "Groups",
    noGroupsTitle: "Not in any group yet",
    noGroupsDesc: "Assign them via \"Add student\" on the group page.",
    noScheduleSet: "No schedule set",
    goToGroup: "Go to group",
    financeSection: "Finance",
    parentSection: "Parent access",
    parentDesc: "A parent scans the QR and sees only this child's results. No signup needed.",
    parentNew: "Create QR",
    parentActive: "active link",
    parentNone: "No link issued",
    parentAll: "All links",
    personalSection: "Personal Details",
    username: "Username",
    email: "Email",
    institution: "Institution",
    removeConfirm: "Really remove them from the center? They will also leave all groups.",
    removeAction: "Remove",
    removeTitle: "Remove from center",
    removeDesc: "They will be taken off the roster and all groups. The account itself is not deleted.",
    deletePhoto: "Delete photo",
  },
  ru: {
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    notProvided: "Не указано",
    profileNotFound: "Данные ученика не найдены.",
    loadError: "Произошла ошибка при загрузке.",
    nameTooShort: "Полное имя должно содержать не менее 3 символов.",
    saved: "Данные сохранены!",
    saveError: "Не удалось сохранить данные.",
    passwordSet: "Новый пароль установлен!",
    passwordError: "Не удалось изменить пароль.",
    removedFromCenter: "Ученик исключён из центра.",
    removeError: "Не удалось исключить ученика.",
    copied: (label: string) => `${label} — скопировано`,
    fileReadError: "Не удалось прочитать файл.",
    photoUpdated: "Фото обновлено!",
    photoUploadError: "Не удалось загрузить фото",
    photoDeleted: "Фото удалено!",
    photoDeleteError: "Не удалось удалить",
    genderMale: "Мальчик",
    genderFemale: "Девочка",
    headerTitle: "Данные ученика",
    headerEditMode: "Режим редактирования",
    headerViewMode: "Подробный просмотр",
    editButton: "Редактировать",
    viewFullPhoto: "Открыть полностью",
    setPhoto: "Установить фото",
    centerAccountHint: "Этот аккаунт создан центром",
    centerAccount: "Аккаунт центра",
    credentialsTitle: "Данные для входа",
    newPassword: "Новый пароль",
    passwordLabel: "Пароль",
    hide: "Скрыть",
    show: "Показать",
    copy: "Скопировать",
    credentialsNote: "Этот аккаунт управляется центром — пароль видите и меняете только вы.",
    editSection: "Редактирование данных",
    fullName: "Полное имя",
    grade: "Класс",
    notSelected: "Не выбрано",
    phone: "Телефон",
    birthDate: "Дата рождения",
    gender: "Пол",
    institutionSchool: "Учреждение (школа)",
    region: "Регион",
    bio: "О себе",
    cancel: "Отмена",
    saving: "Сохранение...",
    save: "Сохранить",
    groupsSection: "Группы",
    noGroupsTitle: "Пока не состоит ни в одной группе",
    noGroupsDesc: "Добавьте через «Добавить ученика» на странице группы.",
    noScheduleSet: "Расписание не задано",
    goToGroup: "Перейти в группу",
    financeSection: "Финансы",
    parentSection: "Родительский доступ",
    parentDesc: "Родитель сканирует QR и видит результаты только этого ребёнка. Регистрация не нужна.",
    parentNew: "Создать QR",
    parentActive: "активная ссылка",
    parentNone: "Ссылка не выдана",
    parentAll: "Все ссылки",
    personalSection: "Личные данные",
    username: "Username",
    email: "Email",
    institution: "Учреждение",
    removeConfirm: "Действительно исключить из центра? Ученик также покинет все группы.",
    removeAction: "Исключить",
    removeTitle: "Исключить из центра",
    removeDesc: "Будет удалён из списка и всех групп. Сам аккаунт не удаляется.",
    deletePhoto: "Удалить фото",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  studentUid: string;
  /** Name already shown in the table — rendered while the doc loads. */
  fallbackName: string;
  centerId?: string | null;
  /** The student's center groups (already loaded by the page — no extra reads). */
  classes?: ClassData[];
  /** Today's attendance chip, precomputed by the students page. */
  todayBadge?: { label: string; cls: string; dot: string };
  /** Fired after the manager sets/removes the photo, so the list can update. */
  onPhotoChange?: (url: string | null) => void;
  /** Fired after the student is removed from the center (list refresh). */
  onRemoved?: () => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Module-level (NOT inside the component) — inline components remount on every
// render and drop input focus per keystroke.
const inputCls = "w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-semibold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60";

function InfoField({ label, value, empty, icon: Icon, span = 1 }: { label: string, value: string, empty: string, icon?: any, span?: number }) {
  return (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
      <div className="flex items-center gap-3 px-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-on-surface">
        {Icon && <Icon className="text-primary shrink-0" size={16} />}
        <span className="text-[14px] font-bold truncate">{value || empty}</span>
      </div>
    </div>
  );
}

function EditField({ label, children, span = 1 }: { label: string, children: React.ReactNode, span?: number }) {
  return (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
      {children}
    </div>
  );
}

interface ProfileData {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  grade: string;
  institution: string;
  bio: string;
  region: string;
  photoURL: string | null;
  totalXP: number;
  currentStreak: number;
  accountType?: string;
}

interface EditDraft {
  displayName: string;
  grade: string;
  phone: string;
  birthDate: string;
  gender: string;
  institution: string;
  bio: string;
  region: string;
}

export default function ManagerStudentInfoPanel({
  studentUid, fallbackName, centerId, classes = [], todayBadge, onPhotoChange, onRemoved, onClose,
}: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isMember, setIsMember] = useState(false); // center_students link exists

  // Credentials (only for center-created accounts).
  const [password, setPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Remove-from-center
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Parent QR access (docs/PARENTS.md). ⚠️ Fetched through the API — the
  // `parent_links` collection is denied to every client, because its document id
  // IS the parent's credential.
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [issueParent, setIssueParent] = useState(false);
  const [showParentLink, setShowParentLink] = useState<ParentLink | null>(null);

  useEffect(() => {
    if (!centerId) return;
    let alive = true;
    fetchParentLinks(studentUid)
      .then((links) => { if (alive) setParentLinks(links); })
      .catch(() => {/* a missing parent list must never block the profile */});
    return () => { alive = false; };
  }, [studentUid, centerId]);

  // ⚠️ A newly ACTIVE link revokes this child's others — mirrored locally,
  // because the server revoked them in the same batch (docs/PARENTS.md).
  const onParentChanged = (link: ParentLink) => {
    setParentLinks((prev) => [
      link,
      ...prev
        .filter((l) => l.token !== link.token)
        .map((l) => (link.status === "active" && l.status === "active"
          ? { ...l, status: "revoked" as const, revokedAt: Date.now() }
          : l)),
    ]);
    setShowParentLink((prev) => (prev && prev.token === link.token ? link : prev));
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [snap, contact, credsSnap, linkSnap] = await Promise.all([
          getDoc(doc(db, "users", studentUid)),
          getContactOf(studentUid).catch(() => ({ email: "", phone: "" })),
          getDoc(doc(db, "center_student_credentials", studentUid)).catch(() => null),
          centerId
            ? getDoc(doc(db, "center_students", `${centerId}_${studentUid}`)).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        if (!snap.exists()) {
          toast.error(t.profileNotFound);
          handleClose();
          return;
        }
        const data = snap.data();
        setProfile({
          displayName: data.displayName || fallbackName || "",
          username: data.username || "",
          email: contact.email || data.email || "",
          phone: contact.phone || "",
          birthDate: data.birthDate || "",
          gender: data.gender || "",
          grade: data.grade || "",
          institution: data.institution || "",
          bio: data.bio || "",
          region: data.location?.region || "",
          photoURL: data.photoURL || null,
          totalXP: data.totalXP || 0,
          currentStreak: data.currentStreak || 0,
          accountType: data.accountType,
        });
        if (credsSnap?.exists()) setPassword(credsSnap.data().password || null);
        setIsMember(!!linkSnap?.exists());
      } catch {
        if (isMounted) toast.error(t.loadError);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUid, centerId]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const startEditing = () => {
    if (!profile) return;
    setDraft({
      displayName: profile.displayName,
      grade: profile.grade,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      institution: profile.institution,
      bio: profile.bio,
      region: profile.region,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!draft || !profile) return;
    if (draft.displayName.trim().length < 3) {
      toast.error(t.nameTooShort);
      return;
    }
    setIsSavingEdit(true);
    try {
      await managerApiFetch(`/api/manager/students/${studentUid}`, {
        method: "PATCH",
        body: {
          displayName: draft.displayName.trim(),
          grade: draft.grade,
          phone: draft.phone.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender,
          institution: draft.institution.trim(),
          bio: draft.bio.trim(),
          region: draft.region.trim(),
        },
      });
      setProfile({ ...profile, ...draft, displayName: draft.displayName.trim() });
      setIsEditing(false);
      toast.success(t.saved);
    } catch (err: any) {
      toast.error(err.message || t.saveError);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile) return;
    const newPassword = generateFriendlyPassword(profile.displayName);
    setIsResettingPassword(true);
    try {
      await managerApiFetch(`/api/manager/students/${studentUid}`, {
        method: "PATCH",
        body: { password: newPassword },
      });
      setPassword(newPassword);
      setShowPassword(true);
      toast.success(t.passwordSet);
    } catch (err: any) {
      toast.error(err.message || t.passwordError);
    } finally {
      setIsResettingPassword(false);
    }
  };

  /** Remove from the center: delete the roster link + leave every center group. */
  const handleRemoveFromCenter = async () => {
    if (!centerId) return;
    setIsRemoving(true);
    try {
      for (const c of classes) {
        await updateDoc(doc(db, "classes", c.id), { studentIds: arrayRemove(studentUid) });
        // Center IELTS group — keep the ielts_groups roster mirror in sync.
        if (c.ieltsGroupId) {
          await updateDoc(doc(db, "ielts_groups", c.ieltsGroupId), { studentIds: arrayRemove(studentUid) }).catch(() => {});
        }
      }
      await deleteDoc(doc(db, "center_students", `${centerId}_${studentUid}`)).catch(() => {});
      toast.success(t.removedFromCenter);
      onRemoved?.();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || t.removeError);
      setIsRemoving(false);
    }
  };

  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t.copied(label));
  };

  const handleSavePhoto = async (blob: Blob) => {
    setIsSavingPhoto(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(t.fileReadError));
        reader.readAsDataURL(blob);
      });
      const { photoURL } = await managerApiFetch<{ photoURL: string }>("/api/manager/user-photo", {
        method: "POST",
        body: { targetUid: studentUid, imageBase64: dataUrl },
      });
      setProfile((prev) => (prev ? { ...prev, photoURL } : prev));
      onPhotoChange?.(photoURL);
      setPhotoFile(null);
      toast.success(t.photoUpdated);
    } catch (err: any) {
      toast.error(err.message || t.photoUploadError);
    } finally {
      setIsSavingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    setIsSavingPhoto(true);
    try {
      await managerApiFetch("/api/manager/user-photo", {
        method: "DELETE",
        body: { targetUid: studentUid },
      });
      setProfile((prev) => (prev ? { ...prev, photoURL: null } : prev));
      onPhotoChange?.(null);
      setShowPhotoViewer(false);
      toast.success(t.photoDeleted);
    } catch (err: any) {
      toast.error(err.message || t.photoDeleteError);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const genderLabel = (g: string) => (g === "male" ? t.genderMale : g === "female" ? t.genderFemale : t.notProvided);
  const studentClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />

      {/* Dialog card — bottom sheet on mobile, centered card from sm: up */}
      <div
        className={`relative w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[90vh] bg-surface shadow-elev-3 flex flex-col rounded-t-m3-xl sm:rounded-m3-xl overflow-hidden transition-all duration-300 ${isClosing ? "opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95" : "opacity-100 translate-y-0 sm:scale-100"}`}
      >
        {/* M3 bottom-sheet drag handle (mobile only) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0 bg-surface-container-lowest">
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-surface-container-lowest border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-on-surface tracking-tight">{t.headerTitle}</h2>
              <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">
                {isEditing ? t.headerEditMode : t.headerViewMode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && profile && !isEditing && (
              <button
                onClick={startEditing}
                title={t.editButton}
                className="flex items-center gap-1.5 pl-3 pr-4 py-2 bg-primary-container text-on-primary-container font-bold text-[13px] rounded-full transition-colors"
              >
                <Pencil size={14} strokeWidth={2.5} /> {t.editButton}
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover hover:text-error text-on-surface-variant rounded-full transition-colors"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6">
          {loading || !profile ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">

              {/* Identity */}
              <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant flex items-center gap-4">
                <div className="relative shrink-0">
                  {profile.photoURL ? (
                    <button type="button" onClick={() => setShowPhotoViewer(true)} title={t.viewFullPhoto} className="block active:scale-95 transition-transform">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-m3-lg object-cover border border-outline-variant" />
                    </button>
                  ) : (
                    <div className="w-20 h-20 rounded-m3-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-[22px]">
                      {getInitials(profile.displayName)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSavingPhoto}
                    title={t.setPhoto}
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center border-[3px] border-surface-container-lowest shadow-elev-2 transition-transform active:scale-90 disabled:opacity-50 z-10"
                  >
                    {isSavingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-black text-on-surface tracking-tight truncate">{profile.displayName || t.notProvided}</h3>
                  {profile.username && (
                    <p className="text-[13px] font-bold text-on-surface-variant truncate">@{profile.username}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {todayBadge && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${todayBadge.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${todayBadge.dot}`} /> {todayBadge.label}
                      </span>
                    )}
                    {profile.grade && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold">
                        <GraduationCap size={11} /> {gradeLabelFor(profile.grade, lang)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning-container text-on-warning-container rounded-full text-[11px] font-bold">
                      <Star size={11} /> {profile.totalXP} XP
                    </span>
                    {profile.currentStreak > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[11px] font-bold">
                        <Flame size={11} /> {profile.currentStreak}
                      </span>
                    )}
                    {profile.accountType === "center-managed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success-container text-on-success-container rounded-full text-[11px] font-bold" title={t.centerAccountHint}>
                        <Check size={11} /> {t.centerAccount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Login credentials — only for center-created accounts */}
              {password !== null && (
                <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <KeyRound size={14} /> {t.credentialsTitle}
                    </h3>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-state-hover text-on-surface-variant font-bold text-[12px] rounded-full transition-colors disabled:opacity-50"
                    >
                      {isResettingPassword ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {t.newPassword}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: t.username, value: profile.username, icon: AtSign },
                      { label: t.email, value: profile.email, icon: Mail },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md">
                        <row.icon size={16} className="text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{row.label}</p>
                          <p className="text-[13.5px] font-bold text-on-surface font-mono truncate">{row.value || "—"}</p>
                        </div>
                        {row.value && (
                          <button type="button" onClick={() => copyValue(row.label, row.value)} title={t.copy}
                            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-state-hover transition-colors">
                            <Copy size={15} />
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="flex items-center gap-3 px-4 py-3 bg-warning-container rounded-m3-md">
                      <KeyRound size={16} className="text-on-warning-container shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-on-warning-container uppercase tracking-wider">{t.passwordLabel}</p>
                        <p className="text-[13.5px] font-bold text-on-warning-container font-mono truncate">
                          {showPassword ? password : "••••••••••"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} title={showPassword ? t.hide : t.show}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-warning-container hover:bg-state-hover transition-colors">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button type="button" onClick={() => copyValue(t.passwordLabel, password)} title={t.copy}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-warning-container hover:bg-state-hover transition-colors">
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                    {t.credentialsNote}
                  </p>
                </div>
              )}

              {isEditing && draft ? (
                /* ── EDIT MODE ── */
                <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5">
                  <h3 className="text-[12px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <Pencil size={13} /> {t.editSection}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditField label={t.fullName} span={2}>
                      <input type="text" value={draft.displayName} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.grade}>
                      <div className="relative">
                        <select value={draft.grade} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="">{t.notSelected}</option>
                          {gradeOptionsFor(lang).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label={t.phone}>
                      <input type="tel" value={draft.phone} disabled={isSavingEdit} placeholder="+998 90 123 45 67"
                        onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.birthDate}>
                      <input type="date" value={draft.birthDate} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.gender}>
                      <div className="relative">
                        <select value={draft.gender} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="">{t.notSelected}</option>
                          <option value="male">{t.genderMale}</option>
                          <option value="female">{t.genderFemale}</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label={t.institutionSchool}>
                      <input type="text" value={draft.institution} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, institution: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.region}>
                      <input type="text" value={draft.region} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, region: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.bio} span={2}>
                      <textarea rows={3} value={draft.bio} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                        className={`${inputCls} resize-none leading-relaxed`} />
                    </EditField>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setIsEditing(false)} disabled={isSavingEdit}
                      className="flex-1 py-3 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-50">
                      {t.cancel}
                    </button>
                    <button type="button" onClick={handleSaveEdit} disabled={isSavingEdit}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-on-primary font-bold rounded-full transition-colors shadow-elev-1 disabled:opacity-50">
                      {isSavingEdit ? <><Loader2 size={16} className="animate-spin" /> {t.saving}</> : t.save}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  {/* Groups + schedule */}
                  <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <Layers size={14}/> {t.groupsSection}
                      <span className="ml-1 px-1.5 py-0.5 bg-primary-container text-on-primary-container rounded-md text-[10px] tabular-nums">{studentClasses.length}</span>
                    </h3>

                    {studentClasses.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] font-bold text-on-surface-variant">{t.noGroupsTitle}</p>
                        <p className="text-[11.5px] text-on-surface-variant mt-1">{t.noGroupsDesc}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {studentClasses.map((c) => {
                          const schedule = [...(c.schedule || [])].sort(
                            (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek),
                          );
                          return (
                            <Link key={c.id} href={`/manager/groups/${c.id}`}
                              className="group block p-4 bg-surface-container-low hover:bg-state-hover border border-outline-variant hover:border-primary rounded-m3-lg transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">{c.title}</p>
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-bold text-on-surface-variant">
                                  <User size={11} className="text-on-surface-variant" /> {c.teacherName}
                                </span>
                              </div>
                              {schedule.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {schedule.map((s, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-lowest border border-outline-variant rounded-m3-sm text-[11px] font-bold text-on-surface-variant">
                                      <Clock size={10} className="text-primary" />
                                      {t.dayShort[s.dayOfWeek]} {s.startTime}–{s.endTime}
                                      {s.roomName ? <span className="text-on-surface-variant font-medium">· {s.roomName}</span> : null}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1.5 text-[11.5px] font-medium text-on-surface-variant">{t.noScheduleSet}</p>
                              )}
                              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                {t.goToGroup} <ArrowRight size={11} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Finance state */}
                  {centerId && (
                    <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant">
                      <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <Wallet size={14}/> {t.financeSection}
                      </h3>
                      <StudentFinanceSection centerId={centerId} studentUid={studentUid} />
                    </div>
                  )}

                  {/* Parent access — the QR a parent scans (docs/PARENTS.md) */}
                  {centerId && (
                    <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant">
                      <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <QrCode size={14}/> {t.parentSection}
                      </h3>
                      <p className="text-[12.5px] leading-relaxed text-on-surface-variant">{t.parentDesc}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {parentLinks.length === 0 ? (
                          <span className="text-[12.5px] font-semibold text-on-surface-variant">{t.parentNone}</span>
                        ) : (
                          parentLinks.map((link) => (
                            <button
                              key={link.token}
                              type="button"
                              onClick={() => setShowParentLink(link)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                                link.status === "active"
                                  ? "border-outline-variant bg-surface-container text-on-surface hover:bg-state-hover"
                                  : "border-outline-variant text-on-surface-variant line-through hover:bg-state-hover"
                              }`}
                            >
                              <QrCode size={13} />
                              {link.label || t.parentActive}
                            </button>
                          ))
                        )}

                        <button
                          type="button"
                          onClick={() => setIssueParent(true)}
                          className="m3-interactive inline-flex items-center gap-1.5 rounded-full bg-primary py-1.5 pl-3 pr-4 text-[12px] font-bold text-on-primary"
                        >
                          <QrCode size={13} /> {t.parentNew}
                        </button>

                        <Link
                          href="/manager/parents"
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
                        >
                          {t.parentAll} <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Personal info */}
                  <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <User size={14}/> {t.personalSection}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InfoField label={t.fullName} value={profile.displayName} empty={t.notProvided} icon={User} span={2} />
                      <InfoField label={t.username} value={profile.username} empty={t.notProvided} icon={AtSign} />
                      <InfoField label={t.email} value={profile.email} empty={t.notProvided} icon={Mail} />
                      <InfoField label={t.phone} value={profile.phone} empty={t.notProvided} icon={Phone} />
                      <InfoField label={t.birthDate} value={profile.birthDate} empty={t.notProvided} icon={Calendar} />
                      <InfoField label={t.gender} value={genderLabel(profile.gender)} empty={t.notProvided} />
                      <InfoField label={t.grade} value={gradeLabelFor(profile.grade, lang)} empty={t.notProvided} icon={GraduationCap} />
                      <InfoField label={t.institution} value={profile.institution} empty={t.notProvided} icon={Briefcase} />
                      <InfoField label={t.region} value={profile.region} empty={t.notProvided} icon={MapPin} />
                    </div>
                  </div>

                  {/* Remove from center */}
                  {isMember && centerId && (
                    <div className="bg-surface-container-lowest p-5 rounded-m3-xl border border-error-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {confirmRemove ? (
                        <>
                          <p className="text-[13px] font-bold text-on-surface">
                            {t.removeConfirm}
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => setConfirmRemove(false)} disabled={isRemoving}
                              className="px-4 py-2 bg-surface-container hover:bg-state-hover text-on-surface-variant font-bold text-[12.5px] rounded-full transition-colors disabled:opacity-50">
                              {t.cancel}
                            </button>
                            <button type="button" onClick={handleRemoveFromCenter} disabled={isRemoving}
                              className="flex items-center gap-1.5 px-4 py-2 bg-error text-on-error font-bold text-[12.5px] rounded-full transition-colors disabled:opacity-50">
                              {isRemoving ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />} {t.removeAction}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[13.5px] font-bold text-on-surface">{t.removeTitle}</p>
                            <p className="text-[12px] text-on-surface-variant mt-0.5">{t.removeDesc}</p>
                          </div>
                          <button type="button" onClick={() => setConfirmRemove(true)}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-error-container text-on-error-container font-bold text-[12.5px] rounded-full transition-colors">
                            <UserMinus size={14} /> {t.removeAction}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Parent QR — issue a new one, or open an existing one to print/revoke */}
      <ParentQrDialog
        open={issueParent}
        onClose={() => setIssueParent(false)}
        student={{ id: studentUid, name: profile?.displayName || fallbackName || "" }}
        hasActive={parentLinks.some((l) => l.status === "active")}
        onChanged={onParentChanged}
      />
      <ParentQrDialog
        open={!!showParentLink}
        onClose={() => setShowParentLink(null)}
        link={showParentLink}
        onChanged={onParentChanged}
      />

      {/* Hidden file input for the manager-set photo */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) setPhotoFile(e.target.files[0]); }} />

      {photoFile && (
        <PhotoCropperModal
          file={photoFile}
          busy={isSavingPhoto}
          onCancel={() => { setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
          onSave={handleSavePhoto}
        />
      )}

      {/* Full-screen photo viewer — manager can also remove the photo */}
      {showPhotoViewer && profile?.photoURL && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setShowPhotoViewer(false)}></div>
          <div className="relative w-full max-w-lg aspect-square rounded-m3-xl bg-inverse-surface overflow-hidden shadow-elev-3 border border-outline-variant">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-scrim to-transparent">
              <button onClick={() => setShowPhotoViewer(false)} className="w-10 h-10 rounded-full bg-inverse-surface text-inverse-on-surface flex items-center justify-center backdrop-blur-md transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
              <button onClick={handleDeletePhoto} disabled={isSavingPhoto} title={t.deletePhoto} className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center backdrop-blur-md transition-colors disabled:opacity-50">
                {isSavingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
