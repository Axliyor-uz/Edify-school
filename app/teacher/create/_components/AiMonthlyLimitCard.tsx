"use client";

import { useState } from "react";
import { X, Zap, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import { Button, IconButton, ProgressBar, cn } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";

const TRANSLATIONS: Record<string, any> = {
  uz: {
    close: "Yopish",
    monthlyAiLimit: "Oylik AI Limit ",
    monthlyAiBalance: "Oylik AI Balans",
    renews: (date: string) => `Yangilanish: ${date}`,
    remainingLimit: "Qolgan limit",
    used: (n: number) => `Ishlatildi: ${n}`,
    total: (n: number) => `Jami: ${n}`,
    increaseLimit: "Limitni oshirish",
    upgradePlan: "Tarifni oshirish (Kredit olish)",
  },
  en: {
    close: "Close",
    monthlyAiLimit: "Monthly AI Limit ",
    monthlyAiBalance: "Monthly AI Balance",
    renews: (date: string) => `Renews: ${date}`,
    remainingLimit: "Remaining limit",
    used: (n: number) => `Used: ${n}`,
    total: (n: number) => `Total: ${n}`,
    increaseLimit: "Increase limit",
    upgradePlan: "Upgrade plan (get credits)",
  },
  ru: {
    close: "Закрыть",
    monthlyAiLimit: "Месячный лимит ИИ ",
    monthlyAiBalance: "Месячный баланс ИИ",
    renews: (date: string) => `Обновление: ${date}`,
    remainingLimit: "Остаток лимита",
    used: (n: number) => `Использовано: ${n}`,
    total: (n: number) => `Всего: ${n}`,
    increaseLimit: "Увеличить лимит",
    upgradePlan: "Повысить тариф (получить кредиты)",
  },
};

interface AiMonthlyLimitCardProps {
  aiData: {
    limit: number;
    used: number;
    remaining: number;
    usagePercentage: number;
    isUnlimited: boolean;
    isDanger: boolean;
    resetDate: string;
    loading: boolean;
  };
}

export default function AiMonthlyLimitCard({ aiData }: AiMonthlyLimitCardProps) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  if (!aiData || aiData.loading) return null;

  const isEmpty = !aiData.isUnlimited && aiData.remaining <= 0;
  const alert = isEmpty || aiData.isDanger;

  return (
    <div className="relative">

      {/* 1. THE TOP-BAR BUTTON */}
      <button
        onClick={() => setIsModalOpen(!isModalOpen)}
        className={cn(
          "m3-interactive flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 rounded-m3-md shadow-elev-1 transition-all active:scale-95 cursor-pointer",
          alert ? "bg-error-container text-on-error-container" : "bg-surface-container-lowest border border-outline-variant",
        )}
      >
        <Zap size={14} className={alert ? "text-error" : "text-warning"} />

        <span className={cn("text-[11px] md:text-[13px] font-bold whitespace-nowrap", alert ? "text-on-error-container" : "text-on-surface")}>
          <span className="hidden sm:inline">{t.monthlyAiLimit}</span>
          <span className={cn("tabular-nums", alert ? "opacity-80" : "text-on-surface-variant")}>
            ({aiData.isUnlimited ? '∞' : `${aiData.used}/${aiData.limit}`})
          </span>
        </span>
      </button>

      {/* 2. THE DROPDOWN POPOVER */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setIsModalOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-3 bg-surface-container rounded-m3-xl p-6 w-[340px] shadow-elev-3 border border-outline-variant z-[101] flex flex-col origin-top-right"
            >
              <IconButton aria-label={t.close} size="sm" className="absolute top-4 right-4" onClick={() => setIsModalOpen(false)}>
                <X />
              </IconButton>

              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-12 h-12 rounded-m3-md flex items-center justify-center", isEmpty ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container")}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold text-on-surface leading-tight">{t.monthlyAiBalance}</h3>
                  <p className="text-[11px] font-bold text-on-surface-variant mt-0.5">{t.renews(aiData.resetDate)}</p>
                </div>
              </div>

              <div className="w-full bg-surface-container-high rounded-m3-lg p-4 mb-5 relative overflow-hidden">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{t.remainingLimit}</span>
                  <span className={cn("text-2xl font-extrabold leading-none tabular-nums", isEmpty ? "text-error" : "text-primary")}>
                    {aiData.isUnlimited ? '∞' : aiData.remaining}
                  </span>
                </div>

                {!aiData.isUnlimited && (
                  <>
                    <ProgressBar value={aiData.usagePercentage} tone={alert ? 'error' : 'primary'} className="mt-3 mb-1.5 h-2" />
                    <div className="flex justify-between text-[10px] font-bold text-on-surface-variant tabular-nums">
                      <span>{t.used(aiData.used)}</span>
                      <span>{t.total(aiData.limit)}</span>
                    </div>
                  </>
                )}
              </div>

              <Button
                icon={<Crown />}
                className="w-full"
                onClick={() => {
                  setIsModalOpen(false);
                  router.push('/teacher/subscription');
                }}
              >
                {isEmpty ? t.increaseLimit : t.upgradePlan}
              </Button>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
