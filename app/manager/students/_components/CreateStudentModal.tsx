"use client";

/**
 * Manager creates a brand-new STUDENT account — the student twin of
 * CreateTeacherModal (docs/MANAGER.md). Name + password required; email,
 * username, password auto-generated with signup-style live availability
 * checks; optional immediate enrollment into one of the center's groups.
 */

import { useState, useEffect, useRef } from "react";
import { managerApiFetch } from "@/lib/managerApi";
import { lookupByEmail } from "@/lib/directory";
import { checkUsernameUnique } from "@/services/userService";
import {
  suggestTeacherEmail,
  suggestTeacherUsername,
  generateFriendlyPassword,
  USERNAME_REGEX,
} from "@/lib/teacherProvision";
import type { ClassData } from "@/hooks/useCenterClasses";
import { gradeOptionsFor } from "./ManagerStudentInfoPanel";
import {
  X, User, KeyRound, RefreshCw, Loader2, Copy, AtSign, Mail, Phone,
  ChevronDown, UserPlus, PartyPopper, CheckCircle, XCircle, Layers,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    copyTitle: "Nusxalash",
    copiedSuffix: "nusxalandi",
    allCopied: "Barcha ma'lumotlar nusxalandi",
    errNameRequired: "To'liq ismni kiriting.",
    errPasswordLength: "Parol kamida 8 belgidan iborat bo'lishi kerak.",
    errUsernameFormat: "Username kamida 5 belgi, harf bilan boshlanishi kerak (a-z, 0-9, _).",
    errEmailTaken: "Bu email allaqachon band. Boshqasini kiriting.",
    errUsernameTaken: "Bu username allaqachon band. Boshqasini kiriting.",
    createdToast: "O'quvchi hisobi yaratildi!",
    genericError: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
    copyAllText: (u: string, e: string, p: string) => `Login: ${u}\nEmail: ${e}\nParol: ${p}`,
    successTitle: "Hisob yaratildi!",
    successDesc: "Bu ma'lumotlarni o'quvchiga bering. Parol keyin ham profil oynasida ko'rinadi.",
    username: "Username",
    email: "Email",
    password: "Parol",
    copy: "Nusxalash",
    done: "Tayyor",
    createTitle: "Yangi o'quvchi yaratish",
    createSubtitle: "Login va parol avtomatik tayyorlanadi.",
    fullName: "To'liq ism",
    fullNamePlaceholder: "Aziz Aliyev",
    passwordLabel: "Parol",
    passwordPlaceholder: "Kamida 8 belgi",
    regenPassword: "Yangi parol yaratish",
    enrollLabel: "Guruhga qo'shish (ixtiyoriy)",
    noGroup: "Guruhsiz (keyin qo'shiladi)",
    autoLogin: "Avtomatik login",
    usernameLabel: "Username",
    autoPlaceholder: "avtomatik",
    usernameTaken: "Bu username band",
    usernameTakenEdit: " — boshqasini kiriting.",
    usernameTakenAuto: " — raqam qo'shilib yaratiladi.",
    emailLoginLabel: "Email (tizimga kirish uchun)",
    emailTaken: "Bu email band",
    emailTakenEdit: " — boshqasini kiriting.",
    emailTakenAuto: " — boshqa variant avtomatik tanlanadi.",
    optionalToggle: "Qo'shimcha ma'lumotlar (ixtiyoriy)",
    grade: "Sinf",
    notSelected: "Tanlanmagan",
    phone: "Telefon",
    optionalNote: "Qolgan ma'lumotlarni keyin o'quvchi profilida tahrirlash mumkin.",
    cancel: "Bekor qilish",
    creating: "Yaratilmoqda...",
    create: "Yaratish",
  },
  en: {
    copyTitle: "Copy",
    copiedSuffix: "copied",
    allCopied: "All details copied",
    errNameRequired: "Enter the full name.",
    errPasswordLength: "The password must be at least 8 characters.",
    errUsernameFormat: "The username must be at least 5 characters and start with a letter (a-z, 0-9, _).",
    errEmailTaken: "This email is already taken. Enter a different one.",
    errUsernameTaken: "This username is already taken. Enter a different one.",
    createdToast: "Student account created!",
    genericError: "Something went wrong. Please try again.",
    copyAllText: (u: string, e: string, p: string) => `Login: ${u}\nEmail: ${e}\nPassword: ${p}`,
    successTitle: "Account created!",
    successDesc: "Hand these details to the student. The password stays visible later in the profile window.",
    username: "Username",
    email: "Email",
    password: "Password",
    copy: "Copy",
    done: "Done",
    createTitle: "Create new student",
    createSubtitle: "The login and password are generated automatically.",
    fullName: "Full name",
    fullNamePlaceholder: "Aziz Aliyev",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 8 characters",
    regenPassword: "Generate a new password",
    enrollLabel: "Add to a group (optional)",
    noGroup: "No group (add later)",
    autoLogin: "Automatic login",
    usernameLabel: "Username",
    autoPlaceholder: "automatic",
    usernameTaken: "This username is taken",
    usernameTakenEdit: " — enter a different one.",
    usernameTakenAuto: " — a number will be appended.",
    emailLoginLabel: "Email (for signing in)",
    emailTaken: "This email is taken",
    emailTakenEdit: " — enter a different one.",
    emailTakenAuto: " — another option will be chosen automatically.",
    optionalToggle: "Additional details (optional)",
    grade: "Grade",
    notSelected: "Not selected",
    phone: "Phone",
    optionalNote: "The remaining details can be edited later in the student's profile.",
    cancel: "Cancel",
    creating: "Creating...",
    create: "Create",
  },
  ru: {
    copyTitle: "Копировать",
    copiedSuffix: "скопировано",
    allCopied: "Все данные скопированы",
    errNameRequired: "Введите полное имя.",
    errPasswordLength: "Пароль должен содержать не менее 8 символов.",
    errUsernameFormat: "Имя пользователя должно содержать не менее 5 символов и начинаться с буквы (a-z, 0-9, _).",
    errEmailTaken: "Этот email уже занят. Введите другой.",
    errUsernameTaken: "Это имя пользователя уже занято. Введите другое.",
    createdToast: "Аккаунт ученика создан!",
    genericError: "Произошла ошибка. Попробуйте ещё раз.",
    copyAllText: (u: string, e: string, p: string) => `Логин: ${u}\nEmail: ${e}\nПароль: ${p}`,
    successTitle: "Аккаунт создан!",
    successDesc: "Передайте эти данные ученику. Пароль позже также виден в окне профиля.",
    username: "Имя пользователя",
    email: "Email",
    password: "Пароль",
    copy: "Копировать",
    done: "Готово",
    createTitle: "Создать нового ученика",
    createSubtitle: "Логин и пароль создаются автоматически.",
    fullName: "Полное имя",
    fullNamePlaceholder: "Aziz Aliyev",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Не менее 8 символов",
    regenPassword: "Создать новый пароль",
    enrollLabel: "Добавить в группу (необязательно)",
    noGroup: "Без группы (добавить позже)",
    autoLogin: "Автоматический логин",
    usernameLabel: "Имя пользователя",
    autoPlaceholder: "автоматически",
    usernameTaken: "Это имя пользователя занято",
    usernameTakenEdit: " — введите другое.",
    usernameTakenAuto: " — будет добавлена цифра.",
    emailLoginLabel: "Email (для входа в систему)",
    emailTaken: "Этот email занят",
    emailTakenEdit: " — введите другой.",
    emailTakenAuto: " — другой вариант будет выбран автоматически.",
    optionalToggle: "Дополнительные данные (необязательно)",
    grade: "Класс",
    notSelected: "Не выбрано",
    phone: "Телефон",
    optionalNote: "Остальные данные можно отредактировать позже в профиле ученика.",
    cancel: "Отмена",
    creating: "Создание...",
    create: "Создать",
  },
};
type T = typeof TRANSLATIONS.uz;

type CheckStatus = "idle" | "checking" | "free" | "taken";

function statusBorder(status: CheckStatus, base: string): string {
  if (status === "free") return `${base} border-success focus:border-success`;
  if (status === "taken") return `${base} border-warning focus:border-warning`;
  return `${base} border-outline-variant focus:border-primary`;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "checking") return <Loader2 className="animate-spin text-on-surface-variant" size={17} />;
  if (status === "free") return <CheckCircle className="text-success" size={17} />;
  if (status === "taken") return <XCircle className="text-warning" size={17} />;
  return null;
}

interface Props {
  /** Center groups for the optional immediate-enroll select. */
  classes: ClassData[];
  onClose: () => void;
  /** Fired after a successful create so the page can refresh the roster. */
  onCreated?: () => void;
}

interface Created {
  email: string;
  username: string;
  password: string;
}

function CredentialRow({ label, value, icon: Icon, copyTitle, copiedSuffix }: { label: string; value: string; icon: any; copyTitle: string; copiedSuffix: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} ${copiedSuffix}`);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md">
      <Icon size={16} className="text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</p>
        <p className="text-[14px] font-bold text-on-surface font-mono truncate">{value}</p>
      </div>
      <button type="button" onClick={copy} title={copyTitle}
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-state-hover transition-colors">
        <Copy size={16} />
      </button>
    </div>
  );
}

export default function CreateStudentModal({ classes, onClose, onCreated }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [classId, setClassId] = useState("");
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailStatus, setEmailStatus] = useState<CheckStatus>("idle");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<CheckStatus>("idle");

  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const passwordAutoFilled = useRef(false);
  const usernameCache = useRef(new Map<string, boolean>());
  const emailCache = useRef(new Map<string, boolean>());

  const sortedClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  // Live suggestions while the manager types the name.
  useEffect(() => {
    if (!emailTouched) setEmail(suggestTeacherEmail(fullName));
    if (!usernameTouched) setUsername(suggestTeacherUsername(fullName));
    if (!passwordAutoFilled.current && fullName.trim().length >= 3) {
      passwordAutoFilled.current = true;
      setPassword(generateFriendlyPassword(fullName));
    }
  }, [fullName, emailTouched, usernameTouched]);

  // Real-time availability — same signup-style pattern as CreateTeacherModal.
  useEffect(() => {
    if (!username || !USERNAME_REGEX.test(username)) {
      setUsernameStatus("idle");
      return;
    }
    const cached = usernameCache.current.get(username);
    if (cached !== undefined) {
      setUsernameStatus(cached ? "free" : "taken");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const isUnique = await checkUsernameUnique(username);
        usernameCache.current.set(username, isUnique);
        setUsernameStatus(isUnique ? "free" : "taken");
      } catch {
        setUsernameStatus("free"); // fail open, like signup
      }
    }, 800);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    if (!email || !email.includes("@")) {
      setEmailStatus("idle");
      return;
    }
    const cached = emailCache.current.get(email);
    if (cached !== undefined) {
      setEmailStatus(cached ? "free" : "taken");
      return;
    }
    setEmailStatus("checking");
    const t = setTimeout(async () => {
      try {
        await lookupByEmail(email);
        emailCache.current.set(email, false);
        setEmailStatus("taken");
      } catch {
        setEmailStatus("free"); // 404 → free; transient errors fail open, uncached
      }
    }, 800);
    return () => clearTimeout(t);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 3) return setError(t.errNameRequired);
    if (password.length < 8) return setError(t.errPasswordLength);
    if (usernameTouched && !USERNAME_REGEX.test(username)) {
      return setError(t.errUsernameFormat);
    }
    if (emailTouched && emailStatus === "taken") {
      return setError(t.errEmailTaken);
    }
    if (usernameTouched && usernameStatus === "taken") {
      return setError(t.errUsernameTaken);
    }

    setSubmitting(true);
    try {
      const result = await managerApiFetch<Created & { uid: string }>("/api/manager/students/create", {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          password,
          ...(emailTouched && email ? { email } : {}),
          ...(usernameTouched && username ? { username } : {}),
          ...(classId ? { classId } : {}),
          ...(grade ? { grade } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });
      setCreated({ email: result.email, username: result.username, password: result.password });
      onCreated?.();
      toast.success(t.createdToast);
    } catch (err: any) {
      setError(err.message || t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(
      t.copyAllText(created.username, created.email, created.password),
    );
    toast.success(t.allCopied);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !submitting && onClose()}></div>
      <div className="relative bg-surface-container-lowest w-full sm:max-w-md rounded-t-m3-xl sm:rounded-m3-xl p-6 sm:p-8 shadow-elev-3 max-h-[94dvh] sm:max-h-[92vh] overflow-y-auto custom-scrollbar">

        {created ? (
          /* ── Success: hand these to the student ── */
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-success-container rounded-full flex items-center justify-center text-on-success-container mx-auto mb-4">
                <PartyPopper size={28} strokeWidth={2} />
              </div>
              <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.successTitle}</h2>
              <p className="text-[13px] text-on-surface-variant mt-1">
                {t.successDesc}
              </p>
            </div>

            <div className="space-y-2.5">
              <CredentialRow label={t.username} value={created.username} icon={AtSign} copyTitle={t.copyTitle} copiedSuffix={t.copiedSuffix} />
              <CredentialRow label={t.email} value={created.email} icon={Mail} copyTitle={t.copyTitle} copiedSuffix={t.copiedSuffix} />
              <CredentialRow label={t.password} value={created.password} icon={KeyRound} copyTitle={t.copyTitle} copiedSuffix={t.copiedSuffix} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={copyAll}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors">
                <Copy size={16} /> {t.copy}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-3.5 bg-primary text-on-primary font-bold rounded-full transition-colors shadow-elev-1">
                {t.done}
              </button>
            </div>
          </div>
        ) : (
          /* ── Create form ── */
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
                <UserPlus size={24} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.createTitle}</h2>
                <p className="text-[13px] text-on-surface-variant">{t.createSubtitle}</p>
              </div>
              <button type="button" onClick={() => !submitting && onClose()}
                className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors shrink-0">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div className="space-y-1.5">
                <label htmlFor="cs-name" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.fullName}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <User size={18} />
                  </div>
                  <input id="cs-name" type="text" required autoFocus value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting} placeholder={t.fullNamePlaceholder}
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                </div>
              </div>

              {/* Password: visible, regenerable */}
              <div className="space-y-1.5">
                <label htmlFor="cs-password" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.passwordLabel}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <KeyRound size={18} />
                  </div>
                  <input id="cs-password" type="text" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting} placeholder={t.passwordPlaceholder} minLength={8}
                    className="w-full pl-11 pr-12 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-bold font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                  <button type="button" title={t.regenPassword} disabled={submitting}
                    onClick={() => setPassword(generateFriendlyPassword(fullName || "edify student"))}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-primary transition-colors">
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>

              {/* Optional immediate enroll */}
              <div className="space-y-1.5">
                <label htmlFor="cs-class" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.enrollLabel}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <Layers size={18} />
                  </div>
                  <select id="cs-class" value={classId}
                    onChange={(e) => setClassId(e.target.value)} disabled={submitting}
                    className="w-full pl-11 pr-10 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-60">
                    <option value="">{t.noGroup}</option>
                    {sortedClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Auto-generated login preview — signup-style live checks */}
              <div className="bg-primary-container rounded-m3-lg p-4 space-y-3">
                <p className="text-[11px] font-black text-on-primary-container uppercase tracking-widest">{t.autoLogin}</p>

                <div className="space-y-1">
                  <label htmlFor="cs-username" className="text-[11px] font-bold text-on-primary-container ml-1">{t.usernameLabel}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
                      <AtSign size={15} />
                    </div>
                    <input id="cs-username" type="text" value={username} disabled={submitting}
                      onChange={(e) => { setUsernameTouched(true); setUsername(e.target.value.toLowerCase().trim()); }}
                      placeholder={t.autoPlaceholder}
                      className={statusBorder(usernameStatus, "w-full pl-10 pr-10 py-2.5 bg-surface-container-lowest border rounded-m3-md text-[13px] font-bold font-mono text-on-surface outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60")} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <StatusIcon status={usernameStatus} />
                    </div>
                  </div>
                  {usernameStatus === "taken" && (
                    <p className="text-[11px] text-warning font-bold ml-1">
                      {t.usernameTaken}{usernameTouched ? t.usernameTakenEdit : t.usernameTakenAuto}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="cs-email" className="text-[11px] font-bold text-on-primary-container ml-1">{t.emailLoginLabel}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
                      <Mail size={15} />
                    </div>
                    <input id="cs-email" type="email" value={email} disabled={submitting}
                      onChange={(e) => { setEmailTouched(true); setEmail(e.target.value.toLowerCase().trim()); }}
                      placeholder={t.autoPlaceholder}
                      className={statusBorder(emailStatus, "w-full pl-10 pr-10 py-2.5 bg-surface-container-lowest border rounded-m3-md text-[13px] font-bold font-mono text-on-surface outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60")} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <StatusIcon status={emailStatus} />
                    </div>
                  </div>
                  {emailStatus === "taken" && (
                    <p className="text-[11px] text-warning font-bold ml-1">
                      {t.emailTaken}{emailTouched ? t.emailTakenEdit : t.emailTakenAuto}
                    </p>
                  )}
                </div>
              </div>

              {/* Optional extras */}
              <button type="button" onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-1.5 text-[13px] font-bold text-on-surface-variant hover:text-primary transition-colors ml-1">
                <ChevronDown size={15} className={`transition-transform ${showOptional ? "rotate-180" : ""}`} />
                {t.optionalToggle}
              </button>
              {showOptional && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="cs-grade" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.grade}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                        <GraduationCap size={18} />
                      </div>
                      <select id="cs-grade" value={grade}
                        onChange={(e) => setGrade(e.target.value)} disabled={submitting}
                        className="w-full pl-11 pr-10 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-60">
                        <option value="">{t.notSelected}</option>
                        {gradeOptionsFor(lang).map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="cs-phone" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.phone}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                        <Phone size={18} />
                      </div>
                      <input id="cs-phone" type="tel" value={phone}
                        onChange={(e) => setPhone(e.target.value)} disabled={submitting}
                        placeholder="+998 90 123 45 67"
                        className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                    </div>
                  </div>
                  <p className="text-[12px] text-on-surface-variant ml-1">
                    {t.optionalNote}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-[13px] font-bold text-error px-1">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-60">
                  {t.cancel}
                </button>
                <button type="submit"
                  disabled={submitting || !fullName.trim() || password.length < 8 ||
                    (usernameTouched && usernameStatus === "taken") || (emailTouched && emailStatus === "taken")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1">
                  {submitting ? (
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
          </>
        )}
      </div>
    </div>
  );
}
