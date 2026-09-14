'use client';

import { Clock, ArrowRight, Layers, Calendar } from 'lucide-react';
import PrintLauncher from '@/app/teacher/create/_components/PrintLauncher';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion } from 'framer-motion';

// --- TRANSLATION DICTIONARY ---
const CARD_TRANSLATIONS: Record<string, any> = {
  uz: { active: "Faol", archived: "Arxiv", pin: "Kod", noLimit: "Cheksiz", min: "daq", items: "ta savol" },
  en: { active: "Active", archived: "Archived", pin: "Pin", noLimit: "No Limit", min: "min", items: "Items" },
  ru: { active: "Активен", archived: "Архив", pin: "Код", noLimit: "Без лимита", min: "мин", items: "вопр." }
};

// --- M3 three-tone rotation (see docs/UI_KIT.md — no rainbow accents) ---
// All class strings are full literals so Tailwind JIT can generate them.
type Tone = 'primary' | 'secondary' | 'tertiary';

const TONE_STYLES: Record<Tone, {
  mesh: string;
  cardHover: string;
  chipText: string;
  dot: string;
  titleHover: string;
  printHover: string;
  arrowHover: string;
}> = {
  primary: {
    mesh: 'text-primary',
    cardHover: 'hover:border-primary',
    chipText: 'text-primary',
    dot: 'bg-primary',
    titleHover: 'group-hover:text-primary',
    printHover: 'group-hover:text-primary',
    arrowHover: 'group-hover:bg-primary group-hover:text-on-primary',
  },
  secondary: {
    mesh: 'text-secondary',
    cardHover: 'hover:border-secondary',
    chipText: 'text-secondary',
    dot: 'bg-secondary',
    titleHover: 'group-hover:text-secondary',
    printHover: 'group-hover:text-secondary',
    arrowHover: 'group-hover:bg-secondary group-hover:text-on-secondary',
  },
  tertiary: {
    mesh: 'text-tertiary',
    cardHover: 'hover:border-tertiary',
    chipText: 'text-tertiary',
    dot: 'bg-tertiary',
    titleHover: 'group-hover:text-tertiary',
    printHover: 'group-hover:text-tertiary',
    arrowHover: 'group-hover:bg-tertiary group-hover:text-on-tertiary',
  },
};

// --- DYNAMIC MESH BACKGROUND ---
const CardIllustration = ({ theme }: { theme: Tone }) => (
  // The overflow-hidden here perfectly clips the mesh to the card's rounded corners!
  <div className="absolute inset-0 overflow-hidden rounded-m3-lg pointer-events-none opacity-30 group-hover:opacity-100 transition-opacity duration-700 z-0">
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`grad-${theme}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle cx="160" cy="160" r="80" fill={`url(#grad-${theme})`} className={TONE_STYLES[theme].mesh}
        animate={{ x: [-15, 10, -15], y: [-10, 15, -10], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle cx="40" cy="40" r="60" fill={`url(#grad-${theme})`} className={TONE_STYLES[theme].mesh}
        animate={{ x: [10, -10, 10], y: [15, -10, 15], scale: [1, 1.2, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  </div>
);

interface Props {
  test: any;
  theme: string;
  onManage: () => void;
}

export default function TestCard({ test, theme, onManage }: Props) {
  const { lang } = useTeacherLanguage();
  const t = CARD_TRANSLATIONS[lang] || CARD_TRANSLATIONS['uz'];
  const isActive = test.status !== 'archived';

  // Unknown theme values fall back to 'primary'.
  const tone: Tone = theme === 'secondary' || theme === 'tertiary' ? theme : 'primary';
  const tv = TONE_STYLES[tone];

  const formattedDate = test.createdAt ? (() => {
    try {
      const dateObj = test.createdAt?.toDate ? test.createdAt.toDate() : new Date(test.createdAt);
      const locales: any = { uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU' };
      return new Intl.DateTimeFormat(locales[lang] || 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateObj);
    } catch { return ''; }
  })() : '';

  return (
    <div
      onClick={onManage}
      // 🟢 THE FIX: Removed 'overflow-hidden' from this main wrapper class list
      className={`group bg-surface-container-low rounded-m3-lg border border-outline-variant p-5 md:p-6 shadow-elev-1 transition-all duration-300 relative flex flex-col h-full cursor-pointer hover:shadow-elev-2 ${tv.cardHover} ${!isActive ? 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0' : ''}`}
    >

      <CardIllustration theme={tone} />

      {/* TOP ROW */}
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-m3-xs border text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${isActive ? `bg-surface-container-lowest border-outline-variant shadow-elev-1 ${tv.chipText}` : 'bg-surface-container-high border-outline-variant text-on-surface-variant'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? `${tv.dot} animate-pulse` : 'bg-outline'}`}></div>
          {isActive ? t.active : t.archived}
        </div>

        {/* Tooltip Wrapper */}
        <div onClick={(e) => e.stopPropagation()} className="relative z-20">
           <PrintLauncher
              title={test.title}
              questions={test.questions}
              className={`p-2 bg-surface-container border border-outline-variant text-on-surface-variant rounded-m3-md transition-all shadow-elev-1 group-hover:bg-surface-container-lowest group-hover:shadow-elev-2 ${tv.printHover}`}
           />
        </div>
      </div>

      {/* MIDDLE ROW */}
      <div className="mb-6 flex-1 relative z-10">
        <h3 className={`font-black text-on-surface text-[16px] md:text-[18px] leading-snug mb-2 ${tv.titleHover} transition-colors line-clamp-2`}>
          {test.title}
        </h3>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold text-on-surface-variant tracking-wide">
              <Calendar size={14} className="text-outline" /> {formattedDate}
            </div>
          )}
          {test.accessCode && (
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] md:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{t.pin}:</span>
               <span className="bg-surface-container text-on-surface font-mono text-[11px] md:text-[12px] font-black px-2 py-0.5 rounded-m3-xs border border-outline-variant shadow-inner group-hover:bg-surface-container-lowest transition-colors">
                 {test.accessCode}
               </span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="pt-4 border-t border-outline-variant flex items-center justify-between relative z-10 transition-colors">
         <div className="flex items-center gap-4 text-[12px] md:text-[13px] font-bold text-on-surface-variant">
           <span className="flex items-center gap-1.5" title="Duration"><Clock size={14} className="text-outline" /> {test.duration ? `${test.duration} ${t.min}` : t.noLimit}</span>
           <span className="flex items-center gap-1.5" title="Question Count"><Layers size={14} className="text-outline" /> {test.questionCount} {t.items}</span>
         </div>
         <div className={`w-8 h-8 md:w-10 md:h-10 rounded-m3-md bg-surface-container border border-outline-variant flex items-center justify-center transition-colors duration-300 text-on-surface-variant group-hover:border-transparent shadow-elev-1 group-hover:shadow-elev-2 ${tv.arrowHover}`}>
           <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
         </div>
      </div>

    </div>
  );
}
