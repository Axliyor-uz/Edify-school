// app/(student)/raschmodel/topic/[topic]/page.tsx
'use client';

import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen, CheckCircle2, ChevronDown, Rocket, XCircle,
} from 'lucide-react';

import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { useAuth } from '@/lib/AuthContext';
import RaschNav from '../../_components/RaschNav';
import { useStudentLanguage } from '../../../layout';
import {
  getServerSolvedArchive,
  getSolvedArchive,
  setSolvedUser,
  subscribeSolved,
  type SolvedQuestion,
} from '@/lib/RASCHsolved';
import { RASCH_TOPICS, TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import {
  Button, Card, Chip, EmptyState, Page, cn, MOTION_ON, springTransition,
} from '@/components/student-ui';
import type { Lang } from '@/types/Math';

function MathText({ text, className }: { text: string; className?: string }) {
  return <LatexRenderer latex={text} className={className} />;
}

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    back: 'Darajam',
    home: 'Bosh sahifa',
    newTest: 'Yangi test',
    solved: 'ta savol yechilgan',
    correct: "to'g'ri",
    empty: "Bu mavzuda hali savol yechmagansiz. Test topshiring — yechgan savollaringiz shu yerda saqlanadi.",
    startExam: 'Testni boshlash',
    yourAnswer: 'Sizning javobingiz',
    correctAnswer: "To'g'ri javob",
    explanation: 'Izoh',
    localOnly: "Yechilgan savollar shu qurilmada saqlanadi (oxirgi 20 tasi).",
    open: 'Ochiq savol',
  },
  ru: {
    back: 'Мой уровень',
    home: 'Главная',
    newTest: 'Новый тест',
    solved: 'вопросов решено',
    correct: 'верно',
    empty: 'Вы ещё не решали вопросы по этой теме. Пройдите тест — решённые вопросы появятся здесь.',
    startExam: 'Начать тест',
    yourAnswer: 'Ваш ответ',
    correctAnswer: 'Правильный ответ',
    explanation: 'Объяснение',
    localOnly: 'Решённые вопросы хранятся на этом устройстве (последние 20).',
    open: 'Открытый вопрос',
  },
  en: {
    back: 'My level',
    home: 'Home',
    newTest: 'New test',
    solved: 'questions solved',
    correct: 'correct',
    empty: "You haven't solved any questions in this topic yet. Take a test — the questions you solve are kept here.",
    startExam: 'Start a test',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    localOnly: 'Solved questions are kept on this device (the last 20).',
    open: 'Open question',
  },
};

function formatDate(at: number, lang: Lang): string {
  return new Date(at).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── One solved question ──────────────────────────────────────────────────
function SolvedCard({ item, lang, t, index }: { item: SolvedQuestion; lang: Lang; t: Record<string, string>; index: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const expected = item.expected ?? item.answer;
  // Teacher questions are authored uz-only, so fall back to any filled language
  // rather than showing blank when the paper was sat in ru/en.
  const pick = (tx?: { uz?: string; ru?: string; en?: string } | null) =>
    (tx?.[item.lang] || tx?.uz || tx?.ru || tx?.en || '') as string;

  return (
    <motion.div
      initial={MOTION_ON ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: MOTION_ON ? Math.min(index, 10) * 0.03 : 0 }}
    >
      <Card
        variant="outlined"
        className={cn('border-2', item.correct ? 'border-success' : 'border-error')}
      >
        <div className="mb-2 flex items-start gap-2">
          <Chip status="neutral">{item.testType}</Chip>
          <span className="min-w-0 truncate text-[11px] font-bold text-on-surface-variant">{item.chapter}</span>
          <span className="s-num ml-auto shrink-0 text-[11px] font-bold text-on-surface-variant">
            {formatDate(item.examAt, lang)}
          </span>
          {item.correct
            ? <CheckCircle2 size={18} className="shrink-0 text-success" />
            : <XCircle size={18} className="shrink-0 text-error" />}
        </div>

        {pick(item.stem) && (
          <MathText text={pick(item.stem)} className="mb-2 block text-[12px] font-semibold leading-snug text-on-surface-variant" />
        )}

        <MathText text={pick(item.question) || item.question[lang]} className="mb-3 block text-[14px] font-bold leading-snug text-on-surface" />

        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="mb-3 max-h-56 w-auto rounded-m3-md border border-outline-variant bg-surface object-contain" />
        )}

        <QuestionCreator creatorName={item.creatorName} correctedBy={item.correctedBy} className="mb-3 text-on-surface-variant" />

        <div className="flex flex-wrap items-center gap-x-1.5 text-[12px] font-bold text-on-surface-variant">
          <span>{t.yourAnswer}:</span>
          {item.given ? <MathText text={item.given} /> : <span>—</span>}
          {!item.correct && (
            <span className="flex items-center gap-1 text-success">
              · {t.correctAnswer}: <MathText text={expected} />
            </span>
          )}
        </div>

        {item.explanation?.[item.lang] && (
          <div className="mt-2">
            <Button
              variant={showExplanation ? 'tonal' : 'text'}
              size="sm"
              onClick={() => setShowExplanation((v) => !v)}
              icon={<BookOpen size={12} strokeWidth={3} />}
              trailingIcon={
                <ChevronDown
                  size={12}
                  strokeWidth={3}
                  className={cn('transition-transform', showExplanation && 'rotate-180')}
                />
              }
            >
              {t.explanation}
            </Button>
            {showExplanation && (
              <motion.div
                initial={MOTION_ON ? { opacity: 0, y: -4 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-2 border-t border-outline-variant pt-2 text-[12px] font-medium text-on-surface-variant"
              >
                <MathText text={item.explanation[item.lang]} />
              </motion.div>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = use(params);
  const { lang } = useStudentLanguage();
  const { user } = useAuth();
  const t = UI[lang];

  // The archive is a localStorage store, read the same way the exam snapshot is:
  // null on the server, real data in the browser. Zero Firestore reads. Scoped to
  // this account so a shared browser never surfaces another student's history.
  useEffect(() => { setSolvedUser(user?.uid ?? ''); }, [user?.uid]);
  const archive = useSyncExternalStore(subscribeSolved, getSolvedArchive, getServerSolvedArchive);

  const key = TOPIC_KEYS.includes(topic as TopicKey) ? (topic as TopicKey) : null;
  const meta = RASCH_TOPICS.find((tp) => tp.key === key);

  const items = useMemo(
    () => (key ? [...(archive.byTopic[key] ?? [])].reverse() : []),
    [archive, key],
  );
  const correct = items.filter((i) => i.correct).length;

  if (!key || !meta) notFound();

  return (
    <Page className="flex flex-col gap-s-gap-lg">

      <RaschNav lang={lang} />

      {/* Header */}
      <Card>
        <div className="flex items-center gap-3">
          {/* The topic's identity color — the same pinned value its line carries
              on the progress chart. */}
          <span className="h-10 w-3 shrink-0 rounded-full" style={{ backgroundColor: meta.hex }} />
          <div className="min-w-0">
            <h1 className="s-display text-xl font-bold leading-tight tracking-tight md:text-2xl">
              {meta.label[lang]}
            </h1>
            <p className="s-num mt-1 text-[12px] font-bold text-on-surface-variant">
              {items.length} {t.solved}
              {items.length > 0 && <> · {correct} {t.correct}</>}
            </p>
          </div>
        </div>
      </Card>

      {/* Solved questions */}
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={28} strokeWidth={2.5} />}
            title={t.empty}
            action={
              <Link href="/raschmodel/exam">
                <Button size="lg" icon={<Rocket size={16} strokeWidth={3} />}>
                  {t.startExam}
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-s-gap">
            {items.map((item, i) => (
              <SolvedCard key={`${item.id}-${item.examAt}`} item={item} lang={lang} t={t} index={i} />
            ))}
          </div>
          <p className="px-1 text-[11px] font-bold text-on-surface-variant">{t.localOnly}</p>
        </>
      )}

    </Page>
  );
}
