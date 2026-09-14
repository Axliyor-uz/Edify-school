"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Step {
  done: boolean;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}

interface Props {
  steps: Step[];
}

const T_UZ = {
  heading: "Moliya bo'limini boshlash — 3 qadam",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: { heading: "Getting started with finance — 3 steps" },
  ru: { heading: "Начало работы с финансами — 3 шага" },
};

/**
 * 3-step onboarding card, shown until the center has prices + charges + a payment.
 * Data-driven: each step checks real state, so it disappears by itself.
 */
export default function StartGuide({ steps }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-5 sm:p-6">
      <p className="text-[15px] font-bold text-on-surface">{t.heading}</p>
      <div className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-center gap-3">
            {s.done ? (
              <CheckCircle2 size={26} className="text-success shrink-0" />
            ) : (
              <div className="w-[26px] h-[26px] rounded-full bg-primary text-on-primary text-[13px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[13.5px] font-bold ${s.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
                {s.title}
              </p>
              {!s.done && <p className="text-[12px] text-on-surface-variant leading-snug">{s.desc}</p>}
            </div>
            {!s.done && (
              <Button size="sm" onClick={s.onAction} className="shrink-0">
                {s.actionLabel}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
