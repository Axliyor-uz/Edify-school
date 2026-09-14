'use client';

// Reading test library. The old fake DATABASE_TESTS tab is gone — the "Platform" tab now
// lists the real admin-curated dataset via fetchPlatformTests('reading') (read-only cards,
// preview via the simulator route). Cards show question-type breakdown chips.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { BookOpen, Plus, Search, Clock, MoreVertical, FileText, Globe, Trash2, Eye, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { fetchTeacherTests, fetchPlatformTests, deleteIeltsTest } from '@/services/ieltsService';
import { typeBreakdown } from '@/lib/ielts/testSchema';
import { breakdownChips } from '@/lib/ielts/typeLabels';

import { Button, IconButton, Spinner, SearchBar, EmptyState } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    subtitle: "Matnli testlarni yarating yoki platforma bazasidan foydalaning.",
    newTest: "Yangi Test",
    manualEntry: "Qo'lda kiritish",
    manualDesc: "Noldan o'zingiz tuzing",
    myTests: "Mening Testlarim",
    platform: "Platforma",
    platformBadge: "Platforma",
    searchPlaceholder: "Qidirish...",
    wordsSuffix: "ta so'z",
    questionsSuffix: "savol",
    view: "Ko'rish",
    edit: "Tahrirlash",
    moreActions: "Qo'shimcha amallar",
    delete: "O'chirish",
    noResults: "Natija topilmadi",
    untitled: "Nomsiz test",
    loadError: "Testlarni yuklashda xatolik yuz berdi.",
    deleteConfirm: "Haqiqatan ham bu testni butunlay o'chirib tashlamoqchimisiz?",
    deleteSuccess: "Test muvaffaqiyatli o'chirildi!",
    deleteError: "O'chirishda xatolik yuz berdi.",
  },
  en: {
    subtitle: "Create reading tests or use the platform library.",
    newTest: "New Test",
    manualEntry: "Manual entry",
    manualDesc: "Build it yourself from scratch",
    myTests: "My Tests",
    platform: "Platform",
    platformBadge: "Platform",
    searchPlaceholder: "Search...",
    wordsSuffix: "words",
    questionsSuffix: "questions",
    view: "View",
    edit: "Edit",
    moreActions: "More actions",
    delete: "Delete",
    noResults: "No results found",
    untitled: "Untitled Test",
    loadError: "Failed to load tests.",
    deleteConfirm: "Are you sure you want to permanently delete this test?",
    deleteSuccess: "Test deleted successfully!",
    deleteError: "Failed to delete.",
  },
  ru: {
    subtitle: "Создавайте текстовые тесты или используйте базу платформы.",
    newTest: "Новый тест",
    manualEntry: "Ручной ввод",
    manualDesc: "Составьте самостоятельно с нуля",
    myTests: "Мои тесты",
    platform: "Платформа",
    platformBadge: "Платформа",
    searchPlaceholder: "Поиск...",
    wordsSuffix: "слов",
    questionsSuffix: "вопросов",
    view: "Просмотр",
    edit: "Редактировать",
    moreActions: "Дополнительные действия",
    delete: "Удалить",
    noResults: "Ничего не найдено",
    untitled: "Тест без названия",
    loadError: "Не удалось загрузить тесты.",
    deleteConfirm: "Вы действительно хотите полностью удалить этот тест?",
    deleteSuccess: "Тест успешно удалён!",
    deleteError: "Не удалось удалить.",
  },
};

function mapDoc(d: any, untitled: string) {
  const totalWords = d.passages?.reduce((acc: number, p: any) => acc + (p.word_count || 0), 0) || 0;
  return {
    id: d.id,
    title: d.test_title || untitled,
    difficulty: d.passages?.[0]?.difficulty || 'medium',
    wordCount: totalWords,
    qCount: d.total_questions || 0,
    chips: breakdownChips(typeBreakdown(d)),
    date: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : 'N/A',
    rawDate: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0,
  };
}

export default function ReadingDashboard() {
  const { user } = useAuth() as any;
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [activeTab, setActiveTab] = useState<'myTests' | 'platform'>('myTests');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [myTests, setMyTests] = useState<any[]>([]);
  const [platformTests, setPlatformTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      setIsLoading(true);
      try {
        const [mine, platform] = await Promise.all([
          fetchTeacherTests('reading', user.uid),
          // audience 'teacher' → admin-hidden papers are dropped and the list arrives in
          // the admin's catalog order; do NOT re-sort it by date.
          fetchPlatformTests('reading', { audience: 'teacher' }),
        ]);
        setMyTests(mine.map((d) => mapDoc(d, t.untitled)).sort((a, b) => b.rawDate - a.rawDate));
        setPlatformTests(platform.map((d) => mapDoc(d, t.untitled)));
      } catch (error) {
        console.error(error);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Deletes the test AND its ielts_answer_keys doc in one batch.
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.deleteConfirm)) return;

    try {
      await deleteIeltsTest('reading', id);
      setMyTests(prev => prev.filter(test => test.id !== id));
      toast.success(t.deleteSuccess);
    } catch {
      toast.error(t.deleteError);
    }
    setOpenDropdownId(null);
  };

  const filteredData = (activeTab === 'myTests' ? myTests : platformTests).filter(test =>
    test.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500 font-t-body text-on-surface">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/teacher/ielts" className="w-8 h-8 rounded-m3-md bg-surface-container-low border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-all shrink-0 mr-1 shadow-elev-1">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
            <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1">
              <BookOpen size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight">IELTS Reading</h1>
          </div>
          <p className="text-[14px] font-medium text-on-surface-variant">{t.subtitle}</p>
        </div>

        {/* CREATION BUTTON WITH DROPDOWN */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <Button variant="filled" icon={<Plus />} onClick={() => setShowCreateMenu(!showCreateMenu)}>
            {t.newTest}
          </Button>

          <AnimatePresence>
            {showCreateMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-64 bg-surface-container-low rounded-m3-lg shadow-elev-3 border border-outline-variant p-2 z-50 origin-top-right">
                <Link href="/teacher/ielts/reading/manual" className="flex items-start gap-3 p-3 rounded-m3-md hover:bg-state-hover group transition-colors mt-1">
                  <div className="w-8 h-8 rounded-m3-sm bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0"><FileText size={16} /></div>
                  <div>
                    <h4 className="text-[13px] font-bold text-on-surface group-hover:text-primary">{t.manualEntry}</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{t.manualDesc}</p>
                  </div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex p-1 bg-surface-container rounded-m3-md w-full md:w-auto border border-outline-variant">
          <button onClick={() => setActiveTab('myTests')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'myTests' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <BookOpen size={14} /> {t.myTests}
          </button>
          <button onClick={() => setActiveTab('platform')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'platform' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <Globe size={14} /> {t.platform}
          </button>
        </div>

        <SearchBar placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-72" />
      </div>

      {/* DATA LIST */}
      <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Spinner size={28} className="mb-3" />
          </div>
        ) : filteredData.length > 0 ? (
          <div className="divide-y divide-outline-variant">
            {filteredData.map((test) => (
              <div key={test.id} className="p-4 md:p-5 hover:bg-state-hover transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-m3-md flex items-center justify-center shrink-0 shadow-elev-1 ${activeTab === 'platform' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}>
                    {activeTab === 'platform' ? <Globe size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="pt-0.5 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors">{test.title}</h3>
                      {activeTab === 'platform' && (
                        <span className="px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-widest bg-tertiary-container text-on-tertiary-container">{t.platformBadge}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <span className={`px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-widest ${test.difficulty === 'easy' ? 'bg-success-container text-on-success-container' : test.difficulty === 'medium' ? 'bg-warning-container text-on-warning-container' : 'bg-error-container text-on-error-container'}`}>{test.difficulty}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant"><BookOpen size={12} /> {test.wordCount} {t.wordsSuffix}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant"><Clock size={12} /> {test.qCount} {t.questionsSuffix}</span>
                    </div>
                    {test.chips.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {test.chips.map((chip: string) => (
                          <span key={chip} className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-surface-container border border-outline-variant text-on-surface-variant">{chip}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto relative shrink-0">

                  <Link href={`/teacher/ielts/reading/view/${test.id}`} className="m3-interactive px-3 py-2 bg-secondary-container text-on-secondary-container text-[12px] font-bold rounded-m3-sm transition-colors flex items-center gap-1.5">
                    <Eye size={14} /> {t.view}
                  </Link>

                  {activeTab === 'myTests' && (
                    <>
                      <Link href={`/teacher/ielts/reading/manual/${test.id}`} className="m3-interactive px-4 py-2 bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface text-[12px] font-bold rounded-m3-sm transition-colors">
                        {t.edit}
                      </Link>

                      <div onClick={(e) => e.stopPropagation()}>
                        <IconButton size="sm" aria-label={t.moreActions} onClick={() => setOpenDropdownId(openDropdownId === test.id ? null : test.id)}>
                          <MoreVertical />
                        </IconButton>

                        <AnimatePresence>
                          {openDropdownId === test.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 5 }} className="absolute right-0 top-full mt-1 w-40 bg-surface-container-low rounded-m3-md shadow-elev-2 border border-outline-variant py-1.5 z-50">
                              <button onClick={(e) => handleDelete(test.id, e)} className="w-full px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-error hover:bg-error-container transition-colors">
                                <Trash2 size={14} /> {t.delete}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Search />} title={t.noResults} className="h-[300px] justify-center" />
        )}
      </div>
    </div>
  );
}
