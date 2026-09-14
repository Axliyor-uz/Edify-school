'use client';

import { useEffect } from 'react';
import { useTour, TourStep } from './TourContext';

// ─────────────────────────────────────────────────────────────────────────────
// TOUR STEPS — wired to data-tour="..." attributes in TeacherDashboard
// ─────────────────────────────────────────────────────────────────────────────

const UZ_STEPS: TourStep[] = [
    {
        id: 'tour-header',
        emoji: '👋',
        title: 'Xush kelibsiz!',
        description: 'Bu sizning boshqaruv panelingiz. Sana, tarif va statistikangizni shu yerdan ko\'rasiz.',
        placement: 'bottom',
    },
    {
        id: 'tour-plan-badge',
        emoji: '💎',
        title: 'Joriy tarif',
        description: 'Pro yoki VIP tarifga o\'tish uchun ushbu tugmani bosing — cheksiz AI va BSB generatorini oching.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-tests',
        emoji: '📄',
        title: 'Yaratilgan testlar',
        description: 'Siz yaratgan barcha test va BSB imtihonlari soni shu yerda hisoblanadi.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-classes',
        emoji: '🏫',
        title: 'Faol sinflar',
        description: 'Hozir faol holda boshqarayotgan sinflaringiz soni. Yangi sinf qo\'shish uchun "Sinflar" bo\'limiga o\'ting.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-students',
        emoji: '👩‍🎓',
        title: 'O\'quvchilar',
        description: 'Barcha sinflaringizdagi jami o\'quvchilar soni. Reyting va statistikani "Tahlillar" bo\'limida ko\'ring.',
        placement: 'bottom',
    },
    {
        id: 'tour-ai-limit',
        emoji: '⚡',
        title: 'Oylik AI limiti',
        description: 'Har oy siz foydalanishingiz mumkin bo\'lgan AI savollar soni. Progress to\'lsa, tarifni yangilang.',
        placement: 'bottom',
    },
    {
        id: 'tour-bsb-tool',
        emoji: '📋',
        title: 'BSB va CHSB generator',
        description: 'Rasmiy matritsa asosida chorak imtihonlarini avtomatik yarating — eng mashhur vosita!',
        placement: 'right',
    },
    {
        id: 'tour-ai-prompt-tool',
        emoji: '🤖',
        title: 'AI Prompt',
        description: 'Mavzuni yozing — AI bir necha soniyada to\'liq test tuzib beradi. Eng tezkor yo\'l!',
        placement: 'right',
    },
    {
        id: 'tour-library',
        emoji: '📚',
        title: 'Mening Arxivim',
        description: 'Saqlangan barcha testlaringiz va materiallaringiz shu yerda. Istalgan vaqt qayta foydalaning.',
        placement: 'left',
    },
    {
        id: 'tour-classes-row',
        emoji: '🎓',
        title: 'Sinflar va O\'quvchilar',
        description: 'Sinf jurnali, reyting va o\'quvchilar ro\'yxatini shu yerdan boshqaring.',
        placement: 'left',
    },
    {
        id: 'tour-analytics-row',
        emoji: '📊',
        title: 'Tahlillar',
        description: 'O\'quvchilarning o\'zlashtirish darajasi, eng qiyin mavzular va progress grafiklari.',
        placement: 'left',
    },
    {
        id: 'tour-sidebar-classes',
        emoji: '👥',
        title: 'Sinflar',
        description: 'Sinflaringizni boshqaring va o\'quvchilarni shu yerdan qo\'shing.',
        placement: 'right',
    },
    {
        id: 'tour-sidebar-online-books',
        emoji: '📖',
        title: 'Onlayn Kitoblar',
        description: 'Barcha maktab darsliklarining elektron formatdagi nusxalaridan shu yerda foydalaning.',
        placement: 'right',
    },
];

const EN_STEPS: TourStep[] = [
    {
        id: 'tour-header',
        emoji: '👋',
        title: 'Welcome!',
        description: 'This is your teacher dashboard. You can see today\'s date, your current plan, and key stats here.',
        placement: 'bottom',
    },
    {
        id: 'tour-plan-badge',
        emoji: '💎',
        title: 'Your Current Plan',
        description: 'Click here to upgrade to Pro or VIP — unlock unlimited AI usage and the BSB exam generator.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-tests',
        emoji: '📄',
        title: 'Tests Created',
        description: 'The total number of tests and BSB exams you have generated so far.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-classes',
        emoji: '🏫',
        title: 'Active Classes',
        description: 'How many classes you are currently managing. Add more in the Classes section.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-students',
        emoji: '👩‍🎓',
        title: 'Students',
        description: 'Total students across all your classes. Track their progress in the Analytics section.',
        placement: 'bottom',
    },
    {
        id: 'tour-ai-limit',
        emoji: '⚡',
        title: 'Monthly AI Limit',
        description: 'Your monthly AI question allowance. When the bar fills up, upgrade your plan for more.',
        placement: 'bottom',
    },
    {
        id: 'tour-bsb-tool',
        emoji: '📋',
        title: 'BSB & CHSB Generator',
        description: 'Generate official term exam papers based on the official matrix — the most-used tool!',
        placement: 'right',
    },
    {
        id: 'tour-ai-prompt-tool',
        emoji: '🤖',
        title: 'AI Text Command',
        description: 'Type your topic and AI builds a complete test in seconds. The fastest way to create!',
        placement: 'right',
    },
    {
        id: 'tour-library',
        emoji: '📚',
        title: 'My Library',
        description: 'All your saved tests and materials are stored here — reuse them anytime.',
        placement: 'left',
    },
    {
        id: 'tour-classes-row',
        emoji: '🎓',
        title: 'Classes & Students',
        description: 'Manage your class rosters, leaderboards, and student records from here.',
        placement: 'left',
    },
    {
        id: 'tour-analytics-row',
        emoji: '📊',
        title: 'Analytics',
        description: 'View performance insights, track mastery per topic, and spot struggling students.',
        placement: 'left',
    },
    {
        id: 'tour-sidebar-classes',
        emoji: '👥',
        title: 'Classes',
        description: 'Manage your classes and add new students from this section.',
        placement: 'right',
    },
    {
        id: 'tour-sidebar-online-books',
        emoji: '📖',
        title: 'Online Books',
        description: 'Access digital versions of all school textbooks and materials here.',
        placement: 'right',
    },
];

const RU_STEPS: TourStep[] = [
    {
        id: 'tour-header',
        emoji: '👋',
        title: 'Добро пожаловать!',
        description: 'Это ваша панель управления. Здесь вы можете увидеть дату, ваш текущий тариф и статистику.',
        placement: 'bottom',
    },
    {
        id: 'tour-plan-badge',
        emoji: '💎',
        title: 'Ваш Тариф',
        description: 'Нажмите здесь, чтобы перейти на Pro или VIP — откройте безлимитный ИИ и генератор экзаменов BSB.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-tests',
        emoji: '📄',
        title: 'Созданные тесты',
        description: 'Общее количество созданных вами тестов и экзаменов BSB на данный момент.',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-classes',
        emoji: '🏫',
        title: 'Активные классы',
        description: 'Сколько классов вы сейчас ведете. Добавьте больше в разделе "Классы".',
        placement: 'bottom',
    },
    {
        id: 'tour-stat-students',
        emoji: '👩‍🎓',
        title: 'Ученики',
        description: 'Общее количество учеников во всех классах. Отслеживайте их прогресс в разделе "Аналитика".',
        placement: 'bottom',
    },
    {
        id: 'tour-ai-limit',
        emoji: '⚡',
        title: 'Месячный лимит ИИ',
        description: 'Ваш ежемесячный лимит вопросов ИИ. При его исчерпании обновите тариф.',
        placement: 'bottom',
    },
    {
        id: 'tour-bsb-tool',
        emoji: '📋',
        title: 'Генератор BSB и CHSB',
        description: 'Создавайте официальные экзаменационные работы на основе официальной матрицы — самый популярный инструмент!',
        placement: 'right',
    },
    {
        id: 'tour-ai-prompt-tool',
        emoji: '🤖',
        title: 'ИИ Команды',
        description: 'Введите тему, и ИИ создаст полный тест за считанные секунды. Самый быстрый способ!',
        placement: 'right',
    },
    {
        id: 'tour-library',
        emoji: '📚',
        title: 'Моя Библиотека',
        description: 'Все ваши сохраненные тесты и материалы находятся здесь — используйте их в любое время.',
        placement: 'left',
    },
    {
        id: 'tour-classes-row',
        emoji: '🎓',
        title: 'Классы и Ученики',
        description: 'Управляйте журналами классов, рейтингами и списками учеников отсюда.',
        placement: 'left',
    },
    {
        id: 'tour-analytics-row',
        emoji: '📊',
        title: 'Аналитика',
        description: 'Просматривайте статистику успеваемости, отслеживайте прогресс и выявляйте отстающих учеников.',
        placement: 'left',
    },
    {
        id: 'tour-sidebar-classes',
        emoji: '👥',
        title: 'Классы',
        description: 'Управляйте своими классами и добавляйте новых учеников в этом разделе.',
        placement: 'right',
    },
    {
        id: 'tour-sidebar-online-books',
        emoji: '📖',
        title: 'Онлайн Книги',
        description: 'Получите доступ к цифровым версиям всех школьных учебников и материалов здесь.',
        placement: 'right',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — call this inside TeacherDashboard
// ─────────────────────────────────────────────────────────────────────────────

export const TOUR_STORAGE_KEY = 'edify_teacher_tour_seen_v1';

/**
 * Usage:
 *   const { startTour } = useDashboardTour(lang);
 *
 *   // Auto-start for first-time users — already handled inside the hook.
 *   // To manually trigger:
 *   <button onClick={startTour}>Qo'llanmani boshlash</button>
 */
export function useDashboardTour(lang: string = 'uz') {
    const tour = useTour();
    const steps = lang === 'en' ? EN_STEPS : lang === 'ru' ? RU_STEPS : UZ_STEPS;

    const startTour = () => tour.start(steps);

    // Auto-start on first visit
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const seen = localStorage.getItem(TOUR_STORAGE_KEY);
        if (!seen) {
            // Small delay so the dashboard has time to render
            const timer = setTimeout(() => {
                tour.start(steps);
                localStorage.setItem(TOUR_STORAGE_KEY, '1');
            }, 800);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { startTour };
}





