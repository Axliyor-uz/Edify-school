"use client";

import { Check, Minus, X } from "lucide-react";

import { formatScoreBand } from "@/lib/SATscore";
import { cn } from "@/components/student-ui";
import type { SatMathResult } from "@/types/SatQuiz";

/**
 * The SAT score report banner — shared by `/sat/math` and `/sat/english`
 * (identical screens; a second copy is how the two drift). Contract:
 * docs/SAT_QUIZ.md.
 *
 * Shows, in order: the estimated scaled-score BAND, the honesty disclaimer,
 * the raw correct/total with the route badge, a right/wrong/blank tally, and
 * the per-module split.
 *
 * ⚠️ Two fields here are ADDITIVE and absent on sittings graded before
 * 2026-09-16, so both degrade instead of lying:
 *   • no `scoreBand` → fall back to the single `scaledScore` number;
 *   • no `omitted`   → the tally row is HIDDEN entirely, never rendered as
 *     "0 unanswered" (we don't know, and guessing zero is a false claim).
 *
 * ⚠️ The band is still an approximation — see lib/SATscore.ts. Never drop the
 * disclaimer line, and never show the band without the raw score beside it.
 */

const t = {
  result: "Result",
  scaledScore: "Approximate score (200-800)",
  scaledHint: "Not College Board's official equating — an approximate scale.",
  route: "Route",
  routeEasier: "Easier",
  routeHarder: "Harder",
  correct: "Correct",
  of: " of ",
  tallyCorrect: "correct",
  tallyIncorrect: "incorrect",
  tallyBlank: "unanswered",
  module1: "Module 1",
  module2: "Module 2",
};

export default function SatScoreSummary({ result }: { result: SatMathResult }) {
  const band = result.scoreBand;
  const headline = band ? formatScoreBand(band) : String(result.scaledScore);

  // `omitted` is the only reliable source of blanks — `items` stores a blank
  // and a wrong answer identically (both 0), which is exactly the ambiguity
  // this row exists to resolve.
  const blanks = result.omitted?.length;
  const wrong =
    blanks === undefined ? undefined : Math.max(0, result.total - result.correct - blanks);

  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  return (
    <>
      <div>
        <div className="text-[44px] font-black leading-none text-primary">{headline}</div>
        <p className="mt-1 text-[11px] font-bold text-on-surface-variant">{t.scaledScore}</p>
        <p className="mt-2 text-[11px] font-medium text-on-surface-variant">{t.scaledHint}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[13px] font-bold text-on-surface">
        <span>
          {result.correct}
          {t.of}
          {result.total} {t.correct}
        </span>
        <span className="text-on-surface-variant">{pct}%</span>
        <span
          className={cn(
            "rounded-m3-xs px-2 py-0.5 text-[11px] font-bold uppercase",
            result.route === "harder"
              ? "bg-success-container text-on-success-container"
              : "bg-warning-container text-on-warning-container",
          )}
        >
          {t.route}: {result.route === "harder" ? t.routeHarder : t.routeEasier}
        </span>
      </div>

      {blanks !== undefined && wrong !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-bold">
          <span className="inline-flex items-center gap-1 text-success">
            <Check size={13} strokeWidth={3} />
            {result.correct} {t.tallyCorrect}
          </span>
          <span className="inline-flex items-center gap-1 text-error">
            <X size={13} strokeWidth={3} />
            {wrong} {t.tallyIncorrect}
          </span>
          <span className="inline-flex items-center gap-1 text-on-surface-variant">
            <Minus size={13} strokeWidth={3} />
            {blanks} {t.tallyBlank}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-medium text-on-surface-variant">
        <span>
          {t.module1}: {result.module1Correct}/{result.module1Total}
        </span>
        <span>
          {t.module2}: {result.module2Correct}/{result.module2Total}
        </span>
      </div>
    </>
  );
}
