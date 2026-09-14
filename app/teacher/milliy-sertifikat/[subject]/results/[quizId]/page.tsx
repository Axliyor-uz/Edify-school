"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ChevronDown, Users } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { findSubject } from "@/lib/questionTopics";
import {
  PAPER_TOTAL, cohortStats, evenPrinted, normalizedScore, paperMarks, paperSlots,
  paperTotal, scoreFor,
} from "@/lib/RASCHmarks";
import { genericSubject, hydrateMilliyQuiz, subjectName } from "@/lib/MilliyQuiz";
import { getMilliyQuiz, listMilliyResults } from "@/services/milliyQuizService";
import {
  Banner, Card, EmptyState, IconButton, PageHeader, Skeleton, StatTile, cn,
} from "@/components/ui";
import type { MilliyQuiz, MilliyQuizResult } from "@/types/MilliyQuiz";
import type { Lang } from "@/types/Math";

/**
 * Who sat one subject paper, and how the class did.
 *
 * ## 🟢 The SAME dynamic marking as maths (2026-07-30; formula rewritten 2026-08-01)
 *
 * Every question carries a **guaranteed base** by test type (`Y-1` 1.1 closed,
 * `O` 1.6 typed — `BASE_BALL`), and whatever is left of the paper's 100 is the
 * **difficulty budget**, shared out in proportion to `(1−p̂)²` — so the fewer of
 * the class that solved a question, the bigger its bonus. `B = Y + σ`, and the
 * paper sums to exactly 100 by construction. The student's score is
 * `Σ(balls earned) / Σ(balls) × 100`. ⚠️ That is what makes ten hard answers beat
 * ten easy ones — a flat "20 of 30" cannot say it. All of it is
 * [lib/RASCHmarks.ts](../../../../../../lib/RASCHmarks.ts), shared verbatim with
 * the maths paper.
 *
 * ⚠️ **`evenPrinted` is the one difference.** The maths paper has DTM printed
 * per-position values to show a moved mark against; this one has no published
 * protocol, so it passes an even split of 100. It is a "before" for display, not
 * a fallback the marking ever uses.
 *
 * ⚠️ **Still NO ability model.** θ and the 0–5 levels come from the 3PL fit in
 * `lib/RASCHtheta.ts`, which IS anchored on calibrated maths item difficulty.
 * Marks are cohort arithmetic and portable; θ is not. Nothing here shows a level.
 *
 * Cost: **1 read** (the paper) + **1 query** (every sitting). The per-question
 * solve rate adds nothing — it is derived from rows already fetched.
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    scoreHint: "Har bir savol kafolatlangan asosiy ball oladi (yopiq 1,10 · ochiq 1,60), qolgan ballar esa qiyinlikka bo'lib beriladi: sinf ko'p yechgan savol arzon, kam yechilgani qimmat. Variant jami 100 ball. Yangi o'quvchi ishlagani sayin ballar qayta hisoblanadi.",
    rawCorrect: "to'g'ri",
    ball: 'ball',
    legacyRow: 'savollar bo\u2018yicha saqlanmagan',
    paperTotal: 'Variant jami',
    marksSplit: "Asosiy ball + qiyinlik ulushi",
    topicTotal: "Mavzuning hozirgi jami bali",
    provisional: "5 tadan kam javob \u2014 ball hali o'zgarishi mumkin",
    solvedShort: 'yechgan',
    title: "Natijalar",
    loading: "Yuklanmoqda…",
    emptyTitle: "Hali hech kim ishlamagan",
    emptyDesc: "O'quvchilar kodni kiritib variantni ishlagach, natijalar shu yerda ko'rinadi.",
    sat: "Ishlagan", average: "O'rtacha", best: "Eng yaxshi",
    students: "O'quvchilar",
    perQuestion: "Savollar bo'yicha",
    solved: "to'g'ri ishlagan",
    noItemData: "Bu sitting savol darajasida saqlanmagan — eski natija.",
    question: "savol",
    topics: "Mavzular bo'yicha (sinf)",
    loadFailed: "Natijalarni yuklab bo'lmadi",
    notFound: "Variant topilmadi",
    closedLabel: "Yopiq", openLabel: "Ochiq",
  },
  ru: {
    back: "Назад",
    scoreHint: 'Каждый вопрос получает гарантированный базовый балл (закрытый 1,10 · открытый 1,60), а остаток распределяется по сложности: чем больше учеников решили вопрос, тем он дешевле; редко решаемый стоит дорого. Всего за вариант — 100 баллов. С каждой новой попыткой баллы пересчитываются.',
    rawCorrect: 'верно',
    ball: 'балл',
    legacyRow: 'не сохранено по вопросам',
    paperTotal: 'Всего за вариант',
    marksSplit: "База + надбавка за сложность",
    topicTotal: "Текущая сумма баллов темы",
    provisional: 'меньше 5 ответов — балл ещё может измениться',
    solvedShort: 'решили',
    title: "Результаты",
    loading: "Загрузка…",
    emptyTitle: "Пока никто не проходил",
    emptyDesc: "Как только ученики введут код и пройдут вариант, результаты появятся здесь.",
    sat: "Прошли", average: "Средний", best: "Лучший",
    students: "Ученики",
    perQuestion: "По вопросам",
    solved: "решили верно",
    noItemData: "Эта попытка не сохранена по вопросам — старый результат.",
    question: "вопрос",
    topics: "По темам (класс)",
    loadFailed: "Не удалось загрузить результаты",
    notFound: "Вариант не найден",
    closedLabel: "Закрытый", openLabel: "Открытый",
  },
  en: {
    back: "Back",
    scoreHint: 'Every question carries a guaranteed base (closed 1.10 · typed 1.60); the rest of the paper is shared out by difficulty — the more of the class that solved a question, the less it adds; a question few solve adds the most. The paper totals 100. Every new sitting reprices it.',
    rawCorrect: 'correct',
    ball: 'marks',
    legacyRow: 'not saved per question',
    paperTotal: 'Paper total',
    marksSplit: "Base + difficulty bonus",
    topicTotal: "What this topic currently adds up to",
    provisional: 'fewer than 5 answers — the mark is still moving',
    solvedShort: 'solved',
    title: "Results",
    loading: "Loading…",
    emptyTitle: "Nobody has sat it yet",
    emptyDesc: "Once students enter the code and finish the paper, their results show up here.",
    sat: "Sat it", average: "Average", best: "Best",
    students: "Students",
    perQuestion: "Per question",
    solved: "solved it",
    noItemData: "This sitting was not saved per question — an older result.",
    question: "question",
    topics: "By topic (class)",
    loadFailed: "Could not load the results",
    notFound: "Paper not found",
    closedLabel: "Closed", openLabel: "Typed",
  },
};

const pct = (n: number) => `${Math.round(n)}%`;

export default function MilliyResultsPage() {
  const router = useRouter();
  const params = useParams<{ subject: string; quizId: string }>();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const subject = genericSubject(params.subject);

  const [quiz, setQuiz] = useState<MilliyQuiz | null>(null);
  const [results, setResults] = useState<MilliyQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [paper, rows] = await Promise.all([
        getMilliyQuiz(params.quizId),
        listMilliyResults(params.quizId, user.uid),
      ]);
      if (!paper) { setError(t.notFound); return; }
      setQuiz(paper);
      setResults(rows);
    } catch (err) {
      console.error(err);
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [user, params.quizId, t.notFound, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  /** The paper, positions stamped on — one parse, shared by everything below. */
  const hydrated = useMemo(() => (quiz ? hydrateMilliyQuiz(quiz.questions) : []), [quiz]);
  const slots = useMemo(() => paperSlots(hydrated), [hydrated]);

  /**
   * The cohort's per-slot counts and the marks in force right now — the SAME
   * `paperMarks` the maths paper runs (`B = Y + σ`: a guaranteed base by test
   * type plus a share of the difficulty budget). ⚠️ Derived on every render from
   * the sittings that exist, so a question's ball MOVES when another student sits
   * the paper. That is the feature, and the page says so on screen.
   */
  const marks = useMemo(
    () => paperMarks(slots, cohortStats(results), evenPrinted(slots.length)),
    [slots, results],
  );

  const total = useMemo(() => paperTotal(marks), [marks]);

  /** The two halves of `B = Y + σ` as this paper splits them — summed, never
   *  assumed: a subject paper's mix of closed and typed items is the teacher's,
   *  so its base total is not the maths paper's 55.10. */
  const baseTotal = useMemo(
    () => Math.round(marks.reduce((sum, m) => sum + m.base, 0) * 100) / 100,
    [marks],
  );
  const bonusTotal = Math.round((total - baseTotal) * 100) / 100;

  /**
   * The marks grouped by TOPIC, with what each topic currently adds up to.
   *
   * ⚠️ These papers have no blueprint, so `sectionId` is the question's own topic
   * slug ([lib/MilliyQuiz.ts](../../../../../../lib/MilliyQuiz.ts) `slotMeta`) —
   * which makes `SlotMark.sectionTotal` a per-topic total here and the grid read
   * exactly like the maths one, where it is per blueprint row. The total is
   * REPORTED, never reserved: the paper is priced as a whole.
   */
  const markGroups = useMemo(() => {
    const label = new Map<string, string>();
    for (const q of hydrated) {
      if (!label.has(q.sectionId)) label.set(q.sectionId, q.sectionLabel?.[L] || "");
    }
    const order: string[] = [];
    const by = new Map<string, typeof marks>();
    for (const m of marks) {
      if (!by.has(m.sectionId)) { by.set(m.sectionId, []); order.push(m.sectionId); }
      by.get(m.sectionId)!.push(m);
    }
    return order.map((id) => ({
      id,
      label: label.get(id) || id || "—",
      marks: by.get(id)!,
      total: by.get(id)![0].sectionTotal,
    }));
  }, [hydrated, marks, L]);

  /** Each student's dynamic score. `null` for a sitting saved without `items`. */
  const scores = useMemo(() => {
    const out = new Map<string, { earned: number | null; score: number | null }>();
    for (const r of results) {
      out.set(r.studentId, {
        earned: scoreFor(marks, r.items),
        score: normalizedScore(marks, r.items),
      });
    }
    return out;
  }, [marks, results]);

  /** Ranked by the dynamic score, falling back to percent for legacy rows. */
  const ranked = useMemo(
    () => [...results].sort((a, b) =>
      (scores.get(b.studentId)?.score ?? b.percent) - (scores.get(a.studentId)?.score ?? a.percent),
    ),
    [results, scores],
  );

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const values = results.map((r) => scores.get(r.studentId)?.score ?? r.percent);
    return {
      sat: results.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      best: Math.max(...values),
    };
  }, [results, scores]);

  /** Which topic each slot belongs to, for the tooltips outside the grid. */
  const topicByKey = useMemo(() => {
    const out = new Map<string, string>();
    for (const g of markGroups) for (const m of g.marks) out.set(m.key, g.label);
    return out;
  }, [markGroups]);

  /**
   * ⚠️ Sittings with no `items` map are EXCLUDED from the denominator (inside
   * `cohortStats`) rather than counted as wrong — an older client wrote no
   * outcomes, and treating "unknown" as "wrong" would make every question look
   * harder than it is and would inflate its ball.
   */
  const measured = marks.some((m) => m.seen > 0);

  /** Class totals per topic slug, summed over every sitting that recorded them. */
  const topicTotals = useMemo(() => {
    const acc = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      for (const [slug, v] of Object.entries(r.topics ?? {})) {
        const prev = acc.get(slug) ?? { correct: 0, total: 0 };
        acc.set(slug, { correct: prev.correct + v.correct, total: prev.total + v.total });
      }
    }
    return [...acc.entries()].sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
  }, [results]);

  const topicNames = useMemo(() => {
    const taxonomy = subject?.taxonomySlug ? findSubject(subject.taxonomySlug) : undefined;
    return new Map((taxonomy?.topics ?? []).map((tp) => [tp.id, tp.name]));
  }, [subject?.taxonomySlug]);

  const base = `/teacher/milliy-sertifikat/${params.subject}`;

  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push(base)}>
            <ArrowLeft />
          </IconButton>
          <PageHeader
            className="flex-1"
            title={t.title}
            subtitle={[
              subject ? subjectName(subject, L) : null,
              quiz?.title || null,
            ].filter(Boolean).join(" · ")}
          />
        </div>

        {error && <Banner tone="error" title={error} />}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-m3-lg" />)}
          </div>
        ) : results.length === 0 ? (
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyDesc} />
        ) : (
          <>
            {stats && (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label={t.sat} value={String(stats.sat)} icon={<Users />} />
                <StatTile label={t.average} value={pct(stats.avg)} icon={<BadgeCheck />} />
                <StatTile label={t.best} value={pct(stats.best)} icon={<BadgeCheck />} />
              </div>
            )}

            {/* ── students ─────────────────────────────────────────────── */}
            <Card className="p-4">
              <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.students}</h2>
              <p className="mb-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">{t.scoreHint}</p>
              <ul className="flex flex-col gap-2">
                {ranked.map((r) => {
                  const open = openRow === r.studentId;
                  const hasItems = !!r.items && Object.keys(r.items).length > 0;
                  const mine = scores.get(r.studentId);
                  // ⚠️ A legacy sitting has no per-slot outcomes, so it cannot be
                  // priced — it shows the percent it was saved with, labelled.
                  const shown = mine?.score ?? r.percent;
                  return (
                    <li key={r.studentId} className="rounded-m3-md border border-outline-variant bg-surface-container-lowest">
                      <button
                        onClick={() => setOpenRow(open ? null : r.studentId)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-on-surface">
                            {r.studentName || r.studentId}
                          </span>
                          <span className="block text-[11px] font-medium text-on-surface-variant">
                            {r.correct}/{r.total} {t.rawCorrect} · {Math.round(r.durationSec / 60)} min
                            {mine?.earned !== null && mine?.earned !== undefined
                              ? ` · ${mine.earned.toFixed(2)}/${total.toFixed(2)} ${t.ball}`
                              : ` · ${t.legacyRow}`}
                          </span>
                        </span>
                        <span className={cn(
                          "s-num flex-none text-[15px] font-black tabular-nums",
                          shown >= 60 ? "text-success" : shown >= 40 ? "text-warning" : "text-error",
                        )}>
                          {shown.toFixed(1)}
                        </span>
                        <ChevronDown size={16} className={cn("flex-none text-on-surface-variant transition-transform", open && "rotate-180")} />
                      </button>

                      {open && (
                        <div className="border-t border-outline-variant p-3">
                          {!hasItems ? (
                            <p className="text-[11px] font-medium text-on-surface-variant">{t.noItemData}</p>
                          ) : (
                            <>
                              {/* The ball this student TOOK on every question — 0
                                  where they got it wrong. This grid adds up to the
                                  headline by construction. Same 12-up density as
                                  the class grid below and as the maths page. */}
                              <ul className="grid grid-cols-6 gap-1 sm:grid-cols-9 lg:grid-cols-12">
                                {marks.map((m) => {
                                  const got = r.items?.[m.key];
                                  const topic = topicByKey.get(m.key);
                                  return (
                                    <li
                                      key={m.key}
                                      title={`${t.question} ${m.number}${topic ? ` · ${topic}` : ""} · ${m.ball.toFixed(2)}`}
                                      className={cn(
                                        "rounded-m3-xs px-0.5 py-1 text-center",
                                        got === undefined
                                          ? "bg-surface-container text-on-surface-variant"
                                          : got
                                            ? "bg-success-container text-on-success-container"
                                            : "bg-error-container text-on-error-container",
                                      )}
                                    >
                                      <span className="block text-[8.5px] font-bold leading-none tabular-nums opacity-70">
                                        {m.number}
                                      </span>
                                      <span className="s-num block text-[12px] font-black leading-tight tabular-nums">
                                        {got ? m.ball.toFixed(2) : "0"}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* ── per-topic, weakest first ─────────────────────────────── */}
            {topicTotals.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.topics}</h2>
                <ul className="flex flex-col gap-1.5">
                  {topicTotals.map(([slug, v]) => (
                    <li key={slug} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                      <span className="min-w-0 truncate text-on-surface-variant">{topicNames.get(slug) || slug || "—"}</span>
                      <span className="flex-none font-bold tabular-nums text-on-surface">
                        {v.correct}/{v.total} · {pct(v.total ? (v.correct / v.total) * 100 : 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* ── per-question: the ball, and why it is that ball ──────────
                ⚠️ The SAME surface as the maths results page (docs/RASCH_QUIZ.md):
                grouped by topic with what that topic currently adds up to, then a
                dense grid — number, ball, solve rate — up to 12 a row so a whole
                paper is one glance. It is deliberately not a list: "which
                questions did the class miss" is a shape read across the paper.
                A subject paper has no printed protocol, so there is no struck /
                underlined "before" here; everything else is identical. */}
            {measured && markGroups.length > 0 && (
              <Card className="p-4">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-bold text-on-surface">{t.perQuestion}</h2>
                  <span className="s-num text-[12px] font-black tabular-nums text-on-surface-variant">
                    {t.paperTotal}: {total.toFixed(2)}/{PAPER_TOTAL}
                  </span>
                </div>
                {/* What the formula came to on THIS paper. ⚠️ Not the maths
                    paper's 55.10 + 44.90 — the base total follows the teacher's
                    own mix of closed and typed items. */}
                <p className="s-num mb-3 text-[11px] font-black tabular-nums text-on-surface-variant">
                  {t.marksSplit}: {baseTotal.toFixed(2)} + {bonusTotal.toFixed(2)} = {total.toFixed(2)}
                </p>

                <div className="flex flex-col gap-2.5">
                  {markGroups.map((g) => (
                    <div key={g.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[11.5px] font-bold text-on-surface">{g.label}</p>
                        {/* Reported, not reserved — the paper is priced whole. */}
                        <p className="shrink-0 text-[11.5px] font-black text-primary" title={t.topicTotal}>
                          {g.total.toFixed(2)}
                        </p>
                      </div>

                      <div className="grid grid-cols-6 gap-1 sm:grid-cols-9 lg:grid-cols-12">
                        {g.marks.map((m) => {
                          const rate = m.p === null ? null : Math.round(m.p * 100);
                          return (
                            <div
                              key={m.key}
                              /* Everything the cell has no room for: the mark's
                                 split, how it is answered, the evidence, and the
                                 "still moving" warning. */
                              title={[
                                `${m.number} · ${m.ball.toFixed(2)} = ${m.base.toFixed(2)} + ${(m.ball - m.base).toFixed(2)}`,
                                m.testType === "O" ? t.openLabel : t.closedLabel,
                                rate === null ? "—" : `${rate}% ${t.solvedShort} · ${m.correct}/${m.seen}`,
                                m.provisional ? t.provisional : null,
                              ].filter(Boolean).join(" · ")}
                              className={cn(
                                "rounded-m3-xs border px-0.5 py-1 text-center",
                                // ⚠️ Coloured by the SOLVE RATE, not by the ball:
                                // `B = Y + σ` shares one budget over the whole
                                // paper, so how big a ball is depends on how long
                                // the paper is and a fixed 4.0/2.5 threshold said
                                // nothing. The solve rate is the finding; the ball
                                // is its consequence. Same bands as the maths page.
                                rate === null
                                  ? "border-outline-variant bg-surface-container text-on-surface-variant"
                                  : rate < 34
                                    ? "border-error bg-error-container text-on-error-container"
                                    : rate < 67
                                      ? "border-outline bg-surface-container-high text-on-surface"
                                      : "border-success bg-success-container text-on-success-container",
                                m.provisional && "border-dashed",
                              )}
                            >
                              <span className="block text-[8.5px] font-bold leading-none tabular-nums opacity-60">
                                {m.number}
                              </span>
                              <span className="s-num block text-[12.5px] font-black leading-tight tabular-nums">
                                {m.ball.toFixed(2)}
                              </span>
                              <span className="block text-[8.5px] font-bold leading-none tabular-nums opacity-70">
                                {rate === null ? "—" : `${rate}%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {marks.some((m) => m.provisional) && (
                  <p className="mt-3 text-[11px] font-medium text-on-surface-variant">{t.provisional}</p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
