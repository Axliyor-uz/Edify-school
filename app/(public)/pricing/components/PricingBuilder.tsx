'use client';

import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  Wand2, Sigma, CheckCircle2, Bot, QrCode, Camera, ScanFace,
  Wallet, Banknote, Calculator, Trophy, BookOpen, Smartphone, Send,
  Users, Receipt, Sparkles, Check, ChevronRight, Minus, Plus, Zap,
  Building2, GraduationCap, Star, ShieldCheck, Target, TrendingUp,
  Keyboard, Languages, Crown, Info, ChevronDown, Lock, UserCheck
} from 'lucide-react';
// 🔗 Integrated with your public layout's language context.
// Adjust the path if this file doesn't sit next to layout.tsx.
import { LanguageContext } from '../../layout';

/* =========================================================================
   EDIFY — Narxlar konstruktori (Interactive Pricing Builder)
   - Language follows the navbar switcher (<LanguageContext>).
   - "Get this plan" opens Telegram with a prewritten order for the admin.
   Change the admin handle here:
   ========================================================================= */
const TELEGRAM_USERNAME = 'a_tojiboyev';

type Lang = 'uz' | 'en' | 'ru';
interface LString { uz: string; ru: string; en: string; }
interface Detail { icon: any; name: LString; }
interface Module {
  id: string;
  cat: keyof typeof CATS;
  icon: any;
  price?: number;
  perStudent?: number;   // ai: monthly add per student
  ai?: boolean;
  requests?: number;     // included AI requests / month (free tier)
  packSize?: number;     // extra request pack size
  packPrice?: number;    // extra request pack monthly price
  oneTime?: number;      // hardware, per device
  qty?: boolean;
  install?: boolean;
  popular?: boolean;
  soon?: boolean;        // coming soon — locked, not selectable
  type?: 'subjects';
  name: LString;
  desc: LString;
  more?: LString;        // expandable summary shown under "See more"
  details?: Detail[];
}

// ---- Category palette ------------------------------------------------------
const CATS = {
  core: { solid: '#2563EB', ring: '#3B82F6', tint: '#EFF6FF', text: '#1D4ED8' },
  attendance: { solid: '#059669', ring: '#10B981', tint: '#ECFDF5', text: '#047857' },
  finance: { solid: '#D97706', ring: '#F59E0B', tint: '#FFFBEB', text: '#B45309' },
  growth: { solid: '#7C3AED', ring: '#8B5CF6', tint: '#F5F3FF', text: '#6D28D9' },
};

// ---- Subjects database -----------------------------------------------------
const SUBJECTS = [
  { id: 'math', available: true, price: 99000, count: '100K+', name: { uz: "Matematika", ru: "Математика", en: "Mathematics" } },
  { id: 'physics', available: true, price: 79000, name: { uz: "Fizika", ru: "Физика", en: "Physics" } },
  { id: 'uzbek', available: true, price: 69000, name: { uz: "Ona tili", ru: "Родной язык", en: "Uzbek (Native)" } },
  { id: 'biology', available: true, price: 69000, name: { uz: "Biologiya", ru: "Биология", en: "Biology" } },
  { id: 'chemistry', available: true, price: 79000, name: { uz: "Kimyo", ru: "Химия", en: "Chemistry" } },
  { id: 'history', available: true, price: 59000, name: { uz: "Tarix", ru: "История", en: "History" } },
] as const;
// 5% off for each additional subject beyond the first (2 → 5%, 3 → 10%, ...)
const subjectDiscount = (n: number) => Math.max(0, (n - 1) * 0.05);

// ---- Modules ---------------------------------------------------------------
const MODULES: Module[] = [
  // CORE — the two free AI tools sit on top
  {
    id: 'ai_test', cat: 'core', icon: Wand2, price: 0,
    requests: 100, packSize: 100, packPrice: 49000, popular: true,
    name: { uz: "AI Test Generatsiya", ru: "AI Генератор тестов", en: "AI Test Generation" },
    desc: { uz: "Istalgan mavzuda soniyalarda test tuzing", ru: "Тесты по любой теме за секунды", en: "Build tests on any topic in seconds" },
    more: { uz: "Fan, sinf va murakkablikni tanlaysiz — AI savol, variant va to'g'ri javobni yozib beradi. Oyiga 100 ta so'rov bepul; PDF yoki onlayn test sifatida ulashasiz.", ru: "Выбираете предмет, класс и сложность — AI создаёт вопросы, варианты и ответы. 100 запросов в месяц бесплатно; делитесь как PDF или онлайн-тестом.", en: "Choose subject, grade and difficulty — AI writes the questions, options and answer key. 100 free requests a month; share as PDF or an online test." }
  },
  {
    id: 'ai_helper', cat: 'core', icon: Bot, price: 0,
    requests: 100, packSize: 100, packPrice: 49000, popular: true,
    name: { uz: "Ustoz AI Yordamchi", ru: "AI-помощник учителя", en: "Teacher AI Helper" },
    desc: { uz: "Reja, izoh va tahlil bir joyda", ru: "Планы, объяснения и анализ", en: "Plans, explanations & analysis" },
    more: { uz: "Dars rejalari, mavzu tushuntirishlari va o'quvchi natijalari tahlili. Har bir xato uchun qadam-ba-qadam yechim yozib beradi. Oyiga 100 so'rov bepul.", ru: "Планы уроков, объяснения тем и анализ результатов ученика. Для каждой ошибки — пошаговое решение. 100 запросов в месяц бесплатно.", en: "Lesson plans, topic explanations and analysis of student results. Step-by-step solutions for every mistake. 100 free requests a month." }
  },
  {
    id: 'subjects_db', cat: 'core', icon: Sigma, type: 'subjects',
    name: { uz: "Fanlar Bazasi", ru: "База предметов", en: "Subjects Database" },
    desc: { uz: "Kerakli fanlarni tanlang — har biri chegirma", ru: "Выберите нужные предметы — скидка за каждый", en: "Pick the subjects you need — discount per subject" },
    more: { uz: "Har bir fan bo'yicha tayyor savol va yechimlar bazasi (Matematikada 100 000+). Bir nechta fan tanlansa, har qo'shimcha fan uchun 5% chegirma qo'llanadi.", ru: "Готовая база вопросов и решений по каждому предмету (по математике 100 000+). За каждый дополнительный предмет — скидка 5%.", en: "A ready bank of questions and solutions per subject (100,000+ in Mathematics). Every extra subject adds a 5% discount." }
  },
  {
    id: 'auto_grade', cat: 'core', icon: CheckCircle2, price: 79000,
    name: { uz: "Avtomatik Baholash", ru: "Автопроверка", en: "Auto Grading" },
    desc: { uz: "Tekshirishni tizimga qoldiring", ru: "Проверка на автомате", en: "Let the system do the marking" },
    more: { uz: "Test topshirilishi bilan tizim javoblarni tekshiradi, ball qo'yadi va jurnalga yozadi. Qo'lda tekshirish va sanashga vaqt sarflamaysiz.", ru: "Как только тест сдан, система проверяет ответы, ставит балл и заносит в журнал. Никакой ручной проверки.", en: "The moment a test is submitted the system marks it, scores it and logs the result — no manual grading." }
  },
  {
    id: 'level_check', cat: 'core', icon: Target, price: 89000,
    name: { uz: "Daraja Aniqlagich", ru: "Определение уровня", en: "Level Checker" },
    desc: { uz: "Test orqali mavzu darajasini aniqlaydi", ru: "Определяет уровень по теме через тест", en: "Gauges topic mastery via a test" },
    more: { uz: "Qisqa diagnostik test o'quvchi mavzuni qay darajada o'zlashtirganini aniqlaydi va aynan qaysi mavzular zaifligini ko'rsatadi.", ru: "Короткий диагностический тест показывает уровень усвоения темы и точные слабые места ученика.", en: "A short diagnostic test rates how well a student has mastered a topic and pinpoints their weak spots." }
  },

  // ATTENDANCE
  {
    id: 'att_qr', cat: 'attendance', icon: QrCode, price: 59000,
    name: { uz: "QR Davomat", ru: "QR посещаемость", en: "QR Attendance" },
    desc: { uz: "Telefon orqali tez belgilash", ru: "Отметка через телефон", en: "Quick check-in by phone" },
    more: { uz: "O'quvchilar darsga kirishda QR-kodni skaner qiladi — davomat jurnali avtomatik yuritiladi va hisobotga tushadi.", ru: "Ученики сканируют QR-код при входе — журнал посещаемости ведётся автоматически и попадает в отчёты.", en: "Students scan a QR code on the way in — the attendance log fills itself and flows into reports." }
  },
  {
    id: 'ai_camera', cat: 'attendance', icon: Camera, price: 199000, perStudent: 200, ai: true, popular: true,
    name: { uz: "AI Kamera Davomat", ru: "AI-камера посещаемости", en: "AI Camera Attendance" },
    desc: { uz: "Yuzni aniqlab avtomatik yozadi", ru: "Распознаёт лица автоматически", en: "Face-recognition auto check-in" },
    more: { uz: "Kamera o'quvchi yuzini aniqlab, darsga kelgan-kelmaganini o'zi belgilaydi. Qo'lda ro'yxat tutish shart emas; narx o'quvchi soniga qarab o'sadi.", ru: "Камера распознаёт лицо ученика и сама отмечает присутствие. Ручной перекличка не нужна; цена растёт с числом учеников.", en: "The camera recognizes each student's face and marks them present automatically. No roll-call; price scales with student count." }
  },
  {
    id: 'face_term', cat: 'attendance', icon: ScanFace, oneTime: 3000000, qty: true, install: true,
    name: { uz: "Face Terminal (qurilma)", ru: "Face-терминал (устройство)", en: "Face Terminal (device)" },
    desc: { uz: "Kirish eshigiga yuz skaneri, o'rnatish bilan", ru: "Скан лица на входе, с установкой", en: "Doorway face scanner, installation included" },
    more: { uz: "Kirish eshigiga o'rnatiladigan yuz skaneri qurilmasi. O'rnatish narxga kiritilgan; bir nechta filial uchun bir nechta qurilma buyurtma qilishingiz mumkin.", ru: "Устройство сканирования лица для установки на входе. Установка включена; для нескольких филиалов можно заказать несколько устройств.", en: "A face-scanner device mounted at the entrance. Installation is included; order several for multiple branches." }
  },

  // FINANCE
  {
    id: 'fee_status', cat: 'finance', icon: Wallet, price: 89000, popular: true,
    name: { uz: "O'quvchi To'lov Statusi", ru: "Статус оплат учеников", en: "Student Fee Status" },
    desc: { uz: "To'lagan / qarzdorni bir ko'rishda", ru: "Кто оплатил, кто должник", en: "See who paid at a glance" },
    more: { uz: "Har bir o'quvchi to'lagan yoki qarzdorligini bir ko'rinishda ko'rsatadi. Qarzdorlarga eslatmalar avtomatik yuboriladi.", ru: "Показывает по каждому ученику: оплатил или должник. Должникам автоматически уходят напоминания.", en: "Shows for every student whether they've paid or owe. Reminders go out to debtors automatically." }
  },
  {
    id: 'salary', cat: 'finance', icon: Banknote, price: 79000,
    name: { uz: "Ustoz Maoshlari", ru: "Зарплаты учителей", en: "Teacher Salaries" },
    desc: { uz: "Soat, foiz va bonus hisob-kitobi", ru: "Часы, проценты и бонусы", en: "Hours, percentage & bonuses" },
    more: { uz: "Soatbay, foizli yoki bonusli maosh hisob-kitobini avtomatlashtiradi. Har oy har bir ustoz uchun aniq hisob tayyor bo'ladi.", ru: "Автоматизирует расчёт зарплаты: почасовой, процентный или с бонусами. Каждый месяц — готовый расчёт по каждому учителю.", en: "Automates salary math — hourly, percentage or bonus-based — with a ready payout sheet per teacher each month." }
  },
  {
    id: 'expenses', cat: 'finance', icon: Calculator, price: 99000,
    name: { uz: "Xarajat & Byudjet", ru: "Расходы и бюджет", en: "Expenses & Budget" },
    desc: { uz: "Markaz foydasini nazorat qiling", ru: "Контроль прибыли центра", en: "Track your center's profit" },
    more: { uz: "Ijara, maosh, reklama kabi xarajatlarni daromad bilan solishtirib, markazning sof foydasini hisoblab beradi.", ru: "Сопоставляет расходы (аренда, зарплаты, реклама) с доходом и считает чистую прибыль центра.", en: "Weighs expenses like rent, salaries and ads against income to compute your center's net profit." }
  },
  {
    id: 'analytics', cat: 'finance', icon: TrendingUp, price: 119000, popular: true,
    name: { uz: "Markaz Analitikasi", ru: "Аналитика центра", en: "Center Analytics" },
    desc: { uz: "O'quvchilar o'sishi, foyda/zarar statistikasi", ru: "Рост учеников, прибыль/убыток", en: "Student growth, profit/loss stats" },
    more: { uz: "O'quvchilar sonining o'sishi, foyda/zarar dinamikasi va o'zlashtirish grafiklari. Qaysi guruh o'smoqda, qaysi biri yo'qotmoqda — hammasi ko'rinadi.", ru: "Динамика роста учеников, прибыли/убытка и успеваемости в графиках. Видно, какая группа растёт, а какая теряет.", en: "Charts for student growth, profit/loss and performance — you see which groups are growing and which are slipping." }
  },

  // GROWTH
  {
    id: 'parent', cat: 'growth', icon: UserCheck, price: 59000, popular: true,
    name: { uz: "Ota-ona Nazorati", ru: "Родительский контроль", en: "Parental Control" },
    desc: { uz: "Farzand natijalari, baholari va davomati", ru: "Оценки, результаты и посещаемость ребёнка", en: "Child's grades, results & attendance" },
    more: { uz: "Ota-onalar alohida kirish orqali farzandining test natijalari, baholari va darsga kelgan-kelmaganini real vaqtda ko'radi.", ru: "Родители через отдельный вход видят в реальном времени результаты тестов, оценки и посещаемость ребёнка.", en: "Through their own login, parents see their child's test results, grades and class attendance in real time." }
  },
  {
    id: 'gamify', cat: 'growth', icon: Trophy, price: 69000,
    name: { uz: "Geymifikatsiya & Reyting", ru: "Геймификация и рейтинг", en: "Gamification & Ranking" },
    desc: { uz: "XP, seriya va reyting jadvali", ru: "XP, серии и рейтинг", en: "XP, streaks & leaderboards" },
    more: { uz: "O'quvchilar test yechib XP yig'adi, kunlik seriyani saqlaydi va reytingda kuch sinaydi. Ichida bilim beruvchi mini-o'yinlar:", ru: "Ученики набирают XP за тесты, держат ежедневную серию и соревнуются в рейтинге. Внутри — обучающие мини-игры:", en: "Students earn XP for tests, keep a daily streak and compete on the leaderboard. Includes learning mini-games:" },
    details: [
      { icon: Crown, name: { uz: "Shaxmat o'yini", ru: "Шахматы", en: "Chess game" } },
      { icon: Keyboard, name: { uz: "Tez yozish (typing)", ru: "Скоропись (typing)", en: "Fast typing" } },
      { icon: Languages, name: { uz: "Typing bilan ingliz tili", ru: "Английский через typing", en: "Learn English by typing" } },
    ]
  },
  {
    id: 'library', cat: 'growth', icon: BookOpen, price: 49000,
    name: { uz: "Xalqaro Kutubxona", ru: "Глобальная библиотека", en: "Global Library" },
    desc: { uz: "AQSh va milliy dasturlar", ru: "Программы США и локальные", en: "USA & national curricula" },
    more: { uz: "AQSh (B.E.S.T.) va O'zbekiston dasturlari bo'yicha ochiq darsliklar va qo'llanmalarni bepul o'qish imkoniyati.", ru: "Открытые учебники и пособия по программам США (B.E.S.T.) и Узбекистана — бесплатный доступ.", en: "Free access to open textbooks and guides for the USA (B.E.S.T.) and Uzbek curricula." }
  },
  {
    id: 'mobile', cat: 'growth', icon: Smartphone, price: 149000, soon: true,
    name: { uz: "Brendli Mobil Ilova", ru: "Брендовое приложение", en: "Branded Mobile App" },
    desc: { uz: "O'z nomingiz bilan ilova", ru: "Приложение с вашим брендом", en: "App under your own brand" },
    more: { uz: "Android va iOS uchun o'z brendingizdagi ilova — logotip, nom va rang sxemasi siznikidan. Hozircha ishlab chiqilmoqda (tez orada).", ru: "Приложение под вашим брендом для Android и iOS — логотип, название и цвета ваши. Сейчас в разработке (скоро).", en: "An Android and iOS app under your own brand — logo, name and colors yours. Currently in development (coming soon)." }
  },
  {
    id: 'sms', cat: 'growth', icon: Send, price: 0, perStudent: 10000,
    name: { uz: "SMS", ru: "SMS", en: "SMS" },
    desc: { uz: "Ota-onalarga avtomatik SMS", ru: "Автоматические SMS родителям", en: "Automatic SMS to parents" },
    more: { uz: "SMS har bir o'quvchining ota-onasiga 2 ta xabar yuboradi: farzand o'quv markaziga kelganda va uyga qaytganida.", ru: "SMS отправляет родителям каждого ученика 2 сообщения: когда ребёнок пришёл в учебный центр и когда вернулся домой.", en: "SMS sends each student's parents 2 messages: when the child arrives at the center and when they head home." }
  },
];

const PER_STUDENT = 1500;              // monthly platform fee, per student
const BILLING = {
  monthly: { months: 1, off: 0 },
  half: { months: 6, off: 0.15 },
  yearly: { months: 12, off: 0.25 },
};

const PRESETS = {
  tutor: { modules: ['ai_test', 'ai_helper', 'subjects_db', 'auto_grade', 'gamify'], students: 40 },
  center: { modules: ['ai_test', 'ai_helper', 'subjects_db', 'auto_grade', 'level_check', 'att_qr', 'fee_status', 'salary', 'analytics', 'parent', 'gamify', 'library', 'sms'], students: 220 },
  school: { modules: MODULES.filter(m => !m.soon).map(m => m.id), students: 650 },
};

// ---- Copy ------------------------------------------------------------------
const T = {
  uz: {
    eyebrow: "NARXLAR KONSTRUKTORI",
    title: "O'z markazingizni yig'ing",
    sub: "Kerakli modullarni tanlang — narx real vaqtda hisoblanadi. Ortiqcha paketlar uchun to'lamaysiz.",
    presetLabel: "Tayyor to'plamlar",
    presets: { tutor: "Repetitor", center: "O'quv Markaz", school: "Premium Maktab" },
    popular: "mashhur",
    sizeTitle: "Markaz hajmi",
    sizeDesc: "O'quvchilar soni",
    students: "o'quvchi",
    billing: { monthly: "Oylik", half: "6 oylik", yearly: "Yillik" },
    cats: { core: "Ta'lim yadrosi", attendance: "Davomat", finance: "Moliya boshqaruvi", growth: "O'sish & Qo'shimcha" },
    receipt: "Sizning tarifingiz",
    platform: "Platforma (o'quvchi × oy)",
    perMonth: "/ oy",
    device: "qurilma",
    empty: "Modul tanlang — hisob shu yerda to'ldiriladi.",
    discount: "Chegirma",
    monthly: "Oylik to'lov",
    hardware: "Qurilmalar (bir martalik)",
    dueNow: "Hozir to'lov",
    period: "davr uchun",
    selected: "modul tanlandi",
    cta: "Tarifni rasmiylashtirish",
    guarantee: "14 kun bepul sinov · Istalgan vaqt bekor qilish",
    cur: "so'm",
    fan: "fan",
    installIncl: "o'rnatish bilan",
    aiScales: "o'quvchiga qarab o'sadi",
    perStudentLabel: "har o'quvchiga",
    seeMore: "Batafsil",
    comingSoon: "tez orada",
    subjectsHint: "Har +1 fan = 5% chegirma",
    mo: "oy",
    requests: "So'rovlar",
    incl: "bepul kiritilgan",
    pack: "paket",
    free: "Bepul",
    reqShort: "so'rov",
    tg: {
      greet: "Assalom alaykum! Edify platformasidan tarif tanladim:",
      students: "O'quvchilar soni",
      modules: "Tanlangan funksiyalar",
      subjects: "Fanlar",
      packs: "Qo'shimcha so'rovlar",
      hardware: "Qurilmalar",
      billing: "To'lov davri",
      monthly: "Oylik to'lov",
      onetime: "Bir martalik to'lov",
      due: "Hozirgi to'lov",
      outro: "Iltimos, batafsil ma'lumot bering.",
    },
  },
  ru: {
    eyebrow: "КОНСТРУКТОР ТАРИФА",
    title: "Соберите свой центр",
    sub: "Выбирайте нужные модули — цена считается в реальном времени. Платите только за то, что используете.",
    presetLabel: "Готовые наборы",
    presets: { tutor: "Репетитор", center: "Учебный центр", school: "Премиум школа" },
    popular: "популярно",
    sizeTitle: "Размер центра",
    sizeDesc: "Количество учеников",
    students: "учеников",
    billing: { monthly: "Ежемесячно", half: "6 месяцев", yearly: "Год" },
    cats: { core: "Основа обучения", attendance: "Посещаемость", finance: "Финансы", growth: "Рост и дополнения" },
    receipt: "Ваш тариф",
    platform: "Платформа (ученик × мес)",
    perMonth: "/ мес",
    device: "устройство",
    empty: "Выберите модуль — расчёт появится здесь.",
    discount: "Скидка",
    monthly: "Ежемесячно",
    hardware: "Оборудование (разово)",
    dueNow: "К оплате",
    period: "за период",
    selected: "модулей выбрано",
    cta: "Оформить тариф",
    guarantee: "14 дней бесплатно · Отмена в любой момент",
    cur: "сум",
    fan: "предм.",
    installIncl: "с установкой",
    aiScales: "растёт с числом учеников",
    perStudentLabel: "за ученика",
    seeMore: "Подробнее",
    comingSoon: "скоро",
    subjectsHint: "Каждый +1 предмет = 5% скидка",
    mo: "мес.",
    requests: "Запросы",
    incl: "бесплатно",
    pack: "пакет",
    free: "Бесплатно",
    reqShort: "запр.",
    tg: {
      greet: "Здравствуйте! Я собрал тариф на платформе Edify:",
      students: "Количество учеников",
      modules: "Выбранные функции",
      subjects: "Предметы",
      packs: "Доп. запросы",
      hardware: "Оборудование",
      billing: "Период оплаты",
      monthly: "Ежемесячно",
      onetime: "Разовый платёж",
      due: "К оплате сейчас",
      outro: "Подскажите, пожалуйста, детали.",
    },
  },
  en: {
    eyebrow: "PRICING BUILDER",
    title: "Assemble your center",
    sub: "Pick the modules you need — the price updates live. Never pay for bundles you won't use.",
    presetLabel: "Ready-made bundles",
    presets: { tutor: "Tutor", center: "Learning Center", school: "Premium School" },
    popular: "popular",
    sizeTitle: "Center size",
    sizeDesc: "Number of students",
    students: "students",
    billing: { monthly: "Monthly", half: "6 months", yearly: "Yearly" },
    cats: { core: "Learning Core", attendance: "Attendance", finance: "Finance", growth: "Growth & Extras" },
    receipt: "Your plan",
    platform: "Platform (student × mo)",
    perMonth: "/ mo",
    device: "device",
    empty: "Select a module — your quote fills in here.",
    discount: "Discount",
    monthly: "Per month",
    hardware: "Hardware (one-time)",
    dueNow: "Due now",
    period: "for the period",
    selected: "modules selected",
    cta: "Get this plan",
    guarantee: "14-day free trial · Cancel anytime",
    cur: "UZS",
    fan: "subj.",
    installIncl: "installation included",
    aiScales: "scales with students",
    perStudentLabel: "per student",
    seeMore: "See more",
    comingSoon: "soon",
    subjectsHint: "Each +1 subject = 5% off",
    mo: "mo",
    requests: "Requests",
    incl: "free included",
    pack: "pack",
    free: "Free",
    reqShort: "req",
    tg: {
      greet: "Hello! I've put together a plan on the Edify platform:",
      students: "Number of students",
      modules: "Selected features",
      subjects: "Subjects",
      packs: "Extra requests",
      hardware: "Hardware",
      billing: "Billing period",
      monthly: "Per month",
      onetime: "One-time payment",
      due: "Due now",
      outro: "Could you share more details, please?",
    },
  },
};

// ---- Helpers ---------------------------------------------------------------
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const start = ref.current;
    const end = value;
    if (start === end) return;
    const dur = 450;
    let raf = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else ref.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(display)}</>;
}

// ---- Main ------------------------------------------------------------------
export default function PricingBuilder() {
  const langCtx = useContext(LanguageContext);
  const lang: Lang = (langCtx?.lang ?? 'uz') as Lang;
  const t = T[lang];

  const [selected, setSelected] = useState<Record<string, boolean>>({ ai_test: true, ai_helper: true, subjects_db: true, auto_grade: true, gamify: true });
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, boolean>>({ math: true });
  const [qty, setQty] = useState<Record<string, number>>({ face_term: 1 });
  const [packs, setPacks] = useState<Record<string, number>>({});
  const [students, setStudents] = useState(120);
  const [billing, setBilling] = useState<keyof typeof BILLING>('monthly');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => {
    setActivePreset(null);
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };
  const toggleSubject = (id: string) => {
    setActivePreset(null);
    setSelectedSubjects((s) => ({ ...s, [id]: !s[id] }));
  };
  const setQ = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(1, (q[id] || 1) + delta) }));
  const setPack = (id: string, delta: number) =>
    setPacks((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + delta) }));

  const applyPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    const map: Record<string, boolean> = {};
    p.modules.forEach((id) => {
      const mod = MODULES.find((x) => x.id === id);
      if (mod && !mod.soon) map[id] = true;
    });
    setSelected(map);
    setStudents(p.students);
    setActivePreset(key);
  };

  // ---- Subjects math
  const subjChosen = SUBJECTS.filter((s) => selectedSubjects[s.id] && s.available);
  const subjCount = subjChosen.length;
  const subjDisc = subjectDiscount(subjCount);
  const subjectsRaw = subjChosen.reduce((a, s) => a + s.price, 0);
  const subjectsPrice = subjectsRaw * (1 - subjDisc);

  // ---- Per-module monthly (AI camera scales; request packs add on top)
  const moduleMonthly = (m: Module) => {
    if (m.type === 'subjects') return subjectsPrice;
    let base = m.price || 0;
    if (m.perStudent) base += m.perStudent * students;
    if (m.requests) base += (packs[m.id] || 0) * (m.packPrice || 0);
    return base;
  };

  // ---- Totals (soon modules never count)
  const platformFee = students * PER_STUDENT;
  const chosen = MODULES.filter((m) => selected[m.id] && !m.soon);
  const recurringModules = chosen.filter((m) => !m.oneTime).reduce((a, m) => a + moduleMonthly(m), 0);
  const recurringRaw = platformFee + recurringModules;

  const { months, off } = BILLING[billing];
  const monthlyAfter = recurringRaw * (1 - off);
  const periodTotal = monthlyAfter * months;
  const discountAmt = recurringRaw * off;

  const oneTime = chosen
    .filter((m) => m.oneTime)
    .reduce((a, m) => a + (m.oneTime || 0) * (qty[m.id] || 1), 0);

  const dueNow = periodTotal + oneTime;
  const count = chosen.length;

  const lineItems = [
    { key: 'platform', label: t.platform, note: `${fmt(students)} × ${fmt(PER_STUDENT)}`, value: platformFee, cat: 'core' as keyof typeof CATS },
    ...chosen.filter((m) => !m.oneTime).map((m) => {
      let note: string | undefined;
      if (m.type === 'subjects') note = `${subjCount} ${t.fan}${subjDisc > 0 ? ` · −${Math.round(subjDisc * 100)}%` : ''}`;
      else if (m.requests) {
        const tot = (m.requests || 0) + (packs[m.id] || 0) * (m.packSize || 0);
        note = `${fmt(tot)} ${t.reqShort}/${t.mo}`;
      } else if (m.perStudent) {
        const b = m.price || 0;
        note = b > 0 ? `${fmt(b)} + ${fmt(m.perStudent)}×${fmt(students)}` : `${fmt(m.perStudent)} × ${fmt(students)}`;
      }
      return { key: m.id, label: m.name[lang], note, value: moduleMonthly(m), cat: m.cat };
    }),
    ...chosen.filter((m) => m.oneTime).map((m) => ({
      key: m.id, label: m.name[lang], note: `${qty[m.id] || 1} × ${t.device} · ${t.installIncl}`,
      value: (m.oneTime || 0) * (qty[m.id] || 1), cat: m.cat, once: true,
    })),
  ];

  const grouped = (Object.keys(CATS) as (keyof typeof CATS)[]).map((cat) => ({
    cat,
    items: MODULES.filter((m) => m.cat === cat),
  }));

  const presetMeta: Record<string, { icon: any; color: string }> = {
    tutor: { icon: GraduationCap, color: '#2563EB' },
    center: { icon: Building2, color: '#7C3AED' },
    school: { icon: Star, color: '#D97706' },
  };

  // ---- Telegram order to admin
  const buildMsg = () => {
    const L = t.tg;
    const modNames = chosen.map((m) => m.name[lang]).join(', ');
    const packLines = MODULES
      .filter((m) => selected[m.id] && !m.soon && m.requests && (packs[m.id] || 0) > 0)
      .map((m) => `${m.name[lang]} +${fmt((packs[m.id] || 0) * (m.packSize || 0))}`);
    const hw = chosen.filter((m) => m.oneTime).map((m) => `${m.name[lang]} ×${qty[m.id] || 1}`);
    const lines: string[] = [
      L.greet,
      '',
      `👥 ${L.students}: ${fmt(students)}`,
      `🧩 ${L.modules}: ${modNames || '—'}`,
    ];
    if (selected['subjects_db'] && subjChosen.length) lines.push(`📚 ${L.subjects}: ${subjChosen.map((s) => s.name[lang]).join(', ')}`);
    if (packLines.length) lines.push(`➕ ${L.packs}: ${packLines.join(', ')}`);
    if (hw.length) lines.push(`🖥 ${L.hardware}: ${hw.join(', ')}`);
    lines.push('');
    lines.push(`💳 ${L.billing}: ${t.billing[billing]}`);
    lines.push(`💰 ${L.monthly}: ${fmt(monthlyAfter)} ${t.cur}`);
    if (oneTime > 0) lines.push(`🔧 ${L.onetime}: ${fmt(oneTime)} ${t.cur}`);
    lines.push(`🧾 ${L.due}: ${fmt(dueNow)} ${t.cur}`);
    lines.push('');
    lines.push(L.outro);
    return lines.join('\n');
  };

  const openTelegram = () => {
    const url = `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(buildMsg())}`;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full font-sans text-slate-900" style={{ background: '#F8FAFC' }}>
      <style>{`
        @keyframes floatGlow { 0%,100%{transform:translateY(0) scale(1);opacity:.5} 50%{transform:translateY(-14px) scale(1.05);opacity:.8} }
        @keyframes popIn { 0%{transform:scale(.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        .pb-pop { animation: popIn .28s cubic-bezier(.2,.9,.3,1.2) both; }
        .pb-card { transition: transform .25s cubic-bezier(.2,.9,.3,1), box-shadow .25s, border-color .2s, background .2s; }
        .pb-card:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce){
          .pb-card,.pb-card:hover{transform:none!important}
          .pb-pop{animation:none!important}
        }
      `}</style>

      <section className="relative overflow-hidden py-16 lg:py-24 px-4 lg:px-8">
        {/* ambient glows */}
        <div className="absolute top-0 right-0 rounded-full pointer-events-none"
          style={{ width: 520, height: 520, background: 'radial-gradient(circle, rgba(59,130,246,.10), transparent 70%)', animation: 'floatGlow 9s ease-in-out infinite' }} />
        <div className="absolute bottom-0 left-0 rounded-full pointer-events-none"
          style={{ width: 420, height: 420, background: 'radial-gradient(circle, rgba(139,92,246,.10), transparent 70%)', animation: 'floatGlow 11s ease-in-out infinite reverse' }} />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* ---- Header (language follows the navbar switcher) ---- */}
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-blue-600 text-[11px] font-black uppercase tracking-widest mb-5 shadow-sm">
              <Sparkles size={13} /> {t.eyebrow}
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-4">
              {t.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg,#2563EB,#7C3AED)' }}>
                {t.title.split(' ').slice(-1)}
              </span>
            </h2>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">{t.sub}</p>
          </div>

          {/* ---- Presets + billing ---- */}
          <div className="flex flex-col xl:flex-row gap-4 justify-between mb-10">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2.5">{t.presetLabel}</div>
              <div className="flex flex-wrap gap-2.5">
                {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((key) => {
                  const M = presetMeta[key];
                  const on = activePreset === key;
                  return (
                    <button key={key} onClick={() => applyPreset(key)}
                      className="pb-card inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm border-2"
                      style={on
                        ? { borderColor: M.color, background: '#fff', color: M.color, boxShadow: `0 8px 24px -8px ${M.color}55` }
                        : { borderColor: '#E2E8F0', background: '#fff', color: '#334155' }}>
                      <M.icon size={16} style={{ color: M.color }} />
                      {t.presets[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2.5 xl:text-right">&nbsp;</div>
              <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
                {(Object.keys(BILLING) as (keyof typeof BILLING)[]).map((key) => {
                  const on = billing === key;
                  const pct = Math.round(BILLING[key].off * 100);
                  return (
                    <button key={key} onClick={() => setBilling(key)}
                      className="relative px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      style={on ? { background: '#2563EB', color: '#fff', boxShadow: '0 6px 16px -4px rgba(37,99,235,.5)' } : { color: '#475569' }}>
                      {t.billing[key]}
                      {pct > 0 && (
                        <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded"
                          style={on ? { background: 'rgba(255,255,255,.2)', color: '#fff' } : { background: '#ECFDF5', color: '#059669' }}>
                          −{pct}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- Body: modules + receipt ---- */}
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* modules */}
            <div className="lg:col-span-2 space-y-8">
              {/* size slider */}
              <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: '#0F172A' }}>
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{t.sizeTitle}</div>
                      <div className="text-xs text-slate-400 font-medium">{t.sizeDesc}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black tracking-tight text-slate-900">{fmt(students)}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase">{t.students}</div>
                  </div>
                </div>
                <input type="range" min={20} max={2000} step={10} value={students}
                  onChange={(e) => { setStudents(+e.target.value); setActivePreset(null); }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(90deg,#2563EB ${((students - 20) / 1980) * 100}%, #E2E8F0 ${((students - 20) / 1980) * 100}%)` }} />
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mt-2">
                  <span>20</span><span>2000</span>
                </div>
              </div>

              {/* categories */}
              {grouped.map(({ cat, items }) => {
                const c = CATS[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.solid }} />
                      <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: c.text }}>{t.cats[cat]}</h3>
                      <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {items.map((m) => {
                        const isSoon = !!m.soon;
                        const on = !isSoon && !!selected[m.id];
                        const Icon = m.icon;
                        const packCount = packs[m.id] || 0;
                        const isFree = !!m.requests && moduleMonthly(m) === 0;
                        return (
                          <button key={m.id} onClick={() => { if (!isSoon) toggle(m.id); }}
                            className={`pb-card text-left rounded-2xl p-5 border-2 relative ${isSoon ? 'opacity-70' : ''}`}
                            style={isSoon
                              ? { borderColor: '#E2E8F0', background: '#F8FAFC', cursor: 'not-allowed' }
                              : on
                                ? { borderColor: c.ring, background: c.tint, boxShadow: `0 14px 30px -12px ${c.ring}55` }
                                : { borderColor: '#E2E8F0', background: '#fff' }}>
                            {isSoon ? (
                              <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full"
                                style={{ background: '#E2E8F0', color: '#64748B' }}><Lock size={9} /> {t.comingSoon}</span>
                            ) : m.popular ? (
                              <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full"
                                style={{ background: c.solid, color: '#fff' }}>★ {t.popular}</span>
                            ) : null}

                            <div className="flex items-start gap-3.5 mb-3">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                style={isSoon ? { background: '#F1F5F9', color: '#94A3B8' } : on ? { background: c.solid, color: '#fff' } : { background: c.tint, color: c.text }}>
                                <Icon size={20} />
                              </div>
                              <div className="flex-1 min-w-0 pr-6">
                                <div className="font-black text-slate-900 text-[15px] leading-tight">{m.name[lang]}</div>
                                <div className="text-[12.5px] text-slate-500 font-medium leading-snug mt-0.5">{m.desc[lang]}</div>
                              </div>
                            </div>

                            {/* AI request quota + extra packs (free tier) */}
                            {m.requests && (
                              <div onClick={(e) => e.stopPropagation()} className="mb-3 flex items-center justify-between rounded-xl p-2.5 border"
                                style={{ borderColor: on ? c.ring : '#E2E8F0', background: on ? '#fff' : '#F8FAFC' }}>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-black text-slate-700">
                                    {t.requests}: {fmt((m.requests || 0) + packCount * (m.packSize || 0))}/{t.mo}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400">
                                    {fmt(m.requests || 0)} {t.incl} · +{fmt(m.packSize || 0)} = {fmt(m.packPrice || 0)} {t.cur}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="rounded-lg w-6 h-6 flex items-center justify-center cursor-pointer border" style={{ borderColor: c.ring, color: c.text }} onClick={() => setPack(m.id, -1)}><Minus size={12} /></span>
                                  <span className="font-black text-xs w-4 text-center" style={{ color: c.text }}>{packCount}</span>
                                  <span className="rounded-lg w-6 h-6 flex items-center justify-center cursor-pointer border" style={{ borderColor: c.ring, color: c.text }} onClick={() => setPack(m.id, 1)}><Plus size={12} /></span>
                                </div>
                              </div>
                            )}

                            {/* Subjects picker */}
                            {m.type === 'subjects' && (
                              <div onClick={(e) => e.stopPropagation()} className="mb-3">
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {SUBJECTS.map((s) => {
                                    const son = !!selectedSubjects[s.id];
                                    const av = s.available;
                                    return (
                                      <span key={s.id}
                                        onClick={() => av && toggleSubject(s.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${av ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                        style={
                                          !av ? { background: '#F1F5F9', color: '#94A3B8', borderColor: '#E2E8F0' }
                                            : son ? { background: c.solid, color: '#fff', borderColor: c.solid }
                                              : { background: '#fff', color: c.text, borderColor: c.ring }
                                        }>
                                        {!av && <Lock size={10} />}
                                        {s.name[lang]}
                                        {av && 'count' in s && s.count && <span className="opacity-70">{s.count}</span>}
                                        {!av && <span className="opacity-80">· {t.comingSoon}</span>}
                                      </span>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: c.text }}>
                                  <Sparkles size={10} /> {t.subjectsHint}
                                </div>
                              </div>
                            )}

                            {/* "See more" — summary for every function */}
                            {(m.more || m.details) && (
                              <div onClick={(e) => e.stopPropagation()} className="mb-3">
                                <span onClick={() => setExpanded((x) => (x === m.id ? null : m.id))}
                                  className="inline-flex items-center gap-1 text-[11px] font-black cursor-pointer" style={{ color: c.text }}>
                                  <Info size={12} /> {t.seeMore}
                                  <ChevronDown size={12} style={{ transform: expanded === m.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                                </span>
                                {expanded === m.id && (
                                  <div className="mt-2 pb-pop">
                                    {m.more && (
                                      <p className="text-[12px] text-slate-600 font-medium leading-relaxed mb-2 pl-2 border-l-2" style={{ borderColor: c.ring }}>
                                        {m.more[lang]}
                                      </p>
                                    )}
                                    {m.details && (
                                      <div className="space-y-1.5">
                                        {m.details.map((d, i) => {
                                          const DI = d.icon;
                                          return (
                                            <div key={i} className="flex items-center gap-2 text-[12px] font-bold text-slate-600">
                                              <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: c.tint, color: c.text }}><DI size={13} /></span>
                                              {d.name[lang]}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-4">
                              <div className="flex flex-col">
                                <div className="font-black text-slate-900">
                                  {m.oneTime ? (
                                    <><span className="text-[10px] font-bold text-slate-400 uppercase mr-1">{t.device}</span>{fmt(m.oneTime)}<span className="text-xs text-slate-400 font-bold ml-1">{t.cur}</span></>
                                  ) : isFree ? (
                                    <span style={{ color: '#059669' }}>{t.free}<span className="text-xs text-slate-400 font-bold ml-1">{t.cur}{t.perMonth}</span></span>
                                  ) : (
                                    <>{fmt(moduleMonthly(m))}<span className="text-xs text-slate-400 font-bold ml-1">{t.cur}{t.perMonth}</span></>
                                  )}
                                </div>
                                {m.perStudent && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{fmt(m.perStudent)} {t.cur} · {t.perStudentLabel}</div>}
                                {m.oneTime && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{t.installIncl}</div>}
                              </div>

                              {isSoon ? (
                                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0" style={{ background: '#F1F5F9', color: '#94A3B8' }}>{t.comingSoon}</span>
                              ) : on && m.qty ? (
                                <div className="flex items-center gap-2 pb-pop" onClick={(e) => e.stopPropagation()}>
                                  <span className="rounded-lg w-7 h-7 flex items-center justify-center cursor-pointer border" style={{ borderColor: c.ring, color: c.text }} onClick={() => setQ(m.id, -1)}><Minus size={14} /></span>
                                  <span className="font-black w-5 text-center" style={{ color: c.text }}>{qty[m.id] || 1}</span>
                                  <span className="rounded-lg w-7 h-7 flex items-center justify-center cursor-pointer border" style={{ borderColor: c.ring, color: c.text }} onClick={() => setQ(m.id, 1)}><Plus size={14} /></span>
                                </div>
                              ) : (
                                <span className="w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0"
                                  style={on ? { background: c.solid, borderColor: c.solid, color: '#fff' } : { borderColor: '#CBD5E1', color: 'transparent' }}>
                                  <Check size={16} className={on ? 'pb-pop' : ''} strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ---- RECEIPT (signature element) ---- */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-3xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)] border border-slate-800" style={{ background: '#0A0F1C' }}>
                {/* header */}
                <div className="px-6 pt-6 pb-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#111827,#1e1b4b)' }}>
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,.25), transparent 70%)' }} />
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,.1)' }}>
                      <Receipt size={18} />
                    </div>
                    <div className="font-black text-white text-lg tracking-tight">{t.receipt}</div>
                    <div className="ml-auto text-[11px] font-bold text-slate-400">{count + 1} {t.selected}</div>
                  </div>
                </div>

                {/* perforation */}
                <div className="h-4 relative" style={{ background: '#0A0F1C' }}>
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2">
                    {Array.from({ length: 22 }).map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e293b' }} />
                    ))}
                  </div>
                </div>

                {/* line items */}
                <div className="px-6 pb-4 max-h-[300px] overflow-y-auto">
                  {lineItems.length === 0 ? (
                    <div className="py-10 text-center text-slate-500 text-sm font-medium">{t.empty}</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
                      {lineItems.map((li) => (
                        <div key={li.key} className="flex items-start justify-between gap-3 py-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: CATS[li.cat].ring }} />
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-bold text-slate-100 leading-tight truncate">{li.label}</div>
                              {li.note && <div className="text-[11px] text-slate-500 font-medium mt-0.5">{li.note}{(li as any).once ? '' : ` ${t.cur}${t.perMonth}`}</div>}
                            </div>
                          </div>
                          <div className="text-[13.5px] font-black whitespace-nowrap tabular-nums" style={{ color: li.value > 0 ? '#E2E8F0' : '#34D399' }}>
                            {li.value > 0 ? fmt(li.value) : t.free}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* totals */}
                <div className="px-6 py-5 space-y-2.5" style={{ background: 'rgba(255,255,255,.03)', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  {off > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 text-sm font-bold">
                      <span className="flex items-center gap-1.5"><Zap size={13} /> {t.discount} · −{Math.round(off * 100)}%</span>
                      <span>− {fmt(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400 text-sm font-bold">{t.monthly}</span>
                    <span className="text-white font-black text-lg tabular-nums">
                      <AnimatedNumber value={monthlyAfter} /> <span className="text-xs text-slate-500 font-bold">{t.cur}</span>
                    </span>
                  </div>
                  {oneTime > 0 && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-sm font-bold">{t.hardware}</span>
                      <span className="text-white font-black tabular-nums">{fmt(oneTime)} <span className="text-xs text-slate-500 font-bold">{t.cur}</span></span>
                    </div>
                  )}

                  <div className="pt-3 mt-1 border-t" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
                    <div className="flex justify-between items-baseline mb-1">
                      <div>
                        <div className="text-white font-black text-base">{t.dueNow}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{months} {t.mo} {t.period}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-transparent bg-clip-text tabular-nums" style={{ backgroundImage: 'linear-gradient(90deg,#60A5FA,#A78BFA)' }}>
                          <AnimatedNumber value={dueNow} />
                        </div>
                        <div className="text-[11px] font-black text-slate-500 uppercase -mt-0.5">{t.cur}</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={openTelegram}
                    className="pb-card w-full mt-3 py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(90deg,#2563EB,#7C3AED)', boxShadow: '0 12px 30px -8px rgba(99,102,241,.6)' }}>
                    <Send size={17} className="-ml-0.5" /> {t.cta} <ChevronRight size={18} />
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium pt-1">
                    <ShieldCheck size={13} className="text-emerald-500" /> {t.guarantee}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}