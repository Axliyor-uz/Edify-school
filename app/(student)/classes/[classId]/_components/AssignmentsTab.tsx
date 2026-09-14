'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  FileText, CheckCircle, Clock, ArrowRight, Lock,
  AlertCircle, RotateCcw, Calendar, ShieldCheck, Trophy, Info
} from 'lucide-react';
import {
  ListGroup, Tile, Chip, Button, EmptyState, LoadingState, Spinner,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

// ============================================================================
// 🟢 1. GLOBAL CACHE (0 Reads on Tab Switch, Survives Navigation)
// ============================================================================
const globalStudentAssignmentsCache: Record<string, { assignments: any[], attempts: any[], lastDoc: any, hasMore: boolean, timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000; // 60 seconds
const PAGE_SIZE = 10;

const ASSIGNMENT_TRANSLATIONS: any = {
  uz: {
    empty: { title: "Faol topshiriqlar yo'q", desc: "Hozircha barcha vazifalar bajarilgan." },
    meta: { questions: "Savol", noLimit: "Vaqt Cheklovisiz", mins: "daq", closed: "Yopilgan", due: "Muddat", attempts: "Urinishlar", infinite: "∞", teacherNote: "O'qituvchi eslatmasi:" },
    status: { locked: "Qulflangan", view: "Natijani Ko'rish", missed: "O'tkazib yuborilgan", retake: "Qayta Topshirish", start: "Boshlash" }
  },
  en: {
    empty: { title: "No active assignments", desc: "You're all caught up for now." },
    meta: { questions: "Questions", noLimit: "No Time Limit", mins: "mins", closed: "Closed", due: "Due", attempts: "Attempts", infinite: "∞", teacherNote: "Teacher's Note:" },
    status: { locked: "Locked", view: "View Results", missed: "Missed", retake: "Retake", start: "Start" }
  },
  ru: {
    empty: { title: "Нет активных заданий", desc: "На данный момент все выполнено." },
    meta: { questions: "Вопросов", noLimit: "Без ограничений", mins: "мин", closed: "Закрыто", due: "Срок", attempts: "Попытки", infinite: "∞", teacherNote: "Заметка учителя:" },
    status: { locked: "Закрыто", view: "Результаты", missed: "Пропущено", retake: "Пересдать", start: "Начать" }
  }
};

export default function AssignmentsTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = ASSIGNMENT_TRANSLATIONS[lang] || ASSIGNMENT_TRANSLATIONS['en'];

  // --- STATE ---
  const [assignments, setAssignments] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<any[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // ============================================================================
  // 🟢 2. SWR FETCH LOGIC (Pagination Limit 10)
  // ============================================================================
  useEffect(() => {
    if (!user || !classId) return;

    const initializeTab = async () => {
      const cached = globalStudentAssignmentsCache[classId];
      const now = Date.now();

      if (cached) {
        setAssignments(cached.assignments);
        setMyAttempts(cached.attempts);
        setLastDoc(cached.lastDoc);
        setHasMore(cached.hasMore);
        setLoadingInitial(false);

        if (now - cached.timestamp < CACHE_LIFESPAN) return;
        fetchAssignments(false, true); // Silently revalidate
      } else {
        setLoadingInitial(true);
        fetchAssignments(false, false);
      }
    };
    initializeTab();
  }, [classId, user]);

  const fetchAssignments = async (isNextPage: boolean = false, silent: boolean = false) => {
    if (!user || !classId) return;
    if (isNextPage && !lastDoc) return;

    if (!silent) isNextPage ? setLoadingMore(true) : setLoadingInitial(true);

    try {
      // 1. Fetch exactly 10 assignments
      let q = query(
        collection(db, 'classes', classId, 'assignments'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (isNextPage && lastDoc) {
        q = query(collection(db, 'classes', classId, 'assignments'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const newAssignDocs: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Filter client-side for assignments belonging to this specific student
      const myNewAssignments = newAssignDocs.filter(a => a.assignedTo === 'all' || (Array.isArray(a.assignedTo) && a.assignedTo.includes(user.uid)));

      // 3. Fetch attempts ONLY for these 10 assignments
      let newAttempts: any[] = [];
      if (newAssignDocs.length > 0) {
        const assignmentIds = newAssignDocs.map(a => a.id);
        const attQ = query(
          collection(db, 'attempts'),
          where('userId', '==', user.uid),
          where('assignmentId', 'in', assignmentIds)
        );
        const attSnap = await getDocs(attQ);
        newAttempts = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      // 4. Update State & Cache
      setAssignments(prev => {
        const updatedAssigns = isNextPage ? [...prev, ...myNewAssignments] : myNewAssignments;
        const newLastDoc = snap.docs[snap.docs.length - 1] || null;
        const newHasMore = snap.docs.length >= PAGE_SIZE;

        setMyAttempts(prevAtt => {
          const updatedAttempts = isNextPage ? [...prevAtt, ...newAttempts] : newAttempts;

          globalStudentAssignmentsCache[classId] = {
            assignments: updatedAssigns,
            attempts: updatedAttempts,
            lastDoc: newLastDoc,
            hasMore: newHasMore,
            timestamp: Date.now()
          };
          return updatedAttempts;
        });

        if (!silent || !isNextPage) {
          setLastDoc(newLastDoc);
          setHasMore(newHasMore);
        }
        return updatedAssigns;
      });

    } catch (e) {
      console.error("Assignment fetch error", e);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  };

  // --- 3. INFINITE SCROLL TRIGGER ---
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingInitial || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchAssignments(true);
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);


  // ============================================================================
  // 🟢 RENDER UI
  // ============================================================================
  if (loadingInitial && assignments.length === 0) {
    return <LoadingState rows={3} />;
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={30} strokeWidth={2.5} />}
        title={t.empty.title}
        description={t.empty.desc}
      />
    );
  }

  return (
    <div className="space-y-s-gap">
      <ListGroup>
        {assignments.map((assign: any, index: number) => {
          const isLastElement = index === assignments.length - 1;

          // --- CALCULATE STATUS ---
          const attemptDoc = myAttempts.find((a: any) => a.assignmentId === assign.id);
          const attemptCount = attemptDoc ? (attemptDoc.attemptsTaken || 1) : 0;
          const maxAttempts = assign.allowedAttempts ?? 1;

          const scorePercent = attemptDoc
            ? Math.round((attemptDoc.score / attemptDoc.totalQuestions) * 100)
            : null;

          const isCompleted = maxAttempts !== 0 && attemptCount >= maxAttempts;

          // ⚠️ SECURITY WARNING: This uses local device time for UI rendering.
          // For strict security, use Firestore Security rules (which we already implemented in firestore.rules)
          // to block writes if the student tampers with their device clock.
          const now = new Date();
          const openDate = assign.openAt ? new Date(assign.openAt.seconds * 1000) : null;
          const dueDate = assign.dueAt ? new Date(assign.dueAt.seconds * 1000) : null;

          const isLocked = openDate && now < openDate;
          const isExpired = dueDate && now > dueDate;

          const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

          return (
            <div
              key={assign.id}
              ref={isLastElement ? lastElementRef : null}
              className="flex flex-col gap-4 px-s-row-x py-4 md:flex-row md:items-center md:justify-between"
            >
              {/* LEFT: INFO */}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Tile tone="primary"><FileText size={20} strokeWidth={2.5} /></Tile>
                  <h3 className="s-display truncate text-[16px] font-bold leading-tight text-on-surface md:text-[17px]">
                    {assign.testTitle || 'Untitled Assignment'}
                  </h3>

                  {/* duration/resultsVisibility are denormalized onto NEW assignment
                      docs by AssignTestModal; legacy docs lack them → no badge. */}
                  {(assign.duration > 0 || assign.resultsVisibility === 'never') && (
                    <span title="Proctored" className="flex shrink-0 items-center text-success">
                      <ShieldCheck size={16} strokeWidth={3} />
                    </span>
                  )}
                </div>

                {/* 🟢 NEW: TEACHER INSTRUCTIONS */}
                {assign.description && (
                  <div className="rounded-m3-sm bg-primary-container p-3 text-on-primary-container md:ml-14">
                    <p className="flex items-start gap-2 text-[13px] font-bold leading-relaxed">
                      <Info size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
                      <span>
                        <span className="mr-1 text-[10px] font-black uppercase tracking-widest">{t.meta.teacherNote}</span>
                        {assign.description}
                      </span>
                    </p>
                  </div>
                )}

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant md:pl-14">

                  <span className="flex items-center gap-1.5">
                    <span className="text-on-surface">{assign.questionCount}</span> {t.meta.questions}
                  </span>

                  {/* Only new assignments carry `duration` (null = explicitly no
                      limit). Old docs never had the field — showing "No Limit" for
                      them was a lie (the real limit lives on custom_tests). */}
                  {assign.duration !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} strokeWidth={2.5} className="text-outline" />
                      {assign.duration ? `${assign.duration} ${t.meta.mins}` : t.meta.noLimit}
                    </span>
                  )}

                  {dueDate && (
                    <Chip
                      status={isExpired ? 'error' : 'neutral'}
                      icon={<Calendar size={12} strokeWidth={2.5} />}
                      className="uppercase tracking-widest"
                    >
                      {isExpired ? `${t.meta.closed} ` : `${t.meta.due} `}
                      {formatDate(dueDate)} - {formatTime(dueDate)}
                    </Chip>
                  )}

                  {maxAttempts !== 1 && (
                    <Chip status="neutral" icon={<RotateCcw size={12} strokeWidth={3} />} className="uppercase tracking-widest">
                      <span className="text-on-surface">{attemptCount}</span> / {maxAttempts === 0 ? t.meta.infinite : maxAttempts} {t.meta.attempts}
                    </Chip>
                  )}

                  {scorePercent !== null && (
                    <Chip
                      status={scorePercent >= 60 ? 'success' : 'error'}
                      icon={<Trophy size={12} strokeWidth={3} />}
                    >
                      {scorePercent}%
                    </Chip>
                  )}
                </div>
              </div>

              {/* RIGHT: ACTION BUTTON */}
              <div className="flex shrink-0 justify-end md:min-w-[160px]">

                {isLocked ? (
                  <Button variant="tonal" disabled fullWidth icon={<Lock size={16} strokeWidth={3} />} className="md:w-auto">
                    {t.status.locked}
                  </Button>
                )
                : (isCompleted || (isExpired && attemptCount > 0)) ? (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => router.push(`/classes/${classId}/test/${assign.id}/results`)}
                    trailingIcon={<ArrowRight size={16} strokeWidth={3} />}
                    className="md:w-auto"
                  >
                    {t.status.view}
                  </Button>
                )
                : isExpired ? (
                  <Chip status="error" size="md" icon={<AlertCircle size={16} strokeWidth={3} />} className="uppercase tracking-widest">
                    {t.status.missed}
                  </Chip>
                )
                : (
                  <Button
                    tone={attemptCount > 0 ? 'tertiary' : 'primary'}
                    fullWidth
                    onClick={() => router.push(`/classes/${classId}/test/${assign.id}`)}
                    icon={attemptCount > 0 ? <RotateCcw size={18} strokeWidth={3} /> : <CheckCircle size={18} strokeWidth={3} />}
                    className="md:w-auto"
                  >
                    {attemptCount > 0 ? t.status.retake : t.status.start}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </ListGroup>

      {/* Invisible loading indicator at bottom to trigger observer */}
      {loadingMore && <div className="flex justify-center py-6"><Spinner size={24} /></div>}
    </div>
  );
}
