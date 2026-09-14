'use client';

// IELTS Speaking authoring — list of the teacher's own speaking sets + inline create/edit
// form (Part 1 questions, Part 2 cue card, Part 3 questions). Teacher-graded flow.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Mic, Plus, Search, ChevronLeft, MessageCircle, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { fetchTeacherTests, deleteIeltsTest } from '@/services/ieltsService';
import { Button, Spinner, SearchBar, EmptyState } from '@/components/ui';
import SpeakingForm from './_components/SpeakingForm';

const TRANSLATIONS = {
  uz: {
    subtitle: "Part 1–3 savollari va cue card to'plamlarini yarating.",
    newTest: "Yangi To'plam",
    searchPlaceholder: "Qidirish...",
    part1Count: (n: number) => `Part 1: ${n} savol`,
    part3Count: (n: number) => `Part 3: ${n} savol`,
    edit: "Tahrirlash",
    delete: "O'chirish",
    noResults: "Natija topilmadi",
    noTests: "Hozircha speaking to'plamlar yo'q.",
    untitled: "Nomsiz to'plam",
    loadError: "To'plamlarni yuklashda xatolik yuz berdi.",
    deleteConfirm: "Haqiqatan ham bu to'plamni o'chirmoqchimisiz?",
    deleteSuccess: "To'plam o'chirildi!",
    deleteError: "O'chirishda xatolik yuz berdi.",
  },
  en: {
    subtitle: "Author Part 1–3 questions and cue-card sets.",
    newTest: "New Set",
    searchPlaceholder: "Search...",
    part1Count: (n: number) => `Part 1: ${n} questions`,
    part3Count: (n: number) => `Part 3: ${n} questions`,
    edit: "Edit",
    delete: "Delete",
    noResults: "No results found",
    noTests: "No speaking sets yet.",
    untitled: "Untitled Set",
    loadError: "Failed to load sets.",
    deleteConfirm: "Are you sure you want to delete this set?",
    deleteSuccess: "Set deleted!",
    deleteError: "Failed to delete.",
  },
  ru: {
    subtitle: "Создавайте вопросы Part 1–3 и наборы cue card.",
    newTest: "Новый набор",
    searchPlaceholder: "Поиск...",
    part1Count: (n: number) => `Part 1: ${n} вопр.`,
    part3Count: (n: number) => `Part 3: ${n} вопр.`,
    edit: "Редактировать",
    delete: "Удалить",
    noResults: "Ничего не найдено",
    noTests: "Пока нет speaking наборов.",
    untitled: "Набор без названия",
    loadError: "Не удалось загрузить наборы.",
    deleteConfirm: "Вы действительно хотите удалить этот набор?",
    deleteSuccess: "Набор удалён!",
    deleteError: "Не удалось удалить.",
  },
};

export default function SpeakingDashboard() {
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
      const docs = await fetchTeacherTests('speaking', user.uid);
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
      await deleteIeltsTest('speaking', id);
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
            <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1">
              <Mic size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight">IELTS Speaking</h1>
          </div>
          <p className="text-[14px] font-medium text-on-surface-variant">{t.subtitle}</p>
        </div>

        {editing === false && (
          <Button variant="filled" icon={<Plus />} onClick={() => setEditing(null)}>{t.newTest}</Button>
        )}
      </div>

      {editing !== false ? (
        <SpeakingForm
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
                        <MessageCircle size={20} />
                      </div>
                      <div className="pt-0.5 min-w-0">
                        <h3 className="text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors mb-1">{test.test_title || t.untitled}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-surface-container border border-outline-variant text-on-surface-variant">{t.part1Count(test.part1Questions?.length || 0)}</span>
                          <span className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-tertiary-container text-on-tertiary-container">Cue Card</span>
                          <span className="px-1.5 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider bg-surface-container border border-outline-variant text-on-surface-variant">{t.part3Count(test.part3Questions?.length || 0)}</span>
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
