'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, limit, getDocs, startAfter,
  QueryDocumentSnapshot, DocumentData, doc, setDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronRight, ArrowLeft, GraduationCap,
  BookOpen, Loader2, CheckCircle, Lock
} from 'lucide-react';
import {
  Page, PageHeader, Stack, Card, Tile, Avatar, Chip, Button, Spinner,
  LoadingState, EmptyState, sToast, MOTION_ON, springTransition, cn,
} from '@/components/student-ui';

// --- TRANSLATION DICTIONARY ---
const EXPLORE_TRANSLATIONS: any = {
  uz: {
    title: "Eng Yaxshi O'qituvchilar", subtitle: "O'z sohasining ustalarini toping.",
    students: "O'quvchilar", courses: "Sinflar", activeClasses: "Faol Sinflar", subject: "Fan",
    viewProfile: "Sinflarni ko'rish", back: "Ortga qaytish",
    teacherClasses: "O'qituvchining Sinflari", noClasses: "Bu o'qituvchida hozircha sinflar yo'q.",
    requestBtn: "Qo'shilish", pendingBtn: "Kutilmoqda", joinedBtn: "Qo'shilgansiz", closedBtn: "Yopiq",
    success: "So'rov yuborildi!", fail: "So'rov yuborilmadi.",
    centerManaged: "Bu guruh o'quv markazi tomonidan boshqariladi — qo'shilish uchun markazga murojaat qiling.",
    alreadyPending: "So'rovingiz allaqachon yuborilgan.",
    unknownTeacher: "Noma'lum o'qituvchi", defaultBio: "Usta o'qituvchi", noDescription: "Tavsif berilmagan."
  },
  en: {
    title: "Top Instructors", subtitle: "Discover master teachers.",
    students: "Students", courses: "Classes", activeClasses: "Active Classes", subject: "Subject",
    viewProfile: "View Classes", back: "Back to Instructors",
    teacherClasses: "Instructor's Classes", noClasses: "This instructor hasn't published any classes yet.",
    requestBtn: "Request to Join", pendingBtn: "Requested", joinedBtn: "Joined", closedBtn: "Closed",
    success: "Request sent successfully!", fail: "Could not send the request.",
    centerManaged: "This group is managed by a learning center — contact the center to enroll.",
    alreadyPending: "You already have a pending request.",
    unknownTeacher: "Unknown Teacher", defaultBio: "Master Instructor", noDescription: "No description provided."
  },
  ru: {
    title: "Лучшие Преподаватели", subtitle: "Найдите мастеров своего дела.",
    students: "Учеников", courses: "Классов", activeClasses: "Активные классы", subject: "Предмет",
    viewProfile: "Смотреть классы", back: "Назад",
    teacherClasses: "Классы Преподавателя", noClasses: "У этого преподавателя пока нет классов.",
    requestBtn: "Присоединиться", pendingBtn: "В ожидании", joinedBtn: "Вы в классе", closedBtn: "Закрыто",
    success: "Запрос отправлен!", fail: "Не удалось отправить запрос.",
    centerManaged: "Эта группа управляется учебным центром — для записи обратитесь в центр.",
    alreadyPending: "Ваш запрос уже отправлен.",
    unknownTeacher: "Неизвестный преподаватель", defaultBio: "Мастер своего дела", noDescription: "Описание отсутствует."
  }
};

/** One labelled metric inside a teacher card. */
function StatPill({
  icon, tone, label, value, className,
}: {
  icon: React.ReactNode;
  tone: 'gold' | 'secondary' | 'success';
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-m3-md bg-surface p-3', className)}>
      <Tile tone={tone} size="sm">{icon}</Tile>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase leading-none tracking-widest text-on-surface-variant">
          {label}
        </p>
        <p className="mt-1.5 truncate text-[17px] font-black leading-none">{value}</p>
      </div>
    </div>
  );
}

export default function ExploreTeachersPage() {
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = EXPLORE_TRANSLATIONS[lang] || EXPLORE_TRANSLATIONS['en'];

  // --- STATE ---
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // 🟢 NEW: Tracks infinite scroll load
  const [lastTeacherDoc, setLastTeacherDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreTeachers, setHasMoreTeachers] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  // 🟢 1. FETCH TOP TEACHERS
  const fetchTopTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        orderBy('totalStudents', 'desc'),
        limit(10)
      );

      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setTeachers(fetched);
      setLastTeacherDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreTeachers(snap.docs.length === 10);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => { fetchTopTeachers(); }, []);

 // 🟢 2. LOAD MORE TEACHERS (For Infinite Scroll)
  const loadMoreTeachers = useCallback(async () => {
    if (!lastTeacherDoc || loadingMore || !hasMoreTeachers) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        orderBy('totalStudents', 'desc'),
        startAfter(lastTeacherDoc),
        limit(10)
      );

      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 🟢 THE FIX: Automatically filter out any duplicate teachers
      setTeachers(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newUniqueTeachers = fetched.filter(t => !existingIds.has(t.id));
        return [...prev, ...newUniqueTeachers];
      });

      setLastTeacherDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreTeachers(snap.docs.length === 10);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [lastTeacherDoc, loadingMore, hasMoreTeachers]);

  // 🟢 3. INFINITE SCROLL LISTENER
  useEffect(() => {
    const handleScroll = () => {
      // If user scrolls within 500px of the bottom of the page, fetch next batch
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (hasMoreTeachers && !loadingMore && !loadingTeachers) {
          loadMoreTeachers();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMoreTeachers, loadingMore, loadingTeachers, loadMoreTeachers]);

  // 🟢 4. FETCH CLASSES FOR SPECIFIC TEACHER
  const handleSelectTeacher = async (teacher: any) => {
    setSelectedTeacher(teacher);
    setLoadingClasses(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', teacher.id),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeacherClasses(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClasses(false);
    }
  };

  // 🟢 5. REQUEST TO JOIN CLASS
  const handleJoinRequest = async (cls: any) => {
    if (!user) return;
    const classId = cls.id;

    // Center groups refuse self-join (mirrors JoinClassModal + the rules deny;
    // this used to fail silently with only a console.error).
    if (cls.centerId) { sToast.error(t.centerManaged); return; }

    setProcessingIds(prev => new Set(prev).add(classId));
    try {
      // A pending request may exist in EITHER shape: this page's deterministic
      // /requests/{uid} doc, or JoinClassModal's addDoc with studentId.
      const [ownDoc, byField] = await Promise.all([
        getDoc(doc(db, 'classes', classId, 'requests', user.uid)),
        getDocs(query(collection(db, 'classes', classId, 'requests'), where('studentId', '==', user.uid))),
      ]);
      if (ownDoc.exists() || !byField.empty) {
        setRequestedIds(prev => new Set(prev).add(classId));
        sToast.reward(t.alreadyPending, '⏳');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      await setDoc(doc(db, 'classes', classId, 'requests', user.uid), {
        studentId: user.uid,
        studentName: userData.displayName || user.displayName || 'Student',
        studentUsername: userData.username || '',
        photoURL: userData.photoURL || user.photoURL || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setRequestedIds(prev => new Set(prev).add(classId));
      sToast.success(t.success);
    } catch (error) {
      console.error(error);
      sToast.error(t.fail);
    }
    finally {
      setProcessingIds(prev => {
        const next = new Set(prev); next.delete(classId); return next;
      });
    }
  };

  return (
    <Page width="wide">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <AnimatePresence mode="wait">

        {/* ========================================================= */}
        {/* VIEW 1: TEACHERS LIST */}
        {/* ========================================================= */}
        {!selectedTeacher ? (
          <motion.div
            key="teacher-list"
            initial={MOTION_ON ? { opacity: 0, x: -16 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={MOTION_ON ? { opacity: 0, x: -16 } : undefined}
            transition={springTransition}
            className="flex flex-col gap-s-section"
          >
            {loadingTeachers ? (
              <LoadingState rows={3} />
            ) : (
              <>
                {teachers.map((teacher, index) => (

                  <Card
                    key={teacher.id}
                    interactive
                    onClick={() => handleSelectTeacher(teacher)}
                    className="flex flex-col gap-s-gap"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar
                        src={teacher.photoURL}
                        name={teacher.displayName || 'Teacher'}
                        size="xl"
                        shape="square"
                      />

                      <div className="min-w-0 flex-1">
                        <Chip status="gold">#{index + 1}</Chip>
                        <h3 className="s-display mt-2 truncate text-[22px] font-bold leading-tight md:text-[26px]">
                          {teacher.displayName || t.unknownTeacher}
                        </h3>
                        {teacher.username && (
                          <p className="truncate text-[14px] font-bold text-on-surface-variant">
                            @{teacher.username}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 🟢 TALL STATS GRID (Replaced XP with Subject) */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <StatPill
                        icon={<Users size={16} strokeWidth={2.5} />}
                        tone="gold"
                        label={t.students}
                        value={teacher.totalStudents?.toLocaleString() || 0}
                      />
                      <StatPill
                        icon={<BookOpen size={16} strokeWidth={2.5} />}
                        tone="secondary"
                        label={t.activeClasses}
                        value={teacher.activeClassCount || 0}
                      />
                      {/* 🟢 Subject Pill (Spans 2 columns on mobile, 1 on desktop) */}
                      <StatPill
                        icon={<GraduationCap size={16} strokeWidth={2.5} />}
                        tone="success"
                        label={t.subject}
                        value={teacher.subject || "—"}
                        className="col-span-2 md:col-span-1"
                      />
                    </div>

                    <Button
                      variant="tonal"
                      size="sm"
                      fullWidth
                      trailingIcon={<ChevronRight size={16} strokeWidth={3} />}
                    >
                      {t.viewProfile}
                    </Button>
                  </Card>
                ))}

                {/* 🟢 INFINITE SCROLL LOADER */}
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Spinner size={32} />
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : (

        /* ========================================================= */
        /* VIEW 2: TEACHER PROFILE & CLASSES (DRILL-DOWN)            */
        /* ========================================================= */
          <motion.div
            key="teacher-detail"
            initial={MOTION_ON ? { opacity: 0, x: 16 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={MOTION_ON ? { opacity: 0, x: 16 } : undefined}
            transition={springTransition}
          >
            <Stack>
              <Button
                variant="text"
                size="sm"
                onClick={() => setSelectedTeacher(null)}
                icon={<ArrowLeft size={18} strokeWidth={3} />}
                className="self-start"
              >
                {t.back}
              </Button>

              <Card className="flex flex-col items-center gap-5 md:flex-row md:items-start">
                <Avatar
                  src={selectedTeacher.photoURL}
                  name={selectedTeacher.displayName}
                  size="xl"
                  shape="square"
                />
                <div className="min-w-0 flex-1 text-center md:text-left">
                  <h2 className="s-display text-[26px] font-bold leading-tight">
                    {selectedTeacher.displayName}
                  </h2>
                  <p className="mt-1 text-[14px] font-bold text-on-surface-variant">
                    {selectedTeacher.bio || t.defaultBio}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <Chip status="gold" size="md" icon={<Users size={14} />}>
                      {selectedTeacher.totalStudents?.toLocaleString() || 0} {t.students}
                    </Chip>
                    {selectedTeacher.subject && (
                      <Chip status="primary" size="md" icon={<GraduationCap size={14} />}>
                        {selectedTeacher.subject}
                      </Chip>
                    )}
                  </div>
                </div>
              </Card>

              <h3 className="s-display flex items-center gap-2 text-[20px] font-bold">
                <BookOpen size={20} className="text-primary" /> {t.teacherClasses}
              </h3>

              {loadingClasses ? (
                <LoadingState rows={2} />
              ) : teacherClasses.length === 0 ? (
                <EmptyState icon={<BookOpen size={26} />} title={t.noClasses} />
              ) : (
                <div className="grid gap-s-gap md:grid-cols-2">
                  {teacherClasses.map((cls) => {
                    const isProcessing = processingIds.has(cls.id);
                    const hasRequested = requestedIds.has(cls.id);
                    const alreadyJoined = cls.studentIds?.includes(user?.uid);

                    return (
                      <Card key={cls.id} className="flex flex-col">
                        <h4 className="s-display truncate text-[17px] font-bold">{cls.title}</h4>
                        <p className="mt-1 line-clamp-2 h-10 text-[13.5px] font-bold text-on-surface-variant">
                          {cls.description || t.noDescription}
                        </p>

                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-outline-variant pt-4">
                          <Chip icon={<Users size={13} strokeWidth={3} />}>
                            {cls.studentIds?.length || 0}
                          </Chip>

                          {alreadyJoined ? (
                            <Chip status="success" icon={<CheckCircle size={13} strokeWidth={3} />}>{t.joinedBtn}</Chip>
                          ) : hasRequested ? (
                            <Chip status="warning" icon={<Loader2 size={13} className="animate-spin" />}>{t.pendingBtn}</Chip>
                          ) : cls.isLocked ? (
                            <Chip status="error" icon={<Lock size={13} strokeWidth={3} />}>{t.closedBtn}</Chip>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleJoinRequest(cls)}
                              loading={isProcessing}
                            >
                              {t.requestBtn}
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
