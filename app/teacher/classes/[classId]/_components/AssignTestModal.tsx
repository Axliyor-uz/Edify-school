'use client';

import { sendNotification } from '@/services/notificationService';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // 🟢 ADDED PORTAL
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc, serverTimestamp, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  X, Clock, Users, Search, AlignLeft, RotateCcw,
  Plus, BookOpen, CheckCircle2, Minus, Calendar, AlertTriangle,FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeQuestions } from '@/lib/questionSchema';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton, EmptyState } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const ASSIGN_MODAL_TRANSLATIONS = {
  uz: {
    titleCreate: "Test Biriktirish", titleEdit: "Topshiriqni Tahrirlash", titleConfig: "Qoidalarni Sozlash",
    search: "Kutubxonangizdan qidiring...",
    empty: { title: "Kutubxonangiz Bo'sh", desc: "Sinfga biriktirishdan oldin test shablonini yarating.", btn: "Yangi Test Yaratish" },
    list: { loadMore: "Yana 10 ta yuklash", loading: "Yuklanmoqda...", notFound: "Test topilmadi." },
    questions: "Savollar", noLimit: "Cheklovsiz",
    config: {
      instructions: "Ko'rsatmalar", instPlace: "Masalan: Boshlashdan oldin qoidalarni o'qing...",
      attempts: "Ruxsat etilgan urinishlar", maxAttempts: "Maksimal urinishlar:", unlimited: "Cheklovsiz", setUnlimited: "Cheklovsiz qilish",
      schedule: "Jadval", openDate: "Ochilish Sanasi", dueDate: "Tugash Sanasi", now: "Hozir", noDeadline: "Muddatsiz",
      presets: { plus1: "+1 Kun", plus3: "+3 Kun", plus7: "+7 Kun", clear: "Tozalash" },
      assignTo: "Kimga Biriktirish", all: "Barcha O'quvchilar", individual: "Ayrim O'quvchilar", noStudents: "Sinfda o'quvchilar yo'q."
    },
    buttons: { back: "Ortga", next: "Keyingi qadam", publish: "Topshiriqni Nashr Qilish", save: "O'zgarishlarni Saqlash", select: "Testni tanlang", close: "Yopish" },
    toasts: { updated: "Topshiriq Yangilandi!", published: "Topshiriq Nashr Qilindi!", fail: "Xatolik yuz berdi", needDue: "Bu test natijalarni muddatdan keyin ko'rsatadi — muddat (deadline) belgilang" }
  },
  en: {
    titleCreate: "Assign a Test", titleEdit: "Edit Assignment", titleConfig: "Configure Rules",
    search: "Search your library...",
    empty: { title: "Library is Empty", desc: "Create a test template before assigning.", btn: "Create New Test" },
    list: { loadMore: "Load Next 10", loading: "Loading...", notFound: "No tests found." },
    questions: "Questions", noLimit: "No Limit",
    config: {
      instructions: "Instructions", instPlace: "e.g. Read the rules before starting...",
      attempts: "Attempts Allowed", maxAttempts: "Max Attempts:", unlimited: "Unlimited", setUnlimited: "Set Unlimited",
      schedule: "Schedule", openDate: "Open Date", dueDate: "Due Date", now: "Now", noDeadline: "No Deadline",
      presets: { plus1: "+1 Day", plus3: "+3 Days", plus7: "+7 Days", clear: "Clear" },
      assignTo: "Assign To", all: "All Students", individual: "Select Individuals", noStudents: "No students in class yet."
    },
    buttons: { back: "Back", next: "Next Step", publish: "Publish Assignment", save: "Save Changes", select: "Select a test", close: "Close" },
    toasts: { updated: "Assignment Updated!", published: "Assignment Published!", fail: "Failed to save", needDue: "This test reveals results after the due date — set a deadline first" }
  },
  ru: {
    titleCreate: "Назначить Тест", titleEdit: "Редактировать Задание", titleConfig: "Настройка Правил",
    search: "Поиск в библиотеке...",
    empty: { title: "Библиотека пуста", desc: "Создайте шаблон теста перед назначением.", btn: "Создать Тест" },
    list: { loadMore: "Загрузить еще 10", loading: "Загрузка...", notFound: "Тесты не найдены." },
    questions: "Вопросов", noLimit: "Без лимита",
    config: {
      instructions: "Инструкции", instPlace: "Напр.: Прочитайте правила перед началом...",
      attempts: "Допустимые попытки", maxAttempts: "Макс. попыток:", unlimited: "Безлимит", setUnlimited: "Сделать безлимитным",
      schedule: "Расписание", openDate: "Дата Открытия", dueDate: "Срок Сдачи", now: "Сейчас", noDeadline: "Без срока",
      presets: { plus1: "+1 День", plus3: "+3 Дня", plus7: "+7 Дней", clear: "Очистить" },
      assignTo: "Кому Назначить", all: "Всем Ученикам", individual: "Выбрать Индивидуально", noStudents: "В классе нет учеников."
    },
    buttons: { back: "Назад", next: "Далее", publish: "Опубликовать", save: "Сохранить Изменения", select: "Выберите тест", close: "Закрыть" },
    toasts: { updated: "Задание Обновлено!", published: "Опубликовано!", fail: "Ошибка сохранения", needDue: "Этот тест показывает результаты после дедлайна — укажите срок сдачи" }
  }
};

interface Props {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  roster: any[];
  editData?: any;
}

export default function AssignTestModal({ classId, isOpen, onClose, roster, editData }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = ASSIGN_MODAL_TRANSLATIONS[lang] || ASSIGN_MODAL_TRANSLATIONS['en'];

  // 🟢 SSR HYDRATION FIX FOR PORTAL
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Library Pagination State
  const [myTests, setMyTests] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [openAt, setOpenAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [description, setDescription] = useState('');
  const [assignMode, setAssignMode] = useState<'all' | 'individual'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allowedAttempts, setAllowedAttempts] = useState<number>(1);

  // Initialize Data
  useEffect(() => {
    if (isOpen && user) {
      if (editData) {
        setStep(2);
        setSelectedTest({ id: editData.testId, title: editData.testTitle, questionCount: editData.questionCount ?? 0 });
        setDescription(editData.description || '');
        setAllowedAttempts(editData.allowedAttempts ?? 1);

        const toInputString = (ts: any) => {
           if (!ts?.seconds) return '';
           const d = new Date(ts.seconds * 1000);
           d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
           return d.toISOString().slice(0, 16);
        };

        setOpenAt(toInputString(editData.openAt));
        setDueAt(toInputString(editData.dueAt));

        if (Array.isArray(editData.assignedTo)) {
          setAssignMode('individual');
          setSelectedStudentIds(editData.assignedTo);
        } else {
          setAssignMode('all');
        }

      } else {
        // Reset for Create Mode
        setStep(1); setOpenAt(''); setDueAt(''); setDescription('');
        setAssignMode('all'); setSelectedStudentIds([]); setSelectedTest(null);
        setAllowedAttempts(1); setSearchQuery(''); setMyTests([]); setLastDoc(null); setHasMore(true);

        fetchInitialTests();
      }
    }
  }, [isOpen, user, editData]);

  // --- FETCHING LOGIC (Matches Android Pagination) ---
  // Normalization boundary: custom_tests.questions[] may be legacy-shaped or
  // canonical v1. This modal never writes questions back (its payload is metadata
  // only), so the normalized list is safe to keep on the test object, and it gives
  // us a reliable questionCount for tests whose top-level counter is missing.
  const mapTestDoc = (d: DocumentSnapshot) => {
    const data = (d.data() || {}) as any;
    const rawQuestions: any[] = Array.isArray(data.questions) ? data.questions : [];
    return {
      id: d.id,
      ...data,
      questions: normalizeQuestions(rawQuestions, lang),
      questionCount: typeof data.questionCount === 'number' ? data.questionCount : rawQuestions.length,
    };
  };

  const fetchInitialTests = async () => {
    if (!user) return;
    setIsLoadingMore(true);
    try {
      const q = query(collection(db, 'custom_tests'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10));
      const snap = await getDocs(q);
      const tests = snap.docs.map(mapTestDoc);
      setMyTests(tests);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(tests.length >= 10);
    } catch (e) { console.error("Index error (Requires composite index)", e); } finally { setIsLoadingMore(false); }
  };

  const loadMoreTests = async () => {
    if (!user || !lastDoc) return;
    setIsLoadingMore(true);
    try {
      const q = query(collection(db, 'custom_tests'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(10));
      const snap = await getDocs(q);
      const newTests = snap.docs.map(mapTestDoc);
      setMyTests(prev => [...prev, ...newTests]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(newTests.length >= 10);
    } catch (e) { console.error(e); } finally { setIsLoadingMore(false); }
  };

  // Local Search Filtering (Matches Android)
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return myTests;
    return myTests.filter(test => test.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [myTests, searchQuery]);

  // --- ACTIONS ---
  const applyPreset = (type: '1_day' | '3_days' | '7_days' | 'clear') => {
    if (type === 'clear') { setDueAt(''); return; }

    const target = new Date();
    if (type === '1_day') target.setDate(target.getDate() + 1);
    if (type === '3_days') target.setDate(target.getDate() + 3);
    if (type === '7_days') target.setDate(target.getDate() + 7);

    // Android math explicitly sets 23:59 for deadline presets
    target.setHours(23, 59, 0, 0);
    target.setMinutes(target.getMinutes() - target.getTimezoneOffset());
    setDueAt(target.toISOString().slice(0, 16));
  };

  const handleAttemptsChange = (delta: number) => {
    if (delta === -1) {
      setAllowedAttempts(prev => prev > 1 ? prev - 1 : (prev === 1 ? 0 : 0));
    } else {
      setAllowedAttempts(prev => prev === 0 ? 1 : (prev < 10 ? prev + 1 : prev));
    }
  };

  const handleSave = async () => {
    if (!selectedTest || !user) return;
    setLoading(true);

    try {
      const openDate = openAt ? new Date(openAt) : new Date();
      const dueDate = dueAt ? new Date(dueAt) : null;

      // Denormalize `duration` / `resultsVisibility` from the test template onto
      // the assignment so the student assignment cards can show the real time
      // limit and result policy without an N+1 read of custom_tests. In edit mode
      // selectedTest is a stub ({id,title,questionCount}), so fetch the template.
      let testMeta: any = selectedTest;
      if (testMeta.duration === undefined && testMeta.resultsVisibility === undefined && testMeta.showResults === undefined) {
        const tSnap = await getDoc(doc(db, 'custom_tests', selectedTest.id));
        if (tSnap.exists()) testMeta = tSnap.data();
      }
      const resultsVisibility = testMeta.resultsVisibility || (testMeta.showResults ? 'always' : 'never');

      // 'after_due' without a due date would either hide results forever (student
      // side holds them) or leak them instantly (old behavior) — force a deadline.
      if (resultsVisibility === 'after_due' && !dueDate) {
        toast.error(t.toasts.needDue);
        setLoading(false);
        return;
      }

      const payload = {
        testId: selectedTest.id,
        testTitle: selectedTest.title,
        // never `undefined` — Firestore rejects it (see CLAUDE.md cross-cutting traps)
        questionCount: selectedTest.questionCount ?? 0,
        duration: testMeta.duration ?? null,
        resultsVisibility,
        description: description.trim(),
        openAt: openDate,
        dueAt: dueDate,
        assignedTo: assignMode === 'all' ? 'all' : selectedStudentIds,
        allowedAttempts: allowedAttempts,
        status: 'active',
        teacherId: user.uid
      };

      if (editData) {
        await updateDoc(doc(db, 'classes', classId, 'assignments', editData.id), payload);
        toast.success(t.toasts.updated);
      } else {
        await addDoc(collection(db, 'classes', classId, 'assignments'), { ...payload, createdAt: serverTimestamp() });
        toast.success(t.toasts.published);

        // Notifications
        const targets = assignMode === 'all' ? roster.map(r => r.uid) : selectedStudentIds;
        targets.forEach(uid => {
          if(uid) sendNotification(uid, 'assignment', 'New Test Assigned', `You have a new test: ${selectedTest.title}`, `/classes/${classId}`);
        });
      }
      onClose();
    } catch (error) {
      toast.error(t.toasts.fail);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (uid: string) => setSelectedStudentIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  if (!mounted || !isOpen) return null;

  // 🟢 WRAPPED IN CREATE PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Premium Backdrop */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 🟢 ULTRA MINIMALISTIC MOBILE-FIRST MODAL */}
      <div className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] shadow-elev-3 animate-in slide-in-from-bottom-10 sm:zoom-in-95 fade-in duration-300">

        {/* HEADER */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-outline-variant bg-[color-mix(in_oklab,var(--m3-surface-container-low)_90%,transparent)] backdrop-blur-xl flex justify-between items-center shrink-0 z-20 shadow-elev-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-m3-md bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
               <FileText size={18} strokeWidth={2.5} className="sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-[16px] sm:text-[18px] font-black text-on-surface tracking-tight leading-tight">
              {editData ? t.titleEdit : (step === 1 ? t.titleCreate : t.titleConfig)}
            </h2>
          </div>
          <IconButton aria-label={t.buttons.close} size="sm" onClick={onClose} className="shrink-0">
            <X strokeWidth={2.5} />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-surface custom-scrollbar relative pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-8">

          {/* ================= STEP 1: SELECT TEST ================= */}
          {step === 1 && !editData && (
            <div className="space-y-4 sm:space-y-5">

              {/* Search Bar */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18}/>
                <input
                  type="text"
                  placeholder={t.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-surface-container-lowest border border-outline-variant rounded-m3-lg text-[13px] sm:text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all shadow-elev-1"
                />
              </div>

              {/* List or Empty State */}
              {myTests.length === 0 && !isLoadingMore ? (
                 <div className="py-3 sm:py-4 px-6 bg-surface-container-lowest rounded-m3-lg border-2 border-dashed border-outline-variant shadow-elev-1">
                    <EmptyState
                      icon={<BookOpen />}
                      title={t.empty.title}
                      description={t.empty.desc}
                      action={
                        <Button variant="tonal" size="sm" icon={<Plus />} onClick={() => router.push('/teacher/create')}>
                          {t.empty.btn}
                        </Button>
                      }
                    />
                 </div>
              ) : filteredTests.length === 0 && searchQuery ? (
                 <div className="text-center py-10 text-on-surface-variant font-bold text-[13px] sm:text-[14px]">{t.list.notFound}</div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {filteredTests.map(test => (
                    <div
                      key={test.id} onClick={() => setSelectedTest(test)}
                      className={`p-4 sm:p-5 rounded-m3-lg border cursor-pointer transition-all flex justify-between items-center group shadow-elev-1 active:scale-[0.98] sm:active:scale-100 ${selectedTest?.id === test.id ? 'border-primary bg-primary-container ring-2 ring-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)]' : 'border-outline-variant bg-surface-container-lowest hover:border-primary hover:shadow-elev-2'}`}
                    >
                      <div>
                        <p className={`font-black text-[14px] sm:text-[15px] transition-colors leading-snug ${selectedTest?.id === test.id ? 'text-on-primary-container' : 'text-on-surface group-hover:text-primary'}`}>{test.title}</p>
                        <p className="text-[11px] sm:text-[12px] font-bold text-on-surface-variant mt-1 uppercase tracking-widest">{test.questionCount} {t.questions} • {test.duration ? `${test.duration}m` : t.noLimit}</p>
                      </div>
                      {selectedTest?.id === test.id
                        ? <CheckCircle2 size={22} className="text-primary fill-primary-container shrink-0 sm:w-6 sm:h-6"/>
                        : <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-outline-variant group-hover:border-primary shrink-0 transition-colors"></div>
                      }
                    </div>
                  ))}

                  {/* Load More Button */}
                  {hasMore && !searchQuery && (
                    <div className="pt-3 pb-2 text-center">
                      <Button variant="outlined" size="sm" onClick={loadMoreTests} loading={isLoadingMore} className="mx-auto">
                        {isLoadingMore ? t.list.loading : t.list.loadMore}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: CONFIGURE ================= */}
          {step === 2 && (
            <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">

              {/* Description (With 200 Char Limit) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><AlignLeft size={14}/> {t.config.instructions}</label>
                  <span className={`text-[9px] sm:text-[10px] font-black tracking-widest ${description.length >= 190 ? 'text-error' : 'text-on-surface-variant'}`}>{description.length}/200</span>
                </div>
                <textarea rows={2} maxLength={200} placeholder={t.config.instPlace} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] sm:text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none resize-none transition-all shadow-elev-1" />
              </div>

              {/* Attempts (Android Stepper Match) */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 mb-2 sm:mb-3"><RotateCcw size={14}/> {t.config.attempts}</label>
                <div className="flex flex-row items-center justify-between bg-surface-container-lowest border border-outline-variant p-3 sm:p-4 rounded-m3-md shadow-elev-1 gap-2">
                  <span className="text-[13px] sm:text-[14px] font-black text-on-surface leading-tight">{allowedAttempts === 0 ? t.config.unlimited : t.config.maxAttempts}</span>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {allowedAttempts > 0 && (
                      <button onClick={() => setAllowedAttempts(0)} className="text-[11px] sm:text-[12px] font-bold text-primary hover:underline transition-colors hidden sm:block">{t.config.setUnlimited}</button>
                    )}
                    <div className="flex items-center bg-surface-container-high border border-outline-variant rounded-m3-md shadow-inner p-1">
                      <button onClick={() => handleAttemptsChange(-1)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-m3-sm bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:shadow-elev-1 border border-transparent hover:border-outline-variant transition-all active:scale-95"><Minus size={16}/></button>
                      <span className="w-10 sm:w-12 text-center text-[15px] sm:text-[16px] font-black text-primary">{allowedAttempts === 0 ? '∞' : allowedAttempts}</span>
                      <button onClick={() => handleAttemptsChange(1)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-m3-sm bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:shadow-elev-1 border border-transparent hover:border-outline-variant transition-all active:scale-95"><Plus size={16}/></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing (Exact Math Presets) */}
              <div className="space-y-3 sm:space-y-4 pt-4 border-t border-outline-variant">
                <h3 className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Clock size={14}/> {t.config.schedule}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-surface-container-lowest border border-outline-variant p-3 sm:p-4 rounded-m3-md shadow-elev-1">
                    <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.config.openDate}</label>
                    <input type="datetime-local" className="w-full bg-surface-container border border-outline-variant p-2 sm:p-2.5 rounded-m3-sm text-[12px] sm:text-[13px] font-bold text-on-surface focus:border-primary focus:bg-surface-container-lowest outline-none transition-colors" value={openAt} onChange={e => setOpenAt(e.target.value)} />
                  </div>
                  <div className="bg-surface-container-lowest border border-outline-variant p-3 sm:p-4 rounded-m3-md shadow-elev-1">
                    <label className="block text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.config.dueDate}</label>
                    <input type="datetime-local" className="w-full bg-surface-container border border-outline-variant p-2 sm:p-2.5 rounded-m3-sm text-[12px] sm:text-[13px] font-bold text-on-surface focus:border-primary focus:bg-surface-container-lowest outline-none transition-colors" value={dueAt} onChange={e => setDueAt(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: t.config.presets.plus1, type: '1_day' as const },
                    { label: t.config.presets.plus3, type: '3_days' as const },
                    { label: t.config.presets.plus7, type: '7_days' as const }
                  ].map(preset => (
                    <button key={preset.type} onClick={() => applyPreset(preset.type)} className="px-3 sm:px-4 py-1.5 bg-surface-container-lowest border border-outline-variant hover:border-primary hover:bg-primary-container hover:text-on-primary-container text-[10px] sm:text-[11px] font-black text-on-surface-variant rounded-m3-sm transition-all shadow-elev-1 active:scale-95">
                      {preset.label}
                    </button>
                  ))}
                  <button onClick={() => applyPreset('clear')} className="m3-interactive px-3 sm:px-4 py-1.5 bg-error-container border border-transparent text-[10px] sm:text-[11px] font-black text-on-error-container rounded-m3-sm transition-all active:scale-95">
                    {t.config.presets.clear}
                  </button>
                </div>
              </div>

              {/* Assignees (Segmented Apple-Style Tabs) */}
              <div className="space-y-3 sm:space-y-4 pt-4 border-t border-outline-variant">
                <h3 className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Users size={14}/> {t.config.assignTo}</h3>

                <div className="flex p-1.5 bg-inverse-surface rounded-m3-lg shadow-inner">
                  <button onClick={() => setAssignMode('all')} className={`flex-1 py-2 text-[11px] sm:text-[12px] font-bold rounded-m3-md transition-all ${assignMode === 'all' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-[color-mix(in_oklab,var(--m3-inverse-on-surface)_65%,transparent)] hover:text-inverse-on-surface'}`}>
                    {t.config.all}
                  </button>
                  <button onClick={() => setAssignMode('individual')} className={`flex-1 py-2 text-[11px] sm:text-[12px] font-bold rounded-m3-md transition-all ${assignMode === 'individual' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-[color-mix(in_oklab,var(--m3-inverse-on-surface)_65%,transparent)] hover:text-inverse-on-surface'}`}>
                    {t.config.individual}
                  </button>
                </div>

                {assignMode === 'individual' && (
                  <div className="max-h-48 sm:max-h-56 overflow-y-auto border border-outline-variant rounded-m3-lg p-2 sm:p-3 space-y-1.5 bg-surface-container-lowest shadow-elev-1 custom-scrollbar">
                    {roster.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-6 text-on-surface-variant border border-dashed border-outline-variant rounded-m3-md bg-surface-container">
                         <AlertTriangle size={24} className="mb-2 text-outline"/>
                         <p className="text-[11px] sm:text-[12px] font-bold">{t.config.noStudents}</p>
                       </div>
                    ) : (
                      roster.map(student => {
                        const isChecked = selectedStudentIds.includes(student.uid);
                        return (
                          <div
                            key={student.uid} onClick={() => toggleStudent(student.uid)}
                            className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-m3-md cursor-pointer transition-all border active:scale-[0.98] sm:active:scale-100 ${isChecked ? 'bg-primary-container border-transparent shadow-elev-1' : 'bg-surface-container-lowest border-transparent hover:border-outline-variant hover:bg-state-hover'}`}
                          >
                            <div className={`w-5 h-5 rounded-m3-xs border-2 flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'bg-primary border-primary' : 'border-outline bg-surface-container-lowest'}`}>
                              {isChecked && <CheckCircle2 size={14} className="text-on-primary"/>}
                            </div>
                            <span className={`text-[12px] sm:text-[13px] font-bold truncate ${isChecked ? 'text-on-primary-container' : 'text-on-surface'}`}>{student.displayName}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-8 py-4 sm:py-4 border-t border-outline-variant bg-surface-container-low flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 z-20 shadow-[0_-10px_30px_rgb(0,0,0,0.03)]">
          {step === 2 && !editData && (
            <Button variant="tonal" onClick={() => setStep(1)} className="w-full sm:w-auto">
              {t.buttons.back}
            </Button>
          )}
          <Button
            variant="filled"
            onClick={() => step === 1 ? (selectedTest ? setStep(2) : toast.error(t.buttons.select)) : handleSave()}
            disabled={loading || (step === 1 && !selectedTest)}
            loading={loading}
            className="w-full sm:w-auto"
          >
            {step === 1 ? t.buttons.next : (editData ? t.buttons.save : t.buttons.publish)}
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}
