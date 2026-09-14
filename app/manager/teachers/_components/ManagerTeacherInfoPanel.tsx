"use client";

/**
 * Teacher profile DIALOG for the manager (mobile-first: bottom sheet on
 * phones, centered card on desktop): view + EDIT profile fields (via PATCH
 * /api/manager/teachers/[uid]), the teacher's center groups with their
 * schedule times, and — for center-created accounts — the login credentials
 * card with the manager-visible password (center_teacher_credentials —
 * docs/MANAGER.md).
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  X, Loader2, User, Phone, Briefcase, MapPin, AtSign, BookOpen,
  GraduationCap, Calendar, Info, Camera, Trash2, Pencil, KeyRound,
  Copy, Eye, EyeOff, RefreshCw, Check, ChevronDown, Mail,
  Layers, Users, Clock, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import { managerApiFetch } from "@/lib/managerApi";
import { getContactOf } from "@/lib/directory";
import { generateFriendlyPassword } from "@/lib/teacherProvision";
import { subjectOptionsFor } from "./CreateTeacherModal";
import type { ClassData } from "@/hooks/useCenterClasses";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

// Same weekday convention as the group detail page (0 = Sunday).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TRANSLATIONS = {
  uz: {
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    notProvided: "Kiritilmagan",
    male: "Erkak",
    female: "Ayol",
    profileNotFound: "O'qituvchi ma'lumotlari topilmadi.",
    loadError: "Yuklashda xatolik yuz berdi.",
    nameTooShort: "To'liq ism kamida 3 harf bo'lishi kerak.",
    saved: "Ma'lumotlar saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi.",
    passwordSet: "Yangi parol o'rnatildi!",
    passwordError: "Parolni o'zgartirishda xatolik.",
    copiedSuffix: "nusxalandi",
    fileReadError: "Faylni o'qib bo'lmadi.",
    photoUpdated: "Rasm yangilandi!",
    photoUploadError: "Rasm yuklashda xatolik",
    photoDeleted: "Rasm o'chirildi!",
    photoDeleteError: "O'chirishda xatolik",
    headerTitle: "O'qituvchi Ma'lumotlari",
    editMode: "Tahrirlash rejimi",
    viewMode: "Batafsil ma'lumotlar ko'rinishi",
    edit: "Tahrirlash",
    centerAccount: "Markaz hisobi",
    centerAccountTitle: "Bu hisobni markaz yaratgan",
    loginInfo: "Login Ma'lumotlari",
    newPassword: "Yangi parol",
    username: "Username",
    email: "Email",
    password: "Parol",
    hide: "Yashirish",
    show: "Ko'rsatish",
    copy: "Nusxalash",
    credentialsNote: "Bu hisob markaz tomonidan boshqariladi — parolni faqat siz ko'rasiz va o'zgartira olasiz.",
    editInfo: "Ma'lumotlarni Tahrirlash",
    fullName: "To'liq Ism",
    subject: "Fani",
    select: "Tanlang",
    phone: "Telefon",
    birthDate: "Tug'ilgan sana",
    gender: "Jinsi",
    notSelected: "Tanlanmagan",
    experienceYearsLabel: "Tajriba (yil)",
    institution: "Muassasa",
    region: "Viloyat",
    bio: "Bio",
    cancel: "Bekor qilish",
    saving: "Saqlanmoqda...",
    save: "Saqlash",
    mainInfo: "Asosiy Ma'lumotlar",
    professionalInfo: "Kasbiy Ma'lumotlar",
    experience: "Tajriba",
    experienceYears: (n: number) => `${n} Yil`,
    groups: "Guruhlar",
    noGroups: "Bu o'qituvchida markaz guruhlari yo'q",
    noGroupsHint: "Guruhlar bo'limidan yangi guruh yaratib biriktiring.",
    noSchedule: "Dars jadvali kiritilmagan",
    goToGroup: "Guruhga o'tish",
    locationBio: "Joylashuv & Bio",
    noInfo: "Ma'lumot yo'q",
    viewFull: "To'liq ko'rish",
    setPhoto: "Rasm o'rnatish",
    deletePhoto: "Rasmni o'chirish",
  },
  en: {
    dayShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    notProvided: "Not provided",
    male: "Male",
    female: "Female",
    profileNotFound: "Teacher details not found.",
    loadError: "Failed to load.",
    nameTooShort: "The full name must be at least 3 characters.",
    saved: "Details saved!",
    saveError: "Failed to save.",
    passwordSet: "New password set!",
    passwordError: "Failed to change the password.",
    copiedSuffix: "copied",
    fileReadError: "Could not read the file.",
    photoUpdated: "Photo updated!",
    photoUploadError: "Failed to upload the photo",
    photoDeleted: "Photo removed!",
    photoDeleteError: "Failed to remove",
    headerTitle: "Teacher Details",
    editMode: "Edit mode",
    viewMode: "Detailed information view",
    edit: "Edit",
    centerAccount: "Center account",
    centerAccountTitle: "This account was created by the center",
    loginInfo: "Login Details",
    newPassword: "New password",
    username: "Username",
    email: "Email",
    password: "Password",
    hide: "Hide",
    show: "Show",
    copy: "Copy",
    credentialsNote: "This account is managed by the center — only you can see and change the password.",
    editInfo: "Edit Details",
    fullName: "Full Name",
    subject: "Subject",
    select: "Select",
    phone: "Phone",
    birthDate: "Date of birth",
    gender: "Gender",
    notSelected: "Not selected",
    experienceYearsLabel: "Experience (years)",
    institution: "Institution",
    region: "Region",
    bio: "Bio",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    mainInfo: "Main Details",
    professionalInfo: "Professional Details",
    experience: "Experience",
    experienceYears: (n: number) => `${n} yrs`,
    groups: "Groups",
    noGroups: "This teacher has no center groups",
    noGroupsHint: "Create a new group in the Groups section and assign it.",
    noSchedule: "No schedule set",
    goToGroup: "Go to group",
    locationBio: "Location & Bio",
    noInfo: "No information",
    viewFull: "View full size",
    setPhoto: "Set photo",
    deletePhoto: "Remove photo",
  },
  ru: {
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    notProvided: "Не указано",
    male: "Мужской",
    female: "Женский",
    profileNotFound: "Данные учителя не найдены.",
    loadError: "Ошибка при загрузке.",
    nameTooShort: "Полное имя должно содержать не менее 3 букв.",
    saved: "Данные сохранены!",
    saveError: "Ошибка при сохранении.",
    passwordSet: "Новый пароль установлен!",
    passwordError: "Ошибка при смене пароля.",
    copiedSuffix: "скопировано",
    fileReadError: "Не удалось прочитать файл.",
    photoUpdated: "Фото обновлено!",
    photoUploadError: "Ошибка при загрузке фото",
    photoDeleted: "Фото удалено!",
    photoDeleteError: "Ошибка при удалении",
    headerTitle: "Данные учителя",
    editMode: "Режим редактирования",
    viewMode: "Подробный просмотр данных",
    edit: "Редактировать",
    centerAccount: "Аккаунт центра",
    centerAccountTitle: "Этот аккаунт создан центром",
    loginInfo: "Данные для входа",
    newPassword: "Новый пароль",
    username: "Имя пользователя",
    email: "Email",
    password: "Пароль",
    hide: "Скрыть",
    show: "Показать",
    copy: "Копировать",
    credentialsNote: "Этот аккаунт управляется центром — только вы видите и можете изменить пароль.",
    editInfo: "Редактировать данные",
    fullName: "Полное имя",
    subject: "Предмет",
    select: "Выберите",
    phone: "Телефон",
    birthDate: "Дата рождения",
    gender: "Пол",
    notSelected: "Не выбрано",
    experienceYearsLabel: "Опыт (лет)",
    institution: "Учреждение",
    region: "Область",
    bio: "О себе",
    cancel: "Отмена",
    saving: "Сохранение...",
    save: "Сохранить",
    mainInfo: "Основные данные",
    professionalInfo: "Профессиональные данные",
    experience: "Опыт",
    experienceYears: (n: number) => `${n} лет`,
    groups: "Группы",
    noGroups: "У этого учителя нет групп центра",
    noGroupsHint: "Создайте новую группу в разделе «Группы» и привяжите её.",
    noSchedule: "Расписание не задано",
    goToGroup: "Перейти к группе",
    locationBio: "Местоположение и о себе",
    noInfo: "Нет информации",
    viewFull: "Открыть полностью",
    setPhoto: "Установить фото",
    deletePhoto: "Удалить фото",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  teacherUid: string;
  /** The teacher's center groups (already loaded by the page — no extra reads). */
  classes?: ClassData[];
  /** Fired after the manager sets/removes the photo, so the card list can update. */
  onPhotoChange?: (url: string | null) => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface ProfileData {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  birthDate: string;
  institution: string;
  bio: string;
  gender: string;
  subject: string;
  experience: number;
  region: string;
  photoURL: string | null;
  accountType?: string;
}

// Module-level (NOT inside the component): an inline-defined component gets a
// new identity every render, which remounts its children and drops input focus
// on each keystroke.
const inputCls = "w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-semibold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60";

function InfoField({ label, value, icon: Icon, span = 1, emptyText }: { label: string, value: string, icon?: any, span?: number, emptyText: string }) {
  return (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
      <div className="flex items-center gap-3 px-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-on-surface">
        {Icon && <Icon className="text-primary shrink-0" size={16} />}
        <span className="text-[14px] font-bold truncate">{value || emptyText}</span>
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

/** The PATCH-able subset the edit form works on. */
interface EditDraft {
  displayName: string;
  subject: string;
  phone: string;
  birthDate: string;
  gender: string;
  experience: number;
  institution: string;
  bio: string;
  region: string;
}

export default function ManagerTeacherInfoPanel({ teacherUid, classes = [], onPhotoChange, onClose }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Manager-set photo flow (upload goes through /api/manager/user-photo).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Credentials (only exists for center-created accounts).
  const [password, setPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        // Contact details come from /api/directory/contact (owner-only
        // subcollection) — the public users doc no longer carries them.
        const [snap, contact, credsSnap] = await Promise.all([
          getDoc(doc(db, "users", teacherUid)),
          getContactOf(teacherUid).catch(() => ({ email: "", phone: "" })),
          getDoc(doc(db, "center_teacher_credentials", teacherUid)).catch(() => null),
        ]);
        if (!isMounted) return;
        if (!snap.exists()) {
          toast.error(t.profileNotFound);
          handleClose();
          return;
        }
        const data = snap.data();
        setProfile({
          displayName: data.displayName || "Kiritilmagan",
          username: data.username || "",
          email: contact.email || data.email || "",
          phone: contact.phone || "",
          birthDate: data.birthDate || "",
          institution: data.institution || "",
          bio: data.bio || "",
          gender: data.gender || "",
          subject: data.subject || "",
          experience: data.experience || 0,
          region: data.location?.region || "",
          photoURL: data.photoURL || null,
          accountType: data.accountType,
        });
        if (credsSnap?.exists()) setPassword(credsSnap.data().password || null);
      } catch {
        if (isMounted) toast.error(t.loadError);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherUid]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const startEditing = () => {
    if (!profile) return;
    setDraft({
      displayName: profile.displayName === "Kiritilmagan" ? "" : profile.displayName,
      subject: profile.subject,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      experience: profile.experience,
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
      await managerApiFetch(`/api/manager/teachers/${teacherUid}`, {
        method: "PATCH",
        body: {
          displayName: draft.displayName.trim(),
          subject: draft.subject,
          phone: draft.phone.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender,
          experience: draft.experience,
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
      await managerApiFetch(`/api/manager/teachers/${teacherUid}`, {
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

  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} ${t.copiedSuffix}`);
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
        body: { targetUid: teacherUid, imageBase64: dataUrl },
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
        body: { targetUid: teacherUid },
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

  const genderLabel = (g: string) => (g === "male" ? t.male : g === "female" ? t.female : t.notProvided);
  const subjectLabel = (s: string) => subjectOptionsFor(lang).find((o) => o.value === s)?.label || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  const teacherClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

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
                {isEditing ? t.editMode : t.viewMode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && profile && !isEditing && (
              <button
                onClick={startEditing}
                title={t.edit}
                className="flex items-center gap-1.5 pl-3 pr-4 py-2 bg-primary-container text-on-primary-container font-bold text-[13px] rounded-full transition-colors"
              >
                <Pencil size={14} strokeWidth={2.5} /> {t.edit}
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
            <div className="space-y-6">

              {/* Identity block: photo + name */}
              <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant flex items-center gap-4">
                <div className="relative shrink-0">
                  {profile.photoURL ? (
                    <button type="button" onClick={() => setShowPhotoViewer(true)} title={t.viewFull} className="block active:scale-95 transition-transform">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-m3-lg object-cover border border-outline-variant" />
                    </button>
                  ) : (
                    <div className="w-20 h-20 rounded-m3-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-[22px]">
                      {getInitials(profile.displayName)}
                    </div>
                  )}
                  {/* Manager can set the member's photo */}
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
                  <h3 className="text-[17px] font-black text-on-surface tracking-tight truncate">{profile.displayName}</h3>
                  {profile.username && (
                    <p className="text-[13px] font-bold text-on-surface-variant truncate">@{profile.username}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {profile.subject && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold">
                        <BookOpen size={11} /> {subjectLabel(profile.subject)}
                      </span>
                    )}
                    {profile.accountType === "center-managed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success-container text-on-success-container rounded-full text-[11px] font-bold" title={t.centerAccountTitle}>
                        <Check size={11} /> {t.centerAccount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Login credentials — only for center-created accounts */}
              {password !== null && (
                <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <KeyRound size={14} /> {t.loginInfo}
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
                      { label: t.username, value: profile.username, icon: AtSign, mono: true },
                      { label: t.email, value: profile.email, icon: Mail, mono: true },
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

                    {/* Password row with reveal */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-warning-container rounded-m3-md">
                      <KeyRound size={16} className="text-on-warning-container shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-on-warning-container uppercase tracking-wider">{t.password}</p>
                        <p className="text-[13.5px] font-bold text-on-warning-container font-mono truncate">
                          {showPassword ? password : "••••••••••"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} title={showPassword ? t.hide : t.show}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-warning-container hover:bg-state-hover transition-colors">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button type="button" onClick={() => copyValue(t.password, password)} title={t.copy}
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
                <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5">
                  <h3 className="text-[12px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <Pencil size={13} /> {t.editInfo}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditField label={t.fullName} span={2}>
                      <input type="text" value={draft.displayName} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label={t.subject}>
                      <div className="relative">
                        <select value={draft.subject} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="" disabled>{t.select}</option>
                          {subjectOptionsFor(lang).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                          <option value="male">{t.male}</option>
                          <option value="female">{t.female}</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label={t.experienceYearsLabel}>
                      <input type="number" min={0} max={60} value={draft.experience} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, experience: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
                    </EditField>
                    <EditField label={t.institution}>
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
                  {/* Main Info Block */}
                  <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-container to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>

                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <User size={14}/> {t.mainInfo}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                      <InfoField label={t.fullName} value={profile.displayName} icon={User} span={2} emptyText={t.notProvided} />
                      <InfoField label={t.username} value={profile.username} icon={AtSign} emptyText={t.notProvided} />
                      <InfoField label={t.email} value={profile.email} icon={AtSign} emptyText={t.notProvided} />
                      <InfoField label={t.phone} value={profile.phone} icon={Phone} emptyText={t.notProvided} />
                      <InfoField label={t.birthDate} value={profile.birthDate} icon={Calendar} emptyText={t.notProvided} />
                    </div>
                  </div>

                  {/* Professional Info Block */}
                  <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <GraduationCap size={14}/> {t.professionalInfo}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InfoField label={t.gender} value={genderLabel(profile.gender)} emptyText={t.notProvided} />
                      <InfoField label={t.subject} value={subjectLabel(profile.subject)} icon={BookOpen} emptyText={t.notProvided} />
                      <InfoField label={t.experience} value={profile.experience ? t.experienceYears(profile.experience) : ''} emptyText={t.notProvided} />
                      <InfoField label={t.institution} value={profile.institution} icon={Briefcase} emptyText={t.notProvided} />
                    </div>
                  </div>

                  {/* Groups + schedule — the teacher's center classes */}
                  <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <Layers size={14}/> {t.groups}
                      <span className="ml-1 px-1.5 py-0.5 bg-primary-container text-on-primary-container rounded-md text-[10px] tabular-nums">{teacherClasses.length}</span>
                    </h3>

                    {teacherClasses.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] font-bold text-on-surface-variant">{t.noGroups}</p>
                        <p className="text-[11.5px] text-on-surface-variant mt-1">{t.noGroupsHint}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {teacherClasses.map((c) => {
                          const schedule = [...(c.schedule || [])].sort(
                            (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek),
                          );
                          return (
                            <Link key={c.id} href={`/manager/groups/${c.id}`}
                              className="group block p-4 bg-surface-container-low hover:bg-state-hover border border-outline-variant hover:border-primary rounded-m3-lg transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">{c.title}</p>
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-bold text-on-surface-variant tabular-nums">
                                  <Users size={11} className="text-on-surface-variant" /> {c.studentIds?.length || 0}
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
                                <p className="mt-1.5 text-[11.5px] font-medium text-on-surface-variant">{t.noSchedule}</p>
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

                  {/* Location Block */}
                  <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant space-y-5">
                    <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <MapPin size={14}/> {t.locationBio}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <InfoField label={t.region} value={profile.region} emptyText={t.notProvided} />
                      <InfoField label={t.bio} value={profile.bio || t.noInfo} emptyText={t.notProvided} />
                    </div>
                  </div>
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for the manager-set photo */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) setPhotoFile(e.target.files[0]); }} />

      {/* Cropper for the manager-set photo */}
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
