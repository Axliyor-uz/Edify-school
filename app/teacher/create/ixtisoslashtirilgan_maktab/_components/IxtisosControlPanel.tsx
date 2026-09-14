"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, Minus, Plus, Wand2, Layers, BookMarked, Settings2, Zap, GraduationCap, BookOpen } from "lucide-react";

import { Button, Spinner, cn } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";

const TRANSLATIONS: Record<string, any> = {
  uz: {
    difficulties: { easy: "Oson", medium: "O'rtacha", hard: "Murakkab", olympiad: "Olimpiada" },
    limitMsg: (remaining: number) => `Sizda oylik limitdan faqatgina ${remaining} ta savol qoldi. Iltimos so'ralayotgan miqdorni kamaytiring yoki tarifni oshiring.`,
    selectClass: "Sinfni tanlang",
    selectClassPh: "Sinfni tanlang...",
    selectSubject: "Fanni tanlang",
    selectSubjectPh: "Fanni tanlang...",
    learningTopic: "O'quv mavzusi",
    selectTopicPh: "Mavzuni tanlang...",
    settings: "Sozlamalar",
    questionCount: "Savollar soni",
    warnPre: "Sizda faqat ",
    warnPost: " ta savol yaratish limiti qoldi.",
    generating: "Yaratilmoqda...",
    generate: "Savol Yaratish",
  },
  en: {
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard", olympiad: "Olympiad" },
    limitMsg: (remaining: number) => `You have only ${remaining} questions left in your monthly limit. Please reduce the requested amount or upgrade your plan.`,
    selectClass: "Select a grade",
    selectClassPh: "Select a grade...",
    selectSubject: "Select a subject",
    selectSubjectPh: "Select a subject...",
    learningTopic: "Learning topic",
    selectTopicPh: "Select a topic...",
    settings: "Settings",
    questionCount: "Number of questions",
    warnPre: "You have only ",
    warnPost: " question creation credits left.",
    generating: "Generating...",
    generate: "Generate Questions",
  },
  ru: {
    difficulties: { easy: "Лёгкий", medium: "Средний", hard: "Сложный", olympiad: "Олимпиада" },
    limitMsg: (remaining: number) => `В вашем месячном лимите осталось всего ${remaining} вопросов. Пожалуйста, уменьшите запрашиваемое количество или повысьте тариф.`,
    selectClass: "Выберите класс",
    selectClassPh: "Выберите класс...",
    selectSubject: "Выберите предмет",
    selectSubjectPh: "Выберите предмет...",
    learningTopic: "Учебная тема",
    selectTopicPh: "Выберите тему...",
    settings: "Настройки",
    questionCount: "Количество вопросов",
    warnPre: "У вас осталось всего ",
    warnPost: " на создание вопросов.",
    generating: "Создаётся...",
    generate: "Создать вопросы",
  },
};

const formatSubjectName = (rawSubject: string) => {
  if (!rawSubject) return "";
  const cleanedStr = rawSubject.replace(/-/g, " ");
  return cleanedStr.charAt(0).toUpperCase() + cleanedStr.slice(1).toLowerCase();
};

// Difficulty is a real state — semantic containers; olympiad is the special
// tier and takes primary (the page accent itself is tertiary).
const DIFFICULTIES = [
  { id: "easy", label: "Oson", active: "bg-success-container text-on-success-container border-success" },
  { id: "medium", label: "O'rtacha", active: "bg-warning-container text-on-warning-container border-warning" },
  { id: "hard", label: "Murakkab", active: "bg-error-container text-on-error-container border-error" },
  { id: "olympiad", label: "Olimpiada", active: "bg-primary-container text-on-primary-container border-primary" },
];

function StepBadge({ done, num }: { done: boolean; num: string }) {
  return (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold",
      done ? "bg-success text-surface-container-lowest" : "bg-tertiary-container text-on-tertiary-container",
    )}>
      {done ? <CheckCircle2 size={14} /> : num}
    </div>
  );
}

const SELECTOR_BTN = (selected: boolean) => cn(
  "m3-interactive w-full p-4 rounded-m3-lg border-2 text-left transition-all group flex items-center justify-between shadow-elev-1",
  selected
    ? "bg-tertiary-container border-tertiary-container hover:border-tertiary"
    : "bg-surface-container border-outline-variant hover:border-tertiary",
);

export default function IxtisosControlPanel({
  selectedClass, onOpenClassModal,
  selectedSubject, onOpenSubjectModal,
  activeChapter, activeSubtopic, onOpenSyllabus,
  difficulty, setDifficulty,
  count, setCount,
  isLoadingSyllabus, isReadyToGenerate, isGenerating, handleGenerate,
  aiData, setIsLimitModalOpen, setLimitModalMessage
}: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const onGenerateClick = () => {
    // Pre-check limits
    if (!aiData?.isUnlimited && aiData?.remaining < count) {
      if (setLimitModalMessage) {
        setLimitModalMessage(t.limitMsg(aiData.remaining));
      }
      setIsLimitModalOpen(true);
      return;
    }
    handleGenerate();
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-32 space-y-6">

        {/* STEP 1: CLASS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StepBadge done={!!selectedClass} num="1" />
            <h3 className={cn("text-[14px] font-bold", selectedClass ? "text-success" : "text-on-surface")}>{t.selectClass}</h3>
          </div>

          <div className="pl-8">
            <button onClick={onOpenClassModal} className={SELECTOR_BTN(!!selectedClass)}>
              {selectedClass ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-elev-1"><GraduationCap size={20} /></div>
                  <span className="text-[15px] font-bold text-on-surface">{selectedClass}</span>
                </div>
              ) : (
                <span className="text-[14px] font-bold text-on-surface-variant pl-2">{t.selectClassPh}</span>
              )}
              <ChevronRight size={20} className="text-on-surface-variant group-hover:text-tertiary transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* STEP 2: SUBJECT */}
        <AnimatePresence>
          {selectedClass && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-2">
                <StepBadge done={!!selectedSubject} num="2" />
                <h3 className={cn("text-[14px] font-bold", selectedSubject ? "text-success" : "text-on-surface")}>{t.selectSubject}</h3>
              </div>

              <div className="pl-8">
                <button onClick={onOpenSubjectModal} className={SELECTOR_BTN(!!selectedSubject)}>
                  {selectedSubject ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-elev-1"><BookOpen size={20} /></div>
                      <span className="text-[15px] font-bold text-on-surface">{formatSubjectName(selectedSubject)}</span>
                    </div>
                  ) : (
                    <span className="text-[14px] font-bold text-on-surface-variant pl-2">{t.selectSubjectPh}</span>
                  )}
                  <ChevronRight size={20} className="text-on-surface-variant group-hover:text-tertiary transition-colors shrink-0" />
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
                  <h3 className={cn("text-[14px] font-bold", activeSubtopic ? "text-success" : "text-on-surface")}>{t.learningTopic}</h3>
                </div>
                {isLoadingSyllabus && <Spinner size={14} />}
              </div>

              <div className="pl-8">
                <button onClick={onOpenSyllabus} disabled={isLoadingSyllabus} className={SELECTOR_BTN(!!activeSubtopic)}>
                  {activeChapter && activeSubtopic ? (
                    <div className="min-w-0 pr-4">
                      <div className="text-[10px] font-extrabold text-tertiary uppercase tracking-widest mb-1 truncate flex items-center gap-1.5"><BookMarked size={12} /> {activeChapter.chapter}</div>
                      <div className="text-[13px] font-bold text-on-surface leading-snug line-clamp-2">{activeSubtopic.name}</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <div className="w-10 h-10 rounded-m3-md bg-surface-container-lowest flex items-center justify-center shadow-elev-1 group-hover:text-tertiary transition-colors"><Layers size={20} /></div>
                      <span className="text-[14px] font-bold">{t.selectTopicPh}</span>
                    </div>
                  )}
                  <ChevronRight size={20} className="text-on-surface-variant group-hover:text-tertiary transition-colors shrink-0" />
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
                  <h3 className="text-[14px] font-bold text-on-surface">{t.settings}</h3>
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
                            "m3-interactive py-2 px-1 rounded-m3-sm text-[12px] font-bold transition-all text-center border",
                            isSelected
                              ? cn(diff.active, "shadow-elev-1")
                              : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface",
                          )}
                        >
                          {t.difficulties[diff.id] || diff.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Count & Limits */}
                  <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant p-3 rounded-m3-lg shadow-elev-1">
                    <span className="text-[13px] font-bold text-on-surface-variant flex items-center gap-2"><Settings2 size={16} className="text-tertiary" /> {t.questionCount}</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setCount((prev: number) => Math.max(1, prev - 1))} className="m3-interactive w-8 h-8 flex items-center justify-center bg-surface-container-high rounded-m3-sm text-on-surface-variant transition-colors disabled:text-disabled-fg" disabled={count <= 1}><Minus size={16} strokeWidth={3} /></button>
                      <span className="text-[16px] font-extrabold text-on-surface w-4 text-center tabular-nums">{count}</span>

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
                        {t.warnPre}<span className="font-extrabold">{aiData.remaining}</span>{t.warnPost}
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
          {isGenerating ? t.generating : t.generate}
        </Button>
      </div>

    </div>
  );
}
