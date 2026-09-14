// app/(student)/raschmodel/page.tsx
'use client';

import { Target } from 'lucide-react';

// Components
import MathematicsCard from './components/MathematicsCard';
import RaschNav from './_components/RaschNav';
import MathLevelSummary from './components/MathLevelSummary';
import MmsCard from './components/MmsCard';
import { useStudentLanguage } from '../layout';
import { Page, PageHeader, Tile } from '@/components/student-ui';
import type { Lang } from '@/types/Math';

// ─── i18n ─────────────────────────────────────────────────────────────────────
// This page used to be hardcoded Uzbek while every page it links to (progress,
// diagnosis, practice, exam) was already trilingual — so switching the language
// in the navbar changed everything except the hub the student starts from.
const UI: Record<Lang, Record<string, string>> = {
  uz: { subtitle: "Fanlarni tanlang va tezkor mashq qilishni boshlang 🚀" },
  ru: { subtitle: 'Выберите предмет и начните тренировку 🚀' },
  en: { subtitle: 'Pick a subject and start practising 🚀' },
};
// `bannerTitle`/`bannerDesc` went with the decorative gradient banner MmsCard
// replaced (2026-07-30) — they had no other reader.

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function raschmodelPage() {
  // One language switcher for the whole student app — it lives in the top navbar
  // (app/(student)/layout.tsx) and reaches every page through this context.
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  return (
    <Page>
      <RaschNav lang={lang} />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Tile tone="primary" size="sm">
              <Target size={20} strokeWidth={2.5} />
            </Tile>
            RA<span className="text-primary">SCH</span>
          </span>
        }
        subtitle={t.subtitle}
      />

      {/* ── Where the student actually stands ───────────────────────────── */}
      <MathLevelSummary lang={lang} />

      {/* ── The exam itself ─────────────────────────────────────────────────
          ⚠️ `MmsCard` moved here from the student dashboard on 2026-07-30, where
          it was replaced by the generic announcement carousel. It takes the slot
          of a purely decorative "Imtihonga tayyorlaning!" gradient banner and is
          strictly more useful in it: it names the paper, prints the expected score
          at the measured θ and the weakest dimension, and starts a sitting. It
          reads the SAME 12h-cached `RASCH_levels/{uid}` document as
          `MathLevelSummary` above and the nav's level chip, so the three of them
          cost one read between them — and it spends the same single `gradient`
          card the banner did. */}
      <MmsCard lang={lang} className="mb-6" />

      {/* ── Mathematics Section ─────────────────────────────────────────── */}
      <MathematicsCard lang={lang} />
    </Page>
  );
}
