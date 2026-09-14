// app/(student)/raschmodel/_components/ExamRunner.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Flag, ChevronLeft, ChevronRight, Send, Circle, Database, Maximize,
  ShieldAlert,
} from 'lucide-react';

import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { Button, Card, Dialog, cn } from '@/components/student-ui';
import { useExamLockdown } from '@/hooks/useExamLockdown';
import { examMode, examOptionKeys, examSlotCount, hasExamAnswer, partKey } from '@/lib/ExamTeacher';
import type { ExamQuestion } from '@/types/Exam';
import type { Lang, LocalizedText } from '@/types/Math';

/**
 * THE paper being sat — the timer bar, the navigator, the question card and the
 * prev/next/submit row, for every Rasch sitting there is.
 *
 * It exists once because the three callers must agree: the 45-question mock exam
 * (`/raschmodel/exam`), a teacher-built maths paper opened by its 6-digit code
 * (`/raschmodel/quiz`, docs/RASCH_QUIZ.md) and a Milliy sertifikat subject paper
 * (`/milliy-sertifikat`, docs/MILLIY_QUIZ.md) render the SAME `ExamQuestion`
 * shape — bank items, teacher items with images, `shared_options` pools and
 * `multi_part` blocks. Copies would drift the moment one was touched, and the
 * thing that drifts would be how a block is answered.
 *
 * It owns no paper state. Answers, flags, the current index and the clock all
 * live in the page, which is what persists them; this component only renders and
 * calls back. The two exceptions are the submit confirmation and the lockdown
 * counter, both purely view concerns that are never persisted.
 *
 * ## Full screen + lockdown (2026-07-30)
 *
 * ⚠️ **This component is a `fixed inset-0` overlay**, above the student shell. It
 * is not laid out inside the page any more: a paper being sat covers the nav, the
 * topbar and the mobile dock, so there is nothing in the app to click away to.
 * That is why callers must NOT wrap it in a `<Page>` — it renders its own.
 *
 * The interruption guard lives HERE rather than in the three pages, so every
 * sitting gets identical behaviour: see `hooks/useExamLockdown.ts`, and read its
 * header for exactly what a browser can and cannot enforce (short version: this
 * detects and deters, it cannot prevent a second tab).
 */

/** Question content carries $...$ LaTeX — LatexRenderer wraps the bundled katex
 *  build the rest of the app already renders questions with. */
export function MathText({ text, className }: { text: string; className?: string }) {
  return <LatexRenderer latex={text} className={className} />;
}

/**
 * Teacher questions are authored uz-only (`tri(uz)` leaves ru/en empty), so a
 * student who picked Russian or English would otherwise see blank stems. Falls
 * back to whatever language the doc actually has.
 */
export const pickLangText = (
  lang: Lang,
  tx?: { uz?: string; ru?: string; en?: string } | null,
): string => (tx?.[lang] || tx?.uz || tx?.ru || tx?.en || '') as string;

export const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * The question language offered before a paper starts — deliberately separate
 * from the app UI language, and fixed for the life of the paper. Lives here
 * because both intro screens (mock exam, teacher quiz) present the same choice
 * and it feeds the same `examLang` this component renders with.
 */
export const QUESTION_LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    question: 'Savol', of: '/', flag: 'Belgilash', next: 'Keyingi', prev: 'Oldingi',
    submit: 'Testni yakunlash',
    submitConfirm: "Testni yakunlashni tasdiqlaysizmi? Javoblarni o'zgartirib bo'lmaydi.",
    yes: 'Ha, yakunlash', cancel: 'Bekor qilish',
    openLabel: 'Javobingizni yozing',
    openPlaceholder: 'Masalan: 16  yoki  4pi*sqrt(3)',
    openHint: "Javobni matn ko'rinishida kiriting.",
    sharedPool: 'Umumiy variantlar',
    focusTitle: 'Testdan chiqdingiz!',
    focusDesc: 'Test davomida boshqa oyna, ilova yoki sahifaga o‘tish mumkin emas. Bu holat qayd etildi. Testni to‘liq ekranda, chalg‘imasdan davom ettiring.',
    focusBtn: 'Testga qaytish',
    focusCount: 'Chiqishlar',
    fullscreen: "To'liq ekran",
  },
  ru: {
    question: 'Вопрос', of: '/', flag: 'Отметить', next: 'Далее', prev: 'Назад',
    submit: 'Завершить тест',
    submitConfirm: 'Вы уверены, что хотите завершить тест? Ответы изменить будет нельзя.',
    yes: 'Да, завершить', cancel: 'Отмена',
    openLabel: 'Введите ваш ответ',
    openPlaceholder: 'Например: 16  или  4pi*sqrt(3)',
    openHint: 'Введите ответ текстом.',
    sharedPool: 'Общие варианты',
    focusTitle: 'Вы покинули тест!',
    focusDesc: 'Во время теста нельзя переходить в другое окно, приложение или на другую страницу. Это зафиксировано. Продолжайте тест в полном экране, не отвлекаясь.',
    focusBtn: 'Вернуться к тесту',
    focusCount: 'Выходы',
    fullscreen: 'Полный экран',
  },
  en: {
    question: 'Question', of: 'of', flag: 'Flag', next: 'Next', prev: 'Previous',
    submit: 'Submit test',
    submitConfirm: "Are you sure you want to submit? You won't be able to change your answers.",
    yes: 'Yes, submit', cancel: 'Cancel',
    openLabel: 'Type your answer',
    openPlaceholder: 'e.g. 16  or  4pi*sqrt(3)',
    openHint: 'No options are given. Type the answer — spaces and brackets are ignored.',
    sharedPool: 'Shared options',
    focusTitle: 'You left the exam!',
    focusDesc: 'Switching to another window, app or page during the exam is not allowed. This has been recorded. Continue the exam in full screen, without distractions.',
    focusBtn: 'Back to the exam',
    focusCount: 'Exits',
    fullscreen: 'Full screen',
  },
};

export interface ExamRunnerProps {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  flagged: Set<string>;
  current: number;
  /** Exam SLOTS, not cards — a `shared_options` block is worth one per part. */
  totalQuestions: number;
  secondsLeft: number;
  /** Fixed for the life of the paper — NOT the app UI language. */
  examLang: Lang;
  appLang: Lang;
  /** The line above the navigator: where this paper came from. */
  provenance?: string;
  onAnswer: (key: string, value: string) => void;
  onToggleFlag: (questionId: string) => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
}

export default function ExamRunner({
  questions, answers, flagged, current, totalQuestions, secondsLeft,
  examLang, appLang, provenance,
  onAnswer, onToggleFlag, onGoTo, onSubmit,
}: ExamRunnerProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const t = UI[appLang];

  /**
   * ⚠️ Called BEFORE the `!q` early return — Rules of Hooks. `active` is tied to
   * the runner being mounted at all: the pages unmount it the moment the paper is
   * submitted, which is what releases full screen and the beforeunload prompt.
   */
  const { interruptions, warned, dismiss, isFullscreen, enterFullscreen } = useExamLockdown({
    active: true,
  });

  const q = questions[current];
  if (!q) return null;

  const pick = (tx?: LocalizedText | null) => pickLangText(examLang, tx);
  const isFlagged = flagged.has(q.id);
  const lowTime = secondsLeft <= 5 * 60;
  // A teacher item renders by its real type (block / typed / options); a
  // questions1 item by its section (O = typed, otherwise A–D options).
  const mode = examMode(q);
  const optionKeys = examOptionKeys(q);
  const qOptions = q.options as Record<string, LocalizedText>;

  return (
    /* ⚠️ A FIXED, FULL-VIEWPORT overlay above the student shell (z-[100], the same
       layer the IELTS runner uses). A paper being sat covers the nav, the topbar
       and the mobile dock, so there is nothing in the app to wander off to — which
       is half of "don't open another page". The other half is useExamLockdown. */
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">

      {/* ⚠️ Deliberately NOT a <Dialog>: a dialog can be dismissed by its scrim or
          by Escape, and Escape is exactly the key that just dropped the student out
          of full screen. Only the button clears this. */}
      {warned && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-scrim-bg p-4 backdrop-blur-md">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-m3-xl bg-surface-container-high p-7 text-center shadow-elev-3"
          >
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-m3-lg bg-error-container text-on-error-container">
              <ShieldAlert size={32} strokeWidth={2.5} />
            </div>
            <h2 className="s-display mb-2 text-[20px] font-bold text-on-surface">{t.focusTitle}</h2>
            <p className="mb-2 text-[13.5px] font-bold leading-relaxed text-on-surface-variant">{t.focusDesc}</p>
            <p className="s-num mb-6 text-[12px] font-black uppercase tracking-wider text-error">
              {t.focusCount}: {interruptions}
            </p>
            <Button
              fullWidth
              size="lg"
              tone="error"
              onClick={() => { dismiss(); enterFullscreen(); }}
            >
              {t.focusBtn}
            </Button>
          </div>
        </div>
      )}

      {/* Header: progress · exit counter · full-screen · timer. No back button and
          no close — leaving is the submit button, or the clock. */}
      <header className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface px-3 py-2.5 sm:px-4">
        <span className="s-num text-[13px] font-black">
          {t.question} {q.slotNumber}{examSlotCount(q) > 1 ? `–${q.slotNumber + examSlotCount(q) - 1}` : ''}{t.of}{totalQuestions}
        </span>

        <div className="flex items-center gap-1.5">
          {/* The count IS the deterrent — a browser cannot block a second tab, so
              the student sees that leaving was noticed. */}
          {interruptions > 0 && (
            <span className="s-num flex items-center gap-1 rounded-m3-sm bg-error-container px-2 py-1.5 text-[12px] font-black text-on-error-container">
              <ShieldAlert size={13} strokeWidth={3} />
              {interruptions}×
            </span>
          )}

          {/* Only shown when NOT full screen: the browser may have refused the
              request (it needs a user gesture), or the student pressed Escape.
              This button is a gesture, so it always works. */}
          {!isFullscreen && (
            <button
              type="button"
              onClick={enterFullscreen}
              title={t.fullscreen}
              aria-label={t.fullscreen}
              className="s-press flex items-center gap-1.5 rounded-m3-sm bg-surface-container-high px-2.5 py-1.5 text-[12px] font-black text-on-surface-variant"
            >
              <Maximize size={13} strokeWidth={3} />
              <span className="hidden sm:inline">{t.fullscreen}</span>
            </button>
          )}

          <div className={cn(
            's-num flex items-center gap-1.5 rounded-m3-sm px-3 py-1.5 text-[13px] font-black',
            lowTime ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container',
          )}>
            <Clock size={14} strokeWidth={3} />
            {formatTime(secondsLeft)}
          </div>
        </div>
      </header>

      {/* The only scroll container. `overscroll-contain` stops a swipe at the end
          of the paper from bouncing the page behind the overlay. */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex max-w-4xl flex-col gap-s-section px-s-page-x py-s-page-y">
        {provenance && (
          <div className="flex items-center gap-2 text-[12px] font-bold text-on-surface-variant">
            <Database size={12} strokeWidth={3} />
            {provenance}
          </div>
        )}

        {/* Question navigator */}
        <Card variant="outlined" className="rounded-m3-md p-4">
          <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
            {questions.map((qq, i) => {
              const isDone = hasExamAnswer(qq, answers);
              const isCurrent = i === current;
              const isFlag = flagged.has(qq.id);
              return (
                <button
                  key={qq.id}
                  onClick={() => onGoTo(i)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    's-num relative flex aspect-square items-center justify-center rounded-m3-xs text-[11px] font-black',
                    'transition-colors duration-m3-fast ease-m3-std',
                    isCurrent
                      ? 'bg-primary text-on-primary'
                      : isDone
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-surface-container-high text-on-surface-variant',
                  )}
                >
                  {qq.slotNumber}
                  {isFlag && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-gold" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Question card */}
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-s-card sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="min-w-0 truncate rounded-m3-xs bg-surface-container-high px-2.5 py-1 text-[11px] font-black text-on-surface-variant">
                {q.chapter} · {q.testType}
              </span>
              <button
                onClick={() => onToggleFlag(q.id)}
                aria-pressed={isFlagged}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-m3-sm px-3 py-1.5 text-[12px] font-black s-press',
                  'transition-colors duration-m3-fast ease-m3-std',
                  isFlagged ? 'bg-gold-container text-on-gold-container' : 'bg-surface-container-high text-on-surface-variant',
                )}
              >
                <Flag size={13} strokeWidth={3} /> {t.flag}
              </button>
            </div>

            {/* Block stem — the statement several sub-questions share (a split-out
                shared_options item carries it so it is never dropped). */}
            {pick(q.stem) && (
              <MathText text={pick(q.stem)} className="mb-3 block text-[15px] font-semibold leading-snug text-on-surface-variant" />
            )}

            <MathText text={pick(q.question)} className="mb-4 block text-[16px] font-bold leading-snug" />

            {/* Prompt image (teacher questions — e.g. a geometry diagram). */}
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="mb-5 max-h-72 w-auto rounded-m3-md border border-outline-variant bg-surface object-contain" />
            )}

            <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mb-4 text-on-surface-variant" />

            {mode === 'open' ? (
              // Typed answer: a questions1 O item (options hidden, graded by
              // Examanswers) or a teacher open/numeric item (graded on its text).
              <div className="flex flex-col gap-2">
                <label htmlFor="open-answer" className="text-[12px] font-black uppercase tracking-wider text-on-surface-variant">
                  {t.openLabel}
                </label>
                <input
                  id="open-answer"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  placeholder={t.openPlaceholder}
                  className="w-full rounded-m3-sm border-[1.5px] border-outline bg-surface-container-low px-4 py-3.5 text-[16px] font-bold text-on-surface transition-colors duration-m3-fast ease-m3-std placeholder:font-medium placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                />
                <p className="text-[12px] font-bold text-on-surface-variant">{t.openHint}</p>
              </div>
            ) : mode === 'block' ? (
              // A block: one card, several sub-questions.
              //   • shared_options — the A–F pool is printed ONCE below, then each
              //     sub-question is a compact row of letter buttons, and every
              //     sub-question counts as its own exam question (slots 33-35…).
              //   • multi_part     — each part carries its own options/typed answer,
              //     and the whole block counts as one question.
              <div className="flex flex-col gap-4">
                {q.qType === 'shared_options' && optionKeys.length > 0 && (
                  <div className="rounded-m3-md border border-outline-variant bg-surface-container-low p-4">
                    <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{t.sharedPool}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {optionKeys.map((opt) => (
                        <div key={opt} className="flex items-start gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-m3-xs bg-surface-container-high text-[12px] font-black text-on-surface-variant">{opt}</span>
                          <span className="min-w-0 pt-1 text-[13px] font-bold">
                            <MathText text={pick(qOptions[opt])} />
                            {q.optionImages?.[opt] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={q.optionImages[opt]!} alt={opt} className="mt-1 max-h-24 w-auto rounded-m3-xs border border-outline-variant bg-surface object-contain" />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(q.parts ?? []).map((p, pi) => {
                  const key = partKey(q.id, p.id);
                  const isTyped = p.optionKeys.length === 0;
                  const pooled = q.qType === 'shared_options';
                  // A shared_options sub-question is numbered by its exam slot
                  // (33, 34, 35); a multi_part part keeps its letter (a, b, c).
                  const badge = pooled ? String(q.slotNumber + pi) : (p.id || String(pi + 1));
                  return (
                    <div key={p.id} className="rounded-m3-md border border-outline-variant p-4">
                      <div className="mb-3 flex items-start gap-2">
                        <span className="s-num flex h-6 min-w-6 shrink-0 items-center justify-center rounded-m3-xs bg-primary-container px-1.5 text-[11px] font-black text-on-primary-container">{badge}</span>
                        <MathText text={pick(p.prompt)} className="text-[14px] font-bold" />
                      </div>
                      {isTyped ? (
                        <input
                          type="text"
                          inputMode="text"
                          autoComplete="off"
                          value={answers[key] ?? ''}
                          onChange={(e) => onAnswer(key, e.target.value)}
                          placeholder={t.openPlaceholder}
                          className="w-full rounded-m3-sm border-[1.5px] border-outline bg-surface-container-low px-4 py-3 text-[15px] font-bold text-on-surface transition-colors duration-m3-fast ease-m3-std placeholder:font-medium placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                        />
                      ) : pooled ? (
                        // Shared pool already printed above — just the letters here.
                        <div className="flex flex-wrap gap-2">
                          {p.optionKeys.map((opt) => {
                            const selected = answers[key] === opt;
                            return (
                              <button
                                key={opt}
                                onClick={() => onAnswer(key, opt)}
                                aria-pressed={selected}
                                className={cn(
                                  'h-11 w-11 rounded-m3-sm text-[14px] font-black s-press',
                                  'transition-colors duration-m3-fast ease-m3-std',
                                  selected
                                    ? 'bg-primary text-on-primary'
                                    : 'border-[1.5px] border-outline-variant text-on-surface-variant hover:bg-state-hover',
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {p.optionKeys.map((opt) => {
                            const selected = answers[key] === opt;
                            const img = p.optionImages?.[opt];
                            return (
                              <button
                                key={opt}
                                onClick={() => onAnswer(key, opt)}
                                aria-pressed={selected}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-m3-md border-[1.5px] p-3 text-left',
                                  'transition-colors duration-m3-fast ease-m3-std',
                                  selected
                                    ? 'border-primary bg-primary-container text-on-primary-container'
                                    : 'border-outline-variant hover:bg-state-hover',
                                )}
                              >
                                <span className={cn(
                                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-m3-xs text-[12px] font-black',
                                  selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                                )}>{opt}</span>
                                <span className="min-w-0">
                                  <MathText text={pick(p.options[opt])} className="text-[14px] font-bold" />
                                  {img && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={img} alt={opt} className="mt-1 max-h-28 w-auto rounded-m3-xs border border-outline-variant bg-surface object-contain" />
                                  )}
                                </span>
                                {selected ? <Circle className="ml-auto shrink-0 fill-current text-primary" size={15} /> : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Closed: option buttons over the item's own keys (A–D for a
              // questions1 item, up to A–F for a teacher shared pool).
              <div className="flex flex-col gap-2.5">
                {optionKeys.map((opt) => {
                  const selected = answers[q.id] === opt;
                  const img = q.optionImages?.[opt];
                  return (
                    <button
                      key={opt}
                      onClick={() => onAnswer(q.id, opt)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-m3-md border-[1.5px] p-3.5 text-left',
                        'transition-colors duration-m3-fast ease-m3-std',
                        selected
                          ? 'border-primary bg-primary-container text-on-primary-container'
                          : 'border-outline-variant hover:bg-state-hover',
                      )}
                    >
                      <span className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-m3-xs text-[13px] font-black',
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                      )}>
                        {opt}
                      </span>
                      <span className="min-w-0">
                        <MathText text={pick(qOptions[opt])} className="text-[14px] font-bold" />
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={opt} className="mt-1 max-h-32 w-auto rounded-m3-xs border border-outline-variant bg-surface object-contain" />
                        )}
                      </span>
                      {selected ? <Circle className="ml-auto shrink-0 fill-current text-primary" size={16} /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Prev / Next / Submit */}
        <div className="flex items-center gap-3">
          <Button
            variant="outlined"
            onClick={() => onGoTo(Math.max(0, current - 1))}
            disabled={current === 0}
            icon={<ChevronLeft size={16} strokeWidth={3} />}
          >
            {t.prev}
          </Button>

          {current < questions.length - 1 ? (
            <Button
              tone="secondary"
              onClick={() => onGoTo(Math.min(questions.length - 1, current + 1))}
              trailingIcon={<ChevronRight size={16} strokeWidth={3} />}
              className="flex-1"
            >
              {t.next}
            </Button>
          ) : (
            <Button
              onClick={() => setShowConfirm(true)}
              icon={<Send size={15} strokeWidth={3} />}
              className="flex-1"
            >
              {t.submit}
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Confirm submit modal */}
      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        actions={
          <>
            <Button variant="text" onClick={() => setShowConfirm(false)}>
              {t.cancel}
            </Button>
            <Button onClick={() => { setShowConfirm(false); onSubmit(); }}>
              {t.yes}
            </Button>
          </>
        }
      >
        {t.submitConfirm}
      </Dialog>
    </div>
  );
}
