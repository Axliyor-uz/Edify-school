'use client';

// Listening test library — mirrors the reading list page: "My Tests" (teacher-owned) and
// "Platform" (read-only dataset) tabs, type-breakdown chips, edit/delete/preview.
// Preview links to /teacher/ielts/listening/view/[id] (shared TestPreview).

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { Headphones, Plus, Search, Globe, Clock, MoreVertical, FileText, Trash2, Eye, ChevronLeft, Layers } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { fetchTeacherTests, fetchPlatformTests, deleteIeltsTest } from '@/services/ieltsService';
import { typeBreakdown } from '@/lib/ielts/testSchema';
import { breakdownChips } from '@/lib/ielts/typeLabels';

import { Button, IconButton, Spinner, SearchBar, EmptyState } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    subtitle: "Audio testlarni yarating yoki platforma bazasidan foydalaning.",
    newTest: "Yangi Test",
    myTests: "Mening Testlarim",
    platform: "Platforma",
    platformBadge: "Platforma",
    searchPlaceholder: "Qidirish...",
    partsSuffix: "qism",
    questionsSuffix: "savol",
    preview: "Ko'rish",
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
    subtitle: "Create listening tests or use the platform library.",
    newTest: "New Test",
    myTests: "My Tests",
    platform: "Platform",
    platformBadge: "Platform",
    searchPlaceholder: "Search...",
    partsSuffix: "parts",
    questionsSuffix: "questions",
    preview: "Preview",
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
    subtitle: "Создавайте аудиотесты или используйте базу платформы.",
    newTest: "Новый тест",
    myTests: "Мои тесты",
    platform: "Платформа",
    platformBadge: "Платформа",
    searchPlaceholder: "Поиск...",
    partsSuffix: "частей",
    questionsSuffix: "вопросов",
    preview: "Просмотр",
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
  return {
    id: d.id,
    title: d.test_title || untitled,
    partCount: Array.isArray(d.parts) ? d.parts.length : 0,
    qCount: d.total_questions || 0,
    chips: breakdownChips(typeBreakdown(d)),
    date: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : 'N/A',
    rawDate: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0,
    raw: d,
  };
}

export default function ListeningDashboard() {
  const { user } = useAuth() as any;
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [activeTab, setActiveTab] = useState<'myTests' | 'platform'>('myTests');
  const [searchQuery, setSearchQuery] = useState('');
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
          fetchTeacherTests('listening', user.uid),
          // audience 'teacher' → admin-hidden papers are dropped and the list arrives in
          // the admin's catalog order; do NOT re-sort it by date.
          fetchPlatformTests('listening', { audience: 'teacher' }),
        ]);
        const mapped = mine.map((d) => mapDoc(d, t.untitled)).sort((a, b) => b.rawDate - a.rawDate);
        const mappedPlatform = platform.map((d) => mapDoc(d, t.untitled));
        setMyTests(mapped);
        setPlatformTests(mappedPlatform);
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.deleteConfirm)) return;
    try {
      await deleteIeltsTest('listening', id);
      setMyTests((prev) => prev.filter((test) => test.id !== id));
      toast.success(t.deleteSuccess);
    } catch {
      toast.error(t.deleteError);
    }
    setOpenDropdownId(null);
  };

  const filteredData = (activeTab === 'myTests' ? myTests : platformTests).filter((test) =>
    test.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500 font-t-body text-on-surface">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/teacher/ielts" className="w-8 h-8 rounded-m3-md bg-surface-container-low border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-all shrink-0 mr-1 shadow-elev-1">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
            <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1">
              <Headphones size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight">IELTS Listening</h1>
          </div>
          <p className="text-[14px] font-medium text-on-surface-variant">{t.subtitle}</p>
        </div>

        <Link href="/teacher/ielts/listening/manual">
          <Button variant="filled" icon={<Plus />}>{t.newTest}</Button>
        </Link>
      </div>

      {/* TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex p-1 bg-surface-container rounded-m3-md w-full md:w-auto border border-outline-variant">
          <button onClick={() => setActiveTab('myTests')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'myTests' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <Headphones size={14} /> {t.myTests}
          </button>
          <button onClick={() => setActiveTab('platform')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'platform' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <Globe size={14} /> {t.platform}
          </button>
        </div>

        <SearchBar placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-72" />
      </div>

      {/* LIST */}
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
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant"><Layers size={12} /> {test.partCount} {t.partsSuffix}</span>
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

                  <Link href={`/teacher/ielts/listening/view/${test.id}`} className="m3-interactive px-3 py-2 bg-secondary-container text-on-secondary-container text-[12px] font-bold rounded-m3-sm transition-colors flex items-center gap-1.5">
                    <Eye size={14} /> {t.preview}
                  </Link>

                  {activeTab === 'myTests' && (
                    <>
                      <Link href={`/teacher/ielts/listening/manual/${test.id}`} className="m3-interactive px-4 py-2 bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface text-[12px] font-bold rounded-m3-sm transition-colors">
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
