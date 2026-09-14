'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Shuffle, Eye, Lock, CheckCircle, Shield, CalendarClock, EyeOff } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';

import { Button, IconButton, cn } from '@/components/ui';

const CONFIG_TRANSLATIONS = {
  uz: {
    title: "Yakunlash va Nashr Qilish",
    subtitle: "\"{title}\" uchun sozlamalar",
    timeLimit: { title: "Vaqt Cheklovi", noLimit: "Cheklovsiz", fixed: "Belgilangan", mins: "DAQ" },
    shuffle: { title: "Savollarni Aralashtirish", desc: "Har bir o'quvchi uchun tartibni o'zgartirish" },
    security: {
      title: "Javoblar Xavfsizligi",
      afterDue: { title: "Muddatdan keyin ko'rsatish", desc: "O'quvchilar javoblarni faqat muddat tugagandan so'ng ko'radi." },
      never: { title: "Hech qachon ko'rsatilmasin", desc: "Qat'iy rejim. Faqat yakuniy ball ko'rinadi." },
      always: { title: "Darhol ko'rsatish", desc: "Javoblar topshirilgandan so'ng darhol ochiladi." }
    },
    accessCode: "Maxfiy Kirish Kodi",
    buttons: { cancel: "Bekor qilish", publishing: "Nashr qilinmoqda...", confirm: "Tasdiqlash va Nashr Qilish" }
  },
  en: {
    title: "Finalize & Publish",
    subtitle: "Settings for \"{title}\"",
    timeLimit: { title: "Time Limit", noLimit: "No Limit", fixed: "Fixed Time", mins: "MINS" },
    shuffle: { title: "Shuffle Questions", desc: "Randomize order for every student" },
    security: {
      title: "Answer Key Security",
      afterDue: { title: "Show After Deadline", desc: "Students see answers only after the due date." },
      never: { title: "Never Show Answers", desc: "Strict mode. Students only see their final score." },
      always: { title: "Show Immediately", desc: "Answers revealed right after submission." }
    },
    accessCode: "Secret Access Code",
    buttons: { cancel: "Cancel", publishing: "Publishing...", confirm: "Confirm & Publish" }
  },
  ru: {
    title: "Завершить и Опубликовать",
    subtitle: "Настройки для \"{title}\"",
    timeLimit: { title: "Ограничение времени", noLimit: "Без лимита", fixed: "Фиксированное", mins: "МИН" },
    shuffle: { title: "Перемешать вопросы", desc: "Случайный порядок для каждого ученика" },
    security: {
      title: "Безопасность ответов",
      afterDue: { title: "Показать после срока", desc: "Ответы открываются после истечения срока." },
      never: { title: "Никогда не показывать", desc: "Строгий режим. Виден только итоговый балл." },
      always: { title: "Показать сразу", desc: "Ответы открываются сразу после сдачи." }
    },
    accessCode: "Секретный Код Доступа",
    buttons: { cancel: "Отмена", publishing: "Публикация...", confirm: "Подтвердить и Опубликовать" }
  }
};

interface TestSettings {
  duration: number;
  shuffleQuestions: boolean;
  resultsVisibility: 'always' | 'after_due' | 'never';
  accessCode: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: TestSettings) => void;
  questionCount: number;
  testTitle: string;
  isSaving: boolean;
}

type Visibility = TestSettings['resultsVisibility'];

export default function TestConfigurationModal({
  isOpen, onClose, onConfirm, questionCount, testTitle, isSaving
}: Props) {

  const { lang } = useTeacherLanguage();
  const t = CONFIG_TRANSLATIONS[lang];
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [duration, setDuration] = useState<number>(45);
  const [isTimeLimited, setIsTimeLimited] = useState(true);
  const [shuffle, setShuffle] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('after_due');

  const [accessCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  });

  const handlePublish = () => {
    onConfirm({
      duration: isTimeLimited ? duration : 0,
      shuffleQuestions: shuffle,
      resultsVisibility: visibility,
      accessCode: accessCode
    });
  };

  if (!mounted) return null;

  const VISIBILITY_OPTIONS: { id: Visibility; icon: typeof Eye; data: { title: string; desc: string } }[] = [
    { id: 'after_due', icon: CalendarClock, data: t.security.afterDue },
    { id: 'never', icon: EyeOff, data: t.security.never },
    { id: 'always', icon: Eye, data: t.security.always },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: "100%" }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl shadow-elev-3 w-full max-w-xl flex flex-col h-[90dvh] sm:h-auto sm:max-h-[90vh] z-10"
          >

            {/* HEADER */}
            <div className="border-b border-outline-variant p-5 md:p-6 flex justify-between items-center shrink-0 z-20">
              <div className="flex items-center gap-3 md:gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-container text-on-primary-container rounded-m3-md flex items-center justify-center shrink-0">
                  <Shield size={20} className="md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] md:text-xl font-extrabold text-on-surface tracking-tight truncate">{t.title}</h2>
                  <p className="text-[11px] md:text-[13px] font-medium text-on-surface-variant mt-0.5 truncate">
                    {t.subtitle.replace("{title}", testTitle)}
                  </p>
                </div>
              </div>
              <IconButton aria-label={t.buttons.cancel} onClick={onClose} className="shrink-0">
                <X />
              </IconButton>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 p-5 md:p-6 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">

              {/* 1. TIME LIMIT */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[12px] md:text-[13px] font-bold text-on-surface-variant uppercase tracking-widest pl-1">
                  <Clock size={14} className="text-primary" /> {t.timeLimit.title}
                </div>
                <div className="flex items-center gap-2 md:gap-3 p-1.5 bg-surface-container-high rounded-m3-md">
                  <button
                    onClick={() => setIsTimeLimited(false)}
                    className={cn(
                      "m3-interactive flex-1 py-3 md:py-2.5 px-2 md:px-4 rounded-m3-sm text-[13px] md:text-sm font-bold transition-all",
                      !isTimeLimited ? "bg-secondary-container text-on-secondary-container shadow-elev-1" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {t.timeLimit.noLimit}
                  </button>
                  <button
                    onClick={() => setIsTimeLimited(true)}
                    className={cn(
                      "m3-interactive flex-1 py-3 md:py-2.5 px-2 md:px-4 rounded-m3-sm text-[13px] md:text-sm font-bold transition-all",
                      isTimeLimited ? "bg-secondary-container text-on-secondary-container shadow-elev-1" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {t.timeLimit.fixed}
                  </button>
                  {isTimeLimited && (
                    <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} className="flex items-center gap-1.5 md:gap-2 pr-1 md:pr-2 overflow-hidden shrink-0">
                      <input
                        type="number" min="5" max="180" value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                        className="m3-field w-14 md:w-16 px-1 md:px-2 py-2 text-center font-extrabold text-on-primary-container bg-primary-container border border-transparent rounded-m3-sm text-[13px] md:text-sm focus:border-primary outline-none transition-all tabular-nums"
                      />
                      <span className="text-[10px] md:text-[11px] font-extrabold text-on-surface-variant">{t.timeLimit.mins}</span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* 2. SHUFFLE */}
              <div
                onClick={() => setShuffle(!shuffle)}
                className={cn(
                  "p-4 md:p-5 rounded-m3-lg cursor-pointer transition-all flex items-center justify-between group bg-surface-container-lowest",
                  shuffle ? "ring-2 ring-inset ring-primary shadow-elev-1" : "ring-1 ring-inset ring-outline-variant",
                )}
              >
                <div className="flex items-center gap-3.5 md:gap-4">
                  <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-m3-md flex items-center justify-center transition-colors", shuffle ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>
                    <Shuffle size={18} className="md:w-5 md:h-5" />
                  </div>
                  <div>
                    <p className={cn("text-[14px] md:text-[15px] font-bold", shuffle ? "text-on-primary-container" : "text-on-surface")}>{t.shuffle.title}</p>
                    <p className="text-[12px] md:text-[13px] font-medium text-on-surface-variant mt-0.5 leading-snug pr-4">{t.shuffle.desc}</p>
                  </div>
                </div>
                {shuffle && <CheckCircle size={20} className="text-primary shrink-0" />}
              </div>

              {/* 3. ANSWER VISIBILITY */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[12px] md:text-[13px] font-bold text-on-surface-variant uppercase tracking-widest pl-1">
                  <Shield size={14} className="text-primary" /> {t.security.title}
                </div>
                <div className="grid grid-cols-1 gap-2.5 md:gap-3">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const selected = visibility === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setVisibility(opt.id)}
                        className={cn(
                          "p-3.5 md:p-4 rounded-m3-lg cursor-pointer flex items-center gap-3.5 md:gap-4 transition-all bg-surface-container-lowest",
                          selected ? "ring-2 ring-inset ring-primary shadow-elev-1" : "ring-1 ring-inset ring-outline-variant",
                        )}
                      >
                        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-m3-md flex items-center justify-center shrink-0 transition-colors", selected ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>
                          <opt.icon size={18} className="md:w-5 md:h-5" />
                        </div>
                        <div className="pr-2">
                          <p className={cn("text-[14px] md:text-[15px] font-bold", selected ? "text-on-primary-container" : "text-on-surface")}>{opt.data.title}</p>
                          <p className="text-[12px] md:text-[13px] font-medium text-on-surface-variant mt-0.5 leading-snug">{opt.data.desc}</p>
                        </div>
                        {selected && <CheckCircle size={20} className="text-primary ml-auto shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. ACCESS CODE */}
              <div className="bg-inverse-surface rounded-m3-lg p-5 md:p-6 flex items-center justify-between shadow-elev-2 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] md:text-[11px] text-inverse-primary font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Lock size={12} /> {t.accessCode}
                  </p>
                  <p className="text-2xl md:text-3xl font-mono font-extrabold tracking-[0.2em] text-inverse-on-surface">
                    {accessCode}
                  </p>
                </div>
              </div>

            </div>

            {/* FOOTER (sticky bottom on mobile) */}
            <div className="p-4 md:p-5 border-t border-outline-variant bg-surface-container flex flex-col sm:flex-row justify-end gap-3 shrink-0 sm:rounded-b-m3-xl z-20 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
              <Button variant="outlined" onClick={onClose} className="w-full sm:w-auto">
                {t.buttons.cancel}
              </Button>
              <Button
                onClick={handlePublish}
                loading={isSaving}
                icon={<CheckCircle />}
                className="w-full sm:w-auto px-8"
              >
                {isSaving ? t.buttons.publishing : t.buttons.confirm}
              </Button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
