"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import { LanguageContext } from "@/app/(public)/layout";
import { SIGNUP_TRANSLATIONS } from "../signup/page";
import { Step0Role } from "../signup/_components/FormSteps";
import StudentSignupFlow from "../signup/_components/StudentSignupFlow";
import TeacherSignupFlow from "../signup/_components/TeacherSignupFlow";
import ManagerSignupFlow from "../signup/_components/ManagerSignupFlow";
import { BookOpen, Loader2, LogOut } from "lucide-react";

const PAGE_T = {
  uz: { signedInAs: "Google hisobi ulandi", switchAccount: "Boshqa hisob", loading: "Yuklanmoqda...", checkFailed: "Profil holatini tekshirib bo'lmadi. Internet aloqasini (va reklama blokerini) tekshiring.", retry: "Qayta urinish" },
  en: { signedInAs: "Google account connected", switchAccount: "Use another account", loading: "Loading...", checkFailed: "Couldn't verify your profile status. Check your connection (and ad blocker).", retry: "Retry" },
  ru: { signedInAs: "Аккаунт Google подключён", switchAccount: "Другой аккаунт", loading: "Загрузка...", checkFailed: "Не удалось проверить статус профиля. Проверьте соединение (и блокировщик рекламы).", retry: "Повторить" },
};

/**
 * Onboarding for authenticated users WITHOUT a users/{uid} profile — i.e. a
 * fresh Google sign-in, or a signup whose Firestore batch never committed.
 * They pick a role and finish the same wizard as password signup, minus the
 * email/password step (googleMode). Resumable: abandoning it just lands the
 * user back here on next login (docs/AUTH.md).
 */
export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const context = useContext(LanguageContext) as { lang?: "uz" | "en" | "ru"; setLang?: (l: "uz" | "en" | "ru") => void };
  const lang = context?.lang || "uz";
  const setLang = context?.setLang || (() => {});
  const t = SIGNUP_TRANSLATIONS[lang] || SIGNUP_TRANSLATIONS["uz"];
  const pt = PAGE_T[lang] || PAGE_T.uz;

  const [role, setRole] = useState<"student" | "teacher" | "manager" | null>(null);
  const [checking, setChecking] = useState(true);
  // Fail CLOSED: if we can't confirm the profile is missing, do NOT show the
  // wizard — submitting it over an existing profile would overwrite XP/role.
  const [checkFailed, setCheckFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    let cancelled = false;
    setChecking(true);
    setCheckFailed(false);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;
        if (!snap.exists()) {
          setChecking(false);
          return;
        }
        // Already onboarded — same post-sign-in precedence as login
        const ssoReturnTo = getSsoReturnTo();
        if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
        const profile = snap.data();
        if (profile.role === "teacher") router.replace("/teacher/dashboard");
        else if (profile.role === "manager") router.replace("/manager/dashboard");
        else router.replace("/dashboard");
      } catch (error) {
        console.error("profile check failed:", error);
        if (!cancelled) setCheckFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, loading, router, retryKey]);

  const handleSwitchAccount = async () => {
    await signOut(auth);
    router.replace("/auth/login");
  };

  if (checkFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-5 px-6 text-center font-['Inter',sans-serif]">
        <p className="text-[15px] font-bold text-slate-600 max-w-sm">{pt.checkFailed}</p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="px-8 py-3.5 bg-[#1565C0] hover:bg-[#114E93] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
        >
          {pt.retry}
        </button>
      </div>
    );
  }

  if (loading || checking || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3 font-['Inter',sans-serif]">
        <Loader2 className="animate-spin text-[#1565C0]" size={32} />
        <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">{pt.loading}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-white px-6 sm:px-12 py-12 relative font-['Inter',sans-serif]">
      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-[#1565C0] rounded-lg flex items-center justify-center text-white">
          <BookOpen size={16} />
        </div>
        <span className="font-extrabold text-[18px] text-[#1C1B1F] tracking-tight">
          TestEdify<span className="text-[#1565C0]">.</span>
        </span>
      </div>

      {/* Language toggle */}
      <div className="absolute top-6 right-6 flex items-center bg-[#F1F5F9] p-1 rounded-full border border-[#E2E8F0] z-20">
        {(["uz", "en", "ru"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-3 py-1 text-[11px] font-black tracking-wider rounded-full transition-all uppercase ${
              lang === code ? "bg-[#1565C0] text-white shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="w-full max-w-[480px] mt-16 sm:mt-20">
        {/* Connected Google account card */}
        <div className="flex items-center gap-4 p-4 mb-8 rounded-2xl border-2 border-slate-100 bg-slate-50/60">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border-2 border-white shadow-sm shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1565C0] text-white flex items-center justify-center font-black text-lg shrink-0">
              {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-[#1565C0] uppercase tracking-wider">{pt.signedInAs}</p>
            <p className="text-[15px] font-bold text-slate-900 truncate">{user.displayName || user.email}</p>
            {user.displayName && <p className="text-[13px] font-medium text-slate-500 truncate">{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-slate-500 bg-white border border-slate-200 hover:text-rose-600 hover:border-rose-200 transition-colors shrink-0"
          >
            <LogOut size={14} /> {pt.switchAccount}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!role && (
            <motion.div key="step0" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="mb-10 text-center sm:text-left">
                <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">{t.steps[0].title}</h1>
                <p className="text-[#64748B] mt-1.5 text-[15px] font-medium">{t.steps[0].sub}</p>
              </div>
              <Step0Role setRole={setRole} t={t} />
            </motion.div>
          )}

          {role === "student" && (
            <motion.div key="student" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <StudentSignupFlow onBack={() => setRole(null)} t={t} googleMode />
            </motion.div>
          )}

          {role === "teacher" && (
            <motion.div key="teacher" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <TeacherSignupFlow onBack={() => setRole(null)} t={t} googleMode />
            </motion.div>
          )}

          {role === "manager" && (
            <motion.div key="manager" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <ManagerSignupFlow onBack={() => setRole(null)} t={t} googleMode />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
