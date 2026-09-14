"use client";

import { useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Check, Plus, Search } from "lucide-react";

import LatexRenderer from "@/components/LatexRenderer";
import { fetchMyQuestionsPage } from "@/services/questionBankService";
import { SAT_MATH_TAXONOMY_SLUG, isSatAuthorableType, satQuizItem } from "@/lib/SatMathQuiz";
import { Button, cn } from "@/components/ui";
import {
  AI_CREATION_METHODS, IMAGE_CREATION_METHODS, MANUAL_CREATION_METHODS,
  isAiWritten, type NormalizedQuestion,
} from "@/types/question";
import type { SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * The teacher's own `teacher_questions`, narrowed to the `sat-matematika`
 * subject — the one pool a SAT Math module is built from. Contract:
 * docs/SAT_QUIZ.md.
 *
 * ⚠️ Unlike `SubjectBankPicker` (which the Milliy sertifikat papers use) there
 * is no closed/typed toggle here: SAT Math only ever authors `mcq`/`numeric`
 * (`isSatAuthorableType`), so the filter is silent rather than a chip — a
 * `true_false`/`open`/block question written under this subject by mistake is
 * simply never offered.
 *
 * ON-DEMAND: nothing is read when this mounts, only when the teacher presses
 * Load, and then exactly one page (more if the type filter needs to walk for
 * a match, same pattern as the Milliy sertifikat picker).
 */

const PAGE = 10;

type Source = "all" | "ai" | "mine";
const SOURCES: Source[] = ["all", "ai", "mine"];

const methodsFor = (source: Source): string[] | undefined =>
  source === "ai" ? [...AI_CREATION_METHODS, ...IMAGE_CREATION_METHODS]
    : source === "mine" ? MANUAL_CREATION_METHODS
    : undefined;

export interface SatPickerStrings {
  source: string; srcAll: string; srcAi: string; srcMine: string;
  load: string; loadMore: string; none: string; reads: string;
  add: string; added: string; imageOnly: string; full: string; aiBadge: string;
  mcqBadge: string; numericBadge: string;
}

export default function SatBankPicker({
  t, uid, lang, picked, disabled, onAdd,
}: {
  t: SatPickerStrings;
  uid: string;
  lang: Lang;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: SatQuizItem) => void;
}) {
  const [source, setSource] = useState<Source>("all");
  const [rows, setRows] = useState<NormalizedQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reads, setReads] = useState(0);

  const load = async (fresh: boolean) => {
    setLoading(true);
    try {
      let next = fresh ? null : cursor;
      let more = true;
      let read = 0;
      const found: NormalizedQuestion[] = [];

      const methods = methodsFor(source);
      // The mcq/numeric filter is CLIENT-side (a `type in […]` beside
      // creatorId + subject.id + orderBy createdAt would need a third
      // composite index), so a press walks up to 3 pages until something
      // matches, and the read count is printed on screen rather than hidden.
      const maxPages = 3;
      for (let i = 0; i < maxPages; i++) {
        const page = await fetchMyQuestionsPage(uid, PAGE, next, methods, SAT_MATH_TAXONOMY_SLUG);
        read += page.questions.length;
        found.push(...page.questions.filter(isSatAuthorableType));
        if (page.cursor) next = page.cursor;
        more = page.hasMore;
        if (found.length > 0 || !more) break;
      }

      setRows((prev) => (fresh ? found : [...prev, ...found]));
      setCursor(next);
      setHasMore(more);
      setReads((n) => (fresh ? read : n + read));
      setTouched(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = (fn: () => void) => {
    fn();
    setRows([]);
    setCursor(null);
    setHasMore(true);
    setTouched(false);
    setReads(0);
  };

  const chip = (active: boolean) => cn(
    "m3-interactive rounded-m3-sm px-3 py-1.5 text-[11px] font-bold transition-colors",
    active
      ? "bg-primary text-on-primary"
      : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
  );

  const preview = (q: NormalizedQuestion) => {
    const raw = q.question?.[lang] || q.question?.uz || "";
    const flat = raw.replace(/\s+/g, " ").trim();
    return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.source}</span>
        {SOURCES.map((s) => (
          <button key={s} onClick={() => reset(() => setSource(s))} className={chip(source === s)}>
            {s === "all" ? t.srcAll : s === "ai" ? t.srcAi : t.srcMine}
          </button>
        ))}

        <Button size="sm" className="ml-auto" icon={<Search />} loading={loading} onClick={() => load(true)}>
          {t.load}
        </Button>
      </div>

      {reads > 0 && (
        <p className="text-[11px] font-medium text-on-surface-variant">{reads} {t.reads}</p>
      )}

      {touched && rows.length === 0 && !loading && (
        <p className="py-6 text-center text-[12px] font-medium text-on-surface-variant">{t.none}</p>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((q) => {
            const already = picked.has(q.id);
            const text = preview(q);
            const item = satQuizItem(q);
            return (
              <li
                key={q.id}
                className="flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-2.5"
              >
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.imageUrl} alt="" className="h-12 w-12 flex-none rounded-m3-xs object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[12.5px] font-medium text-on-surface">
                    {text ? <LatexRenderer latex={text} /> : <span className="italic text-on-surface-variant">{t.imageOnly}</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    <span className={cn(
                      "rounded-m3-xs px-1.5 py-0.5",
                      q.type === "mcq" ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-container text-on-tertiary-container",
                    )}>
                      {q.type === "mcq" ? t.mcqBadge : t.numericBadge}
                    </span>
                    {isAiWritten(q.creationMethod) && (
                      <span className="rounded-m3-xs bg-surface-container-high px-1.5 py-0.5">{t.aiBadge}</span>
                    )}
                    <span className="normal-case tracking-normal">{q.topic}</span>
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={already ? "text" : "tonal"}
                  icon={already ? <Check /> : <Plus />}
                  disabled={already || disabled || !item}
                  onClick={() => item && onAdd(item)}
                  className="flex-none"
                >
                  {already ? t.added : disabled ? t.full : t.add}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && hasMore && (
        <Button variant="outlined" size="sm" loading={loading} onClick={() => load(false)}>
          {t.loadMore}
        </Button>
      )}
    </div>
  );
}
