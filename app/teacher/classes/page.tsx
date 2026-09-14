'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { Users, Plus, BookOpen, Sparkles } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import ClassCard from './_components/ClassCard';
import CreateClassModal from './_components/CreateClassModal';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Skeleton } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const CLASSES_TRANSLATIONS: Record<string, any> = {
  uz: {
    title: "Mening Sinflarim", subtitle: "O'quvchilar, ro'yxatlar va so'rovlarni boshqaring.", createBtn: "Yangi Sinf",
    empty: { title: "Sinflar topilmadi", desc: "O'quvchilarni taklif qilish uchun birinchi sinfingizni yarating.", btn: "Sinf Yaratish" }
  },
  en: {
    title: "My Classes", subtitle: "Manage students, rosters, and join requests.", createBtn: "New Class",
    empty: { title: "No classes found", desc: "Create your first class to invite students.", btn: "Create Class" }
  },
  ru: {
    title: "Мои Классы", subtitle: "Управление учениками, списками и запросами.", createBtn: "Новый Класс",
    empty: { title: "Классы не найдены", desc: "Создайте свой первый класс, чтобы пригласить учеников.", btn: "Создать Класс" }
  }
};

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };

export default function ClassesPage() {
  const { user, loading } = useAuth() as any;
  const { lang } = useTeacherLanguage();
  const t = CLASSES_TRANSLATIONS[lang] || CLASSES_TRANSLATIONS['uz'];

  const [classes, setClasses] = useState<any[]>([]);
  const [centerNames, setCenterNames] = useState<Record<string, string>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Dynamic Theme Palette for Cards (M3 three-tone rotation)
  const THEMES = ['primary', 'secondary', 'tertiary'];

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Center IELTS groups (classes carrying ieltsGroupId) live in
      // /teacher/ielts/groups — their IELTS group page has its own tabs
      // (incl. attendance), so the twin class is hidden here.
      setClasses(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(cls => !cls.ieltsGroupId));
      setIsLoadingData(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Markaz guruhlari uchun markaz nomlari (badge) — har bir distinct centerId
  // bir marta o'qiladi (centers har qanday authed user uchun o'qiladi).
  useEffect(() => {
    const ids = Array.from(new Set(classes.map(c => c.centerId).filter(Boolean)))
      .filter(id => !(id in centerNames));
    if (ids.length === 0) return;
    let mounted = true;
    (async () => {
      const entries = await Promise.all(ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'centers', id));
          return [id, snap.exists() ? (snap.data().name || '') : ''] as const;
        } catch { return [id, ''] as const; }
      }));
      if (mounted) setCenterNames(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { mounted = false; };
  }, [classes, centerNames]);

  if (loading || isLoadingData) return <ClassesSkeleton />;

  return (
    <div className="min-h-[100dvh] bg-surface font-t-body selection:bg-primary-container selection:text-on-primary-container pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12">
      
      <CreateClassModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 md:mt-8 relative z-10">
        
        {/* 🟢 ULTRA MINIMALISTIC HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 mb-5 md:mb-8 bg-surface-container-low p-4 md:p-6 rounded-m3-lg md:rounded-m3-xl border border-outline-variant shadow-elev-1">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-primary-container rounded-m3-sm md:rounded-m3-lg flex items-center justify-center text-on-primary-container shrink-0">
               <Users size={20} strokeWidth={2.5} className="md:w-7 md:h-7" />
            </div>
            <div>
              <h1 className="text-[18px] md:text-3xl font-black text-on-surface tracking-tight leading-tight">{t.title}</h1>
              <p className="text-[11px] md:text-[14px] font-bold md:font-medium text-on-surface-variant mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus strokeWidth={3} />}
            className="w-full sm:w-auto"
          >
            {t.createBtn}
          </Button>
        </div>

        {/* 🟢 CLASS GRID OR EMPTY STATE */}
        {classes.length > 0 ? (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {classes.map((cls, index) => {
              // Assign a color theme based on the index
              const themeColor = THEMES[index % THEMES.length];
              return <ClassCard key={cls.id} cls={cls} theme={themeColor} centerName={cls.centerId ? (centerNames[cls.centerId] || '') : ''} />;
            })}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-full py-12 md:py-24 text-center flex flex-col items-center justify-center bg-surface-container-low border-2 border-dashed border-outline-variant rounded-m3-lg md:rounded-m3-xl shadow-elev-1 relative overflow-hidden group mx-1 md:mx-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] rounded-full blur-3xl group-hover:bg-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)] transition-colors duration-700 pointer-events-none z-0"></div>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-surface-container rounded-m3-md md:rounded-m3-lg flex items-center justify-center mb-4 md:mb-5 shadow-elev-1 relative z-10">
              <BookOpen size={24} className="text-on-surface-variant md:w-7 md:h-7" />
            </div>
            <h3 className="text-[16px] md:text-[20px] font-black text-on-surface tracking-tight relative z-10">{t.empty.title}</h3>
            <p className="text-[12px] md:text-[14px] font-medium text-on-surface-variant mt-1 md:mt-1.5 mb-6 md:mb-8 max-w-sm relative z-10 px-4">{t.empty.desc}</p>
            <Button variant="tonal" icon={<Sparkles />} onClick={() => setIsCreateOpen(true)} className="relative z-10">
              {t.empty.btn}
            </Button>
          </motion.div>
        )}

      </main>
    </div>
  );
}

// Skeleton Loader Component (Adjusted for minimal mobile layout)
const ClassesSkeleton = () => (
  <div className="min-h-[100dvh] bg-surface px-3 sm:px-6 lg:px-8 pt-4 md:pt-10">
    <div className="max-w-6xl mx-auto">
      <Skeleton className="h-[120px] md:h-28 rounded-m3-lg md:rounded-m3-xl w-full mb-5 md:mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[160px] md:h-48 rounded-m3-lg md:rounded-m3-xl" />)}
      </div>
    </div>
  </div>
);