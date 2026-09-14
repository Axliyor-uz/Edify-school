// app/(student)/raschmodel/progress/_components/QuestionReview.tsx
'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ChevronDown, Dumbbell, Plus, XCircle } from 'lucide-react';

import LatexRenderer from '@/components/LatexRenderer';
import { getSolvedArchive, subscribeSolved, getServerSolvedArchive, type SolvedQuestion } from '@/lib/RASCHsolved';
import { cn } from '@/components/student-ui';
import type { Lang } from '@/types/Math';

/**
 * "My work on this" — the question-level review shared by every level of the
 * hierarchy: a dimension, a skill inside it, and a weakest-skill row.
 *
 * It exists once because the three places must agree. Three copies of a review
 * that pages, scopes and explains would drift the moment any one of them was
 * touched, and the difference between them is only WHICH questions are passed in.
 *
 * Everything here is read from the local archive (lib/RASCHsolved.ts), so opening
 * a panel costs zero Firestore reads. The trade-off is that the archive is
 * per-device and capped — the empty state says so rather than implying the
 * student has done nothing.
 */

const PAGE = 5;

export interface ReviewSource {
  correct: SolvedQuestion[];
  wrong: SolvedQuestion[];
}

export interface QuestionReviewProps {
  /** Called with the chosen scope — the caller decides skill vs dimension. */
  load: (scope: 'last' | 'all') => ReviewSource;
  lang: Lang;
  t: Record<string, string>;
  /** Where "practise this" goes. Omitted on a level that cannot be drilled. */
  practiceHref?: string;
  practiceLabel?: string;
}

export default function QuestionReview({
  load, lang, t, practiceHref, practiceLabel,
}: QuestionReviewProps) {
  const [scope, setScope] = useState<'last' | 'all'>('all');
  const [shownWrong, setShownWrong] = useState(PAGE);
  const [shownCorrect, setShownCorrect] = useState(PAGE);

  // Subscribing here (not in every caller) keeps the panel live: finish a drill
  // in another tab and the list updates without a reload.
  const archive = useSyncArchive();
  const source = useMemo(
    () => load(scope),
    // `archive` is the subscription's identity — `load` reads the store itself,
    // so this is the only thing tying the memo to it. Removing it freezes the
    // panel at whatever the archive held on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, scope, archive],
  );

  const changeScope = (next: 'last' | 'all') => {
    setScope(next);
    // A narrower scope with a page count left over from the wider one would show
    // "+5 more" on a list of three.
    setShownWrong(PAGE);
    setShownCorrect(PAGE);
  };

  const empty = source.correct.length + source.wrong.length === 0;

  return (
    <div>
      {/* ── Scope ─────────────────────────────────────────────────────── */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(['last', 'all'] as const).map((sc) => (
          <button
            key={sc}
            type="button"
            onClick={() => changeScope(sc)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-black s-press',
              scope === sc
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-highest text-on-surface-variant hover:bg-state-hover',
            )}
          >
            {sc === 'last' ? t.scopeLast : t.scopeAll}
          </button>
        ))}
      </div>

      {empty ? (
        <p className="py-2 text-[11px] font-bold text-on-surface-variant">{t.skillNoQuestions}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Errors first — that is the half worth acting on. */}
          <Bucket
            items={source.wrong}
            shown={shownWrong}
            onMore={() => setShownWrong((n) => n + PAGE)}
            tone="error"
            label={t.skillWrong}
            lang={lang}
            t={t}
          />
          <Bucket
            items={source.correct}
            shown={shownCorrect}
            onMore={() => setShownCorrect((n) => n + PAGE)}
            tone="success"
            label={t.skillCorrect}
            lang={lang}
            t={t}
          />
        </div>
      )}

      {practiceHref && (
        <Link
          href={practiceHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-m3-btn bg-primary px-3.5 py-2 text-[12px] font-black text-on-primary s-press"
        >
          <Dumbbell size={13} strokeWidth={3} />
          {practiceLabel ?? t.skillPractice}
        </Link>
      )}
    </div>
  );
}

/** One outcome bucket, paged five at a time. */
function Bucket({
  items, shown, onMore, tone, label, lang, t,
}: {
  items: SolvedQuestion[];
  shown: number;
  onMore: () => void;
  tone: 'error' | 'success';
  label: string;
  lang: Lang;
  t: Record<string, string>;
}) {
  if (items.length === 0) return null;
  const Icon = tone === 'error' ? XCircle : CheckCircle2;
  const visible = items.slice(0, shown);
  const remaining = items.length - visible.length;

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
        <Icon size={12} strokeWidth={3} className={tone === 'error' ? 'text-error' : 'text-success'} />
        {label}
        <span className="s-num">{items.length}</span>
      </p>

      <div className="flex flex-col gap-1">
        {visible.map((q) => (
          <QuestionCard key={`${q.id}-${q.examAt}`} q={q} tone={tone} lang={lang} t={t} />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="mt-1.5 inline-flex items-center gap-1 rounded-m3-btn border-[1.5px] border-outline px-2.5 py-1 text-[10px] font-black text-on-surface-variant s-press hover:bg-state-hover hover:text-primary"
        >
          <Plus size={11} strokeWidth={3} />
          {t.showMore} ({Math.min(PAGE, remaining)})
        </button>
      )}
    </div>
  );
}

/**
 * One question, openable into the full analysis: what was chosen, what was
 * right, and why.
 *
 * The explanation is the point of the whole panel — a list of questions the
 * student got wrong, with no explanation, is a scoreboard, not a study tool.
 */
function QuestionCard({
  q, tone, lang, t,
}: {
  q: SolvedQuestion;
  tone: 'error' | 'success';
  lang: Lang;
  t: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  // Teacher-authored items are uz-only, so fall back to any filled language
  // rather than rendering blank when the paper was sat in ru/en.
  const pick = (tx?: { uz?: string; ru?: string; en?: string } | null): string =>
    (tx?.[q.lang] || tx?.[lang] || tx?.uz || tx?.ru || tx?.en || '') as string;

  const expected = q.expected ?? q.answer;
  const explanation = pick(q.explanation);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-m3-xs border-l-2 bg-surface',
        tone === 'error' ? 'border-error' : 'border-success',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors duration-m3-fast hover:bg-state-hover"
      >
        <span className="min-w-0 flex-1">
          <LatexRenderer
            latex={pick(q.question)}
            className={cn('block text-[11px] font-bold leading-snug text-on-surface', !open && 'line-clamp-2')}
          />
          <span className="s-num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-bold text-on-surface-variant">
            <span className="min-w-0 max-w-full truncate">{q.subtopic}</span>
            <span>·</span>
            <span>{formatShortDate(q.examAt, lang)}</span>
            {/* Drills and papers are different evidence — label which this was. */}
            <span className="rounded-full bg-surface-container-high px-1.5 font-black uppercase">
              {q.kind === 'practice' ? t.fromPractice : t.fromExam}
            </span>
          </span>
        </span>
        <ChevronDown
          size={12}
          strokeWidth={3}
          className={cn('mt-0.5 shrink-0 text-outline transition-transform duration-m3-fast', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-outline-variant px-2 py-2">
          {q.stem && pick(q.stem) && (
            <LatexRenderer
              latex={pick(q.stem)}
              className="mb-1.5 block text-[10px] font-semibold leading-snug text-on-surface-variant"
            />
          )}

          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.imageUrl}
              alt=""
              className="mb-2 max-h-40 w-auto rounded-m3-xs border border-outline-variant bg-surface object-contain"
            />
          )}

          {/* Given vs correct — the diagnosis, before the explanation. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-bold">
            <span className="text-on-surface-variant">{t.yourAnswer}:</span>
            {q.given ? (
              <LatexRenderer
                latex={optionText(q, q.given, pick) || q.given}
                className={tone === 'error' ? 'text-error' : 'text-success'}
              />
            ) : (
              <span className="text-on-surface-variant">{t.notAnswered}</span>
            )}
            {!q.correct && (
              <>
                <span className="text-on-surface-variant">· {t.correctAnswer}:</span>
                <LatexRenderer
                  latex={optionText(q, expected, pick) || expected}
                  className="text-success"
                />
              </>
            )}
          </div>

          {explanation ? (
            <div className="mt-2 flex gap-1.5 rounded-m3-xs bg-surface-container-high p-2">
              <BookOpen size={12} strokeWidth={3} className="mt-0.5 shrink-0 text-primary" />
              <LatexRenderer
                latex={explanation}
                className="block text-[11px] font-medium leading-relaxed text-on-surface-variant"
              />
            </div>
          ) : (
            <p className="mt-2 text-[10px] font-bold text-on-surface-variant">{t.noExplanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** The text of an option key, so the review shows the answer, not just "B". */
function optionText(
  q: SolvedQuestion,
  key: string,
  pick: (tx?: { uz?: string; ru?: string; en?: string } | null) => string,
): string {
  const option = (q.options as Record<string, { uz?: string; ru?: string; en?: string }>)[key];
  const text = option ? pick(option) : '';
  return text ? `${key}) ${text}` : '';
}

function formatShortDate(at: number, lang: Lang): string {
  return new Date(at).toLocaleDateString(
    lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB',
    { day: 'numeric', month: 'short' },
  );
}

/** Kept local so callers don't each have to wire the store subscription. */
function useSyncArchive() {
  return useSyncExternalStore(subscribeSolved, getSolvedArchive, getServerSolvedArchive);
}
