// app/(student)/raschmodel/progress/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, Rocket, Sliders, ChevronDown, Crosshair, Brain, Hexagon } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import ChartFrame from '@/components/ChartFrame';
import RaschNav from '../_components/RaschNav';
import { BAND_TONE, LevelCard } from '../_components/LevelBadge';
import { getRASCHLevels, saveBaseline } from '@/services/RASCHProgressService';
import { DEFAULT_BASELINE, LEVEL_WINDOW, overallLevel } from '@/lib/RASCHlevels';
import { RASCH_TOPICS, TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import { setSolvedUser, solvedForSkill } from '@/lib/RASCHsolved';
import QuestionReview from './_components/QuestionReview';
import { forecastOverall, type Forecast } from '@/lib/RASCHforecast';
import {
  learningPicture, dimensions, overallTheta, chapterLevels, mathLevel, dimensionSkills, skillPicture,
  type Dimension, type TopicSection, type DimensionSkill, type DimensionSkills,
} from '@/services/RASCHProgressService';
import { skill as skillMeta, relatedSkills, type SkillStat } from '@/lib/RASCHskills';
import { formatLevel, levelBand, MASTER_LEVEL } from '@/lib/RASCHscale';
import { daysToTarget, type LearningRate, type ScorePrediction } from '@/lib/RASCHdynamic';
import {
  Button, Card, Chip, EmptyState, ErrorState, FilterChip, LoadingState,
  Page, PageHeader, Slider, Stack, cn,
} from '@/components/student-ui';
import type { RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Mening darajam',
    subtitle: 'Oxirgi 5 ta test bo\'yicha',
    setupTitle: 'Boshlang\'ich darajangizni tanlang',
    setupHint: 'Hozirgi darajangizni belgilang — har bir testdan keyin o\'zgaradi.',
    save: 'Saqlash va boshlash',
    saving: 'Saqlanmoqda…',
    overall: 'Umumiy',
    level: 'Daraja',
    noExams: 'Hali test topshirmadingiz. Birinchi testdan so\'ng grafik paydo bo\'ladi.',
    startExam: 'Testni boshlash',
    examsTaken: 'ta test topshirilgan',
    chartTitle: 'Testdan testga natijalar',
    chartHint: 'Mavzuni qo\'shish uchun bosing',
    exam: 'Test',
    baseline: 'Boshlang\'ich',
    editBaseline: 'Boshlang\'ich darajani o\'zgartirish',
    loading: 'Yuklanmoqda…',
    error: 'Ma\'lumotlarni yuklab bo\'lmadi',
    errorRules: 'Ruxsat yo\'q (permission-denied). Administrator Firestore qoidalarini joylashi kerak: firebase deploy --only firestore:rules',
    signIn: 'Darajangizni ko\'rish uchun tizimga kiring',
    home: 'Bosh sahifa',
    newTest: 'Yangi test',
    diagnosis: 'Bilim tahlili',
    forecastTitle: 'Keyingi test bashorati',
    expectedRange: 'Kutilayotgan oraliq',
    confLow: 'past ishonch',
    confMedium: "o'rtacha ishonch",
    confHigh: 'yuqori ishonch',
    confNone: "ma'lumot yo'q",
    forecastNoData: 'Bashorat uchun kamida 2 ta test kerak.',
    forecastNote: "Taxmin, kafolat emas — oraliq keng bo'lsa, noaniqlik yuqori.",
    predicted: 'Bashorat',
    bandolympiad: "Olimpiada",
    bandhard: "Qiyin",
    bandmedium: "O'rta",
    bandeasy: "Oson",
    bandsimple: "Oddiy",
    bandbeginner: "Boshlang'ich",
    chaptersHint: "Uchramagan mavzu 0 emas — o'lchanmagan.",
    notMet: "Uchramagan",
    chaptersTitle: "Mavzular bo'yicha daraja",
    scaleHint: "5 balldan: siz 80% ishonch bilan yechadigan masala qiyinligi.",
    solves: "masalalarni yechadi",
    ofOlympic: "olimpiada",
    ofMedium: "o'rta",
    ofEasy: "oson",
    levelMeans: "Bu nimani anglatadi",
    ofMaster: "master",
    mathLevel: "Matematika darajangiz",
    overallTheta: "Umumiy qobiliyat",
    hepEmpty: "Test topshiring — 7 o'lcham shundan keyin ko'rinadi.",
    hepHint: "Har bir o'lcham — alohida qobiliyat (θ); test va mashq uni o'zgartiradi.",
    skillsShort: "ko'nikma",
    skillsCollected: "ko'nikma to'plangan",
    skillsDeveloped: 'tasi rivojlangan',
    skillShared: "Shuningdek",
    skillRelated: "Yonma-yon uchraydi",
    skillPractice: "Shu ko'nikmani mashq qilish",
    skillWrong: "Xato yechilgan",
    skillCorrect: "To'g'ri yechilgan",
    skillNoQuestions: "Bu ko'nikma bo'yicha shu qurilmada saqlangan savol yo'q.",
    scopeLast: "Oxirgi test",
    scopeAll: "Barchasi",
    showMore: "Yana ko'rsatish",
    yourAnswer: 'Sizning javobingiz',
    correctAnswer: "To'g'ri javob",
    notAnswered: 'Javob berilmagan',
    noExplanation: "Bu savol uchun izoh kiritilmagan.",
    fromExam: 'Test',
    fromPractice: 'Mashq',
    skillHint: "O'lchamni bosing — ko'nikmalari ochiladi. Ko'nikma mavzudan mustaqil.",
    skillPanelTitle: "Ko'nikmalar",
    skillPanelHint: "Har bir test ko'nikmalarning bir qismini o'lchaydi.",
    skillCoverage: 'qamrov',
    skillWeakest: 'Eng zaif ko\'nikmalar',
    skillNone: "Test topshiring — ko'nikmalar shundan keyin aniqlanadi.",
    hepBefore: "Oldingi",
    hepNow: "Hozir",
    heptagon: "Matematika qobiliyati — 7 o'lcham",
    raschTitle: 'Keyingi test bashorati (Rasch)',
    raschNow: 'Hozirgi qobiliyat',
    raschIn2w: '2 haftadan keyin',
    raschRate: "O'sish tezligi",
    perWeek: 'logit/hafta',
    raschHow: "Kutilayotgan ball — P(to'g'ri) = σ(θ − b) yig'indisi.",
    toTarget: '75% ga yetish uchun',
    days: 'kun',
    noRate: "O'sish tezligi hali o'lchanmagan — kamida 2 ta test kerak.",
    notImproving: "Hozirgi sur'atda 75% ga yetib bo'lmaydi.",
  },
  ru: {
    title: 'Мой уровень',
    subtitle: 'Уровень по каждой теме — среднее из последних 5 тестов',
    setupTitle: 'Выберите начальный уровень',
    setupHint: 'Укажите текущий уровень — после каждого теста он меняется.',
    save: 'Сохранить и начать',
    saving: 'Сохранение…',
    overall: 'Общий',
    level: 'Уровень',
    noExams: 'Вы ещё не проходили тест. График появится после первого теста.',
    startExam: 'Начать тест',
    examsTaken: 'тестов пройдено',
    chartTitle: 'Результаты от теста к тесту',
    chartHint: 'Нажмите, чтобы добавить тему',
    exam: 'Тест',
    baseline: 'Начальный',
    editBaseline: 'Изменить начальный уровень',
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные',
    errorRules: 'Нет доступа (permission-denied). Администратору нужно развернуть правила Firestore: firebase deploy --only firestore:rules',
    signIn: 'Войдите, чтобы увидеть свой уровень',
    home: 'Главная',
    newTest: 'Новый тест',
    diagnosis: 'Анализ знаний',
    forecastTitle: 'Прогноз следующего теста',
    expectedRange: 'Ожидаемый диапазон',
    confLow: 'низкая уверенность',
    confMedium: 'средняя уверенность',
    confHigh: 'высокая уверенность',
    confNone: 'нет данных',
    forecastNoData: 'Для прогноза нужно минимум 2 теста.',
    forecastNote: 'Оценка, а не гарантия: шире диапазон — больше неопределённость.',
    predicted: 'Прогноз',
    bandolympiad: "Олимпиадный",
    bandhard: "Сложный",
    bandmedium: "Средний",
    bandeasy: "Лёгкий",
    bandsimple: "Простой",
    bandbeginner: "Начальный",
    chaptersHint: "Не встреченная глава — не 0, а «не измерено».",
    notMet: "Не встречалось",
    chaptersTitle: "Уровень по главам",
    scaleHint: "Из 5: сложность задач, которые вы решаете надёжно (80%).",
    solves: "задач решает",
    ofOlympic: "олимпиадных",
    ofMedium: "средних",
    ofEasy: "лёгких",
    levelMeans: "Что это значит",
    ofMaster: "мастер",
    mathLevel: "Ваш уровень по математике",
    overallTheta: "Общая способность",
    hepEmpty: "Пройдите тест — тогда появятся 7 измерений.",
    hepHint: "Каждое измерение — своя способность (θ); тесты и тренировки её двигают.",
    skillsShort: 'навыков',
    skillsCollected: 'навыков собрано',
    skillsDeveloped: 'развито',
    skillShared: 'Также в',
    skillRelated: 'Встречается рядом с',
    skillPractice: 'Тренировать этот навык',
    skillWrong: 'Решено неверно',
    skillCorrect: 'Решено верно',
    skillNoQuestions: 'По этому навыку на устройстве нет сохранённых вопросов.',
    scopeLast: 'Последний тест',
    scopeAll: 'Все',
    showMore: 'Показать ещё',
    yourAnswer: 'Ваш ответ',
    correctAnswer: 'Правильный ответ',
    notAnswered: 'Нет ответа',
    noExplanation: 'Для этого вопроса объяснение не добавлено.',
    fromExam: 'Тест',
    fromPractice: 'Тренировка',
    skillHint: 'Нажмите на измерение — раскроются навыки. Навык не привязан к теме.',
    skillPanelTitle: 'Навыки',
    skillPanelHint: 'Каждый тест измеряет часть навыков.',
    skillCoverage: 'охват',
    skillWeakest: 'Самые слабые навыки',
    skillNone: 'Пройдите тест — навыки определятся после него.',
    hepBefore: "Раньше",
    hepNow: "Сейчас",
    heptagon: "Способность по математике — 7 измерений",
    raschTitle: 'Прогноз следующего теста (Rasch)',
    raschNow: 'Способность сейчас',
    raschIn2w: 'Через 2 недели',
    raschRate: 'Скорость роста',
    perWeek: 'логит/неделя',
    raschHow: 'Ожидаемый балл — сумма P(верно) = σ(θ − b) по вопросам.',
    toTarget: 'До 75%',
    days: 'дней',
    noRate: 'Скорость роста ещё не измерена — нужно минимум 2 теста.',
    notImproving: 'При текущем темпе 75% не достигается.',
  },
  en: {
    title: 'My level',
    subtitle: 'Your level per topic is the mean of your last 5 exams',
    setupTitle: 'Choose your starting level',
    setupHint: 'Set where you are today — every exam moves it from there.',
    save: 'Save and start',
    saving: 'Saving…',
    overall: 'Overall',
    level: 'Level',
    noExams: 'No exams yet. The chart appears after your first one.',
    startExam: 'Start a test',
    examsTaken: 'exams taken',
    chartTitle: 'Exam by exam',
    chartHint: 'Tap to add a topic',
    exam: 'Exam',
    baseline: 'Baseline',
    editBaseline: 'Change starting level',
    loading: 'Loading…',
    error: 'Could not load your progress',
    errorRules: 'Permission denied. The Firestore rules for RASCH_levels are not deployed yet: firebase deploy --only firestore:rules',
    signIn: 'Sign in to see your level',
    home: 'Home',
    newTest: 'New test',
    diagnosis: 'Knowledge analysis',
    forecastTitle: 'Next exam forecast',
    expectedRange: 'Likely range',
    confLow: 'low confidence',
    confMedium: 'medium confidence',
    confHigh: 'high confidence',
    confNone: 'no data',
    forecastNoData: 'A forecast needs at least 2 exams.',
    forecastNote: 'An estimate, not a promise — a wider range means less certainty.',
    predicted: 'Forecast',
    bandolympiad: "Olympiad",
    bandhard: "Hard",
    bandmedium: "Medium",
    bandeasy: "Easy",
    bandsimple: "Simple",
    bandbeginner: "Beginner",
    chaptersHint: "A chapter you haven't met is unmeasured, not 0.",
    notMet: "Not met yet",
    chaptersTitle: "Level by chapter",
    scaleHint: "Out of 5: the difficulty you solve dependably (80%).",
    solves: "problems solved",
    ofOlympic: "olympiad",
    ofMedium: "medium",
    ofEasy: "easy",
    levelMeans: "What this means",
    ofMaster: "master",
    mathLevel: "Your mathematics level",
    overallTheta: "Overall ability",
    hepEmpty: "Sit an exam — the seven dimensions appear after that.",
    hepHint: "Each axis is its own ability (θ), moved by every exam and drill.",
    skillsShort: 'skills',
    skillsCollected: 'skills collected',
    skillsDeveloped: 'developed',
    skillShared: 'Also in',
    skillRelated: 'Met alongside',
    skillPractice: 'Practise this skill',
    skillWrong: 'Answered wrong',
    skillCorrect: 'Answered right',
    skillNoQuestions: 'No questions for this skill are stored on this device.',
    scopeLast: 'Last exam',
    scopeAll: 'All',
    showMore: 'Show more',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    notAnswered: 'Not answered',
    noExplanation: 'No explanation was written for this question.',
    fromExam: 'Exam',
    fromPractice: 'Drill',
    skillHint: 'Tap a dimension to open its skills. A skill is content-free.',
    skillPanelTitle: 'Skills',
    skillPanelHint: 'Each paper measures a slice of the skills.',
    skillCoverage: 'coverage',
    skillWeakest: 'Weakest skills',
    skillNone: 'Take a test — skills are detected from it.',
    hepBefore: "Previous",
    hepNow: "Now",
    heptagon: "Mathematics ability — 7 dimensions",
    raschTitle: 'Next exam forecast (Rasch)',
    raschNow: 'Ability now',
    raschIn2w: 'In 2 weeks',
    raschRate: 'Learning rate',
    perWeek: 'logits/week',
    raschHow: 'Expected score = the sum of P(correct) = σ(θ − b) over the items.',
    toTarget: 'To reach 75%',
    days: 'days',
    noRate: 'No learning rate yet — that needs at least 2 exams.',
    notImproving: 'Not on track for 75% at the current rate.',
  },
};

/** The overall reference line — deliberately neutral, so the seven topic hues
 *  read as the data and this reads as the baseline. */
const OVERALL_STROKE = 'var(--m3-on-surface)';

/** Chart ink, pinned to palette tokens so every plot follows light/dark mode. */
const AXIS_INK = 'var(--m3-on-surface-variant)';
const FAINT_INK = 'var(--m3-outline)';
const GRID_INK = 'var(--m3-outline-variant)';
const ACCENT = 'var(--m3-primary)';

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: `1px solid ${GRID_INK}`,
  backgroundColor: 'var(--m3-surface-container-high)',
  color: 'var(--m3-on-surface)',
  fontSize: 12,
  fontWeight: 700,
} as const;

/** The 0–5 band scale, mapped onto the palette's semantic roles: an ordinal
 *  ramp from "unmeasured grey" up to gold at olympiad. */
/** Firebase throws a typed error; the only one that realistically lands here is
 *  permission-denied, which means the RASCH_levels rules are not deployed. */
function describeError(err: unknown, t: Record<string, string>): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return t.errorRules;
  if (err instanceof Error && err.message) return err.message;
  return t.error;
}

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

// ─── Next-exam forecast ───────────────────────────────────────────────────
function ForecastCard({ f, t }: { f: Forecast; t: Record<string, string> }) {
  const confLabel =
    f.confidence === 'high' ? t.confHigh
      : f.confidence === 'medium' ? t.confMedium
        : f.confidence === 'low' ? t.confLow
          : t.confNone;

  const tone =
    f.direction === 'up' ? 'text-success'
      : f.direction === 'down' ? 'text-error'
        : 'text-on-surface-variant';

  const Icon = f.direction === 'up' ? TrendingUp : f.direction === 'down' ? TrendingDown : Minus;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Crosshair size={16} strokeWidth={3} className="text-primary" />
        <h2 className="s-display text-[15px] font-bold">{t.forecastTitle}</h2>
        <span className="ml-auto text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{confLabel}</span>
      </div>

      {f.confidence === 'none' ? (
        <p className="text-[13px] font-bold text-on-surface-variant">{t.forecastNoData}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="s-display s-num text-4xl font-bold leading-none tracking-tight text-primary">{f.expected}%</p>
              <p className={cn('s-num mt-2 flex items-center gap-1 text-[12px] font-black', tone)}>
                <Icon size={13} strokeWidth={3} />
                {f.slope > 0 ? '+' : ''}{f.slope} / {t.exam.toLowerCase()}
              </p>
            </div>

            <div className="min-w-[180px] flex-1">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                {t.expectedRange}
              </p>
              {/* The band, drawn to scale on a 0–100 track — the width IS the uncertainty */}
              <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="absolute h-full bg-primary-container"
                  style={{ left: `${f.low}%`, width: `${Math.max(1, f.high - f.low)}%` }}
                />
                <div
                  className="absolute h-full w-1 rounded-full bg-primary"
                  style={{ left: `calc(${f.expected}% - 2px)` }}
                />
              </div>
              <p className="s-num mt-1.5 text-[13px] font-black">{f.low}% – {f.high}%</p>
            </div>
          </div>

          <p className="mt-4 border-t border-outline-variant pt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">
            {t.forecastNote}
          </p>
        </>
      )}
    </Card>
  );
}


// ─── Level in each of the 29 chapters ─────────────────────────────────────
function ChapterLevels({ sections, t }: { sections: TopicSection[]; t: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="s-display mb-1 text-[15px] font-bold">{t.chaptersTitle}</h2>
      <p className="mb-4 text-[11px] font-bold text-on-surface-variant">{t.chaptersHint}</p>

      <div className="flex flex-col gap-3">
        {sections.map((section) => {
          const isOpen = open === section.topicId;
          return (
            <div key={section.topicId} className="overflow-hidden rounded-m3-md border border-outline-variant">
              <button
                onClick={() => setOpen(isOpen ? null : section.topicId)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-m3-fast ease-m3-std hover:bg-state-hover"
              >
                <span className="flex-1 text-[14px] font-black">{section.name}</span>
                {section.level !== null && (
                  <Chip status={BAND_TONE[levelBand(section.level)].chip} className="s-num">
                    {formatLevel(section.level)}
                  </Chip>
                )}
                <ChevronDown
                  size={16}
                  strokeWidth={3}
                  className={cn('text-on-surface-variant transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1 px-3 pb-3">
                  {section.chapters.map((chapter, i) => {
                    const measured = chapter.level !== null;
                    const color = measured ? BAND_TONE[levelBand(chapter.level!)].color : GRID_INK;
                    return (
                      <div
                        key={chapter.chapterId}
                        className={cn('flex items-center gap-2.5 rounded-m3-sm px-2.5 py-2', !measured && 'opacity-50')}
                      >
                        <span className="s-num w-5 shrink-0 text-right text-[10px] font-black text-on-surface-variant">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-on-surface-variant">{chapter.name}</span>

                        {measured ? (
                          <>
                            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-container-highest">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${(chapter.level! / MASTER_LEVEL) * 100}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="s-num w-9 shrink-0 text-right text-[12px] font-black" style={{ color }}>
                              {formatLevel(chapter.level!)}
                            </span>
                            <span className="s-num w-10 shrink-0 text-right text-[10px] font-black text-on-surface-variant">
                              {chapter.correct}/{chapter.seen}
                            </span>
                          </>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold text-on-surface-variant">{t.notMet}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── One skill row inside a dimension ─────────────────────────────────────
// A skill is content-free ("solving an inequality"), so the same row can be fed
// by logarithmic, trigonometric and modular items at once. When it is, the
// cross-links say which other dimensions the evidence came from — that sharing
// is the point of the axis, not an artefact to hide.
function SkillRow({
  s, dim, lang, t, onJump,
}: {
  s: DimensionSkill;
  dim: TopicKey;
  lang: Lang;
  t: Record<string, string>;
  /** Opens another dimension — how a cross-dimension link is actually followed. */
  onJump: (dim: TopicKey) => void;
}) {
  const meta = skillMeta(s.key);
  const measured = s.level !== null;
  const color = measured ? BAND_TONE[levelBand(s.level!)].color : undefined;

  const [open, setOpen] = useState(false);
  const related = useMemo(() => (open ? relatedSkills(s.key, 4) : []), [open, s.key]);
  // Stable identity: QuestionReview memoizes on it, and a fresh closure every
  // render would re-read the archive on every keystroke elsewhere on the page.
  const load = useCallback((scope: 'last' | 'all') => solvedForSkill(s.key, { scope }), [s.key]);

  return (
    <div className={cn('rounded-m3-sm', open && 'bg-surface-container-high')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-m3-sm px-2.5 py-2 text-left',
          'transition-colors duration-m3-fast hover:bg-state-hover',
          !measured && 'opacity-55',
        )}
      >
        <span
          className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', measured ? '' : 'bg-outline-variant')}
          style={measured ? { backgroundColor: color } : undefined}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight text-on-surface">
            {meta?.label[lang] ?? s.key}
            {!s.homed && (
              // A visiting skill is listed here because this dimension's chapters
              // feed it, but it is owned by another dimension — say so, or the same
              // name appearing twice reads as a duplicate.
              <span className="ml-1.5 text-[10px] font-black text-on-surface-variant">
                ↗ {topicLabelShort(s.home, lang)}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-on-surface-variant">
            {meta?.blurb[lang]}
          </p>
        </div>

        {measured ? (
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.level! / MASTER_LEVEL) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="s-num w-9 text-right text-[12px] font-black" style={{ color }}>
              {formatLevel(s.level!)}
            </span>
            <span className="s-num w-11 text-right text-[10px] font-black text-on-surface-variant">
              {s.correct}/{s.seen}
            </span>
          </div>
        ) : (
          <span className="shrink-0 text-[10px] font-bold text-on-surface-variant">{t.notMet}</span>
        )}

        <ChevronDown
          size={13}
          strokeWidth={3}
          className={cn('mt-0.5 shrink-0 text-outline transition-transform duration-m3-fast', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-outline-variant px-2.5 pb-3 pt-2">
          {/* ── Cross-dimension relations ───────────────────────────────── */}
          {s.otherDims.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                {t.skillShared}
              </span>
              {s.otherDims.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onJump(d)}
                  className="rounded-full border-[1.5px] border-outline px-2 py-0.5 text-[10px] font-black text-on-surface-variant s-press hover:bg-state-hover hover:text-primary"
                >
                  {topicLabelShort(d, lang)}
                </button>
              ))}
            </div>
          )}

          {/* Skills met in the SAME chapters — "you meet these together". Not
              "skills in this dimension": algebraic lists sixteen, which says
              nothing. Sharing a chapter is a checkable relationship. */}
          {related.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                {t.skillRelated}
              </span>
              {related.map((r) => (
                <span
                  key={r.key}
                  className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-black text-on-surface-variant"
                >
                  {skillMeta(r.key)?.label[lang] ?? r.key}
                </span>
              ))}
            </div>
          )}

          {/* ── The questions this skill was measured on ─────────────────── */}
          <QuestionReview
            load={load}
            lang={lang}
            t={t}
            practiceHref={`/raschmodel/practice?${new URLSearchParams({ skill: s.key, dim }).toString()}`}
          />
        </div>
      )}
    </div>
  );
}


/** The one-word axis label — the same shortening the radar uses. */
function topicLabelShort(key: TopicKey, lang: Lang): string {
  return (RASCH_TOPICS.find((tp) => tp.key === key)?.label[lang] ?? key).split(/[ ,(]/)[0];
}

// ─── The ability heptagon ─────────────────────────────────────────────────
// Seven dimensions, one shape. Mathematics ability is not a single number: a
// student can be climbing in geometry while sliding in trigonometry, and one θ
// averages exactly that away. Two polygons are drawn — now, and the previous
// sitting — so the chart shows MOVEMENT per dimension, not just a profile.
//
// Each axis then OPENS: a dimension is a bag of content, and what a student can
// actually DO lives one level down, in the content-free skills that dimension
// exercises (lib/RASCHskills.ts).
function AbilityHeptagon({
  dims, skillsByDim, lang, t,
}: {
  dims: Dimension[];
  skillsByDim: DimensionSkills[];
  lang: Lang;
  t: Record<string, string>;
}) {
  const [open, setOpen] = useState<TopicKey | null>(null);
  // The axes carry the SAME 0–3 level as the headline — one scale everywhere,
  // rather than making the reader translate between a percentage and a level.
  const data = dims.map((d) => ({
    key: d.key,
    // Short label: a full "To'plam, mulohazalar, ma'lumotlar tahlili…" would
    // collide with its neighbours on a 7-axis radar.
    axis: RASCH_TOPICS.find((tp) => tp.key === d.key)!.label[lang].split(/[ ,(]/)[0],
    [t.hepNow]: d.level,
    [t.hepBefore]: d.levelBefore ?? d.level,
    theta: d.theta,
  }));

  const measured = dims.some((d) => d.measured > 0);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Hexagon size={16} strokeWidth={3} className="text-primary" />
        <h2 className="s-display text-[15px] font-bold">{t.heptagon}</h2>
      </div>

      {!measured ? (
        <p className="py-5 text-center text-[13px] font-bold text-on-surface-variant">{t.hepEmpty}</p>
      ) : (
        <>
          <ChartFrame className="-mx-2 h-[280px] sm:h-[360px]">
            {({ width, height }) => (
              <RadarChart width={width} height={height} data={data} outerRadius="72%">
                <PolarGrid stroke={GRID_INK} />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: AXIS_INK, fontSize: 11, fontWeight: 800 }}
                />
                <PolarRadiusAxis
                  domain={[0, MASTER_LEVEL]}
                  tickCount={4}
                  tick={{ fill: FAINT_INK, fontSize: 9, fontWeight: 700 }}
                  axisLine={false}
                />
                {/* Previous sitting, drawn first so it sits behind */}
                <Radar
                  name={t.hepBefore}
                  dataKey={t.hepBefore}
                  stroke={FAINT_INK}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill={FAINT_INK}
                  fillOpacity={0.08}
                />
                <Radar
                  name={t.hepNow}
                  dataKey={t.hepNow}
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill={ACCENT}
                  fillOpacity={0.25}
                  dot={{ r: 3, strokeWidth: 0, fill: ACCENT }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontWeight: 800, paddingTop: 4 }}
                  iconType="plainline"
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [`${Number(value).toFixed(2)} / ${MASTER_LEVEL}`, String(name)]}
                />
              </RadarChart>
            )}
          </ChartFrame>

          {/* The precise view. A radar reads shape well and exact values badly,
              so the numbers live here — and this doubles as the table view AND
              as the way into each dimension's skills. */}
          <div className="mt-2 flex flex-col gap-1">
            {dims.map((d) => {
              const topic = RASCH_TOPICS.find((tp) => tp.key === d.key)!;
              const up = d.delta > 0;
              const flat = d.delta === 0;
              const bundle = skillsByDim.find((b) => b.key === d.key);
              const isOpen = open === d.key;

              return (
                <div key={d.key} className={cn('rounded-m3-sm', isOpen && 'bg-surface-container')}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : d.key)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 rounded-m3-sm px-2.5 py-1.5 text-left transition-colors duration-m3-fast hover:bg-state-hover"
                  >
                    {/* Topic hue — the categorical series color this axis shares with the chart. */}
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: topic.hex }} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-on-surface-variant">
                      {topic.label[lang]}
                    </span>

                    {/* Skills collected here — the second axis, in one glance. */}
                    {bundle && (
                      <span className="s-num shrink-0 text-[10px] font-black text-on-surface-variant">
                        {bundle.collected}/{bundle.total} {t.skillsShort}
                      </span>
                    )}

                    <span className={cn('s-num shrink-0 text-[10px] font-black', flat ? 'text-on-surface-variant' : up ? 'text-success' : 'text-error')}>
                      {flat ? '±0' : `${up ? '▲+' : '▼'}${d.delta}`}
                    </span>
                    <span className="s-num w-10 shrink-0 text-right text-[13px] font-black" style={{ color: BAND_TONE[levelBand(d.level)].color }}>
                      {formatLevel(d.level)}
                    </span>
                    <span className="s-num w-9 shrink-0 text-right text-[10px] font-black text-on-surface-variant">
                      {d.score}%
                    </span>
                    <ChevronDown
                      size={14}
                      strokeWidth={3}
                      className={cn('shrink-0 text-outline transition-transform duration-m3-fast', isOpen && 'rotate-180')}
                    />
                  </button>

                  {isOpen && bundle && (
                    <div className="border-t border-outline-variant pb-2 pt-1">
                      <p className="s-num px-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                        {bundle.collected}/{bundle.total} {t.skillsCollected} · {bundle.developed} {t.skillsDeveloped}
                      </p>

                      {bundle.skills.map((s) => (
                        <SkillRow key={s.key} s={s} dim={d.key} lang={lang} t={t} onJump={setOpen} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 border-t border-outline-variant pt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">
            {t.hepHint}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-on-surface-variant">
            {t.skillHint}
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * One weakest-skill row — the same review and drill as inside the heptagon.
 *
 * This card is where a student lands when they want to know what to fix, so it
 * has to answer "and what do I do about it" in place. Sending them back up to
 * find the same skill inside its dimension would be a worse version of the
 * information they already have.
 */
function WeakestSkillRow({ s, lang, t }: { s: SkillStat; lang: Lang; t: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const meta = skillMeta(s.key);
  const color = BAND_TONE[levelBand(s.level ?? 0)].color;
  const load = useCallback((scope: 'last' | 'all') => solvedForSkill(s.key, { scope }), [s.key]);

  return (
    <div className={cn('rounded-m3-sm', open && 'bg-surface-container')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-m3-sm px-1 py-1.5 text-left transition-colors duration-m3-fast hover:bg-state-hover"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-on-surface-variant">
            {meta?.label[lang] ?? s.key}
          </span>
          {open && (
            <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">
              {meta?.blurb[lang]}
            </span>
          )}
        </span>
        <span className="s-num w-10 shrink-0 text-right text-[12px] font-black" style={{ color }}>
          {formatLevel(s.level ?? 0)}
        </span>
        <span className="s-num w-11 shrink-0 text-right text-[10px] font-black text-on-surface-variant">
          {s.correct}/{s.seen}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={3}
          className={cn('shrink-0 text-outline transition-transform duration-m3-fast', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-outline-variant px-2.5 py-2">
          <QuestionReview
            load={load}
            lang={lang}
            t={t}
            // The skill's HOME dimension: a weakest-skill row has no dimension
            // context of its own, and the home is where it conceptually belongs.
            practiceHref={`/raschmodel/practice?${new URLSearchParams({ skill: s.key, dim: s.dims[0] ?? s.home }).toString()}`}
          />
        </div>
      )}
    </div>
  );
}

// ─── Skill coverage ───────────────────────────────────────────────────────
// The honest counterpart to the heptagon: how much of the skill map has been
// MEASURED at all. A 45-question paper touches roughly a dozen of the 34 skills,
// so a single sitting is a slice — and a student looking at a full-looking
// heptagon deserves to know how much of it rests on two questions.
function SkillCoverageCard({
  skills, lang, t,
}: {
  skills: ReturnType<typeof skillPicture>;
  lang: Lang;
  t: Record<string, string>;
}) {
  const pct = Math.round((skills.collected / skills.total) * 100);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Brain size={16} strokeWidth={3} className="text-primary" />
        <h2 className="s-display text-[15px] font-bold">{t.skillPanelTitle}</h2>
        <span className="s-num ml-auto text-[11px] font-black text-on-surface-variant">
          {skills.collected}/{skills.total} {t.skillCoverage}
        </span>
      </div>

      {skills.collected === 0 ? (
        <p className="py-6 text-center text-[13px] font-bold text-on-surface-variant">{t.skillNone}</p>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="s-num mt-1.5 text-[11px] font-black text-on-surface-variant">
            {skills.collected} {t.skillsCollected} · {skills.developed} {t.skillsDeveloped}
          </p>

          {skills.weakest.length > 0 && (
            <div className="mt-3 border-t border-outline-variant pt-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                {t.skillWeakest}
              </p>
              {skills.weakest.map((s) => (
                <WeakestSkillRow key={s.key} s={s} lang={lang} t={t} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-3 border-t border-outline-variant pt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">
        {t.skillPanelHint}
      </p>
    </Card>
  );
}

// ─── Next-exam forecast, the Rasch way ────────────────────────────────────
// score = Σ P(correct) = Σ σ(θ − bᵢ)  — never a line fitted through past
// percentages. Ability is projected forward by the measured learning rate,
// because Rasch on its own holds ability fixed and cannot see learning at all.
function RaschForecastCard({
  now, future, rate, target, t,
}: {
  now: ScorePrediction;
  future: ScorePrediction | null;
  rate: LearningRate;
  target: number | null;
  t: Record<string, string>;
}) {
  const improving = rate.perWeek > 0.02;
  const declining = rate.perWeek < -0.02;
  const Icon = improving ? TrendingUp : declining ? TrendingDown : Minus;
  const tone = improving ? 'text-success' : declining ? 'text-error' : 'text-on-surface-variant';

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Crosshair size={16} strokeWidth={3} className="text-primary" />
        <h2 className="s-display text-[15px] font-bold">{t.raschTitle}</h2>
        <span className="s-num ml-auto text-[11px] font-black text-on-surface-variant">
          θ = {now.theta.toFixed(2)} ± {now.se.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Now */}
        <div className="rounded-m3-md bg-surface-container-high p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{t.raschNow}</p>
          <p className="s-display s-num mt-1 text-3xl font-bold leading-none tracking-tight">{now.expected}%</p>
          <p className="s-num mt-1.5 text-[12px] font-black text-on-surface-variant">{now.low}% – {now.high}%</p>
        </div>

        {/* Projected — the bit plain Rasch cannot give you */}
        <div className="rounded-m3-md bg-primary-container p-4 text-on-primary-container">
          <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{t.raschIn2w}</p>
          {future ? (
            <>
              <p className="s-display s-num mt-1 text-4xl font-bold leading-none tracking-tight">
                {future.expected}%
              </p>
              <p className="s-num mt-1.5 text-[12px] font-black opacity-80">{future.low}% – {future.high}%</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] font-bold opacity-80">{t.noRate}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-outline-variant pt-3">
        <span className="flex items-center gap-1.5 text-[12px] font-black">
          <span className="uppercase tracking-wider text-on-surface-variant">{t.raschRate}</span>
          <Icon size={13} strokeWidth={3} className={tone} />
          <span className={cn('s-num', tone)}>
            {rate.perWeek > 0 ? '+' : ''}{rate.perWeek} {t.perWeek}
          </span>
        </span>

        <span className="text-[12px] font-black">
          <span className="uppercase tracking-wider text-on-surface-variant">{t.toTarget}</span>{' '}
          <span className="s-num">
            {target !== null ? `${target} ${t.days}` : t.notImproving}
          </span>
        </span>
      </div>

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">{t.raschHow}</p>
    </Card>
  );
}

// ─── Baseline setup ───────────────────────────────────────────────────────
function BaselineSetup({
  lang, t, onSave, saving,
}: {
  lang: Lang;
  t: Record<string, string>;
  onSave: (baseline: Record<TopicKey, number>) => void;
  saving: boolean;
}) {
  const [values, setValues] = useState<Record<TopicKey, number>>(
    () => Object.fromEntries(TOPIC_KEYS.map((k) => [k, DEFAULT_BASELINE])) as Record<TopicKey, number>,
  );

  return (
    <Card className="md:p-8">
      <div className="mb-2 flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-m3-sm bg-primary-container text-on-primary-container">
          <Sliders size={20} strokeWidth={2.5} />
        </div>
        <h2 className="s-display text-xl font-bold tracking-tight md:text-2xl">{t.setupTitle}</h2>
      </div>
      <p className="mb-4 text-[13px] font-bold text-on-surface-variant">{t.setupHint}</p>

      <div className="mb-4 flex flex-col gap-3">
        {RASCH_TOPICS.map((topic) => (
          <div key={topic.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {/* Topic hue — the same categorical color the charts use. */}
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: topic.hex }} />
                <span className="min-w-0 truncate text-[13px] font-bold text-on-surface-variant">{topic.label[lang]}</span>
              </span>
              <Chip className="s-num">{values[topic.key]}%</Chip>
            </div>
            <Slider
              label={topic.label[lang]}
              min={0}
              max={100}
              step={5}
              value={values[topic.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [topic.key]: Number(e.target.value) }))
              }
              className="w-full"
            />
          </div>
        ))}
      </div>

      <Button
        fullWidth
        onClick={() => onSave(values)}
        disabled={saving}
        loading={saving}
        icon={<Target size={18} strokeWidth={3} />}
        className="uppercase tracking-wider"
      >
        {saving ? t.saving : t.save}
      </Button>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Kept verbatim: a generic "couldn't load" hides the one failure that
  // actually happens here — permission-denied, i.e. the Firestore rules for
  // RASCH_levels were never deployed.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);
  // The chart starts on the overall line; topics are opt-in, so seven series
  // never land on the reader at once.
  const [shown, setShown] = useState<TopicKey[]>([]);

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
        if (cancelled) return;
        console.error('[raschmodel] could not load levels', err);
        setErrorDetail(describeError(err, t));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, t]);

  const handleSaveBaseline = useCallback(
    async (baseline: Record<TopicKey, number>) => {
      if (!user) return;
      setSaving(true);
      try {
        const next = await saveBaseline(user.uid, baseline);
        setLevels(next);
        setEditingBaseline(false);
      } catch (err: unknown) {
        console.error('[raschmodel] could not save baseline', err);
        setErrorDetail(describeError(err, t));
        setStatus('error');
      } finally {
        setSaving(false);
      }
    },
    [user, t],
  );

  // The Rasch pipeline: project ability forward by the measured learning rate,
  // then SUM P(correct) over the paper. Rasch alone cannot do this — it holds
  // ability fixed — so the learning model in lib/RASCHdynamic.ts supplies the
  // movement. All from the levels doc already in hand: no reads.
  const picture = useMemo(() => learningPicture(levels, 14), [levels]);
  // The seven dimensions of mathematics ability — each with its own θ, each
  // moved by every exam and drill that touched it.
  const dims = useMemo(() => dimensions(levels), [levels]);
  // The skill axis. Derived from `diagnostics.subtopics` + `recentItems`, both
  // already in the one document this page reads — no extra Firestore traffic.
  const skillsByDim = useMemo(() => dimensionSkills(levels), [levels]);
  const skills = useMemo(() => skillPicture(levels), [levels]);
  const theta = useMemo(() => overallTheta(levels), [levels]);
  // Mathematics → 7 dimensions → 29 chapters, all on the same 0–3 scale.
  const math = useMemo(() => mathLevel(levels), [levels]);
  const sections = useMemo(() => chapterLevels(levels), [levels]);
  const target = useMemo(
    () => (picture.current ? daysToTarget(picture.current, picture.rate, 75) : null),
    [picture],
  );

  // The old empirical trend (a line through past PERCENTAGES) is the fallback
  // for students with no item-level data yet.
  const overallForecast = useMemo(() => (levels ? forecastOverall(levels) : null), [levels]);

  // The solved archive is namespaced per account, and the per-skill review
  // panels read it — point it at this student before any of them mount, or a
  // shared browser shows one student's work to another.
  useEffect(() => { setSolvedUser(user?.uid ?? ''); }, [user?.uid]);

  const chartData = useMemo(() => {
    if (!levels) return [];
    const rows = levels.exams.map((exam, i) => {
      const row: Record<string, number | string> = {
        name: `${i + 1}`,
        [t.overall]: exam.score,
      };
      for (const key of TOPIC_KEYS) {
        // scores are appended one per exam, so index i lines up with exams[i];
        // read from the end in case a topic joined the history later.
        const scores = levels.topics[key]?.scores ?? [];
        const offset = scores.length - levels.exams.length;
        const value = scores[i + offset];
        if (value !== undefined) row[key] = value;
      }
      return row;
    });

    // The forecast, drawn as a dashed continuation. `predicted` is set on the
    // LAST real exam too, so the dashed segment starts on the solid line
    // instead of floating in space.
    if (rows.length > 0 && overallForecast && overallForecast.confidence !== 'none') {
      const last = rows[rows.length - 1];
      last[t.predicted] = last[t.overall];
      rows.push({
        name: `${rows.length + 1}`,
        [t.predicted]: overallForecast.expected,
      });
    }
    return rows;
  }, [levels, t.overall, t.predicted, overallForecast]);

  const toggleTopic = (key: TopicKey) =>
    setShown((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (authLoading || status === 'loading') {
    return (
      <Page width="wide">
        <LoadingState label={t.loading} />
      </Page>
    );
  }
  if (!user) {
    return (
      <Page width="wide">
        <EmptyState icon="🔐" title={t.signIn} />
      </Page>
    );
  }
  if (status === 'error' || !levels) {
    return (
      <Page width="wide">
        <ErrorState title={t.error} description={errorDetail ?? undefined} />
      </Page>
    );
  }

  // No baseline yet (or the student is re-picking it) — that comes first, since
  // every level is seeded from it.
  if (!levels.baseline || editingBaseline) {
    return (
      <Page>
        <div className="mx-auto w-full max-w-2xl">
          <BaselineSetup lang={lang} t={t} onSave={handleSaveBaseline} saving={saving} />
        </div>
      </Page>
    );
  }

  const overall = overallLevel(levels);
  const hasExams = levels.exams.length > 0;

  return (
    <Page width="wide">
      <RaschNav lang={lang} />
      <Stack>

        {/* Header + overall level */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PageHeader
            title={t.title}
            subtitle={t.subtitle}
            className="pb-0"
            actions={
              <Card className="flex items-center gap-4 py-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{t.overall}</p>
                  <p className="s-display s-num mt-0.5 text-2xl font-bold leading-none text-primary">{overall}%</p>
                  {/* Mathematics ability: the mean of the seven dimensions. */}
                  <p className="s-num mt-1 text-[10px] font-black text-outline">θ {theta.toFixed(2)}</p>
                </div>
                <div className="h-10 w-px bg-outline-variant" />
                <div>
                  <p className="s-num text-[18px] font-black leading-none">{levels.examCount}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-on-surface-variant">{t.examsTaken}</p>
                </div>
              </Card>
            }
          />
        </motion.div>

        {/* The headline level, on the main page — compact, and coloured by the
            band rather than by `primary`, so the card says where you stand before
            you read the number. Same component the navbar chip is built from
            (_components/LevelBadge), so the two can never disagree. */}
        <LevelCard
          level={math.level}
          theta={math.theta}
          dimensionsMeasured={math.measuredDimensions}
          lang={lang}
        />

        <AbilityHeptagon dims={dims} skillsByDim={skillsByDim} lang={lang} t={t} />

        <SkillCoverageCard skills={skills} lang={lang} t={t} />

        <ChapterLevels sections={sections} t={t} />

        {picture.now ? (
          <RaschForecastCard
            now={picture.now}
            future={picture.future}
            rate={picture.rate}
            target={target}
            t={t}
          />
        ) : (
          overallForecast && <ForecastCard f={overallForecast} t={t} />
        )}

        {/* Chart */}
        <Card>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="s-display text-[15px] font-bold">{t.chartTitle}</h2>
            <span className="text-[11px] font-bold text-on-surface-variant">{t.chartHint}</span>
          </div>

          {!hasExams ? (
            <EmptyState
              icon="📈"
              title={t.noExams}
              action={
                <NavLink href="/raschmodel/exam" tone="filled">
                  <Rocket size={16} strokeWidth={3} /> {t.startExam}
                </NavLink>
              }
            />
          ) : (
            <>
              {/* Legend + series picker in one row above the plot */}
              <div className="my-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-m3-xs border-[1.5px] border-outline px-2.5 py-1 text-[11px] font-black">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OVERALL_STROKE }} />
                  {t.overall}
                </span>
                {RASCH_TOPICS.map((topic) => {
                  const on = shown.includes(topic.key);
                  return (
                    <FilterChip
                      key={topic.key}
                      selected={on}
                      onClick={() => toggleTopic(topic.key)}
                      className="gap-1.5 px-2.5 py-1 text-[11px]"
                    >
                      {/* Topic hue — the categorical series color of its line. */}
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: on ? topic.hex : FAINT_INK }}
                      />
                      {topic.label[lang].split(' ')[0]}
                    </FilterChip>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <ChartFrame className="-ml-2 h-[220px] min-w-[320px]">
                  {({ width, height }) => (
                    <LineChart width={width} height={height} data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke={GRID_INK} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: AXIS_INK, fontSize: 11, fontWeight: 700 }}
                        axisLine={{ stroke: GRID_INK }}
                        tickLine={false}
                        label={{ value: t.exam, position: 'insideBottomRight', offset: -2, fill: FAINT_INK, fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        unit="%"
                        tick={{ fill: AXIS_INK, fontSize: 11, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <Tooltip
                        cursor={{ stroke: FAINT_INK, strokeWidth: 1 }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [
                          `${value}%`,
                          RASCH_TOPICS.find((tp) => tp.key === name)?.label[lang] ?? String(name),
                        ]}
                        labelFormatter={(label) => `${t.exam} ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey={t.overall}
                        stroke={OVERALL_STROKE}
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 0, fill: OVERALL_STROKE }}
                        activeDot={{ r: 6 }}
                      />
                      {/* Forecast — dashed, hollow dot: visibly not a real result */}
                      <Line
                        type="monotone"
                        dataKey={t.predicted}
                        stroke={ACCENT}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={{ r: 4, strokeWidth: 2, stroke: ACCENT, fill: 'var(--m3-surface)' }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                      {RASCH_TOPICS.filter((tp) => shown.includes(tp.key)).map((tp) => (
                        <Line
                          key={tp.key}
                          type="monotone"
                          dataKey={tp.key}
                          stroke={tp.hex}
                          strokeWidth={2}
                          dot={{ r: 4, strokeWidth: 0, fill: tp.hex }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  )}
                </ChartFrame>
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outlined"
            size="sm"
            onClick={() => setEditingBaseline(true)}
            icon={<Sliders size={14} strokeWidth={3} />}
          >
            {t.editBaseline}
          </Button>
          <p className="text-[11px] font-bold text-on-surface-variant">
            {t.level} = mean(last {LEVEL_WINDOW})
          </p>
        </div>
      </Stack>
    </Page>
  );
}
