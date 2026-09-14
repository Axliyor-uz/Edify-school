'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  FileText, BarChart2, LogOut,
  User, Calendar, Folder,
  Trophy, Info, FileBadge, Building2, CalendarCheck, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Page, PageHeader, Tabs, Dialog, Card, Tile, Button, IconButton,
  LoadingState, sToast, MOTION_ON,
} from '@/components/student-ui';

// Tabs
import AssignmentsTab from './_components/AssignmentsTab';
import MaterialsTab from './_components/MaterialsTab';
import GradesTab from './_components/GradesTab';
import LeaderboardTab from './_components/LeaderboardTab';
import ExamsTab from './_components/ExamsTab';
import AttendanceTab from './_components/AttendanceTab';
import { useStudentLanguage } from '@/app/(student)/layout';

const globalStudentClassCache: Record<string, { classData: any, timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000;

const CLASS_TRANSLATIONS: any = {
  uz: {
    back: "Sinflarim", instructor: "O'qituvchi", code: "Kod", created: "Sana",
    tabs: { assignments: "Topshiriqlar", exams: "Imtihonlar", grades: "Baholarim", leaderboard: "Reyting", materials: "Materiallar", attendance: "Davomat" },
    info: { title: "Sinf Haqida", leaveDesc: "Sinfdan chiqish sizni ro'yxatdan o'chiradi. Barcha topshiriqlarga kirish imkoniyatini yo'qotasiz.", leaveBtn: "Sinfni Tark Etish", managedBy: "O'quv markazi", centerManaged: "Bu guruh o'quv markazi tomonidan boshqariladi. Guruhdan chiqish uchun markaz menejeriga murojaat qiling.", schedule: "Dars Jadvali", payments: "Markaz sahifasi →" },
    modals: { confirmLeave: "Haqiqatan ham tark etmoqchimisiz?", cancel: "Bekor qilish", confirm: "Ha, Chiqish" },
    toasts: { notFound: "Sinf topilmadi", accessDenied: "Kirish rad etildi", leftSuccess: "Sinfdan chiqdingiz", leftFail: "Chiqishda xatolik yuz berdi" }
  },
  en: {
    back: "Classes", instructor: "Teacher", code: "Code", created: "Created",
    tabs: { assignments: "Assignments", exams: "Exams", grades: "Grades", leaderboard: "Leaderboard", materials: "Materials", attendance: "Attendance" },
    info: { title: "Class Info", leaveDesc: "Leaving this class will remove you from the student list. You will lose access to all assignments.", leaveBtn: "Leave Class", managedBy: "Learning Center", centerManaged: "This group is managed by your learning center. Contact your center's manager to leave.", schedule: "Weekly Schedule", payments: "My Center →" },
    modals: { confirmLeave: "Are you sure you want to leave?", cancel: "Cancel", confirm: "Yes, Leave" },
    toasts: { notFound: "Class not found", accessDenied: "Access Denied", leftSuccess: "Left class successfully", leftFail: "Failed to leave" }
  },
  ru: {
    back: "Классы", instructor: "Учитель", code: "Код", created: "Создан",
    tabs: { assignments: "Задания", exams: "Экзамены", grades: "Оценки", leaderboard: "Рейтинг", materials: "Материалы", attendance: "Посещаемость" },
    info: { title: "О классе", leaveDesc: "Выход из класса удалит вас из списка. Вы потеряете доступ ко всем заданиям.", leaveBtn: "Покинуть Класс", managedBy: "Учебный центр", centerManaged: "Эта группа управляется учебным центром. Чтобы выйти, обратитесь к менеджеру центра.", schedule: "Расписание занятий", payments: "Мой Центр →" },
    modals: { confirmLeave: "Вы уверены, что хотите выйти?", cancel: "Отмена", confirm: "Да, Выйти" },
    toasts: { notFound: "Класс не найден", accessDenied: "Доступ запрещен", leftSuccess: "Вы покинули класс", leftFail: "Не удалось выйти" }
  }
};

export default function StudentClassPage() {
  const { classId } = useParams() as { classId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = CLASS_TRANSLATIONS[lang] || CLASS_TRANSLATIONS['en'];

  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Teacher contact comes through /api/directory/contact (student-of-teacher
  // relationship, proven server-side) — never from the users doc.
  const [teacherContact, setTeacherContact] = useState<{ email: string; phone: string } | null>(null);

  useEffect(() => {
    if (!isInfoModalOpen || !user || !classData?.teacherId || teacherContact) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/directory/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ uid: classData.teacherId }),
        });
        if (res.ok) setTeacherContact(await res.json());
      } catch { /* contact stays hidden */ }
    })();
  }, [isInfoModalOpen, user, classData?.teacherId, teacherContact]);

  useEffect(() => {
    if (!user) return;

    const fetchClassInfo = async (silent = false) => {
      const cached = globalStudentClassCache[classId];
      const now = Date.now();

      if (cached && !silent) {
        setClassData(cached.classData);
        setLoading(false);
        if (now - cached.timestamp < CACHE_LIFESPAN) return;
        fetchClassInfo(true);
        return;
      }

      if (!silent) setLoading(true);

      try {
        const classSnap = await getDoc(doc(db, 'classes', classId));
        if (!classSnap.exists()) {
          sToast.error(t.toasts.notFound);
          router.push('/classes');
          return;
        }

        const cData: any = { id: classSnap.id, ...classSnap.data() };

        // Center groups: resolve the center's name once (centers are readable
        // by any signed-in user) and cache it alongside the class.
        if (cData.centerId) {
          try {
            const centerSnap = await getDoc(doc(db, 'centers', cData.centerId));
            if (centerSnap.exists()) cData.centerName = centerSnap.data().name || '';
          } catch { /* non-fatal — badge just shows the generic label */ }
        }

        setClassData(cData);
        globalStudentClassCache[classId] = { classData: cData, timestamp: Date.now() };

      } catch (e: any) {
        if (e.code === 'permission-denied') { sToast.error(t.toasts.accessDenied); router.push('/classes'); }
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchClassInfo();
  }, [classId, user, router, t]);

  const handleLeaveClass = async () => {
    // Center groups are manager-enrolled: self-leave would orphan the roster
    // link and finance records (docs/MANAGER.md). The button is hidden for
    // them, but guard the handler too.
    if (classData?.centerId) { sToast.error(t.info.centerManaged); return; }
    if (!confirm(t.modals.confirmLeave)) return;
    setIsLeaving(true);
    try {
      await updateDoc(doc(db, 'classes', classId), { studentIds: arrayRemove(user?.uid) });
      delete globalStudentClassCache[classId];
      sToast.success(t.toasts.leftSuccess);
      router.push('/classes');
    } catch(e) {
      sToast.error(t.toasts.leftFail);
      setIsLeaving(false);
    }
  };

  if (loading) return (
    <Page>
      <LoadingState rows={4} />
    </Page>
  );

  if (!classData || !user) return null;

  const TABS = [
    { value: 'assignments', label: t.tabs.assignments, icon: <FileText size={16} strokeWidth={2.75} /> },
    { value: 'exams', label: t.tabs.exams, icon: <FileBadge size={16} strokeWidth={2.75} /> },
    { value: 'grades', label: t.tabs.grades, icon: <BarChart2 size={16} strokeWidth={2.75} /> },
    { value: 'leaderboard', label: t.tabs.leaderboard, icon: <Trophy size={16} strokeWidth={2.75} /> },
    { value: 'materials', label: t.tabs.materials, icon: <Folder size={16} strokeWidth={2.75} /> },
    // Attendance is a center feature — only center groups have sessions.
    ...(classData.centerId ? [{ value: 'attendance', label: t.tabs.attendance, icon: <CalendarCheck size={16} strokeWidth={2.75} /> }] : []),
  ];

  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <Page>
      <PageHeader
        title={classData.title}
        onBack={() => router.push('/classes')}
        actions={
          <IconButton
            aria-label={t.info.title}
            variant="tonal"
            onClick={() => setIsInfoModalOpen(true)}
          >
            <Info size={20} strokeWidth={2.75} />
          </IconButton>
        }
      />

      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} label={t.info.title} className="mb-s-section" />

      {/* CONTENT AREA */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={MOTION_ON ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >

            {activeTab === 'assignments' && <AssignmentsTab classId={classId} />}
            {activeTab === 'exams' && <ExamsTab classId={classId} />}
            {activeTab === 'grades' && <GradesTab classId={classId} userId={user.uid} />}
            {activeTab === 'leaderboard' && <LeaderboardTab classId={classId} />}
            {activeTab === 'materials' && <MaterialsTab classId={classId} />}
            {activeTab === 'attendance' && <AttendanceTab classId={classId} userId={user.uid} />}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* INFO MODAL */}
      <Dialog
        open={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title={t.info.title}
        sheetOnMobile
        className="max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-3">
          {classData.description && (
            <Card variant="filled" className="text-[13px] font-bold leading-relaxed">
              {classData.description}
            </Card>
          )}

          {/* Center-managed badge — classes.centerId + resolved centers.name */}
          {classData.centerId && (
            <Link
              href="/center"
              className="flex items-center gap-3 rounded-m3-md bg-primary-container p-3 text-on-primary-container s-press"
            >
              <Tile tone="primary" className="bg-surface text-primary"><Building2 size={18} strokeWidth={2.5} /></Tile>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">{t.info.managedBy}</span>
                <span className="block truncate text-[14px] font-bold">{classData.centerName || t.info.managedBy}</span>
              </span>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest opacity-70">{t.info.payments}</span>
            </Link>
          )}

          <div className="flex items-center gap-3 rounded-m3-md border border-outline-variant p-3">
            <Tile tone="primary"><User size={18} strokeWidth={2.5} /></Tile>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t.instructor}</p>
              <p className="truncate text-[14px] font-bold text-on-surface">{classData.teacherName || 'Unknown'}</p>
              {teacherContact?.phone && <a href={`tel:${teacherContact.phone}`} className="block truncate text-[12px] font-bold text-primary">{teacherContact.phone}</a>}
              {teacherContact?.email && <a href={`mailto:${teacherContact.email}`} className="block truncate text-[12px] font-bold text-on-surface-variant">{teacherContact.email}</a>}
            </div>
          </div>

          {/* Weekly schedule — classes.schedule[] {dayOfWeek(0=Sun), startTime, endTime, roomName} */}
          {Array.isArray(classData.schedule) && classData.schedule.length > 0 && (
            <div className="rounded-m3-md border border-outline-variant p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                <Clock size={12} strokeWidth={3} /> {t.info.schedule}
              </p>
              <div className="space-y-1.5">
                {[...classData.schedule]
                  .sort((a: any, b: any) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
                  .map((slot: any, i: number) => {
                    // Weekday label from the 0=Sunday convention (docs/ROOMS.md).
                    const day = new Date(Date.UTC(2024, 0, 7 + slot.dayOfWeek)).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 text-[13px] font-bold text-on-surface">
                        <span className="capitalize">{day}</span>
                        <span className="text-on-surface-variant">{slot.startTime}–{slot.endTime}{slot.roomName ? ` · ${slot.roomName}` : ''}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-m3-md border border-outline-variant p-3">
            <Tile tone="success"><Calendar size={18} strokeWidth={2.5} /></Tile>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t.created}</p>
              <p className="truncate text-[14px] font-bold text-on-surface">{classData.createdAt?.seconds ? new Date(classData.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-outline-variant pt-6">
            {classData.centerId ? (
              // Manager-enrolled group: self-leave is disabled (it would orphan
              // the center roster/finance records). Only the manager removes.
              <p className="rounded-m3-md border border-dashed border-outline-variant p-4 text-center text-[12px] font-bold leading-relaxed text-on-surface-variant">{t.info.centerManaged}</p>
            ) : (
              <>
                <Button
                  variant="tonal"
                  tone="error"
                  fullWidth
                  onClick={handleLeaveClass}
                  loading={isLeaving}
                  icon={<LogOut size={18} strokeWidth={3} />}
                >
                  {t.info.leaveBtn}
                </Button>
                <p className="mt-3 text-center text-[11px] font-bold text-on-surface-variant">{t.info.leaveDesc}</p>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </Page>
  );
}
