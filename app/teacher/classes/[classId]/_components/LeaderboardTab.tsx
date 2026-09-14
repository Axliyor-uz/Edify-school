'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { Trophy, Medal, Award, Star, ChevronRight, Sparkles, User as UserIcon } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { EmptyState, Spinner } from '@/components/ui';

// ============================================================================
// 🟢 1. GLOBAL CACHE (Survives Tab Switches, Preserves Scroll Position)
// ============================================================================
const globalTeacherLeaderboardCache: Record<string, { 
  leaderboard: any[], 
  lastDoc: any, 
  hasMore: boolean, 
  timestamp: number 
}> = {};

const CACHE_LIFESPAN = 60 * 1000; // 60 seconds

// --- TRANSLATION DICTIONARY ---
const LEADERBOARD_TRANSLATIONS: any = {
  uz: { emptyTitle: "Reyting bo'sh", emptyDesc: "O'quvchilar test ishlaganda XP to'plashadi va shu yerda ko'rinadi.", points: "XP", rank: "O'rin" },
  en: { emptyTitle: "Leaderboard is empty", emptyDesc: "Students will appear here as they earn XP by taking tests.", points: "XP", rank: "Rank" },
  ru: { emptyTitle: "Рейтинг пуст", emptyDesc: "Ученики появятся здесь, когда заработают XP за тесты.", points: "XP", rank: "Место" }
};

const PAGE_SIZE = 10;

export default function LeaderboardTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = LEADERBOARD_TRANSLATIONS[lang] || LEADERBOARD_TRANSLATIONS['en'];

  // --- STATE ---
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // ============================================================================
  // 🟢 2. SWR FETCHING LOGIC (Snapshot Refresh)
  // ============================================================================
  useEffect(() => {
    const initializeTab = async () => {
      const cached = globalTeacherLeaderboardCache[classId];
      const now = Date.now();

      if (cached) {
        // 🟢 CACHE HIT: Instant Load!
        setLeaderboard(cached.leaderboard);
        setLastDoc(cached.lastDoc);
        setHasMore(cached.hasMore);
        setLoadingInitial(false);

        // If fresh, stop here.
        if (now - cached.timestamp < CACHE_LIFESPAN) return;

        // If stale, silently re-fetch the EXACT number of items currently on screen
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
      let q = query(
        collection(db, 'classes', classId, 'leaderboard'), 
        orderBy('xp', 'desc'), 
        limit(PAGE_SIZE)
      );

      if (isNextPage && lastDoc) {
        q = query(
          collection(db, 'classes', classId, 'leaderboard'), 
          orderBy('xp', 'desc'), 
          startAfter(lastDoc), 
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setLeaderboard(prev => {
        const updated = isNextPage ? [...prev, ...newDocs] : newDocs;
        const newLastDoc = snap.docs[snap.docs.length - 1] || null;
        const newHasMore = snap.docs.length >= PAGE_SIZE;

        // Update Cache
        globalTeacherLeaderboardCache[classId] = {
          leaderboard: updated,
          lastDoc: newLastDoc,
          hasMore: newHasMore,
          timestamp: Date.now()
        };

        setLastDoc(newLastDoc);
        setHasMore(newHasMore);
        return updated;
      });
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  };

  // 🟢 Snapshot Refresh: Grabs the top N students in one fast query to fix ordering
  const revalidateSnapshot = async (currentTotalLoaded: number) => {
    try {
      const q = query(
        collection(db, 'classes', classId, 'leaderboard'), 
        orderBy('xp', 'desc'), 
        limit(currentTotalLoaded) // e.g. If teacher scrolled to 40, fetch top 40.
      );
      const snap = await getDocs(q);
      const freshDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setLeaderboard(freshDocs);
      
      // We don't update lastDoc/hasMore here so infinite scroll doesn't break.
      // We just update the data and timestamp.
      globalTeacherLeaderboardCache[classId].leaderboard = freshDocs;
      globalTeacherLeaderboardCache[classId].timestamp = Date.now();
    } catch (e) {
      console.error("Silent leaderboard revalidation failed", e);
    }
  };

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingInitial || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchLeaderboard(true);
      }
    }, { threshold: 0.5 });
    
    if (node) observerRef.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);


  // ============================================================================
  // 🟢 3. RENDER (Tactile Gamified UI)
  // ============================================================================
  if (loadingInitial && leaderboard.length === 0) {
    return <div className="py-12 flex justify-center"><Spinner size={28} /></div>;
  }

  if (leaderboard.length === 0) {
    return (
      <div className="py-3 md:py-7 bg-surface-container-low rounded-m3-xl border-2 border-dashed border-outline-variant shadow-elev-1">
        <EmptyState icon={<Trophy />} title={t.emptyTitle} description={t.emptyDesc} />
      </div>
    );
  }

  return (
    <div className="space-y-2.5 md:space-y-3">
      {leaderboard.map((student, index) => {
        const isLastElement = index === leaderboard.length - 1;
        const rank = index + 1; 
        const avatarUrl = student.photoURL || student.photoUrl || student.avatar || null;
        
        // --- 🟢 DYNAMIC STYLING FOR PODIUM vs REGULAR ---
        let cardStyle = "bg-surface-container-low border-outline-variant hover:border-primary";
        let rankColor = "bg-inverse-surface text-inverse-on-surface";
        let avatarBorder = "border-outline-variant bg-surface-container-high text-on-surface-variant";

        if (rank === 1) {
          cardStyle = "bg-tertiary-container border-tertiary shadow-elev-1 ring-2 sm:ring-4 ring-[color-mix(in_oklab,var(--m3-tertiary)_10%,transparent)] z-10";
          rankColor = "bg-tertiary text-on-tertiary";
          avatarBorder = "border-tertiary bg-tertiary-container text-on-tertiary-container";
        } else if (rank === 2) {
          cardStyle = "bg-secondary-container border-secondary";
          rankColor = "bg-secondary text-on-secondary";
          avatarBorder = "border-secondary bg-secondary-container text-on-secondary-container";
        } else if (rank === 3) {
          cardStyle = "bg-surface-container-highest border-outline";
          rankColor = "bg-inverse-surface text-inverse-on-surface";
          avatarBorder = "border-outline bg-surface-container-high text-on-surface-variant";
        }

        return (
          <div 
            key={student.id} 
            ref={isLastElement ? lastElementRef : null}
            onClick={() => router.push(`/teacher/students/${student.uid}`)}
            className={`flex items-center justify-between p-2.5 sm:p-3 md:p-4 rounded-m3-lg border-2 border-b-[3px] md:border-b-4 transition-all duration-200 cursor-pointer group active:translate-y-[2px] active:border-b-2 hover:-translate-y-0.5 ${cardStyle}`}
          >
            
            {/* Left side: Avatar + Rank & Name */}
            <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 min-w-0 flex-1">
              
              {/* 🟢 Profile Picture with Nested Rank Badge */}
              <div className="relative shrink-0">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 overflow-hidden flex items-center justify-center font-black text-[16px] md:text-xl shadow-elev-1 ${avatarBorder}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    student.displayName?.[0]?.toUpperCase() || <UserIcon size={18} strokeWidth={3} className="md:w-5 md:h-5"/>
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-black text-[9px] sm:text-[11px] md:text-[12px] border-[1.5px] md:border-2 border-surface-container-lowest shadow-elev-1 z-10 ${rankColor}`}>
                  {rank === 1 ? <Trophy size={10} className="md:w-3 md:h-3" strokeWidth={3}/> : rank === 2 ? <Medal size={10} className="md:w-3 md:h-3" strokeWidth={3}/> : rank === 3 ? <Award size={10} className="md:w-3 md:h-3" strokeWidth={3}/> : rank}
                </div>
              </div>

              {/* Name Details */}
              <div className="min-w-0 pr-2 ml-0.5 md:ml-1">
                <p className="font-black text-[14px] sm:text-[15px] md:text-[17px] text-on-surface truncate tracking-tight group-hover:text-primary transition-colors leading-snug">
                  {student.displayName || "Anonymous Student"}
                </p>
                <p className="text-[10px] md:text-[12px] font-bold text-on-surface-variant truncate mt-0.5">
                  {rank === 1 ? '🥇 1st Place' : rank === 2 ? '🥈 2nd Place' : rank === 3 ? '🥉 3rd Place' : `@${student.username || 'student'}`}
                </p>
              </div>
            </div>

            {/* Right side: Tactile XP Pill */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
              <div className={`border-2 rounded-m3-md px-2.5 md:px-3 py-1 md:py-1.5 flex items-center gap-1 md:gap-1.5 shadow-elev-1 ${rank === 1 ? 'bg-surface-container-lowest border-tertiary' : 'bg-surface-container border-outline-variant'}`}>
                <span className={`font-black text-[14px] sm:text-[15px] md:text-[18px] leading-none ${rank === 1 ? 'text-tertiary' : 'text-primary'}`}>
                  {(student.xp || 0).toLocaleString()}
                </span>
                <span className="text-[8px] md:text-[9px] font-black text-on-surface-variant uppercase tracking-widest mt-0.5">{t.points}</span>
              </div>

              <div className="w-7 h-7 md:w-8 md:h-8 rounded-m3-md bg-surface-container-lowest border-2 border-outline-variant flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:border-primary group-hover:text-on-primary transition-all hidden sm:flex shrink-0">
                <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={3} />
              </div>
            </div>

          </div>
        );
      })}

      {loadingMore && (
        <div className="py-4 md:py-6 flex justify-center">
          <Spinner size={24} />
        </div>
      )}
    </div>
  );
}