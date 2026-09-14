"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown, ArrowLeft, ArrowUp, BadgeCheck, Blocks, Database, HelpCircle, KeyRound,
  Save, Send, Trash2, Wand2,
} from "lucide-react";
import toast from "react-hot-toast";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";
import { findSubject } from "@/lib/questionTopics";
import {
  MILLIY_MAX_BYTES, checkMilliyAdd, genericSubject, milliyByteSize,
  milliyDifficultyCounts, milliyItemPreview, milliyKindCounts, milliyPickedIds,
  milliyQuizItem, milliySlotCount, milliyTopicCounts, slimMilliyItem, subjectName,
} from "@/lib/MilliyQuiz";
import { hasSamplePaper, loadSamplePaper } from "@/lib/MilliyDefaultPaper";
import { fetchQuestionById } from "@/services/questionBankService";
import { questionBuilderHref } from "@/app/teacher/create/_components/returnTo";
import {
  getMilliyQuiz, newMilliyQuizId, reserveMilliyCode, saveMilliyQuiz, setMilliyQuizStatus,
} from "@/services/milliyQuizService";
import SubjectBankPicker, { type SubjectPickerStrings } from "../../_components/SubjectBankPicker";
import { clearMilliyDraft, readMilliyDraft, writeMilliyDraft } from "../../_components/draft";
import {
  Banner, Button, Card, EmptyState, IconButton, PageHeader, ProgressBar, Spinner, Switch,
  TextField, cn,
} from "@/components/ui";
import type { MilliyQuizItem, MilliyQuizStatus, MilliySubjectId } from "@/types/MilliyQuiz";
import type { Lang } from "@/types/Math";

/**
 * Builds one Milliy sertifikat subject paper (biology today).
 *
 * The whole draft lives in component state and is written as ONE document when
 * the teacher saves — picking a question costs a read and nothing else.
 * Contract + traps: docs/MILLIY_QUIZ.md.
 *
 * ⚠️ **No blueprint quota, unlike the maths builder.** The teacher declares the
 * paper's length and publishing checks the paper against THAT. Inventing
 * per-section quotas for biology would refuse a teacher's question on the
 * authority of a spec this repo does not have.
 */

/** `{n}` / `{name}` … in a dictionary string, filled at the call site. */
const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    sample: "Namunaviy variant",
    sampleHint: "Tayyor variant — barcha bo'limlardan savollar. Yuklangandan keyin savollarni o'chirish, tartibini o'zgartirish va o'zingiznikini qo'shish mumkin.",
    sampleConfirm: "Variantdagi savollar namunaviy savollar bilan almashtiriladi. Davom etasizmi?",
    sampleLoaded: "Namunaviy variant yuklandi — {n} ta savol",
    sampleBroken: "Namunaviy variant noto'g'ri: {problem}",
    sampleFailed: "Namunaviy variantni yuklab bo'lmadi",
    newTitle: "Yangi variant",
    editTitle: "Variantni tahrirlash",
    subtitle: "Savollarni o'z bazangizdan tanlang. O'quvchi 6 xonali kod bilan ochadi.",
    name: "Variant nomi",
    namePlaceholder: "Masalan: Biologiya — 1-variant",
    minutes: "Vaqt (daqiqa)",
    target: "Savollar soni",
    targetHint: "Variant shuncha savoldan iborat bo'ladi. Faollashtirish uchun shu songa yetishi kerak.",
    shuffle: "Savollarni aralashtirish",
    shuffleHint: "Har bir o'quvchi savollarni boshqa tartibda ko'radi.",
    showAnswers: "Javoblarni ko'rsatish",
    showAnswersHint: "Yakunlangandan so'ng to'g'ri javoblar va izohlar ko'rinadi.",
    code: "Kirish kodi",
    codePending: "Saqlaganda beriladi",
    progress: "Savollar",
    size: "hajmi",
    balance: "Tarkibi",
    closed: "Yopiq", open: "Ochiq",
    easy: "Oson", medium: "O'rta", hard: "Qiyin",
    coverage: "Mavzular bo'yicha",
    coverageEmpty: "Savol qo'shilgach, mavzular bo'yicha taqsimot shu yerda ko'rinadi.",
    addTitle: "Savol qo'shish",
    addHint: "Faqat o'zingiz yozgan {subject} savollari ko'rinadi. Yangi savol yaratsangiz, u savollar bazangizga saqlanadi va shu yerda paydo bo'ladi.",
    newSingle: "Bitta savol yaratish",
    newSingleHint: "Variantli, yozma yoki sonli javob; rasm ham qo'shsa bo'ladi.",
    newBlock: "Ko'p savolli test yaratish",
    newBlockHint: "Bitta shart ostida bir nechta savol — umumiy variantli yoki yozma.",
    kind: "Savol turi", kindAll: "Hammasi",
    source: "Kim yozgan", srcAi: "AI", srcMine: "O'zim",
    load: "Yuklash", loadMore: "Yana 10 ta", none: "Savol topilmadi",
    reads: "ta hujjat o'qildi",
    add: "Qo'shish", added: "Qo'shilgan", block: "Blok",
    imageOnly: "Rasmli savol", full: "To'ldi",
    aiBadge: "AI",
    draftKept: "Variantingiz saqlab qo'yildi — savol yaratib qaytsangiz yo'qolmaydi.",
    addedBack: "Yangi savol variantga qo'shildi.",
    addBackMissing: "Yangi savolni topib bo'lmadi — quyidagi «Yuklash» orqali qo'shing.",
    addBackSubject: "Bu savol boshqa fanga tegishli — {subject} variantiga qo'shilmadi.",
    discardDraft: "Tozalash",
    paper: "Variant",
    emptyPaper: "Hali savol qo'shilmagan.",
    remove: "Olib tashlash", up: "Yuqoriga", down: "Pastga",
    save: "Saqlash",
    saveAndPublish: "Saqlash va faollashtirish",
    saved: "Saqlandi",
    published: "Variant faollashtirildi",
    saveFailed: "Saqlab bo'lmadi",
    tooLarge: "Variant juda katta — bir nechta savolni olib tashlang.",
    needTitle: "Variant nomini kiriting",
    needFull: "Faollashtirish uchun {n} ta savol kerak.",
    overFull: "Variantda {n} ta savol bor — yana qo'shib bo'lmaydi.",
    dupe: "Bu savol allaqachon qo'shilgan.",
    loadFailed: "Variantni yuklab bo'lmadi",
    unknownTitle: "Bu fan hali tayyor emas",
    unknownDesc: "Bu fan uchun variant tuzuvchi hali qo'shilmagan.",
    toHub: "Fanlar ro'yxati",
  },
  ru: {
    back: "Назад",
    sample: 'Образцовый вариант',
    sampleHint: 'Готовый вариант — вопросы по всем разделам. После загрузки вопросы можно удалять, менять местами и добавлять свои.',
    sampleConfirm: 'Вопросы варианта будут заменены образцовыми. Продолжить?',
    sampleLoaded: 'Образцовый вариант загружен — {n} вопросов',
    sampleBroken: 'Образцовый вариант некорректен: {problem}',
    sampleFailed: 'Не удалось загрузить образцовый вариант',
    newTitle: "Новый вариант",
    editTitle: "Редактирование варианта",
    subtitle: "Выбирайте вопросы из своей базы. Ученик открывает 6-значным кодом.",
    name: "Название варианта",
    namePlaceholder: "Например: Биология — вариант 1",
    minutes: "Время (минут)",
    target: "Количество вопросов",
    targetHint: "Столько вопросов будет в варианте. Для активации нужно набрать это число.",
    shuffle: "Перемешивать вопросы",
    shuffleHint: "Каждый ученик увидит вопросы в своём порядке.",
    showAnswers: "Показывать ответы",
    showAnswersHint: "После завершения видны правильные ответы и объяснения.",
    code: "Код доступа",
    codePending: "Будет выдан при сохранении",
    progress: "Вопросы",
    size: "размер",
    balance: "Состав",
    closed: "Закрытые", open: "Открытые",
    easy: "Лёгкие", medium: "Средние", hard: "Трудные",
    coverage: "По темам",
    coverageEmpty: "Как только добавите вопросы, здесь появится распределение по темам.",
    addTitle: "Добавить вопрос",
    addHint: "Показываются только ваши вопросы по предмету «{subject}». Созданный вопрос сохранится в вашей базе и появится здесь.",
    newSingle: "Создать один вопрос",
    newSingleHint: "С вариантами, письменный или числовой ответ; можно с картинкой.",
    newBlock: "Создать тест с несколькими вопросами",
    newBlockHint: "Несколько вопросов под одним условием — с общими вариантами или письменные.",
    kind: "Тип вопроса", kindAll: "Все",
    source: "Кто написал", srcAi: "ИИ", srcMine: "Я сам",
    load: "Загрузить", loadMore: "Ещё 10", none: "Вопросы не найдены",
    reads: "документов прочитано",
    add: "Добавить", added: "Добавлен", block: "Блок",
    imageOnly: "Вопрос с картинкой", full: "Заполнено",
    aiBadge: "ИИ",
    draftKept: "Ваш вариант сохранён — он не потеряется, пока вы создаёте вопрос.",
    addedBack: "Новый вопрос добавлен в вариант.",
    addBackMissing: "Не удалось найти новый вопрос — добавьте его кнопкой «Загрузить» ниже.",
    addBackSubject: "Этот вопрос относится к другому предмету — в вариант «{subject}» он не добавлен.",
    discardDraft: "Очистить",
    paper: "Вариант",
    emptyPaper: "Вопросы ещё не добавлены.",
    remove: "Убрать", up: "Вверх", down: "Вниз",
    save: "Сохранить",
    saveAndPublish: "Сохранить и активировать",
    saved: "Сохранено",
    published: "Вариант активирован",
    saveFailed: "Не удалось сохранить",
    tooLarge: "Вариант слишком большой — уберите несколько вопросов.",
    needTitle: "Введите название варианта",
    needFull: "Для активации нужно {n} вопросов.",
    overFull: "В варианте уже {n} вопросов — больше добавить нельзя.",
    dupe: "Этот вопрос уже добавлен.",
    loadFailed: "Не удалось загрузить вариант",
    unknownTitle: "Этот предмет пока не готов",
    unknownDesc: "Конструктор варианта для этого предмета пока не добавлен.",
    toHub: "Список предметов",
  },
  en: {
    back: "Back",
    sample: 'Sample paper',
    sampleHint: 'A ready paper with questions from every section. Once loaded you can remove, reorder and add your own.',
    sampleConfirm: 'The questions on this paper will be replaced by the sample ones. Continue?',
    sampleLoaded: 'Sample paper loaded — {n} questions',
    sampleBroken: 'The sample paper is invalid: {problem}',
    sampleFailed: 'Could not load the sample paper',
    newTitle: "New paper",
    editTitle: "Edit paper",
    subtitle: "Pick questions from your own bank. Students open it with a 6-digit code.",
    name: "Paper name",
    namePlaceholder: "e.g. Biology — paper 1",
    minutes: "Time (minutes)",
    target: "Number of questions",
    targetHint: "The paper will have this many questions. Publishing needs it to reach that number.",
    shuffle: "Shuffle questions",
    shuffleHint: "Each student sees the questions in their own order.",
    showAnswers: "Show answers",
    showAnswersHint: "Correct answers and explanations are revealed after submitting.",
    code: "Access code",
    codePending: "Issued when you save",
    progress: "Questions",
    size: "size",
    balance: "Make-up",
    closed: "Closed", open: "Typed",
    easy: "Easy", medium: "Medium", hard: "Hard",
    coverage: "By topic",
    coverageEmpty: "Once you add questions, their spread across topics shows up here.",
    addTitle: "Add a question",
    addHint: "Only your own {subject} questions are listed. A question you create is saved to your bank and appears here.",
    newSingle: "Create one question",
    newSingleHint: "Multiple choice, written or numeric answer; an image if you want one.",
    newBlock: "Create a multi-question test",
    newBlockHint: "Several questions under one stem — shared options or written answers.",
    kind: "Question type", kindAll: "All",
    source: "Written by", srcAi: "AI", srcMine: "Me",
    load: "Load", loadMore: "10 more", none: "No questions found",
    reads: "documents read",
    add: "Add", added: "Added", block: "Block",
    imageOnly: "Image question", full: "Full",
    aiBadge: "AI",
    draftKept: "Your paper is saved — it survives going off to write a question.",
    addedBack: "Your new question was added to the paper.",
    addBackMissing: "Could not find the new question — add it with “Load” below.",
    addBackSubject: "That question belongs to another subject — it was not added to the {subject} paper.",
    discardDraft: "Start over",
    paper: "The paper",
    emptyPaper: "No questions added yet.",
    remove: "Remove", up: "Up", down: "Down",
    save: "Save",
    saveAndPublish: "Save & publish",
    saved: "Saved",
    published: "The paper is live",
    saveFailed: "Could not save",
    tooLarge: "The paper is too large — remove a few questions.",
    needTitle: "Give the paper a name",
    needFull: "Publishing needs {n} questions.",
    overFull: "The paper already has {n} questions.",
    dupe: "That question is already on the paper.",
    loadFailed: "Could not load the paper",
    unknownTitle: "This subject is not built yet",
    unknownDesc: "There is no paper builder for this subject yet.",
    toHub: "All subjects",
  },
};

function BuilderInner() {
  const router = useRouter();
  const routeParams = useParams<{ subject: string }>();
  const params = useSearchParams();
  const editId = params.get("id");
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const subject = genericSubject(routeParams.subject);
  const base = `/teacher/milliy-sertifikat/${routeParams.subject}`;
  /** Where a question builder must return the teacher: THIS paper, not a new one. */
  const backHere = `${base}/build${editId ? `?id=${editId}` : ""}`;

  const [quizId, setQuizId] = useState(() => editId || newMilliyQuizId());
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(subject?.defaultMinutes ?? 90);
  const [target, setTarget] = useState(subject?.defaultQuestions ?? 30);
  const [shuffle, setShuffle] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<MilliyQuizStatus>("draft");
  const [items, setItems] = useState<MilliyQuizItem[]>([]);

  const [loading, setLoading] = useState(!!editId);
  /**
   * The paper is settled: the draft (or the server copy) is in state. ⚠️ The
   * auto-add below MUST wait for it, or it would check a question against an
   * empty paper and stash a draft that has lost every question on it.
   */
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [restored, setRestored] = useState(false);

  // ── load: the local draft first, then the server copy ───────────────────
  //
  // ⚠️ The draft WINS when it belongs to this paper and this subject. It is only
  // ever written when the teacher leaves to write a question, so if one exists it
  // is strictly newer than what is stored — restoring the server copy over it
  // would throw away exactly the work the stash was protecting.
  useEffect(() => {
    if (!subject) return;
    const draft = readMilliyDraft();
    const mine = draft
      && draft.subject === subject.id
      && (editId ? draft.quizId === editId : true);

    if (draft && mine) {
      // ⚠️ ADOPT the draft's id. A new one is minted on mount, so a paper that
      // had already been saved once would fork into a SECOND document — with the
      // first one's access code on it — the moment the teacher came back from
      // writing a question.
      setQuizId(draft.quizId);
      setTitle(draft.title);
      setMinutes(draft.minutes);
      setTarget(draft.target);
      setShuffle(draft.shuffle);
      setShowAnswers(draft.showAnswers);
      setAccessCode(draft.accessCode);
      setStatus(draft.status);
      setItems(draft.items);
      setRestored(true);
      setLoading(false);
      setHydrated(true);
      return;
    }

    if (!editId) { setHydrated(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const quiz = await getMilliyQuiz(editId);
        if (cancelled || !quiz) {
          if (!cancelled) setLoadError(t.loadFailed);
          return;
        }
        setTitle(quiz.title);
        setMinutes(quiz.durationMinutes || (subject.defaultMinutes ?? 90));
        setTarget(quiz.questionTarget || (subject.defaultQuestions ?? 30));
        setShuffle(quiz.shuffle);
        setShowAnswers(quiz.showAnswers);
        setAccessCode(quiz.accessCode);
        setStatus(quiz.status);
        setItems(quiz.questions);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(t.loadFailed);
      } finally {
        if (!cancelled) { setLoading(false); setHydrated(true); }
      }
    })();
    return () => { cancelled = true; };
    // Runs once per paper: re-running would stomp on whatever the teacher has
    // since picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, subject?.id]);

  // ── derived: recomputed for free on every change ─────────────────────────
  const slots = useMemo(() => milliySlotCount(items), [items]);
  const bytes = useMemo(() => milliyByteSize(items), [items]);
  const already = useMemo(() => milliyPickedIds(items), [items]);
  const kinds = useMemo(() => milliyKindCounts(items), [items]);
  const diffCounts = useMemo(() => milliyDifficultyCounts(items), [items]);
  const topicCounts = useMemo(() => milliyTopicCounts(items), [items]);
  const full = slots >= target;
  const complete = slots === target && target > 0;

  /** Topic slug → its programme name, for the coverage list. */
  const topicNames = useMemo(() => {
    const taxonomy = subject?.taxonomySlug ? findSubject(subject.taxonomySlug) : undefined;
    return new Map((taxonomy?.topics ?? []).map((tp) => [tp.id, tp.name]));
  }, [subject?.taxonomySlug]);

  /**
   * Every add is checked against the declared length. The refusal is announced —
   * a teacher whose paper is full must be told why nothing appeared, not left
   * thinking the button is broken.
   *
   * ⚠️ The check runs OUTSIDE the state updater. `setItems(prev => …)` may be
   * invoked twice in dev, and a toast fired from inside would fire twice with it.
   */
  const addItem = useCallback((item: MilliyQuizItem): MilliyQuizItem | null => {
    // A `shared_options` block occupies one slot per sub-question, so it is added
    // whole or not at all — truncating it would break its shared pool.
    const slim = slimMilliyItem(item);
    const check = checkMilliyAdd(items, slim, target);

    if (!check.ok) {
      if (check.reason === "full") toast.error(fmt(t.overFull, { n: target }));
      else if (check.reason === "duplicate") toast.error(t.dupe);
      return null;
    }
    setItems((prev) => (prev.some((q) => q.id === slim.id) ? prev : [...prev, slim]));
    // What actually landed on the paper — the auto-add below re-stashes with it.
    return slim;
  }, [items, target, t]);

  /**
   * Drop the bundled sample paper onto the builder — the same escape hatch the
   * maths builder's "Namunaviy variant" gives, and for the same reason: "write 30
   * questions before you can publish anything" is a wall in front of the first
   * paper anyone tries to make.
   *
   * ⚠️ It REPLACES the paper (with a confirm when one is non-empty) rather than
   * topping it up, and sets the length target to what the file actually holds —
   * appending would silently overshoot whatever target was set.
   *
   * ⚠️ A file that does not validate is REFUSED, not loaded, with the first
   * problem named. A silently-wrong sample would be published with items filed
   * under topics the subject does not have.
   */
  const fillSample = async () => {
    if (!subject?.taxonomySlug) return;
    if (items.length > 0 && !confirm(t.sampleConfirm)) return;
    setFilling(true);
    try {
      const paper = await loadSamplePaper(subject.taxonomySlug);
      if (!paper) return;
      if (paper.problems.length > 0) {
        console.error(`data/${subject.taxonomySlug}-default-paper.json:`, paper.problems);
        toast.error(fmt(t.sampleBroken, { problem: paper.problems[0] }));
        return;
      }
      setItems(paper.items);
      setTarget(paper.slots);
      setMinutes(paper.durationMinutes);
      // The name is the teacher's to choose — only fill one in if they have not.
      if (!title.trim()) setTitle(paper.title[L] || paper.title.uz);
      toast.success(fmt(t.sampleLoaded, { n: paper.slots }));
    } catch (err) {
      console.error(err);
      toast.error(t.sampleFailed);
    } finally {
      setFilling(false);
    }
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((q) => q.id !== id));

  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const to = index + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  /** Park the paper before leaving for a question builder. */
  const stashItems = useCallback((list: MilliyQuizItem[]) => {
    if (!subject) return;
    writeMilliyDraft({
      quizId,
      subject: subject.id as MilliySubjectId,
      title, minutes, target, shuffle, showAnswers, accessCode, status, items: list,
    });
  }, [subject, quizId, title, minutes, target, shuffle, showAnswers, accessCode, status]);

  const stash = () => stashItems(items);

  /**
   * The return trip from a question builder (`?add=<questionId>`, see
   * returnTo.ts): the question that was just written lands on the paper by
   * itself, so "write a question" and "put it on the paper" are one act.
   *
   * ⚠️ It waits for `hydrated` — running against a paper that has not been
   * restored yet would check the add against nothing and then STASH that empty
   * paper over the real draft.
   *
   * ⚠️ Costs **zero reads** on the normal path: the question builder puts the
   * document it just wrote into `questionCache`, which `fetchQuestionById`
   * consults first. A cold reload of the link pays one read.
   */
  const addBackId = params.get("add");
  const addBackRef = useRef(false);
  useEffect(() => {
    if (!addBackId || !subject || !hydrated || addBackRef.current) return;
    addBackRef.current = true;

    (async () => {
      try {
        const question = await fetchQuestionById(addBackId);
        if (!question) { toast.error(t.addBackMissing); return; }
        // A biology paper must not silently swallow a chemistry question — the
        // picker below could never have offered it.
        if (question.subjectId !== subject.taxonomySlug) {
          toast.error(fmt(t.addBackSubject, { subject: subjectName(subject, L) }));
          return;
        }
        const added = addItem(milliyQuizItem(question));
        if (!added) return; // addItem has already said why
        // The stash was written on the way OUT and knows nothing of this
        // question; refreshing now would restore the paper without it.
        stashItems([...items, added]);
        toast.success(t.addedBack);
      } catch (err) {
        console.error(err);
        toast.error(t.addBackMissing);
      } finally {
        // Drop the parameter: a refresh must not try to add it a second time.
        router.replace(editId ? `${base}/build?id=${editId}` : `${base}/build`);
      }
    })();
    // Runs once per return trip — `addItem`/`items` are read from the render
    // that hydrated the paper, and re-running it would re-add the question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addBackId, hydrated, subject?.id]);

  const discard = () => {
    clearMilliyDraft();
    setTitle("");
    setMinutes(subject?.defaultMinutes ?? 90);
    setTarget(subject?.defaultQuestions ?? 30);
    setShuffle(true);
    setShowAnswers(true);
    setAccessCode("");
    setStatus("draft");
    setItems([]);
    setRestored(false);
  };

  async function persist(publish: boolean) {
    if (!user || !subject) return;
    if (!title.trim()) { toast.error(t.needTitle); return; }
    if (publish && slots !== target) { toast.error(fmt(t.needFull, { n: target })); return; }
    if (bytes > MILLIY_MAX_BYTES) { toast.error(t.tooLarge); return; }

    setSaving(true);
    try {
      // ⚠️ The code is minted on the FIRST save and never regenerated: a teacher
      // who has already read it out to a class must not have it change under them.
      const code = accessCode || await reserveMilliyCode();
      const nextStatus: MilliyQuizStatus = publish ? "published" : status;

      await saveMilliyQuiz(quizId, {
        subject: subject.id as MilliySubjectId,
        title: title.trim(),
        description: "",
        teacherId: user.uid,
        teacherName: user.displayName || "",
        accessCode: code,
        questions: items,
        questionCount: slots,
        questionTarget: target,
        durationMinutes: Math.max(1, minutes),
        shuffle,
        showAnswers,
        status: nextStatus,
      });

      // saveMilliyQuiz writes the status it was given; this only runs when the
      // paper was already stored and is being flipped live from another control.
      if (publish && nextStatus !== "published") await setMilliyQuizStatus(quizId, "published");

      setAccessCode(code);
      setStatus(nextStatus);
      // Safely on the server — the local copy is no longer the newest thing.
      clearMilliyDraft();
      setRestored(false);
      toast.success(publish ? t.published : t.saved);
      if (publish) router.push(base);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message.startsWith("QUIZ_TOO_LARGE")
        ? t.tooLarge
        : t.saveFailed;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!subject) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={<BadgeCheck />}
          title={t.unknownTitle}
          description={t.unknownDesc}
          action={<Button onClick={() => router.push("/teacher/milliy-sertifikat")}>{t.toHub}</Button>}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>;
  }

  const pickerStrings: SubjectPickerStrings = {
    kind: t.kind, kindAll: t.kindAll, kindClosed: t.closed, kindOpen: t.open,
    source: t.source, srcAi: t.srcAi, srcMine: t.srcMine,
    load: t.load, loadMore: t.loadMore, none: t.none, reads: t.reads,
    add: t.add, added: t.added, block: t.block, imageOnly: t.imageOnly, full: t.full,
    closedBadge: t.closed, openBadge: t.open, aiBadge: t.aiBadge,
  };

  return (
    <div className="min-h-[100dvh] bg-surface pb-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push(base)}>
            <ArrowLeft />
          </IconButton>
          <PageHeader
            className="flex-1"
            title={`${subjectName(subject, L)} — ${editId ? t.editTitle : t.newTitle}`}
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
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <TextField
              label={t.name}
              value={title}
              placeholder={t.namePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label={t.minutes}
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || subject.defaultMinutes)}
            />
            <TextField
              label={t.target}
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || subject.defaultQuestions))}
            />
          </div>
          <p className="-mt-1 text-[11px] font-medium text-on-surface-variant">{t.targetHint}</p>

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

        {/* ── progress + make-up ───────────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <span className="text-[13px] font-bold text-on-surface">{t.progress}</span>
              <span className={cn("text-[15px] font-black", complete ? "text-success" : "text-on-surface-variant")}>
                {slots}<span className="text-on-surface-variant">/{target}</span>
              </span>
            </div>
            <ProgressBar value={target > 0 ? (slots / target) * 100 : 0} />
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
              <Database size={11} /> {t.size}: {Math.round(bytes / 1024)} KB / {Math.round(MILLIY_MAX_BYTES / 1024)} KB
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3 text-[11px] font-bold">
            <span className="uppercase tracking-wider text-on-surface-variant">{t.balance}</span>
            <span className="rounded-m3-xs bg-secondary-container px-2 py-1 text-on-secondary-container">{t.closed}: {kinds.closed}</span>
            <span className="rounded-m3-xs bg-tertiary-container px-2 py-1 text-on-tertiary-container">{t.open}: {kinds.open}</span>
            <span className="ml-2 rounded-m3-xs bg-success-container px-2 py-1 text-on-success-container">{t.easy}: {diffCounts[1] ?? 0}</span>
            <span className="rounded-m3-xs bg-warning-container px-2 py-1 text-on-warning-container">{t.medium}: {diffCounts[2] ?? 0}</span>
            <span className="rounded-m3-xs bg-error-container px-2 py-1 text-on-error-container">{t.hard}: {diffCounts[3] ?? 0}</span>
          </div>

          {/* Reported, never required: this is what the teacher's picks came to,
              not a quota they must hit (there is no published blueprint here). */}
          <div className="border-t border-outline-variant pt-3">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">{t.coverage}</p>
            {Object.keys(topicCounts).length === 0 ? (
              <p className="text-[11px] font-medium text-on-surface-variant">{t.coverageEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {Object.entries(topicCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([slug, n]) => (
                    <li key={slug} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                      <span className="min-w-0 truncate text-on-surface-variant">{topicNames.get(slug) || slug || "—"}</span>
                      <span className="flex-none font-bold tabular-nums text-on-surface">{n}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ── add questions ────────────────────────────────────────────── */}
        <Card className="p-4">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-[180px] flex-1 text-[14px] font-bold text-on-surface">{t.addTitle}</h2>
            {/* Sits at the TOP because it is the fastest route to a publishable
                paper — a teacher who wants their own questions ignores it and
                picks below. Only rendered for a subject that ships a file. */}
            {subject.taxonomySlug && hasSamplePaper(subject.taxonomySlug) && (
              <Button size="sm" variant="tonal" icon={<Wand2 />} loading={filling} onClick={fillSample}>
                {t.sample}
              </Button>
            )}
          </div>
          <p className="mb-1 text-[12px] font-medium leading-relaxed text-on-surface-variant">
            {fmt(t.addHint, { subject: subjectName(subject, L) })}
          </p>
          {subject.taxonomySlug && hasSamplePaper(subject.taxonomySlug) && (
            <p className="mb-3 text-[11px] font-normal leading-snug text-on-surface-variant">{t.sampleHint}</p>
          )}

          {/* ⚠️ Writing a question happens in the REAL builders, never in a
              cut-down form embedded here. A question is a first-class bank
              document (docs/QUESTIONS.md) — images on the prompt AND on every
              option, blocks, the validated topic path — and a second
              half-featured editor would drift from the canonical one the moment
              either was touched. These two cover the two shapes a question takes.
              Both links STASH the paper first (see draft.ts), and both carry
              `?back=` so saving a question RETURNS here with it (returnTo.ts) —
              plus `?subject=`, so the Fan dropdown cannot start on the wrong
              subject and produce a question this paper would refuse. */}
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Link
              href={questionBuilderHref("/teacher/create/question", backHere, subject.taxonomySlug)}
              onClick={stash}
              className="m3-interactive flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-m3-sm bg-tertiary-container text-on-tertiary-container">
                <HelpCircle size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-on-surface">{t.newSingle}</span>
                <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">{t.newSingleHint}</span>
              </span>
            </Link>

            <Link
              href={questionBuilderHref("/teacher/create/block", backHere, subject.taxonomySlug)}
              onClick={stash}
              className="m3-interactive flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-m3-sm bg-primary-container text-on-primary-container">
                <Blocks size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-on-surface">{t.newBlock}</span>
                <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">{t.newBlockHint}</span>
              </span>
            </Link>
          </div>

          <div className="border-t border-outline-variant pt-3">
            {user && subject.taxonomySlug && (
              <SubjectBankPicker
                t={pickerStrings}
                uid={user.uid}
                subjectSlug={subject.taxonomySlug}
                lang={L}
                picked={already}
                disabled={full}
                onAdd={addItem}
              />
            )}
          </div>
        </Card>

        {/* ── the paper ────────────────────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-on-surface">
            <BadgeCheck size={15} className="text-primary" /> {t.paper}
          </h2>

          {items.length === 0 ? (
            <p className="py-8 text-center text-[12px] font-medium text-on-surface-variant">{t.emptyPaper}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {items.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-2.5">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-m3-xs bg-surface-container text-[11px] font-black text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[12.5px] font-medium text-on-surface">
                      <LatexRenderer latex={milliyItemPreview(q, L)} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-on-surface-variant">
                      {q.topic} · {q.testType === "O" ? t.open : t.closed} · {q.difficulty}
                      {q.creatorName ? ` · ${q.creatorName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-0.5">
                    <IconButton aria-label={t.up} size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton aria-label={t.down} size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton aria-label={t.remove} size="sm" onClick={() => removeItem(q.id)}>
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
            {slots}/{target}
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

export default function MilliySubjectBuilderPage() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>}>
      <BuilderInner />
    </Suspense>
  );
}
