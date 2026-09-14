'use client';

import { Users, Hash, ArrowRight, BookOpen, Building2 } from 'lucide-react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { useTeacherLanguage } from '@/app/teacher/layout'; 

// --- TRANSLATION DICTIONARY ---
const CARD_TRANSLATIONS: Record<string, any> = {
  uz: { noDesc: "Tavsif yo'q", students: "O'quvchi", manage: "Boshqarish", centerGroup: "Markaz guruhi" },
  en: { noDesc: "No description", students: "Students", manage: "Manage Class", centerGroup: "Center group" },
  ru: { noDesc: "Нет описания", students: "Учеников", manage: "Управление", centerGroup: "Группа центра" }
};

// --- M3 three-tone rotation (no rainbow accents) ---
type Tone = 'primary' | 'secondary' | 'tertiary';

const TONE_STYLES: Record<Tone, { text: string; tile: string; titleHover: string; action: string; arrow: string }> = {
  primary: {
    text: 'text-primary',
    tile: 'bg-primary-container text-on-primary-container group-hover:bg-primary group-hover:text-on-primary',
    titleHover: 'group-hover:text-primary',
    action: 'group-hover:bg-primary group-hover:border-primary group-hover:text-on-primary',
    arrow: 'group-hover:bg-[color-mix(in_oklab,var(--m3-on-primary)_20%,transparent)] group-hover:text-on-primary',
  },
  secondary: {
    text: 'text-secondary',
    tile: 'bg-secondary-container text-on-secondary-container group-hover:bg-secondary group-hover:text-on-secondary',
    titleHover: 'group-hover:text-secondary',
    action: 'group-hover:bg-secondary group-hover:border-secondary group-hover:text-on-secondary',
    arrow: 'group-hover:bg-[color-mix(in_oklab,var(--m3-on-secondary)_20%,transparent)] group-hover:text-on-secondary',
  },
  tertiary: {
    text: 'text-tertiary',
    tile: 'bg-tertiary-container text-on-tertiary-container group-hover:bg-tertiary group-hover:text-on-tertiary',
    titleHover: 'group-hover:text-tertiary',
    action: 'group-hover:bg-tertiary group-hover:border-tertiary group-hover:text-on-tertiary',
    arrow: 'group-hover:bg-[color-mix(in_oklab,var(--m3-on-tertiary)_20%,transparent)] group-hover:text-on-tertiary',
  },
};

// --- DYNAMIC MESH BACKGROUND ---
const CardIllustration = ({ theme }: { theme: string }) => {
  const tone = TONE_STYLES[theme as Tone] ?? TONE_STYLES.primary;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-m3-xl pointer-events-none opacity-30 group-hover:opacity-100 transition-opacity duration-700">
      <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`grad-${theme}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.circle cx="160" cy="160" r="80" fill={`url(#grad-${theme})`} className={tone.text}
          animate={{ x: [-15, 10, -15], y: [-10, 15, -10], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle cx="40" cy="40" r="60" fill={`url(#grad-${theme})`} className={tone.text}
          animate={{ x: [10, -10, 10], y: [15, -10, 15], scale: [1, 1.2, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
};

const cardVariants: Variants = { 
  hidden: { opacity: 0, y: 15, scale: 0.98 }, 
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
  hover: { y: -4, transition: { duration: 0.2 } },
  tap: { scale: 0.97 }
};

interface Props {
  cls: any;
  theme: string; // Passed from parent (e.g., 'primary', 'secondary', 'tertiary')
  /** Resolved center name when cls.centerId is set (center groups show a badge instead of the join code). */
  centerName?: string;
}

export default function ClassCard({ cls, theme, centerName }: Props) {
  const { lang } = useTeacherLanguage();
  const t = CARD_TRANSLATIONS[lang] || CARD_TRANSLATIONS['uz'];
  const tone = TONE_STYLES[theme as Tone] ?? TONE_STYLES.primary;
  const isCenterClass = !!cls.centerId;

  return (
    <motion.div variants={cardVariants} whileHover="hover" whileTap="tap" className="group bg-surface-container-low rounded-m3-xl border border-outline-variant p-5 md:p-6 shadow-elev-1 transition-all duration-300 relative overflow-hidden flex flex-col h-full hover:shadow-elev-3">

      <CardIllustration theme={theme} />

      {/* HEADER ROW: Icon + Title */}
      <div className="flex items-start gap-4 mb-5 relative z-10">
        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-m3-md flex items-center justify-center shrink-0 transition-all duration-300 ${tone.tile} group-hover:scale-110 group-hover:rotate-3`}>
           <BookOpen size={20} strokeWidth={2.5} className="md:w-6 md:h-6" />
        </div>
        <div className="flex-1 min-w-0 pt-1">
           <h3 className={`font-black text-on-surface text-[16px] md:text-[18px] transition-colors line-clamp-1 ${tone.titleHover}`}>
             {cls.title}
           </h3>
           <p className="text-[12px] md:text-[13px] text-on-surface-variant font-medium line-clamp-1 mt-0.5 md:mt-1">
             {cls.description || t.noDesc}
           </p>
        </div>
      </div>

      {/* METRICS ROW: Badges */}
      <div className="flex flex-wrap items-center gap-2.5 mb-6 relative z-10">
         {isCenterClass ? (
           // Markaz guruhi: kirish kodi yashirin (qo'shilish yopiq) — markaz badge'i.
           <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 bg-tertiary-container rounded-m3-sm transition-colors max-w-[170px]">
              <Building2 size={14} className="text-on-tertiary-container shrink-0"/>
              <span className="text-[11px] md:text-[12px] font-black text-on-tertiary-container truncate">{centerName || t.centerGroup}</span>
           </div>
         ) : (
           <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 bg-surface-container border border-outline-variant rounded-m3-sm group-hover:bg-surface-container-lowest transition-colors">
              <Hash size={14} className="text-on-surface-variant"/>
              <span className="font-mono text-[11px] md:text-[12px] font-black text-on-surface tracking-widest">{cls.joinCode}</span>
           </div>
         )}

         <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 bg-surface-container-high border border-outline-variant rounded-m3-sm group-hover:bg-inverse-surface transition-colors group-hover:border-inverse-surface">
            <Users size={14} className="text-on-surface-variant group-hover:text-inverse-on-surface"/>
            <span className="text-[11px] md:text-[12px] font-bold text-on-surface group-hover:text-inverse-on-surface transition-colors">{cls.studentIds?.length || 0} {t.students}</span>
         </div>
      </div>

      <div className="flex-1"></div>

      {/* ACTION BUTTON */}
      <Link
        href={`/teacher/classes/${cls.id}`}
        className={`flex items-center justify-between w-full p-2.5 md:p-3 rounded-m3-md md:rounded-m3-lg bg-surface-container border border-outline-variant font-bold text-[13px] md:text-[14px] transition-all duration-300 relative z-10 text-on-surface-variant ${tone.action} group-hover:shadow-elev-2`}
      >
         <span className="ml-2">{t.manage}</span>
         <div className={`w-8 h-8 rounded-m3-sm md:rounded-m3-md bg-surface-container-lowest border border-outline-variant flex items-center justify-center transition-colors text-on-surface-variant group-hover:border-transparent ${tone.arrow}`}>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
         </div>
      </Link>

    </motion.div>
  );
}