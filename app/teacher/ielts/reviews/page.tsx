'use client';

// Cross-group grading queue: every pending Writing/Speaking submission across the
// teacher's IELTS groups, gradeable in one sitting. Reuses the group Reviews tab's
// cards (same grading form, AI draft, rubric).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Spinner, EmptyState } from '@/components/ui';
import { fetchPendingReviews } from '@/services/ieltsService';
import IeltsReviewsTab from '@/app/teacher/ielts/groups/[groupId]/_components/IeltsReviewsTab';
import type { GroupAttempt } from '@/app/teacher/ielts/groups/[groupId]/_components/groupData';

const T: Record<string, any> = {
  uz: {
    title: 'Tekshirish navbati',
    subtitle: "Barcha guruhlardagi Writing va Speaking ishlari",
    empty: "Hammasi tekshirilgan! 🎉",
    emptyDesc: "Yangi Writing yoki Speaking topshiriqlar shu yerda paydo bo'ladi.",
    back: 'Ortga',
  },
  en: {
    title: 'Grading queue',
    subtitle: 'Writing and Speaking submissions from all your groups',
    empty: 'All caught up! 🎉',
    emptyDesc: 'New Writing and Speaking submissions will appear here.',
    back: 'Back',
  },
  ru: {
    title: 'Очередь на проверку',
    subtitle: 'Работы Writing и Speaking из всех ваших групп',
    empty: 'Всё проверено! 🎉',
    emptyDesc: 'Новые работы Writing и Speaking появятся здесь.',
    back: 'Назад',
  },
};

export default function IeltsGradingQueuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [loaded, setLoaded] = useState(false);
  const [attempts, setAttempts] = useState<GroupAttempt[]>([]);
  const [groupTitles, setGroupTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'ielts_groups'), where('teacherId', '==', user.uid)));
        const titles: Record<string, string> = {};
        snap.docs.forEach(d => { titles[d.id] = d.data().title || d.id; });
        const pending = snap.empty ? [] : await fetchPendingReviews(snap.docs.map(d => d.id));
        if (!alive) return;
        setGroupTitles(titles);
        setAttempts(pending as GroupAttempt[]);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const handleGraded = (attemptId: string) => {
    setAttempts(prev => prev.filter(a => a.id !== attemptId));
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-m3-md border border-outline-variant bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label={t.back}
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="w-11 h-11 rounded-m3-md bg-warning-container text-on-warning-container flex items-center justify-center shrink-0">
          <ClipboardCheck size={20} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[19px] font-black text-on-surface">{t.title}</h1>
          <p className="text-[12px] font-bold text-on-surface-variant">{t.subtitle}</p>
        </div>
      </div>

      {!loaded ? (
        <div className="py-16 flex justify-center"><Spinner size={28} /></div>
      ) : attempts.length === 0 ? (
        <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
          <EmptyState icon={<ClipboardCheck strokeWidth={2.5} />} title={t.empty} description={t.emptyDesc} />
        </div>
      ) : (
        <IeltsReviewsTab
          attempts={attempts}
          loaded={loaded}
          onGraded={handleGraded}
          groupTitles={groupTitles}
        />
      )}
    </div>
  );
}
