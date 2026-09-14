'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, orderBy,
  limit, startAfter // 🟢 Added limit and startAfter for pagination
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Calendar, ArrowRight, CheckCircle2,
  TrendingUp, FileText
} from 'lucide-react';
import {
  Button, Chip, EmptyState, ListGroup, ListRow, LoadingState,
  Page, PageHeader, StatTile, Stack, Tile,
} from '@/components/student-ui';
import { useStudentLanguage } from '../layout';

// --- 1. TRANSLATION DICTIONARY ---
const HISTORY_TRANSLATIONS = {
  uz: {
    title: "Testlar Tarixi",
    subtitle: "O'tgan natijalaringizni ko'rib chiqing va tahlil qiling.",
    stats: "Yuklangan Testlar", // Updated to reflect loaded amount
    empty: {
      title: "Hali tarix mavjud emas",
      desc: "Birinchi topshiriqni bajarganingizdan so'ng, natijalaringiz bu yerda avtomatik ravishda paydo bo'ladi."
    },
    card: {
      unknown: "Noma'lum Test",
      untitled: "Nomsiz Test",
      removed: "O'chirilgan Test",
      score: "Ball",
      dateNA: "Sana yo'q",
      correct: "To'g'ri",
      analysis: "Tahlil",
      exam: "Imtihon",
      pending: "Tekshirilmoqda"
    },
    action: {
      loadMore: "Yana 5 ta ko'rsatish",
      loading: "Yuklanmoqda..."
    }
  },
  en: {
    title: "Quiz History",
    subtitle: "Review your past performance and analyze results.",
    stats: "Loaded Tests",
    empty: {
      title: "No History Yet",
      desc: "Your quiz results will appear here automatically after you complete your first assignment."
    },
    card: {
      unknown: "Unknown Test",
      untitled: "Untitled Test",
      removed: "Test Removed",
      score: "Score",
      dateNA: "Date N/A",
      correct: "Correct",
      analysis: "Analysis",
      exam: "Exam",
      pending: "Under review"
    },
    action: {
      loadMore: "Show Next 5",
      loading: "Loading..."
    }
  },
  ru: {
    title: "История Тестов",
    subtitle: "Просмотрите свои прошлые результаты и анализируйте успеваемость.",
    stats: "Загружено Тестов",
    empty: {
      title: "История пуста",
      desc: "Ваши результаты появятся здесь автоматически после выполнения первого задания."
    },
    card: {
      unknown: "Неизвестный тест",
      untitled: "Тест без названия",
      removed: "Тест удален",
      score: "Балл",
      dateNA: "Нет даты",
      correct: "Верно",
      analysis: "Анализ",
      exam: "Экзамен",
      pending: "На проверке"
    },
    action: {
      loadMore: "Показать еще 5",
      loading: "Загрузка..."
    }
  }
};

interface HistoryRowProps {
  attempt: any;
}

// --- 🟢 OPTIMIZED HISTORY ROW COMPONENT (0 extra reads) ---
const HistoryRow = ({ attempt }: HistoryRowProps) => {
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = HISTORY_TRANSLATIONS[lang].card;

  // `attempts` is polymorphic — ALWAYS branch on type. Exam docs overload
  // `assignmentId` with the examId and score via autoScore/teacherScore over
  // totalPoints (no score/totalQuestions), and their review lives on the exam
  // route, not the assignment results page.
  const isExam = attempt.type === 'exam';
  const isGradedExam = isExam && attempt.status === 'graded';
  const testTitle = attempt.testTitle || t.untitled;
  const earned = isExam ? (attempt.autoScore || 0) + (attempt.teacherScore || 0) : attempt.score;
  const total = isExam ? attempt.totalPoints : attempt.totalQuestions;
  const pendingExam = isExam && !isGradedExam;
  const percentage = pendingExam ? null : (total > 0 ? Math.round((earned / total) * 100) : 0);
  const destination = isExam
    ? `/student/exam/${attempt.assignmentId}/review?classId=${attempt.classId}`
    : `/classes/${attempt.classId}/test/${attempt.assignmentId}/results`;

  // One tone drives both the leading tile and the score chip — it is a legal
  // value for Tile's `tone` and Chip's `status` alike.
  const tone =
    percentage === null ? 'neutral'
    : percentage >= 80 ? 'success'
    : percentage >= 50 ? 'gold'
    : 'error';

  return (
    <ListRow
      clickable
      onClick={() => router.push(destination)}
      leading={
        <Tile tone={tone}>
          <FileText size={20} strokeWidth={2.5} />
        </Tile>
      }
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{testTitle}</span>
          {isExam && <Chip status="primary" className="uppercase tracking-[0.1em]">{t.exam}</Chip>}
        </span>
      }
      subtitle={
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={12} strokeWidth={2.5} />
            <span className="s-num">
              {attempt.submittedAt?.seconds
                ? new Date(attempt.submittedAt.seconds * 1000).toLocaleDateString()
                : t.dateNA}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} strokeWidth={2.5} />
            {pendingExam ? t.pending : <><span className="s-num">{earned} / {total}</span> {t.correct}</>}
          </span>
        </span>
      }
      trailing={
        pendingExam ? (
          <Chip status="warning">{t.pending}</Chip>
        ) : (
          <Chip status={tone} size="md">
            <span className="s-num">{percentage}%</span>
          </Chip>
        )
      }
    />
  );
};

// --- MAIN PAGE ---
export default function HistoryPage() {
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = HISTORY_TRANSLATIONS[lang];

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🟢 Pagination State
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const FETCH_LIMIT = 5;

  // 1. Initial Fetch
  useEffect(() => {
    if (!user) return;
    const fetchInitialHistory = async () => {
      try {
        const historyQ = query(
          collection(db, 'attempts'),
          where('userId', '==', user.uid),
          orderBy('submittedAt', 'desc'),
          limit(FETCH_LIMIT) // 🟢 Fetch only 5
        );
        const snapshot = await getDocs(historyQ);

        setAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        if (snapshot.docs.length < FETCH_LIMIT) {
          setHasMore(false);
        } else {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialHistory();
  }, [user]);

  // 2. Load Next 5 Logic
  const loadMore = async () => {
    if (!lastVisible || !user) return;
    setLoadingMore(true);
    try {
      const nextQ = query(
        collection(db, 'attempts'),
        where('userId', '==', user.uid),
        orderBy('submittedAt', 'desc'),
        startAfter(lastVisible), // 🟢 Start exactly where we left off
        limit(FETCH_LIMIT)
      );
      const snapshot = await getDocs(nextQ);

      const newAttempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttempts(prev => [...prev, ...newAttempts]);

      if (snapshot.docs.length < FETCH_LIMIT) {
        setHasMore(false);
      } else {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <LoadingState rows={3} label={t.action.loading} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          attempts.length > 0 && (
            <StatTile
              label={t.stats}
              value={attempts.length}
              icon={<FileText size={14} strokeWidth={2.5} />}
              className="min-w-[150px]"
            />
          )
        }
      />

      <Stack>
        {attempts.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={32} strokeWidth={2.5} />}
            title={t.empty.title}
            description={t.empty.desc}
          />
        ) : (
          <>
            <ListGroup>
              {attempts.map((attempt) => (
                <HistoryRow key={attempt.id} attempt={attempt} />
              ))}
            </ListGroup>

            {/* 🟢 LOAD MORE BUTTON */}
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  variant="tonal"
                  onClick={loadMore}
                  loading={loadingMore}
                  icon={<ArrowRight size={20} className="rotate-90" />}
                >
                  {loadingMore ? t.action.loading : t.action.loadMore}
                </Button>
              </div>
            )}
          </>
        )}
      </Stack>
    </Page>
  );
}
