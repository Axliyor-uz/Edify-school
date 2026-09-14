'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { FileBadge, Clock, Play, Lock, ChevronRight, SearchCode, Trophy, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  ListGroup, ListRow, Tile, Chip, Button, EmptyState, LoadingState, Spinner,
  type Status,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

const TRANSLATIONS: any = {
  uz: { empty: "Sinfda hozircha imtihonlar yo'q.", start: "Boshlash", wait: "Kutilmoqda", done: "Yakunlangan", submitted: "Tekshirilmoqda", gradedHidden: "Baholandi", ball: "Ball" },
  en: { empty: "No exams in this class yet.", start: "Start Exam", wait: "Waiting", done: "Closed", submitted: "Under Review", gradedHidden: "Graded", ball: "Pts" },
  ru: { empty: "В классе пока нет экзаменов.", start: "Начать", wait: "Ожидание", done: "Завершено", submitted: "Проверяется", gradedHidden: "Оценено", ball: "Баллов" }
};

export default function ExamsTab({ classId }: { classId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  const [exams, setExams] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // 🟢 INFINITE SCROLL STATES
  const [limitCount, setLimitCount] = useState(10);
  const [hasMore, setHasMore] = useState(true);

  // 1. 🟢 PAGINATED EXAMS LISTENER
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'classes', classId, 'exams'),
      orderBy('examDate', 'desc'),
      limit(limitCount) // 🟢 Start with 10
    );

    const unsub = onSnapshot(q, (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setHasMore(snap.docs.length === limitCount); // If we get exactly what we asked for, there's likely more
      setLoading(false);
    });
    return () => unsub();
  }, [classId, user, limitCount]);

  // 2. Fetch Student's Attempts (Real-time for instant grade updates)
  useEffect(() => {
    if (!user) return;
    const qAttempts = query(
      collection(db, 'attempts'),
      where('classId', '==', classId),
      where('userId', '==', user.uid),
      where('type', '==', 'exam')
    );

    const unsubAttempts = onSnapshot(qAttempts, (snap) => {
      const attMap: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        attMap[data.assignmentId] = data;
      });
      setAttempts(attMap);
    });

    return () => unsubAttempts();
  }, [classId, user]);

  // 🟢 INTERSECTION OBSERVER (Detects when student scrolls to the bottom)
  const observer = useRef<IntersectionObserver | null>(null);
  const lastExamElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setLimitCount(prev => prev + 10); // Load 10 more silently
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  if (loading && exams.length === 0) return <LoadingState rows={3} />;

  if (exams.length === 0) {
    return <EmptyState icon={<FileBadge size={30} strokeWidth={2.5} />} title={t.empty} />;
  }

  return (
    <div className="space-y-s-gap">
      <ListGroup>
        {exams.map((exam, index) => {
          const now = new Date();
          const examDate = exam.examDate.toDate();
          const endDate = new Date(examDate.getTime() + exam.durationMinutes * 60000);

          const attempt = attempts[exam.id];
          const hasSubmitted = !!attempt || exam.submittedStudentIds?.includes(user?.uid);
          const isGraded = attempt?.status === 'graded';
          const showScore = isGraded && !exam.hideResults;

          let status = 'scheduled';
          if (now >= examDate && now <= endDate) status = 'active';
          if (now > endDate) status = 'closed';

          // Status → token tone. Every chip keeps its label, so color never
          // carries the meaning on its own.
          let tone: Status = 'info';
          let btnText = t.wait;
          let Icon = Clock;
          let canClick = false;

          if (showScore) {
            tone = 'gold';
            btnText = `${attempt.teacherScore} / ${attempt.totalPoints || exam.totalPoints || '?'} ${t.ball}`;
            Icon = Trophy;
          } else if (isGraded && exam.hideResults) {
            tone = 'success';
            btnText = t.gradedHidden;
            Icon = EyeOff;
          } else if (hasSubmitted) {
            tone = 'warning';
            btnText = t.submitted;
            Icon = SearchCode;
          } else if (status === 'active') {
            tone = 'primary';
            btnText = t.start;
            Icon = Play;
            canClick = true;
          } else if (status === 'closed') {
            tone = 'neutral';
            btnText = t.done;
            Icon = Lock;
          }

          // Tile has no `warning`/`info` tone — map those onto its nearest role.
          const tileTone = tone === 'warning' ? 'gold' : tone === 'info' ? 'secondary' : tone;

          const handleExamClick = () => {
            if (showScore) {
              // 🟢 Route to the new Review Page
              router.push(`/student/exam/${exam.id}/review?classId=${classId}`);
            } else if (canClick) {
              // Route to the Live Exam Player
              router.push(`/student/exam/${exam.id}?classId=${classId}`);
            }
          };

          // 🟢 ATTACH THE SENSOR TO THE VERY LAST EXAM IN THE ARRAY
          const isLastElement = exams.length === index + 1;

          return (
            <ListRow
              key={exam.id}
              ref={isLastElement ? lastExamElementRef : null} // 🟢 Sensor attached here!
              onClick={handleExamClick}
              clickable={canClick || showScore}
              leading={<Tile tone={tileTone}><Icon size={22} strokeWidth={2.5} /></Tile>}
              title={exam.title}
              subtitle={`${exam.assessmentType} · ${examDate.toLocaleDateString()} ${examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${exam.durationMinutes} daq`}
              className="py-3.5"
              trailing={
                canClick ? (
                  <Button size="sm" trailingIcon={<ChevronRight size={16} strokeWidth={3} />}>
                    {btnText}
                  </Button>
                ) : (
                  <Chip status={tone} size="md" icon={<Icon size={14} strokeWidth={2.5} />}>
                    {btnText}
                  </Chip>
                )
              }
            />
          );
        })}
      </ListGroup>

      {/* 🟢 LOADING SPINNER AT BOTTOM WHEN FETCHING MORE */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Spinner size={24} />
        </div>
      )}
    </div>
  );
}
