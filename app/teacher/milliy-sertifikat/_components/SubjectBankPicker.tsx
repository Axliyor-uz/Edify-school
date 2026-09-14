"use client";

import { useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Check, Layers, Plus, Search } from "lucide-react";

import LatexRenderer from "@/components/LatexRenderer";
import { fetchMyQuestionsPage } from "@/services/questionBankService";
import { milliyQuizItem } from "@/lib/MilliyQuiz";
import { Button, cn } from "@/components/ui";
import {
  AI_CREATION_METHODS, IMAGE_CREATION_METHODS, MANUAL_CREATION_METHODS,
  isAiWritten, isClosedQuestion, type NormalizedQuestion,
} from "@/types/question";
import type { MilliyQuizItem } from "@/types/MilliyQuiz";
import type { Lang } from "@/types/Math";

/**
 * The teacher's own `teacher_questions`, narrowed to ONE subject — the only pool
 * a Milliy sertifikat subject paper is built from. Contract: docs/MILLIY_QUIZ.md.
 *
 * ⚠️ **There is no national-bank tab, unlike the maths builder.** `questions1`
 * holds algebra and geometry only, so for biology it is empty by construction —
 * offering the tab would be a dead end that reads documents to prove it.
 *
 * ⚠️ **This is deliberately NOT `MyBankPicker`** from the Rasch builder. That
 * component's whole contract is the blueprint quota (`roomForItem` → a required
 * `TopicRoom` per row, disabled Add buttons, "to'ldi" badges), and these papers
 * have no blueprint to have a quota from — threading a fake one through it would
 * make the maths picker's quota code lie. What IS shared is the part that must not
 * drift: `isClosedQuestion` for the closed/typed split, the `creationMethod in […]`
 * provenance lists, and `fetchMyQuestionsPage` for the read itself.
 *
 * ON-DEMAND: nothing is read when this mounts, only when the teacher presses
 * Load, and then exactly one page. Opening the builder is free.
 */

const PAGE = 10;

type Kind = "all" | "closed" | "open";
const KINDS: Kind[] = ["all", "closed", "open"];

const matchesKind = (kind: Kind, q: NormalizedQuestion) =>
  kind === "all" ? true : kind === "closed" ? isClosedQuestion(q) : !isClosedQuestion(q);

type Source = "all" | "ai" | "mine";
const SOURCES: Source[] = ["all", "ai", "mine"];

/**
 * Provenance → the `creationMethod in […]` list, or `undefined` for no filter.
 *
 * ⚠️ A question whose method is empty or unrecognized (an old document) matches
 * NEITHER list, so it is only reachable under "all". Deliberate: guessing would
 * file somebody's AI question under "written by me".
 */
const methodsFor = (source: Source): string[] | undefined =>
  source === "ai" ? [...AI_CREATION_METHODS, ...IMAGE_CREATION_METHODS]
    : source === "mine" ? MANUAL_CREATION_METHODS
    : undefined;

export interface SubjectPickerStrings {
  kind: string; kindAll: string; kindClosed: string; kindOpen: string;
  source: string; srcAi: string; srcMine: string;
  load: string; loadMore: string; none: string; reads: string;
  add: string; added: string; block: string; imageOnly: string; full: string;
  closedBadge: string; openBadge: string; aiBadge: string;
}

export default function SubjectBankPicker({
  t, uid, subjectSlug, lang, picked, disabled, onAdd,
}: {
  t: SubjectPickerStrings;
  uid: string;
  /** The `data/question_topics.json` subject id, filtered SERVER-side. */
  subjectSlug: string;
  lang: Lang;
  picked: Set<string>;
  /** The paper is at its declared length — every Add is dead. */
  disabled: boolean;
  onAdd: (item: MilliyQuizItem) => void;
}) {
  const [kind, setKind] = useState<Kind>("all");
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
      // ⚠️ The closed/typed filter is CLIENT-side: in Firestore it would need a
      // `type in […]` beside creatorId + subject.id + orderBy createdAt (a third
      // composite index) and still could not express the per-part block rule. So a
      // filtered press walks up to 3 pages until something matches, and the read
      // count is printed on screen rather than hidden.
      const maxPages = kind === "all" ? 1 : 3;
      for (let i = 0; i < maxPages; i++) {
        const page = await fetchMyQuestionsPage(uid, PAGE, next, methods, subjectSlug);
        read += page.questions.length;
        found.push(...page.questions.filter((q) => matchesKind(kind, q)));
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

  /** Changing a filter re-walks from the newest question: the cursor it stopped
   *  at belongs to a different set of rows. */
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.kind}</span>
        {KINDS.map((k) => (
          <button key={k} onClick={() => reset(() => setKind(k))} className={chip(kind === k)}>
            {k === "all" ? t.kindAll : k === "closed" ? t.kindClosed : t.kindOpen}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.source}</span>
        {SOURCES.map((s) => (
          <button key={s} onClick={() => reset(() => setSource(s))} className={chip(source === s)}>
            {s === "all" ? t.kindAll : s === "ai" ? t.srcAi : t.srcMine}
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
            const closed = isClosedQuestion(q);
            const text = preview(q);
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
                      closed ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-container text-on-tertiary-container",
                    )}>
                      {closed ? t.closedBadge : t.openBadge}
                    </span>
                    {q.isBlock && (
                      <span className="inline-flex items-center gap-1 rounded-m3-xs bg-surface-container-high px-1.5 py-0.5">
                        <Layers size={10} /> {t.block}
                      </span>
                    )}
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
                  disabled={already || disabled}
                  onClick={() => onAdd(milliyQuizItem(q))}
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
