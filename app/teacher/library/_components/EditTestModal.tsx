'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  X, Save, Trash2, Archive, RefreshCw, Settings, FileText,
  Clock, CheckCircle, Shield, Eye, EyeOff, CalendarClock, AlertTriangle, PenLine
} from 'lucide-react';
import CartItem from '../../create/_components/CartItem'; // Adjust path if needed
import { normalizeQuestions } from '@/lib/questionSchema';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Button, IconButton, Switch } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const EDIT_TEST_TRANSLATIONS: Record<string, any> = {
  uz: {
    title: "Testni Boshqarish", tabs: { settings: "Sozlamalar", questions: "Savollar" },
    settings: {
      name: "Test Nomi", duration: "Vaqt", mins: "daq", none: "Cheklovsiz", custom: "MAXSUS", unlimited: "(Cheklovsiz)",
      shuffleTitle: "Savollarni Aralashtirish", shuffleDesc: "Har bir o'quvchi uchun tartibni o'zgartirish",
      securityTitle: "Javoblar Xavfsizligi",
      afterDue: { title: "Muddatdan keyin", desc: "Muddat tugagach ochiladi." },
      never: { title: "Hech qachon", desc: "Faqat yakuniy ball." },
      always: { title: "Darhol", desc: "Topshirgach ochiladi." },
      danger: "Xavfli Hudud", archive: "Arxivlash", restore: "Tiklash", delete: "O'chirish"
    },
    questions: { empty: "Savollar mavjud emas." }, buttons: { save: "Saqlash", saving: "Saqlanmoqda...", close: "Yopish" },
    toasts: { saved: "Saqlandi!", failSave: "Xatolik", archived: "Arxivlandi", restored: "Tiklandi", failStatus: "Xatolik", deleted: "O'chirildi", failDelete: "Xatolik", confirmDelete: "Ishonchingiz komilmi? Qaytarib bo'lmaydi." }
  },
  en: {
    title: "Manage Test", tabs: { settings: "Settings", questions: "Questions" },
    settings: {
      name: "Test Name", duration: "Time", mins: "min", none: "No limit", custom: "CUSTOM", unlimited: "(No limit)",
      shuffleTitle: "Shuffle Questions", shuffleDesc: "Change the order for every student",
      securityTitle: "Answer Security",
      afterDue: { title: "After due date", desc: "Revealed once the deadline passes." },
      never: { title: "Never", desc: "Final score only." },
      always: { title: "Immediately", desc: "Revealed upon submission." },
      danger: "Danger Zone", archive: "Archive", restore: "Restore", delete: "Delete"
    },
    questions: { empty: "No questions available." }, buttons: { save: "Save", saving: "Saving...", close: "Close" },
    toasts: { saved: "Saved!", failSave: "Error", archived: "Archived", restored: "Restored", failStatus: "Error", deleted: "Deleted", failDelete: "Error", confirmDelete: "Are you sure? This cannot be undone." }
  },
  ru: {
    title: "Управление Тестом", tabs: { settings: "Настройки", questions: "Вопросы" },
    settings: {
      name: "Название Теста", duration: "Время", mins: "мин", none: "Без лимита", custom: "СВОЁ", unlimited: "(Без лимита)",
      shuffleTitle: "Перемешать Вопросы", shuffleDesc: "Менять порядок для каждого ученика",
      securityTitle: "Безопасность Ответов",
      afterDue: { title: "После дедлайна", desc: "Откроются после срока сдачи." },
      never: { title: "Никогда", desc: "Только итоговый балл." },
      always: { title: "Сразу", desc: "Откроются после отправки." },
      danger: "Опасная Зона", archive: "Архивировать", restore: "Восстановить", delete: "Удалить"
    },
    questions: { empty: "Вопросов нет." }, buttons: { save: "Сохранить", saving: "Сохранение...", close: "Закрыть" },
    toasts: { saved: "Сохранено!", failSave: "Ошибка", archived: "В архиве", restored: "Восстановлено", failStatus: "Ошибка", deleted: "Удалено", failDelete: "Ошибка", confirmDelete: "Вы уверены? Это нельзя отменить." }
  }
};

interface Props { test: any; isOpen: boolean; onClose: () => void; }

export default function EditTestModal({ test, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('settings');
  const [isSaving, setIsSaving] = useState(false);
  const { lang } = useTeacherLanguage();
  const t = EDIT_TEST_TRANSLATIONS[lang] || EDIT_TEST_TRANSLATIONS['uz'];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [settings, setSettings] = useState({
    title: '', duration: 0, shuffle: false, resultsVisibility: 'never' as 'always' | 'never' | 'after_due', status: 'active'
  });

  // ⚠️ THIS ARRAY IS WHAT GETS WRITTEN BACK TO FIRESTORE.
  // It holds the ORIGINAL, untouched question docs (legacy-shaped or canonical v1)
  // exactly as they were stored in custom_tests.questions[]. It is never a
  // NormalizedQuestion — those carry a `raw` field and a rewritten shape, and
  // persisting them would corrupt the saved test.
  const [rawQuestions, setRawQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (test) {
      let visibility = test.resultsVisibility;
      if (!visibility) visibility = test.showResults ? 'always' : 'never';
      setSettings({ title: test.title || '', duration: test.duration || 0, shuffle: test.shuffle || false, resultsVisibility: visibility, status: test.status || 'active' });

      // The library page hands us questions that have already been normalized for
      // display, so unwrap `.raw` back to the original doc. If a caller passes raw
      // questions straight from Firestore (no `.raw`), they are kept as-is.
      const source: any[] = Array.isArray(test.questions) ? test.questions : [];
      setRawQuestions(source.map((q: any) => (q && typeof q === 'object' && q.raw ? q.raw : q)));
    }
  }, [test]);

  // Display-only view model. Never written anywhere.
  const displayQuestions = useMemo(() => normalizeQuestions(rawQuestions, lang), [rawQuestions, lang]);

  if (!isOpen) return null;

  // Remove by INDEX, not by id: legacy snapshots are not guaranteed to carry a
  // unique `id`, and an empty id would otherwise delete every id-less question.
  const handleRemoveQuestion = (index: number) =>
    setRawQuestions(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'custom_tests', test.id);
      // `rawQuestions` — the original docs, minus any the teacher removed.
      await updateDoc(docRef, { ...settings, showResults: settings.resultsVisibility === 'always', questions: rawQuestions, questionCount: rawQuestions.length });
      toast.success(t.toasts.saved);
      onClose();
    } catch (error) { toast.error(t.toasts.failSave); } finally { setIsSaving(false); }
  };

  const handleArchiveToggle = async () => {
    const newStatus = settings.status === 'active' ? 'archived' : 'active';
    try {
      await updateDoc(doc(db, 'custom_tests', test.id), { status: newStatus });
      toast.success(newStatus === 'archived' ? t.toasts.archived : t.toasts.restored);
      onClose();
    } catch (e) { toast.error(t.toasts.failStatus); }
  };

  const handleDeleteTest = async () => {
    if (!confirm(t.toasts.confirmDelete)) return;
    try {
      await deleteDoc(doc(db, 'custom_tests', test.id));
      toast.success(t.toasts.deleted);
      onClose();
    } catch (e) { toast.error(t.toasts.failDelete); }
  };

  const durationOptions = [0, 10, 20, 30, 45, 60];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose}></motion.div>

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden shadow-elev-3 z-10"
          >

            {/* 🟢 HEADER */}
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center z-20 shrink-0 bg-surface-container-low">
              <div className="flex-1 mr-4 min-w-0">
                <div className="flex items-center gap-2 group">
                  <input
                    type="text" value={settings.title} onChange={(e) => setSettings({...settings, title: e.target.value})} placeholder={t.settings.name}
                    className="text-[16px] md:text-[18px] font-black text-on-surface bg-transparent border-none outline-none w-full placeholder:text-on-surface-variant focus:ring-0 p-0 truncate"
                  />
                  <PenLine size={14} className="text-outline group-focus-within:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">PIN:</span>
                  <span className="bg-surface-container text-primary font-mono text-[11px] font-black px-2 py-0.5 rounded-m3-xs border border-outline-variant">{test.accessCode}</span>
                </div>
              </div>
              <IconButton aria-label={t.buttons.close} onClick={onClose} className="shrink-0">
                <X size={20}/>
              </IconButton>
            </div>

            {/* 🟢 TABS */}
            <div className="px-5 flex border-b border-outline-variant z-10 shrink-0 bg-surface-container-low">
              <button onClick={() => setActiveTab('settings')} className={`py-3 px-2 mr-6 text-[13px] md:text-[14px] font-black flex items-center gap-2 border-b-2 transition-all ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                <Settings size={16} strokeWidth={2.5} /> {t.tabs.settings}
              </button>
              <button onClick={() => setActiveTab('questions')} className={`py-3 px-2 text-[13px] md:text-[14px] font-black flex items-center gap-2 border-b-2 transition-all ${activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                <FileText size={16} strokeWidth={2.5} /> {t.tabs.questions}
                <span className={`px-2 py-0.5 rounded-m3-xs text-[10px] ${activeTab === 'questions' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>{rawQuestions.length}</span>
              </button>
            </div>

            {/* 🟢 SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 bg-surface-container">

              {activeTab === 'settings' && (
                <div className="max-w-2xl mx-auto space-y-6">

                  {/* Duration */}
                  <div className="bg-surface-container-low p-4 md:p-5 rounded-m3-lg shadow-elev-1">
                    <label className="text-[12px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <Clock size={14} className="text-primary"/> {t.settings.duration}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {durationOptions.map((mins) => (
                        <button key={mins} onClick={() => setSettings({ ...settings, duration: mins })} className={`px-4 py-2 rounded-m3-md text-[13px] font-bold transition-all border ${settings.duration === mins ? 'bg-primary border-primary text-on-primary shadow-elev-1' : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary'}`}>
                          {mins === 0 ? t.settings.none : `${mins} ${t.settings.mins}`}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 px-2 bg-surface-container border border-outline-variant rounded-m3-md focus-within:border-primary focus-within:ring-2 focus-within:ring-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)] transition-all">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pl-2">{t.settings.custom}</span>
                        <input type="number" min="0" value={settings.duration} onChange={(e) => setSettings({...settings, duration: Number(e.target.value)})} className="w-14 bg-transparent text-[13px] font-bold text-center text-on-surface outline-none py-2" />
                      </div>
                    </div>
                  </div>

                  {/* Shuffle */}
                  <div className="bg-surface-container-low p-4 md:p-5 rounded-m3-lg shadow-elev-1 flex items-center justify-between">
                    <div>
                        <div className="text-[14px] font-black text-on-surface">{t.settings.shuffleTitle}</div>
                        <p className="text-[12px] text-on-surface-variant font-medium mt-0.5">{t.settings.shuffleDesc}</p>
                    </div>
                    <Switch checked={settings.shuffle} onChange={() => setSettings({...settings, shuffle: !settings.shuffle})} />
                  </div>

                  {/* Visibility */}
                  <div className="bg-surface-container-low p-4 md:p-5 rounded-m3-lg shadow-elev-1">
                    <label className="text-[12px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <Shield size={14} className="text-primary"/> {t.settings.securityTitle}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button onClick={() => setSettings({...settings, resultsVisibility: 'never'})} className={`p-3 rounded-m3-md border-2 flex items-center gap-3 text-left transition-all ${settings.resultsVisibility === 'never' ? 'border-inverse-surface bg-inverse-surface text-inverse-on-surface shadow-elev-2' : 'border-outline-variant hover:border-outline bg-surface-container text-on-surface'}`}>
                        <div className={`p-2 rounded-m3-sm shrink-0 ${settings.resultsVisibility === 'never' ? 'bg-[color-mix(in_oklab,var(--m3-inverse-on-surface)_20%,transparent)] text-inverse-on-surface' : 'bg-surface-container-lowest shadow-elev-1 text-on-surface-variant'}`}><EyeOff size={16} /></div>
                        <div className="leading-tight"><p className="text-[13px] font-bold mb-0.5">{t.settings.never.title}</p><p className={`text-[10px] font-medium ${settings.resultsVisibility === 'never' ? 'text-inverse-on-surface' : 'text-on-surface-variant'}`}>{t.settings.never.desc}</p></div>
                      </button>
                      <button onClick={() => setSettings({...settings, resultsVisibility: 'after_due'})} className={`p-3 rounded-m3-md border-2 flex items-center gap-3 text-left transition-all ${settings.resultsVisibility === 'after_due' ? 'border-success bg-success-container text-on-success-container shadow-elev-2' : 'border-outline-variant hover:border-success bg-surface-container text-on-surface'}`}>
                        <div className={`p-2 rounded-m3-sm shrink-0 ${settings.resultsVisibility === 'after_due' ? 'bg-success text-surface-container-lowest' : 'bg-surface-container-lowest shadow-elev-1 text-success'}`}><CalendarClock size={16} /></div>
                        <div className="leading-tight"><p className="text-[13px] font-bold mb-0.5">{t.settings.afterDue.title}</p><p className={`text-[10px] font-medium ${settings.resultsVisibility === 'after_due' ? 'text-on-success-container' : 'text-on-surface-variant'}`}>{t.settings.afterDue.desc}</p></div>
                      </button>
                      <button onClick={() => setSettings({...settings, resultsVisibility: 'always'})} className={`p-3 rounded-m3-md border-2 flex items-center gap-3 text-left transition-all ${settings.resultsVisibility === 'always' ? 'border-warning bg-warning-container text-on-warning-container shadow-elev-2' : 'border-outline-variant hover:border-warning bg-surface-container text-on-surface'}`}>
                        <div className={`p-2 rounded-m3-sm shrink-0 ${settings.resultsVisibility === 'always' ? 'bg-warning text-surface-container-lowest' : 'bg-surface-container-lowest shadow-elev-1 text-warning'}`}><Eye size={16} /></div>
                        <div className="leading-tight"><p className="text-[13px] font-bold mb-0.5">{t.settings.always.title}</p><p className={`text-[10px] font-medium ${settings.resultsVisibility === 'always' ? 'text-on-warning-container' : 'text-on-surface-variant'}`}>{t.settings.always.desc}</p></div>
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-error-container p-4 md:p-5 rounded-m3-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] font-black text-on-error-container uppercase tracking-widest flex items-center gap-1.5 w-full sm:w-auto"><AlertTriangle size={14} /> {t.settings.danger}</p>
                    <div className="flex gap-2 w-full sm:w-auto">
                       <Button variant="elevated" onClick={handleArchiveToggle} className="flex-1 sm:flex-none" icon={settings.status === 'active' ? <Archive size={16}/> : <RefreshCw size={16}/>}>
                         {settings.status === 'active' ? t.settings.archive : t.settings.restore}
                       </Button>
                       <Button variant="danger" onClick={handleDeleteTest} className="flex-1 sm:flex-none" icon={<Trash2 size={16}/>}>
                         {t.settings.delete}
                       </Button>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'questions' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {/* CartItem renders the NORMALIZED question (legacy-shaped: options map,
                      answer letter, difficulty string) — display only. Removal acts on the
                      raw array by index, so the write path stays untouched. */}
                  {displayQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="bg-surface-container-low p-1 rounded-m3-lg shadow-elev-1"><CartItem question={q} index={idx + 1} onRemove={() => handleRemoveQuestion(idx)} /></div>
                  ))}
                  {displayQuestions.length === 0 && (
                    <div className="text-center py-16 bg-surface-container-low rounded-m3-lg border-2 border-dashed border-outline-variant flex flex-col items-center">
                      <div className="w-12 h-12 bg-surface-container rounded-m3-md flex items-center justify-center mb-3 shadow-elev-1"><AlertTriangle size={24} className="text-on-surface-variant"/></div>
                      <span className="text-[14px] font-bold text-on-surface-variant">{t.questions.empty}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🟢 FOOTER */}
            <div className="px-5 py-4 border-t border-outline-variant bg-surface-container-low flex justify-end shrink-0 z-20 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
               <Button variant="filled" size="lg" onClick={handleSave} loading={isSaving} icon={<Save size={18}/>} className="w-full sm:w-auto">
                 {isSaving ? t.buttons.saving : t.buttons.save}
               </Button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body // 🟢 TELLS THE PORTAL TO RENDER IN THE BODY
  );
}
