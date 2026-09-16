'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle, BadgeCheck, ChevronDown, Clock, KeyRound, Languages, Play,
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import ExamRunner, { QUESTION_LANGS } from '../../raschmodel/_components/ExamRunner';
import ExamReview from '../../raschmodel/_components/ExamReview';
import { requestExamFullscreen } from '@/hooks/useExamLockdown';
import {
  ACCESS_CODE_LENGTH, isValidAccessCode, sanitizeAccessCode,
} from '@/lib/RASCHquiz';
import {
  findMilliySubject, genericSubject, hydrateMilliyQuiz, shuffleMilliyItems, subjectName,
} from '@/lib/MilliyQuiz';
import {
  examScore, examSlotCount, examSlotKeys, hasExamAnswer, isExamItemCorrect,
} from '@/lib/ExamTeacher';
import {
  clearMilliySnapshot, getMilliySnapshot, getServerMilliySnapshot, saveMilliySnapshot,
  subscribeMilliySnapshot,
} from '@/lib/Examsession';
import {
  findPaperByCode, getMilliyQuiz, listMyMilliyResults, saveMilliyResult,
} from '@/services/milliyQuizService';
import {
  Banner, Button, Card, EmptyState, FilterChip, Page, cn,
} from '@/components/student-ui';
import { examMistakes } from '@/lib/mistakes';
import { recordMistakes } from '@/services/mistakeService';
import type { ExamQuestion } from '@/types/Exam';
import type { MilliyQuiz, MilliyQuizResult } from '@/types/MilliyQuiz';
import type { Lang } from '@/types/Math';

/**
 * **One Milliy sertifikat SUBJECT, for the student** — its code box, its sitting,
 * its result and the papers they have already sat for it.
 *
 * The hub at `/milliy-sertifikat` lists the subjects; this is what one card opens.
 * ⚠️ Maths never reaches here — `genericSubject` refuses it, because the maths
 * section IS the Rasch suite at `/raschmodel` (level chart, practice, diagnosis,
 * its own code page). The hub links there directly.
 *
 * The code box still resolves ACROSS subjects, on purpose: a student who pastes a
 * maths code while standing on the biology page should be taken to the right
 * runner rather than told the code is wrong. `findPaperByCode` resolves six digits across
 * both paper collections, and the two are then handled differently on purpose:
 *
 * - **maths** → handed to `/raschmodel/quiz?code=…`. Only that page writes the
 *   Rasch levels a maths sitting moves; re-implementing it here would be a second
 *   runner for one exam (docs/RASCH_QUIZ.md).
 * - **a subject paper** (biology…) → sat right here, scored on raw counts.
 *   ⚠️ **No ability model.** There is no calibrated item difficulty and no
 *   blueprint for these subjects, so a θ would be a number with nothing behind
 *   it (docs/MILLIY_QUIZ.md).
 *
 * The sitting itself reuses `ExamRunner` and `ExamReview` unchanged — the same
 * components the mock exam and the maths paper use. ⚠️ **Never copy either one to
 * add a variant**: a block's answers live under per-part keys, and every surface
 * that forgets to branch on that renders `[object Object]`.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Milliy sertifikat',
    unknownTitle: 'Bu fan hali tayyor emas',
    unknownDesc: "Bu fan bo'yicha variantlar hali qo'shilmagan.",
    toHub: 'Fanlar',
    lead: "O'qituvchingiz bergan 6 xonali kodni kiriting.",
    codeLabel: 'Kirish kodi',
    open: 'Ochish',
    subjects: 'Fanlar',
    ready: 'Tayyor',
    soon: 'Tez kunda',
    mathNote: 'Matematika varianti Rasch bo\'limida ishlanadi — kod kiritilsa, o\'zi ochiladi.',
    notFound: 'Bu kod bilan variant topilmadi. Tekshirib, qayta kiriting.',
    closed: "Bu variant yopilgan — o'qituvchingizga murojaat qiling.",
    empty: 'Bu variantda savol yo\'q.',
    lookupFailed: 'Kodni tekshirib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.',
    intro: 'Variant',
    teacher: "O'qituvchi",
    questions: 'savol',
    minutes: 'daqiqa',
    langLabel: 'Savollar tili',
    start: 'Boshlash',
    resume: 'Davom etish',
    resumeNote: 'Tugallanmagan variantingiz bor.',
    another: 'Boshqa kod kiritish',
    result: 'Natija',
    correct: "To'g'ri",
    wrong: 'Xato',
    score: 'Ball',
    autoSubmitted: 'Vaqt tugadi — variant avtomatik topshirildi.',
    saveFailed: 'Natijani saqlab bo\'lmadi.',
    review: 'Savollarni ko\'rish',
    myPapers: 'Ishlagan variantlarim',
    noPapers: 'Hali variant ishlamagansiz.',
    openReview: 'Ko\'rish',
    closeReview: 'Yopish',
    reviewGone: 'Bu variant o\'chirilgan — savollarni ko\'rsatib bo\'lmaydi.',
    reviewFailed: 'Savollarni yuklab bo\'lmadi.',
    again: 'Yana bir variant',
  },
  ru: {
    title: 'Milliy sertifikat',
    unknownTitle: 'Этот предмет пока не готов',
    unknownDesc: 'Варианты по этому предмету пока не добавлены.',
    toHub: 'Предметы',
    lead: 'Введите 6-значный код, который дал учитель.',
    codeLabel: 'Код доступа',
    open: 'Открыть',
    subjects: 'Предметы',
    ready: 'Готово',
    soon: 'Скоро',
    mathNote: 'Вариант по математике проходится в разделе Rasch — по коду он откроется сам.',
    notFound: 'Вариант с таким кодом не найден. Проверьте и введите снова.',
    closed: 'Этот вариант закрыт — обратитесь к учителю.',
    empty: 'В этом варианте нет вопросов.',
    lookupFailed: 'Не удалось проверить код. Проверьте интернет и попробуйте снова.',
    intro: 'Вариант',
    teacher: 'Учитель',
    questions: 'вопросов',
    minutes: 'минут',
    langLabel: 'Язык вопросов',
    start: 'Начать',
    resume: 'Продолжить',
    resumeNote: 'У вас есть незавершённый вариант.',
    another: 'Ввести другой код',
    result: 'Результат',
    correct: 'Верно',
    wrong: 'Неверно',
    score: 'Балл',
    autoSubmitted: 'Время вышло — вариант отправлен автоматически.',
    saveFailed: 'Не удалось сохранить результат.',
    review: 'Посмотреть вопросы',
    myPapers: 'Мои пройденные варианты',
    noPapers: 'Вы пока не проходили варианты.',
    openReview: 'Открыть',
    closeReview: 'Закрыть',
    reviewGone: 'Этот вариант удалён — вопросы показать нельзя.',
    reviewFailed: 'Не удалось загрузить вопросы.',
    again: 'Ещё вариант',
  },
  en: {
    title: 'Milliy sertifikat',
    unknownTitle: 'This subject is not ready yet',
    unknownDesc: 'No papers have been added for this subject yet.',
    toHub: 'Subjects',
    lead: 'Enter the 6-digit code your teacher gave you.',
    codeLabel: 'Access code',
    open: 'Open',
    subjects: 'Subjects',
    ready: 'Ready',
    soon: 'Soon',
    mathNote: 'A maths paper is sat in the Rasch section — your code opens it there automatically.',
    notFound: 'No paper found with that code. Check it and try again.',
    closed: 'That paper is closed — ask your teacher.',
    empty: 'That paper has no questions.',
    lookupFailed: 'Could not check the code. Check your connection and try again.',
    intro: 'Paper',
    teacher: 'Teacher',
    questions: 'questions',
    minutes: 'minutes',
    langLabel: 'Question language',
    start: 'Start',
    resume: 'Resume',
    resumeNote: 'You have an unfinished paper.',
    another: 'Enter a different code',
    result: 'Result',
    correct: 'Correct',
    wrong: 'Wrong',
    score: 'Score',
    autoSubmitted: 'Time ran out — the paper was submitted automatically.',
    saveFailed: 'Could not save your result.',
    review: 'Review the questions',
    myPapers: 'Papers I have sat',
    noPapers: 'You have not sat a paper yet.',
    openReview: 'Open',
    closeReview: 'Close',
    reviewGone: 'That paper was deleted — its questions cannot be shown.',
    reviewFailed: 'Could not load the questions.',
    again: 'Another paper',
  },
};

/**
 * The student's own sittings, cached 60s at module level like every other student
 * page. ⚠️ Submitting a paper PATCHES this rather than invalidating it: the
 * student lands straight back on this screen, and a list missing the paper they
 * just finished reads as data loss.
 */
let pastCache: { uid: string; at: number; rows: MilliyQuizResult[] } | null = null;
const PAST_TTL = 60_000;

/** One sat paper's questions, fetched once per tab for the replay review. */
const reviewCache = new Map<string, MilliyQuiz>();

type Stage = 'code' | 'loading' | 'in-progress' | 'submitted';

/** One subject paper in flight. Mirrors the persisted snapshot. */
interface Session {
  quizId: string;
  quizTitle: string;
  subject: string;
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
  saved: boolean;
}

export default function MilliySubjectStudentPage() {
  const router = useRouter();
  const routeParams = useParams<{ subject: string }>();
  // ⚠️ Refuses `math` as well as an unknown segment — see the header.
  const subject = genericSubject(routeParams.subject);
  const { lang: appLang } = useStudentLanguage();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const t = UI[appLang];

  const [code, setCode] = useState('');
  const [pendingLang, setPendingLang] = useState<Lang>('uz');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pending, setPending] = useState<Session | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const stored = useSyncExternalStore(
    subscribeMilliySnapshot, getMilliySnapshot, getServerMilliySnapshot,
  );

  /**
   * ⚠️ localStorage is shared by every account on one browser — only resume a
   * paper that belongs to the student currently signed in, or student B resumes
   * student A's paper and sees A's result.
   */
  const restored = useMemo<Session | null>(
    () =>
      stored && (stored.uid ?? '') === uid && stored.quizId && stored.milliySubject
        ? {
          quizId: stored.quizId,
          quizTitle: stored.quizTitle ?? '',
          subject: stored.milliySubject,
          quizTeacherId: stored.quizTeacherId ?? '',
          quizTeacherName: stored.quizTeacherName ?? '',
          durationMinutes: stored.durationMinutes ?? 90,
          hideAnswers: stored.hideAnswers ?? false,
          examLang: stored.examLang,
          questions: stored.questions,
          answers: stored.answers,
          flagged: stored.flagged,
          current: stored.current,
          endsAt: stored.endsAt,
          submitted: stored.submitted,
          saved: stored.saved ?? false,
        }
        : null,
    [stored, uid],
  );

  const [session, setSession] = useState<Session | null>(null);
  const live = session ?? restored;

  /** Write through to localStorage on every change, so a reload resumes exactly. */
  const commit = useCallback((next: Session | null) => {
    setSession(next);
    if (!next) { clearMilliySnapshot(); return; }
    saveMilliySnapshot({
      uid,
      examLang: next.examLang,
      questions: next.questions,
      shortfalls: [],
      answers: next.answers,
      flagged: next.flagged,
      current: next.current,
      endsAt: next.endsAt,
      submitted: next.submitted,
      autoSubmitted: false,
      docsRead: 1,
      saved: next.saved,
      quizId: next.quizId,
      quizTitle: next.quizTitle,
      quizTeacherId: next.quizTeacherId,
      quizTeacherName: next.quizTeacherName,
      durationMinutes: next.durationMinutes,
      hideAnswers: next.hideAnswers,
      milliySubject: next.subject,
    });
  }, [uid]);

  const update = (patch: (s: Session) => Session) => {
    if (!live) return;
    commit(patch(live));
  };

  // ── clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!live || live.submitted) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live, live?.submitted]);

  /**
   * ⚠️ A paper whose deadline passed with NOTHING answered is abandoned, not
   * submitted — identical rule to the mock exam and the maths paper. It must
   * never reach the teacher as a 0% result for a paper nobody sat.
   */
  const expired = !!live && now >= live.endsAt;
  const answeredCount = live
    ? live.questions.filter((q) => hasExamAnswer(q, live.answers)).length
    : 0;
  const abandoned = !!live && !live.submitted && expired && answeredCount === 0;
  const submitted = !!live && !abandoned && (live.submitted || expired);
  const autoSubmitted = !!live && !live.submitted && expired && !abandoned;

  const stage: Stage = looking
    ? 'loading'
    : !live || abandoned
      ? 'code'
      : submitted
        ? 'submitted'
        : 'in-progress';

  const totalSlots = useMemo(
    () => (live ? live.questions.reduce((s, q) => s + examSlotCount(q), 0) : 0),
    [live],
  );

  const score = useMemo(() => {
    if (!live) return { correct: 0, total: 0 };
    const correct = live.questions.reduce((s, q) => s + examScore(q, live.answers), 0);
    return { correct, total: totalSlots };
  }, [live, totalSlots]);

  // ── the papers this student has already sat ────────────────────────────
  // Loaded only on the code screen — a student mid-paper must not pay for it.
  const [past, setPast] = useState<MilliyQuizResult[] | null>(null);
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [openQuiz, setOpenQuiz] = useState<MilliyQuiz | null>(null);
  const [openState, setOpenState] = useState<'idle' | 'loading' | 'gone' | 'failed'>('idle');

  useEffect(() => {
    if (stage !== 'code' || !uid) return;
    if (pastCache && pastCache.uid === uid && Date.now() - pastCache.at < PAST_TTL) {
      setPast(pastCache.rows);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyMilliyResults(uid);
        if (cancelled) return;
        // Cached UNFILTERED (one equality query serves every subject — see the
        // service), then narrowed per page. A per-subject query would be a second
        // read for data already in hand.
        pastCache = { uid, at: Date.now(), rows };
        setPast(rows);
      } catch (err) {
        console.error(err);
        if (!cancelled) setPast([]);
      }
    })();
    return () => { cancelled = true; };
  }, [stage, uid]);

  /**
   * Open (or close) the review of a paper already sat. ONE document read the
   * first time and nothing after — a sat paper is an immutable snapshot, so
   * nothing can go stale.
   */
  const toggleReview = async (result: MilliyQuizResult) => {
    if (openPast === result.quizId) {
      setOpenPast(null);
      setOpenQuiz(null);
      setOpenState('idle');
      return;
    }
    setOpenPast(result.quizId);
    const cached = reviewCache.get(result.quizId);
    if (cached) { setOpenQuiz(cached); setOpenState('idle'); return; }

    setOpenState('loading');
    try {
      const paper = await getMilliyQuiz(result.quizId);
      if (!paper) { setOpenQuiz(null); setOpenState('gone'); return; }
      reviewCache.set(result.quizId, paper);
      setOpenQuiz(paper);
      setOpenState('idle');
    } catch (err) {
      console.error(err);
      setOpenState('failed');
    }
  };

  // ── open by code ───────────────────────────────────────────────────────
  async function openByCode() {
    if (!isValidAccessCode(code)) return;
    setLooking(true);
    setLookupError(null);
    try {
      const found = await findPaperByCode(code);

      if ('error' in found) {
        setLookupError(found.error === 'closed' ? t.closed : t.notFound);
        return;
      }

      // ⚠️ A maths paper goes to the Rasch runner, which is the only page that
      // writes the levels such a sitting moves. The code rides in the URL so the
      // student never retypes it.
      if (found.kind === 'rasch') {
        router.push(`/raschmodel/quiz?code=${code}`);
        return;
      }

      const { quiz } = found;
      if (quiz.questions.length === 0) {
        setLookupError(t.empty);
        return;
      }

      // ⚠️ Shuffling happens ONCE, here — never on render, or a re-render would
      // reorder a paper the student is halfway through. It moves CARDS, so a
      // block is never split apart.
      const items = quiz.shuffle ? shuffleMilliyItems(quiz.questions) : quiz.questions;
      setPending({
        quizId: quiz.id,
        quizTitle: quiz.title,
        subject: quiz.subject,
        quizTeacherId: quiz.teacherId,
        quizTeacherName: quiz.teacherName,
        durationMinutes: quiz.durationMinutes,
        hideAnswers: !quiz.showAnswers,
        examLang: pendingLang,
        questions: hydrateMilliyQuiz(items),
        answers: {},
        flagged: [],
        current: 0,
        endsAt: 0, // set when Start is pressed — the clock starts then, not now
        submitted: false,
        saved: false,
      });
    } catch (err) {
      console.error(err);
      setLookupError(t.lookupFailed);
    } finally {
      setLooking(false);
    }
  }

  function startPaper() {
    if (!pending) return;
    // ⚠️ Synchronously inside the click — see hooks/useExamLockdown.ts.
    requestExamFullscreen();
    setNow(Date.now());
    commit({
      ...pending,
      examLang: pendingLang,
      endsAt: Date.now() + pending.durationMinutes * 60 * 1000,
    });
    setPending(null);
  }

  function reset() {
    clearMilliySnapshot();
    setSession(null);
    setPending(null);
    setCode('');
    setLookupError(null);
    setSaveError(null);
  }

  // ── submit: exactly ONE write ──────────────────────────────────────────
  //
  // ⚠️ Unlike a maths sitting (two independent writes — the teacher's copy AND
  // the student's Rasch levels), a subject paper has no ability model to move.
  // `savingRef` closes the double-save window on the client; the deterministic
  // document id closes it across tabs and reloads.
  const savingRef = useRef(false);
  useEffect(() => {
    if (!live || !submitted || live.saved || !uid || savingRef.current) return;
    savingRef.current = true;

    (async () => {
      try {
        const items: Record<string, number> = {};
        const topics: Record<string, { correct: number; total: number }> = {};

        for (const q of live.questions) {
          const keys = examSlotKeys(q);
          if (q.qType === 'shared_options' && q.parts) {
            // One outcome per sub-question, exactly as the paper numbers them.
            q.parts.forEach((p, i) => {
              const ok = isExamItemCorrect({ ...q, parts: [p] }, live.answers) ? 1 : 0;
              items[keys[i]] = ok;
            });
          } else {
            items[keys[0]] = isExamItemCorrect(q, live.answers) ? 1 : 0;
          }

          const slug = q.sectionId || q.topicId || '';
          const slots = examSlotCount(q);
          const prev = topics[slug] ?? { correct: 0, total: 0 };
          topics[slug] = {
            correct: prev.correct + examScore(q, live.answers),
            total: prev.total + slots,
          };
        }

        const result: MilliyQuizResult = {
          quizId: live.quizId,
          quizTitle: live.quizTitle,
          subject: live.subject as MilliyQuizResult['subject'],
          teacherId: live.quizTeacherId,
          studentId: uid,
          studentName: user?.displayName || '',
          correct: score.correct,
          total: score.total,
          percent: score.total > 0 ? (score.correct / score.total) * 100 : 0,
          durationSec: Math.max(
            0,
            Math.round((Math.min(Date.now(), live.endsAt) - (live.endsAt - live.durationMinutes * 60_000)) / 1000),
          ),
          submittedAt: Date.now(),
          examLang: live.examLang,
          items,
          topics,
        };

        await saveMilliyResult(result);
        commit({ ...live, submitted: true, saved: true });

        // Patch the cache — a retake REPLACES its row, matching what the
        // deterministic document id already does.
        if (pastCache && pastCache.uid === uid) {
          pastCache = {
            ...pastCache,
            rows: [result, ...pastCache.rows.filter((r) => r.quizId !== result.quizId)],
          };
          setPast(pastCache.rows);
        }
      } catch (err) {
        console.error(err);
        setSaveError(t.saveFailed);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, live?.saved, uid]);

  const secondsLeft = live ? Math.max(0, Math.round((live.endsAt - now) / 1000)) : 0;

  // ⚠️ After every hook, before any render branch — Rules of Hooks.
  if (!subject) {
    return (
      <Page>
        <div className="mx-auto max-w-xl py-10">
          <EmptyState
            title={t.unknownTitle}
            description={t.unknownDesc}
            action={<Button onClick={() => router.push('/milliy-sertifikat')}>{t.toHub}</Button>}
          />
        </div>
      </Page>
    );
  }


  // ── in progress ────────────────────────────────────────────────────────
  if (stage === 'in-progress' && live) {
    const subject = findMilliySubject(live.subject);
    return (
      <ExamRunner
        questions={live.questions}
        answers={live.answers}
        flagged={new Set(live.flagged)}
        current={live.current}
        totalQuestions={totalSlots}
        secondsLeft={secondsLeft}
        examLang={live.examLang}
        appLang={appLang}
        provenance={[
          subject ? subjectName(subject, appLang) : null,
          live.quizTitle,
          live.quizTeacherName,
        ].filter(Boolean).join(' · ')}
        onAnswer={(key, value) => update((s) => ({ ...s, answers: { ...s.answers, [key]: value } }))}
        onToggleFlag={(questionId) => update((s) => ({
          ...s,
          flagged: s.flagged.includes(questionId)
            ? s.flagged.filter((f) => f !== questionId)
            : [...s.flagged, questionId],
        }))}
        onGoTo={(index) => update((s) => ({ ...s, current: index }))}
        onSubmit={() => update((s) => ({ ...s, submitted: true }))}
      />
    );
  }

  // ── submitted ──────────────────────────────────────────────────────────
  if (stage === 'submitted' && live) {
    const percent = score.total > 0 ? (score.correct / score.total) * 100 : 0;
    return (
      <Page>
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {autoSubmitted && <Banner status="warning" icon={<AlertTriangle size={16} strokeWidth={3} />} title={t.autoSubmitted} />}
          {saveError && <Banner status="error" title={saveError} />}

          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <BadgeCheck size={32} className="text-primary" />
            <h1 className="text-[20px] font-black text-on-surface">{t.result}</h1>
            <p className="text-[13px] font-bold text-on-surface-variant">{live.quizTitle}</p>
            <p className="s-num text-[40px] font-black leading-none text-on-surface">
              {Math.round(percent)}%
            </p>
            <p className="text-[13px] font-bold text-on-surface-variant">
              {t.correct}: {score.correct} · {t.wrong}: {score.total - score.correct} / {score.total}
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-[15px] font-black text-on-surface">{t.review}</h2>
            <ExamReview
              questions={live.questions}
              answers={live.answers}
              examLang={live.examLang}
              appLang={appLang}
              hideAnswers={live.hideAnswers}
            />
          </Card>

          <Button onClick={reset}>{t.again}</Button>
        </div>
      </Page>
    );
  }

  // ── intro (a paper found, not started) ─────────────────────────────────
  if (pending) {
    const subject = findMilliySubject(pending.subject);
    const slots = pending.questions.reduce((s, q) => s + examSlotCount(q), 0);
    return (
      <Page>
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <Card className="flex flex-col gap-3 p-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              {subject ? subjectName(subject, appLang) : t.intro}
            </span>
            <h1 className="text-[22px] font-black leading-tight text-on-surface">{pending.quizTitle}</h1>
            <p className="text-[13px] font-bold text-on-surface-variant">
              {t.teacher}: {pending.quizTeacherName || '—'}
            </p>
            <p className="flex flex-wrap items-center gap-3 text-[13px] font-bold text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={14} /> {slots} {t.questions}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> {pending.durationMinutes} {t.minutes}
              </span>
            </p>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-on-surface-variant">
                <Languages size={13} /> {t.langLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_LANGS.map((l) => (
                  <FilterChip
                    key={l.code}
                    selected={pendingLang === l.code}
                    onClick={() => setPendingLang(l.code)}
                  >
                    {l.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <Button icon={<Play />} onClick={startPaper}>{t.start}</Button>
            <Button variant="text" onClick={() => { setPending(null); setCode(''); }}>
              {t.another}
            </Button>
          </Card>
        </div>
      </Page>
    );
  }

  // ── code screen ────────────────────────────────────────────────────────
  const mine = (past ?? []).filter((r) => r.subject === subject?.id);

  return (
    <Page>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="text-center">
          <h1 className="text-[22px] font-black tracking-tight text-on-surface">
            {subject ? subjectName(subject, appLang) : t.title}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-on-surface-variant">{t.lead}</p>
        </div>

        {restored && !abandoned && (
          <Banner
            status="info"
            title={t.resumeNote}
            actions={<Button size="sm" onClick={() => commit(restored)}>{t.resume}</Button>}
          />
        )}

        <Card className="flex flex-col gap-3 p-5">
          <label
            htmlFor="milliy-code"
            className="text-[12px] font-black uppercase tracking-wider text-on-surface-variant"
          >
            {t.codeLabel}
          </label>
          <input
            id="milliy-code"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ACCESS_CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(sanitizeAccessCode(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') void openByCode(); }}
            placeholder="000000"
            className="s-num w-full rounded-m3-md border border-outline bg-surface-container-lowest px-4 py-3 text-center text-[28px] font-black tracking-[0.35em] text-on-surface outline-none focus:border-primary"
          />

          {lookupError && (
            <p className="flex items-start gap-1.5 text-[12px] font-bold text-error">
              <AlertTriangle size={14} className="mt-0.5 flex-none" /> {lookupError}
            </p>
          )}

          <Button
            icon={<KeyRound />}
            loading={looking}
            disabled={!isValidAccessCode(code) || looking}
            onClick={() => void openByCode()}
          >
            {t.open}
          </Button>

          <p className="text-[11px] font-bold leading-snug text-on-surface-variant">{t.mathNote}</p>
        </Card>

        {/* ── papers already sat, for THIS subject ───────────────────────── */}
        <Card className="p-4">
          <h2 className="mb-3 text-[15px] font-black text-on-surface">{t.myPapers}</h2>

          {past === null ? (
            <p className="text-[12px] font-bold text-on-surface-variant">…</p>
          ) : mine.length === 0 ? (
            <p className="text-[12px] font-bold text-on-surface-variant">{t.noPapers}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {mine.map((r) => {
                const open = openPast === r.quizId;
                // ⚠️ Offered only when `items` exists: a sitting saved without it
                // cannot say which question was wrong, and a review marking
                // everything red would be a lie.
                const canReview = !!r.items && Object.keys(r.items).length > 0;
                return (
                  <li key={r.quizId} className="rounded-m3-md border border-outline-variant bg-surface-container-lowest">
                    <div className="flex items-center gap-3 p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black text-on-surface">
                          {r.quizTitle || '—'}
                        </span>
                        <span className="block text-[11px] font-bold text-on-surface-variant">
                          {t.correct}: {r.correct} · {t.wrong}: {r.total - r.correct}
                        </span>
                      </span>
                      <span className="s-num flex-none text-[15px] font-black text-on-surface">
                        {Math.round(r.percent)}%
                      </span>
                      {canReview && (
                        <Button size="sm" variant="text" onClick={() => void toggleReview(r)}>
                          {open ? t.closeReview : t.openReview}
                          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
                        </Button>
                      )}
                    </div>

                    {open && (
                      <div className="border-t border-outline-variant p-3">
                        {openState === 'loading' && <p className="text-[12px] font-bold text-on-surface-variant">…</p>}
                        {openState === 'gone' && <p className="text-[12px] font-bold text-on-surface-variant">{t.reviewGone}</p>}
                        {openState === 'failed' && <p className="text-[12px] font-bold text-error">{t.reviewFailed}</p>}
                        {openState === 'idle' && openQuiz && (
                          // Replay mode: correctness comes from the stored
                          // outcomes, not from live answers (there are none).
                          // ⚠️ `hideAnswers` still holds months later — a teacher
                          // who withheld the key keeps it withheld here.
                          <ExamReview
                            questions={hydrateMilliyQuiz(openQuiz.questions)}
                            answers={{}}
                            examLang={r.examLang}
                            appLang={appLang}
                            hideAnswers={!openQuiz.showAnswers}
                            outcomes={r.items}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
