"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, Minus, Plus, Wand2, Layers, BookMarked, Settings2, Zap, GraduationCap, BookOpen } from "lucide-react";

import { Button, Spinner, cn } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";

const formatSubjectName = (rawSubject: string) => {
  if (!rawSubject) return "";
  const cleanedStr = rawSubject.replace(/-/g, " ");
  return cleanedStr.charAt(0).toUpperCase() + cleanedStr.slice(1).toLowerCase();
};

// --- TRANSLATION DICTIONARY ---
const PANEL_TRANSLATIONS: Record<string, any> = {
  uz: {
    difficulties: { easy: "Oson", medium: "O'rtacha", hard: "Qiyin", mixed: "Aralash" },
    limitLeft: (n: number) => `Sizda oylik limitdan faqatgina ${n} ta savol qoldi. Iltimos so'ralayotgan miqdorni kamaytiring yoki tarifni oshiring.`,
    step1: "Sinfni tanlang", step1Placeholder: "Sinfni tanlang...",
    step2: "Fanni tanlang", step2Placeholder: "Fanni tanlang...",
    step3: "O'quv mavzusi", step3Placeholder: "Mavzuni tanlang...",
    step4: "Sozlamalar", questionCount: "Savollar soni",
    lowLimitWarning: (n: number) => <>Sizda oylik limitdan faqatgina <span className="font-extrabold">{n} ta</span> savol qoldi.</>,
    generating: "Yaratilmoqda...", generateBtn: "Savol Yaratish"
  },
  en: {
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Mixed" },
    limitLeft: (n: number) => `You only have ${n} questions left in your monthly limit. Please reduce the requested amount or upgrade your plan.`,
    step1: "Select a grade", step1Placeholder: "Select a grade...",
    step2: "Select a subject", step2Placeholder: "Select a subject...",
    step3: "Study topic", step3Placeholder: "Select a topic...",
    step4: "Settings", questionCount: "Number of questions",
    lowLimitWarning: (n: number) => <>You only have <span className="font-extrabold">{n}</span> questions left in your monthly limit.</>,
    generating: "Generating...", generateBtn: "Generate Questions"
  },
  ru: {
    difficulties: { easy: "Лёгкий", medium: "Средний", hard: "Сложный", mixed: "Смешанный" },
    limitLeft: (n: number) => `В вашем месячном лимите осталось всего ${n} вопросов. Пожалуйста, уменьшите запрашиваемое количество или повысьте тариф.`,
    step1: "Выберите класс", step1Placeholder: "Выберите класс...",
    step2: "Выберите предмет", step2Placeholder: "Выберите предмет...",
    step3: "Учебная тема", step3Placeholder: "Выберите тему...",
    step4: "Настройки", questionCount: "Количество вопросов",
    lowLimitWarning: (n: number) => <>В вашем месячном лимите осталось всего <span className="font-extrabold">{n}</span> вопросов.</>,
    generating: "Создание...", generateBtn: "Создать вопросы"
  }
};

// Difficulty is a real state — semantic containers (matches QuestionCard/CartItem).
const DIFFICULTIES = [
  { id: "easy", active: "bg-success-container text-on-success-container border-success" },
  { id: "medium", active: "bg-warning-container text-on-warning-container border-warning" },
  { id: "hard", active: "bg-error-container text-on-error-container border-error" },
  { id: "mixed", active: "bg-tertiary-container text-on-tertiary-container border-tertiary" },
];

function StepBadge({ done, num }: { done: boolean; num: string }) {
  return (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold",
      done ? "bg-success text-surface-container-lowest" : "bg-primary-container text-on-primary-container",
    )}>
      {done ? <CheckCircle2 size={14} /> : num}
    </div>
  );
}

const SELECTOR_BTN = (selected: boolean) => cn(
  "m3-interactive w-full p-4 rounded-m3-lg border-2 text-left transition-all group flex items-center justify-between shadow-elev-1",
  selected
    ? "bg-primary-container border-primary-container hover:border-primary"
    : "bg-surface-container border-outline-variant hover:border-primary",
);

export default function GeneratorControlPanel({
  selectedClass, onOpenClassModal,
  selectedSubject, onOpenSubjectModal,
  activeChapter, activeSubtopic, onOpenSyllabus,
  difficulty, setDifficulty,
  count, setCount,
  isLoadingSyllabus, isReadyToGenerate, isGenerating, handleGenerate,
  aiData, setIsLimitModalOpen, setLimitModalMessage
}: any) {
  const { lang } = useTeacherLanguage();
  const t = PANEL_TRANSLATIONS[lang] || PANEL_TRANSLATIONS['uz'];

  const onGenerateClick = () => {
    // Pre-check limits
    if (!aiData?.isUnlimited && aiData?.remaining < count) {
      if (setLimitModalMessage) {
        setLimitModalMessage(t.limitLeft(aiData.remaining));
      }
      setIsLimitModalOpen(true);
      return;
    }
    handleGenerate();
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low relative">

      {/* SCROLLABLE STEP-BY-STEP WIZARD */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-32 space-y-6">

        {/* STEP 1: CLASS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StepBadge done={!!selectedClass} num="1" />
            <h3 className={cn("text-[12px] font-bold", selectedClass ? "text-success" : "text-on-surface")}>{t.step1}</h3>
          </div>

          <div className="pl-8">
            <button onClick={onOpenClassModal} className={SELECTOR_BTN(!!selectedClass)}>
              {selectedClass ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center text-primary shadow-elev-1"><GraduationCap size={20} /></div>
                  <span className="text-[13px] font-bold text-on-surface">{selectedClass}</span>
                </div>
              ) : (
                <span className="text-[12px] font-bold text-on-surface-variant pl-2">{t.step1Placeholder}</span>
              )}
              <ChevronRight size={20} className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* STEP 2: SUBJECT */}
        <AnimatePresence>
          {selectedClass && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-2">
                <StepBadge done={!!selectedSubject} num="2" />
                <h3 className={cn("text-[12px] font-bold", selectedSubject ? "text-success" : "text-on-surface")}>{t.step2}</h3>
              </div>

              <div className="pl-8">
                <button onClick={onOpenSubjectModal} className={SELECTOR_BTN(!!selectedSubject)}>
                  {selectedSubject ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center text-primary shadow-elev-1"><BookOpen size={20} /></div>
                      <span className="text-[13px] font-bold text-on-surface">{formatSubjectName(selectedSubject)}</span>
                    </div>
                  ) : (
                    <span className="text-[12px] font-bold text-on-surface-variant pl-2">{t.step2Placeholder}</span>
                  )}
                  <ChevronRight size={20} className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 3: TOPIC */}
        <AnimatePresence>
          {selectedSubject && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <StepBadge done={!!activeSubtopic} num="3" />
                  <h3 className={cn("text-[12px] font-bold", activeSubtopic ? "text-success" : "text-on-surface")}>{t.step3}</h3>
                </div>
                {isLoadingSyllabus && <Spinner size={14} />}
              </div>

              <div className="pl-8">
                <button onClick={onOpenSyllabus} disabled={isLoadingSyllabus} className={SELECTOR_BTN(!!activeSubtopic)}>
                  {activeChapter && activeSubtopic ? (
                    <div className="min-w-0 pr-4">
                      <div className="text-[9px] font-extrabold text-primary uppercase tracking-widest mb-1 truncate flex items-center gap-1.5"><BookMarked size={12} /> {activeChapter.chapter}</div>
                      <div className="text-[11px] font-bold text-on-surface leading-snug line-clamp-2">{activeSubtopic.name}</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center shadow-elev-1 group-hover:text-primary transition-colors"><Layers size={20} /></div>
                      <span className="text-[12px] font-bold">{t.step3Placeholder}</span>
                    </div>
                  )}
                  <ChevronRight size={20} className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 4: CONFIGURATION (Difficulty & Count) */}
        <AnimatePresence>
          {activeSubtopic && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-6 border-t border-outline-variant">

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StepBadge done={false} num="4" />
                  <h3 className="text-[12px] font-bold text-on-surface">{t.step4}</h3>
                </div>

                <div className="pl-8 space-y-5">
                  {/* Difficulty */}
                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-container rounded-m3-md">
                    {DIFFICULTIES.map(diff => {
                      const isSelected = difficulty === diff.id;
                      return (
                        <button
                          key={diff.id}
                          onClick={() => setDifficulty(diff.id)}
                          className={cn(
                            "m3-interactive py-2 px-1 rounded-m3-sm text-[10px] font-bold transition-all text-center border",
                            isSelected
                              ? cn(diff.active, "shadow-elev-1")
                              : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface",
                          )}
                        >
                          {t.difficulties[diff.id]}
                        </button>
                      )
                    })}
                  </div>

                  {/* Count & Limits */}
                  <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant p-3 rounded-m3-lg shadow-elev-1">
                    <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-2"><Settings2 size={16} className="text-primary" /> {t.questionCount}</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setCount((prev: number) => Math.max(1, prev - 1))} className="m3-interactive w-8 h-8 flex items-center justify-center bg-surface-container-high rounded-m3-sm text-on-surface-variant transition-colors disabled:text-disabled-fg" disabled={count <= 1}><Minus size={16} strokeWidth={3} /></button>
                      <span className="text-[14px] font-extrabold text-on-surface w-4 text-center tabular-nums">{count}</span>

                      {/* Limits applied to Plus button */}
                      <button
                        onClick={() => setCount((prev: number) => Math.min(15, aiData?.isUnlimited ? 15 : (aiData?.remaining ?? 15), prev + 1))}
                        className="m3-interactive w-8 h-8 flex items-center justify-center bg-surface-container-high rounded-m3-sm text-on-surface-variant transition-colors disabled:text-disabled-fg"
                        disabled={count >= 15 || (!aiData?.isUnlimited && count >= (aiData?.remaining ?? 15))}
                      >
                        <Plus size={16} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {/* Limitation Warning Banner */}
                  {aiData && !aiData.isUnlimited && aiData.remaining < 15 && (
                    <div className="bg-warning-container rounded-m3-md p-3 flex gap-3 items-start">
                      <Zap size={16} className="text-warning shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-on-warning-container leading-snug">
                        {t.lowLimitWarning(aiData.remaining)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* STICKY BOTTOM GENERATE BUTTON */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-surface-container-low via-surface-container-low to-transparent pt-10">
        <Button
          size="lg"
          className="w-full"
          onClick={onGenerateClick}
          disabled={isGenerating || !isReadyToGenerate}
          loading={isGenerating}
          icon={<Wand2 strokeWidth={2.5} />}
        >
          {isGenerating ? t.generating : t.generateBtn}
        </Button>
      </div>

    </div>
  );
}
