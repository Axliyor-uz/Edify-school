// app/(student)/raschmodel/quiz/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AlertTriangle, BookOpen, ChevronDown, Clock, Home, KeyRound, Languages, Play,
  TrendingUp, User,
} from 'lucide-react';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import RaschNav from '../_components/RaschNav';
import NavLink from '../_components/NavLink';
import ExamRunner, { QUESTION_LANGS } from '../_components/ExamRunner';
import { requestExamFullscreen } from '@/hooks/useExamLockdown';
import ExamReview from '../_components/ExamReview';
import { useStudentLanguage } from '../../layout';
import { saveExamResult, scoreByTopic, toItemResponses } from '@/services/RASCHProgressService';
import { findQuizByCode, getQuiz, listMyQuizResults, saveQuizResult } from '@/services/teacherRaschQuizService';
import { estimateAbility } from '@/lib/RASCHtheta';
import { RASCH_TOPICS, TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import { skillCoverage, skill as skillMeta, SKILL_KEYS, type SkillKey } from '@/lib/RASCHskills';
import { archiveExam, setSolvedUser } from '@/lib/RASCHsolved';
import {
  ACCESS_CODE_LENGTH, hydrateQuiz, isValidAccessCode, sanitizeAccessCode, shuffleItems,
} from '@/lib/RASCHquiz';
import {
  examExpectedText, examMode, examScore, examSlotCount, hasExamAnswer, isExamItemCorrect,
} from '@/lib/ExamTeacher';
import {
  clearQuizSnapshot, getQuizSnapshot, getServerQuizSnapshot, saveQuizSnapshot, subscribeQuizSnapshot,
} from '@/lib/Examsession';
import { Banner, Button, Card, FilterChip, Page, cn } from '@/components/student-ui';
import { MASTER_LEVEL, formatLevel, thetaToLevel } from '@/lib/RASCHscale';
import type { ExamQuestion } from '@/types/Exam';
import type { RASCHLevels } from '@/types/RASCH';
import type { RaschQuizResult, TeacherRaschQuiz } from '@/types/TeacherRaschQuiz';
import type { Lang } from '@/types/Math';

/**
 * The student's own sittings, cached like every other student page (60s).
 *
 * ⚠️ Patched, never just invalidated, when a paper is submitted below — the code
 * screen is exactly where a student lands straight after finishing one, and a
 * list that does not yet show the paper they just sat reads as data loss.
 */
const PAST_TTL_MS = 60_000;
let pastCache: { uid: string; at: number; rows: RaschQuizResult[] } | null = null;

/**
 * Papers fetched to REVIEW, by id — kept for the life of the tab.
 *
 * ⚠️ Re-opening a review must not re-read the document: it is the whole 45-question
 * array, by far the largest read in this subsystem, and a student comparing two
 * mistakes would otherwise pay for it every time they toggle. The paper is an
 * immutable snapshot once sat, so there is nothing to go stale.
 */
const reviewCache = new Map<string, TeacherRaschQuiz>();

/**
 * A paper the teacher built, opened by its private 6-digit code.
 *
 * Everything that makes a sitting a sitting is shared with `/raschmodel/exam`:
 * the runner, the review, the item-response builder, and `saveExamResult`. What
 * is different is only where the paper came from (one document, not 45 sampled
 * reads) and that the result is ALSO reported back to the teacher.
 *
 * Contract + traps: docs/RASCH_QUIZ.md.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: "O'qituvchi testi",
    lead: "O'qituvchingiz bergan 6 xonali kodni kiriting.",
    codeLabel: 'Kirish kodi',
    open: 'Testni ochish',
    opening: 'Qidirilmoqda…',
    notFound: 'Bunday kod bilan test topilmadi. Kodni tekshirib qayta kiriting.',
    closed: "Bu test yopilgan — o'qituvchi uni endi qabul qilmayapti.",
    lookupFailed: "Testni ochib bo'lmadi. Internetni tekshirib qayta urinib ko'ring.",
    empty: "Bu testda savol yo'q.",
    by: "Muallif", duration: 'daqiqa', totalQ: 'ta savol',
    langTitle: 'Savollar tili',
    langHint: "Boshlangandan so'ng o'zgarmaydi.",
    start: 'Testni boshlash',
    another: 'Boshqa kod kiritish',
    resumed: 'Boshlangan test tiklandi — savollar qayta yuklanmadi.',
    oneRead: "Butun test 1 ta hujjatdan o'qildi",
    timeUp: 'Vaqt tugadi — test avtomatik yakunlandi.',
    discarded: "Oldingi test javobsiz tugagan — natija sifatida saqlanmadi.",
    pastTitle: 'Yechgan testlaringiz',
    pastHint: "O'qituvchi testlari bo'yicha natijalaringiz — eng yangisi birinchi.",
    pastEmpty: "Hali birorta o'qituvchi testini yechmagansiz.",
    pastFailed: "Yechgan testlarni yuklab bo'lmadi.",
    pastRight: "to'g'ri",
    pastWrong: 'xato',
    pastScore: 'Ball',
    pastLevel: 'Daraja',
    pastReview: "Xatolarni ko'rish",
    pastReviewClose: 'Yopish',
    pastReviewLoading: 'Savollar yuklanmoqda…',
    pastReviewGone: "Bu test o'chirilgan — savollarni ko'rib bo'lmaydi.",
    pastReviewFailed: "Savollarni yuklab bo'lmadi.",
    results: 'Natija',
    byTopic: "Bo'limlar bo'yicha",
    skillsTitle: "Aniqlangan ko'nikmalar",
    skillsHint: "Ko'nikma mavzudan mustaqil — to'liq manzara Darajam sahifasida.",
    levelTitle: 'Darajangiz o‘zgarishi',
    savingResult: 'Natija saqlanmoqda…',
    saveFailed: 'Natijani saqlab bo‘lmadi.',
    signInToSave: "Natijani saqlash va o'qituvchiga yuborish uchun tizimga kiring.",
    sentToTeacher: "Natijangiz o'qituvchingizga yuborildi.",
    viewProgress: 'Darajam va grafik',
    home: 'Bosh sahifa',
  },
  ru: {
    title: 'Тест учителя',
    lead: 'Введите 6-значный код, который дал ваш учитель.',
    codeLabel: 'Код доступа',
    open: 'Открыть тест',
    opening: 'Поиск…',
    notFound: 'Тест с таким кодом не найден. Проверьте код и введите ещё раз.',
    closed: 'Этот тест закрыт — учитель больше не принимает ответы.',
    lookupFailed: 'Не удалось открыть тест. Проверьте соединение и попробуйте снова.',
    empty: 'В этом тесте нет вопросов.',
    by: 'Автор', duration: 'минут', totalQ: 'вопросов',
    langTitle: 'Язык вопросов',
    langHint: 'После начала теста не меняется.',
    start: 'Начать тест',
    another: 'Ввести другой код',
    resumed: 'Начатый тест восстановлен — вопросы не загружались заново.',
    oneRead: 'Весь тест прочитан одним документом',
    timeUp: 'Время вышло — тест завершён автоматически.',
    discarded: 'Прошлый тест истёк без ответов — не сохранён как результат.',
    pastTitle: 'Решённые тесты',
    pastHint: 'Ваши результаты по учительским тестам — новые сверху.',
    pastEmpty: 'Вы ещё не решали ни одного учительского теста.',
    pastFailed: 'Не удалось загрузить решённые тесты.',
    pastRight: 'верно',
    pastWrong: 'неверно',
    pastScore: 'Балл',
    pastLevel: 'Уровень',
    pastReview: 'Разбор ошибок',
    pastReviewClose: 'Свернуть',
    pastReviewLoading: 'Загрузка вопросов…',
    pastReviewGone: 'Этот тест удалён — вопросы недоступны.',
    pastReviewFailed: 'Не удалось загрузить вопросы.',
    results: 'Результат',
    byTopic: 'По разделам',
    skillsTitle: 'Определённые навыки',
    skillsHint: 'Навык не зависит от темы — полная картина на «Мой уровень».',
    levelTitle: 'Изменение вашего уровня',
    savingResult: 'Сохранение результата…',
    saveFailed: 'Не удалось сохранить результат.',
    signInToSave: 'Войдите, чтобы сохранить результат и отправить его учителю.',
    sentToTeacher: 'Ваш результат отправлен учителю.',
    viewProgress: 'Мой уровень и график',
    home: 'Главная',
  },
  en: {
    title: "Your teacher's test",
    lead: 'Enter the 6-digit code your teacher gave you.',
    codeLabel: 'Access code',
    open: 'Open the test',
    opening: 'Looking it up…',
    notFound: 'No test found with that code. Check it and try again.',
    closed: 'This test is closed — your teacher is no longer accepting answers.',
    lookupFailed: 'Could not open the test. Check your connection and try again.',
    empty: 'This test has no questions.',
    by: 'By', duration: 'minutes', totalQ: 'questions',
    langTitle: 'Question language',
    langHint: 'Fixed once the test starts.',
    start: 'Start test',
    another: 'Enter a different code',
    resumed: 'Resumed your test — no questions were re-fetched.',
    oneRead: 'The whole paper was read as one document',
    timeUp: 'Time is up — the test was submitted automatically.',
    discarded: 'Your last paper timed out with nothing answered — it was not recorded.',
    pastTitle: 'Tests you have sat',
    pastHint: "Your results on your teachers' papers — newest first.",
    pastEmpty: "You have not sat a teacher's test yet.",
    pastFailed: 'Could not load your past tests.',
    pastRight: 'right',
    pastWrong: 'wrong',
    pastScore: 'Score',
    pastLevel: 'Level',
    pastReview: 'Review mistakes',
    pastReviewClose: 'Close',
    pastReviewLoading: 'Loading the questions…',
    pastReviewGone: 'This test was deleted — its questions are not available.',
    pastReviewFailed: 'Could not load the questions.',
    results: 'Results',
    byTopic: 'By section',
    skillsTitle: 'Skills detected',
    skillsHint: 'A skill is content-free — the full picture is on My level.',
    levelTitle: 'How your level moved',
    savingResult: 'Saving your result…',
    saveFailed: 'Could not save your result.',
    signInToSave: 'Sign in to save your result and send it to your teacher.',
    sentToTeacher: 'Your result was sent to your teacher.',
    viewProgress: 'My level & chart',
    home: 'Home',
  },
};

type Stage = 'code' | 'loading' | 'in-progress' | 'submitted';

/** One teacher paper in flight. Mirrors the persisted snapshot. */
interface Session {
  quizId: string;
  quizTitle: string;
  quizTeacherId: string;
  quizTeacherName: string;
  durationMinutes: number;
  hideAnswers: boolean;
  examLang: Lang;
  questions: ExamQuestion[];
  answers: Record<string, string>;
  flagged: string[];
  current: number;
  /** Epoch ms. A deadline, not a countdown — a reload can't hand back minutes. */
  endsAt: number;
  submitted: boolean;
  resumed: boolean;
  saved: boolean;
  seconds: Record<string, number>;
}

export default function TeacherQuizPage() {
  const { lang: appLang } = useStudentLanguage();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const t = UI[appLang];

  const [code, setCode] = useState('');
  const [pendingLang, setPendingLang] = useState<Lang>('uz');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  // The paper waiting on the intro screen — found by code, not yet started, so
  // nothing is persisted until the student presses Start.
  const [pending, setPending] = useState<Session | null>(null);

  const stored = useSyncExternalStore(subscribeQuizSnapshot, getQuizSnapshot, getServerQuizSnapshot);
  const restored = useMemo<Session | null>(
    () =>
      // localStorage is shared by every account on one browser — only resume a
      // paper that belongs to the student currently signed in.
      stored && (stored.uid ?? '') === uid && stored.quizId
        ? {
          quizId: stored.quizId,
          quizTitle: stored.quizTitle ?? '',
          quizTeacherId: stored.quizTeacherId ?? '',
          quizTeacherName: stored.quizTeacherName ?? '',
          durationMinutes: stored.durationMinutes ?? 150,
          hideAnswers: stored.hideAnswers ?? false,
          examLang: stored.examLang,
          questions: stored.questions,
          answers: stored.answers,
          flagged: stored.flagged,
          current: stored.current,
          endsAt: stored.endsAt,
          submitted: stored.submitted,
          resumed: true,
          saved: stored.saved ?? false,
          seconds: stored.seconds ?? {},
        }
        : null,
    [stored, uid],
  );

  const [local, setLocal] = useState<{ session: Session | null } | null>(null);
  const session = local ? local.session : restored;

  const [now, setNow] = useState(() => Date.now());
  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  // ── Timer ──────────────────────────────────────────────────────────────
  // Identical rule to the mock exam: a paper whose deadline passed with NOTHING
  // answered is abandoned, not submitted — it must never reach the account (or
  // the teacher) as a 0% result for a paper nobody sat.
  const expired = !!session && now >= session.endsAt;
  const answeredCount = session
    ? session.questions.filter((q) => hasExamAnswer(q, session.answers)).length
    : 0;
  const abandoned = !!session && !session.submitted && expired && answeredCount === 0;

  const submitted = !!session && !abandoned && (session.submitted || expired);
  const autoSubmitted = !!session && !session.submitted && expired && !abandoned;

  const stage: Stage = looking
    ? 'loading'
    : !session || abandoned
      ? 'code'
      : submitted
        ? 'submitted'
        : 'in-progress';

  // ── the papers this student has already sat ────────────────────────────
  // Loaded only on the code screen — it is the one place it is shown, and a
  // student in the middle of a paper must not pay a query for it.
  const [past, setPast] = useState<RaschQuizResult[] | null>(null);
  const [pastError, setPastError] = useState(false);
  // Which sat paper is expanded for review, and the paper itself once fetched.
  // One at a time: two open reviews is two 45-question documents in memory for
  // no reason, and the grid is tall.
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [openQuiz, setOpenQuiz] = useState<TeacherRaschQuiz | null>(null);
  const [openState, setOpenState] = useState<'idle' | 'loading' | 'gone' | 'failed'>('idle');

  /**
   * Open (or close) the review of a paper already sat.
   *
   * Costs ONE document read the first time and nothing after — the paper is an
   * immutable snapshot, so `reviewCache` holds it for the tab. ⚠️ `hideAnswers`
   * comes from the paper's own `showAnswers` flag: a teacher who withheld the key
   * must keep it withheld here, months later, exactly as in the post-submit
   * review. This screen is not a way around that switch.
   */
  const toggleReview = useCallback(async (quizId: string) => {
    if (openPast === quizId) { setOpenPast(null); return; }

    setOpenPast(quizId);
    const cached = reviewCache.get(quizId);
    if (cached) { setOpenQuiz(cached); setOpenState('idle'); return; }

    setOpenQuiz(null);
    setOpenState('loading');
    try {
      const quiz = await getQuiz(quizId);
      if (!quiz) { setOpenState('gone'); return; }
      reviewCache.set(quizId, quiz);
      setOpenQuiz(quiz);
      setOpenState('idle');
    } catch (err) {
      console.error(err);
      setOpenState('failed');
    }
  }, [openPast]);

  const [discarded, setDiscarded] = useState(false);
  useEffect(() => {
    if (!abandoned) return;
    clearQuizSnapshot();
    setLocal({ session: null });
    setDiscarded(true);
  }, [abandoned]);

  useEffect(() => {
    if (stage !== 'in-progress') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'code' || !uid) return;
    if (pastCache && pastCache.uid === uid && Date.now() - pastCache.at < PAST_TTL_MS) {
      setPast(pastCache.rows);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyQuizResults(uid);
        pastCache = { uid, at: Date.now(), rows };
        if (!cancelled) { setPast(rows); setPastError(false); }
      } catch (err) {
        console.error(err);
        if (!cancelled) setPastError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [stage, uid]);

  const secondsLeft = session ? Math.max(0, Math.ceil((session.endsAt - now) / 1000)) : 0;

  // ── Persist ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(() => {
      saveQuizSnapshot({
        uid,
        quizId: session.quizId,
        quizTitle: session.quizTitle,
        quizTeacherId: session.quizTeacherId,
        quizTeacherName: session.quizTeacherName,
        durationMinutes: session.durationMinutes,
        hideAnswers: session.hideAnswers,
        examLang: session.examLang,
        questions: session.questions,
        shortfalls: [],
        answers: session.answers,
        flagged: session.flagged,
        current: session.current,
        endsAt: session.endsAt,
        submitted,
        autoSubmitted,
        docsRead: 1,
        saved: session.saved,
        seconds: session.seconds,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [session, submitted, autoSubmitted, uid]);

  // ── Per-question stopwatch (same contract as the mock exam) ────────────
  const timerRef = useRef<{ id: string; since: number } | null>(null);

  const bankSeconds = (s: Session): Record<string, number> => {
    const mark = timerRef.current;
    if (!mark) return s.seconds;
    const elapsed = Math.max(0, Math.round((Date.now() - mark.since) / 1000));
    if (elapsed === 0) return s.seconds;
    return { ...s.seconds, [mark.id]: (s.seconds[mark.id] ?? 0) + elapsed };
  };

  const update = (patch: (s: Session) => Session) => {
    if (!session) return;
    setLocal({ session: patch(session) });
  };

  // ── Open by code ───────────────────────────────────────────────────────
  //
  // `value` defaults to whatever is typed in the box. It is passed explicitly by
  // the `?code=` hand-off below, which must not wait a render for `setCode`.
  async function openByCode(value: string = code) {
    if (!isValidAccessCode(value)) return;
    setLooking(true);
    setLookupError(null);
    setDiscarded(false);
    try {
      const found = await findQuizByCode(value);
      if ('error' in found) {
        setLookupError(found.error === 'closed' ? t.closed : t.notFound);
        return;
      }
      const { quiz } = found;
      if (quiz.questions.length === 0) {
        setLookupError(t.empty);
        return;
      }

      // Shuffling happens ONCE, here — not on every render — so a re-render
      // never reorders a paper the student is halfway through.
      const items = quiz.shuffle ? shuffleItems(quiz.questions) : quiz.questions;
      setPending({
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizTeacherId: quiz.teacherId,
        quizTeacherName: quiz.teacherName,
        durationMinutes: quiz.durationMinutes,
        hideAnswers: !quiz.showAnswers,
        examLang: pendingLang,
        questions: hydrateQuiz(items),
        answers: {},
        flagged: [],
        current: 0,
        endsAt: 0, // set when Start is pressed — the clock starts then, not now
        submitted: false,
        resumed: false,
        saved: false,
        seconds: {},
      });
    } catch (err) {
      console.error(err);
      setLookupError(t.lookupFailed);
    } finally {
      setLooking(false);
    }
  }

  /**
   * `?code=482913` — the hand-off from the Milliy sertifikat hub's single code box
   * (`app/(student)/milliy-sertifikat`, docs/MILLIY_QUIZ.md).
   *
   * That box resolves a code across BOTH paper collections; a maths code belongs
   * here, because only this page writes the Rasch levels a maths sitting moves.
   * Without the prefill the student would land on an empty box and retype the
   * code they just entered.
   *
   * ⚠️ Runs **once** (`autoOpened`) and only when there is nothing to resume: a
   * student with a paper still running against its clock must not have a link
   * quietly pull a different one on top of it. The URL is read from
   * `window.location` rather than `useSearchParams` deliberately — the latter
   * would force this whole page into a Suspense boundary for one optional param.
   */
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || session || pending || looking) return;
    if (typeof window === 'undefined') return;
    const fromUrl = sanitizeAccessCode(new URLSearchParams(window.location.search).get('code') ?? '');
    if (!isValidAccessCode(fromUrl)) return;
    autoOpened.current = true;
    setCode(fromUrl);
    void openByCode(fromUrl);
    // Intentionally not reactive: this is a one-shot hand-off on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startQuiz() {
    if (!pending) return;
    // ⚠️ Synchronously inside the click — see hooks/useExamLockdown.ts.
    requestExamFullscreen();
    setNow(Date.now());
    setLocal({
      session: {
        ...pending,
        examLang: pendingLang,
        endsAt: Date.now() + pending.durationMinutes * 60 * 1000,
      },
    });
    setPending(null);
  }

  function reset() {
    clearQuizSnapshot();
    setLocal({ session: null });
    setPending(null);
    setCode('');
    setLookupError(null);
    setLevels(null);
    setSaveError(null);
    setReported(false);
  }

  const setAnswer = (key: string, value: string) =>
    update((s) => ({ ...s, answers: { ...s.answers, [key]: value } }));

  const toggleFlag = (questionId: string) =>
    update((s) => ({
      ...s,
      flagged: s.flagged.includes(questionId)
        ? s.flagged.filter((id) => id !== questionId)
        : [...s.flagged, questionId],
    }));

  const goTo = (index: number) =>
    update((s) => {
      const seconds = bankSeconds(s);
      timerRef.current = { id: s.questions[index]?.id ?? '', since: Date.now() };
      return { ...s, current: index, seconds };
    });

  const finish = () =>
    update((s) => {
      const seconds = bankSeconds(s);
      timerRef.current = null;
      return { ...s, submitted: true, seconds };
    });

  const questions = useMemo(() => session?.questions ?? [], [session]);
  const answers = useMemo(() => session?.answers ?? {}, [session]);
  const flaggedIds = useMemo(() => new Set(session?.flagged ?? []), [session]);
  const examLang = session?.examLang ?? pendingLang;
  const current = session?.current ?? 0;

  const isCorrect = useCallback(
    (q: ExamQuestion) => isExamItemCorrect(q, answers),
    [answers],
  );

  // Slots, not cards — a shared_options block is worth one per sub-question.
  const score = useMemo(
    () => questions.reduce((total, q) => total + examScore(q, answers), 0),
    [questions, answers],
  );
  const totalQuestions = useMemo(
    () => questions.reduce((total, q) => total + examSlotCount(q), 0),
    [questions],
  );

  const bySection = useMemo(() => {
    const map = new Map<string, { label: string; testType: string; correct: number; total: number }>();
    for (const q of questions) {
      const entry = map.get(q.sectionId) ?? {
        label: q.sectionLabel[appLang], testType: q.testType, correct: 0, total: 0,
      };
      entry.total += examSlotCount(q);
      entry.correct += examScore(q, answers);
      map.set(q.sectionId, entry);
    }
    return Array.from(map.entries());
  }, [questions, answers, appLang]);

  const detected = useMemo(() => {
    if (!submitted || questions.length === 0) return null;
    const items = toItemResponses({
      questions, answers, isCorrect, seconds: session?.seconds ?? {}, kind: 'exam',
    });
    const { counts } = skillCoverage(items);
    return Object.entries(counts)
      .map(([key, cell]) => ({ key: key as SkillKey, ...cell! }))
      .sort((a, b) => b.seen - a.seen || a.key.localeCompare(b.key));
  }, [submitted, questions, answers, isCorrect, session?.seconds]);

  const currentId = session && !submitted ? session.questions[session.current]?.id : undefined;
  useEffect(() => {
    if (!currentId) {
      timerRef.current = null;
      return;
    }
    if (timerRef.current?.id !== currentId) {
      timerRef.current = { id: currentId, since: Date.now() };
    }
  }, [currentId]);

  useEffect(() => { setSolvedUser(uid); }, [uid]);

  // ── Archive locally (feeds the per-skill review) ───────────────────────
  const archivedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!submitted || !session || archivedRef.current === `${session.quizId}:${session.endsAt}`) return;
    archivedRef.current = `${session.quizId}:${session.endsAt}`;

    archiveExam({
      questions: session.questions,
      answers: session.answers,
      isCorrect,
      expectedFor: (q) => (examMode(q) === 'open' ? examExpectedText(q, session.examLang) : undefined),
      lang: session.examLang,
      at: Date.now(),
    });
  }, [submitted, session, isCorrect]);

  // ── Save: the student's own model, then the teacher's copy ─────────────
  //
  // Two independent writes, deliberately. `saveExamResult` moves the student's
  // Rasch levels; `saveQuizResult` is what the teacher sees. Neither should be
  // lost because the other failed, so the teacher's copy is written even when the
  // levels save throws, and vice versa is reported separately.
  //
  // `savingRef` closes the double-save window on the client the same way the mock
  // exam does; `saveExamResult`'s own `examId` check closes it across tabs.
  const savingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!submitted || !session || session.saved || !user) return;
    if (savingRef.current === session.endsAt) return;
    savingRef.current = session.endsAt;

    let cancelled = false;

    (async () => {
      const startedAt = session.endsAt - session.durationMinutes * 60 * 1000;
      const endedAt = Math.min(Date.now(), session.endsAt);
      const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
      const items = toItemResponses({
        questions: session.questions,
        answers: session.answers,
        isCorrect,
        seconds: session.seconds,
        kind: 'exam',
      });

      // The teacher's copy first: it is the thing the student was asked to do,
      // and it must land even if the ability model refuses the paper (an
      // untouched one, say).
      try {
        const correct = items.filter((i) => i.correct).length;

        // Per-dimension ability, so the teacher can see WHERE a student is weak
        // rather than only how much they scored. Measured the same way the
        // student's own heptagon is — `estimateAbility` over that dimension's
        // items — so the two never disagree about the same paper.
        //
        // A dimension the paper never touched is LEFT OUT, not written as 0: the
        // results page must be able to tell "not measured" from "measured at the
        // floor", and Firestore must never be handed an `undefined`.
        const topicTheta: Partial<Record<TopicKey, number>> = {};
        for (const key of TOPIC_KEYS) {
          const own = items.filter((i) => i.topic === key);
          if (own.length > 0) topicTheta[key] = estimateAbility(own).theta;
        }

        // Per-slot outcomes, so the teacher's page can see WHICH question the
        // class failed and mark it accordingly (lib/RASCHmarks.ts). `i.id` is
        // `examSlotKeys` — one entry per numbered question, a block included.
        // Outcomes only: what the student actually put is deliberately not sent.
        const itemOutcomes: Record<string, number> = {};
        for (const i of items) itemOutcomes[i.id] = i.correct ? 1 : 0;

        const result: RaschQuizResult = {
          quizId: session.quizId,
          quizTitle: session.quizTitle,
          teacherId: session.quizTeacherId,
          studentId: user.uid,
          studentName: user.displayName || '',
          correct,
          total: items.length,
          items: itemOutcomes,
          percent: items.length > 0 ? Math.round((correct / items.length) * 100) : 0,
          durationSec,
          submittedAt: Date.now(),
          examLang: session.examLang,
          topics: scoreByTopic(items),
          topicTheta,
          theta: estimateAbility(items).theta,
        };
        await saveQuizResult(result);

        // Patch the sat-papers cache rather than invalidating it: the student
        // lands back on the code screen straight after this, and a list missing
        // the paper they just finished reads as data loss. A retake REPLACES its
        // row, exactly as the document id does.
        if (pastCache && pastCache.uid === user.uid) {
          pastCache = {
            ...pastCache,
            rows: [result, ...pastCache.rows.filter((r) => r.quizId !== result.quizId)],
          };
          if (!cancelled) setPast(pastCache.rows);
        }
        if (!cancelled) setReported(true);
      } catch (err) {
        console.error('[quiz] could not report the result to the teacher', err);
      }

      try {
        const next = await saveExamResult({
          uid: user.uid,
          examLang: session.examLang,
          durationSec,
          items,
          // The deadline is fixed when the paper is drawn, so it identifies this
          // sitting and no other — the account can refuse a duplicate on sight.
          examId: session.endsAt,
        });
        if (cancelled) return;
        setLevels(next);
        setLocal({ session: { ...session, submitted: true, saved: true } });
      } catch (err) {
        console.error(err);
        savingRef.current = null; // let a genuine failure be retried
        if (!cancelled) setSaveError(err instanceof Error ? err.message : t.saveFailed);
      }
    })();

    return () => { cancelled = true; };
  }, [submitted, session, user, isCorrect, t.saveFailed]);

  // ── CODE / INTRO ───────────────────────────────────────────────────────
  if (stage === 'code' || stage === 'loading') {
    return (
      <Page>
        <RaschNav lang={appLang} />
        <div className="mx-auto w-full max-w-2xl">
          <Card className="p-s-card sm:p-6 md:p-8">
            {!pending ? (
              <>
                <h1 className="s-display mb-2 flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                  <KeyRound size={22} strokeWidth={3} className="text-primary" />
                  {t.title}
                </h1>
                <p className="mb-6 text-[13px] font-bold text-on-surface-variant">{t.lead}</p>

                <label htmlFor="quiz-code" className="mb-2 block text-[12px] font-black uppercase tracking-wider text-on-surface-variant">
                  {t.codeLabel}
                </label>
                <input
                  id="quiz-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={ACCESS_CODE_LENGTH}
                  value={code}
                  onChange={(e) => setCode(sanitizeAccessCode(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') openByCode(); }}
                  placeholder="000000"
                  className="s-num mb-4 w-full rounded-m3-sm border-[1.5px] border-outline bg-surface-container-low px-4 py-4 text-center text-[30px] font-black tracking-[0.4em] text-on-surface transition-colors duration-m3-fast ease-m3-std placeholder:text-outline focus:border-primary focus:outline-none"
                />

                {discarded && (
                  <Banner
                    status="warning"
                    className="mb-4"
                    icon={<AlertTriangle size={16} strokeWidth={3} />}
                    title={t.discarded}
                  />
                )}

                {lookupError && (
                  <Banner
                    status="error"
                    className="mb-4"
                    icon={<AlertTriangle size={16} strokeWidth={3} />}
                    title={lookupError}
                  />
                )}

                <Button
                  fullWidth
                  onClick={() => void openByCode()}
                  disabled={!isValidAccessCode(code) || looking}
                  loading={looking}
                  icon={<KeyRound size={18} strokeWidth={3} />}
                  className="uppercase tracking-wider"
                >
                  {looking ? t.opening : t.open}
                </Button>

                {/* ── papers already sat ──────────────────────────────────
                    The code box alone gave a student no way to see what they
                    had done — every result they had ever produced was visible
                    only to the teacher. ONE query (`studentId ==`, equality
                    only, so no composite index), cached 60s like every other
                    student page. */}
                {past !== null && (
                  <div className="mt-7 border-t border-outline-variant pt-5">
                    <h2 className="s-display text-[15px] font-bold">{t.pastTitle}</h2>
                    <p className="mb-3 text-[12px] font-bold text-on-surface-variant">
                      {past.length > 0 ? t.pastHint : t.pastEmpty}
                    </p>

                    <div className="flex flex-col gap-2">
                      {past.map((r) => {
                        const wrong = Math.max(0, r.total - r.correct);
                        const level = typeof r.theta === 'number' ? thetaToLevel(r.theta) : null;
                        const isOpen = openPast === r.quizId;
                        return (
                          <div
                            key={r.quizId}
                            className="rounded-m3-sm border border-outline-variant bg-surface-container-low"
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold text-on-surface">
                                  {r.quizTitle || '—'}
                                </p>
                                <p className="s-num mt-0.5 text-[11px] font-bold text-on-surface-variant">
                                  {/* right / wrong, the thing the list is for */}
                                  <span className="text-success">{r.correct} {t.pastRight}</span>
                                  {' · '}
                                  <span className="text-error">{wrong} {t.pastWrong}</span>
                                  {' · '}
                                  {new Date(r.submittedAt).toLocaleDateString()}
                                </p>
                              </div>

                              <div className="flex-none text-right">
                                <p className="s-num text-[16px] font-black leading-none text-on-surface">
                                  {r.percent}<span className="text-[11px] text-on-surface-variant">%</span>
                                </p>
                                {level !== null && (
                                  <p className="s-num mt-0.5 text-[10.5px] font-bold text-on-surface-variant">
                                    {t.pastLevel} {formatLevel(level)}/{MASTER_LEVEL}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* ⚠️ Only offered when the result carries per-slot
                                outcomes. A sitting saved before `items` existed
                                cannot say WHICH question was wrong, and a review
                                that marked all 45 red would be a lie. */}
                            {r.items && (
                              <div className="border-t border-outline-variant px-3 py-2">
                                <button
                                  onClick={() => toggleReview(r.quizId)}
                                  aria-expanded={isOpen}
                                  className="flex items-center gap-1.5 text-[11.5px] font-black text-primary s-press"
                                >
                                  <BookOpen size={13} strokeWidth={3} />
                                  {isOpen ? t.pastReviewClose : t.pastReview}
                                  <ChevronDown
                                    size={13}
                                    strokeWidth={3}
                                    className={cn('transition-transform', isOpen && 'rotate-180')}
                                  />
                                </button>

                                {isOpen && (
                                  <div className="mt-2">
                                    {openState === 'loading' && (
                                      <p className="text-[11.5px] font-bold text-on-surface-variant">{t.pastReviewLoading}</p>
                                    )}
                                    {openState === 'gone' && (
                                      <p className="text-[11.5px] font-bold text-on-surface-variant">{t.pastReviewGone}</p>
                                    )}
                                    {openState === 'failed' && (
                                      <p className="text-[11.5px] font-bold text-error">{t.pastReviewFailed}</p>
                                    )}
                                    {openState === 'idle' && openQuiz && (
                                      // The SAME review the post-submit screen
                                      // renders, in replay mode: correctness from
                                      // the stored outcome map, and the key still
                                      // withheld when the teacher withheld it.
                                      <ExamReview
                                        questions={hydrateQuiz(openQuiz.questions)}
                                        answers={{}}
                                        outcomes={r.items}
                                        examLang={r.examLang}
                                        appLang={appLang}
                                        hideAnswers={!openQuiz.showAnswers}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {pastError && (
                  <p className="mt-4 text-[12px] font-bold text-on-surface-variant">{t.pastFailed}</p>
                )}
              </>
            ) : (
              <>
                <h1 className="s-display mb-2 text-2xl font-bold tracking-tight md:text-3xl">{pending.quizTitle}</h1>
                <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-bold text-on-surface-variant">
                  {pending.quizTeacherName && (
                    <span className="flex items-center gap-1.5">
                      <User size={14} strokeWidth={3} /> {t.by}: {pending.quizTeacherName}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} strokeWidth={3} />
                    <span className="s-num">{pending.durationMinutes}</span> {t.duration}
                  </span>
                  <span>
                    <span className="s-num">
                      {pending.questions.reduce((n, q) => n + examSlotCount(q), 0)}
                    </span> {t.totalQ}
                  </span>
                </div>

                <div className="mb-6">
                  <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-on-surface-variant">
                    <Languages size={14} strokeWidth={3} /> {t.langTitle}
                  </p>
                  {/* Wraps instead of a 3-column grid: a FilterChip is `shrink-0`,
                      so on a 360px phone "🇷🇺 Русский" (plus the tick when it is
                      the selected one) is wider than a third of the card and
                      pushed the page into horizontal scroll. */}
                  <div className="flex flex-wrap gap-2">
                    {QUESTION_LANGS.map((l) => (
                      <FilterChip
                        key={l.code}
                        selected={pendingLang === l.code}
                        onClick={() => setPendingLang(l.code)}
                        className="flex-1 justify-center"
                      >
                        <span className="text-[16px] leading-none">{l.flag}</span>
                        {l.label}
                      </FilterChip>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] font-bold text-on-surface-variant">{t.langHint}</p>
                </div>

                {!user && (
                  <Banner
                    status="warning"
                    className="mb-4"
                    icon={<AlertTriangle size={16} strokeWidth={3} />}
                    title={t.signInToSave}
                  />
                )}

                <Button
                  fullWidth
                  onClick={startQuiz}
                  icon={<Play size={18} strokeWidth={3} />}
                  className="mb-2 uppercase tracking-wider"
                >
                  {t.start}
                </Button>
                <Button fullWidth variant="text" onClick={reset}>{t.another}</Button>
              </>
            )}
          </Card>
        </div>
      </Page>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (stage === 'submitted' && session) {
    return (
      <Page>
        <RaschNav lang={appLang} />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-s-section">
          {autoSubmitted && (
            <Banner status="warning" icon={<AlertTriangle size={16} strokeWidth={3} />} title={t.timeUp} />
          )}

          <Card className="p-s-card text-center sm:p-6 md:p-8">
            <p className="mb-1 text-[13px] font-black uppercase tracking-wider text-on-surface-variant">{session.quizTitle}</p>
            <p className="s-display s-num text-5xl font-bold tracking-tight text-primary">
              {score}<span className="text-3xl text-on-surface-variant">/{totalQuestions}</span>
            </p>
            {reported && (
              <p className="mt-2 text-[12px] font-bold text-success">{t.sentToTeacher}</p>
            )}
          </Card>

          {/* The paper moves the student's own Rasch levels exactly as a mock
              exam does — it is 45 questions measured on the same scale. */}
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="s-display text-[14px] font-bold">{t.levelTitle}</p>
              <Link
                href="/raschmodel/progress"
                className="shrink-0 rounded-m3-btn border-[1.5px] border-outline px-3 py-1.5 text-[11px] font-black text-on-surface-variant s-press hover:bg-state-hover hover:text-primary"
              >
                {t.viewProgress}
              </Link>
            </div>

            {!user ? (
              <p className="text-[12px] font-bold text-on-surface-variant">{t.signInToSave}</p>
            ) : saveError ? (
              <p className="text-[12px] font-bold text-error">{saveError}</p>
            ) : !levels ? (
              <p className="text-[12px] font-bold text-on-surface-variant">{t.savingResult}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {RASCH_TOPICS.map((topic) => {
                  const stat = levels.topics[topic.key];
                  if (!stat) return null;
                  const up = stat.delta > 0;
                  const flat = stat.delta === 0;
                  return (
                    <div key={topic.key} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: topic.hex }} />
                        <span className="min-w-0 truncate text-on-surface-variant">{topic.label[appLang]}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={cn('s-num text-[11px] font-black', flat ? 'text-on-surface-variant' : up ? 'text-success' : 'text-error')}>
                          {flat ? '±0' : `${up ? '▲ +' : '▼ '}${stat.delta}`}
                        </span>
                        <span className="s-num w-11 text-right text-[15px] font-black">{stat.level}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <p className="s-display mb-3 text-[14px] font-bold">{t.byTopic}</p>
            <div className="flex flex-col gap-2">
              {bySection.map(([sectionId, s]) => (
                <div key={sectionId} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                  <span className="min-w-0 flex-1 truncate text-on-surface-variant">{s.label}</span>
                  <span className="s-num shrink-0 text-on-surface-variant">{s.testType} · {s.correct}/{s.total}</span>
                </div>
              ))}
            </div>
          </Card>

          {detected && detected.length > 0 && (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="s-display text-[14px] font-bold">{t.skillsTitle}</p>
                <span className="s-num shrink-0 text-[11px] font-black text-on-surface-variant">
                  {detected.length}/{SKILL_KEYS.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {detected.map((s) => {
                  const meta = skillMeta(s.key);
                  const all = s.correct === s.seen;
                  const none = s.correct === 0;
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                      <span className="min-w-0 truncate text-on-surface-variant">{meta?.label[appLang] ?? s.key}</span>
                      <span className={cn('s-num shrink-0 text-[12px] font-black', all ? 'text-success' : none ? 'text-error' : 'text-on-surface-variant')}>
                        {s.correct}/{s.seen}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 border-t border-outline-variant pt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">
                {t.skillsHint}
              </p>
            </Card>
          )}

          <ExamReview
            questions={questions}
            answers={answers}
            examLang={examLang}
            appLang={appLang}
            hideAnswers={session.hideAnswers}
          />

          {/* ONE row on a phone, like the navbar above: the action you came for
              keeps its label and the two destinations shrink to icon buttons
              (their label survives as `aria-label`/`title`). Three stacked
              full-width bars cost a third of the screen for two links. */}
          <div className="flex items-stretch gap-2">
            <Button
              onClick={reset}
              icon={<KeyRound size={16} strokeWidth={3} />}
              className="min-w-0 flex-1 px-3 text-[12px] uppercase tracking-wider sm:px-5 sm:text-[14.5px]"
            >
              {t.another}
            </Button>
            <NavLink
              href="/raschmodel/progress"
              tone="tonal"
              label={t.viewProgress}
              className="shrink-0 px-3 uppercase tracking-wider sm:px-5"
            >
              <TrendingUp size={16} strokeWidth={3} />
              <span className="hidden sm:inline">{t.viewProgress}</span>
            </NavLink>
            <NavLink
              href="/raschmodel"
              label={t.home}
              className="shrink-0 px-3 uppercase tracking-wider sm:px-5"
            >
              <Home size={16} strokeWidth={3} />
              <span className="hidden sm:inline">{t.home}</span>
            </NavLink>
          </div>
        </div>
      </Page>
    );
  }

  // ── IN PROGRESS ────────────────────────────────────────────────────────
  if (!session || !questions[current]) return null;

  return (
    <ExamRunner
      questions={questions}
      answers={answers}
      flagged={flaggedIds}
      current={current}
      totalQuestions={totalQuestions}
      secondsLeft={secondsLeft}
      examLang={examLang}
      appLang={appLang}
      provenance={session.resumed ? t.resumed : t.oneRead}
      onAnswer={setAnswer}
      onToggleFlag={toggleFlag}
      onGoTo={goTo}
      onSubmit={finish}
    />
  );
}
