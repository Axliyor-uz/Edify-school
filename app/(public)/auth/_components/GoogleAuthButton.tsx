"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { signInWithGoogle } from "@/lib/googleAuth";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";

const T = {
  uz: {
    divider: "yoki",
    button: "Google bilan davom etish",
    welcome: "Xush kelibsiz, {name}!",
    popupBlocked: "Brauzer oynani blokladi. Pop-up'larga ruxsat bering.",
    failed: "Google orqali kirishda xatolik. Qaytadan urinib ko'ring.",
  },
  en: {
    divider: "or",
    button: "Continue with Google",
    welcome: "Welcome back, {name}!",
    popupBlocked: "The browser blocked the popup. Please allow pop-ups.",
    failed: "Google sign-in failed. Please try again.",
  },
  ru: {
    divider: "или",
    button: "Продолжить с Google",
    welcome: "С возвращением, {name}!",
    popupBlocked: "Браузер заблокировал окно. Разрешите всплывающие окна.",
    failed: "Ошибка входа через Google. Попробуйте снова.",
  },
};

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * "Continue with Google" — shared by the login and signup pages.
 *
 * Authentication only: if the account already has a users/{uid} profile it
 * runs the same post-sign-in precedence as password login (SSO returnTo →
 * super_admin claim → role redirect); a brand-new Google user is sent to
 * /auth/complete-profile to pick a role/username there (docs/AUTH.md).
 */
export default function GoogleAuthButton({ lang }: { lang: "uz" | "en" | "ru" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const t = T[lang] || T.uz;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { user, profile } = await signInWithGoogle();
      const ssoReturnTo = getSsoReturnTo();

      if (!profile) {
        // Admin accounts are provisioned out-of-band and may have no users doc.
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.super_admin) {
          router.push("/admin");
          return;
        }
        router.push(
          ssoReturnTo
            ? `/auth/complete-profile?returnTo=${encodeURIComponent(ssoReturnTo)}`
            : "/auth/complete-profile"
        );
        return;
      }

      // Same precedence as password login (docs/AUTH.md)
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      const tokenResult = await user.getIdTokenResult(true);
      if (tokenResult.claims.super_admin) {
        router.push("/admin");
        return;
      }
      toast.dismiss();
      toast.success(t.welcome.replace("{name}", profile.displayName || "User"), { duration: 4000 });
      if (profile.role === "teacher") router.push("/teacher/dashboard");
      else if (profile.role === "manager") router.push("/manager/dashboard");
      else router.push("/dashboard");
    } catch (error) {
      setLoading(false);
      const code = (error as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/popup-blocked") toast.error(t.popupBlocked);
      else toast.error(t.failed);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[#E2E8F0]" />
        <span className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider">{t.divider}</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-[#E2E8F0] bg-white text-[#0F172A] font-bold text-[15px] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <GoogleLogo />}
        {t.button}
      </button>
    </div>
  );
}
