"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calculator, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Flag,
  Grid3x3, Maximize, Ruler, ShieldAlert,
} from "lucide-react";

import LatexRenderer from "@/components/LatexRenderer";
import { Button, Dialog, IconButton, cn } from "@/components/student-ui";
import { useExamLockdown } from "@/hooks/useExamLockdown";
import { isSatItemCorrect } from "@/lib/SatMathQuiz";
import { estimateScaledScore } from "@/lib/SATscore";
import { saveSatMathResult } from "@/services/satMathQuizService";
import SatCalculator from "./SatCalculator";
import SatReferenceSheet from "./SatReferenceSheet";
import type { SatExamSnapshot, SatMathDomain, SatMathResult, SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * The Bluebook-style adaptive SAT Math sitting: Module 1, then (after the
 * transition screen decides the route) Module 2 — Easier or Harder. Contract:
 * docs/SAT_QUIZ.md.
 *
 * ⚠️ A `fixed inset-0 z-[100]` overlay, the same convention `ExamRunner`
 * follows (STUDENT.md's exam-lockdown contract) — callers must NOT wrap it in
 * a `<Page>`. `useExamLockdown` is reused unchanged; this component adds no
 * anti-cheat logic of its own.
 *
 * Fully controlled: `snapshot` is the whole sitting, `onChange` persists every
 * mutation (the caller writes it to `lib/SatSession.ts`), `onSubmit` fires
 * once grading is done and the result is saved. Local UI-only state (timer
 * visibility, calculator/reference panel, dialogs) stays inside this
 * component — it does not need to survive a reload.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    module1: "Modul 1: Matematika", module2: "Modul 2: Matematika",
    question: "Savol", of: "/",
    flag: "Belgilash", flagged: "Belgilangan",
    prev: "Oldingi", next: "Keyingi",
    continueModule: "Modulni yakunlash", continueConfirm: "Modulni yakunlaysizmi? Bu modulga qaytib bo'lmaydi.",
    yes: "Ha, yakunlash", cancel: "Bekor qilish",
    reviewTitle: "Ko'rib chiqish", reviewUnanswered: "Javobsiz", reviewAnswered: "Javob berilgan", reviewFlagged: "Belgilangan",
    transitionTitle: "Modul 1 yakunlandi", transitionBody: "Endi Modul 2 boshlanadi. Modul 1 natijasi ko'rsatilmaydi — bu haqiqiy raqamli SAT'ga xos xususiyat.",
    startModule2: "Modul 2'ni boshlash",
    numericLabel: "Javobingizni kiriting",
    calculator: "Kalkulyator", reference: "Formulalar",
    navigator: "Savollar ro'yxati",
    hideTime: "Vaqtni yashirish", showTime: "Vaqtni ko'rsatish",
    fullscreen: "To'liq ekran",
    focusTitle: "Testdan chiqdingiz!",
    focusDesc: "Test davomida boshqa oyna yoki ilovaga o'tish mumkin emas. Bu holat qayd etildi.",
    focusBtn: "Testga qaytish", focusCount: "Chiqishlar",
  },
  ru: {
    module1: "Модуль 1: Математика", module2: "Модуль 2: Математика",
    question: "Вопрос", of: "/",
    flag: "Отметить", flagged: "Отмечено",
    prev: "Назад", next: "Далее",
    continueModule: "Завершить модуль", continueConfirm: "Завершить модуль? Вернуться в него будет нельзя.",
    yes: "Да, завершить", cancel: "Отмена",
    reviewTitle: "Проверка", reviewUnanswered: "Без ответа", reviewAnswered: "Отвечено", reviewFlagged: "Отмечено",
    transitionTitle: "Модуль 1 завершён", transitionBody: "Сейчас начнётся Модуль 2. Результат Модуля 1 не показывается — так устроен настоящий цифровой SAT.",
    startModule2: "Начать Модуль 2",
    numericLabel: "Введите ваш ответ",
    calculator: "Калькулятор", reference: "Формулы",
    navigator: "Список вопросов",
    hideTime: "Скрыть время", showTime: "Показать время",
    fullscreen: "Полный экран",
    focusTitle: "Вы покинули тест!",
    focusDesc: "Во время теста нельзя переходить в другое окно или приложение. Это зафиксировано.",
    focusBtn: "Вернуться к тесту", focusCount: "Выходы",
  },
  en: {
    module1: "Module 1: Math", module2: "Module 2: Math",
    question: "Question", of: "of",
    flag: "Mark for Review", flagged: "Flagged",
    prev: "Back", next: "Next",
    continueModule: "Finish module", continueConfirm: "Finish this module? You can't come back to it.",
    yes: "Yes, finish", cancel: "Cancel",
    reviewTitle: "Review", reviewUnanswered: "Unanswered", reviewAnswered: "Answered", reviewFlagged: "Flagged",
    transitionTitle: "Module 1 complete", transitionBody: "Module 2 starts now. Module 1's result isn't shown — that's how the real digital SAT works too.",
    startModule2: "Start Module 2",
    numericLabel: "Enter your answer",
    calculator: "Calculator", reference: "Reference",
    navigator: "Question list",
    hideTime: "Hide time", showTime: "Show time",
    fullscreen: "Full screen",
    focusTitle: "You left the test!",
    focusDesc: "Switching to another window or app during the test is not allowed. This has been recorded.",
    focusBtn: "Back to the test", focusCount: "Exits",
  },
};

const formatTime = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export interface SatRunnerProps {
  uid: string;
  studentName: string;
  snapshot: SatExamSnapshot;
  appLang: Lang;
  onChange: (next: SatExamSnapshot) => void;
  onSubmit: (result: SatMathResult, finished: SatExamSnapshot) => void;
}

export default function SatRunner({ uid, studentName, snapshot, appLang, onChange, onSubmit }: SatRunnerProps) {
  const t = UI[appLang] || UI.uz;
  const L = snapshot.examLang;

  // A tick-driven re-render for the countdown — the value itself is never
  // read, only the fact that it changed once a second.
  const [, setTick] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { interruptions, warned, dismiss, isFullscreen, enterFullscreen } = useExamLockdown({
    active: snapshot.phase !== "submitted",
  });

  const module2Pool = useMemo(
    () => (snapshot.route === "harder" ? snapshot.module2Harder : snapshot.module2Easier),
    [snapshot.route, snapshot.module2Harder, snapshot.module2Easier],
  );

  const items: SatQuizItem[] = snapshot.phase === "module1" || snapshot.phase === "module1-review"
    ? snapshot.module1
    : module2Pool;
  const answers = snapshot.phase === "module1" || snapshot.phase === "module1-review"
    ? snapshot.module1Answers : snapshot.module2Answers;
  const flagged = snapshot.phase === "module1" || snapshot.phase === "module1-review"
    ? snapshot.module1Flagged : snapshot.module2Flagged;
  const endsAt = snapshot.phase === "module1" ? snapshot.module1EndsAt : snapshot.module2EndsAt;
  const secondsLeft = Math.max(0, Math.round((endsAt - Date.now()) / 1000));

  const setAnswers = (next: Record<string, string>) => {
    if (snapshot.phase === "module1") onChange({ ...snapshot, module1Answers: next });
    else onChange({ ...snapshot, module2Answers: next });
  };
  const setFlagged = (next: string[]) => {
    if (snapshot.phase === "module1") onChange({ ...snapshot, module1Flagged: next });
    else onChange({ ...snapshot, module2Flagged: next });
  };
  const setCurrent = (index: number) => onChange({ ...snapshot, current: index });

  const finishModule1 = () => {
    const correct = snapshot.module1.filter((q) => isSatItemCorrect(q, snapshot.module1Answers[q.id])).length;
    const route = correct >= snapshot.routingThreshold ? "harder" as const : "easier" as const;
    onChange({ ...snapshot, phase: "transition", route });
  };

  const startModule2 = () => {
    onChange({
      ...snapshot,
      phase: "module2",
      current: 0,
      module2EndsAt: Date.now() + snapshot.module2Minutes * 60_000,
    });
  };

  const finalize = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const pool = snapshot.route === "harder" ? snapshot.module2Harder : snapshot.module2Easier;
      const module1Correct = snapshot.module1.filter((q) => isSatItemCorrect(q, snapshot.module1Answers[q.id])).length;
      const module2Correct = pool.filter((q) => isSatItemCorrect(q, snapshot.module2Answers[q.id])).length;
      const correct = module1Correct + module2Correct;
      const total = snapshot.module1.length + pool.length;
      const scaledScore = estimateScaledScore(snapshot.route ?? "easier", correct, total);

      const itemOutcomes: Record<string, number> = {};
      const domains: Partial<Record<SatMathDomain, { correct: number; total: number }>> = {};
      for (const q of snapshot.module1) {
        const ok = isSatItemCorrect(q, snapshot.module1Answers[q.id]) ? 1 : 0;
        itemOutcomes[q.id] = ok;
        const d = domains[q.domain] ?? { correct: 0, total: 0 };
        domains[q.domain] = { correct: d.correct + ok, total: d.total + 1 };
      }
      for (const q of pool) {
        const ok = isSatItemCorrect(q, snapshot.module2Answers[q.id]) ? 1 : 0;
        itemOutcomes[q.id] = ok;
        const d = domains[q.domain] ?? { correct: 0, total: 0 };
        domains[q.domain] = { correct: d.correct + ok, total: d.total + 1 };
      }

      const result: SatMathResult = {
        testId: snapshot.testId,
        testTitle: snapshot.testTitle,
        teacherId: snapshot.teacherId,
        studentId: uid,
        studentName,
        module1Correct,
        module1Total: snapshot.module1.length,
        route: snapshot.route ?? "easier",
        module2Correct,
        module2Total: pool.length,
        correct,
        total,
        scaledScore,
        durationSec: Math.max(0, Math.round((Date.now() - snapshot.startedAt) / 1000)),
        submittedAt: Date.now(),
        examLang: snapshot.examLang,
        items: itemOutcomes,
        domains,
      };

      await saveSatMathResult(result);
      const finished: SatExamSnapshot = { ...snapshot, phase: "submitted" };
      onChange(finished);
      // ⚠️ Passes the finished snapshot alongside the result — `onSubmit` fires
      // from inside this async function, so it must not rely on the page's
      // `snapshot` prop being fresh; the page may not have re-rendered yet.
      onSubmit(result, finished);
    } finally {
      setSaving(false);
    }
  };

  // Auto-advance on timeout — matches the real test's own behaviour (a module
  // ends when the clock does, with no extra review step to skip through).
  useEffect(() => {
    if (snapshot.phase === "module1" && secondsLeft <= 0) finishModule1();
    if (snapshot.phase === "module2" && secondsLeft <= 0) finalize();
    // Only the tick that reaches zero should fire this; re-running on every
    // snapshot change would refire mid-transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft <= 0, snapshot.phase]);

  // ── transition screen (Module 1 → Module 2) ─────────────────────────────
  if (snapshot.phase === "transition") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <h1 className="text-[22px] font-black text-on-surface">{t.transitionTitle}</h1>
        <p className="max-w-sm text-[14px] font-medium leading-relaxed text-on-surface-variant">{t.transitionBody}</p>
        <Button size="lg" onClick={startModule2}>{t.startModule2}</Button>
      </div>
    );
  }

  // ── review screen (end of a module) ──────────────────────────────────────
  if (snapshot.phase === "module1-review" || snapshot.phase === "module2-review") {
    const reviewItems = snapshot.phase === "module1-review" ? snapshot.module1 : module2Pool;
    const reviewAnswers = snapshot.phase === "module1-review" ? snapshot.module1Answers : snapshot.module2Answers;
    const reviewFlagged = new Set(snapshot.phase === "module1-review" ? snapshot.module1Flagged : snapshot.module2Flagged);
    const backToActive = () => onChange({ ...snapshot, phase: snapshot.phase === "module1-review" ? "module1" : "module2" });
    const finishThisModule = () => (snapshot.phase === "module1-review" ? finishModule1() : finalize());

    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
          <h1 className="text-[15px] font-black text-on-surface">{t.reviewTitle}</h1>
          <Button size="sm" variant="text" onClick={backToActive}>{t.prev}</Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-2xl grid-cols-5 gap-2 sm:grid-cols-8">
            {reviewItems.map((q, i) => {
              const answered = !!reviewAnswers[q.id];
              const isFlag = reviewFlagged.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => { setCurrent(i); backToActive(); }}
                  className={cn(
                    "relative flex h-12 items-center justify-center rounded-m3-md border text-[13px] font-black",
                    answered ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
                  )}
                >
                  {i + 1}
                  {isFlag && <Flag size={10} className="absolute right-1 top-1 fill-warning text-warning" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 border-t border-outline-variant bg-surface-container-low px-4 py-3">
          <Button fullWidth size="lg" loading={saving} onClick={() => setConfirmFinish(true)}>
            {t.continueModule}
          </Button>
        </div>

        <Dialog
          open={confirmFinish}
          onClose={() => setConfirmFinish(false)}
          title={t.continueModule}
          actions={
            <>
              <Button variant="text" onClick={() => setConfirmFinish(false)}>{t.cancel}</Button>
              <Button loading={saving} onClick={() => { setConfirmFinish(false); finishThisModule(); }}>{t.yes}</Button>
            </>
          }
        >
          <p className="text-[13px] font-medium text-on-surface-variant">{t.continueConfirm}</p>
        </Dialog>
      </div>
    );
  }

  // ── active module ────────────────────────────────────────────────────────
  const q = items[snapshot.current];
  if (!q) return null;
  const isFlagged = flagged.includes(q.id);
  const crossed = new Set(snapshot.crossedOut[q.id] ?? []);
  const lowTime = secondsLeft <= 5 * 60;

  const toggleCross = (letter: string) => {
    const cur = new Set(snapshot.crossedOut[q.id] ?? []);
    if (cur.has(letter)) cur.delete(letter); else cur.add(letter);
    onChange({ ...snapshot, crossedOut: { ...snapshot.crossedOut, [q.id]: [...cur] } });
  };
  const answer = (value: string) => setAnswers({ ...answers, [q.id]: value });
  const toggleFlag = () => setFlagged(isFlagged ? flagged.filter((id) => id !== q.id) : [...flagged, q.id]);
  const goto = (delta: number) => {
    const next = snapshot.current + delta;
    if (next < 0) return;
    if (next >= items.length) {
      onChange({ ...snapshot, phase: snapshot.phase === "module1" ? "module1-review" : "module2-review" });
      return;
    }
    setCurrent(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
      {warned && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-scrim-bg p-4 backdrop-blur-md">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-m3-xl bg-surface-container-high p-7 text-center shadow-elev-3">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-m3-lg bg-error-container text-on-error-container">
              <ShieldAlert size={32} strokeWidth={2.5} />
            </div>
            <h2 className="mb-2 text-[20px] font-bold text-on-surface">{t.focusTitle}</h2>
            <p className="mb-2 text-[13.5px] font-bold leading-relaxed text-on-surface-variant">{t.focusDesc}</p>
            <p className="mb-6 text-[12px] font-black uppercase tracking-wider text-error">{t.focusCount}: {interruptions}</p>
            <Button fullWidth size="lg" tone="error" onClick={() => { dismiss(); enterFullscreen(); }}>
              {t.focusBtn}
            </Button>
          </div>
        </div>
      )}

      <header className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface px-3 py-2.5 sm:px-4">
        <span className="text-[13px] font-black text-on-surface">
          {snapshot.phase === "module1" ? t.module1 : t.module2}
        </span>

        <div className="flex items-center gap-1.5">
          {interruptions > 0 && (
            <span className="flex items-center gap-1 rounded-m3-sm bg-error-container px-2 py-1.5 text-[12px] font-black text-on-error-container">
              <ShieldAlert size={13} strokeWidth={3} /> {interruptions}×
            </span>
          )}
          {!isFullscreen && (
            <IconButton aria-label={t.fullscreen} size="sm" onClick={enterFullscreen}><Maximize /></IconButton>
          )}
          <IconButton aria-label={t.calculator} size="sm" onClick={() => setShowCalc((v) => !v)}><Calculator /></IconButton>
          <IconButton aria-label={t.reference} size="sm" onClick={() => setShowRef(true)}><Ruler /></IconButton>
          <button
            type="button"
            onClick={() => setShowTimer((v) => !v)}
            title={showTimer ? t.hideTime : t.showTime}
            className={cn(
              "flex items-center gap-1.5 rounded-m3-sm px-3 py-1.5 text-[13px] font-black",
              lowTime && showTimer ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container",
            )}
          >
            {showTimer ? <Clock size={14} strokeWidth={3} /> : <EyeOff size={14} strokeWidth={3} />}
            {showTimer ? formatTime(secondsLeft) : "--:--"}
          </button>
        </div>
      </header>

      {showCalc && (
        <div className="absolute right-3 top-14 z-40 sm:right-4">
          <SatCalculator onClose={() => setShowCalc(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] font-black uppercase tracking-wider text-on-surface-variant">
              {t.question} {snapshot.current + 1}{t.of}{items.length}
            </span>
            <button
              onClick={toggleFlag}
              className={cn(
                "flex items-center gap-1.5 rounded-m3-sm px-2.5 py-1.5 text-[12px] font-bold",
                isFlagged ? "bg-warning-container text-on-warning-container" : "bg-surface-container text-on-surface-variant",
              )}
            >
              <Flag size={13} className={isFlagged ? "fill-current" : undefined} />
              {isFlagged ? t.flagged : t.flag}
            </button>
          </div>

          <div className="mb-5 text-[15px] font-medium leading-relaxed text-on-surface">
            <LatexRenderer latex={q.question[L] || q.question.uz || ""} />
          </div>
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.imageUrl} alt="" className="mb-5 max-h-72 w-auto rounded-m3-md border border-outline-variant" />
          )}

          {q.qType === "mcq" ? (
            <div className="flex flex-col gap-2.5">
              {q.optionKeys.map((letter) => {
                const selected = answers[q.id] === letter;
                const isCrossed = crossed.has(letter);
                return (
                  <div
                    key={letter}
                    onClick={() => answer(letter)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-m3-lg border-2 p-3.5 transition-colors",
                      selected ? "border-primary bg-primary-container" : "border-outline-variant bg-surface-container-lowest",
                      isCrossed && "opacity-50",
                    )}
                  >
                    <span className={cn(
                      "flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-[13px] font-black",
                      selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant",
                    )}>
                      {letter}
                    </span>
                    <span className={cn("min-w-0 flex-1 text-[14px] font-medium text-on-surface", isCrossed && "line-through")}>
                      <LatexRenderer latex={q.options[letter]?.[L] || q.options[letter]?.uz || ""} />
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCross(letter); }}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
                      aria-label="cross out"
                    >
                      {isCrossed ? <Eye size={14} /> : <span className="text-[11px] font-black underline">{letter}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-on-surface-variant">{t.numericLabel}</label>
              <input
                type="text"
                inputMode="decimal"
                value={answers[q.id] ?? ""}
                onChange={(e) => answer(e.target.value)}
                className="w-full max-w-xs rounded-m3-lg border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-[16px] font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="z-30 flex shrink-0 items-center gap-2 border-t border-outline-variant bg-surface-container-low px-3 py-2.5 sm:px-4">
        <IconButton aria-label={t.prev} disabled={snapshot.current === 0} onClick={() => goto(-1)}>
          <ChevronLeft />
        </IconButton>
        <button
          onClick={() => setShowNav(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-m3-md bg-surface-container px-3 py-2 text-[13px] font-bold text-on-surface"
        >
          <Grid3x3 size={14} />
          {t.question} {snapshot.current + 1} {t.of} {items.length}
        </button>
        <Button onClick={() => goto(1)} icon={snapshot.current === items.length - 1 ? undefined : <ChevronRight />}>
          {t.next}
        </Button>
      </div>

      <Dialog open={showNav} onClose={() => setShowNav(false)} title={t.navigator}>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {items.map((it, i) => {
            const answeredHere = !!answers[it.id];
            const flaggedHere = flagged.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => { setCurrent(i); setShowNav(false); }}
                className={cn(
                  "relative flex h-11 items-center justify-center rounded-m3-md border text-[13px] font-black",
                  i === snapshot.current ? "border-primary bg-primary text-on-primary"
                    : answeredHere ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
                )}
              >
                {i + 1}
                {flaggedHere && <Flag size={9} className="absolute right-0.5 top-0.5 fill-warning text-warning" />}
              </button>
            );
          })}
        </div>
      </Dialog>

      <Dialog open={showRef} onClose={() => setShowRef(false)} title={t.reference}>
        <SatReferenceSheet />
      </Dialog>
    </div>
  );
}
