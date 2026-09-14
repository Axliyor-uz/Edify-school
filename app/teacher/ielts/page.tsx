'use client';

import { useEffect, useState } from 'react';
import { useTeacherLanguage } from '../layout';
import { motion } from 'framer-motion';
import { Headphones, BookOpen, PenTool, Mic, ArrowRight, ClipboardCheck, Users, Target, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { fetchPendingReviews } from '@/services/ieltsService';

const PAGE_TRANSLATIONS: Record<string, any> = {
  uz: {
    title: "IELTS Moduli",
    subtitle: "IELTS testlarini yarating, guruhlarga biriktiring va baholang",
    modules: {
      listening: { title: "Listening", desc: "4 qismli audio testlar va avtomatik tekshirish." },
      reading: { title: "Reading", desc: "Matnli testlar va tahlillar." },
      writing: { title: "Writing", desc: "Task 1 & 2 topshiriqlari, insholarni o'zingiz baholaysiz." },
      speaking: { title: "Speaking", desc: "Part 1–3 savollari va cue card to'plamlari." },
    },
    action: "Boshqarish",
    groupTeaser: "Guruhlarni Boshqarish",
    reviewQueue: (n: number) => `${n} ta ish tekshirishni kutmoqda`,
    reviewQueueDesc: "Writing va Speaking topshiriqlarini bir joydan baholang",
  },
  en: {
    title: "IELTS Module",
    subtitle: "Author IELTS tests, assign them to groups, and grade",
    modules: {
      listening: { title: "Listening", desc: "4-part audio tests with automatic grading." },
      reading: { title: "Reading", desc: "Passages, true/false/not given, analytics." },
      writing: { title: "Writing", desc: "Task 1 & 2 prompts — essays graded by you." },
      speaking: { title: "Speaking", desc: "Part 1–3 questions and cue-card sets." },
    },
    action: "Manage",
    groupTeaser: "Manage Groups",
    reviewQueue: (n: number) => `${n} submission${n === 1 ? '' : 's'} waiting for review`,
    reviewQueueDesc: "Grade Writing and Speaking work from every group in one place",
  },
  ru: {
    title: "Модуль IELTS",
    subtitle: "Создавайте IELTS тесты, назначайте группам и оценивайте",
    modules: {
      listening: { title: "Аудирование", desc: "Аудиотесты из 4 частей с автопроверкой." },
      reading: { title: "Чтение", desc: "Тексты и аналитика." },
      writing: { title: "Письмо", desc: "Задания Task 1 & 2 — эссе оцениваете вы." },
      speaking: { title: "Говорение", desc: "Вопросы Part 1–3 и наборы cue card." },
    },
    action: "Управлять",
    groupTeaser: "Управление Группами",
    reviewQueue: (n: number) => `Работ на проверку: ${n}`,
    reviewQueueDesc: "Оценивайте Writing и Speaking из всех групп в одном месте",
  }
};

const IELTS_CARDS = [
  { id: 'listening', icon: Headphones, color: 'text-on-primary-container', bg: 'bg-primary-container', border: 'border-transparent', href: '/teacher/ielts/listening' },
  { id: 'reading', icon: BookOpen, color: 'text-on-secondary-container', bg: 'bg-secondary-container', border: 'border-transparent', href: '/teacher/ielts/reading' },
  { id: 'writing', icon: PenTool, color: 'text-on-tertiary-container', bg: 'bg-tertiary-container', border: 'border-transparent', href: '/teacher/ielts/writing' },
  { id: 'speaking', icon: Mic, color: 'text-on-primary-container', bg: 'bg-primary-container', border: 'border-transparent', href: '/teacher/ielts/speaking' },
];

export default function IELTSDashboard() {
  const { lang } = useTeacherLanguage();
  const { user } = useAuth();
  const t = PAGE_TRANSLATIONS[lang] || PAGE_TRANSLATIONS['uz'];
  const [pendingCount, setPendingCount] = useState(0);

  // Cross-group grading-queue badge (best-effort decoration; failures stay silent).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'ielts_groups'), where('teacherId', '==', user.uid)));
        if (snap.empty) return;
        const pending = await fetchPendingReviews(snap.docs.map(d => d.id));
        if (alive) setPendingCount(pending.length);
      } catch { /* badge only */ }
    })();
    return () => { alive = false; };
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-surface font-t-body pb-28">

      {/* ── Premium top bar ── */}
      <div className="bg-surface-container-low border-b border-outline-variant">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Title row */}
          <div className="flex items-end justify-between gap-4 py-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-m3-md bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-elev-2">
                <Target size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-[22px] md:text-[26px] font-black text-on-surface tracking-tight leading-tight">
                  {t.title}
                </h1>
                <p className="text-[13px] font-medium text-on-surface-variant hidden sm:block">{t.subtitle}</p>
              </div>
            </div>

            <Link
              href="/teacher/ielts/groups"
              className="m3-interactive flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-m3-btn font-black text-[13px] transition-all active:scale-95 hover:shadow-elev-1 shrink-0"
            >
              <Users size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t.groupTeaser}</span>
              <span className="sm:hidden">Groups</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* Cross-group grading queue */}
        {pendingCount > 0 && (
          <Link
            href="/teacher/ielts/reviews"
            className="group mb-5 flex items-center gap-3 bg-warning-container border border-transparent rounded-m3-lg p-4 shadow-elev-1 hover:shadow-elev-2 transition-all"
          >
            <div className="w-11 h-11 rounded-m3-md bg-surface flex items-center justify-center text-on-surface shrink-0">
              <ClipboardCheck size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-black text-on-warning-container">{t.reviewQueue(pendingCount)}</p>
              <p className="text-[12.5px] font-bold text-on-warning-container opacity-80">{t.reviewQueueDesc}</p>
            </div>
            <ChevronRight size={18} strokeWidth={2.5} className="text-on-warning-container shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {IELTS_CARDS.map((card, index) => {
            const moduleText = t.modules[card.id as keyof typeof t.modules];
            
            return (
              <motion.div 
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
              >
                <Link
                  href={card.href}
                  className="group flex flex-col bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 hover:shadow-elev-2 transition-all duration-200 overflow-hidden h-full p-5"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className={`w-12 h-12 rounded-m3-md flex items-center justify-center border ${card.bg} ${card.border} ${card.color}`}>
                      <card.icon size={22} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-[17px] font-black text-on-surface mb-1.5 group-hover:text-primary transition-colors tracking-tight">
                      {moduleText.title}
                    </h3>
                    <p className="text-[13px] font-medium text-on-surface-variant leading-relaxed">
                      {moduleText.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-outline-variant flex items-center justify-between">
                     <span className="text-[12px] font-bold text-on-surface-variant">{t.action}</span>
                     <div className="w-8 h-8 rounded-m3-md bg-surface-container flex items-center justify-center text-primary group-hover:bg-state-hover transition-colors">
                       <ArrowRight size={14} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                     </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}