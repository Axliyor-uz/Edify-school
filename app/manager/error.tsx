"use client";

import { useContext, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { ManagerLanguageContext } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Xatolik yuz berdi",
    body: "Sahifani yuklashda kutilmagan muammo chiqdi. Qayta urinib ko'ring — odatda bu darhol hal bo'ladi.",
    code: "Kod:",
    retry: "Qayta urinish",
    home: "Bosh sahifa",
  },
  en: {
    title: "Something went wrong",
    body: "An unexpected problem occurred while loading the page. Try again — this usually resolves right away.",
    code: "Code:",
    retry: "Try again",
    home: "Home",
  },
  ru: {
    title: "Произошла ошибка",
    body: "При загрузке страницы возникла непредвиденная проблема. Попробуйте ещё раз — обычно это сразу решается.",
    code: "Код:",
    retry: "Повторить",
    home: "Главная",
  },
};
type T = typeof TRANSLATIONS.uz;

// Route-level error boundary for every /manager page (App Router convention).
// Renders inside the layout, so the sidebar survives and recovery is one tap.
export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Raw context + 'uz' fallback: if the manager layout itself threw, this boundary renders without ManagerLanguageProvider.
  const lang = useContext(ManagerLanguageContext)?.lang ?? "uz";
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  useEffect(() => {
    console.error("Manager route error:", error);
  }, [error]);

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-8 text-center shadow-elev-1">
        {/* Icon with a soft pulsing halo */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-error-container animate-ping opacity-40" />
          <span className="absolute inset-1.5 rounded-full bg-error-container" />
          <span className="absolute inset-0 flex items-center justify-center text-on-error-container">
            <AlertTriangle size={32} strokeWidth={2.25} />
          </span>
        </div>

        <h2 className="text-[19px] font-black text-on-surface tracking-tight">{t.title}</h2>
        <p className="text-[13.5px] text-on-surface-variant font-medium mt-2 leading-relaxed">
          {t.body}
        </p>

        {error.digest && (
          <p className="mt-3 inline-block px-2.5 py-1 bg-surface-container border border-outline-variant rounded-m3-md text-[10.5px] font-mono text-on-surface-variant">
            {t.code} {error.digest}
          </p>
        )}

        <div className="flex gap-2.5 mt-7">
          <button
            onClick={reset}
            className="flex-1 h-t-control flex items-center justify-center gap-2 bg-primary text-on-primary font-bold text-[13.5px] rounded-m3-md shadow-elev-1 hover:shadow-elev-2 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={15} strokeWidth={2.5} /> {t.retry}
          </button>
          <Link
            href="/manager/dashboard"
            className="flex-1 h-t-control flex items-center justify-center gap-2 bg-secondary-container hover:shadow-elev-1 text-on-secondary-container font-bold text-[13.5px] rounded-m3-md transition-all active:scale-[0.98]"
          >
            <LayoutDashboard size={15} /> {t.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
