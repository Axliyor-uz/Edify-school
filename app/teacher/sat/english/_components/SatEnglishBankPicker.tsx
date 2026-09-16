"use client";

import { useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Check, Plus, Search } from "lucide-react";

import LatexRenderer from "@/components/LatexRenderer";
import { fetchMyQuestionsPage, fetchSharedQuestionsPage } from "@/services/questionBankService";
import { SAT_PLATFORM_CREATOR_ID, SAT_RW_TAXONOMY_SLUG, isSatEnglishAuthorableType, satQuizItem } from "@/lib/SatMathQuiz";
import { Button, cn } from "@/components/ui";
import type { NormalizedQuestion } from "@/types/question";
import type { SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * Where a SAT English module's questions come from — the donated PLATFORM
 * bank (`scripts/importSATEnglishQuestions.mjs`, `creatorId ==
 * SAT_PLATFORM_CREATOR_ID`) or the teacher's own `teacher_questions`, both
 * narrowed to the `sat-ingliz-tili` subject. Contract: docs/SAT_QUIZ.md.
 *
 * A SIBLING of `app/teacher/sat/math/_components/SatBankPicker.tsx` — Math's
 * picker has no "platform" pool (nothing bulk-imported it), so this is its
 * own component rather than a shared one with an extra prop. Unlike Math,
 * SAT English authors ONLY `mcq` (`isSatEnglishAuthorableType`) — the real
 * digital SAT R&W section has no grid-in questions — so there is no
 * mcq/numeric badge to show.
 *
 * `teacher_questions` rules are `allow read: if isAuth()` for every
 * signed-in user — reading the platform pool (`creatorId == ''`) needed NO
 * rules change, only a query with a different `creatorId`.
 */

const PAGE = 10;

/**
 * Three pools, all `teacher_questions` narrowed to `sat-ingliz-tili`:
 *   platform — the donated bank, `creatorId: ''`, owned by nobody (Admin SDK)
 *   shared   — what other teachers published via /teacher/sat/import
 *              (`sharedBank == true`), still owned by and attributed to them
 *   mine     — this teacher's own
 * ⚠️ `shared` and `platform` are NOT the same thing; see docs/SAT_QUIZ.md.
 */
type Source = "platform" | "shared" | "mine";

export interface SatEnglishPickerStrings {
  source: string; srcPlatform: string; srcMine: string;
  load: string; loadMore: string; none: string; reads: string;
  add: string; added: string; imageOnly: string; full: string;
  srcShared: string; by: string;
}

export default function SatEnglishBankPicker({
  t, uid, lang, picked, disabled, onAdd,
}: {
  t: SatEnglishPickerStrings;
  uid: string;
  lang: Lang;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: SatQuizItem) => void;
}) {
  const [source, setSource] = useState<Source>("platform");
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

      const creatorId = source === "platform" ? SAT_PLATFORM_CREATOR_ID : uid;
      // Only ever mcq — a page may still need a couple of hops if a stray
      // non-mcq question was filed under this subject by mistake.
      const maxPages = 3;
      for (let i = 0; i < maxPages; i++) {
        const page = source === "shared"
          ? await fetchSharedQuestionsPage(SAT_RW_TAXONOMY_SLUG, PAGE, next)
          : await fetchMyQuestionsPage(creatorId, PAGE, next, undefined, SAT_RW_TAXONOMY_SLUG);
        read += page.questions.length;
        found.push(...page.questions.filter(isSatEnglishAuthorableType));
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
        {(["platform", "shared", "mine"] as Source[]).map((s) => (
          <button key={s} onClick={() => reset(() => setSource(s))} className={chip(source === s)}>
            {s === "platform" ? t.srcPlatform : s === "shared" ? t.srcShared : t.srcMine}
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
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[12.5px] font-medium text-on-surface">
                    {text ? <LatexRenderer latex={text} /> : <span className="italic text-on-surface-variant">{t.imageOnly}</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    <span className="normal-case tracking-normal">{q.topic}</span>
                    {/* Attribution — a shared question stays owned by, and named
                        after, the teacher who uploaded it. */}
                    {source === "shared" && q.creatorName && (
                      <span className="normal-case tracking-normal opacity-70">{t.by} {q.creatorName}</span>
                    )}
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
