// app/(student)/raschmodel/_components/RaschNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Brain, Dumbbell, KeyRound, Rocket } from 'lucide-react';

import { cn } from '@/components/student-ui';
import { LevelChip } from './LevelBadge';
import type { Lang } from '@/types/Math';

/**
 * The one navigation bar for the whole Rasch suite.
 *
 * Every page used to roll its own row of links, and they disagreed on both
 * membership and order — progress offered Home / Analysis / New test, diagnosis
 * offered My level / Home / Practice, practice offered Analysis / Home. Landing
 * on a page and finding the control you just used has MOVED is the kind of thing
 * that reads as a broken app, so the bar is defined once here and the order is
 * fixed: Home → My level → Analysis → Practice → Code → Quick start.
 *
 * On a phone it is a **mini bar**: 32px icon-only chips, so all six destinations
 * plus the level readout fit a 360px screen without scrolling or wrapping. The
 * labels return at `sm` and survive as `aria-label`/`title` in between.
 *
 * It is sticky, not static: these pages are long (a heptagon, thirty-four skill
 * rows, a question archive), and a nav that scrolls away means scrolling back to
 * the top to leave. `top-[var(--s-topbar-h)]` parks it directly under the shell's
 * own app bar, and z-20 keeps it below that bar (z-40) and below the shell's
 * desktop tab row (z-30) so it can never overlap either.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    home: 'Bosh sahifa',
    level: 'Darajam',
    analysis: 'Tahlil',
    practice: 'Mashq',
    quiz: 'Kod',
    exam: 'Tezkor test',
  },
  ru: {
    home: 'Главная',
    level: 'Мой уровень',
    analysis: 'Анализ',
    practice: 'Тренировка',
    quiz: 'Код',
    exam: 'Быстрый тест',
  },
  en: {
    home: 'Home',
    level: 'My level',
    analysis: 'Analysis',
    practice: 'Practice',
    quiz: 'Code',
    exam: 'Quick start',
  },
};

interface NavItem {
  href: string;
  key: keyof (typeof UI)['en'];
  icon: React.ElementType;
  /** The last item is the call to action and is filled, not outlined. */
  cta?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/raschmodel', key: 'home', icon: Home },
  { href: '/raschmodel/progress', key: 'level', icon: TrendingUp },
  { href: '/raschmodel/diagnosis', key: 'analysis', icon: Brain },
  { href: '/raschmodel/practice', key: 'practice', icon: Dumbbell },
  // The teacher-quiz entry point. It is a plain item, not the CTA: a student
  // arrives here holding a code somebody gave them, so it must be findable, but
  // the paper they can always start on their own stays the filled call to action.
  { href: '/raschmodel/quiz', key: 'quiz', icon: KeyRound },
  { href: '/raschmodel/exam', key: 'exam', icon: Rocket, cta: true },
];

export default function RaschNav({ lang, className }: { lang: Lang; className?: string }) {
  const pathname = usePathname();
  const t = UI[lang];

  const link = ({ href, key, icon: Icon, cta }: NavItem) => {
    // Exact match only — every route here is a sibling of /raschmodel, so a
    // startsWith test would light up "Home" on every page.
    const active = pathname === href;

    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        // The label is the accessible name on a phone, where it is not drawn.
        aria-label={t[key]}
        title={t[key]}
        className={cn(
          // Phone: a 32px icon-only chip, so all six items plus the level chip
          // fit 360px without scrolling. Labels come back at `sm`.
          'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-m3-btn px-2 sm:h-9 sm:px-3.5',
          'text-[13px] font-extrabold leading-none s-press',
          'transition-colors duration-m3-fast ease-m3-std',
          cta
            ? 'bg-primary text-on-primary'
            : active
              // The current page is a tonal chip, never an outline: the student
              // should be able to tell where they are without reading the labels.
              ? 'bg-primary-container text-on-primary-container'
              : 'border-[1.5px] border-outline text-on-surface-variant hover:bg-state-hover',
        )}
      >
        <Icon size={16} strokeWidth={2.75} className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">{t[key]}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Rasch"
      className={cn(
        'sticky top-[var(--s-topbar-h)] z-20 -mx-s-page-x mb-s-gap-lg px-s-page-x py-1.5 sm:py-2',
        // Translucent via the prebuilt token: M3 colors are plain hex inside
        // var(), so `bg-surface/85` would render fully opaque.
        'bg-surface-blur backdrop-blur-md',
        'border-b border-outline-variant',
        className,
      )}
    >
      {/* Six labelled items do not fit a 360px phone, and a bar that wraps to two
          rows shifts the whole page down as you navigate — so below `sm` the
          items are icon-only (the label survives as `aria-label`/`title`) and
          the whole bar fits without moving. `overflow-x-auto` stays as the
          safety net for a 320px screen or a long-word language. */}
      <div className="s-no-scrollbar flex items-center gap-1.5 overflow-x-auto sm:gap-2">
        {ITEMS.filter((i) => !i.cta).map(link)}

        {/* The right-hand group. Two explicit groups rather than an `ml-auto` on
            the CTA: the level chip has to sit BEFORE the call to action (a
            readout, then the thing you do about it), and a lone `ml-auto` would
            have put whichever element carried it first — so the chip landed to
            the right of the button. The group also keeps the CTA parked right on
            its own when the chip renders null. */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LevelChip lang={lang} />
          {ITEMS.filter((i) => i.cta).map(link)}
        </div>
      </div>
    </nav>
  );
}
