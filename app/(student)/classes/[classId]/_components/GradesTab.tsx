'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { ChevronRight, CheckCircle } from 'lucide-react';
import {
  ListGroup, ListRow, Chip, EmptyState, LoadingState, Spinner,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

// 🟢 1. GLOBAL CACHE FOR GRADES (0 Reads on Tab Switch)
const globalGradesCache: Record<string, { attempts: any[], lastDoc: any, hasMore: boolean, timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000; // 60 seconds
const PAGE_SIZE = 15; // 🟢 Bumped to 15 to ensure we always have enough items even after filtering out exams

const GRADES_TRANSLATIONS: any = {
  uz: { noGrades: "Hali baholar yo'q.", justNow: "Hozirgina", tries: "Urinishlar", score: "Ball" },
  en: { noGrades: "No grades recorded yet.", justNow: "Just now", tries: "Tries", score: "Score" },
  ru: { noGrades: "Оценок пока нет.", justNow: "Только что", tries: "Попытки", score: "Балл" }
};

export default function GradesTab({ classId, userId }: { classId: string, userId: string }) {
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = GRADES_TRANSLATIONS[lang] || GRADES_TRANSLATIONS['en'];

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // 🟢 2. SWR FETCH LOGIC
  useEffect(() => {
    const initializeTab = async () => {
      const cached = globalGradesCache[classId];
      const now = Date.now();

      if (cached) {
        setAttempts(cached.attempts);
        setLastDoc(cached.lastDoc);
        setHasMore(cached.hasMore);
        setLoadingInitial(false);

        if (now - cached.timestamp < CACHE_LIFESPAN) return;
        fetchGrades(false, true); // Silently revalidate
      } else {
        setLoadingInitial(true);
        fetchGrades(false, false);
      }
    };
    initializeTab();
  }, [classId]);

  const fetchGrades = async (isNextPage: boolean = false, silent: boolean = false) => {
    if (isNextPage && !lastDoc) return;
    if (!silent) isNextPage ? setLoadingMore(true) : setLoadingInitial(true);

    try {
      let q = query(
        collection(db, 'attempts'),
        where('classId', '==', classId),
        where('userId', '==', userId),
        orderBy('submittedAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (isNextPage && lastDoc) {
        q = query(
          collection(db, 'attempts'),
          where('classId', '==', classId),
          where('userId', '==', userId),
          orderBy('submittedAt', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);

      // 🟢 FILTER OUT EXAMS HERE: We only want standard assignments
      const newDocs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((d: any) => d.type !== 'exam');

      setAttempts(prev => {
        const updated = isNextPage ? [...prev, ...newDocs] : newDocs;

        // 🟢 CRITICAL: We MUST use the raw snap.docs for the cursor, NOT the filtered array!
        const newLastDoc = snap.docs[snap.docs.length - 1] || null;
        const newHasMore = snap.docs.length >= PAGE_SIZE;

        globalGradesCache[classId] = { attempts: updated, lastDoc: newLastDoc, hasMore: newHasMore, timestamp: Date.now() };

        if (!silent || !isNextPage) {
          setLastDoc(newLastDoc);
          setHasMore(newHasMore);
        }
        return updated;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false); setLoadingMore(false);
    }
  };

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingInitial || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchGrades(true);
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);

  if (loadingInitial && attempts.length === 0) return <LoadingState rows={3} />;

  if (attempts.length === 0) return (
    <EmptyState icon={<CheckCircle size={30} strokeWidth={2.5} />} title={t.noGrades} />
  );

  return (
    <div className="space-y-s-gap">
      <ListGroup>
        {attempts.map((attempt, index) => {
          const isLastElement = index === attempts.length - 1;
          // 🟢 SAFETY: Prevent crashes if database fields are corrupted or missing
          const safeScore = attempt.score || 0;
          const safeTotal = attempt.totalQuestions || 1;
          const percentage = Math.round((safeScore / safeTotal) * 100);

          const scoreStatus = percentage >= 80 ? 'success' : percentage >= 50 ? 'warning' : 'error';

          return (
            <ListRow
              key={attempt.id}
              ref={isLastElement ? lastElementRef : null}
              onClick={() => router.push(`/classes/${classId}/test/${attempt.assignmentId}/results`)}
              clickable
              title={attempt.testTitle || 'Unknown Test'}
              subtitle={
                <span className="flex items-center gap-2 uppercase tracking-widest">
                  <span>{attempt.submittedAt?.seconds ? new Date(attempt.submittedAt.seconds * 1000).toLocaleDateString() : t.justNow}</span>
                  <span>•</span>
                  <span>{attempt.attemptsTaken || 1}x {t.tries}</span>
                </span>
              }
              trailing={
                <span className="flex shrink-0 items-center gap-2">
                  <Chip status={scoreStatus} size="md" className="min-w-[76px] flex-col gap-0 rounded-m3-sm px-3 py-2 leading-none">
                    <span className="s-num text-[16px] font-black">{percentage}%</span>
                    <span className="mt-1 text-[9px] font-black uppercase tracking-widest opacity-75">{safeScore}/{safeTotal}</span>
                  </Chip>
                  <ChevronRight size={18} strokeWidth={3} className="text-outline" />
                </span>
              }
            />
          );
        })}
      </ListGroup>
      {loadingMore && <div className="flex justify-center py-6"><Spinner size={24} /></div>}
    </div>
  );
}
