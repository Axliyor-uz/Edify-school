"use client";

import { Pencil, User } from "lucide-react";

import { cn } from "@/components/ui";

/**
 * "Who made this question" — one small line showing the original author and, if
 * anyone has fixed it, the corrector. Rendered on EVERY surface that shows a
 * question (bank cards, test previews, the student runner, the results pages and
 * the RASCH exam — even mid-exam), so a wrong question can always be traced to a
 * person.
 *
 * The fields come straight off `NormalizedQuestion` (`creatorName`/`correctedBy`)
 * and, in the RASCH exam, off `ExamQuestion` (the same fields, plumbed through
 * `lib/ExamTeacher.ts`). Bank/system questions carry no author, so it renders
 * nothing. Color is neutral by default and overridable per surface via
 * `className` (teacher M3 pages pass `text-on-surface-variant`).
 */
interface Props {
  creatorName?: string | null;
  correctedBy?: string | null;
  className?: string;
  iconSize?: number;
  /** Localized labels; default to Uzbek (the app's default UI language). */
  authorLabel?: string;
  correctedLabel?: string;
}

export default function QuestionCreator({
  creatorName,
  correctedBy,
  className,
  iconSize = 11,
  authorLabel = "Muallif",
  correctedLabel = "Tuzatgan",
}: Props) {
  const name = creatorName?.trim();
  const corrected = correctedBy?.trim();
  if (!name && !corrected) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] md:text-[11px] font-medium text-slate-500 dark:text-slate-400",
        className,
      )}
    >
      {name && (
        <span className="flex items-center gap-1 min-w-0">
          <User size={iconSize} className="shrink-0" />
          <span className="truncate">
            {authorLabel}: {name}
          </span>
        </span>
      )}
      {corrected && (
        <span className="flex items-center gap-1 min-w-0 italic">
          <Pencil size={iconSize} className="shrink-0" />
          <span className="truncate">
            {correctedLabel}: {corrected}
          </span>
        </span>
      )}
    </div>
  );
}
