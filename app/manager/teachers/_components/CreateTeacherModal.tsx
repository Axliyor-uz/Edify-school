"use client";

/**
 * Manager creates a brand-new teacher account (docs/MANAGER.md § "Manager-
 * created teacher accounts"). Three required fields — name, subject, password —
 * everything else generated live (email from name + center slug, username from
 * the first name) and editable before submit. On success shows a credentials
 * card the manager hands to the teacher.
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
import {
  X, User, BookOpen, KeyRound, RefreshCw, Loader2, Copy,
  AtSign, Mail, Phone, ChevronDown, UserPlus, PartyPopper,
  CheckCircle, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    copyTitle: "Nusxalash",
    copiedSuffix: "nusxalandi",
    allCopied: "Barcha ma'lumotlar nusxalandi",
    errNameRequired: "To'liq ismni kiriting.",
    errSubjectRequired: "Fanni tanlang.",
    errPasswordLength: "Parol kamida 8 belgidan iborat bo'lishi kerak.",
    errUsernameFormat: "Username kamida 5 belgi, harf bilan boshlanishi kerak (a-z, 0-9, _).",
    errEmailTaken: "Bu email allaqachon band. Boshqasini kiriting.",
    errUsernameTaken: "Bu username allaqachon band. Boshqasini kiriting.",
    createdToast: "O'qituvchi hisobi yaratildi!",
    genericError: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
    copyAllText: (u: string, e: string, p: string) => `Login: ${u}\nEmail: ${e}\nParol: ${p}`,
    successTitle: "Hisob yaratildi!",
    successDesc: "Bu ma'lumotlarni o'qituvchiga bering. Parol keyin ham profil oynasida ko'rinadi.",
    username: "Username",
    email: "Email",
    password: "Parol",
    copy: "Nusxalash",
    done: "Tayyor",
    createTitle: "Yangi hisob yaratish",
    createSubtitle: "Login va parol avtomatik tayyorlanadi.",
    fullName: "To'liq ism",
    fullNamePlaceholder: "Alisher Karimov",
    subject: "Fani",
    subjectSelect: "Fanni tanlang",
    passwordLabel: "Parol",
    passwordPlaceholder: "Kamida 8 belgi",
    regenPassword: "Yangi parol yaratish",
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
    phone: "Telefon",
    optionalNote: "Qolgan ma'lumotlarni keyin o'qituvchi profilida tahrirlash mumkin.",
    cancel: "Bekor qilish",
    creating: "Yaratilmoqda...",
    create: "Yaratish",
  },
  en: {
    copyTitle: "Copy",
    copiedSuffix: "copied",
    allCopied: "All details copied",
    errNameRequired: "Enter the full name.",
    errSubjectRequired: "Select a subject.",
    errPasswordLength: "The password must be at least 8 characters.",
    errUsernameFormat: "The username must be at least 5 characters and start with a letter (a-z, 0-9, _).",
    errEmailTaken: "This email is already taken. Enter a different one.",
    errUsernameTaken: "This username is already taken. Enter a different one.",
    createdToast: "Teacher account created!",
    genericError: "Something went wrong. Please try again.",
    copyAllText: (u: string, e: string, p: string) => `Login: ${u}\nEmail: ${e}\nPassword: ${p}`,
    successTitle: "Account created!",
    successDesc: "Hand these details to the teacher. The password stays visible later in the profile window.",
    username: "Username",
    email: "Email",
    password: "Password",
    copy: "Copy",
    done: "Done",
    createTitle: "Create new account",
    createSubtitle: "The login and password are generated automatically.",
    fullName: "Full name",
    fullNamePlaceholder: "Alisher Karimov",
    subject: "Subject",
    subjectSelect: "Select a subject",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 8 characters",
    regenPassword: "Generate a new password",
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
    phone: "Phone",
    optionalNote: "The remaining details can be edited later in the teacher's profile.",
    cancel: "Cancel",
    creating: "Creating...",
    create: "Create",
  },
  ru: {
    copyTitle: "Копировать",
    copiedSuffix: "скопировано",
    allCopied: "Все данные скопированы",
    errNameRequired: "Введите полное имя.",
    errSubjectRequired: "Выберите предмет.",
    errPasswordLength: "Пароль должен содержать не менее 8 символов.",
    errUsernameFormat: "Имя пользователя должно содержать не менее 5 символов и начинаться с буквы (a-z, 0-9, _).",
    errEmailTaken: "Этот email уже занят. Введите другой.",
    errUsernameTaken: "Это имя пользователя уже занято. Введите другое.",
    createdToast: "Аккаунт учителя создан!",
    genericError: "Произошла ошибка. Попробуйте ещё раз.",
    copyAllText: (u: string, e: string, p: string) => `Логин: ${u}\nEmail: ${e}\nПароль: ${p}`,
    successTitle: "Аккаунт создан!",
    successDesc: "Передайте эти данные учителю. Пароль позже также виден в окне профиля.",
    username: "Имя пользователя",
    email: "Email",
    password: "Пароль",
    copy: "Копировать",
    done: "Готово",
    createTitle: "Создать новый аккаунт",
    createSubtitle: "Логин и пароль создаются автоматически.",
    fullName: "Полное имя",
    fullNamePlaceholder: "Alisher Karimov",
    subject: "Предмет",
    subjectSelect: "Выберите предмет",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Не менее 8 символов",
    regenPassword: "Создать новый пароль",
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
    phone: "Телефон",
    optionalNote: "Остальные данные можно отредактировать позже в профиле учителя.",
    cancel: "Отмена",
    creating: "Создание...",
    create: "Создать",
  },
};
type T = typeof TRANSLATIONS.uz;

// Subject select options — stored values stay language-independent; labels localized.
const SUBJECT_LABELS: Record<LangType, Record<string, string>> = {
  uz: {
    matematika: "Matematika", fizika: "Fizika", kimyo: "Kimyo", biologiya: "Biologiya",
    ona_tili: "Ona tili va Adabiyot", tarix: "Tarix", ingliz_tili: "Ingliz tili",
    rus_tili: "Rus tili", informatika: "Informatika", other: "Boshqa fan",
  },
  en: {
    matematika: "Mathematics", fizika: "Physics", kimyo: "Chemistry", biologiya: "Biology",
    ona_tili: "Native Language & Literature", tarix: "History", ingliz_tili: "English",
    rus_tili: "Russian", informatika: "Computer Science", other: "Other subject",
  },
  ru: {
    matematika: "Математика", fizika: "Физика", kimyo: "Химия", biologiya: "Биология",
    ona_tili: "Родной язык и литература", tarix: "История", ingliz_tili: "Английский язык",
    rus_tili: "Русский язык", informatika: "Информатика", other: "Другой предмет",
  },
};
const SUBJECT_VALUES = ["matematika", "fizika", "kimyo", "biologiya", "ona_tili", "tarix", "ingliz_tili", "rus_tili", "informatika", "other"];
export function subjectOptionsFor(lang: LangType) {
  const labels = SUBJECT_LABELS[lang] || SUBJECT_LABELS.uz;
  return SUBJECT_VALUES.map((value) => ({ value, label: labels[value] }));
}

/** Real-time availability state, signup-page style. */
type CheckStatus = "idle" | "checking" | "free" | "taken";

/** Signup-style border tint for an availability-checked input. */
function statusBorder(status: CheckStatus, base: string): string {
  if (status === "free") return `${base} border-success focus:border-success`;
  if (status === "taken") return `${base} border-warning focus:border-warning`;
  return `${base} border-outline-variant focus:border-primary`;
}

/** Signup-style status icon rendered inside the input's right edge. */
function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "checking") return <Loader2 className="animate-spin text-on-surface-variant" size={17} />;
  if (status === "free") return <CheckCircle className="text-success" size={17} />;
  if (status === "taken") return <XCircle className="text-warning" size={17} />;
  return null;
}

interface Props {
  onClose: () => void;
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

export default function CreateTeacherModal({ onClose }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const subjectOptions = subjectOptionsFor(lang);
  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // email/username: auto-suggested until the manager edits them by hand.
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
  // Signup-style in-memory caches — a value once checked isn't re-fetched.
  const usernameCache = useRef(new Map<string, boolean>());
  const emailCache = useRef(new Map<string, boolean>());

  // Live suggestions while the manager types the name.
  useEffect(() => {
    if (!emailTouched) setEmail(suggestTeacherEmail(fullName));
    if (!usernameTouched) setUsername(suggestTeacherUsername(fullName));
    if (!passwordAutoFilled.current && fullName.trim().length >= 3) {
      passwordAutoFilled.current = true;
      setPassword(generateFriendlyPassword(fullName));
    }
  }, [fullName, emailTouched, usernameTouched]);

  // Real-time username availability — same pattern as the signup wizards
  // (checkUsernameUnique + 800ms debounce + cache, fails open). The server
  // suffixes auto-generated names itself; this is UX, not the guard.
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

  // Real-time email availability via /api/directory/lookup (manager-allowed;
  // 404 = free). Auto-generated emails auto-fall-back server-side; explicit
  // ones would 409 — either way the manager sees it before submitting.
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
        // 404 → free; a transient error also lands here — fail open like
        // signup but do NOT cache it, so a retype re-checks for real.
        setEmailStatus("free");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 3) return setError(t.errNameRequired);
    if (!subject) return setError(t.errSubjectRequired);
    if (password.length < 8) return setError(t.errPasswordLength);
    if (usernameTouched && !USERNAME_REGEX.test(username)) {
      return setError(t.errUsernameFormat);
    }
    // Auto-generated values fall back server-side; explicit taken ones would 409.
    if (emailTouched && emailStatus === "taken") {
      return setError(t.errEmailTaken);
    }
    if (usernameTouched && usernameStatus === "taken") {
      return setError(t.errUsernameTaken);
    }

    setSubmitting(true);
    try {
      const result = await managerApiFetch<Created & { uid: string }>("/api/manager/teachers/create", {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          subject,
          password,
          // Only send overrides — omitted values let the server auto-suffix on collision.
          ...(emailTouched && email ? { email } : {}),
          ...(usernameTouched && username ? { username } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });
      setCreated({ email: result.email, username: result.username, password: result.password });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !submitting && onClose()}></div>
      <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 sm:p-8 shadow-elev-3 max-h-[92vh] overflow-y-auto custom-scrollbar">

        {created ? (
          /* ── Success: hand these to the teacher ── */
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
                <label htmlFor="ct-name" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.fullName}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <User size={18} />
                  </div>
                  <input id="ct-name" type="text" required autoFocus value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting} placeholder={t.fullNamePlaceholder}
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label htmlFor="ct-subject" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.subject}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <BookOpen size={18} />
                  </div>
                  <select id="ct-subject" required value={subject}
                    onChange={(e) => setSubject(e.target.value)} disabled={submitting}
                    className="w-full pl-11 pr-10 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-60">
                    <option value="" disabled>{t.subjectSelect}</option>
                    {subjectOptions.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Password: visible, regenerable */}
              <div className="space-y-1.5">
                <label htmlFor="ct-password" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.passwordLabel}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <KeyRound size={18} />
                  </div>
                  <input id="ct-password" type="text" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting} placeholder={t.passwordPlaceholder} minLength={8}
                    className="w-full pl-11 pr-12 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-bold font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                  <button type="button" title={t.regenPassword} disabled={submitting}
                    onClick={() => setPassword(generateFriendlyPassword(fullName || "edify teacher"))}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-primary transition-colors">
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>

              {/* Auto-generated login preview — tap a field to override */}
              <div className="bg-primary-container rounded-m3-lg p-4 space-y-3">
                <p className="text-[11px] font-black text-on-primary-container uppercase tracking-widest">{t.autoLogin}</p>

                <div className="space-y-1">
                  <label htmlFor="ct-username" className="text-[11px] font-bold text-on-primary-container ml-1">{t.usernameLabel}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
                      <AtSign size={15} />
                    </div>
                    <input id="ct-username" type="text" value={username} disabled={submitting}
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
                  <label htmlFor="ct-email" className="text-[11px] font-bold text-on-primary-container ml-1">{t.emailLoginLabel}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-primary">
                      <Mail size={15} />
                    </div>
                    <input id="ct-email" type="email" value={email} disabled={submitting}
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
                <div className="space-y-1.5">
                  <label htmlFor="ct-phone" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.phone}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                      <Phone size={18} />
                    </div>
                    <input id="ct-phone" type="tel" value={phone}
                      onChange={(e) => setPhone(e.target.value)} disabled={submitting}
                      placeholder="+998 90 123 45 67"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
                  </div>
                  <p className="text-[12px] text-on-surface-variant ml-1 pt-1">
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
                  disabled={submitting || !fullName.trim() || !subject || password.length < 8 ||
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
