'use client';

// IELTS Writing authoring — list of the teacher's own writing tests + inline create/edit
// form (Task 1 with optional image, Task 2, optional model answers). Teacher-graded flow;
// AI scoring comes later.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { PenTool, Plus, Search, ChevronLeft, Image as ImageIcon, FileText, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { fetchTeacherTests, deleteIeltsTest } from '@/services/ieltsService';
import { Button, Spinner, SearchBar, EmptyState } from '@/components/ui';
import WritingForm from './_components/WritingForm';

const TRANSLATIONS = {
  uz: {
    subtitle: "Task 1 va Task 2 topshiriqlarini yarating. Insholarni o'zingiz baholaysiz.",
    newTest: "Yangi Test",
    searchPlaceholder: "Qidirish...",
    withImage: "Rasm bilan",
    modelAnswer: "Namuna javob",
    edit: "Tahrirlash",
    delete: "O'chirish",
    noResults: "Natija topilmadi",
    noTests: "Hozircha writing testlar yo'q.",
    untitled: "Nomsiz test",
    loadError: "Testlarni yuklashda xatolik yuz berdi.",
    deleteConfirm: "Haqiqatan ham bu testni o'chirmoqchimisiz?",
    deleteSuccess: "Test o'chirildi!",
    deleteError: "O'chirishda xatolik yuz berdi.",
  },
  en: {
    subtitle: "Author Task 1 and Task 2 prompts. Essays are graded by you.",
    newTest: "New Test",
    searchPlaceholder: "Search...",
    withImage: "With image",
    modelAnswer: "Model answer",
    edit: "Edit",
    delete: "Delete",
    noResults: "No results found",
    noTests: "No writing tests yet.",
    untitled: "Untitled Test",
    loadError: "Failed to load tests.",
    deleteConfirm: "Are you sure you want to delete this test?",
    deleteSuccess: "Test deleted!",
    deleteError: "Failed to delete.",
  },
  ru: {
    subtitle: "Создавайте задания Task 1 и Task 2. Эссе оцениваете вы.",
    newTest: "Новый тест",
    searchPlaceholder: "Поиск...",
    withImage: "С изображением",
    modelAnswer: "Образец ответа",
    edit: "Редактировать",
    delete: "Удалить",
    noResults: "Ничего не найдено",
    noTests: "Пока нет writing тестов.",
    untitled: "Тест без названия",
    loadError: "Не удалось загрузить тесты.",
    deleteConfirm: "Вы действительно хотите удалить этот тест?",
    deleteSuccess: "Тест удалён!",
    deleteError: "Не удалось удалить.",
  },
};

export default function WritingDashboard() {
  const { user } = useAuth() as any;
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [tests, setTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // false = closed, null = create, object = edit
  const [editing, setEditing] = useState<false | null | any>(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const docs = await fetchTeacherTests('writing', user.uid);
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTests(docs);
    } catch (error) {
      console.error(error);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await deleteIeltsTest('writing', id);
      setTests((prev) => prev.filter((test: any) => test.id !== id));
      toast.success(t.deleteSuccess);
    } catch {
      toast.error(t.deleteError);
    }
  };

  const filtered = tests.filter((test: any) =>
    (test.test_title || '').toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="w-10 h-10 rounded-m3-md bg-tertiary-container text-on-tertiary-container flex items-center justify-center shadow-elev-1">
              <PenTool size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight">IELTS Writing</h1>
          </div>
          <p className="text-[14px] font-medium text-on-surface-variant">{t.subtitle}</p>
        </div>

        {editing === false && (
          <Button variant="filled" icon={<Plus />} onClick={() => setEditing(null)}>{t.newTest}</Button>
        )}
      </div>

      {editing !== false ? (
        <WritingForm
          initial={editing}
          onSaved={() => { setEditing(false); load(); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex justify-end mb-6">
            <SearchBar placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-72" />
          </div>

          <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[300px]"><Spinner size={28} /></div>
            ) : filtered.length > 0 ? (
              <div className="divide-y divide-outline-variant">
                {filtered.map((test: any) => (
                  <div key={test.id} className="p-4 md:p-5 hover:bg-state-hover transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-m3-md flex items-center justify-center shrink-0 shadow-elev-1 bg-surface-container text-on-surface-variant border border-outline-variant">
                        <FileText size={20} />
                      </div>
                      <div className="pt-0.5 min-w-0">
                        <h3 className="text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors mb-1">{test.test_title || t.untitled}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-surface-container border border-outline-variant text-on-surface-variant">Task 1 + Task 2</span>
                          {test.task1?.imageUrl && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-tertiary-container text-on-tertiary-container"><ImageIcon size={10} /> {t.withImage}</span>
                          )}
                          {(test.task1?.modelAnswer || test.task2?.modelAnswer) && (
                            <span className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-success-container text-on-success-container">{t.modelAnswer}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <button onClick={() => setEditing(test)} className="m3-interactive px-4 py-2 bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface text-[12px] font-bold rounded-m3-sm transition-colors flex items-center gap-1.5">
                        <Pencil size={13} /> {t.edit}
                      </button>
                      <button onClick={() => handleDelete(test.id)} className="m3-interactive px-3 py-2 text-[12px] font-bold text-error hover:bg-error-container rounded-m3-sm transition-colors flex items-center gap-1.5">
                        <Trash2 size={14} /> {t.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Search />} title={searchQuery ? t.noResults : t.noTests} className="h-[300px] justify-center" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
