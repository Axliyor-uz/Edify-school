"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown, ArrowLeft, ArrowUp, BadgeCheck, Database, HelpCircle, KeyRound,
  Save, Send, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";
import {
  SAT_RW_DOMAINS, SAT_RW_TAXONOMY_SLUG, SAT_MAX_BYTES,
  checkSatAdd, defaultSatRoutingThreshold, satByteSize, satItemPreview, satPickedIds, satQuizItem,
} from "@/lib/SatMathQuiz";
import { fetchQuestionById } from "@/services/questionBankService";
import { questionBuilderHref } from "@/app/teacher/create/_components/returnTo";
import {
  getSatEnglishTest, newSatEnglishTestId, reserveSatEnglishCode, saveSatEnglishTest, setSatEnglishTestStatus,
} from "@/services/satEnglishQuizService";
import SatEnglishBankPicker, { type SatEnglishPickerStrings } from "../_components/SatEnglishBankPicker";
import { clearSatEnglishDraft, readSatEnglishDraft, writeSatEnglishDraft } from "../_components/draft";
import {
  Banner, Button, Card, IconButton, PageHeader, ProgressBar, Spinner, Switch, Tabs,
  TextField, cn,
} from "@/components/ui";
import type { SatMathTestStatus, SatQuizItem } from "@/types/SatQuiz";
import type { Lang } from "@/types/Math";

/**
 * Builds one adaptive SAT English test: Module 1 (fixed) + two Module 2 pools
 * (Easier / Harder). Sibling of app/teacher/sat/math/build/page.tsx — same
 * shape, minus the "Namunaviy variant" sample-paper button (Math has a
 * bundled default paper; English does not — the platform bank IS the ready
 * content, picked one question at a time). Contract: docs/SAT_QUIZ.md.
 *
 * ⚠️ No blueprint quota, no cohort marking — a teacher builds each module to
 * whatever length they like; publishing only requires all three non-empty.
 */

type ModuleKey = "module1" | "module2Easier" | "module2Harder";
const MODULE_KEYS: ModuleKey[] = ["module1", "module2Easier", "module2Harder"];

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    newTitle: "Yangi SAT Ingliz tili testi",
    editTitle: "Testni tahrirlash",
    subtitle: "Modul 1 barcha o'quvchilar uchun bir xil; Modul 2 natijaga qarab tanlanadi.",
    name: "Test nomi",
    namePlaceholder: "Masalan: SAT Reading & Writing — 1-amaliyot",
    description: "Tavsif (ixtiyoriy)",
    module1Minutes: "Modul 1 vaqti (daqiqa)",
    module2Minutes: "Modul 2 vaqti (daqiqa)",
    threshold: "O'tish chegarasi",
    thresholdHint: "Modul 1'da shuncha yoki ko'proq to'g'ri javob — Qiyin Modul 2'ga yo'naltiradi; kamroq bo'lsa — Oson Modul 2'ga.",
    shuffle: "Savollarni aralashtirish",
    shuffleHint: "Har bir o'quvchi savollarni boshqa tartibda ko'radi.",
    showAnswers: "Javoblarni ko'rsatish",
    showAnswersHint: "Yakunlangandan so'ng to'g'ri javoblar va izohlar ko'rinadi.",
    code: "Kirish kodi",
    codePending: "Saqlaganda beriladi",
    progress: "Savollar",
    size: "hajmi",
    domains: "Fan bo'limlari bo'yicha (barcha modullar)",
    domainsEmpty: "Savol qo'shilgach, bo'limlar bo'yicha taqsimot shu yerda ko'rinadi.",
    module1Tab: "Modul 1",
    module2EasierTab: "Modul 2 — Oson",
    module2HarderTab: "Modul 2 — Qiyin",
    addTitle: "Savol qo'shish",
    addHint: "Platforma bazasidan (1400+ savol) yoki o'zingiz yozgan SAT Ingliz tili savollari ko'rinadi.",
    newSingle: "Yangi savol yaratish",
    newSingleHint: "Variantli (4 ta javob) savol.",
    source: "Manba", srcPlatform: "Platforma bazasi", srcMine: "O'zim",
    srcShared: "Ulashilgan", by: "·",
    load: "Yuklash", loadMore: "Yana 10 ta", none: "Savol topilmadi",
    reads: "ta hujjat o'qildi",
    add: "Qo'shish", added: "Qo'shilgan", imageOnly: "Rasmli savol", full: "To'ldi",
    draftKept: "Testingiz saqlab qo'yildi — savol yaratib qaytsangiz yo'qolmaydi.",
    addedBack: "Yangi savol modulga qo'shildi.",
    addBackMissing: "Yangi savolni topib bo'lmadi — quyidagi «Yuklash» orqali qo'shing.",
    addBackSubject: "Bu savol SAT Ingliz tili bo'limiga tegishli emas — qo'shilmadi.",
    discardDraft: "Tozalash",
    thisModule: "Bu modul",
    emptyModule: "Hali savol qo'shilmagan.",
    remove: "Olib tashlash", up: "Yuqoriga", down: "Pastga",
    save: "Saqlash",
    saveAndPublish: "Saqlash va faollashtirish",
    saved: "Saqlandi",
    published: "Test faollashtirildi",
    saveFailed: "Saqlab bo'lmadi",
    tooLarge: "Test juda katta — bir nechta savolni olib tashlang.",
    needTitle: "Test nomini kiriting",
    needAllModules: "Faollashtirish uchun har uchala modulda kamida bitta savol bo'lishi kerak.",
    dupe: "Bu savol allaqachon qo'shilgan.",
    unsupported: "Bu savol turi SAT Ingliz tili uchun mos emas (faqat variantli).",
    loadFailed: "Testni yuklab bo'lmadi",
  },
  ru: {
    back: "Назад",
    newTitle: "Новый тест SAT Английский",
    editTitle: "Редактирование теста",
    subtitle: "Модуль 1 одинаков для всех; Модуль 2 выбирается по результату.",
    name: "Название теста",
    namePlaceholder: "Например: SAT Reading & Writing — практика 1",
    description: "Описание (необязательно)",
    module1Minutes: "Время Модуля 1 (минут)",
    module2Minutes: "Время Модуля 2 (минут)",
    threshold: "Порог перехода",
    thresholdHint: "Столько или больше верных в Модуле 1 — направляет в Трудный Модуль 2; меньше — в Лёгкий.",
    shuffle: "Перемешивать вопросы",
    shuffleHint: "Каждый ученик увидит вопросы в своём порядке.",
    showAnswers: "Показывать ответы",
    showAnswersHint: "После завершения видны правильные ответы и объяснения.",
    code: "Код доступа",
    codePending: "Будет выдан при сохранении",
    progress: "Вопросы",
    size: "размер",
    domains: "По разделам (все модули)",
    domainsEmpty: "Как только добавите вопросы, здесь появится распределение по разделам.",
    module1Tab: "Модуль 1",
    module2EasierTab: "Модуль 2 — Лёгкий",
    module2HarderTab: "Модуль 2 — Трудный",
    addTitle: "Добавить вопрос",
    addHint: "Показаны вопросы из платформенной базы (1400+) или ваши собственные вопросы SAT Английский.",
    newSingle: "Создать новый вопрос",
    newSingleHint: "С вариантами (4 ответа).",
    source: "Источник", srcPlatform: "Платформенная база", srcMine: "Я сам",
    srcShared: "Общие", by: "·",
    load: "Загрузить", loadMore: "Ещё 10", none: "Вопросы не найдены",
    reads: "документов прочитано",
    add: "Добавить", added: "Добавлен", imageOnly: "Вопрос с картинкой", full: "Заполнено",
    draftKept: "Ваш тест сохранён — он не потеряется, пока вы создаёте вопрос.",
    addedBack: "Новый вопрос добавлен в модуль.",
    addBackMissing: "Не удалось найти новый вопрос — добавьте его кнопкой «Загрузить» ниже.",
    addBackSubject: "Этот вопрос не относится к SAT Английский — он не добавлен.",
    discardDraft: "Очистить",
    thisModule: "Этот модуль",
    emptyModule: "Вопросы ещё не добавлены.",
    remove: "Убрать", up: "Вверх", down: "Вниз",
    save: "Сохранить",
    saveAndPublish: "Сохранить и активировать",
    saved: "Сохранено",
    published: "Тест активирован",
    saveFailed: "Не удалось сохранить",
    tooLarge: "Тест слишком большой — уберите несколько вопросов.",
    needTitle: "Введите название теста",
    needAllModules: "Для активации в каждом из трёх модулей должен быть хотя бы один вопрос.",
    dupe: "Этот вопрос уже добавлен.",
    unsupported: "Этот тип вопроса не подходит для SAT Английский (только с вариантами).",
    loadFailed: "Не удалось загрузить тест",
  },
  en: {
    back: "Back",
    newTitle: "New SAT English test",
    editTitle: "Edit test",
    subtitle: "Module 1 is the same for everyone; Module 2 is chosen from the result.",
    name: "Test name",
    namePlaceholder: "e.g. SAT Reading & Writing — Practice 1",
    description: "Description (optional)",
    module1Minutes: "Module 1 time (minutes)",
    module2Minutes: "Module 2 time (minutes)",
    threshold: "Routing threshold",
    thresholdHint: "This many (or more) correct in Module 1 routes to the Harder Module 2; fewer routes to the Easier one.",
    shuffle: "Shuffle questions",
    shuffleHint: "Each student sees the questions in their own order.",
    showAnswers: "Show answers",
    showAnswersHint: "Correct answers and explanations are revealed after submitting.",
    code: "Access code",
    codePending: "Issued when you save",
    progress: "Questions",
    size: "size",
    domains: "By domain (all modules)",
    domainsEmpty: "Once you add questions, their spread across domains shows up here.",
    module1Tab: "Module 1",
    module2EasierTab: "Module 2 — Easier",
    module2HarderTab: "Module 2 — Harder",
    addTitle: "Add a question",
    addHint: "Pulled from the platform bank (1,400+ questions) or your own SAT English questions.",
    newSingle: "Create a new question",
    newSingleHint: "Multiple choice (4 options).",
    source: "Source", srcPlatform: "Platform bank", srcMine: "Me",
    srcShared: "Shared", by: "·",
    load: "Load", loadMore: "10 more", none: "No questions found",
    reads: "documents read",
    add: "Add", added: "Added", imageOnly: "Image question", full: "Full",
    draftKept: "Your test is saved — it survives going off to write a question.",
    addedBack: "Your new question was added to the module.",
    addBackMissing: "Could not find the new question — add it with “Load” below.",
    addBackSubject: "That question isn't a SAT English question — it was not added.",
    discardDraft: "Start over",
    thisModule: "This module",
    emptyModule: "No questions added yet.",
    remove: "Remove", up: "Up", down: "Down",
    save: "Save",
    saveAndPublish: "Save & publish",
    saved: "Saved",
    published: "The test is live",
    saveFailed: "Could not save",
    tooLarge: "The test is too large — remove a few questions.",
    needTitle: "Give the test a name",
    needAllModules: "Publishing needs at least one question in each of the three modules.",
    dupe: "That question is already added.",
    unsupported: "That question type doesn't fit SAT English (multiple choice only).",
    loadFailed: "Could not load the test",
  },
};

function BuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const base = "/teacher/sat/english";

  const [testId, setTestId] = useState(() => editId || newSatEnglishTestId());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module1Minutes, setModule1Minutes] = useState(32);
  const [module2Minutes, setModule2Minutes] = useState(32);
  const [routingThreshold, setRoutingThreshold] = useState(14);
  const [shuffle, setShuffle] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<SatMathTestStatus>("draft");

  const [modules, setModules] = useState<Record<ModuleKey, SatQuizItem[]>>({
    module1: [], module2Easier: [], module2Harder: [],
  });
  const [activeTab, setActiveTab] = useState<ModuleKey>("module1");

  const [loading, setLoading] = useState(!!editId);
  /** ⚠️ The auto-add below MUST wait for this, or it checks against an empty
   *  test and stashes a draft that has lost every question on it. */
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [thresholdTouched, setThresholdTouched] = useState(false);

  const backHere = (module: ModuleKey) =>
    `${base}/build${editId ? `?id=${editId}&module=${module}` : `?module=${module}`}`;

  // ── load: the local draft first, then the server copy ───────────────────
  useEffect(() => {
    const draft = readSatEnglishDraft();
    const mine = draft && (editId ? draft.testId === editId : true);

    if (draft && mine) {
      // ⚠️ ADOPT the draft's id — a fresh id minted on mount would fork a
      // saved test into a second document the moment the teacher came back.
      setTestId(draft.testId);
      setTitle(draft.title);
      setDescription(draft.description);
      setModule1Minutes(draft.module1Minutes);
      setModule2Minutes(draft.module2Minutes);
      setRoutingThreshold(draft.routingThreshold);
      setShuffle(draft.shuffle);
      setShowAnswers(draft.showAnswers);
      setAccessCode(draft.accessCode);
      setStatus(draft.status);
      setModules({ module1: draft.module1, module2Easier: draft.module2Easier, module2Harder: draft.module2Harder });
      setThresholdTouched(true);
      setRestored(true);
      setLoading(false);
      setHydrated(true);
      return;
    }

    if (!editId) { setHydrated(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const test = await getSatEnglishTest(editId);
        if (cancelled || !test) {
          if (!cancelled) setLoadError(t.loadFailed);
          return;
        }
        setTitle(test.title);
        setDescription(test.description || "");
        setModule1Minutes(test.module1Minutes || 32);
        setModule2Minutes(test.module2Minutes || 32);
        setRoutingThreshold(test.routingThreshold || defaultSatRoutingThreshold(test.module1.length));
        setThresholdTouched(true);
        setShuffle(test.shuffle);
        setShowAnswers(test.showAnswers);
        setAccessCode(test.accessCode);
        setStatus(test.status);
        setModules({ module1: test.module1, module2Easier: test.module2Easier, module2Harder: test.module2Harder });
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(t.loadFailed);
      } finally {
        if (!cancelled) { setLoading(false); setHydrated(true); }
      }
    })();
    return () => { cancelled = true; };
    // Runs once per test: re-running would stomp on whatever the teacher has
    // since picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // A teacher who never touches the threshold gets the sensible default,
  // tracking Module 1's own length as it grows.
  useEffect(() => {
    if (!thresholdTouched) setRoutingThreshold(defaultSatRoutingThreshold(modules.module1.length));
  }, [modules.module1.length, thresholdTouched]);

  // ── derived ────────────────────────────────────────────────────────────
  const bytes = useMemo(
    () => satByteSize(modules.module1, modules.module2Easier, modules.module2Harder),
    [modules],
  );
  const complete = modules.module1.length > 0 && modules.module2Easier.length > 0 && modules.module2Harder.length > 0;

  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of MODULE_KEYS) {
      for (const q of modules[key]) counts[q.domain] = (counts[q.domain] ?? 0) + 1;
    }
    return counts;
  }, [modules]);

  const addItem = useCallback((module: ModuleKey, item: SatQuizItem): SatQuizItem | null => {
    const check = checkSatAdd(modules[module], item);
    if (!check.ok) {
      if (check.reason === "duplicate") toast.error(t.dupe);
      else toast.error(t.unsupported);
      return null;
    }
    setModules((prev) => (
      prev[module].some((q) => q.id === item.id) ? prev : { ...prev, [module]: [...prev[module], item] }
    ));
    return item;
  }, [modules, t]);

  const removeItem = (module: ModuleKey, id: string) =>
    setModules((prev) => ({ ...prev, [module]: prev[module].filter((q) => q.id !== id) }));

  const move = (module: ModuleKey, index: number, delta: number) =>
    setModules((prev) => {
      const list = prev[module];
      const to = index + delta;
      if (to < 0 || to >= list.length) return prev;
      const next = [...list];
      [next[index], next[to]] = [next[to], next[index]];
      return { ...prev, [module]: next };
    });

  /** Park the test before leaving for a question builder. */
  const stashModules = useCallback((next: Record<ModuleKey, SatQuizItem[]>) => {
    writeSatEnglishDraft({
      testId, title, description, module1Minutes, module2Minutes, routingThreshold,
      shuffle, showAnswers, accessCode, status,
      module1: next.module1, module2Easier: next.module2Easier, module2Harder: next.module2Harder,
    });
  }, [testId, title, description, module1Minutes, module2Minutes, routingThreshold, shuffle, showAnswers, accessCode, status]);

  const stash = () => stashModules(modules);

  /**
   * The return trip from the question builder (`?add=<questionId>&module=<key>`).
   * ⚠️ Waits for `hydrated` — see the Math builder for why.
   */
  const addBackId = params.get("add");
  const addBackModule = (params.get("module") as ModuleKey | null) ?? "module1";
  const addBackRef = useRef(false);
  useEffect(() => {
    if (!addBackId || !hydrated || addBackRef.current) return;
    addBackRef.current = true;

    (async () => {
      try {
        const question = await fetchQuestionById(addBackId);
        if (!question) { toast.error(t.addBackMissing); return; }
        if (question.subjectId !== SAT_RW_TAXONOMY_SLUG) {
          toast.error(t.addBackSubject);
          return;
        }
        const item = satQuizItem(question);
        const added = item && addItem(addBackModule, item);
        if (!added) { if (!item) toast.error(t.unsupported); return; }
        stashModules({ ...modules, [addBackModule]: [...modules[addBackModule], added] });
        setActiveTab(addBackModule);
        toast.success(t.addedBack);
      } catch (err) {
        console.error(err);
        toast.error(t.addBackMissing);
      } finally {
        router.replace(editId ? `${base}/build?id=${editId}` : `${base}/build`);
      }
    })();
    // Runs once per return trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addBackId, hydrated]);

  const discard = () => {
    clearSatEnglishDraft();
    setTitle("");
    setDescription("");
    setModule1Minutes(32);
    setModule2Minutes(32);
    setThresholdTouched(false);
    setShuffle(true);
    setShowAnswers(true);
    setAccessCode("");
    setStatus("draft");
    setModules({ module1: [], module2Easier: [], module2Harder: [] });
    setRestored(false);
  };

  async function persist(publish: boolean) {
    if (!user) return;
    if (!title.trim()) { toast.error(t.needTitle); return; }
    if (publish && !complete) { toast.error(t.needAllModules); return; }
    if (bytes > SAT_MAX_BYTES) { toast.error(t.tooLarge); return; }

    setSaving(true);
    try {
      // ⚠️ Minted on the FIRST save and never regenerated.
      const code = accessCode || await reserveSatEnglishCode();
      const nextStatus: SatMathTestStatus = publish ? "published" : status;

      await saveSatEnglishTest(testId, {
        title: title.trim(),
        description: description.trim(),
        teacherId: user.uid,
        teacherName: user.displayName || "",
        accessCode: code,
        module1: modules.module1,
        module2Easier: modules.module2Easier,
        module2Harder: modules.module2Harder,
        module1Minutes: Math.max(1, module1Minutes),
        module2Minutes: Math.max(1, module2Minutes),
        routingThreshold: Math.max(0, Math.min(routingThreshold, modules.module1.length)),
        shuffle,
        showAnswers,
        status: nextStatus,
      });

      if (publish && nextStatus !== "published") await setSatEnglishTestStatus(testId, "published");

      setAccessCode(code);
      setStatus(nextStatus);
      clearSatEnglishDraft();
      setRestored(false);
      toast.success(publish ? t.published : t.saved);
      if (publish) router.push(base);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message.startsWith("TEST_TOO_LARGE") ? t.tooLarge : t.saveFailed;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>;
  }

  const pickerStrings: SatEnglishPickerStrings = {
    source: t.source, srcPlatform: t.srcPlatform, srcMine: t.srcMine,
    srcShared: t.srcShared, by: t.by,
    load: t.load, loadMore: t.loadMore, none: t.none, reads: t.reads,
    add: t.add, added: t.added, imageOnly: t.imageOnly, full: t.full,
  };

  const TAB_LABEL: Record<ModuleKey, string> = {
    module1: t.module1Tab, module2Easier: t.module2EasierTab, module2Harder: t.module2HarderTab,
  };

  const items = modules[activeTab];
  const picked = satPickedIds(items);

  return (
    <div className="min-h-[100dvh] bg-surface pb-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push(base)}>
            <ArrowLeft />
          </IconButton>
          <PageHeader
            className="flex-1"
            title={editId ? t.editTitle : t.newTitle}
            subtitle={t.subtitle}
          />
        </div>

        {loadError && <Banner tone="error" title={loadError} />}

        {restored && (
          <Banner tone="info" title={t.draftKept}>
            <Button size="sm" variant="text" onClick={discard}>{t.discardDraft}</Button>
          </Banner>
        )}

        {/* ── settings ─────────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t.name}
              value={title}
              placeholder={t.namePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label={t.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label={t.module1Minutes}
              type="number"
              min={1}
              value={module1Minutes}
              onChange={(e) => setModule1Minutes(Number(e.target.value) || 32)}
            />
            <TextField
              label={t.module2Minutes}
              type="number"
              min={1}
              value={module2Minutes}
              onChange={(e) => setModule2Minutes(Number(e.target.value) || 32)}
            />
            <TextField
              label={t.threshold}
              type="number"
              min={0}
              max={modules.module1.length}
              value={routingThreshold}
              onChange={(e) => { setThresholdTouched(true); setRoutingThreshold(Math.max(0, Number(e.target.value) || 0)); }}
            />
          </div>
          <p className="-mt-1 text-[11px] font-medium text-on-surface-variant">{t.thresholdHint}</p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Switch checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              <span>
                {t.shuffle}
                <span className="block text-[11px] font-normal text-on-surface-variant">{t.shuffleHint}</span>
              </span>
            </label>

            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Switch checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
              <span>
                {t.showAnswers}
                <span className="block text-[11px] font-normal text-on-surface-variant">{t.showAnswersHint}</span>
              </span>
            </label>

            <div className="ml-auto flex items-center gap-2 rounded-m3-md border border-outline-variant bg-surface-container px-3 py-2">
              <KeyRound size={14} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.code}</span>
              <span className="text-[18px] font-black tracking-[0.2em] text-on-surface">
                {accessCode || (
                  <span className="text-[11px] font-medium tracking-normal text-on-surface-variant">{t.codePending}</span>
                )}
              </span>
            </div>
          </div>
        </Card>

        {/* ── progress + domain make-up ────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {MODULE_KEYS.map((key) => (
              <div key={key}>
                <div className="mb-1.5 flex items-end justify-between gap-3">
                  <span className="text-[12px] font-bold text-on-surface-variant">{TAB_LABEL[key]}</span>
                  <span className={cn("text-[15px] font-black", modules[key].length > 0 ? "text-success" : "text-on-surface-variant")}>
                    {modules[key].length}
                  </span>
                </div>
                <ProgressBar value={modules[key].length > 0 ? 100 : 0} />
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
            <Database size={11} /> {t.size}: {Math.round(bytes / 1024)} KB / {Math.round(SAT_MAX_BYTES / 1024)} KB
          </p>

          <div className="border-t border-outline-variant pt-3">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">{t.domains}</p>
            {Object.keys(domainCounts).length === 0 ? (
              <p className="text-[11px] font-medium text-on-surface-variant">{t.domainsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {SAT_RW_DOMAINS.filter((d) => domainCounts[d.id]).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                    <span className="min-w-0 truncate text-on-surface-variant">{d.name[L] || d.name.uz}</span>
                    <span className="flex-none font-bold tabular-nums text-on-surface">{domainCounts[d.id]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ── per-module editor ────────────────────────────────────────── */}
        <Tabs
          tabs={MODULE_KEYS.map((key) => ({
            id: key,
            label: TAB_LABEL[key],
            badge: modules[key].length > 0 ? (
              <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-black tabular-nums">
                {modules[key].length}
              </span>
            ) : undefined,
          }))}
          value={activeTab}
          onChange={(id) => setActiveTab(id as ModuleKey)}
        />

        <Card className="p-4">
          <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.addTitle}</h2>
          <p className="mb-3 text-[12px] font-medium leading-relaxed text-on-surface-variant">{t.addHint}</p>

          {/* ⚠️ Writing a question happens in the REAL builder, never in a
              cut-down form embedded here — see docs/QUESTIONS.md. The link
              STASHES the module first (draft.ts) and carries `?back=`/`?subject=`
              so saving RETURNS here with the question already on THIS module
              (`?module=` rides the round trip via returnTo.ts). */}
          <Link
            href={questionBuilderHref("/teacher/create/question", backHere(activeTab), SAT_RW_TAXONOMY_SLUG)}
            onClick={stash}
            className="m3-interactive mb-4 flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-m3-sm bg-tertiary-container text-on-tertiary-container">
              <HelpCircle size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-on-surface">{t.newSingle}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">{t.newSingleHint}</span>
            </span>
          </Link>

          <div className="border-t border-outline-variant pt-3">
            {user && (
              <SatEnglishBankPicker
                t={pickerStrings}
                uid={user.uid}
                lang={L}
                picked={picked}
                disabled={false}
                onAdd={(item) => addItem(activeTab, item)}
              />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-on-surface">
            <BadgeCheck size={15} className="text-primary" /> {TAB_LABEL[activeTab]} — {t.thisModule}
          </h2>

          {items.length === 0 ? (
            <p className="py-8 text-center text-[12px] font-medium text-on-surface-variant">{t.emptyModule}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {items.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-2.5">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-m3-xs bg-surface-container text-[11px] font-black text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[12.5px] font-medium text-on-surface">
                      <LatexRenderer latex={satItemPreview(q, L)} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-on-surface-variant">
                      {q.domainLabel[L] || q.domainLabel.uz}
                      {q.creatorName ? ` · ${q.creatorName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-0.5">
                    <IconButton aria-label={t.up} size="sm" disabled={i === 0} onClick={() => move(activeTab, i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton aria-label={t.down} size="sm" disabled={i === items.length - 1} onClick={() => move(activeTab, i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton aria-label={t.remove} size="sm" onClick={() => removeItem(activeTab, q.id)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ── sticky save bar ──────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className={cn("text-[13px] font-black", complete ? "text-success" : "text-on-surface-variant")}>
            {modules.module1.length} / {modules.module2Easier.length} / {modules.module2Harder.length}
          </span>
          <Button variant="outlined" icon={<Save />} loading={saving} onClick={() => persist(false)} className="ml-auto">
            {t.save}
          </Button>
          <Button icon={<Send />} loading={saving} disabled={!complete} onClick={() => persist(true)}>
            {t.saveAndPublish}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SatEnglishBuilderPage() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>}>
      <BuilderInner />
    </Suspense>
  );
}
