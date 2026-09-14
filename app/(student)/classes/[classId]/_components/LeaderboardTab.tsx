'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ListGroup, RankRow, EmptyState, LoadingState, Spinner, cn,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

const globalStudentLeaderboardCache: Record<string, { leaderboard: any[], lastDoc: any, hasMore: boolean, timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000;
const PAGE_SIZE = 10;

const LEADERBOARD_TRANSLATIONS: any = {
  uz: { emptyTitle: "Reyting bo'sh", emptyDesc: "O'quvchilar test ishlaganda XP to'plashadi va shu yerda ko'rinadi.", points: "XP", rank: "O'rin" },
  en: { emptyTitle: "Leaderboard is empty", emptyDesc: "Students will earn XP by taking tests to appear here.", points: "XP", rank: "Rank" },
  ru: { emptyTitle: "Рейтинг пуст", emptyDesc: "Ученики появятся здесь, когда заработают XP.", points: "XP", rank: "Место" }
};

export default function LeaderboardTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = LEADERBOARD_TRANSLATIONS[lang] || LEADERBOARD_TRANSLATIONS['en'];

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const initializeTab = async () => {
      const cached = globalStudentLeaderboardCache[classId];
      const now = Date.now();

      if (cached) {
        setLeaderboard(cached.leaderboard);
        setLastDoc(cached.lastDoc);
        setHasMore(cached.hasMore);
        setLoadingInitial(false);
        if (now - cached.timestamp < CACHE_LIFESPAN) return;
        revalidateSnapshot(cached.leaderboard.length);
      } else {
        setLoadingInitial(true);
        fetchLeaderboard(false);
      }
    };
    initializeTab();
  }, [classId]);

  const fetchLeaderboard = async (isNextPage: boolean = false) => {
    if (!classId) return;
    if (isNextPage && !lastDoc) return;

    isNextPage ? setLoadingMore(true) : setLoadingInitial(true);

    try {
      let q = query(collection(db, 'classes', classId, 'leaderboard'), orderBy('xp', 'desc'), limit(PAGE_SIZE));
      if (isNextPage && lastDoc) {
        q = query(collection(db, 'classes', classId, 'leaderboard'), orderBy('xp', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setLeaderboard(prev => {
        const updated = isNextPage ? [...prev, ...newDocs] : newDocs;
        const newLastDoc = snap.docs[snap.docs.length - 1] || null;
        const newHasMore = snap.docs.length >= PAGE_SIZE;

        globalStudentLeaderboardCache[classId] = { leaderboard: updated, lastDoc: newLastDoc, hasMore: newHasMore, timestamp: Date.now() };
        setLastDoc(newLastDoc); setHasMore(newHasMore);
        return updated;
      });
    } catch (e) { console.error(e); } finally { setLoadingInitial(false); setLoadingMore(false); }
  };

  const revalidateSnapshot = async (currentTotalLoaded: number) => {
    try {
      const q = query(collection(db, 'classes', classId, 'leaderboard'), orderBy('xp', 'desc'), limit(currentTotalLoaded));
      const snap = await getDocs(q);
      const freshDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeaderboard(freshDocs);
      globalStudentLeaderboardCache[classId].leaderboard = freshDocs;
      globalStudentLeaderboardCache[classId].timestamp = Date.now();
    } catch (e) { console.error(e); }
  };

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingInitial || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchLeaderboard(true);
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);

  if (loadingInitial && leaderboard.length === 0) return <LoadingState rows={4} />;

  if (leaderboard.length === 0) return (
    <EmptyState
      icon={<Trophy size={30} strokeWidth={2.5} />}
      title={t.emptyTitle}
      description={t.emptyDesc}
    />
  );

  return (
    <div className="space-y-s-gap">
      <ListGroup>
        {leaderboard.map((student, index) => {
          const isLastElement = index === leaderboard.length - 1;
          const rank = index + 1;
          const avatarUrl = student.photoURL || student.photoUrl || student.avatar || null;

          // Medal tint for the podium places; everyone else keeps the plain row.
          const medalTint =
            rank === 1 ? 'bg-gold-container text-on-gold-container'
            : rank === 2 || rank === 3 ? 'bg-surface-container-high'
            : undefined;

          return (
            <div key={student.id} ref={isLastElement ? lastElementRef : null}>
              {/* 🟢 CLICK TO VIEW PUBLIC PROFILE */}
              <button
                type="button"
                onClick={() => router.push(`/profile/${student.uid}`)}
                className="w-full text-left transition-colors hover:bg-state-hover active:bg-state-press"
              >
                <RankRow
                  entry={{
                    id: student.id,
                    name: student.displayName || 'Anonymous Student',
                    xp: student.xp || 0,
                    avatar: avatarUrl,
                  }}
                  rank={rank}
                  className={cn(medalTint)}
                />
              </button>
            </div>
          );
        })}
      </ListGroup>
      {loadingMore && <div className="flex justify-center py-6"><Spinner size={24} /></div>}
    </div>
  );
}
