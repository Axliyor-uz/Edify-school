// app/(student)/raschmodel/diagnosis/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain, Clock, Gauge, Rocket, Target, Zap, AlertCircle,
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import RaschNav from '../_components/RaschNav';
import { useStudentLanguage } from '../../layout';
import { abilityFor, diagnosticsFor, getRASCHLevels, type AnalysisSource } from '@/services/RASCHProgressService';
import { behaviorTotals, weakestSpots, EXPECTED_SEC } from '@/lib/RASCHdiagnosis';
import { expectedRange } from '@/lib/RASCHtheta';
import {
  Banner, Card, Chip, EmptyState, ErrorState, FilterChip, ListGroup, ListRow,
  LoadingState, Page, PageHeader, Stack, cn, type Status,
} from '@/components/student-ui';
import type { Behavior, RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Bilim tahlili',
    subtitle: 'Nimani bilmaysiz, nimada shoshasiz',
    back: 'Darajam',
    home: 'Bosh sahifa',
    practice: 'Zaif mavzularni mashq qilish',
    ability: 'Qobiliyat (Rasch)',
    abilityHint: 'Standart variantdagi kutilayotgan natija.',
    items: 'ta savol asosida',
    behavior: 'Javob berish uslubi',
    solid: 'Mustahkam',
    fragile: 'Sekin, lekin to‘g‘ri',
    guess: 'Shoshilib xato',
    gap: 'Bilim bo‘shlig‘i',
    skipped: 'Belgilanmagan',
    solidHint: 'To‘g‘ri va tez — bu mavzu sizda mustahkam.',
    fragileHint: 'To‘g‘ri, lekin sekin. Imtihon vaqtida yetkazmasligingiz mumkin.',
    guessHint: 'Xato va juda tez — o‘qimasdan tanlangan. Bu — shoshilish muammosi, bilim emas.',
    gapHint: 'Xato, lekin vaqt sarflangan — haqiqiy bilim bo‘shlig‘i. Aynan shuni o‘rganish kerak.',
    weakest: 'Eng zaif mavzular',
    weakestHint: 'Kamida 2 marta uchragan mavzular. Eng zaifi birinchi.',
    noData: 'Hali yetarli ma‘lumot yo‘q. Test topshiring — har bir savol vaqti bilan tahlil qilinadi.',
    startExam: 'Testni boshlash',
    avgTime: 'o‘rtacha',
    budget: 'me‘yor',
    loading: 'Yuklanmoqda…',
    error: 'Ma‘lumotlarni yuklab bo‘lmadi',
    signIn: 'Tahlilni ko‘rish uchun tizimga kiring',
    pacing: 'Shoshilish muammosi',
    pacingHint: 'Xatolaringizning ko‘pi shoshilishdan. Sekinroq o‘qing — bilimingiz bundan yuqori.',
    knowledge: 'Bilim muammosi',
    knowledgeHint: 'Xatolaringiz o‘ylab ishlanganidan keyin. Bu — o‘rganish kerak bo‘lgan mavzular.',
    srcAll: 'Hammasi', srcExam: 'Testlar', srcPractice: 'Mashqlar',
    srcHint: 'Test — vaqt bosimi ostida. Mashq — erkin. Ular alohida o‘lchanadi.',
    noSource: 'Bu bo‘limda hali ma‘lumot yo‘q.',
    mastery: 'O‘zlashtirish',
    masteryHint: 'Bilim ehtimoli (BKT) — ball emas, bilim.',
  },
  ru: {
    title: 'Анализ знаний',
    subtitle: 'Что вы не знаете, а где просто спешите',
    back: 'Мой уровень',
    home: 'Главная',
    practice: 'Тренировать слабые темы',
    ability: 'Способность (Rasch)',
    abilityHint: 'Ожидаемый результат на стандартном варианте.',
    items: 'на основе вопросов',
    behavior: 'Как вы отвечаете',
    solid: 'Уверенно',
    fragile: 'Медленно, но верно',
    guess: 'Поспешная ошибка',
    gap: 'Пробел в знаниях',
    skipped: 'Без ответа',
    solidHint: 'Верно и быстро — тема освоена.',
    fragileHint: 'Верно, но медленно. На экзамене может не хватить времени.',
    guessHint: 'Неверно и очень быстро — выбрано не читая. Это проблема темпа, а не знаний.',
    gapHint: 'Неверно, но время потрачено — настоящий пробел. Именно это и нужно учить.',
    weakest: 'Самые слабые темы',
    weakestHint: 'Темы, встреченные минимум 2 раза. Самая слабая — первая.',
    noData: 'Пока недостаточно данных. Пройдите тест — каждый вопрос анализируется вместе со временем.',
    startExam: 'Начать тест',
    avgTime: 'в среднем',
    budget: 'норма',
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные',
    signIn: 'Войдите, чтобы увидеть анализ',
    pacing: 'Проблема темпа',
    pacingHint: 'Большинство ошибок — от спешки. Читайте медленнее: вы знаете больше, чем показываете.',
    knowledge: 'Проблема знаний',
    knowledgeHint: 'Ошибки после реальных усилий. Это темы, которые нужно учить.',
    srcAll: 'Всё', srcExam: 'Тесты', srcPractice: 'Тренировки',
    srcHint: 'Тест — под давлением времени. Тренировка — свободно. Измеряются отдельно.',
    noSource: 'В этом разделе пока нет данных.',
    mastery: 'Освоение',
    masteryHint: 'Вероятность знания (BKT) — не балл, а знание.',
  },
  en: {
    title: 'Knowledge analysis',
    subtitle: "What you don't know, versus what you rush",
    back: 'My level',
    home: 'Home',
    practice: 'Practise weak spots',
    ability: 'Ability (Rasch)',
    abilityHint: "Expected score on a standard paper.",
    items: 'based on questions',
    behavior: 'How you answer',
    solid: 'Solid',
    fragile: 'Slow but right',
    guess: 'Rushed error',
    gap: 'Knowledge gap',
    skipped: 'Unanswered',
    solidHint: 'Right and brisk — this is secure.',
    fragileHint: "Right, but slow. Under exam time pressure this is where you'll run out.",
    guessHint: 'Wrong and very fast — answered without reading. A pacing problem, not a knowledge one.',
    gapHint: 'Wrong after real effort — a genuine gap. This is what to study.',
    weakest: 'Weakest subtopics',
    weakestHint: 'Subtopics you have met at least twice. Weakest first.',
    noData: 'Not enough data yet. Sit an exam — every question is analysed together with its timing.',
    startExam: 'Start an exam',
    avgTime: 'avg',
    budget: 'budget',
    loading: 'Loading…',
    error: 'Could not load your analysis',
    signIn: 'Sign in to see your analysis',
    pacing: 'A pacing problem',
    pacingHint: "Most of your errors are rushed. Slow down — you know more than your score shows.",
    knowledge: 'A knowledge problem',
    knowledgeHint: 'Your errors come after real effort. These are the topics to study.',
    srcAll: 'All', srcExam: 'Exams', srcPractice: 'Practice',
    srcHint: 'An exam is timed and pressured; practice is not. They are measured separately.',
    noSource: 'No data in this view yet.',
    mastery: 'Mastery',
    masteryHint: 'P(knows it) from BKT — knowledge, not a score.',
  },
};

/** Each behaviour's semantic role. `bar` is the token the stacked bar paints
 *  with, so the split follows the palette in both light and dark mode. */
const BEHAVIOR_STYLE: Record<Behavior, { status: Status; tile: string; bar: string; icon: React.ElementType }> = {
  solid: { status: 'success', tile: 'bg-success-container text-on-success-container', bar: 'var(--m3-success)', icon: Target },
  fragile: { status: 'warning', tile: 'bg-warning-container text-on-warning-container', bar: 'var(--m3-warning)', icon: Clock },
  guess: { status: 'info', tile: 'bg-secondary-container text-on-secondary-container', bar: 'var(--m3-secondary)', icon: Zap },
  gap: { status: 'error', tile: 'bg-error-container text-on-error-container', bar: 'var(--m3-error)', icon: Brain },
  skipped: { status: 'neutral', tile: 'bg-surface-container-high text-on-surface-variant', bar: 'var(--m3-outline)', icon: AlertCircle },
};

/** Link that carries a Button's shape without nesting a <button> in an <a>. */
function NavLink({
  href, tone = 'outlined', className, children,
}: {
  href: string;
  tone?: 'outlined' | 'filled';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-m3-btn px-4',
        'text-[13px] font-extrabold leading-none s-press',
        tone === 'filled'
          ? 'bg-primary text-on-primary'
          : 'border-[1.5px] border-outline text-on-surface-variant hover:bg-state-hover',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export default function DiagnosisPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Exam and practice are kept apart in storage and merged only for the "all"
  // view — an exam is timed and high-stakes, practice is not, and pooling them
  // would quietly flatter the exam picture.
  const [source, setSource] = useState<AnalysisSource>('all');

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    getRASCHLevels(user.uid)
      .then((next) => {
        if (cancelled) return;
        setLevels(next);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        console.error('[RASCH] diagnosis load failed', err);
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  const diagnostics = useMemo(() => diagnosticsFor(levels, source), [levels, source]);
  const weak = useMemo(() => weakestSpots(diagnostics, { minSeen: 2, limit: 8 }), [diagnostics]);
  const totals = useMemo(() => behaviorTotals(diagnostics), [diagnostics]);
  const answered = totals.solid + totals.fragile + totals.guess + totals.gap;
  const ability = abilityFor(levels, source);
  const range = ability ? expectedRange(ability) : null;

  const hasPractice = (levels?.abilityPractice?.items ?? 0) > 0;

  if (authLoading || status === 'loading') {
    return (
      <Page>
        <LoadingState label={t.loading} />
      </Page>
    );
  }
  if (!user) {
    return (
      <Page>
        <EmptyState icon="🔐" title={t.signIn} />
      </Page>
    );
  }
  if (status === 'error' || !levels) {
    return (
      <Page>
        <ErrorState title={t.error} />
      </Page>
    );
  }

  // The single most useful sentence we can say: is this a pacing problem or a
  // knowledge problem? They look identical on a score sheet and need opposite fixes.
  const verdict = totals.guess > totals.gap ? 'pacing' : totals.gap > 0 ? 'knowledge' : null;

  return (
    <Page>
      <RaschNav lang={lang} />
      <Stack>
        <PageHeader title={t.title} subtitle={t.subtitle} className="pb-0" />

        {/* Source: exams and practice are different evidence, so they are
            measured separately — and merged only here, on demand. */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', t.srcAll],
              ['exam', t.srcExam],
              ['practice', t.srcPractice],
            ] as [AnalysisSource, string][]).map(([key, label]) => (
              <FilterChip
                key={key}
                selected={source === key}
                onClick={() => setSource(key)}
                disabled={key === 'practice' && !hasPractice}
                className="disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg"
              >
                {label}
              </FilterChip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] font-bold text-on-surface-variant">{t.srcHint}</p>
        </div>

        {answered === 0 ? (
          <Card>
            <EmptyState
              icon="📊"
              title={source === 'all' ? t.noData : t.noSource}
              action={
                <NavLink href="/raschmodel/exam" tone="filled">
                  <Rocket size={16} strokeWidth={3} /> {t.startExam}
                </NavLink>
              }
            />
          </Card>
        ) : (
          <>
            {/* Rasch ability — the draw-independent number */}
            {ability && ability.items > 0 && (
              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <Gauge size={16} strokeWidth={3} className="text-primary" />
                  <h2 className="s-display text-[15px] font-bold">{t.ability}</h2>
                  <span className="ml-auto text-[11px] font-bold text-on-surface-variant">
                    {ability.items} {t.items}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-5">
                  <div>
                    <p className="s-display s-num text-5xl font-bold leading-none tracking-tight text-primary">
                      {ability.expected}%
                    </p>
                    {range && (
                      <p className="s-num mt-2 text-[12px] font-black text-on-surface-variant">
                        {range.low}% – {range.high}%
                      </p>
                    )}
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <p className="text-[12px] font-bold leading-relaxed text-on-surface-variant">{t.abilityHint}</p>
                    <p className="s-num mt-1 text-[11px] font-black text-outline">
                      θ = {ability.theta.toFixed(2)} ± {ability.se.toFixed(2)} logit
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* The verdict: pacing vs knowledge */}
            {verdict && (
              <Banner
                status={verdict === 'pacing' ? 'info' : 'error'}
                title={verdict === 'pacing' ? t.pacing : t.knowledge}
                description={verdict === 'pacing' ? t.pacingHint : t.knowledgeHint}
              />
            )}

            {/* Behaviour split */}
            <Card>
              <h2 className="s-display mb-4 text-[15px] font-bold">{t.behavior}</h2>

              {/* One bar, to scale — the shape of the problem at a glance */}
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-container-highest">
                {(['solid', 'fragile', 'guess', 'gap'] as Behavior[]).map((b) =>
                  totals[b] > 0 ? (
                    <div
                      key={b}
                      style={{ width: `${(totals[b] / answered) * 100}%`, backgroundColor: BEHAVIOR_STYLE[b].bar }}
                      title={`${t[b]}: ${totals[b]}`}
                    />
                  ) : null,
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(['gap', 'guess', 'fragile', 'solid'] as Behavior[]).map((b) => {
                  const style = BEHAVIOR_STYLE[b];
                  const Icon = style.icon;
                  return (
                    <div key={b} className={cn('flex items-start gap-2.5 rounded-m3-md p-3', style.tile)}>
                      <Icon size={16} strokeWidth={3} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-black">
                          {t[b]} <span className="s-num text-[15px]">{totals[b]}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] font-bold leading-snug opacity-80">
                          {t[`${b}Hint`]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Weakest subtopics */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="s-display text-[15px] font-bold">{t.weakest}</h2>
                <span className="text-[11px] font-bold text-on-surface-variant">{t.weakestHint}</span>
              </div>

              {weak.length === 0 ? (
                <Card>
                  <p className="text-[13px] font-bold text-on-surface-variant">{t.noData}</p>
                </Card>
              ) : (
                <ListGroup>
                  {weak.map((spot, i) => {
                    const budget = EXPECTED_SEC[2];
                    const masteryPct = Math.round(spot.mastery * 100);
                    return (
                      <motion.div
                        key={spot.key}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.04 }}
                      >
                        <ListRow
                          leading={
                            <span className="s-num grid h-7 w-7 shrink-0 place-items-center rounded-m3-xs bg-surface-container-high text-[11px] font-black text-on-surface-variant">
                              {i + 1}
                            </span>
                          }
                          title={spot.subtopicName || spot.chapterName}
                          subtitle={`${spot.chapterName} · ${t.avgTime} ${spot.avgSec}s (${t.budget} ${budget}s)`}
                          trailing={
                            <div className="flex shrink-0 items-center gap-3">
                              <Chip status={BEHAVIOR_STYLE[spot.dominant].status}>{t[spot.dominant]}</Chip>

                              {/* BKT mastery — what they KNOW, as opposed to what they scored */}
                              <div className="hidden w-16 sm:block" title={t.masteryHint}>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-black uppercase text-on-surface-variant">{t.mastery}</span>
                                  <span className="s-num text-[11px] font-black">{masteryPct}%</span>
                                </div>
                                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${masteryPct}%`,
                                      backgroundColor:
                                        spot.mastery >= 0.7 ? 'var(--m3-success)'
                                          : spot.mastery >= 0.4 ? 'var(--m3-warning)'
                                            : 'var(--m3-error)',
                                    }}
                                  />
                                </div>
                              </div>

                              <span className="s-num w-12 text-right text-[14px] font-black">
                                {spot.correct}/{spot.seen}
                              </span>
                            </div>
                          }
                        />
                      </motion.div>
                    );
                  })}
                </ListGroup>
              )}
            </div>
          </>
        )}
      </Stack>
    </Page>
  );
}
