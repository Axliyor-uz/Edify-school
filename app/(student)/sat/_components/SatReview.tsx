"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import LatexRenderer from "@/components/LatexRenderer";
import { Dialog, cn } from "@/components/student-ui";
import type { SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * Per-question review for one SAT Math sitting — a green/red grid, tap to open
 * a question in a dialog with prev/next. Mirrors `ExamReview`'s replay-mode
 * shape (docs/RASCH_QUIZ.md) but simplified: no blocks, so outcomes are keyed
 * by plain question id.
 *
 * ⚠️ **No "your answer" line, on purpose.** `SatMathResult.items` is an
 * OUTCOME map (right/wrong), never an answer map — the same cost decision
 * every exam-shaped result in this repo makes. Only the correct answer (when
 * `showAnswers`) and the explanation are shown.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: { module1: "Modul 1", module2: "Modul 2", correctAnswer: "To'g'ri javob", explanation: "Izoh", prev: "Oldingi", next: "Keyingi" },
  ru: { module1: "Модуль 1", module2: "Модуль 2", correctAnswer: "Правильный ответ", explanation: "Объяснение", prev: "Назад", next: "Далее" },
  en: { module1: "Module 1", module2: "Module 2", correctAnswer: "Correct answer", explanation: "Explanation", prev: "Back", next: "Next" },
};

function Grid({
  items, outcomes, label, onOpen,
}: { items: SatQuizItem[]; outcomes: Record<string, number>; label: string; onOpen: (list: SatQuizItem[], index: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{label}</p>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {items.map((q, i) => {
          const known = q.id in outcomes;
          const right = outcomes[q.id] === 1;
          return (
            <button
              key={q.id}
              onClick={() => onOpen(items, i)}
              className={cn(
                "flex h-9 items-center justify-center rounded-m3-sm text-[12px] font-black",
                !known ? "bg-surface-container text-on-surface-variant"
                  : right ? "bg-success-container text-on-success-container" : "bg-error-container text-on-error-container",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SatReview({
  module1, module2, outcomes, showAnswers, lang,
}: {
  module1: SatQuizItem[];
  module2: SatQuizItem[];
  outcomes: Record<string, number>;
  showAnswers: boolean;
  lang: Lang;
}) {
  const t = UI[lang] || UI.uz;
  const [open, setOpen] = useState<{ list: SatQuizItem[]; index: number } | null>(null);

  const q = open ? open.list[open.index] : null;
  const move = (delta: number) => {
    if (!open) return;
    const next = open.index + delta;
    if (next < 0 || next >= open.list.length) return;
    setOpen({ list: open.list, index: next });
  };

  return (
    <div>
      <Grid items={module1} outcomes={outcomes} label={t.module1} onOpen={(list, index) => setOpen({ list, index })} />
      <Grid items={module2} outcomes={outcomes} label={t.module2} onOpen={(list, index) => setOpen({ list, index })} />

      <Dialog open={!!q} onClose={() => setOpen(null)} title={q ? `${open!.index + 1}` : undefined}>
        {q && (
          <div className="flex flex-col gap-3">
            <div className="text-[14px] font-medium leading-relaxed text-on-surface">
              <LatexRenderer latex={q.question[lang] || q.question.uz || ""} />
            </div>
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="max-h-64 w-auto rounded-m3-md border border-outline-variant" />
            )}

            {q.qType === "mcq" && (
              <div className="flex flex-col gap-1.5">
                {q.optionKeys.map((letter) => (
                  <div
                    key={letter}
                    className={cn(
                      "flex items-center gap-2 rounded-m3-md border p-2.5 text-[13px] font-medium",
                      showAnswers && letter === q.answer
                        ? "border-success bg-success-container text-on-success-container"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface",
                    )}
                  >
                    <span className="font-black">{letter}.</span>
                    <LatexRenderer latex={q.options[letter]?.[lang] || q.options[letter]?.uz || ""} />
                  </div>
                ))}
              </div>
            )}

            {showAnswers && (
              <div className="rounded-m3-md bg-surface-container-lowest p-3">
                <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-on-surface-variant">{t.correctAnswer}</p>
                <p className="text-[13px] font-bold text-on-surface">
                  {q.qType === "mcq" ? `${q.answer}. ${q.options[q.answer]?.[lang] || q.options[q.answer]?.uz || ""}` : q.answer}
                </p>
                {q.explanation && (q.explanation[lang] || q.explanation.uz) && (
                  <>
                    <p className="mb-1 mt-2 text-[11px] font-black uppercase tracking-wide text-on-surface-variant">{t.explanation}</p>
                    <p className="text-[12.5px] font-medium leading-relaxed text-on-surface-variant">
                      <LatexRenderer latex={q.explanation[lang] || q.explanation.uz || ""} />
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button disabled={open!.index === 0} onClick={() => move(-1)} className="flex items-center gap-1 text-[12px] font-bold text-on-surface-variant disabled:opacity-30">
                <ChevronLeft size={14} /> {t.prev}
              </button>
              <button disabled={open!.index === open!.list.length - 1} onClick={() => move(1)} className="flex items-center gap-1 text-[12px] font-bold text-on-surface-variant disabled:opacity-30">
                {t.next} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
