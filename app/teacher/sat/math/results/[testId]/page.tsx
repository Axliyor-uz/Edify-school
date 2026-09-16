"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Sigma, Target, TrendingUp, Users } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { SAT_MATH_DOMAINS, type SatMathDomainInfo } from "@/lib/SatMathQuiz";
import { getSatMathTest, listSatMathResults } from "@/services/satMathQuizService";
import { formatScoreBand } from "@/lib/SATscore";
import { Banner, Card, EmptyState, IconButton, PageHeader, Skeleton, StatTile, cn } from "@/components/ui";
import type { SatMathDomain, SatMathResult, SatMathTest, SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * Who sat one SAT Math test, and how they did.
 *
 * ⚠️ **No cohort dynamic marking** (unlike the Milliy sertifikat papers'
 * `lib/RASCHmarks.ts`) — SAT scores per-student on the approximate scaled
 * curve (`lib/SATscore.ts`), the way the real test actually works: one
 * student's score does not move because of how classmates did. The
 * per-question numbers here are a plain solve rate, reported for the
 * teacher's own read of the item, never priced into anyone's score.
 *
 * Cost: 1 read (the test, for item metadata) + 1 query (every sitting).
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    title: "Natijalar",
    loading: "Yuklanmoqda…",
    emptyTitle: "Hali hech kim ishlamagan",
    emptyDesc: "O'quvchilar kodni kiritib testni ishlagach, natijalar shu yerda ko'rinadi.",
    sat: "Ishlagan", average: "O'rtacha ball", best: "Eng yaxshi",
    scaledHint: "200–800 taxminiy shkala — College Board rasmiy hisob-kitobi emas.",
    domains: "Fan bo'limlari bo'yicha (sinf)",
    perQuestion: "Savollar bo'yicha yechilish darajasi",
    module1: "Modul 1", module2: "Modul 2",
    routeEasier: "Oson", routeHarder: "Qiyin",
    correctOf: "to'g'ri",
    breakdown: "Tahlil", wrongShort: "xato", blankShort: "bo'sh",
    noItemData: "Bu urinish savol darajasida saqlanmagan.",
    loadFailed: "Natijalarni yuklab bo'lmadi",
    notFound: "Test topilmadi",
  },
  ru: {
    back: "Назад",
    title: "Результаты",
    loading: "Загрузка…",
    emptyTitle: "Пока никто не проходил",
    emptyDesc: "Как только ученики введут код и пройдут тест, результаты появятся здесь.",
    sat: "Прошли", average: "Средний балл", best: "Лучший",
    scaledHint: "Приблизительная шкала 200–800 — не официальный расчёт College Board.",
    domains: "По разделам (класс)",
    perQuestion: "Доля правильных ответов по вопросам",
    module1: "Модуль 1", module2: "Модуль 2",
    routeEasier: "Лёгкий", routeHarder: "Трудный",
    correctOf: "верно",
    breakdown: "Разбор", wrongShort: "неверно", blankShort: "пусто",
    noItemData: "Эта попытка не сохранена по вопросам.",
    loadFailed: "Не удалось загрузить результаты",
    notFound: "Тест не найден",
  },
  en: {
    back: "Back",
    title: "Results",
    loading: "Loading…",
    emptyTitle: "Nobody has sat it yet",
    emptyDesc: "Once students enter the code and finish the test, their results show up here.",
    sat: "Sat it", average: "Average score", best: "Best",
    scaledHint: "An approximate 200–800 scale — not College Board's official equating.",
    domains: "By domain (class)",
    perQuestion: "Per-question solve rate",
    module1: "Module 1", module2: "Module 2",
    routeEasier: "Easier", routeHarder: "Harder",
    correctOf: "correct",
    breakdown: "Breakdown", wrongShort: "wrong", blankShort: "blank",
    noItemData: "This sitting was not saved per question.",
    loadFailed: "Could not load the results",
    notFound: "Test not found",
  },
};

const pct = (n: number) => `${Math.round(n)}%`;

export default function SatMathResultsPage() {
  const router = useRouter();
  const params = useParams<{ testId: string }>();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const [test, setTest] = useState<SatMathTest | null>(null);
  const [results, setResults] = useState<SatMathResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [testDoc, rows] = await Promise.all([
        getSatMathTest(params.testId),
        listSatMathResults(params.testId, user.uid),
      ]);
      setTest(testDoc);
      setResults(rows);
    } catch (err) {
      console.error(err);
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [user, params.testId, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  /** Every item across all three modules, by id — for question text + domain. */
  const itemsById = useMemo(() => {
    const map = new Map<string, SatQuizItem>();
    if (test) {
      for (const q of [...test.module1, ...test.module2Easier, ...test.module2Harder]) map.set(q.id, q);
    }
    return map;
  }, [test]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const scores = results.map((r) => r.scaledScore);
    return {
      count: results.length,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
    };
  }, [results]);

  /** Per-domain raw counts, aggregated across every sitting — weakest first. */
  const domainRows = useMemo(() => {
    const totals: Partial<Record<SatMathDomain, { correct: number; total: number }>> = {};
    for (const r of results) {
      for (const [domain, v] of Object.entries(r.domains ?? {})) {
        const key = domain as SatMathDomain;
        const cur = totals[key] ?? { correct: 0, total: 0 };
        totals[key] = { correct: cur.correct + v.correct, total: cur.total + v.total };
      }
    }
    const rows: { domain: SatMathDomainInfo; stats: { correct: number; total: number } }[] = [];
    for (const domain of SAT_MATH_DOMAINS) {
      const stats = totals[domain.id];
      if (stats) rows.push({ domain, stats });
    }
    return rows.sort((a, b) => (a.stats.correct / a.stats.total) - (b.stats.correct / b.stats.total));
  }, [results]);

  /** Per-question solve rate, aggregated across every sitting that has `items`. */
  const questionRows = useMemo(() => {
    const totals = new Map<string, { correct: number; seen: number }>();
    for (const r of results) {
      for (const [qid, outcome] of Object.entries(r.items ?? {})) {
        const cur = totals.get(qid) ?? { correct: 0, seen: 0 };
        totals.set(qid, { correct: cur.correct + outcome, seen: cur.seen + 1 });
      }
    }
    return [...totals.entries()]
      .map(([qid, stats]) => ({ qid, item: itemsById.get(qid), stats }))
      .filter((row) => row.item)
      .sort((a, b) => (a.stats.correct / a.stats.seen) - (b.stats.correct / b.stats.seen));
  }, [results, itemsById]);

  const anyItemData = results.some((r) => r.items && Object.keys(r.items).length > 0);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Skeleton className="mb-4 h-10 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-m3-lg" />)}
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={<Sigma />} title={t.notFound} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface pb-16">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push("/teacher/sat/math")}>
            <ArrowLeft />
          </IconButton>
          <PageHeader className="flex-1" title={test.title || t.title} subtitle={t.title} />
        </div>

        {error && <Banner tone="error" title={error} />}

        {results.length === 0 ? (
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyDesc} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile icon={<Users />} label={t.sat} value={summary!.count} tone="primary" />
              <StatTile icon={<TrendingUp />} label={t.average} value={summary!.average} tone="secondary" />
              <StatTile icon={<Target />} label={t.best} value={summary!.best} tone="tertiary" />
            </div>
            <p className="-mt-3 text-[11px] font-medium text-on-surface-variant">{t.scaledHint}</p>

            {domainRows.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.domains}</h2>
                <ul className="flex flex-col gap-2">
                  {domainRows.map(({ domain, stats }) => {
                    const rate = (stats.correct / stats.total) * 100;
                    return (
                      <li key={domain.id} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-on-surface-variant">
                          {domain.name[L] || domain.name.uz}
                        </span>
                        <div className="h-1.5 w-28 flex-none overflow-hidden rounded-full bg-surface-container-high">
                          <div
                            className={cn("h-full rounded-full", rate < 40 ? "bg-error" : rate < 70 ? "bg-warning" : "bg-success")}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="w-24 flex-none text-right text-[11px] font-bold tabular-nums text-on-surface">
                          {stats.correct}/{stats.total} · {pct(rate)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {anyItemData && questionRows.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.perQuestion}</h2>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-10">
                  {questionRows.map(({ qid, stats }) => {
                    const rate = (stats.correct / stats.seen) * 100;
                    return (
                      <div
                        key={qid}
                        title={`${stats.correct}/${stats.seen} ${t.correctOf}`}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-m3-sm px-1.5 py-2 text-center",
                          rate < 40 ? "bg-error-container text-on-error-container"
                            : rate < 70 ? "bg-warning-container text-on-warning-container"
                            : "bg-success-container text-on-success-container",
                        )}
                      >
                        <span className="text-[11px] font-black tabular-nums">{pct(rate)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.students}</h2>
              <ul className="flex flex-col gap-2">
                {results.map((r) => {
                  const open = expanded === r.studentId;
                  return (
                    <li key={r.studentId} className="rounded-m3-md border border-outline-variant bg-surface-container-lowest">
                      <button
                        onClick={() => setExpanded(open ? null : r.studentId)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-on-surface">{r.studentName}</span>
                        <span className={cn(
                          "rounded-m3-xs px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          r.route === "harder" ? "bg-success-container text-on-success-container" : "bg-warning-container text-on-warning-container",
                        )}>
                          {r.route === "harder" ? t.routeHarder : t.routeEasier}
                        </span>
                        {/* The BAND when the sitting has one, else the legacy single number. */}
                        <span className="flex-none text-[15px] font-black tabular-nums text-on-surface">
                          {r.scoreBand ? formatScoreBand(r.scoreBand) : r.scaledScore}
                        </span>
                        <ChevronDown size={16} className={cn("flex-none text-on-surface-variant transition-transform", open && "rotate-180")} />
                      </button>
                      {open && (
                        <div className="grid grid-cols-2 gap-3 border-t border-outline-variant p-3 text-[12px] font-medium text-on-surface-variant sm:grid-cols-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide">{t.module1}</div>
                            <div className="text-on-surface">{r.module1Correct}/{r.module1Total}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide">
                              {t.module2} ({r.route === "harder" ? t.routeHarder : t.routeEasier})
                            </div>
                            <div className="text-on-surface">{r.module2Correct}/{r.module2Total}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide">{t.correctOf}</div>
                            <div className="text-on-surface">{r.correct}/{r.total}</div>
                          </div>
                          {/* Blanks vs wrong answers — hidden entirely on a sitting
                              graded before `omitted` existed, rather than claiming 0. */}
                          {r.omitted !== undefined && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide">{t.breakdown}</div>
                              <div className="text-on-surface">
                                {Math.max(0, r.total - r.correct - r.omitted.length)} {t.wrongShort} · {r.omitted.length} {t.blankShort}
                              </div>
                            </div>
                          )}
                          {(!r.items || Object.keys(r.items).length === 0) && (
                            <div className="col-span-2 italic sm:col-span-1">{t.noItemData}</div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
