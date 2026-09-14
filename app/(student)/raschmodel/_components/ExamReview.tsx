// app/(student)/raschmodel/_components/ExamReview.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, BookOpen, ChevronDown, ChevronLeft, ChevronRight, EyeOff,
} from 'lucide-react';

import QuestionCreator from '@/components/QuestionCreator';
import { Banner, Button, Card, Dialog, cn } from '@/components/student-ui';
import {
  examExpectedText, examMode, examPartExpected, examSlotCount, examSlotKeys,
  isExamItemCorrect, isExamPartCorrect, partKey,
} from '@/lib/ExamTeacher';
import { MathText, pickLangText } from './ExamRunner';
import type { ExamPart, ExamQuestion } from '@/types/Exam';
import type { Lang, LocalizedText } from '@/types/Math';

/**
 * The per-question review shown after a paper is submitted: what was asked, what
 * the student put down, what was right, and the explanation.
 *
 * **It is a GRID of slot numbers, not a list of 45 cards.** The list version put
 * a wall of ~45 expanded questions under the results — the student had to scroll
 * past everything they got right to reach the one they wanted, and on a phone
 * that is most of a minute of scrolling. The grid is the same shape as the
 * runner's navigator (green = right, red = wrong), so "question 31" is in the
 * same place it was during the paper; tapping a number opens that question in a
 * dialog, with arrows to walk the paper without going back to the grid.
 *
 * Shared by the mock exam and the teacher quiz for the same reason `ExamRunner`
 * is — a block's answer lives under per-part keys, and any surface that forgets
 * to branch on that renders `[object Object]`. One implementation, both papers.
 *
 * ⚠️ `hideAnswers` is a real mode, not a styling flag. A teacher who intends to
 * reuse a paper across two groups can withhold the key; the review then shows
 * only whether each question was right, never the correct answer or the
 * explanation. It must never leak the key through the "correct answer" line, the
 * per-part expected value, or the explanation button.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    yourAnswer: 'Sizning javobingiz',
    answerNotStored: "Javobingiz saqlanmagan — natijada faqat qaysi savol to'g'ri yechilgani qoladi.",
    correctAnswer: "To'g'ri javob",
    explanation: 'Izoh',
    hidden: "O'qituvchi to'g'ri javoblarni yopib qo'ygan — faqat qaysi savol to'g'ri yechilgani ko'rinadi.",
    reviewTitle: 'Savollar tahlili',
    reviewHint: "Savolni ochish uchun raqamiga bosing.",
    question: 'Savol',
    correct: "To'g'ri",
    wrong: "Xato",
    blank: 'Javobsiz',
    prev: 'Oldingi',
    next: 'Keyingi',
    close: 'Yopish',
  },
  ru: {
    yourAnswer: 'Ваш ответ',
    answerNotStored: "Ваш ответ не сохраняется — в результате остаётся только, какой вопрос решён верно.",
    correctAnswer: 'Правильный ответ',
    explanation: 'Объяснение',
    hidden: 'Учитель скрыл правильные ответы — видно только, какие вопросы решены верно.',
    reviewTitle: 'Разбор вопросов',
    reviewHint: 'Нажмите на номер, чтобы открыть вопрос.',
    question: 'Вопрос',
    correct: 'Верно',
    wrong: 'Ошибка',
    blank: 'Без ответа',
    prev: 'Назад',
    next: 'Далее',
    close: 'Закрыть',
  },
  en: {
    yourAnswer: 'Your answer',
    answerNotStored: "Your answer is not stored — the result keeps only which questions were right.",
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    hidden: 'Your teacher withheld the answer key — only which questions were right is shown.',
    reviewTitle: 'Question review',
    reviewHint: 'Tap a number to open that question.',
    question: 'Question',
    correct: 'Correct',
    wrong: 'Wrong',
    blank: 'Blank',
    prev: 'Previous',
    next: 'Next',
    close: 'Close',
  },
};

export interface ExamReviewProps {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  /** The language the paper was sat in. */
  examLang: Lang;
  appLang: Lang;
  /** Withhold correct answers and explanations (teacher quizzes only). */
  hideAnswers?: boolean;
  /**
   * **Replay mode** — per-slot outcomes (`teacher_rasch_results.items`, keyed by
   * `examSlotKeys`) instead of live answers.
   *
   * Used when a student reopens a paper they sat earlier: the sitting itself is
   * long gone from localStorage, and the stored result records only WHETHER each
   * slot was right, never what they put (see docs/RASCH_QUIZ.md — it is an
   * outcome map, deliberately not an answer map). So correctness comes from here
   * and the "your answer" line is replaced by a note saying why it is absent.
   * Everything else — the grid, the block handling, the explanation — is the
   * same code the post-submit review runs, which is the point of putting this
   * here rather than building a second review surface.
   */
  outcomes?: Record<string, number>;
}

/** "12", or "33–35" for a block that occupies three slots on the paper. */
function slotLabel(q: ExamQuestion): string {
  const span = examSlotCount(q);
  return span > 1 ? `${q.slotNumber}–${q.slotNumber + span - 1}` : String(q.slotNumber);
}

/** One cell of the grid. A `shared_options` block contributes one PER PART. */
interface Slot {
  key: string;
  number: number;
  /** Index into `questions` — what the dialog opens. */
  qi: number;
  correct: boolean;
  answered: boolean;
}

export default function ExamReview({
  questions, answers, examLang, appLang, hideAnswers = false, outcomes,
}: ExamReviewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const t = UI[appLang];

  // Slot numbers, not documents: a shared_options block is printed as 33–35 on
  // the paper and the student looks for "34", so it gets three cells that all
  // open the same block — each coloured by ITS OWN part's outcome.
  //
  // ⚠️ In replay mode the outcome is looked up by `examSlotKeys` — the one
  // vocabulary the stored map is written in. `Slot.key` below is a React key and
  // a DIFFERENT namespace (`:` not `#`); mixing the two silently colours every
  // block green.
  const slots: Slot[] = questions.flatMap((q, qi) => {
    const count = examSlotCount(q);
    const parts = q.parts ?? [];
    const slotKeys = examSlotKeys(q);

    if (count > 1 && parts.length === count) {
      return parts.map((p: ExamPart, k: number) => {
        const given = answers[partKey(q.id, p.id)];
        return {
          key: `${q.id}:${p.id}`,
          number: q.slotNumber + k,
          qi,
          correct: outcomes ? !!outcomes[slotKeys[k]] : isExamPartCorrect(p, given),
          // Unknowable in replay mode — the result stores no answers — so every
          // slot counts as answered and the "blank" tally is simply not shown.
          answered: outcomes ? true : (given ?? '').trim() !== '',
        };
      });
    }

    return [{
      key: q.id,
      number: q.slotNumber,
      qi,
      correct: outcomes ? !!outcomes[slotKeys[0]] : isExamItemCorrect(q, answers),
      answered: outcomes ? true : (answers[q.id] ?? '').trim() !== '',
    }];
  });

  const rightCount = slots.filter((s) => s.correct).length;
  const blankCount = slots.filter((s) => !s.answered && !s.correct).length;

  const open = openIndex !== null ? questions[openIndex] : null;

  return (
    <Card>
      {hideAnswers && (
        <Banner status="info" className="mb-3" icon={<EyeOff size={16} strokeWidth={3} />} title={t.hidden} />
      )}

      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="s-display text-[15px] font-bold">{t.reviewTitle}</h2>
        <span className="s-num flex flex-wrap items-center gap-x-2.5 text-[11px] font-black">
          <span className="text-success">{rightCount} {t.correct}</span>
          <span className="text-error">{slots.length - rightCount - blankCount} {t.wrong}</span>
          {blankCount > 0 && <span className="text-on-surface-variant">{blankCount} {t.blank}</span>}
        </span>
      </div>
      <p className="mb-3 text-[11px] font-medium text-on-surface-variant">{t.reviewHint}</p>

      {/* Same geometry as the runner's navigator, so a number sits where the
          student last saw it. 9 per row on a phone keeps the cells thumb-sized. */}
      <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
        {slots.map((s) => (
          <button
            key={s.key}
            onClick={() => setOpenIndex(s.qi)}
            aria-label={`${t.question} ${s.number} — ${s.correct ? t.correct : s.answered ? t.wrong : t.blank}`}
            className={cn(
              's-num relative flex aspect-square items-center justify-center rounded-m3-xs text-[11px] font-black s-press',
              'transition-colors duration-m3-fast ease-m3-std',
              s.correct
                ? 'bg-success-container text-on-success-container'
                : s.answered
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-surface-container-high text-on-surface-variant',
            )}
          >
            {s.number}
          </button>
        ))}
      </div>

      <Dialog
        open={open !== null}
        onClose={() => setOpenIndex(null)}
        sheetOnMobile
        title={open ? `${t.question} ${slotLabel(open)}` : undefined}
        // Wider than the default `max-w-sm` — a question with an image and five
        // options is unreadable in a 384px column.
        className="max-w-lg"
      >
        {open && (
          <>
            {/* Scrolls INSIDE the panel: an explanation is often longer than the
                question, and a dialog that grows past the viewport strands the
                arrows off-screen. */}
            <div className="max-h-[60vh] overflow-y-auto">
              <QuestionReviewBody
                key={open.id}
                q={open}
                answers={answers}
                examLang={examLang}
                t={t}
                hideAnswers={hideAnswers}
                outcomes={outcomes}
              />
            </div>

            {/* One row, not the Dialog's stacked `actions` — three full-width
                bars is exactly what this screen was fixed to stop doing. */}
            <div className="mt-4 flex items-center gap-2 border-t border-outline-variant pt-3">
              <Button
                variant="tonal"
                size="sm"
                aria-label={t.prev}
                title={t.prev}
                className="px-3"
                onClick={() => setOpenIndex((i) => (i === null ? i : Math.max(0, i - 1)))}
                disabled={openIndex === 0}
              >
                <ChevronLeft size={16} strokeWidth={3} />
              </Button>
              <Button
                variant="tonal"
                size="sm"
                aria-label={t.next}
                title={t.next}
                className="px-3"
                onClick={() => setOpenIndex((i) => (i === null ? i : Math.min(questions.length - 1, i + 1)))}
                disabled={openIndex !== null && openIndex >= questions.length - 1}
              >
                <ChevronRight size={16} strokeWidth={3} />
              </Button>
              <Button variant="text" size="sm" className="ml-auto" onClick={() => setOpenIndex(null)}>
                {t.close}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Card>
  );
}

/**
 * One question, reviewed. Extracted from the old list so the dialog and any
 * future surface render a block, a typed answer and an image identically.
 */
function QuestionReviewBody({
  q, answers, examLang, t, hideAnswers, outcomes,
}: {
  q: ExamQuestion;
  answers: Record<string, string>;
  examLang: Lang;
  t: Record<string, string>;
  hideAnswers: boolean;
  outcomes?: Record<string, number>;
}) {
  const [showExplanation, setShowExplanation] = useState(false);

  const pick = (tx?: LocalizedText | null) => pickLangText(examLang, tx);

  const given = answers[q.id];
  const isAnswered = (given ?? '').trim() !== '';
  // Replay mode: the whole item counts as right only when every slot it occupies
  // is (a shared_options block is scored per part, so it can be partly right).
  const slotKeys = examSlotKeys(q);
  const correct = outcomes
    ? slotKeys.every((k) => !!outcomes[k])
    : isExamItemCorrect(q, answers);
  const mode = examMode(q);
  // A closed item points at the chosen option key; an open one shows the
  // plain-text answer the typed input was graded against.
  const expected = mode === 'open' ? examExpectedText(q, examLang) : q.answer;

  return (
    <div>
      {/* The slot number is the dialog's title — this row is the question. */}
      <div className="mb-2 flex items-start gap-2">
        <span className="min-w-0 flex-1">
          {pick(q.stem) && (
            <MathText text={pick(q.stem)} className="mb-1 block text-[12px] font-semibold text-on-surface-variant" />
          )}
          <MathText text={pick(q.question)} className="text-[13px] font-bold text-on-surface" />
        </span>
        {correct
          ? <CheckCircle2 size={18} className="shrink-0 text-success" />
          : <XCircle size={18} className="shrink-0 text-error" />}
      </div>

      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className="mb-2 max-h-48 w-auto rounded-m3-sm border border-outline-variant bg-surface object-contain" />
      )}

      <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mb-2 text-on-surface-variant" iconSize={9} />

      {mode === 'block' ? (
        <div className="flex flex-col gap-1.5">
          {(q.parts ?? []).map((p, k) => {
            const pg = answers[partKey(q.id, p.id)];
            // A `multi_part` block is ONE slot, so replay mode knows only whether
            // the whole block was right — there is no per-part outcome to show,
            // and inventing one would be a claim the stored data cannot support.
            const partKnown = !outcomes || slotKeys.length === (q.parts ?? []).length;
            const pCorrect = outcomes
              ? (partKnown ? !!outcomes[slotKeys[k]] : correct)
              : isExamPartCorrect(p, pg);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-x-1 text-[12px] font-bold text-on-surface-variant">
                {partKnown && (pCorrect
                  ? <CheckCircle2 size={13} className="shrink-0 text-success" />
                  : <XCircle size={13} className="shrink-0 text-error" />)}
                <MathText text={pick(p.prompt)} className="text-on-surface" />
                {!outcomes && <><span>—</span>{pg ? <MathText text={pg} /> : <span>—</span>}</>}
                {(outcomes ? true : !pCorrect) && !hideAnswers && (
                  <span className="flex items-center gap-1 text-success">
                    · <MathText text={examPartExpected(p, examLang)} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-1 text-[12px] font-bold text-on-surface-variant">
          {/* ⚠️ Replay mode has no answer to show — the result document stores
              outcomes only, on purpose. Say so rather than print an empty dash
              that reads like "you left it blank". */}
          {outcomes ? (
            <span className="text-[11px] font-medium">{t.answerNotStored}</span>
          ) : (
            <>
              <span>{t.yourAnswer}:</span>
              {isAnswered ? <MathText text={given!} /> : <span>—</span>}
            </>
          )}
          {(outcomes ? !correct : !correct) && !hideAnswers && (
            <span className="flex items-center gap-1 text-success">
              · {t.correctAnswer}: <MathText text={expected} />
            </span>
          )}
        </div>
      )}

      {/* The explanation ships with the question — it is a field on the doc we
          already read — so this button costs nothing. Collapsed by default:
          it is often longer than the question. */}
      {!hideAnswers && pick(q.explanation) && (
        <div className="mt-3">
          <button
            onClick={() => setShowExplanation((v) => !v)}
            aria-expanded={showExplanation}
            className={cn(
              'flex items-center gap-1.5 rounded-m3-xs border-[1.5px] px-2.5 py-1 text-[11px] font-black s-press',
              'transition-colors duration-m3-fast ease-m3-std',
              showExplanation
                ? 'border-transparent bg-primary-container text-on-primary-container'
                : 'border-outline-variant text-on-surface-variant hover:bg-state-hover',
            )}
          >
            <BookOpen size={12} strokeWidth={3} />
            {t.explanation}
            <ChevronDown
              size={12}
              strokeWidth={3}
              className={cn('transition-transform', showExplanation && 'rotate-180')}
            />
          </button>

          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 border-t border-outline-variant pt-2 text-[12px] font-medium text-on-surface-variant"
            >
              <MathText text={pick(q.explanation)} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
