"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  label: string;
  onShift: (delta: number) => void;
}

const T_UZ = {
  prevMonth: "Oldingi oy",
  nextMonth: "Keyingi oy",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: { prevMonth: "Previous month", nextMonth: "Next month" },
  ru: { prevMonth: "Предыдущий месяц", nextMonth: "Следующий месяц" },
};

export default function MonthNav({ label, onShift }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  return (
    <div className="flex items-center gap-0.5 bg-surface-container-lowest border border-outline-variant rounded-full p-1">
      <button
        onClick={() => onShift(-1)}
        aria-label={t.prevMonth}
        className="w-9 h-9 rounded-full hover:bg-state-hover active:scale-95 flex items-center justify-center text-on-surface-variant transition-all"
      >
        <ChevronLeft size={17} />
      </button>
      <p className="text-sm font-bold text-on-surface min-w-[112px] text-center">{label}</p>
      <button
        onClick={() => onShift(1)}
        aria-label={t.nextMonth}
        className="w-9 h-9 rounded-full hover:bg-state-hover active:scale-95 flex items-center justify-center text-on-surface-variant transition-all"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
