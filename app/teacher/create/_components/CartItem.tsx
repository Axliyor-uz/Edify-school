'use client';

import { useState } from 'react';
import { Trash2, BookOpen, Eye, ChevronDown, CheckCircle2 } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { normalizeQuestion } from '@/lib/questionSchema';
import QuestionPartsPreview from '@/components/QuestionPartsPreview';
import QuestionCreator from '@/components/QuestionCreator';

import { cn } from '@/components/ui';

interface Props {
  question: any;
  index: number;
  onRemove: () => void;
}

// Difficulty is a real state — semantic container colors are correct here.
const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'bg-success-container text-on-success-container',
  medium: 'bg-warning-container text-on-warning-container',
  hard: 'bg-error-container text-on-error-container',
};

export default function CartItem({ question, index, onRemove }: Props) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isSolutionOpen, setIsSolutionOpen] = useState(false);

  // Safe Text Helper
  const getText = (obj: any) => {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;
    return obj?.uz || obj?.en || obj?.ru || "No text";
  };

  // Normalized here: the cart holds both freshly generated questions (legacy
  // shape) and docs read back from Firestore (v1 shape).
  const q = normalizeQuestion(question);

  const questionText = getText(q.question);
  const options = q.options;
  // multiple_select marks several letters correct; mcq just one.
  const correctKeys = Array.isArray(q.correctAnswer.value) ? q.correctAnswer.value : [q.answer];
  const explanation = getText(q.explanation);

  const singleSolution = getText(question.solution);
  const multiSolutions = q.solutions;
  const hasSolution = (explanation && explanation !== "No text") ||
    multiSolutions.length > 0 ||
    (singleSolution && singleSolution !== "No text");

  const difficultyKey = q.difficulty;
  const diffStyle = DIFFICULTY_BADGE[difficultyKey] || 'bg-surface-container-highest text-on-surface-variant';

  return (
    <div className="bg-surface-container-low rounded-m3-lg shadow-elev-1 overflow-hidden group hover:shadow-elev-2 transition-shadow duration-300">

      {/* 1. MAIN CONTENT ROW */}
      <div className="p-4 md:p-5 flex gap-4 relative">
        {/* Index Badge */}
        <div className="w-8 h-8 rounded-m3-sm bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="text-on-surface-variant font-extrabold text-[12px] tabular-nums">
            {index}
          </span>
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <div className="text-[14px] font-semibold text-on-surface leading-relaxed break-words overflow-x-auto custom-scrollbar">
            <LatexRenderer latex={questionText} />
          </div>
          <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mt-1.5 text-on-surface-variant" />
        </div>

        <button
          onClick={onRemove}
          className="text-on-surface-variant hover:text-error hover:bg-error-container h-8 w-8 flex items-center justify-center rounded-m3-sm transition-colors shrink-0 -mr-1 -mt-1 group-hover:opacity-100 opacity-60 sm:opacity-0"
          title="Remove Question"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* 2. ACTION BAR */}
      <div className="bg-surface-container px-4 py-3 border-t border-outline-variant flex flex-wrap items-center justify-between gap-3 shrink-0">

        {/* Difficulty + block label — a block holds several sub-questions and must say so. */}
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-m3-xs", diffStyle)}>
            {q.uiDifficulty}
          </span>
          {q.isBlock && (
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-m3-xs bg-primary-container text-on-primary-container">
              Blok · {q.parts.length} savol
            </span>
          )}
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          {(Object.keys(options).length > 0 || q.isBlock) && (
            <button
              onClick={() => setIsOptionsOpen(!isOptionsOpen)}
              className={cn(
                "m3-interactive text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm transition-all",
                isOptionsOpen
                  ? "bg-secondary-container text-on-secondary-container shadow-elev-1"
                  : "bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Eye size={14} />
              Options
              <ChevronDown size={14} className={cn("transition-transform duration-200", isOptionsOpen && "rotate-180")} />
            </button>
          )}

          {hasSolution && (
            <button
              onClick={() => setIsSolutionOpen(!isSolutionOpen)}
              className={cn(
                "m3-interactive text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm transition-all",
                isSolutionOpen
                  ? "bg-tertiary-container text-on-tertiary-container shadow-elev-1"
                  : "bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface-variant hover:text-on-surface",
              )}
            >
              <BookOpen size={14} />
              Solution
              <ChevronDown size={14} className={cn("transition-transform duration-200", isSolutionOpen && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {/* 3. EXPANDABLE PANELS */}

      {/* OPTIONS PANEL */}
      {isOptionsOpen && q.isBlock && (
        <div className="border-t border-outline-variant p-4 bg-surface-container-lowest animate-in slide-in-from-top-2 fade-in duration-200">
          <QuestionPartsPreview question={q} compact />
        </div>
      )}

      {isOptionsOpen && !q.isBlock && (
        <div className="border-t border-outline-variant p-4 bg-surface-container-lowest space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
          {Object.entries(options).map(([key, val]: any) => {
            const isCorrect = correctKeys.includes(key);
            return (
              <div key={key} className={cn(
                "flex gap-3 items-center p-3 rounded-m3-md transition-colors",
                isCorrect
                  ? "bg-success-container text-on-success-container shadow-elev-1"
                  : "ring-1 ring-inset ring-outline-variant text-on-surface-variant",
              )}>

                <div className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-m3-xs text-[11px] font-extrabold shrink-0",
                  isCorrect ? "bg-success text-surface-container-lowest" : "bg-surface-container-high text-on-surface-variant",
                )}>
                  {key}
                </div>

                <div className="flex-1 break-words overflow-x-auto text-[13px] font-medium pt-0.5">
                  <LatexRenderer latex={getText(val)} />
                </div>

                {isCorrect && <CheckCircle2 size={18} className="text-success shrink-0" />}
              </div>
            )
          })}
        </div>
      )}

      {/* SOLUTION PANEL */}
      {isSolutionOpen && (
        <div className="border-t border-outline-variant p-5 bg-surface space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">

          {explanation && explanation !== "No text" && (
            <div className="text-[13px] font-medium text-on-surface break-words">
              <span className="font-extrabold text-tertiary uppercase tracking-widest flex items-center gap-1.5 mb-2 text-[10px]">
                <BookOpen size={12} /> Explanation
              </span>
              <div className="pl-3 border-l-2 border-tertiary overflow-x-auto bg-tertiary-container text-on-tertiary-container p-3 rounded-r-m3-md">
                <LatexRenderer latex={explanation} />
              </div>
            </div>
          )}

          {singleSolution && singleSolution !== "No text" && (
            <div className="text-[13px] font-medium text-on-surface break-words">
              <span className="font-extrabold text-success uppercase tracking-widest flex items-center gap-1.5 mb-2 text-[10px]">
                <CheckCircle2 size={12} /> Solution
              </span>
              <div className="pl-3 border-l-2 border-success overflow-x-auto bg-success-container text-on-success-container p-3 rounded-r-m3-md">
                <LatexRenderer latex={singleSolution} />
              </div>
            </div>
          )}

          {multiSolutions.length > 0 && (
            <div className="text-[13px] font-medium text-on-surface break-words">
              <span className="font-extrabold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-2 text-[10px]">
                <BookOpen size={12} /> Step-by-Step
              </span>
              <div className="bg-surface-container-lowest ring-1 ring-inset ring-outline-variant rounded-m3-md p-4">
                {multiSolutions.map((sol: any, idx: number) => (
                  <ul key={idx} className="space-y-3">
                    {sol.steps?.map((step: string, sIdx: number) => (
                      <li key={sIdx} className="overflow-x-auto flex gap-3 items-start">
                        <span className="text-[10px] font-extrabold text-on-primary-container bg-primary-container px-2 py-0.5 rounded-m3-xs mt-0.5 shrink-0 tabular-nums">
                          {sIdx + 1}
                        </span>
                        <LatexRenderer latex={step} />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
