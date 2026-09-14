// app/(student)/raschmodel/components/MmsCard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, Play, ShieldCheck, Timer } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { dimensions, getRASCHLevels, mathLevel } from '@/services/RASCHProgressService';
import { EXAM_DURATION_MINUTES, EXAM_TOTAL_QUESTIONS } from '@/lib/Examblueprint';
import { PAPER_TOTAL } from '@/lib/RASCHmarks';
import {
  EXAMS_PER_DAY, examQuota, formatCooldown, formatUnlockTime, lastExamAt,
} from '@/lib/RASCHquota';
import { expectedScore } from '@/lib/RASCHtheta';
import { MASTER_LEVEL, formatLevel } from '@/lib/RASCHscale';
import { RASCH_TOPICS } from '@/lib/RASCHtopics';
import { Button, Card, MOTION_ON, springTransition } from '@/components/student-ui';
import type { RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

/**
 * **MMS — Matematika Milliy Sertifikat.** The dashboard's route into the real
 * thing: a full 45-question, 150-minute paper on the national spec.
 *
 * Nothing named the exam the way a student knows it, so the feature the whole
 * RASCH subsystem exists for sat behind a four-letter word ("RASCH") that means
 * nothing to them. This card names it.
 *
 * ⚠️ **It lives on the Rasch hub (`/raschmodel`), not the dashboard.** It was
 * built for the dashboard on 2026-07-29 and moved here on 2026-07-30, when the
 * dashboard's hero slot went to the generic announcement carousel
 * (`lib/announcements.ts`) — a card welded to one feature had to be rewritten
 * every time the platform shipped another. Here it replaces a purely decorative
 * gradient banner and pairs with `MathLevelSummary` exactly as designed. The
 * maths *announcement* now carries the "start a paper" invitation on the
 * dashboard; this card carries the numbers.
 *
 * ⚠️ **It costs ZERO extra reads.** `getRASCHLevels` is the same 12h
 * localStorage-cached single document `MathLevelSummary` and `/progress` read,
 * so a second consumer on the same screen is free — which is the only reason
 * this is allowed to be data-driven rather than a static banner.
 *
 * What makes it *useful* rather than decorative: it shows the score this student
 * would be expected to get on the standard paper at their measured ability, and
 * names their weakest dimension with a one-tap route into practising it.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    badge: 'MMS',
    title: 'Matematika Milliy Sertifikat',
    lead: `DTM formatidagi to'liq variant: ${EXAM_TOTAL_QUESTIONS} ta savol, ${EXAM_DURATION_MINUTES} daqiqa, ${PAPER_TOTAL} ball.`,
    expected: 'Hozirgi darajangizda kutilayotgan natija',
    firstTime: "Darajangiz hali o'lchanmagan — birinchi variant uni aniqlaydi.",
    weakest: 'Eng zaif',
    start: 'Variantni boshlash',
    byCode: "O'qituvchi kodi",
    // The 2-a-day cap — lib/RASCHquota.ts owns the rule, this only reports it.
    perDay: 'Kuniga {n} marta',
    locked: '{time} da ochiladi',
  },
  ru: {
    badge: 'MMS',
    title: 'Национальный сертификат по математике',
    lead: `Полный вариант формата ДТМ: ${EXAM_TOTAL_QUESTIONS} вопросов, ${EXAM_DURATION_MINUTES} минут, ${PAPER_TOTAL} баллов.`,
    expected: 'Ожидаемый результат на вашем уровне',
    firstTime: 'Ваш уровень ещё не измерен — первый вариант его определит.',
    weakest: 'Слабее всего',
    start: 'Начать вариант',
    byCode: 'Код учителя',
    perDay: '{n} раза в день',
    locked: 'Откроется в {time}',
  },
  en: {
    badge: 'MMS',
    title: 'Mathematics National Certificate',
    lead: `A full DTM-format paper: ${EXAM_TOTAL_QUESTIONS} questions, ${EXAM_DURATION_MINUTES} minutes, ${PAPER_TOTAL} points.`,
    expected: 'Expected result at your current level',
    firstTime: 'Your level is not measured yet — your first paper sets it.',
    weakest: 'Weakest',
    start: 'Start a paper',
    byCode: "Teacher's code",
    perDay: '{n} papers a day',
    locked: 'Unlocks at {time}',
  },
};

export default function MmsCard({ lang, className = '' }: { lang: Lang; className?: string }) {
  const { user, loading } = useAuth();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    getRASCHLevels(user.uid)
      .then((next) => {
        if (cancelled) return;
        setLevels(next);
        setReady(true);
      })
      .catch((err: unknown) => {
        // The card's VALUE is the invitation, not the statistic — a failed level
        // read must degrade it to the plain "start a paper" state, never hide it.
        console.error('[RASCH] MMS card level read failed', err);
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, [user, loading]);

  const math = useMemo(() => mathLevel(levels), [levels]);
  const measured = math.measuredDimensions > 0;

  // ⚠️ The 2-a-day cap, so this card's primary CTA is never a dead end — it used
  // to send the student to a Start button the exam page then refused. 30s is
  // deliberate: a summary card does not need a per-second countdown (the exam
  // page has that one), and the paper's own clock is the only second-accurate
  // timer on the account. `lastExamAt` reads the levels doc already in hand, so
  // this costs nothing. See lib/RASCHquota.ts.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const quota = useMemo(() => examQuota(lastExamAt(levels?.exams), now), [levels, now]);

  /** The dimension to send them at — lowest measured level, never an unmeasured
   *  one (a dimension the paper never asked about is not a weakness). */
  const weakest = useMemo(() => {
    const rated = dimensions(levels).filter((d) => d.measured > 0);
    if (rated.length === 0) return null;
    const low = rated.reduce((a, b) => (b.level < a.level ? b : a));
    return { ...low, topic: RASCH_TOPICS.find((tp) => tp.key === low.key)! };
  }, [levels]);

  if (!user || !ready) return null;

  return (
    <motion.div
      initial={MOTION_ON ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className={className}
    >
      {/* `gradient` is the one hero treatment the student kit allows per screen
          (components/student-ui/Card.tsx) — the dashboard spends it here, on the
          single action worth interrupting for. */}
      <Card variant="gradient" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full border-8 border-current" />
          <div className="absolute -bottom-10 right-24 h-24 w-24 rounded-full border-8 border-current" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm border-2 border-current">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </span>
            <span className="s-num rounded-m3-xs border-2 border-current px-2 py-0.5 text-[11px] font-black tracking-[0.14em]">
              {t.badge}
            </span>
          </div>

          <h3 className="s-display mt-3 text-[19px] font-bold leading-tight tracking-tight">{t.title}</h3>
          <p className="mt-1 text-[12.5px] font-bold leading-snug opacity-85">
            {t.lead} {t.perDay.replace('{n}', String(EXAMS_PER_DAY))}.
          </p>

          {/* ── the useful half ─────────────────────────────────────────── */}
          <div className="mt-4 rounded-m3-sm border-2 border-white/20 bg-black/10 px-3 py-2.5">
            {measured ? (
              <>
                <p className="text-[10.5px] font-black uppercase tracking-wider opacity-75">{t.expected}</p>
                <p className="s-num mt-0.5 flex items-baseline gap-1.5 text-[26px] font-black leading-none">
                  {expectedScore(math.theta)}
                  <span className="text-[13px] font-black opacity-75">/ {PAPER_TOTAL}</span>
                  <span className="ml-auto text-[12px] font-black opacity-85">
                    {formatLevel(math.level)}<span className="opacity-70">/{MASTER_LEVEL}</span>
                  </span>
                </p>

                {weakest && (
                  <Link
                    href={`/raschmodel/topic/${weakest.key}`}
                    className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-black opacity-90 hover:opacity-100"
                  >
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full ring-2 ring-white/40"
                      style={{ backgroundColor: weakest.topic.hex }}
                    />
                    <span className="min-w-0 truncate">
                      {t.weakest}: {weakest.topic.label[lang]}
                    </span>
                    <span className="s-num flex-none">{formatLevel(weakest.level)}/{MASTER_LEVEL}</span>
                    <ArrowRight size={13} strokeWidth={3} className="flex-none" />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-[12px] font-bold leading-snug opacity-90">{t.firstTime}</p>
            )}
          </div>

          {/* ⚠️ Two routes, and both are needed: a student sits the SAMPLED paper
              from here, or opens the one their teacher built by code. The code
              screen was previously reachable only from the RASCH sub-nav. */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {/* ⚠️ Locked ⇒ NO <Link> at all. A disabled <Button> inside an anchor
                still navigates on click, which is how a "disabled" CTA lands the
                student on a screen that refuses them. */}
            {quota.allowed || quota.nextAt === null ? (
              <Link href="/raschmodel/exam" className="sm:flex-1">
                <Button
                  fullWidth
                  size="lg"
                  variant="filled"
                  tone="gold"
                  icon={<Play size={17} strokeWidth={3} />}
                  trailingIcon={<ArrowRight size={17} strokeWidth={3} />}
                >
                  {t.start}
                </Button>
              </Link>
            ) : (
              <div className="sm:flex-1">
                <Button
                  fullWidth
                  size="lg"
                  variant="filled"
                  tone="gold"
                  disabled
                  icon={<Timer size={17} strokeWidth={3} />}
                >
                  <span className="s-num">
                    {t.locked.replace('{time}', formatUnlockTime(quota.nextAt, lang))}
                    {' · '}
                    {formatCooldown(quota.msLeft, lang)}
                  </span>
                </Button>
              </div>
            )}
            <Link href="/raschmodel/quiz" className="sm:flex-none">
              <Button
                fullWidth
                size="lg"
                variant="outlined"
                className="border-white/60 text-white"
                icon={<KeyRound size={17} strokeWidth={3} />}
              >
                {t.byCode}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
