"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ChevronDown, KeyRound, Play, TrendingUp } from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { useStudentLanguage } from "../../layout";
import { requestExamFullscreen } from "@/hooks/useExamLockdown";
import { ACCESS_CODE_LENGTH, isValidAccessCode, sanitizeAccessCode } from "@/lib/RASCHquiz";
import { shuffleSatItems } from "@/lib/SatMathQuiz";
import {
  clearSatSnapshot, getSatSnapshot, getServerSatSnapshot, saveSatSnapshot, subscribeSatSnapshot,
} from "@/lib/SatSession";
import {
  findSatTestByCode, getSatMathTest, listMySatMathResults,
} from "@/services/satMathQuizService";
import SatRunner from "../_components/SatRunner";
import SatReview from "../_components/SatReview";
import { Banner, Button, Card, EmptyState, Page, cn } from "@/components/student-ui";
import type { SatExamSnapshot, SatMathResult, SatMathTest, SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * SAT Math — the student's code box, sitting and results. Contract: docs/SAT_QUIZ.md.
 *
 * The sitting itself is `SatRunner`, a new Bluebook-style runner — SAT is a
 * different exam product from the Milliy sertifikat/mock-exam family (own
 * adaptive module structure, own visual language, own calculator/reference
 * tools), so it does NOT reuse `ExamRunner`. What it DOES reuse:
 * `useExamLockdown` (full-screen + interruption detection) and the
 * `createSessionStore` pattern (`lib/SatSession.ts`, its own localStorage key
 * so a SAT sitting can never collide with a mock exam or a Milliy sertifikat
 * paper still running).
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: "SAT Matematika",
    lead: "O'qituvchingiz bergan 6 xonali kodni kiriting.",
    codeLabel: "Kirish kodi",
    open: "Ochish",
    notFound: "Bu kod bilan test topilmadi. Tekshirib, qayta kiriting.",
    closed: "Bu test yopilgan — o'qituvchingizga murojaat qiling.",
    lookupFailed: "Kodni tekshirib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
    intro: "Test", teacher: "O'qituvchi",
    module1: "Modul 1", module2: "Modul 2", minutes: "daqiqa",
    langLabel: "Savollar tili",
    start: "Boshlash", another: "Boshqa kod kiritish",
    result: "Natija", scaledScore: "Taxminiy ball (200-800)",
    scaledHint: "Bu College Board'ning rasmiy hisob-kitobi emas — taxminiy shkala.",
    route: "Yo'nalish", routeEasier: "Oson", routeHarder: "Qiyin",
    correct: "To'g'ri", of: "/",
    review: "Savollarni ko'rish",
    myTests: "Ishlagan testlarim",
    noTests: "Hali test ishlamagansiz.",
    openReview: "Ko'rish", closeReview: "Yopish",
    reviewGone: "Bu test o'chirilgan — savollarni ko'rsatib bo'lmaydi.",
    reviewFailed: "Savollarni yuklab bo'lmadi.",
  },
  ru: {
    title: "SAT Математика",
    lead: "Введите 6-значный код, который дал учитель.",
    codeLabel: "Код доступа",
    open: "Открыть",
    notFound: "Тест с таким кодом не найден. Проверьте и введите снова.",
    closed: "Этот тест закрыт — обратитесь к учителю.",
    lookupFailed: "Не удалось проверить код. Проверьте интернет и попробуйте снова.",
    intro: "Тест", teacher: "Учитель",
    module1: "Модуль 1", module2: "Модуль 2", minutes: "минут",
    langLabel: "Язык вопросов",
    start: "Начать", another: "Ввести другой код",
    result: "Результат", scaledScore: "Приблизительный балл (200-800)",
    scaledHint: "Это не официальный расчёт College Board — приблизительная шкала.",
    route: "Направление", routeEasier: "Лёгкий", routeHarder: "Трудный",
    correct: "Верно", of: "из",
    review: "Просмотреть вопросы",
    myTests: "Мои пройденные тесты",
    noTests: "Вы ещё не проходили тест.",
    openReview: "Открыть", closeReview: "Закрыть",
    reviewGone: "Этот тест удалён — вопросы показать нельзя.",
    reviewFailed: "Не удалось загрузить вопросы.",
  },
  en: {
    title: "SAT Math",
    lead: "Enter the 6-digit code your teacher gave you.",
    codeLabel: "Access code",
    open: "Open",
    notFound: "No test found with that code. Check it and try again.",
    closed: "This test is closed — ask your teacher.",
    lookupFailed: "Could not check the code. Check your connection and try again.",
    intro: "Test", teacher: "Teacher",
    module1: "Module 1", module2: "Module 2", minutes: "minutes",
    langLabel: "Question language",
    start: "Start", another: "Enter another code",
    result: "Result", scaledScore: "Approximate score (200-800)",
    scaledHint: "Not College Board's official equating — an approximate scale.",
    route: "Route", routeEasier: "Easier", routeHarder: "Harder",
    correct: "Correct", of: "of",
    review: "Review questions",
    myTests: "Tests I've taken",
    noTests: "You haven't taken a test yet.",
    openReview: "Open", closeReview: "Close",
    reviewGone: "That test was deleted — questions can't be shown.",
    reviewFailed: "Could not load the questions.",
  },
};

/** Module-lifetime cache for a reviewed test's item content — a sat test is an
 *  immutable snapshot, so nothing can go stale. */
const reviewCache = new Map<string, SatMathTest>();
let pastCache: { uid: string; at: number; rows: SatMathResult[] } | null = null;
const PAST_TTL = 60_000;

export default function SatMathPage() {
  const { lang: appLang } = useStudentLanguage();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const t = UI[appLang] || UI.uz;

  const [code, setCode] = useState("");
  const [pendingLang, setPendingLang] = useState<Lang>("uz");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pendingTest, setPendingTest] = useState<SatMathTest | null>(null);

  const stored = useSyncExternalStore(subscribeSatSnapshot, getSatSnapshot, getServerSatSnapshot);
  const restored = useMemo(() => (stored && stored.uid === uid ? stored : null), [stored, uid]);
  const [session, setSession] = useState<SatExamSnapshot | null>(null);
  const live = session ?? restored;

  const [submittedView, setSubmittedView] = useState<{
    result: SatMathResult; module1: SatQuizItem[]; module2: SatQuizItem[]; showAnswers: boolean;
  } | null>(null);

  const commit = (next: SatExamSnapshot | null) => {
    setSession(next);
    if (!next) { clearSatSnapshot(); return; }
    saveSatSnapshot(next);
  };

  // ── past sittings, loaded only on the code screen ────────────────────────
  const [past, setPast] = useState<SatMathResult[] | null>(null);
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [openTest, setOpenTest] = useState<SatMathTest | null>(null);
  const [openState, setOpenState] = useState<"idle" | "loading" | "gone" | "failed">("idle");

  const showCode = !live && !pendingTest && !submittedView;

  useEffect(() => {
    if (!showCode || !uid) return;
    if (pastCache && pastCache.uid === uid && Date.now() - pastCache.at < PAST_TTL) {
      setPast(pastCache.rows);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMySatMathResults(uid);
        if (cancelled) return;
        pastCache = { uid, at: Date.now(), rows };
        setPast(rows);
      } catch (err) {
        console.error(err);
        if (!cancelled) setPast([]);
      }
    })();
    return () => { cancelled = true; };
  }, [showCode, uid]);

  const toggleReview = async (result: SatMathResult) => {
    if (openPast === result.testId) {
      setOpenPast(null); setOpenTest(null); setOpenState("idle");
      return;
    }
    setOpenPast(result.testId);
    const cached = reviewCache.get(result.testId);
    if (cached) { setOpenTest(cached); setOpenState("idle"); return; }

    setOpenState("loading");
    try {
      const testDoc = await getSatMathTest(result.testId);
      if (!testDoc) { setOpenTest(null); setOpenState("gone"); return; }
      reviewCache.set(result.testId, testDoc);
      setOpenTest(testDoc);
      setOpenState("idle");
    } catch (err) {
      console.error(err);
      setOpenState("failed");
    }
  };

  // ── open by code ───────────────────────────────────────────────────────
  async function openByCode() {
    if (!isValidAccessCode(code)) return;
    setLooking(true);
    setLookupError(null);
    try {
      const found = await findSatTestByCode(code);
      if ("error" in found) {
        setLookupError(found.error === "closed" ? t.closed : t.notFound);
        return;
      }
      setPendingTest(found.test);
    } catch (err) {
      console.error(err);
      setLookupError(t.lookupFailed);
    } finally {
      setLooking(false);
    }
  }

  function startTest() {
    if (!pendingTest) return;
    // ⚠️ Synchronously inside the click — see hooks/useExamLockdown.ts.
    requestExamFullscreen();
    const now = Date.now();
    const test = pendingTest;
    const snapshot: SatExamSnapshot = {
      version: 1,
      uid,
      examLang: pendingLang,
      testId: test.id,
      testTitle: test.title,
      teacherId: test.teacherId,
      teacherName: test.teacherName,
      module1: test.shuffle ? shuffleSatItems(test.module1) : test.module1,
      module2Easier: test.shuffle ? shuffleSatItems(test.module2Easier) : test.module2Easier,
      module2Harder: test.shuffle ? shuffleSatItems(test.module2Harder) : test.module2Harder,
      module1Minutes: test.module1Minutes,
      module2Minutes: test.module2Minutes,
      routingThreshold: test.routingThreshold,
      showAnswers: test.showAnswers,
      phase: "module1",
      module1Answers: {},
      module1Flagged: [],
      crossedOut: {},
      current: 0,
      module1EndsAt: now + test.module1Minutes * 60_000,
      route: null,
      module2Answers: {},
      module2Flagged: [],
      module2EndsAt: 0,
      startedAt: now,
      savedAt: now,
    };
    commit(snapshot);
    setPendingTest(null);
  }

  function backToCode() {
    setSubmittedView(null);
    setPendingTest(null);
    setCode("");
    setLookupError(null);
  }

  // ── the runner ─────────────────────────────────────────────────────────
  if (live && live.phase !== "submitted") {
    return (
      <SatRunner
        uid={uid}
        studentName={user?.displayName || ""}
        snapshot={live}
        appLang={appLang}
        onChange={commit}
        onSubmit={(result, finished) => {
          setSubmittedView({
            result,
            module1: finished.module1,
            module2: finished.route === "harder" ? finished.module2Harder : finished.module2Easier,
            showAnswers: finished.showAnswers,
          });
          commit(null);
        }}
      />
    );
  }

  return (
    <Page>
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
        <h1 className="text-[20px] font-black text-on-surface">{t.title}</h1>

        {/* ── just-submitted results ─────────────────────────────────────── */}
        {submittedView && (
          <Card variant="filled" className="flex flex-col gap-4 p-5 text-center">
            <h2 className="text-[16px] font-black text-on-surface">{t.result}</h2>
            <div>
              <div className="text-[44px] font-black leading-none text-primary">{submittedView.result.scaledScore}</div>
              <p className="mt-1 text-[11px] font-bold text-on-surface-variant">{t.scaledScore}</p>
              <p className="mt-2 text-[11px] font-medium text-on-surface-variant">{t.scaledHint}</p>
            </div>
            <div className="flex items-center justify-center gap-4 text-[13px] font-bold text-on-surface">
              <span>{submittedView.result.correct}{t.of}{submittedView.result.total} {t.correct}</span>
              <span className={cn(
                "rounded-m3-xs px-2 py-0.5 text-[11px] font-bold uppercase",
                submittedView.result.route === "harder" ? "bg-success-container text-on-success-container" : "bg-warning-container text-on-warning-container",
              )}>
                {t.route}: {submittedView.result.route === "harder" ? t.routeHarder : t.routeEasier}
              </span>
            </div>
            <SatReview
              module1={submittedView.module1}
              module2={submittedView.module2}
              outcomes={submittedView.result.items ?? {}}
              showAnswers={submittedView.showAnswers}
              lang={submittedView.result.examLang}
            />
            <Button onClick={backToCode}>{t.another}</Button>
          </Card>
        )}

        {/* ── pending: found by code, choose language, start ────────────── */}
        {pendingTest && (
          <Card variant="filled" className="flex flex-col gap-4 p-5">
            <h2 className="text-[16px] font-black text-on-surface">{pendingTest.title || t.intro}</h2>
            {pendingTest.teacherName && (
              <p className="text-[12.5px] font-medium text-on-surface-variant">{t.teacher}: {pendingTest.teacherName}</p>
            )}
            <div className="flex flex-wrap gap-3 text-[12.5px] font-bold text-on-surface-variant">
              <span>{t.module1}: {pendingTest.module1.length} · {pendingTest.module1Minutes} {t.minutes}</span>
              <span>{t.module2}: {pendingTest.module2Minutes} {t.minutes}</span>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.langLabel}</p>
              <div className="flex gap-2">
                {(["uz", "ru", "en"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setPendingLang(l)}
                    className={cn(
                      "rounded-m3-md border px-3 py-1.5 text-[12px] font-bold",
                      pendingLang === l ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant",
                    )}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <Button size="lg" icon={<Play />} onClick={startTest}>{t.start}</Button>
          </Card>
        )}

        {/* ── code entry ──────────────────────────────────────────────────── */}
        {showCode && (
          <>
            <Card className="flex flex-col gap-4 p-5">
              <p className="text-[13px] font-medium text-on-surface-variant">{t.lead}</p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(sanitizeAccessCode(e.target.value))}
                  maxLength={ACCESS_CODE_LENGTH}
                  placeholder={t.codeLabel}
                  inputMode="numeric"
                  className="flex-1 rounded-m3-md border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-center text-[20px] font-black tracking-[0.3em] text-on-surface outline-none focus:border-primary"
                />
                <Button icon={<KeyRound />} loading={looking} disabled={!isValidAccessCode(code)} onClick={openByCode}>
                  {t.open}
                </Button>
              </div>
              {lookupError && <Banner status="error" icon={<AlertTriangle size={14} />} title={lookupError} />}
            </Card>

            {past && past.length > 0 && (
              <Card className="flex flex-col gap-3 p-4">
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
                  <TrendingUp size={15} /> {t.myTests}
                </h3>
                <ul className="flex flex-col gap-2">
                  {past.map((r) => {
                    const open = openPast === r.testId;
                    return (
                      <li key={r.testId} className="rounded-m3-md border border-outline-variant">
                        <button
                          onClick={() => toggleReview(r)}
                          className="flex w-full items-center gap-3 p-3 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-on-surface">{r.testTitle}</span>
                          <span className="flex-none text-[14px] font-black text-primary">{r.scaledScore}</span>
                          <ChevronDown size={14} className={cn("flex-none text-on-surface-variant transition-transform", open && "rotate-180")} />
                        </button>
                        {open && (
                          <div className="border-t border-outline-variant p-3">
                            {openState === "loading" && <p className="text-[12px] text-on-surface-variant">…</p>}
                            {openState === "gone" && <p className="text-[12px] text-on-surface-variant">{t.reviewGone}</p>}
                            {openState === "failed" && <p className="text-[12px] text-error">{t.reviewFailed}</p>}
                            {openTest && openState === "idle" && (
                              <SatReview
                                module1={openTest.module1}
                                module2={r.route === "harder" ? openTest.module2Harder : openTest.module2Easier}
                                outcomes={r.items ?? {}}
                                showAnswers={openTest.showAnswers}
                                lang={r.examLang}
                              />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {past && past.length === 0 && (
              <EmptyState icon={<KeyRound />} title={t.noTests} />
            )}
          </>
        )}
      </div>
    </Page>
  );
}
