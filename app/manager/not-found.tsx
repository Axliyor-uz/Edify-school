"use client";

import { useContext } from "react";
import Link from "next/link";
import { SearchX, LayoutDashboard, Layers } from "lucide-react";
import { ManagerLanguageContext } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Sahifa topilmadi",
    body: "Siz izlagan sahifa mavjud emas yoki o'chirilgan bo'lishi mumkin. Manzilni tekshiring yoki quyidagi bo'limlardan davom eting.",
    home: "Bosh sahifa",
    groups: "Guruhlar",
  },
  en: {
    title: "Page not found",
    body: "The page you are looking for does not exist or may have been deleted. Check the address or continue from the sections below.",
    home: "Home",
    groups: "Groups",
  },
  ru: {
    title: "Страница не найдена",
    body: "Страница, которую вы ищете, не существует или могла быть удалена. Проверьте адрес или продолжите из разделов ниже.",
    home: "Главная",
    groups: "Группы",
  },
};
type T = typeof TRANSLATIONS.uz;

// Branded 404 for the /manager tree. Triggered by notFound() in manager pages
// (bad group/room ids) and by the [...missing] catch-all for unmatched URLs.
// Renders inside the layout, so the sidebar stays and the user is never lost.
// Client Component (pure UI) so it can read the shared language context.
export default function ManagerNotFound() {
  // Raw context + 'uz' fallback: safe even if this ever renders outside ManagerLanguageProvider.
  const lang = useContext(ManagerLanguageContext)?.lang ?? "uz";
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-8 text-center shadow-elev-1">
        {/* Icon with soft halo */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-primary-container animate-ping opacity-40 [animation-duration:2s]" />
          <span className="absolute inset-1.5 rounded-full bg-primary-container" />
          <span className="absolute inset-0 flex items-center justify-center text-on-primary-container">
            <SearchX size={32} strokeWidth={2.25} />
          </span>
        </div>

        <p className="inline-block px-2.5 py-1 bg-surface-container border border-outline-variant rounded-m3-md text-[11px] font-black tracking-widest text-on-surface-variant mb-3">
          404
        </p>
        <h2 className="text-[19px] font-black text-on-surface tracking-tight">{t.title}</h2>
        <p className="text-[13.5px] text-on-surface-variant font-medium mt-2 leading-relaxed">
          {t.body}
        </p>

        <div className="flex gap-2.5 mt-7">
          <Link
            href="/manager/dashboard"
            className="flex-1 h-t-control flex items-center justify-center gap-2 bg-primary text-on-primary font-bold text-[13.5px] rounded-m3-md shadow-elev-1 hover:shadow-elev-2 transition-all active:scale-[0.98]"
          >
            <LayoutDashboard size={15} /> {t.home}
          </Link>
          <Link
            href="/manager/groups"
            className="flex-1 h-t-control flex items-center justify-center gap-2 bg-secondary-container hover:shadow-elev-1 text-on-secondary-container font-bold text-[13.5px] rounded-m3-md transition-all active:scale-[0.98]"
          >
            <Layers size={15} /> {t.groups}
          </Link>
        </div>
      </div>
    </div>
  );
}
