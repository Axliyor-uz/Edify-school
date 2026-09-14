'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom'; // 🟢 ADDED PORTAL
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  X, FileText, Calendar, Clock, AlertCircle,
  ChevronRight, ArrowLeft, CheckCircle, XCircle,
  ShieldAlert, ShieldCheck, Target, UserCircle
} from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { normalizeQuestions, getText, isAnswerCorrect, isPartCorrect, gradeQuestion, isBlockAnswer } from '@/lib/questionSchema';
import type { NormalizedQuestion } from '@/types/question';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, ProgressBar, Spinner, StatusChip } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const STUDENT_MODAL_TRANSLATIONS = {
  uz: {
    historyTitle: "Topshiriqlar Tarixi", loading: "Yuklanmoqda...", loadingData: "Ma'lumotlar olinmoqda...",
    empty: "Hozircha topshiriqlar yo'q.", review: "Urinishni Ko'rish", late: "Kechikkan", due: "Muddat",
    noDeadline: "Muddat yo'q", missing: "Topshirilmagan", pending: "Kutilmoqda", performance: "Natijalar",
    correct: "To'g'ri", integrity: "Xavfsizlik", switches: "Oyna almashish", focusLost: "Diqqat yo'qotildi.",
    focusKept: "Diqqat bilan ishladi.", submissionInfo: "Ma'lumot", attempt: "Urinish", analysis: "Tahlil",
    studentAns: "O'quvchi Javobi", correctAns: "To'g'ri Javob", skipped: "O'tkazib yuborilgan", viewProfile: "Profilni Ko'rish",
    unknown: "Noma'lum o'quvchi"
  },
  en: {
    historyTitle: "Assignment History", loading: "Loading...", loadingData: "Retrieving Data...",
    empty: "No assignments yet.", review: "Review Attempt", late: "Late", due: "Due",
    noDeadline: "No Deadline", missing: "Missing", pending: "Pending", performance: "Performance",
    correct: "Correct", integrity: "Integrity", switches: "Tab Switches", focusLost: "Focus lost.",
    focusKept: "Stayed focused.", submissionInfo: "Info", attempt: "Attempt", analysis: "Analysis",
    studentAns: "Student Answer", correctAns: "Correct Answer", skipped: "Skipped", viewProfile: "View Profile",
    unknown: "Unknown Student"
  },
  ru: {
    historyTitle: "История Заданий", loading: "Загрузка...", loadingData: "Получение данных...",
    empty: "Заданий пока нет.", review: "Обзор Попытки", late: "Поздно", due: "Срок",
    noDeadline: "Без срока", missing: "Отсутствует", pending: "В ожидании", performance: "Результаты",
    correct: "Верно", integrity: "Честность", switches: "Переключений", focusLost: "Потеря фокуса.",
    focusKept: "Был сосредоточен.", submissionInfo: "Инфо", attempt: "Попытка", analysis: "Анализ",
    studentAns: "Ответ Ученика", correctAns: "Правильный Ответ", skipped: "Пропущено", viewProfile: "Смотреть Профиль",
    unknown: "Неизвестный ученик"
  }
};

// Trilingual text → a display string. Uses the schema helper so an image-only
// option (empty {uz,ru,en}) yields "" instead of a JSON dump.
const getContentText = (content: any) => getText(content);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  assignments: any[]; 
  classId: string; 
}

const PAGE_SIZE = 10;

export default function StudentDetailsModal({ isOpen, onClose, student, assignments = [], classId }: Props) {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = STUDENT_MODAL_TRANSLATIONS[lang] || STUDENT_MODAL_TRANSLATIONS['en'];

  // 🟢 SSR HYDRATION FIX FOR PORTAL
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // --- STATE ---
  const [attemptsMap, setAttemptsMap] = useState<Record<string, any>>({});
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  
  // Pagination State
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Drill-down State
  const [viewingAttempt, setViewingAttempt] = useState<any>(null);
  // `questions` here is ALWAYS the normalized view model — this modal is read-only.
  const [fullTestData, setFullTestData] = useState<{ questions: NormalizedQuestion[] } | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);

  // Filter assignments relevant to this student
  const relevantAssignments = assignments.filter(a => 
    !Array.isArray(a.assignedTo) || a.assignedTo.includes(student?.uid)
  );

  const visibleAssignments = relevantAssignments.slice(0, displayCount);
  const hasMore = displayCount < relevantAssignments.length;

  // --- FETCH ATTEMPTS ---
  useEffect(() => {
    if (isOpen && student && classId) {
      const fetchStudentGrades = async () => {
        setLoadingAttempts(true);
        try {
          const q = query(
            collection(db, 'attempts'),
            where('classId', '==', classId),
            where('userId', '==', student.uid)
          );
          const snap = await getDocs(q);
          const newMap: Record<string, any> = {};
          
          snap.forEach(doc => {
            const data = doc.data();
            newMap[data.assignmentId] = { id: doc.id, ...data };
          });
          
          setAttemptsMap(newMap);
        } catch (e) {
          console.error("Failed to load student grades", e);
        } finally {
          setLoadingAttempts(false);
        }
      };
      fetchStudentGrades();
      setDisplayCount(PAGE_SIZE);
    } else {
      setAttemptsMap({});
      setViewingAttempt(null);
      setFullTestData(null);
    }
  }, [isOpen, student, classId]);

  // --- INFINITE SCROLL OBSERVER ---
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setDisplayCount(prev => prev + PAGE_SIZE);
      }
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [hasMore]);

  // --- HANDLERS ---
  const handleViewDetails = async (attempt: any) => {
    setLoadingTest(true);
    setViewingAttempt(attempt);
    try {
      const testRef = doc(db, 'custom_tests', attempt.testId);
      const testSnap = await getDoc(testRef);
      if (testSnap.exists()) {
        // Normalization boundary: the frozen snapshots in custom_tests.questions[]
        // may be legacy-shaped or canonical v1. The answer-analysis below compares
        // `studentAnswer === q.answer` and reads `q.options[letter]`, so normalize
        // once here and the compare/render logic keeps working untouched.
        const data = testSnap.data() as any;
        setFullTestData({ questions: normalizeQuestions(data?.questions, lang) });
      } else {
        setFullTestData({ questions: [] });
      }
    } catch (error) {
      setFullTestData({ questions: [] });
    } finally {
      setLoadingTest(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // 🟢 COMBINED MOUNTED & OPEN CHECK
  if (!mounted || !isOpen || !student) return null;

  // 🟢 WRAPPED IN CREATE PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      
      {/* OVERLAY */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 🟢 ULTRA MINIMALISTIC MOBILE-FIRST MODAL */}
      <div className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-3xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 fade-in duration-300 shadow-elev-3 border border-outline-variant">

        {/* --- HEADER --- */}
        <div className="px-5 py-4 border-b border-outline-variant bg-[color-mix(in_oklab,var(--m3-surface-container-low)_90%,transparent)] backdrop-blur-xl flex justify-between items-center shrink-0 z-20 shadow-elev-1">
          <div className="flex items-center gap-3 min-w-0">
             {viewingAttempt ? (
               <button onClick={() => { setViewingAttempt(null); setFullTestData(null); }} className="w-9 h-9 md:w-10 md:h-10 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-m3-md flex items-center justify-center text-on-surface-variant transition-all shrink-0 active:scale-95">
                 <ArrowLeft size={18} strokeWidth={2.5}/>
               </button>
             ) : (
               <div className="w-10 h-10 md:w-12 md:h-12 bg-primary text-on-primary rounded-m3-md flex items-center justify-center font-black text-[16px] md:text-[18px] shadow-elev-1 shrink-0">
                 {student.displayName?.[0]?.toUpperCase() || 'S'}
               </div>
             )}

             <div className="min-w-0 pr-2">
               <h2 className="text-[16px] md:text-[18px] font-black text-on-surface tracking-tight truncate leading-tight">
                 {viewingAttempt ? t.review : (student.displayName || t.unknown)}
               </h2>
               <p className="text-[11px] md:text-[12px] text-on-surface-variant font-bold uppercase tracking-widest mt-0.5 truncate">
                 {viewingAttempt ? viewingAttempt.testTitle : `@${student.username || 'student'}`}
               </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-full text-on-surface-variant hover:text-on-surface transition-colors shrink-0 active:scale-95">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* --- SCROLLABLE BODY --- */}
        {/* Added pb-[env(safe-area-inset-bottom)] for iOS devices */}
        <div className="flex-1 overflow-y-auto bg-surface custom-scrollbar relative pb-[calc(1rem+env(safe-area-inset-bottom))]">
          
          {/* VIEW 1: ASSIGNMENT LIST */}
          {!viewingAttempt && (
            <div className="p-4 md:p-8 space-y-4">
              
              <Button
                variant="elevated"
                size="lg"
                icon={<UserCircle strokeWidth={2.5}/>}
                onClick={() => { onClose(); router.push(`/teacher/students/${student.uid}`); }}
                className="w-full mb-4 md:mb-6 font-black text-[13px] md:text-[14px]"
              >
                {t.viewProfile}
              </Button>

              <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mb-2 px-1">
                <FileText size={14}/> {t.historyTitle}
              </h3>

              {loadingAttempts ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-primary">
                  <Spinner size={28}/>
                  <span className="text-[11px] font-black uppercase tracking-widest">{t.loading}</span>
                </div>
              ) : relevantAssignments.length === 0 ? (
                <div className="text-center py-16 bg-surface-container-low border-2 border-dashed border-outline-variant rounded-m3-lg text-on-surface-variant font-bold text-[13px] md:text-[14px] shadow-elev-1">
                  {t.empty}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleAssignments.map((assign, index) => {
                    const isLastElement = index === visibleAssignments.length - 1;
                    const attempt = attemptsMap[assign.id];
                    const isLate = !attempt && assign.dueAt && new Date() > new Date(assign.dueAt.seconds * 1000);
                    const score = attempt && attempt.totalQuestions > 0 ? Math.round((attempt.score / attempt.totalQuestions) * 100) : 0;

                    return (
                      <div 
                        key={assign.id} 
                        ref={isLastElement ? lastElementRef : null}
                        onClick={() => attempt && handleViewDetails(attempt)} 
                        className={`border border-outline-variant rounded-m3-lg p-4 md:p-5 bg-surface-container-low transition-all flex items-center justify-between group shadow-elev-1 ${attempt ? 'cursor-pointer hover:border-primary active:scale-[0.98]' : ''}`}
                      >
                        <div className="flex items-start gap-3 md:gap-4 min-w-0 pr-2 md:pr-4">
                          <div className={`mt-1.5 md:mt-2 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0 shadow-inner border-2 border-surface-container-low ${attempt ? (score >= 60 ? 'bg-success' : 'bg-error') : (isLate ? 'bg-error' : 'bg-outline-variant')}`} />
                          <div className="min-w-0">
                            <h4 className="font-black text-on-surface text-[14px] md:text-[15px] truncate group-hover:text-primary transition-colors leading-snug">{assign.testTitle || 'Untitled'}</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 text-[11px] md:text-[12px] font-bold text-on-surface-variant">
                              {assign.dueAt ? (
                                <span className={`flex items-center gap-1 ${isLate ? 'text-error' : ''}`}>
                                   <Calendar size={12}/> {isLate ? t.late : t.due}: {formatDate(assign.dueAt)}
                                </span>
                              ) : <span className="flex items-center gap-1"><Calendar size={12}/> {t.noDeadline}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-2 md:gap-3 shrink-0">
                          {attempt ? (
                            <div className="flex flex-col items-end">
                              <span className={`text-[16px] md:text-[20px] font-black leading-none ${score >= 60 ? 'text-success' : 'text-error'}`}>{score}%</span>
                              <span className="text-[10px] md:text-[11px] text-on-surface-variant font-black uppercase tracking-widest mt-1">{attempt.score}/{attempt.totalQuestions}</span>
                            </div>
                          ) : isLate ? (
                            <StatusChip tone="error" noDot className="uppercase tracking-widest font-black text-[10px] md:text-[11px]"><AlertCircle size={12}/> {t.missing}</StatusChip>
                          ) : (
                            <StatusChip tone="muted" noDot className="uppercase tracking-widest font-black text-[10px] md:text-[11px]"><Clock size={12}/> {t.pending}</StatusChip>
                          )}
                          {attempt && <ChevronRight size={18} strokeWidth={2.5} className="text-outline group-hover:text-primary transition-colors hidden sm:block"/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: DRILL DOWN (Review Attempt) */}
          {viewingAttempt && (
            <div className="p-4 md:p-8 animate-in slide-in-from-right-4 fade-in duration-300">
              {loadingTest || !fullTestData ? (
                <div className="flex flex-col items-center justify-center py-24 text-primary gap-3">
                  <Spinner size={32} />
                  <span className="text-[11px] md:text-[12px] font-black uppercase tracking-widest">{t.loadingData}</span>
                </div>
              ) : (
                <div className="space-y-6 md:space-y-8">
                  {/* 🟢 COMPACT MOBILE PERFORMANCE BENTO */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    
                    {/* SCORE */}
                    <div className="col-span-2 md:col-span-1 bg-surface-container-low p-4 md:p-5 rounded-m3-lg border border-outline-variant shadow-elev-1 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 mb-2 md:mb-3 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
                        <Target size={14} className="text-primary"/> {t.performance}
                      </div>
                      <div>
                        <span className="text-3xl md:text-4xl font-black text-on-surface">{viewingAttempt.score || 0}</span>
                        <span className="text-[12px] md:text-[14px] text-on-surface-variant font-bold"> / {viewingAttempt.totalQuestions || 0} {t.correct}</span>
                      </div>
                      <ProgressBar value={((viewingAttempt.score || 0) / (viewingAttempt.totalQuestions || 1)) * 100} className="mt-3 md:mt-4 md:h-2" />
                    </div>

                    {/* INTEGRITY */}
                    <div className={`p-4 md:p-5 rounded-m3-lg border border-transparent shadow-elev-1 flex flex-col justify-between ${
                      (viewingAttempt.tabSwitches || 0) > 0 ? 'bg-error-container' : 'bg-success-container'
                    }`}>
                      <div className={`flex items-center gap-1.5 mb-2 md:mb-3 text-[10px] font-black uppercase tracking-widest ${
                        (viewingAttempt.tabSwitches || 0) > 0 ? 'text-on-error-container' : 'text-on-success-container'
                      }`}>
                        {(viewingAttempt.tabSwitches || 0) > 0 ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />} {t.integrity}
                      </div>
                      <div>
                        <span className={`text-2xl md:text-4xl font-black ${(viewingAttempt.tabSwitches || 0) > 0 ? 'text-on-error-container' : 'text-on-success-container'}`}>
                          {viewingAttempt.tabSwitches || 0}
                        </span>
                        <span className={`text-[11px] md:text-[14px] font-bold block md:inline ${(viewingAttempt.tabSwitches || 0) > 0 ? 'text-on-error-container' : 'text-on-success-container'}`}> {t.switches}</span>
                      </div>
                    </div>

                    {/* INFO */}
                    <div className="bg-surface-container-low p-4 md:p-5 rounded-m3-lg border border-outline-variant shadow-elev-1 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 mb-2 md:mb-3 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
                        <Clock size={14} className="text-tertiary"/> {t.submissionInfo}
                      </div>
                      <div>
                        <p className="text-[12px] md:text-[15px] font-black text-on-surface leading-tight">
                          {formatDate(viewingAttempt.submittedAt || viewingAttempt.createdAt)}
                        </p>
                        <p className="text-[10px] md:text-[12px] text-on-surface-variant font-bold uppercase tracking-widest mt-1.5 md:mt-2">
                          {t.attempt} #{viewingAttempt.attemptsTaken || 1}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* 🟢 QUESTION ANALYSIS LIST */}
                  <div className="space-y-3 md:space-y-4">
                    <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest ml-1">{t.analysis}</h3>

                    {Array.isArray(fullTestData?.questions) && fullTestData.questions.map((q: NormalizedQuestion, idx: number) => {
                       const studentAnswer = viewingAttempt.answers?.[q.id] ?? null;
                       // The same comparator the student runner grades with — an
                       // answer can now be a letter, a letter[] (multiple_select)
                       // or typed text (open/numeric). See lib/questionSchema.ts.
                       const isCorrect = isAnswerCorrect(q, studentAnswer);
                       const answerLabel = Array.isArray(studentAnswer) ? studentAnswer.join(", ") : studentAnswer;
                       const studentOptionImage = typeof studentAnswer === "string" ? q.options?.[studentAnswer]?.imageUrl : null;
                       const correctOptionImage = q.options?.[q.answer]?.imageUrl;

                       return (
                         <div key={q.id || idx} className={`bg-surface-container-low border rounded-m3-lg p-4 md:p-6 shadow-elev-1 ${isCorrect ? 'border-success-container' : 'border-error-container'}`}>
                           <div className="flex flex-col gap-3 md:gap-6">

                             {/* Question Stem */}
                             <div className="flex items-start gap-3 md:gap-4 flex-1">
                               <div className={`w-8 h-8 md:w-10 md:h-10 rounded-m3-md flex items-center justify-center shrink-0 font-black text-[14px] md:text-[16px] shadow-elev-1 mt-0.5 ${isCorrect ? 'bg-success text-surface-container-lowest' : 'bg-error text-on-error'}`}>
                                 {idx + 1}
                               </div>
                               <div className="font-bold text-on-surface text-[13px] md:text-[15px] leading-relaxed pt-1 overflow-hidden break-words min-w-0">
                                 <LatexRenderer latex={getContentText(q.question)} />
                                 {q.imageUrl && (
                                   // eslint-disable-next-line @next/next/no-img-element
                                   <img
                                     src={q.imageUrl}
                                     alt=""
                                     className="mt-2 max-h-32 md:max-h-40 max-w-full object-contain rounded-m3-sm border border-outline-variant"
                                   />
                                 )}
                                 <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mt-2 text-on-surface-variant" />
                               </div>
                             </div>

                             {/* A BLOCK is answered part by part — one row each, or the
                                 student's whole answer would render as a raw object. */}
                             {q.isBlock ? (
                               <div className="w-full border-t border-outline-variant pt-3 md:pt-4 space-y-2">
                                 {(() => {
                                   const { earned, total } = gradeQuestion(q, studentAnswer);
                                   const given: Record<string, any> = isBlockAnswer(studentAnswer) ? studentAnswer : {};
                                   return (
                                     <>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                                         {earned} / {total} ball
                                       </p>
                                       {q.parts.map((part) => {
                                         const partAnswer = given[part.id];
                                         const partOk = isPartCorrect(part, partAnswer ?? null);
                                         const label = Array.isArray(partAnswer) ? partAnswer.join(", ") : (partAnswer ?? "");
                                         const correct = Array.isArray(part.correctAnswer.value)
                                           ? part.correctAnswer.value.join(", ")
                                           : String(part.correctAnswer.value ?? "");
                                         return (
                                           <div
                                             key={part.id}
                                             className={`flex items-start gap-2 rounded-m3-sm border p-2.5 text-[12px] md:text-[13px] ${partOk ? 'border-success bg-success-container text-on-success-container' : 'border-error bg-error-container text-on-error-container'}`}
                                           >
                                             <span className="font-black shrink-0">{part.id})</span>
                                             <div className="min-w-0 flex-1 break-words">
                                               <LatexRenderer latex={getContentText(part.prompt)} />
                                               <p className="mt-1 font-bold flex flex-wrap gap-x-3">
                                                 <span>{t.studentAns}: {label || t.skipped}</span>
                                                 {!partOk && <span>{t.correctAns}: {correct || '-'}</span>}
                                               </p>
                                             </div>
                                             {partOk ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
                                           </div>
                                         );
                                       })}
                                     </>
                                   );
                                 })()}
                               </div>
                             ) : (

                             /* Answers Grid (Stacks on mobile) */
                             <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full shrink-0 border-t border-outline-variant pt-3 md:pt-4">
                               <div className={`flex-1 p-3 md:p-4 rounded-m3-md border border-transparent flex flex-col justify-center min-w-0 ${isCorrect ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                                  <p className="font-black text-[9px] md:text-[10px] opacity-60 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center gap-1.5">
                                    {isCorrect ? <CheckCircle size={12}/> : <XCircle size={12}/>} {t.studentAns}
                                  </p>
                                  <div className="font-bold text-[12px] md:text-[14px] flex items-center gap-2 overflow-hidden">
                                    <span className="bg-surface-container-lowest text-on-surface px-2 py-0.5 rounded-m3-sm border border-transparent shadow-elev-1 shrink-0">{answerLabel || '-'}</span>
                                    <span className="opacity-80 truncate">
                                      <LatexRenderer latex={getContentText(typeof studentAnswer === 'string' ? q.options?.[studentAnswer] : null) || (q.optionList.length === 0 ? (answerLabel || t.skipped) : (studentOptionImage ? '' : t.skipped))} />
                                    </span>
                                    {studentOptionImage && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={studentOptionImage}
                                        alt=""
                                        className="h-10 md:h-12 w-auto max-w-[40%] object-contain rounded-m3-sm border border-outline-variant bg-surface-container-lowest shrink-0"
                                      />
                                    )}
                                  </div>
                               </div>

                               {!isCorrect && (
                                 <div className="flex-1 p-3 md:p-4 rounded-m3-md border border-transparent bg-success-container text-on-success-container flex flex-col justify-center min-w-0">
                                    <p className="font-black text-[9px] md:text-[10px] opacity-60 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center gap-1.5">
                                      <CheckCircle size={12}/> {t.correctAns}
                                    </p>
                                    <div className="font-bold text-[12px] md:text-[14px] flex items-center gap-2 overflow-hidden">
                                      <span className="bg-surface-container-lowest px-2 py-0.5 rounded-m3-sm border border-transparent shadow-elev-1 text-success shrink-0">{q.answer || '-'}</span>
                                      <span className="opacity-80 truncate">
                                        <LatexRenderer latex={getContentText(q.options?.[q.answer]) || (correctOptionImage ? '' : '-')} />
                                      </span>
                                      {correctOptionImage && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={correctOptionImage}
                                          alt=""
                                          className="h-10 md:h-12 w-auto max-w-[40%] object-contain rounded-m3-sm border border-outline-variant bg-surface-container-lowest shrink-0"
                                        />
                                      )}
                                    </div>
                                 </div>
                               )}
                             </div>
                             )}

                           </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}