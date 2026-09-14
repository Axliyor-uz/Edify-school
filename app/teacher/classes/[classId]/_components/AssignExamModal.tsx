'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, getDocs, addDoc, updateDoc, 
  doc, serverTimestamp, orderBy, limit, startAfter 
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  X, Search, Calendar, Shield, EyeOff,
  FileBadge, ChevronRight, CheckCircle2, ArrowLeft, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton, Spinner } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const ASSIGN_EXAM_TRANSLATIONS: Record<string, any> = {
  uz: {
    titleEdit: "Imtihonni Tahrirlash", titleSelect: "Imtihonni tanlang", titleConfig: "Sozlamalar",
    back: "Orqaga", close: "Yopish",
    searchPlace: "Qidiruv...", questions: "Savol", loadMore: "Yana yuklash",
    searchEmpty: "Yuklanganlar orasidan topilmadi. Qidiruvni tozalab \"Yana yuklash\" tugmasini bosing.",
    timeSection: "Vaqt va Davomiylik", startLabel: "Boshlanish vaqti", durationLabel: "Davomiyligi (minut)",
    min: (n: number) => `${n} daq`, hour: (n: number) => `${n} soat`,
    securitySection: "Xavfsizlik", hideResults: "Natijalarni Yashirish", hideResultsDesc: "O'quvchilar to'g'ri javoblarni ko'rmaydi.",
    next: "Keyingi qadam", saveChanges: "O'zgarishlarni Saqlash", schedule: "Imtihonni rejalashtirish",
    toasts: {
      loadMoreFail: "Ko'proq yuklashda xatolik yuz berdi", fillAll: "Iltimos, barcha maydonlarni to'ldiring.",
      updated: "Imtihon sozlamalari yangilandi!", saved: "Imtihon muvaffaqiyatli saqlandi!", saveFail: "Saqlashda xatolik yuz berdi."
    }
  },
  en: {
    titleEdit: "Edit Exam", titleSelect: "Select an Exam", titleConfig: "Settings",
    back: "Back", close: "Close",
    searchPlace: "Search...", questions: "Questions", loadMore: "Load more",
    searchEmpty: "No match among loaded exams. Clear the search and press \"Load more\".",
    timeSection: "Time & Duration", startLabel: "Start time", durationLabel: "Duration (minutes)",
    min: (n: number) => `${n} min`, hour: (n: number) => `${n} hr`,
    securitySection: "Security", hideResults: "Hide Results", hideResultsDesc: "Students will not see the correct answers.",
    next: "Next step", saveChanges: "Save Changes", schedule: "Schedule Exam",
    toasts: {
      loadMoreFail: "Failed to load more", fillAll: "Please fill in all fields.",
      updated: "Exam settings updated!", saved: "Exam saved successfully!", saveFail: "Failed to save."
    }
  },
  ru: {
    titleEdit: "Редактировать Экзамен", titleSelect: "Выберите экзамен", titleConfig: "Настройки",
    back: "Назад", close: "Закрыть",
    searchPlace: "Поиск...", questions: "Вопросов", loadMore: "Загрузить еще",
    searchEmpty: "Среди загруженных не найдено. Очистите поиск и нажмите \"Загрузить еще\".",
    timeSection: "Время и Длительность", startLabel: "Время начала", durationLabel: "Длительность (минут)",
    min: (n: number) => `${n} мин`, hour: (n: number) => `${n} ч`,
    securitySection: "Безопасность", hideResults: "Скрыть Результаты", hideResultsDesc: "Ученики не увидят правильные ответы.",
    next: "Следующий шаг", saveChanges: "Сохранить Изменения", schedule: "Запланировать Экзамен",
    toasts: {
      loadMoreFail: "Ошибка при загрузке", fillAll: "Пожалуйста, заполните все поля.",
      updated: "Настройки экзамена обновлены!", saved: "Экзамен успешно сохранен!", saveFail: "Ошибка при сохранении."
    }
  }
};

export default function AssignExamModal({ classId, isOpen, onClose, editData }: any) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = ASSIGN_EXAM_TRANSLATIONS[lang] || ASSIGN_EXAM_TRANSLATIONS['uz'];
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // PAGINATION STATES
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Exam Logic States
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [examDate, setExamDate] = useState('');
  const [duration, setDuration] = useState(45);
  const [hideResults, setHideResults] = useState(true);

  // PRE-FILL DATA FOR EDITING
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setStep(2); 
        setSelectedExam({ id: editData.testId, title: editData.title, assessmentType: editData.assessmentType });
        
        const dateObj = editData.examDate.toDate();
        const offset = dateObj.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
        
        setExamDate(localISOTime);
        setDuration(editData.durationMinutes);
        setHideResults(editData.hideResults);
      } else {
        setStep(1);
        setSelectedExam(null);
        setExamDate('');
        setDuration(45);
        setHideResults(true);
      }
    }
  }, [isOpen, editData]);

  // INITIAL FETCH
  useEffect(() => {
    if (isOpen && user && step === 1 && !editData) {
      const fetchInitialExams = async () => {
        setLoading(true);
        try {
          const q = query(
            collection(db, 'bsb_chsb_tests'), 
            where('teacherId', '==', user.uid), 
            orderBy('createdAt', 'desc'), 
            limit(10)
          );
          const snap = await getDocs(q);
          setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          
          setLastDoc(snap.docs[snap.docs.length - 1]);
          setHasMore(snap.docs.length === 10);
        } catch (error) {
          console.error("Fetch error:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchInitialExams();
    }
  }, [isOpen, user, step, editData]);

  // LOAD MORE FUNCTION
  const loadMoreExams = async () => {
    if (!lastDoc || !user) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'bsb_chsb_tests'), 
        where('teacherId', '==', user.uid), 
        orderBy('createdAt', 'desc'), 
        startAfter(lastDoc),
        limit(10)
      );
      const snap = await getDocs(q);
      
      setExams(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 10);
    } catch (error) {
      toast.error(t.toasts.loadMoreFail);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSave = async () => {
    if (!selectedExam || !examDate) return toast.error(t.toasts.fillAll);
    setLoading(true);

    try {
      if (editData) {
        await updateDoc(doc(db, 'classes', classId, 'exams', editData.id), {
          examDate: new Date(examDate),
          durationMinutes: duration,
          hideResults: hideResults,
        });
        toast.success(t.toasts.updated);
      } else {
        const payload = {
          testId: selectedExam.id,
          title: selectedExam.title,
          assessmentType: selectedExam.assessmentType, 
          examDate: new Date(examDate),
          durationMinutes: duration,
          hideResults: hideResults,
          submittedStudentIds: [], 
          status: 'scheduled',
          teacherId: user?.uid,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'classes', classId, 'exams'), payload);
        toast.success(t.toasts.saved);
      }
      onClose();
    } catch (e) {
      toast.error(t.toasts.saveFail);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 HELPER: Set quick start time relative to NOW
  const setQuickStartTime = (minutesToAdd: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutesToAdd);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    setExamDate(localISOTime);
  };

  const filteredExams = useMemo(() => exams.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase())), [exams, searchQuery]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] shadow-elev-3 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">

        {/* HEADER */}
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
             {step === 2 && !editData ? (
               <IconButton aria-label={t.back} onClick={() => setStep(1)}><ArrowLeft size={18} /></IconButton>
             ) : (
                <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1"><FileBadge size={20} strokeWidth={2.5} /></div>
             )}
            <h2 className="text-[16px] font-black text-on-surface uppercase tracking-tight">
              {editData ? t.titleEdit : (step === 1 ? t.titleSelect : t.titleConfig)}
            </h2>
          </div>
          <IconButton aria-label={t.close} onClick={onClose}><X size={18}/></IconButton>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface space-y-6 custom-scrollbar pb-20 sm:pb-8">
            {step === 1 && !editData ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18}/>
                <input
                  type="text"
                  placeholder={t.searchPlace}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-lg text-[14px] font-bold text-on-surface outline-none focus:border-primary shadow-elev-1 transition-colors"
                />
              </div>

              <div className="space-y-2.5">
                {loading && exams.length === 0 ? (
                  <div className="py-10 flex justify-center"><Spinner /></div>
                ) : (
                  <>
                    {filteredExams.map(exam => (
                      <div key={exam.id} onClick={() => setSelectedExam(exam)} className={`p-4 rounded-m3-lg border transition-all cursor-pointer flex justify-between items-center active:scale-[0.98] ${selectedExam?.id === exam.id ? 'border-primary bg-primary-container shadow-elev-1 ring-2 ring-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)]' : 'border-outline-variant bg-surface-container-lowest hover:border-primary'}`}>
                        <div className="min-w-0 pr-4">
                          <p className="font-black text-[14px] text-on-surface truncate">{exam.title}</p>
                          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">{exam.assessmentType} • {exam.questionCount} {t.questions}</p>
                        </div>
                        {selectedExam?.id === exam.id && <CheckCircle2 size={20} className="text-primary shrink-0" />}
                      </div>
                    ))}

                    {hasMore && !searchQuery && (
                      <button
                        onClick={loadMoreExams}
                        disabled={loadingMore}
                        className="w-full py-4 mt-2 bg-surface-container-lowest border-2 border-dashed border-outline-variant hover:border-outline hover:bg-surface-container text-on-surface-variant font-bold rounded-m3-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-[13px]"
                      >
                        {loadingMore ? <Spinner size={16}/> : <RefreshCw size={16}/>}
                        {t.loadMore}
                      </button>
                    )}

                    {searchQuery && filteredExams.length === 0 && (
                       <p className="text-center text-[12px] font-bold text-on-surface-variant py-6">{t.searchEmpty}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in slide-in-from-right-5 duration-300">
              <div className="bg-surface-container-lowest p-5 rounded-m3-lg border border-outline-variant shadow-elev-1 space-y-4">
                <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Calendar size={14}/> {t.timeSection}</h3>

                {/* 🟢 START TIME WITH QUICK SELECT */}
                <div>
                  <label className="block text-[12px] font-bold text-on-surface mb-2 ml-1">{t.startLabel}</label>
                  <input type="datetime-local" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full bg-surface-container border border-outline-variant p-3 rounded-m3-md font-bold text-on-surface outline-none focus:border-primary transition-colors" />
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {[
                      { label: `+${t.min(10)}`, val: 10 },
                      { label: `+${t.hour(1)}`, val: 60 },
                      { label: `+${t.hour(2)}`, val: 120 },
                      { label: `+${t.hour(24)}`, val: 1440 }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setQuickStartTime(opt.val)}
                        className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant text-[11px] font-black rounded-m3-sm transition-all active:scale-95 border border-outline-variant"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 🟢 DURATION WITH QUICK SELECT */}
                <div className="pt-3 border-t border-outline-variant">
                  <label className="block text-[12px] font-bold text-on-surface mb-2 ml-1">{t.durationLabel}</label>
                  <input type="number" min="5" max="300" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-surface-container border border-outline-variant p-3 rounded-m3-md font-bold text-on-surface outline-none focus:border-primary transition-colors" />
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {[30, 45, 60, 90, 120].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDuration(val)}
                        className={`px-3 py-1.5 text-[11px] font-black rounded-m3-sm transition-all active:scale-95 border ${
                          duration === val
                            ? 'bg-primary text-on-primary border-primary shadow-elev-1'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant border-outline-variant'
                        }`}
                      >
                        {val === 60 ? t.hour(1) : val === 120 ? t.hour(2) : t.min(val)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-5 rounded-m3-lg border border-outline-variant shadow-elev-1 space-y-4">
                <h3 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Shield size={14}/> {t.securitySection}</h3>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="pr-4">
                    <span className="text-[13px] md:text-[14px] font-black text-on-surface flex items-center gap-1.5"><EyeOff size={16} className="text-primary"/> {t.hideResults}</span>
                    <p className="text-[11px] font-bold text-on-surface-variant mt-1">{t.hideResultsDesc}</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 relative ${hideResults ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                    <div className={`w-4 h-4 bg-surface-container-lowest rounded-full shadow-elev-1 transition-transform ${hideResults ? 'translate-x-6' : 'translate-x-0'}`}/>
                  </div>
                  <input type="checkbox" checked={hideResults} onChange={() => setHideResults(!hideResults)} className="hidden"/>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 z-20 shadow-[0_-10px_30px_rgb(0,0,0,0.03)]">
          {step === 1 && !editData ? (
            <button disabled={!selectedExam} onClick={() => setStep(2)} className="m3-interactive w-full py-3.5 sm:py-4 bg-inverse-surface text-inverse-on-surface font-black rounded-m3-md active:scale-95 disabled:bg-disabled-bg disabled:text-disabled-fg transition-all flex items-center justify-center gap-2 shadow-elev-2">{t.next} <ChevronRight size={18} /></button>
          ) : (
            <Button
              variant="filled"
              size="lg"
              disabled={loading}
              loading={loading && step === 2}
              onClick={handleSave}
              icon={<FileBadge size={18} />}
              className="w-full"
            >
              {editData ? t.saveChanges : t.schedule}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}