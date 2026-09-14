'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  CheckCircle, XCircle, AlertTriangle,
  Trophy, Lightbulb, List, Eye, Lock, Clock, Grid
} from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { useStudentLanguage } from '@/app/(student)/layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banner, Button, Card, Chip, EmptyState, Page, PageHeader, SegmentedControl,
  Spinner, StatBand, Tile, cn,
} from '@/components/student-ui';
import { normalizeQuestions, isAnswerCorrect, hasAnswer, gradeQuestion, isPartCorrect, isBlockAnswer, type BlockAnswer } from '@/lib/questionSchema';
import type { NormalizedPart, NormalizedQuestion } from '@/types/question';

// --- TRANSLATION DICTIONARY ---
const RESULTS_TRANSLATIONS: any = {
  uz: {
    loading: "Natijalar yuklanmoqda...", back: "Sinfga qaytish", title: "Natijalar",
    status: { excellent: "Ajoyib Natija!", good: "Yaxshi Harakat", needsWork: "Yaxshilash Kerak" },
    cards: { score: "Ball", right: "To'g'ri", wrong: "Noto'g'ri", questions: "Savollar", review: "Batafsil Ko'rib Chiqish", overview: "Xarita", filters: "Filtr", all: "Barchasi", incorrectOnly: "Faqat Xatolar" },
    question: { skipped: "O'tkazil.", yourAns: "Sizning javob", noSel: "Tanlanmadi", correctAns: "To'g'ri Javob", showOpts: "Variantlar", hideOpts: "Yashirish", viewExp: "Yechim", hideExp: "Yashirish", solution: "Yechim", options: "Barcha Variantlar" },
    block: { parts: "Savol qismlari", points: "ball" },
    blocked: { title: "Ball Saqlandi", result: "Sizning Natijangiz", reason1: "O'qituvchi batafsil ko'rib chiqishni yopgan.", reason2: "Natijalar yashirin: ", btn: "Panelga qaytish" }
  },
  en: {
    loading: "Loading Results...", back: "Back to Class", title: "Results",
    status: { excellent: "Excellent Work!", good: "Good Effort", needsWork: "Needs Improvement" },
    cards: { score: "Score", right: "Right", wrong: "Wrong", questions: "Questions", review: "Review", overview: "Map", filters: "Filters", all: "All", incorrectOnly: "Incorrect Only" },
    question: { skipped: "Skipped", yourAns: "Your Answer", noSel: "None", correctAns: "Correct Answer", showOpts: "Options", hideOpts: "Hide", viewExp: "Solution", hideExp: "Hide", solution: "Step-by-Step Solution", options: "All Options" },
    block: { parts: "Sub-questions", points: "pts" },
    blocked: { title: "Score Recorded", result: "Your Result", reason1: "Review is disabled by the instructor.", reason2: "Results hidden until: ", btn: "Return to Dashboard" }
  },
  ru: {
    loading: "Загрузка...", back: "В класс", title: "Результаты",
    status: { excellent: "Отлично!", good: "Хорошо", needsWork: "Нужно улучшить" },
    cards: { score: "Балл", right: "Верно", wrong: "Неверно", questions: "Вопросы", review: "Обзор", overview: "Карта", filters: "Фильтр", all: "Все", incorrectOnly: "Только ошибки" },
    question: { skipped: "Пропуск", yourAns: "Ваш ответ", noSel: "Нет", correctAns: "Правильный", showOpts: "Варианты", hideOpts: "Скрыть", viewExp: "Решение", hideExp: "Скрыть", solution: "Пошаговое решение", options: "Все варианты" },
    block: { parts: "Подвопросы", points: "балл" },
    blocked: { title: "Балл сохранен", result: "Результат", reason1: "Обзор отключен.", reason2: "Скрыто до: ", btn: "На панель" }
  }
};

// Questions are normalized (lib/questionSchema.ts), so every text field is a
// {uz,ru,en} object — never dump the object itself into the UI: an image-only
// option, and an empty explanation, legitimately carry no text.
const getContentText = (content: any) => {
  if (!content) return "";
  if (typeof content === 'string') return content;
  return content.uz || content.en || content.ru || content.text || "";
};

// An option can carry an image (normalized: `options[letter].imageUrl`), with or
// without text.
const OptionImage = ({ url, alt }: { url?: string | null; alt?: string }) =>
  url ? <img src={url} alt={alt || 'Option'} className="mt-1.5 max-h-24 w-auto rounded-m3-xs border border-outline-variant bg-surface object-contain" /> : null;

// One picked/correct option: letter badge + its text + its image. Used for mcq
// (one line) and multiple_select (one line per letter).
const OptionLine = ({ question, optionKey, tone }: { question: any; optionKey: string; tone: 'ok' | 'bad' }) => (
  <div className="flex items-start gap-2">
    <span className={cn(
      'grid h-6 w-6 shrink-0 place-items-center rounded-m3-xs text-[12px] font-black',
      tone === 'ok' ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container',
    )}>
      {optionKey?.toUpperCase()}
    </span>
    <div className="pt-0.5 text-[13px] font-bold text-on-surface">
      <LatexRenderer latex={getContentText(question.options?.[optionKey])} />
      <OptionImage url={question.options?.[optionKey]?.imageUrl} alt={optionKey} />
    </div>
  </div>
);

// A BLOCK's answer is ONE entry in attempts.answers[qId]: `{ [partId]: value }`.
// It counts as answered as soon as any part is; normal questions keep `hasAnswer`.
const isQuestionAnswered = (q: NormalizedQuestion, given: unknown): boolean => {
  if (q.isBlock) {
    if (!isBlockAnswer(given)) return false;
    return q.parts.some((p) => hasAnswer(given[p.id]));
  }
  return hasAnswer(given as string | string[] | undefined);
};

const toKeys = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const toText = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v ?? ''));

// One sub-question of a block: its label, its prompt, what the student put, what was
// right, and a ✓/✗ from `isPartCorrect` (the same comparator the runner graded with).
const PartReviewRow = ({ part, given, t }: {
  part: NormalizedPart;
  given: string | string[] | undefined;
  t: { question: { yourAns: string; skipped: string; noSel: string; correctAns: string } };
}) => {
  const ok = isPartCorrect(part, given ?? null);
  const answered = hasAnswer(given ?? null);
  const isTyped = part.optionList.length === 0;

  const chosen = toKeys(given);
  const correct = toKeys(part.correctAnswer?.value);
  const optionText = (key: string) => getContentText(part.optionList.find((o) => o.id === key)?.text);

  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-m3-sm border bg-surface-container p-3 text-on-surface',
      ok ? 'border-success' : answered ? 'border-error' : 'border-outline-variant',
    )}>
      <span className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-m3-xs text-[12px] font-black',
        ok ? 'bg-success-container text-on-success-container'
           : answered ? 'bg-error-container text-on-error-container'
           : 'bg-surface-container-high text-on-surface-variant',
      )}>
        {part.id}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="break-words text-[13px] font-bold leading-relaxed">
          <LatexRenderer latex={getContentText(part.prompt)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold">
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
              {answered ? t.question.yourAns : t.question.skipped}
            </span>
            {answered ? (
              <span className={cn('break-words font-black', ok ? 'text-success' : 'text-error')}>
                {isTyped ? toText(given) : chosen.map((k) => `${k}${optionText(k) ? `. ${optionText(k)}` : ''}`).join(', ')}
              </span>
            ) : (
              <span className="italic text-on-surface-variant">{t.question.noSel}</span>
            )}
          </span>

          {!ok && (
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-success">{t.question.correctAns}</span>
              <span className="break-words font-black text-success">
                {isTyped
                  ? toText(part.correctAnswer?.value)
                  : correct.map((k) => `${k}${optionText(k) ? `. ${optionText(k)}` : ''}`).join(', ')}
              </span>
            </span>
          )}
        </div>

        {getContentText(part.explanation) && (
          <div className="break-words pt-0.5 text-[12px] font-bold leading-relaxed text-on-surface-variant">
            <LatexRenderer latex={getContentText(part.explanation)} />
          </div>
        )}
      </div>

      <div className="shrink-0 pt-0.5">
        {ok ? <CheckCircle className="text-success" strokeWidth={2.5} size={16} /> : <XCircle className="text-error" strokeWidth={2.5} size={16} />}
      </div>
    </div>
  );
};

// ==================================================================================
// COMPONENT: Question Card (Compact & Sleek Scale)
// ==================================================================================
const QuestionReviewCard = ({ question, index, studentAnswerKey, t }: any) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);

  const questionText = getContentText(question.question);
  // After normalization `explanation` is ALWAYS a {uz,ru,en} object (truthy even when
  // blank), so read the text first, then fall back to the legacy `solution` field that
  // only ever existed on the raw source doc.
  const explanationText = getContentText(question.explanation) || getContentText(question.raw?.solution);

  // Same comparator the runner graded with (lib/questionSchema.ts) — mcq letter,
  // multiple_select set, typed open/numeric text, or a BLOCK (correct only when every
  // part is). Never re-implement it here.
  const isCorrect = isAnswerCorrect(question, studentAnswerKey);
  const isSkipped = !isQuestionAnswered(question, studentAnswerKey);

  // A BLOCK gets PARTIAL credit — show what it actually earned out of its parts' points.
  const isBlock = !!question.isBlock;
  const blockAnswer: BlockAnswer = isBlockAnswer(studentAnswerKey) ? studentAnswerKey : {};
  const { earned, total } = gradeQuestion(question, studentAnswerKey);

  const isTyped = !isBlock && (question.optionList?.length ?? 0) === 0;   // open / numeric / fill_blank
  const correctValue = question.correctAnswer?.value;
  const correctKeys: string[] = Array.isArray(correctValue) ? correctValue : question.answer ? [question.answer] : [];
  const correctKeySet = new Set(correctKeys);
  const chosenKeys: string[] = Array.isArray(studentAnswerKey) ? studentAnswerKey : studentAnswerKey ? [studentAnswerKey] : [];
  const typedAnswer = Array.isArray(studentAnswerKey) ? studentAnswerKey.join(', ') : String(studentAnswerKey ?? '');
  const typedCorrect = Array.isArray(correctValue) ? correctValue.join(', ') : String(correctValue ?? question.answer ?? '');
  const acceptedAnswers: string[] = question.correctAnswer?.acceptedAnswers || [];

  const borderColor = isCorrect ? 'border-success' : isSkipped ? 'border-outline-variant' : 'border-error';
  const headerBg = isCorrect ? 'bg-success-container text-on-success-container'
    : isSkipped ? 'bg-surface-container text-on-surface'
    : 'bg-error-container text-on-error-container';

  return (
    <Card
      id={`question-${index}`}
      variant="outlined"
      flush
      className={cn('overflow-hidden rounded-m3-md scroll-mt-24', borderColor)}
    >
      {/* HEADER */}
      <div className={cn('flex items-start gap-3 border-b px-4 py-3', borderColor, headerBg)}>
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-m3-xs bg-surface text-[13px] font-black text-on-surface">
          {index + 1}
        </div>
        <div className="flex-1 pt-0.5">
          <div className="text-[14px] font-bold leading-relaxed">
            <LatexRenderer latex={questionText} />
          </div>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="mt-2.5 max-h-60 w-auto rounded-m3-sm border border-outline-variant bg-surface object-contain" />
          )}
          <QuestionCreator creatorName={question.creatorName} correctedBy={question.correctedBy} className="mt-2 opacity-70" />
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {isBlock && (
            <Chip status={isCorrect ? 'success' : earned > 0 ? 'warning' : 'neutral'}>
              <span className="s-num">{earned}/{total}</span> {t.block.points}
            </Chip>
          )}
          {isCorrect ? <CheckCircle strokeWidth={2.5} size={20} /> :
           isSkipped ? <AlertTriangle strokeWidth={2.5} size={20} /> :
           <XCircle strokeWidth={2.5} size={20} />}
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">
        {/* A BLOCK reviews part by part: prompt, what the student put, what was right, ✓/✗. */}
        {isBlock && (
          <div className="mb-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.block.parts}</p>
            {question.parts.map((part: NormalizedPart) => (
              <PartReviewRow key={part.id} part={part} given={blockAnswer[part.id]} t={t} />
            ))}
          </div>
        )}

        {!isBlock && (
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          {/* Student Answer */}
          <div className={cn(
            'flex flex-col gap-1.5 rounded-m3-sm border bg-surface-container p-3',
            isCorrect ? 'border-success' : isSkipped ? 'border-outline-variant' : 'border-error',
          )}>
             <span className={cn(
               'flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em]',
               isCorrect ? 'text-success' : isSkipped ? 'text-on-surface-variant' : 'text-error',
             )}>
               {isCorrect ? <CheckCircle size={12} strokeWidth={3}/> : isSkipped ? <AlertTriangle size={12} strokeWidth={3}/> : <XCircle size={12} strokeWidth={3}/>}
               {isSkipped ? t.question.skipped : t.question.yourAns}
             </span>
             <div className="mt-0.5">
                {isSkipped ? (
                   <span className="text-[13px] font-bold italic text-on-surface-variant">{t.question.noSel}</span>
                ) : isTyped ? (
                   // open / numeric — the student typed this, there is no letter to show.
                   <p className={cn('break-words text-[13px] font-black', isCorrect ? 'text-success' : 'text-error')}>{typedAnswer}</p>
                ) : (
                   <div className="flex flex-col gap-1.5">
                     {chosenKeys.map((k) => <OptionLine key={k} question={question} optionKey={k} tone={isCorrect ? 'ok' : 'bad'} />)}
                   </div>
                )}
             </div>
          </div>

          {/* Correct Answer (If wrong) */}
          {!isCorrect && (
            <div className="flex flex-col gap-1.5 rounded-m3-sm border border-success bg-surface-container p-3">
               <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-success">
                 <CheckCircle size={12} strokeWidth={3} /> {t.question.correctAns}
               </span>
               <div className="mt-0.5">
                  {isTyped ? (
                    <>
                      <p className="break-words text-[13px] font-black text-success">{typedCorrect}</p>
                      {acceptedAnswers.length > 0 && (
                        <p className="mt-1 break-words text-[11px] font-bold text-on-surface-variant">≈ {acceptedAnswers.join(' · ')}</p>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {correctKeys.map((k) => <OptionLine key={k} question={question} optionKey={k} tone="ok" />)}
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
          {!isTyped && !isBlock && (
            <Button
              variant="outlined"
              size="sm"
              onClick={() => setShowAllOptions(!showAllOptions)}
              icon={showAllOptions ? <Eye size={14} strokeWidth={2.5}/> : <List size={14} strokeWidth={2.5}/>}
              className="text-[11px] uppercase tracking-[0.1em]"
            >
              {showAllOptions ? t.question.hideOpts : t.question.showOpts}
            </Button>
          )}

          {explanationText && (
            <Button
              variant={showExplanation ? 'tonal' : 'outlined'}
              size="sm"
              onClick={() => setShowExplanation(!showExplanation)}
              icon={<Lightbulb size={14} strokeWidth={2.5} />}
              className="text-[11px] uppercase tracking-[0.1em]"
            >
              {showExplanation ? t.question.hideExp : t.question.viewExp}
            </Button>
          )}
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {showAllOptions && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 rounded-m3-sm border border-outline-variant bg-surface-container p-3">
                <div className="space-y-1.5">
                  {Object.entries(question.options || {}).map(([key, val]: any) => (
                    // multiple_select has several correct letters — highlight them all.
                    <div key={key} className={cn(
                      'flex items-start gap-2 rounded-m3-xs border p-2',
                      correctKeySet.has(key) ? 'border-success bg-surface' : 'border-outline-variant bg-surface',
                    )}>
                      <span className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-m3-xs text-[11px] font-black',
                        correctKeySet.has(key) ? 'bg-success-container text-on-success-container' : 'bg-surface-container-high text-on-surface-variant',
                      )}>{key}</span>
                      <div className="pt-0.5 text-[13px] font-bold text-on-surface">
                        <LatexRenderer latex={getContentText(val)} />
                        <OptionImage url={val?.imageUrl} alt={key} />
                      </div>
                      {correctKeySet.has(key) && <CheckCircle size={14} strokeWidth={3} className="ml-auto mt-0.5 shrink-0 text-success"/>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {showExplanation && explanationText && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 flex gap-3 rounded-m3-sm bg-primary-container p-4 text-on-primary-container">
                 <Tile tone="primary" size="sm" className="h-7 w-7 bg-surface text-primary"><Lightbulb size={14} strokeWidth={3}/></Tile>
                 <div className="w-full space-y-1 pt-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] opacity-75">{t.question.solution}</p>
                    <div className="text-[13px] font-bold leading-relaxed"><LatexRenderer latex={explanationText} /></div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Card>
  );
};

// ==================================================================================
// MAIN PAGE COMPONENT
// ==================================================================================
export default function TestResultsPage() {
  const { classId, assignmentId } = useParams() as { classId: string; assignmentId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = RESULTS_TRANSLATIONS[lang] || RESULTS_TRANSLATIONS['en'];

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [assignment, setAssignment] = useState<any>(null);

  const [canViewDetails, setCanViewDetails] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  
  // 🟢 NEW: Filter State
  const [filter, setFilter] = useState<'all' | 'incorrect'>('all');

  useEffect(() => {
    if (!user) return;
    async function loadResults() {
      try {
        const attemptsQ = query(collection(db, 'attempts'), where('assignmentId', '==', assignmentId), where('userId', '==', user!.uid));
        const attemptSnap = await getDocs(attemptsQ);
        if (attemptSnap.empty) { router.push(`/classes/${classId}`); return; }
        const attemptDoc = attemptSnap.docs[0].data();
        setAttempt(attemptDoc);

        const testSnap = await getDoc(doc(db, 'custom_tests', attemptDoc.testId));
        if (testSnap.exists()) {
          const test = testSnap.data();
          setTestData(test);
          // 🟢 THE ONLY PLACE questions enter this page. custom_tests.questions[] holds
          // frozen snapshots in BOTH shapes (legacy letter-map + canonical v1 array).
          // Normalizing once here keeps every line below reading the legacy shape:
          // `options[letter]`, `answer` as a letter (which is what attempts store).
          setQuestions(normalizeQuestions(test.questions, lang));
        }

        const assignSnap = await getDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
        if (assignSnap.exists()) setAssignment(assignSnap.data());

      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    }
    loadResults();
  }, [user, assignmentId, classId, router, lang]);

  useEffect(() => {
    if (!testData || !assignment) return;
    const visibility = testData.resultsVisibility || (testData.showResults ? 'always' : 'never');

    if (visibility === 'always') setCanViewDetails(true);
    else if (visibility === 'never') { setCanViewDetails(false); setBlockReason(t.blocked.reason1); }
    else if (visibility === 'after_due') {
      // No due date + 'after_due' means "hold results" (matches the runner) —
      // revealing immediately here would defeat the teacher's setting.
      if (!assignment.dueAt) { setCanViewDetails(false); setBlockReason(t.blocked.reason1); }
      else {
        const now = new Date();
        const dueDate = new Date(assignment.dueAt.seconds * 1000);
        if (now > dueDate) setCanViewDetails(true);
        else {
          setCanViewDetails(false);
          setBlockReason(`${t.blocked.reason2} ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`);
        }
      }
    }
  }, [testData, assignment, t]);

  // 🟢 SMART MAP SCROLLING
  const handleMapClick = (idx: number, qId: string) => {
    const isCorrect = isAnswerCorrect(questions[idx], attempt.answers?.[qId]);
    
    // If they click a correct answer while filtering only incorrects, auto-switch filter back to 'All'
    if (filter === 'incorrect' && isCorrect) {
      setFilter('all');
      setTimeout(() => {
        const el = document.getElementById(`question-${idx}`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      }, 100); 
    } else {
      const el = document.getElementById(`question-${idx}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    }
  };

  if (loading) return (
    <Page className="grid min-h-[70vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size={34} label={t.loading} />
        <p className="text-[14px] font-bold text-on-surface-variant">{t.loading}</p>
      </div>
    </Page>
  );
  if (!attempt || !testData) return null;

  if (!canViewDetails) {
    return (
      <Page className="flex min-h-[80vh] items-center justify-center">
        <Card variant="outlined" className="w-full max-w-md text-center">
          <Tile tone="primary" size="lg" className="mx-auto mb-6 h-16 w-16"><Lock size={28} strokeWidth={2.5}/></Tile>
          <h1 className="s-display text-[24px] font-bold text-on-surface">{t.blocked.title}</h1>
          <div className="mt-6 rounded-m3-md border border-outline-variant bg-surface-container p-6">
             <p className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.blocked.result}</p>
             <p className="s-display s-num text-[44px] font-bold leading-none text-primary">
               {attempt.score}<span className="text-[24px] text-on-surface-variant">/{attempt.totalQuestions}</span>
             </p>
          </div>
          <Banner
            status="warning"
            className="mt-6 text-left"
            icon={<Clock size={18} strokeWidth={2.5} />}
            title={blockReason}
          />
          <Button fullWidth size="lg" className="mt-8" onClick={() => router.push(`/classes/${classId}`)}>
            {t.blocked.btn}
          </Button>
        </Card>
      </Page>
    );
  }

  const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
  const gradeStatus = percentage >= 80 ? 'success' : percentage >= 50 ? 'warning' : 'error';

  // Apply Filter. A block is filtered as ONE question and counts as correct only when
  // fully correct (`isAnswerCorrect`), so the chips below count QUESTIONS — while
  // attempt.score / attempt.totalQuestions are POINTS (identical numbers unless a block
  // took partial credit).
  const filteredQuestions = questions.filter((q) => filter === 'all' || !isAnswerCorrect(q, attempt.answers?.[q.id]));
  const questionCount = questions.length || attempt.totalQuestions;
  const wrongCount = questions.filter((q) => !isAnswerCorrect(q, attempt.answers?.[q.id])).length;

  return (
    <Page width="wide">

      <PageHeader
        title={testData.title}
        onBack={() => router.push(`/classes/${classId}`)}
        actions={
          <Chip status={gradeStatus} size="md" icon={<Trophy size={14} strokeWidth={3} />}>
            <span className="s-num">{percentage}%</span>
          </Chip>
        }
      />

      {/* 🟢 TWO-COLUMN DASHBOARD LAYOUT */}
      <div className="flex flex-col-reverse gap-6 lg:flex-row md:gap-8">

        {/* LEFT COLUMN: Questions (flex-1) */}
        <div className="min-w-0 flex-1 space-y-4">

          {/* Quick Filters */}
          <SegmentedControl
            label={t.cards.filters}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `${t.cards.all} (${questionCount})` },
              { value: 'incorrect', label: `${t.cards.incorrectOnly} (${wrongCount})` },
            ]}
            className="max-w-full flex-wrap"
          />

          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              // We need the ORIGINAL index for numbering and scrolling
              const originalIndex = questions.findIndex((origQ) => origQ.id === q.id);
              return (
                <QuestionReviewCard key={q.id} question={q} index={originalIndex} studentAnswerKey={attempt.answers?.[q.id]} t={t} />
              );
            })}

            {filteredQuestions.length === 0 && (
              <Card variant="outlined">
                <EmptyState icon="🎯" title="Perfect score! No incorrect questions." />
              </Card>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar (Stats + Map) */}
        <div className="w-full shrink-0 lg:w-[320px]">
          <div className="flex flex-col gap-4 sm:flex-row lg:sticky lg:top-24 lg:flex-col md:gap-6">

            {/* SCORE HERO */}
            <StatBand
              className="flex-1 lg:flex-none"
              stats={[
                { label: t.cards.score, value: `${attempt.score}/${attempt.totalQuestions}` },
                { label: t.cards.right, value: attempt.score },
                { label: t.cards.wrong, value: attempt.totalQuestions - attempt.score },
              ]}
            />

            {/* OVERVIEW MATRIX (MAP) */}
            <Card variant="outlined" className="flex-1 lg:flex-none">
               <h3 className="mb-4 flex items-center gap-2 text-[14px] font-black uppercase tracking-[0.12em] text-on-surface">
                 <Grid size={16} strokeWidth={3} className="text-primary"/> {t.cards.overview}
               </h3>
               <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {questions.map((q, idx: number) => {
                     // A block is "correct" only when every part is — `isAnswerCorrect` already does that.
                     const isCorrect = isAnswerCorrect(q, attempt.answers?.[q.id]);
                     const isSkipped = !isQuestionAnswered(q, attempt.answers?.[q.id]);

                     let style = "bg-error-container text-on-error-container border-error";
                     if (isCorrect) style = "bg-success-container text-on-success-container border-success";
                     else if (isSkipped) style = "bg-surface-container-high text-on-surface-variant border-outline-variant";

                     // Dim the correct ones if filter is active, but keep them clickable
                     const isDimmed = filter === 'incorrect' && isCorrect;

                     return (
                       <button
                         key={idx}
                         onClick={() => handleMapClick(idx, q.id)}
                         aria-label={`${t.cards.questions} ${idx + 1}`}
                         className={cn(
                           's-num s-press grid h-8 w-8 place-items-center rounded-m3-xs border text-[12px] font-black md:h-[38px] md:w-[38px] md:text-[13px]',
                           style,
                           isDimmed && 'opacity-30 hover:opacity-100',
                         )}
                       >
                         {idx + 1}
                       </button>
                     )
                  })}
               </div>
            </Card>

          </div>
        </div>

      </div>
    </Page>
  );
}