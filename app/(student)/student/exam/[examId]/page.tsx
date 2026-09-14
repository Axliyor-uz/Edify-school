'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Clock, AlertTriangle, CheckCircle2, ShieldAlert,
  Lock, FileBadge, ChevronDown
} from 'lucide-react';
import {
  Banner, Button, Card, Chip, ConfirmDialog, Page, Spinner,
  TextArea, TextField, Tile, cn, sToast,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// --- TRANSLATIONS ---
const EXAM_TRANSLATIONS: any = {
  uz: {
    loading: "Imtihon yuklanmoqda...",
    errorGeneric: "Xatolik yuz berdi",
    closed: { title: "Imtihon yopilgan", desc: "Bu imtihon vaqti tugagan yoki hali boshlanmagan.", back: "Ortga qaytish" },
    submitted: { title: "Qabul qilindi!", desc: "Javoblaringiz muvaffaqiyatli saqlandi. Natijalarni o'qituvchi e'lon qilganda ko'rishingiz mumkin.", back: "Asosiy sahifaga qaytish" },
    waiting: { rules: "Qat'iy Qoidalar", rule1: "Testni boshlaganingizdan so'ng vaqt to'xtamaydi.", rule2: "Oynani (tab) almashtirish yoki yopish taqiqlanadi. Tizim buni avtomatik hisoblaydi.", rule3: "Vaqt tugaganda javoblar avtomatik yuboriladi.", start: "Tushundim, Boshlash", early: "Imtihon hali boshlanmagan.", minutes: "Daqiqa" },
    active: { warning: "Ogohlantirish! Oynani tark etdingiz. Bu ustozga xabar qilinadi.", focusLost: "Diqqat yo'qotildi", submitConfirm: "Barcha javoblarni yubormoqchimisiz? Buning ortiga qaytib bo'lmaydi.", submitAuto: "Vaqt tugadi! Javoblar avtomatik yuborilmoqda...", finish: "Yakunlash va Yuborish", saving: "Saqlanmoqda...", cancel: "Bekor qilish", confirm: "Topshirish", confirmTitle: "Testni yakunlaysizmi?", points: "Ball", trueLabel: "Rost", falseLabel: "Yolg'on", shortAnswerLabel: "Javobingizni yozing...", openEndedLabel: "Batafsil yechim yoki javobni yozing...", alreadySubmitted: "Siz allaqachon topshirgansiz!", questionsCount: (n: number) => `${n} Savol`, submitError: (msg: string) => `Xatolik: ${msg}` }
  },
  en: {
    loading: "Loading Exam...",
    errorGeneric: "Something went wrong",
    closed: { title: "Exam Closed", desc: "The exam time has ended or hasn't started yet.", back: "Go Back" },
    submitted: { title: "Submitted!", desc: "Your answers have been saved. You can view results when the teacher releases them.", back: "Return to Dashboard" },
    waiting: { rules: "Strict Rules", rule1: "Timer does not stop once started.", rule2: "Switching tabs is prohibited and tracked.", rule3: "Answers auto-submit when time is up.", start: "I Understand, Start", early: "Exam hasn't started yet.", minutes: "Minutes" },
    active: { warning: "Warning! You left the tab. This will be reported.", focusLost: "Focus Lost", submitConfirm: "Submit all answers? This cannot be undone.", submitAuto: "Time's up! Auto-submitting answers...", finish: "Finish and Submit", saving: "Saving...", cancel: "Cancel", confirm: "Submit", confirmTitle: "Finish the test?", points: "Points", trueLabel: "True", falseLabel: "False", shortAnswerLabel: "Type your answer...", openEndedLabel: "Write your detailed solution or answer...", alreadySubmitted: "You have already submitted!", questionsCount: (n: number) => `${n} Questions`, submitError: (msg: string) => `Error: ${msg}` }
  },
  ru: {
    loading: "Загрузка экзамена...",
    errorGeneric: "Произошла ошибка",
    closed: { title: "Экзамен закрыт", desc: "Время экзамена истекло или еще не началось.", back: "Вернуться" },
    submitted: { title: "Принято!", desc: "Ваши ответы сохранены. Результаты будут доступны после публикации учителем.", back: "На главную" },
    waiting: { rules: "Строгие правила", rule1: "Таймер не останавливается после старта.", rule2: "Переключение вкладок запрещено и отслеживается.", rule3: "Ответы отправляются автоматически по истечении времени.", start: "Понятно, Начать", early: "Экзамен еще не начался.", minutes: "Минут" },
    active: { warning: "Внимание! Вы покинули вкладку. Это будет зафиксировано.", focusLost: "Потеря фокуса", submitConfirm: "Отправить все ответы? Это действие необратимо.", submitAuto: "Время вышло! Автоматическая отправка...", finish: "Завершить и Отправить", saving: "Сохранение...", cancel: "Отмена", confirm: "Сдать", confirmTitle: "Завершить тест?", points: "Балл", trueLabel: "Верно", falseLabel: "Неверно", shortAnswerLabel: "Введите ваш ответ...", openEndedLabel: "Напишите подробное решение или ответ...", alreadySubmitted: "Вы уже сдали работу!", questionsCount: (n: number) => `${n} Вопросов`, submitError: (msg: string) => `Ошибка: ${msg}` }
  }
};

// 🟢 BULLETPROOF LATEX RENDERER
const FormattedText = ({ text }: { text: any }) => {
  if (!text) return null;
  let content = typeof text === 'string' ? text : JSON.stringify(text);
  const hasMathCommands = /\\frac|\\pi|\\sin|\\cos|\\tan|\\ge|\\le|\\cup|\\cap|\\in|\\begin|\\sqrt|\\empty/.test(content);
  if (!content.includes('$') && hasMathCommands) content = `$${content}$`;
  content = content.replace(/\\\((.*?)\\\)/g, '$$$1$$').replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$').replace(/&nbsp;/g, ' ').replace(/\\\\/g, '\\');

  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  // Deliberately colorless — every caller sets its own text token, and a
  // selected option needs the math to flip to the container's on-color too.
  return (
    <span className="inline-block break-words leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="s-scroll my-2 block overflow-x-auto" />;
          } catch (e) { return <span key={index} className="rounded bg-error-container px-1 font-mono text-[13px] text-on-error-container">{part}</span>; }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="inline-block px-1" />;
          } catch (e) { return <span key={index} className="rounded bg-error-container px-1 font-mono text-[13px] text-on-error-container">{part}</span>; }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
function ExamPlayerContent() {
  const { examId } = useParams() as { examId: string };
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = EXAM_TRANSLATIONS[lang] || EXAM_TRANSLATIONS['en'];

  const [loading, setLoading] = useState(true);
  const [examState, setExamState] = useState<'loading' | 'waiting' | 'active' | 'submitted' | 'closed'>('loading');

  const [examData, setExamData] = useState<any>(null);
  const [testTemplate, setTestTemplate] = useState<any>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false); // 🟢 NEW MODAL STATE

  useEffect(() => {
    if (!user || !examId || !classId) return;

    const fetchExam = async () => {
      try {
        const examSnap = await getDoc(doc(db, 'classes', classId, 'exams', examId));
        if (!examSnap.exists()) { setExamState('closed'); return; }

        const eData = examSnap.data();

        if (eData.submittedStudentIds?.includes(user.uid)) {
          setExamState('submitted');
          setLoading(false); return;
        }

        const now = new Date();
        const startTime = eData.examDate.toDate();
        const endTime = new Date(startTime.getTime() + eData.durationMinutes * 60000);

        if (now > endTime) {
          setExamState('closed');
        } else {
          setExamState('waiting');
          setExamData(eData);
          const templateSnap = await getDoc(doc(db, 'bsb_chsb_tests', eData.testId));
          setTestTemplate(templateSnap.data());
        }
      } catch (error) {
        sToast.error(t.errorGeneric);
        setExamState('closed');
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId, classId, user]);

  useEffect(() => {
    if (examState !== 'active') return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
        sToast.error(t.active.warning);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [examState, t.active.warning]);

  useEffect(() => {
    if (examState !== 'active') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examState]);

  useEffect(() => {
    if (timeLeft === 0 && examState === 'active' && !isSubmitting) {
      sToast.info(t.active.submitAuto);
      setShowSubmitModal(false);
      submitExam();
    }
  }, [timeLeft, examState, isSubmitting]);

  const handleStartExam = () => {
    if (!examData) return;
    const now = new Date();
    const startTime = examData.examDate.toDate();
    const endTime = new Date(startTime.getTime() + examData.durationMinutes * 60000);

    if (now < startTime) return sToast.error(t.waiting.early);

    const remainingSeconds = Math.floor((endTime.getTime() - now.getTime()) / 1000);
    if (remainingSeconds <= 0) { setExamState('closed'); return; }

    setTimeLeft(remainingSeconds);
    setExamState('active');
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitExam = async () => {
    if (isSubmitting || !user || !testTemplate || !examData || !classId) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      const attemptId = `${user.uid}_${examId}`;
      const attemptRef = doc(db, 'attempts', attemptId);
      const [freshExamSnap, freshAttemptSnap] = await Promise.all([ getDoc(doc(db, 'classes', classId, 'exams', examId)), getDoc(attemptRef) ]);

      if (freshExamSnap.data()?.submittedStudentIds?.includes(user.uid) || freshAttemptSnap.exists()) {
        sToast.success(t.active.alreadySubmitted);
        setExamState('submitted'); return;
      }

      let autoScore = 0;
      const autoQuestionScores: Record<string, number> = {};
      testTemplate.questions.forEach((q: any) => {
        let qScore = 0;
        const sAns = answers[q.id];
        if (sAns !== undefined) {
          if (q.type === 'mcq' || q.type === 'true_false') {
            if (sAns === q.answer) qScore = q.points;
          } else if (q.type === 'short_answer') {
             const cleanS = String(sAns).trim().toLowerCase();
             const cleanC = String(q.answer?.uz || q.answer).trim().toLowerCase();
             if (cleanS === cleanC) qScore = q.points;
          } else if (q.type === 'matching') {
             let correctMatches = 0;
             const totalPairs = q.pairs.length;
             q.pairs.forEach((p: any) => {
               const leftText = p.left?.uz || p.left;
               const rightText = p.right?.uz || p.right;
               if (sAns[leftText] === rightText) correctMatches += 1;
             });
             if (totalPairs > 0) qScore = Number(((correctMatches / totalPairs) * q.points).toFixed(1));
          }
        }
        autoQuestionScores[q.id] = qScore;
        autoScore += qScore;
      });

      const cleanAnswers = Object.fromEntries(Object.entries(answers).filter(([_, v]) => v !== undefined));

      // AUTO-RELEASE: an exam with no open_ended questions is fully auto-gradable
      // — publish the grade immediately in the exact shape the teacher's save
      // writes (manualScores + teacherScore + status:'graded'), so the review
      // page and ExamsTab work unchanged and a teacher re-grade simply overwrites.
      // With open_ended questions the attempt stays pending as before.
      const needsManualGrading = testTemplate.questions.some((q: any) => q.type === 'open_ended');

      await setDoc(attemptRef, {
        userId: user.uid, userName: user.displayName || 'Student', classId, assignmentId: examId, type: 'exam',
        testId: examData.testId, answers: cleanAnswers,
        autoScore: needsManualGrading ? autoScore : 0,
        teacherScore: needsManualGrading ? 0 : autoScore,
        totalPoints: testTemplate.totalPoints || 0, tabSwitches: tabSwitches || 0, submittedAt: serverTimestamp(),
        ...(needsManualGrading ? {} : { manualScores: autoQuestionScores, status: 'graded' }),
      });

      await updateDoc(doc(db, 'classes', classId, 'exams', examId), { submittedStudentIds: arrayUnion(user.uid) });
      setExamState('submitted');
    } catch (error: any) {
      sToast.error(t.active.submitError(error.message));
      setIsSubmitting(false);
    }
  };

  if (loading || examState === 'loading') return (
    <Page width="full" className="grid min-h-[70vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size={34} label={t.loading} />
        <p className="text-[14px] font-bold text-on-surface-variant">{t.loading}</p>
      </div>
    </Page>
  );

  if (examState === 'closed') return (
    <Page width="full" className="flex min-h-[80vh] items-center justify-center">
      <Card variant="outlined" className="w-full max-w-sm space-y-6 text-center">
        <Tile tone="neutral" size="lg" className="mx-auto h-16 w-16 rounded-full">
          <Lock size={32} strokeWidth={2.5} />
        </Tile>
        <div>
          <h2 className="s-display text-[20px] font-bold text-on-surface">{t.closed.title}</h2>
          <p className="mt-2 text-[13px] font-bold text-on-surface-variant">{t.closed.desc}</p>
        </div>
        <Button fullWidth size="lg" onClick={() => router.push(`/classes/${classId}`)}>{t.closed.back}</Button>
      </Card>
    </Page>
  );

  if (examState === 'submitted') return (
    <Page width="full" className="flex min-h-[80vh] items-center justify-center">
      <Card variant="outlined" className="w-full max-w-sm space-y-6 text-center">
        <Tile tone="success" size="lg" className="mx-auto h-20 w-20 rounded-m3-lg">
          <CheckCircle2 size={40} strokeWidth={3} />
        </Tile>
        <div>
          <h2 className="s-display text-[24px] font-bold text-on-surface">{t.submitted.title}</h2>
          <p className="mt-2 text-[13px] font-bold leading-relaxed text-on-surface-variant">{t.submitted.desc}</p>
        </div>
        <Button fullWidth size="lg" tone="success" onClick={() => router.push(`/classes/${classId}`)}>{t.submitted.back}</Button>
      </Card>
    </Page>
  );

  if (examState === 'waiting') return (
    <Page width="full" className="flex min-h-[80vh] items-center justify-center">
      <Card variant="outlined" className="w-full max-w-lg space-y-6 text-center">
        <Tile tone="primary" size="lg" className="mx-auto h-16 w-16">
          <FileBadge size={32} strokeWidth={2.5} />
        </Tile>
        <div>
          <h1 className="s-display text-[24px] font-bold leading-tight text-on-surface md:text-[28px]">{examData?.title}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Chip status="primary" className="uppercase tracking-[0.1em]">{examData?.assessmentType}</Chip>
            <Chip className="uppercase tracking-[0.1em]">
              <span className="s-num">{examData?.durationMinutes}</span> {t.waiting.minutes}
            </Chip>
          </div>
        </div>
        <Banner
          status="error"
          className="text-left"
          icon={<AlertTriangle size={22} strokeWidth={2.5} />}
          title={t.waiting.rules}
          description={
            <ul className="list-inside list-disc space-y-1">
              <li>{t.waiting.rule1}</li>
              <li>{t.waiting.rule2}</li>
              <li>{t.waiting.rule3}</li>
            </ul>
          }
        />
        <Button fullWidth size="lg" onClick={handleStartExam}>{t.waiting.start}</Button>
      </Card>
    </Page>
  );

  return (
    // Full-bleed so the exam chrome meets the shell edges. `!p-0` is required —
    // tailwind-merge cannot dedupe Page's own px-s-page-x / py-s-page-y.
    <Page width="full" className="!p-0 selection:bg-primary-container">

      <ConfirmDialog
        open={showSubmitModal}
        onCancel={() => setShowSubmitModal(false)}
        onConfirm={submitExam}
        title={t.active.confirmTitle}
        description={t.active.submitConfirm}
        confirmLabel={t.active.confirm}
        cancelLabel={t.active.cancel}
        loading={isSubmitting}
        icon={
          <Tile tone="primary" size="lg" className="h-16 w-16">
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </Tile>
        }
      />

      {/* Sits directly under the shell topbar, which is itself sticky at top-0. */}
      <header className="sticky top-[var(--s-topbar-h)] z-30 flex items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-3">
        <div className="flex min-w-0 flex-col pr-2">
          <h1 className="s-display truncate text-[14px] font-bold text-on-surface md:text-[16px]">{testTemplate?.title}</h1>
          <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant md:text-[11px]">
            {testTemplate?.assessmentType} • {t.active.questionsCount(testTemplate?.questions?.length ?? 0)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          {tabSwitches > 0 && (
            <Chip status="error" icon={<ShieldAlert size={14} strokeWidth={3} />} className="hidden uppercase tracking-[0.1em] sm:inline-flex">
              {t.active.focusLost}: {tabSwitches}
            </Chip>
          )}
          <div className={cn(
            'flex items-center gap-2 rounded-m3-sm border px-3 py-1.5 text-[16px] font-black sm:px-4 sm:py-2 sm:text-[18px]',
            'transition-colors duration-m3-fast ease-m3-std',
            timeLeft !== null && timeLeft < 300
              ? 'animate-pulse border-error bg-error-container text-on-error-container'
              : 'border-outline-variant bg-surface-container text-on-surface',
          )}>
            <Clock size={18} strokeWidth={3} />
            <span className="s-num">
              {timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : '--:--'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-s-page-x py-s-page-y md:space-y-8">
        {testTemplate?.questions?.map((q: any, idx: number) => (
          <Card key={q.id} variant="outlined">

            <div className="mb-4 flex items-center gap-2 md:mb-5">
              <span className="s-num shrink-0 rounded-m3-xs bg-inverse-surface px-3 py-1 text-[12px] font-black text-inverse-on-surface">{idx + 1}</span>
              <Chip className="uppercase tracking-[0.12em]"><span className="s-num">{q.points}</span> {t.active.points}</Chip>
            </div>

            <h3 className="mb-6 text-[15px] font-bold leading-relaxed text-on-surface md:text-[17px]">
              <FormattedText text={q.question?.uz || q.question} />
            </h3>

            {q.type === 'mcq' && <McqRenderer question={q} value={answers[q.id]} onChange={(val: any) => handleAnswerChange(q.id, val)} />}
            {q.type === 'true_false' && <TrueFalseRenderer value={answers[q.id]} onChange={(val: any) => handleAnswerChange(q.id, val)} t={t} />}
            {q.type === 'short_answer' && <ShortAnswerRenderer value={answers[q.id]} onChange={(val: any) => handleAnswerChange(q.id, val)} t={t} />}
            {q.type === 'open_ended' && <OpenEndedRenderer value={answers[q.id]} onChange={(val: any) => handleAnswerChange(q.id, val)} t={t} />}
            {q.type === 'matching' && <MatchingRenderer question={q} value={answers[q.id] || {}} onChange={(val: any) => handleAnswerChange(q.id, val)} />}
          </Card>
        ))}

        <div className="pb-8 pt-2">
          <Button
            fullWidth
            size="lg"
            loading={isSubmitting}
            icon={<CheckCircle2 size={20} strokeWidth={3} />}
            onClick={() => setShowSubmitModal(true)} // 🟢 Trigger Custom Modal
          >
            {isSubmitting ? t.active.saving : t.active.finish}
          </Button>
        </div>
      </main>
    </Page>
  );
}

export default function StudentExamPlayer() {
  return (
    <Suspense fallback={
      <Page width="full" className="grid min-h-[70vh] place-items-center">
        <Spinner size={34} />
      </Page>
    }>
      <ExamPlayerContent />
    </Suspense>
  );
}

// ============================================================================
// 🎯 QUESTION RENDERERS
// ============================================================================

const McqRenderer = ({ question, value, onChange }: any) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Object.entries(question.options || {}).sort(([a],[b]) => a.localeCompare(b)).map(([key, opt]) => {
        const isSelected = value === key;
        return (
          <button
            key={key} onClick={() => onChange(key)}
            aria-pressed={isSelected}
            className={cn(
              's-press flex items-start rounded-m3-md border p-3 text-left md:p-4',
              'transition-colors duration-m3-fast ease-m3-std',
              isSelected
                ? 'border-primary bg-primary-container text-on-primary-container'
                : 'border-outline-variant bg-surface text-on-surface hover:bg-state-hover',
            )}
          >
            <div className={cn(
              'mr-3 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-m3-xs border text-[13px] font-black',
              isSelected
                ? 'border-primary bg-primary text-on-primary'
                : 'border-outline-variant bg-surface-container-high text-on-surface-variant',
            )}>{key}</div>
            <div className="min-w-0 pt-1 text-[14px] font-bold leading-snug md:text-[15px]">
              <FormattedText text={(opt as any)?.uz || opt as string} />
            </div>
          </button>
        );
      })}
    </div>
  );
};

const TrueFalseRenderer = ({ value, onChange, t }: any) => {
  const base = 's-press flex-1 rounded-m3-md border py-4 text-[15px] font-black transition-colors duration-m3-fast ease-m3-std';
  const on = 'border-primary bg-primary-container text-on-primary-container';
  const off = 'border-outline-variant bg-surface text-on-surface-variant hover:bg-state-hover';

  return (
    <div className="flex gap-3">
      <button onClick={() => onChange(true)} aria-pressed={value === true} className={cn(base, value === true ? on : off)}>{t.active.trueLabel}</button>
      <button onClick={() => onChange(false)} aria-pressed={value === false} className={cn(base, value === false ? on : off)}>{t.active.falseLabel}</button>
    </div>
  );
};

const ShortAnswerRenderer = ({ value, onChange, t }: any) => {
  return <TextField label={t.active.shortAnswerLabel} autoComplete="off" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
};

const OpenEndedRenderer = ({ value, onChange, t }: any) => {
  return <TextArea label={t.active.openEndedLabel} rows={5} value={value || ''} onChange={(e) => onChange(e.target.value)} className="s-scroll" />;
};

// 🟢 NEW: Custom Dropdown Component for LaTeX Support
const MatchingDropdown = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative flex-1 md:max-w-[50%]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between rounded-m3-sm border bg-surface p-3 text-left text-[13px] font-bold md:p-4 md:text-[14px]',
          'transition-colors duration-m3-fast ease-m3-std',
          isOpen ? 'border-primary' : 'border-outline-variant hover:bg-state-hover',
          value ? 'text-on-surface' : 'text-on-surface-variant',
        )}
      >
        <span className="truncate pr-2">
          {value ? <FormattedText text={value} /> : "Mosini tanlang..."}
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-on-surface-variant transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="s-scroll absolute left-0 right-0 top-[calc(100%_+_8px)] z-50 max-h-[250px] overflow-y-auto rounded-m3-sm border border-outline-variant bg-surface-container-high p-1.5 shadow-elev-3">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { onChange(opt); setIsOpen(false); }}
                className={cn(
                  'mb-1 w-full rounded-m3-xs p-3 text-left text-[13px] font-bold last:mb-0 md:text-[14px]',
                  'transition-colors duration-m3-fast ease-m3-std',
                  value === opt
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface hover:bg-state-hover',
                )}
              >
                <FormattedText text={opt} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const MatchingRenderer = ({ question, value, onChange }: any) => {
  const shuffledOptions = useMemo(() => {
    if (!question.pairs) return [];
    const rights = question.pairs.map((p: any) => p.right?.uz || p.right);
    return rights.sort(() => Math.random() - 0.5);
  }, [question.pairs]);

  return (
    <div className="space-y-3">
      {question.pairs?.map((pair: any, i: number) => {
        const leftText = pair.left?.uz || pair.left;
        return (
          <div key={i} className="flex flex-col gap-2 rounded-m3-md border border-outline-variant bg-surface-container p-3 sm:flex-row sm:gap-3">
            <div className="flex flex-1 items-center rounded-m3-sm border border-outline-variant bg-surface p-3 text-[13px] font-bold text-on-surface md:p-4 md:text-[14px]">
              <FormattedText text={leftText} />
            </div>

            <div className="flex shrink-0 rotate-90 items-center justify-center font-black text-outline sm:rotate-0">➔</div>

            {/* 🟢 CUSTOM LATEX DROPDOWN INJECTED HERE */}
            <MatchingDropdown
              options={shuffledOptions}
              value={value[leftText] || ""}
              onChange={(newVal) => onChange({ ...value, [leftText]: newVal })}
            />
          </div>
        );
      })}
    </div>
  );
};
