"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft, CheckCircle2, BookOpen, Minus, Wand2, Trash2, Layers, EyeOff, Eye, Menu, X, ChevronRight, Calculator, Atom, BookA, Globe, FlaskConical, Leaf, Landmark, Bot, Zap, Plus, Database, Gavel, Crown } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import { toQuestionV1, InvalidTopicError } from "@/lib/questionSchema";
import type { TopicPath } from "@/lib/questionTopics";
import { useAuth } from "@/lib/AuthContext";
import toast from "react-hot-toast";
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import TestConfigurationModal from "@/app/teacher/create/_components/TestConfigurationModal";
import TopicAssignModal from "@/app/teacher/create/_components/TopicAssignModal";
import { useTeacherLanguage } from "@/app/teacher/layout";

import { Button, Skeleton } from "@/components/ui";

// 🟢 NEW MONTHLY LIMIT IMPORTS
import { useMonthlyLimit } from "@/hooks/useMonthlyLimit";
import AiMonthlyLimitCard from "@/app/teacher/create/_components/AiMonthlyLimitCard";

// 🟢 ALL UZBEKISTAN SUBJECTS (M3 three-tone rotation — no rainbow accents)
const UZB_SUBJECTS = [
  { id: "Matematika", icon: Calculator, color: "text-on-primary-container", bg: "bg-primary-container", border: "border-primary" },
  { id: "Fizika", icon: Atom, color: "text-on-secondary-container", bg: "bg-secondary-container", border: "border-secondary" },
  { id: "Kimyo", icon: FlaskConical, color: "text-on-tertiary-container", bg: "bg-tertiary-container", border: "border-tertiary" },
  { id: "Biologiya", icon: Leaf, color: "text-on-primary-container", bg: "bg-primary-container", border: "border-primary" },
  { id: "Ona tili va adabiyot", icon: BookA, color: "text-on-secondary-container", bg: "bg-secondary-container", border: "border-secondary" },
  { id: "Tarix", icon: Landmark, color: "text-on-tertiary-container", bg: "bg-tertiary-container", border: "border-tertiary" },
  { id: "Geografiya", icon: Globe, color: "text-on-primary-container", bg: "bg-primary-container", border: "border-primary" },
  { id: "Informatika", icon: Bot, color: "text-on-secondary-container", bg: "bg-secondary-container", border: "border-secondary" },
  { id: "Huquqshunoslik", icon: Gavel, color: "text-on-tertiary-container", bg: "bg-tertiary-container", border: "border-tertiary" }
];

// --- TRANSLATION DICTIONARY ---
const AI_TRANSLATIONS: Record<string, any> = {
  uz: {
    thinkingTitle: "AI Studiya ishlamoqda",
    thinkingPhrases: [
      "Mavzu tahlil qilinmoqda...",
      "Qiyinlik darajasi moslashtirilmoqda...",
      "Savollar va javoblar yozilmoqda...",
      "Formula va chizmalar tekshirilmoqda..."
    ],
    hideSolution: "Yechimni yashirish", aiSolution: "AI Yechim", aiSolutionLogic: "AI Yechim Mantiqi",
    difficulties: { easy: "Oson", medium: "O'rtacha", hard: "Murakkab", olympiad: "Olimpiada" },
    subjects: {
      "Matematika": "Matematika", "Fizika": "Fizika", "Kimyo": "Kimyo", "Biologiya": "Biologiya",
      "Ona tili va adabiyot": "Ona tili va adabiyot", "Tarix": "Tarix", "Geografiya": "Geografiya",
      "Informatika": "Informatika", "Huquqshunoslik": "Huquqshunoslik"
    },
    toasts: {
      errSelectSubjectTopic: "Iltimos, fan va mavzuni kiriting.",
      added: (n: number) => `${n} savol qo'shildi!`,
      errGeneric: "Xatolik yuz berdi.",
      errCreateFirst: "Oldin savol yarating.",
      errPickTopic: "Iltimos, savollar uchun mavzu tanlang.",
      savedToBank: "Savollar bazangizga muvaffaqiyatli saqlandi!",
      errSaveBank: "Bazaga saqlashda xatolik yuz berdi.",
      errEnterTitle: "Test nomini kiriting.",
      published: "Test muvaffaqiyatli nashr qilindi!",
      errPublish: "Nashr qilishda xatolik."
    },
    limitLeftDetailed: (n: number) => `Sizda oylik limitdan ${n} ta savol qoldi. Iltimos so'ralayotgan miqdorni kamaytiring yoki tarifni oshiring.`,
    limitReached: "Oylik AI limitingiz yetarli emas. Tarifingizni oshiring yoki keyingi oyni kuting.",
    limitLeftGenerate: (n: number) => `Sizda ${n} ta savol yaratish uchun limit qoldi. Iltimos so'ralayotgan miqdorni kamaytiring yoki tarifni oshiring.`,
    premiumFeature: "Premium Xususiyat", viewPlans: "Tariflarni ko'rish", goBack: "Orqaga qaytish",
    titleModal: { title: "Test nomini kiriting", desc: "Yaratilgan testni saqlashdan oldin nom bering.", placeholder: "Masalan: Olimpiada tayyorgarligi", cancel: "Bekor qilish", next: "Keyingi Qadam" },
    subjectModal: { title: "Fanni tanlang", desc: "Barcha fanlar ruyxati" },
    topBarTitle: "AI Studiya", sidebarTitle: "Smart AI Studiya",
    step1: "1. Fanni tanlang", selectedSubject: "Tanlangan Fan", selectSubjectPlaceholder: "Fanni tanlang...",
    step2: "2. O'quv mavzusi", topicPlaceholder: "Mavzu nomini yozing... (masalan: Kvadrat ildizlar)",
    step3: "3. Qiyinlik darajasi", step4: "4. Savollar soni",
    lowLimitWarning: (n: number) => <>Sizda oylik limitdan faqatgina <span className="font-black">{n} ta</span> savol qoldi.</>,
    generating: "Yaratilmoqda...", generateBtn: "Savol Yaratish",
    draftTitle: "AI Qoralama", questionCountBadge: (n: number) => `${n} Savol`,
    saveToBank: "Bazaga Saqlash", publish: "Nashr qilish",
    emptyTitle: "Yaratishga tayyor.", emptyDesc: "Chap tomondan fanni tanlang va mavzu nomini yozib savollar yarating.",
    mobileCount: (n: number) => `${n} ta savol`,
    morePrompt: "Yana savol qo'shmoqchimisiz?", morePromptDesc: "Mavzuni o'zgartirib 'Yaratish' tugmasini yana bir bor bosing.",
    mobileSave: "Saqlash", mobilePublish: "Nashr Qilish"
  },
  en: {
    thinkingTitle: "AI Studio is working",
    thinkingPhrases: [
      "Analyzing the topic...",
      "Adjusting the difficulty level...",
      "Writing questions and answers...",
      "Checking formulas and diagrams..."
    ],
    hideSolution: "Hide solution", aiSolution: "AI Solution", aiSolutionLogic: "AI Solution Logic",
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard", olympiad: "Olympiad" },
    subjects: {
      "Matematika": "Mathematics", "Fizika": "Physics", "Kimyo": "Chemistry", "Biologiya": "Biology",
      "Ona tili va adabiyot": "Native language & literature", "Tarix": "History", "Geografiya": "Geography",
      "Informatika": "Computer science", "Huquqshunoslik": "Law"
    },
    toasts: {
      errSelectSubjectTopic: "Please select a subject and enter a topic.",
      added: (n: number) => `${n} questions added!`,
      errGeneric: "An error occurred.",
      errCreateFirst: "Generate questions first.",
      errPickTopic: "Please select a topic for the questions.",
      savedToBank: "Questions saved to your bank successfully!",
      errSaveBank: "Error saving to the bank.",
      errEnterTitle: "Enter a test title.",
      published: "Test published successfully!",
      errPublish: "Error publishing the test."
    },
    limitLeftDetailed: (n: number) => `You have ${n} questions left in your monthly limit. Please reduce the requested amount or upgrade your plan.`,
    limitReached: "Your monthly AI limit is not enough. Upgrade your plan or wait for next month.",
    limitLeftGenerate: (n: number) => `You have a limit of ${n} questions left to generate. Please reduce the requested amount or upgrade your plan.`,
    premiumFeature: "Premium Feature", viewPlans: "View plans", goBack: "Go back",
    titleModal: { title: "Enter a test title", desc: "Name the generated test before saving it.", placeholder: "E.g.: Olympiad preparation", cancel: "Cancel", next: "Next Step" },
    subjectModal: { title: "Select a subject", desc: "List of all subjects" },
    topBarTitle: "AI Studio", sidebarTitle: "Smart AI Studio",
    step1: "1. Select a subject", selectedSubject: "Selected Subject", selectSubjectPlaceholder: "Select a subject...",
    step2: "2. Study topic", topicPlaceholder: "Type the topic name... (e.g.: Square roots)",
    step3: "3. Difficulty level", step4: "4. Number of questions",
    lowLimitWarning: (n: number) => <>You only have <span className="font-black">{n}</span> questions left in your monthly limit.</>,
    generating: "Generating...", generateBtn: "Generate Questions",
    draftTitle: "AI Draft", questionCountBadge: (n: number) => `${n} Questions`,
    saveToBank: "Save to Bank", publish: "Publish",
    emptyTitle: "Ready to generate.", emptyDesc: "Select a subject on the left and type a topic name to generate questions.",
    mobileCount: (n: number) => `${n} questions`,
    morePrompt: "Want to add more questions?", morePromptDesc: "Change the topic and press 'Generate' once again.",
    mobileSave: "Save", mobilePublish: "Publish"
  },
  ru: {
    thinkingTitle: "AI Студия работает",
    thinkingPhrases: [
      "Анализ темы...",
      "Настройка уровня сложности...",
      "Составление вопросов и ответов...",
      "Проверка формул и схем..."
    ],
    hideSolution: "Скрыть решение", aiSolution: "AI Решение", aiSolutionLogic: "Логика AI Решения",
    difficulties: { easy: "Лёгкий", medium: "Средний", hard: "Сложный", olympiad: "Олимпиадный" },
    subjects: {
      "Matematika": "Математика", "Fizika": "Физика", "Kimyo": "Химия", "Biologiya": "Биология",
      "Ona tili va adabiyot": "Родной язык и литература", "Tarix": "История", "Geografiya": "География",
      "Informatika": "Информатика", "Huquqshunoslik": "Правоведение"
    },
    toasts: {
      errSelectSubjectTopic: "Пожалуйста, выберите предмет и введите тему.",
      added: (n: number) => `Добавлено вопросов: ${n}!`,
      errGeneric: "Произошла ошибка.",
      errCreateFirst: "Сначала создайте вопросы.",
      errPickTopic: "Пожалуйста, выберите тему для вопросов.",
      savedToBank: "Вопросы успешно сохранены в вашу базу!",
      errSaveBank: "Ошибка при сохранении в базу.",
      errEnterTitle: "Введите название теста.",
      published: "Тест успешно опубликован!",
      errPublish: "Ошибка при публикации."
    },
    limitLeftDetailed: (n: number) => `В вашем месячном лимите осталось ${n} вопросов. Пожалуйста, уменьшите запрашиваемое количество или повысьте тариф.`,
    limitReached: "Вашего месячного AI-лимита недостаточно. Повысьте тариф или дождитесь следующего месяца.",
    limitLeftGenerate: (n: number) => `У вас остался лимит на создание ${n} вопросов. Пожалуйста, уменьшите запрашиваемое количество или повысьте тариф.`,
    premiumFeature: "Премиум-функция", viewPlans: "Посмотреть тарифы", goBack: "Вернуться назад",
    titleModal: { title: "Введите название теста", desc: "Дайте название созданному тесту перед сохранением.", placeholder: "Например: Подготовка к олимпиаде", cancel: "Отмена", next: "Следующий шаг" },
    subjectModal: { title: "Выберите предмет", desc: "Список всех предметов" },
    topBarTitle: "AI Студия", sidebarTitle: "Smart AI Студия",
    step1: "1. Выберите предмет", selectedSubject: "Выбранный предмет", selectSubjectPlaceholder: "Выберите предмет...",
    step2: "2. Учебная тема", topicPlaceholder: "Введите название темы... (например: Квадратные корни)",
    step3: "3. Уровень сложности", step4: "4. Количество вопросов",
    lowLimitWarning: (n: number) => <>В вашем месячном лимите осталось всего <span className="font-black">{n}</span> вопросов.</>,
    generating: "Создание...", generateBtn: "Создать вопросы",
    draftTitle: "AI Черновик", questionCountBadge: (n: number) => `${n} Вопросов`,
    saveToBank: "Сохранить в базу", publish: "Опубликовать",
    emptyTitle: "Готово к созданию.", emptyDesc: "Выберите предмет слева и введите название темы, чтобы создать вопросы.",
    mobileCount: (n: number) => `Вопросов: ${n}`,
    morePrompt: "Хотите добавить ещё вопросы?", morePromptDesc: "Измените тему и нажмите «Создать» ещё раз.",
    mobileSave: "Сохранить", mobilePublish: "Опубликовать"
  }
};

interface AIQuestion {
  id: string;
  uiDifficulty: string;
  question: { uz: string; ru: string; en: string };
  options: { A: { uz: string; ru: string; en: string }; B: { uz: string; ru: string; en: string }; C: { uz: string; ru: string; en: string }; D: { uz: string; ru: string; en: string }; };
  answer: string;
  explanation: { uz: string; ru: string; en: string };
  difficultyId: number;
  /** The free text the teacher typed into the generator — a display chip only,
   *  NOT taxonomy. The bank topic is chosen in TopicAssignModal at save time. */
  topicLabel: string;
}

/* ─── topic taxonomy ────────────────────────────────────────────────────────
 * The subject/topic the teacher typed into the generator is free text — it is NOT
 * the question-bank taxonomy (data/question_topics.json). `toQuestionV1()` throws
 * InvalidTopicError on anything else, so the teacher files the batch through
 * TopicAssignModal before a single doc is written. */

/** Short plain-text label for one topic-picker row. */
const getPlainText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 120);
  const v = value as Record<string, unknown>;
  const raw = v.uz ?? v.ru ?? v.en ?? "";
  return typeof raw === "string" ? raw.slice(0, 120) : getPlainText(raw);
};

/** ⚠️ objects, not bare strings — `normalizeQuestion` reads `.id`/`.name`. */
const topicFields = (p: TopicPath) => ({
  subject: { id: p.subjectId, name: p.subjectName },
  topic: { id: p.topicId, name: p.topicName },
  subtopic: { id: p.subtopicId, name: p.subtopicName },
  chapter: { id: "", name: "" },
});

/** custom_tests header name: the shared value, or "Aralash" when the batch spans several. */
const sharedName = (paths: TopicPath[], key: "subjectName" | "topicName" | "subtopicName") => {
  const uniq = [...new Set(paths.map((p) => p[key]))];
  return uniq.length === 1 ? uniq[0] : "Aralash";
};

const AiThinkingModal = ({ isVisible }: { isVisible: boolean }) => {
  const { lang } = useTeacherLanguage();
  const t = AI_TRANSLATIONS[lang] || AI_TRANSLATIONS['uz'];
  const phrases: string[] = t.thinkingPhrases;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isVisible, phrases.length]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-[320px] md:max-w-md bg-surface-container-low rounded-m3-xl shadow-elev-3 p-6 md:p-8 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)] rounded-full blur-[80px] animate-pulse"></div>
            <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-[color-mix(in_oklab,var(--m3-tertiary)_20%,transparent)] rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "1s" }}></div>
            <div className="relative mb-6 md:mb-8 mt-2 md:mt-4">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-tr from-primary to-tertiary rounded-full blur-xl opacity-40" />
              <div className="relative w-20 h-20 md:w-24 md:h-24 bg-surface-container-lowest rounded-m3-lg md:rounded-m3-xl flex items-center justify-center shadow-elev-3">
                <Bot size={36} className="text-primary animate-bounce md:w-11 md:h-11" style={{ animationDuration: "2s" }} />
                <Sparkles size={16} className="absolute -top-2 -right-2 text-warning animate-pulse md:w-5 md:h-5 md:-top-3 md:-right-3" />
              </div>
            </div>
            <h3 className="text-lg md:text-xl font-black text-on-surface mb-1 md:mb-2 relative z-10 tracking-tight text-center">{t.thinkingTitle}</h3>
            <div className="h-5 md:h-6 relative z-10 overflow-hidden flex items-center justify-center w-full">
              <motion.p key={phraseIndex} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4 }} className="text-[12px] md:text-[14px] font-medium text-on-surface-variant absolute text-center w-full">{phrases[phraseIndex]}</motion.p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const FormattedText = ({ text }: { text: any }) => {
  if (!text) return null;
  let content = typeof text === 'string' ? text : JSON.stringify(text);

  const hasMathCommands = /\\frac|\\pi|\\sin|\\cos|\\tan|\\ge|\\le|\\cup|\\cap|\\in|\\begin|\\sqrt|\\empty/.test(content);
  if (!content.includes('$') && hasMathCommands) content = `$${content}$`;

  content = content.replace(/\\\((.*?)\\\)/g, '$$$1$$').replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$').replace(/&nbsp;/g, ' ').replace(/\\\\/g, '\\');
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className="break-words leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="block my-2 md:my-3 text-center overflow-x-auto custom-scrollbar" />;
          } catch (e) { return <span key={index} className="text-on-error-container font-mono text-[11px] md:text-[13px] bg-error-container px-1 rounded-m3-xs">{part}</span>; }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="px-0.5 inline-block" />;
          } catch (e) { return <span key={index} className="text-on-error-container font-mono text-[11px] md:text-[13px] bg-error-container px-1 rounded-m3-xs">{part}</span>; }
        }
        return <span key={index}>{part.split('\n').map((line, i, arr) => (<span key={i}>{line}{i < arr.length - 1 && <br />}</span>))}</span>;
      })}
    </span>
  );
};

const AIQuestionCard = ({ q, idx, onRemove }: { q: AIQuestion, idx: number, onRemove: (id: string) => void }) => {
  const { lang } = useTeacherLanguage();
  const t = AI_TRANSLATIONS[lang] || AI_TRANSLATIONS['uz'];
  const [showOptions, setShowOptions] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);

  const getText = (field: any): string => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (field.uz && typeof field.uz === "string") return field.uz;
    if (field.uz && field.uz.uz) return field.uz.uz;
    return JSON.stringify(field);
  };

  return (
    <div className="bg-surface-container-low p-4 md:p-6 rounded-m3-lg border border-outline-variant shadow-elev-1 hover:shadow-elev-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 relative group mb-4">

      <div className="flex justify-between items-start mb-3">
        <span className="bg-primary-container text-on-primary-container text-[10px] md:text-[11px] font-black px-3 py-1.5 rounded-m3-sm md:rounded-m3-md uppercase tracking-widest flex items-center gap-1.5 shrink-0">
          <Sparkles size={12} className="md:w-3.5 md:h-3.5" /> Q{idx + 1}
        </span>

        <div className="flex items-center border border-outline-variant rounded-m3-sm md:rounded-m3-md p-0.5 md:p-1 shrink-0 bg-surface-container-lowest">
          <button onClick={() => setShowOptions(!showOptions)} className="text-on-surface-variant hover:text-on-surface hover:bg-state-hover p-1 md:p-1.5 rounded-m3-sm transition-colors"><Eye size={14} className="md:w-4 md:h-4" /></button>
          <div className="w-px h-3.5 md:h-4 bg-outline-variant mx-0.5"></div>
          <button onClick={() => onRemove(q.id)} className="text-on-surface-variant hover:text-error hover:bg-error-container p-1 md:p-1.5 rounded-m3-sm transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="bg-surface-container text-on-surface-variant text-[9px] md:text-[10px] font-bold px-2.5 py-1.5 rounded-m3-sm md:rounded-m3-md uppercase tracking-widest flex items-center border border-outline-variant max-w-full min-w-0">
            <Layers size={10} className="shrink-0 mr-1.5 md:w-3 md:h-3" />
            <span className="truncate max-w-[200px] md:max-w-[300px]">{q.topicLabel}</span>
        </span>
      </div>

      <div className="font-semibold text-[14px] md:text-[15px] text-on-surface mb-4 md:mb-5 leading-snug md:leading-relaxed">
        <FormattedText text={getText(q.question)} />
      </div>

      {showOptions && (
        <div className="flex flex-col gap-2 mb-2">
          {Object.entries(q.options).map(([key, value]) => {
            const isCorrect = q.answer === key;
            return (
              <div key={key} className={`flex items-center p-3 md:p-3.5 rounded-m3-md md:rounded-m3-lg border transition-all ${isCorrect ? 'bg-success-container border-success' : 'bg-surface-container-lowest border-outline-variant hover:border-outline'}`}>
                <div className={`w-6 h-6 md:w-7 md:h-7 rounded-m3-xs md:rounded-m3-sm flex items-center justify-center text-[11px] md:text-[12px] font-black mr-3 md:mr-3.5 shrink-0 transition-colors ${isCorrect ? 'bg-success text-surface-container-lowest' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}>{key}</div>
                <div className={`text-[13px] md:text-[14px] font-medium pt-0.5 break-words overflow-hidden ${isCorrect ? 'text-on-success-container' : 'text-on-surface-variant'}`}>
                  <FormattedText text={getText(value)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {getText(q.explanation).trim().length > 0 && (
        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-outline-variant flex justify-start">
          <button onClick={() => setShowExplanation(!showExplanation)} className={`m3-interactive flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-m3-sm md:rounded-m3-md text-[11px] md:text-[12px] font-bold transition-all duration-300 ${showExplanation ? 'bg-primary-container text-on-primary-container shadow-elev-1' : 'bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface-variant hover:text-on-surface'}`}>
            <Sparkles size={12} className="md:w-3.5 md:h-3.5" />
            {showExplanation ? t.hideSolution : t.aiSolution}
          </button>
        </div>
      )}

      {showExplanation && getText(q.explanation).trim().length > 0 && (
        <div className="bg-surface-container border border-outline-variant p-3.5 md:p-4 rounded-m3-md md:rounded-m3-lg mt-3 md:mt-4 animate-in fade-in slide-in-from-top-2">
          <p className="text-[10px] md:text-[11px] font-black text-primary uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1.5"><Sparkles size={12} className="text-primary md:w-3.5 md:h-3.5" /> {t.aiSolutionLogic}</p>
          <p className="text-[12px] md:text-[13px] text-on-surface leading-relaxed font-medium">
            <FormattedText text={getText(q.explanation)} />
          </p>
        </div>
      )}
    </div>
  );
};


export default function GeneralAIGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { lang } = useTeacherLanguage();
  const t = AI_TRANSLATIONS[lang] || AI_TRANSLATIONS['uz'];

  // 🟢 NEW: Fetching the monthly limits instead of daily
  const aiData = useMonthlyLimit();

  const difficulties = [
    { id: "easy", label: t.difficulties.easy, color: "hover:border-success hover:bg-state-hover", active: "border-success bg-success-container text-on-success-container" },
    { id: "medium", label: t.difficulties.medium, color: "hover:border-primary hover:bg-state-hover", active: "border-primary bg-primary-container text-on-primary-container" },
    { id: "hard", label: t.difficulties.hard, color: "hover:border-warning hover:bg-state-hover", active: "border-warning bg-warning-container text-on-warning-container" },
    { id: "olympiad", label: t.difficulties.olympiad, color: "hover:border-tertiary hover:bg-state-hover", active: "border-tertiary bg-tertiary-container text-on-tertiary-container" }
  ];

  const [selectedSubject, setSelectedSubject] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<AIQuestion[]>([]);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [topicIntent, setTopicIntent] = useState<"bank" | "publish">("bank");
  const [topicPaths, setTopicPaths] = useState<TopicPath[]>([]);
  const [testTitle, setTestTitle] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitModalMessage, setLimitModalMessage] = useState(""); // 🟢 NEW
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isReadyToGenerate = selectedSubject && topicInput.trim().length > 2;

  useEffect(() => {
    if (generatedQuestions.length > 0 && !isGenerating) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generatedQuestions, isGenerating]);

  const handleGenerate = async () => {
    if (!isReadyToGenerate) return toast.error(t.toasts.errSelectSubjectTopic);

    // 🟢 NEW: Pre-check monthly limits
    if (!aiData.isUnlimited && aiData.remaining < count) {
      setLimitModalMessage(t.limitLeftDetailed(aiData.remaining));
      setIsLimitModalOpen(true);
      return;
    }

    setIsGenerating(true);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);

    try {
      const response = await fetch("/teacher/create/ai/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          subject: selectedSubject,
          topic: topicInput,
          difficulty,
          count,
          language: "uz"
        }),
      });

      const data = await response.json();

      // 🟢 NEW: Gatekeeper error handling
      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          setLimitModalMessage(t.limitReached);
          setIsLimitModalOpen(true);
          return;
        }
        throw new Error(data.error);
      }

      let diffVal = 2;
      if (difficulty === "easy") diffVal = 1;
      else if (difficulty === "medium") diffVal = 2;
      else if (difficulty === "hard") diffVal = 3;
      else if (difficulty === "olympiad") diffVal = 4;

      // The generator's subject/topic are free text — the bank taxonomy is chosen
      // by the teacher in TopicAssignModal at save time.
      const enrichedQuestions: AIQuestion[] = data.questions.map((q: any) => ({
        ...q,
        id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        topicLabel: topicInput,
        difficultyId: diffVal,
        uiDifficulty: difficulty
      }));

      setGeneratedQuestions(prev => [...prev, ...enrichedQuestions]);
      toast.success(t.toasts.added(count));
    } catch (error: any) {
      toast.error(error.message || t.toasts.errGeneric);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeQuestion = (idToDelete: string) => setGeneratedQuestions(prev => prev.filter(q => q.id !== idToDelete));

  // --- TOPIC GATE (runs before BOTH save paths) ---
  const openTopicModal = (intent: "bank" | "publish") => {
    if (generatedQuestions.length === 0) return toast.error(t.toasts.errCreateFirst);
    setIsSidebarOpen(false); // the mobile sidebar overlay would sit on top of the dialog
    setTopicIntent(intent);
    setIsTopicModalOpen(true);
  };

  const handleTopicConfirm = (paths: TopicPath[]) => {
    setTopicPaths(paths);
    if (topicIntent === "bank") {
      void handleSaveToBank(paths);
      return;
    }
    // publish: topic first, then title, then TestConfigurationModal.
    setIsTopicModalOpen(false);
    setIsTitleModalOpen(true);
  };

  /** Defensive: toQuestionV1 should never throw once the modal is wired. */
  const onInvalidTopic = (intent: "bank" | "publish") => {
    toast.error(t.toasts.errPickTopic);
    setTopicIntent(intent);
    setIsTopicModalOpen(true);
  };

  const handleSaveToBank = async (paths: TopicPath[]) => {
    if (generatedQuestions.length === 0) return toast.error(t.toasts.errCreateFirst);
    if (!user) return;

    setIsSavingToBank(true);
    const batch = writeBatch(db);

    try {
      generatedQuestions.forEach((q, i) => {
        const id = `tq_${doc(collection(db, "teacher_questions")).id}`;
        const v1 = toQuestionV1(
          {
            ...q,
            ...topicFields(paths[i]),
            difficulty: q.uiDifficulty?.toLowerCase() || "medium",
            difficultyId: q.difficultyId,
            tags: ["general_ai", "smart"],
            language: ["uz"],
            solutions: [],
          },
          {
            id,
            creatorId: user.uid,
            creatorName: user.displayName || "Teacher",
            creationMethod: "ai_generated",
            status: "published",
            aiModel: "gemini-2.5-flash",
            timestamp: serverTimestamp(),
          },
        );
        batch.set(doc(db, "teacher_questions", id), v1);
      });

      await batch.commit();
      setIsTopicModalOpen(false);
      toast.success(t.toasts.savedToBank);
      setGeneratedQuestions([]);
      router.push('/teacher/create/my_questions');
    } catch (error) {
      if (error instanceof InvalidTopicError) {
        onInvalidTopic("bank");
        return;
      }
      console.error("Save to bank error:", error);
      toast.error(t.toasts.errSaveBank);
    } finally {
      setIsSavingToBank(false);
    }
  };

  const handleTitleSubmit = () => {
    if (!testTitle.trim()) return toast.error(t.toasts.errEnterTitle);
    setIsTitleModalOpen(false);
    setIsConfigModalOpen(true);
  };

  const handleFinalPublish = async (testSettings: any) => {
    if (!user) return;
    if (topicPaths.length !== generatedQuestions.length) {
      setIsConfigModalOpen(false);
      return onInvalidTopic("publish");
    }
    setIsPublishing(true);
    const batch = writeBatch(db);
    const finalQuestionsToSave: ReturnType<typeof toQuestionV1>[] = [];

    try {
      generatedQuestions.forEach((q, i) => {
        const id = `tq_${doc(collection(db, "teacher_questions")).id}`;
        const source = {
          ...q,
          ...topicFields(topicPaths[i]),
          difficulty: q.uiDifficulty?.toLowerCase() || "medium",
          difficultyId: q.difficultyId,
          tags: ["general_ai", "smart"],
          language: ["uz"],
          solutions: [],
        };
        const meta = {
          id,
          creatorId: user.uid,
          creatorName: user.displayName || "Teacher",
          creationMethod: "ai_generated" as const,
          status: "published" as const,
          aiModel: "gemini-2.5-flash",
        };

        batch.set(doc(db, "teacher_questions", id), toQuestionV1(source, { ...meta, timestamp: serverTimestamp() }));
        // The embedded snapshot needs a CONCRETE time: Firestore rejects serverTimestamp() sentinels inside arrays.
        finalQuestionsToSave.push(toQuestionV1(source, { ...meta, timestamp: Timestamp.now() }));
      });

      batch.set(doc(collection(db, "custom_tests")), {
        teacherId: user.uid,
        title: testTitle,
        track: "general_ai",
        subjectName: sharedName(topicPaths, "subjectName"),
        topicName: sharedName(topicPaths, "topicName"),
        chapterName: "",
        subtopicName: sharedName(topicPaths, "subtopicName"),
        questions: finalQuestionsToSave,
        duration: testSettings.duration,
        shuffle: testSettings.shuffleQuestions,
        resultsVisibility: testSettings.resultsVisibility,
        accessCode: testSettings.accessCode,
        status: "active",
        createdAt: serverTimestamp(),
        questionCount: finalQuestionsToSave.length,
      });

      await batch.commit();
      toast.success(t.toasts.published);
      router.push("/teacher/dashboard");
    } catch (error) {
      if (error instanceof InvalidTopicError) {
        setIsConfigModalOpen(false);
        onInvalidTopic("publish");
        return;
      }
      toast.error(t.toasts.errPublish);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-surface overflow-hidden font-t-body selection:bg-primary-container selection:text-on-primary-container">

      <AiThinkingModal isVisible={isGenerating} />

      {/* 🟢 SUBJECT SELECTION MODAL */}
      {mounted && createPortal(
        <AnimatePresence>
          {isSubjectModalOpen && (
            <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsSubjectModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-3xl h-auto max-h-[90dvh] flex flex-col shadow-elev-3 overflow-hidden z-10">

                <div className="p-4 md:p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
                  <div>
                    <h3 className="text-[18px] md:text-xl font-black text-on-surface">{t.subjectModal.title}</h3>
                    <p className="text-on-surface-variant text-[11px] md:text-sm mt-0.5 md:mt-1">{t.subjectModal.desc}</p>
                  </div>
                  <button onClick={() => setIsSubjectModalOpen(false)} className="p-1.5 md:p-2 bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-state-hover rounded-full transition-colors"><X size={18} className="md:w-5 md:h-5"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
                  {UZB_SUBJECTS.map((s) => {
                    const isSelected = selectedSubject === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedSubject(s.id); setIsSubjectModalOpen(false); }}
                        className={`relative flex flex-col items-center justify-center p-3.5 md:p-5 rounded-m3-md md:rounded-m3-lg border transition-all duration-300 overflow-hidden group text-center ${isSelected ? `bg-surface-container-lowest ${s.border} shadow-elev-2` : 'bg-surface-container-lowest border-outline-variant hover:border-outline hover:bg-state-hover hover:shadow-elev-1 active:scale-95'}`}
                      >
                        <div className={`p-2.5 md:p-3 rounded-m3-md mb-2.5 md:mb-3 transition-colors ${isSelected ? s.bg : 'bg-surface-container group-hover:bg-surface-container-high'}`}>
                          <Icon size={24} className={`md:w-7 md:h-7 transition-colors ${isSelected ? s.color : 'text-on-surface-variant group-hover:text-on-surface'}`} strokeWidth={isSelected ? 2.5 : 2} />
                        </div>
                        <span className={`text-[12px] md:text-[14px] font-bold capitalize leading-tight ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                          {t.subjects[s.id] || s.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 🟢 NEW PREMIUM LIMIT MODAL */}
      <AnimatePresence>
        {isLimitModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsLimitModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-surface-container-low rounded-m3-xl p-6 md:p-8 w-full max-w-[320px] md:max-w-sm shadow-elev-3 z-10 flex flex-col items-center text-center">
              <button onClick={() => setIsLimitModalOpen(false)} className="absolute top-3 right-3 md:top-4 md:right-4 p-2 text-on-surface-variant hover:text-on-surface hover:bg-state-hover rounded-full transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>

              <div className="w-14 h-14 md:w-16 md:h-16 bg-primary-container rounded-m3-md md:rounded-m3-lg flex items-center justify-center mb-4 shadow-inner">
                <Crown size={28} className="text-warning" />
              </div>

              <h3 className="text-lg md:text-xl font-black text-on-surface mb-2">{t.premiumFeature}</h3>
              <p className="text-[13px] md:text-[14px] text-on-surface-variant mb-6 font-medium leading-relaxed">
                {limitModalMessage}
              </p>

              <div className="w-full flex flex-col gap-2">
                <Button variant="filled" className="w-full" onClick={() => router.push('/teacher/subscription')}>
                  {t.viewPlans} <ArrowLeft className="rotate-180" />
                </Button>
                <Button variant="outlined" className="w-full" onClick={() => setIsLimitModalOpen(false)}>
                  {t.goBack}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TITLE SAVE MODAL */}
      {mounted && createPortal(
        <AnimatePresence>
          {isTitleModalOpen && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsTitleModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-surface-container-low rounded-m3-xl p-5 md:p-8 w-full max-w-[320px] md:max-w-md shadow-elev-3 z-10">
                <h3 className="text-[18px] md:text-xl font-black text-on-surface mb-1.5 md:mb-2">{t.titleModal.title}</h3>
                <p className="text-[12px] md:text-[14px] text-on-surface-variant mb-5 md:mb-6 font-medium">{t.titleModal.desc}</p>
                <input type="text" value={testTitle} onChange={e => setTestTitle(e.target.value)} placeholder={t.titleModal.placeholder} className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-surface-container border border-outline-variant rounded-m3-md text-[13px] md:text-[14px] font-bold text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary transition-all mb-6 md:mb-8" autoFocus/>
                <div className="flex flex-col-reverse sm:flex-row gap-2 md:gap-3">
                  <Button variant="tonal" className="w-full" onClick={() => setIsTitleModalOpen(false)}>{t.titleModal.cancel}</Button>
                  <Button variant="filled" className="w-full" onClick={handleTitleSubmit}>
                    {t.titleModal.next} <ChevronRight strokeWidth={2.5}/>
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <TopicAssignModal
        open={isTopicModalOpen}
        questions={generatedQuestions.map(q => getPlainText(q.question))}
        isSaving={isSavingToBank}
        onClose={() => setIsTopicModalOpen(false)}
        onConfirm={handleTopicConfirm}
      />

      {mounted && createPortal(
        <TestConfigurationModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} onConfirm={handleFinalPublish} questionCount={generatedQuestions.length} testTitle={testTitle} isSaving={isPublishing} />,
        document.body
      )}

      {/* 🟢 TOP BAR (Mobile) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-[60px] bg-[color-mix(in_oklab,var(--m3-surface)_90%,transparent)] backdrop-blur-xl border-b border-outline-variant z-[90000] flex items-center justify-between px-3 shadow-elev-1">
        <button onClick={() => router.push('/teacher/create')} className="p-2 -ml-1 text-on-surface-variant rounded-m3-sm"><ArrowLeft size={18} /></button>
        <span className="font-black text-on-surface text-[14px]">{t.topBarTitle}</span>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-1 bg-primary-container text-on-primary-container rounded-m3-sm shadow-elev-1"><Menu size={18} /></button>
      </div>

      {mounted && (
        <>
          <AnimatePresence>
            {isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed top-[60px] left-0 right-0 bottom-0 bg-scrim backdrop-blur-sm z-[99998]" onClick={() => setIsSidebarOpen(false)} />}
          </AnimatePresence>

          <aside className={`fixed lg:relative top-[60px] lg:top-0 left-0 w-full sm:w-[400px] h-[calc(100dvh-60px)] lg:h-[100dvh] bg-surface-container-low border-r border-outline-variant shadow-elev-3 lg:shadow-none z-[99998] lg:z-10 transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
            <div className="flex justify-between items-center p-3 md:p-5 border-b border-outline-variant bg-surface-container-low shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => router.push('/teacher/create')} className="hidden lg:flex p-1.5 -ml-1.5 text-on-surface-variant hover:text-on-surface hover:bg-state-hover rounded-m3-sm transition-all"><ArrowLeft size={18} /></button>
                <h2 className="font-bold text-[14px] md:text-[16px] text-on-surface tracking-tight flex items-center gap-2"><Layers size={16} className="text-primary md:w-[18px] md:h-[18px]"/> {t.sidebarTitle}</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 bg-surface-container text-on-surface-variant hover:bg-state-hover hover:text-on-surface rounded-full border border-outline-variant transition-colors"><X size={16} strokeWidth={2.5}/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 md:p-5 pb-24 md:pb-32 flex flex-col space-y-4 md:space-y-7 relative bg-surface-container-low">

              <div className="space-y-2 md:space-y-3">
                <label className="text-[10px] md:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-1 block">{t.step1}</label>
                <button
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="w-full bg-surface-container hover:bg-state-hover border border-outline-variant hover:border-primary p-3 md:p-4 rounded-m3-md text-left transition-all group flex items-center justify-between shadow-elev-1"
                >
                  {selectedSubject ? (
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-m3-sm md:rounded-m3-md flex items-center justify-center ${UZB_SUBJECTS.find(s => s.id === selectedSubject)?.bg || "bg-surface-container-high"}`}>
                        {(() => {
                          const subj = UZB_SUBJECTS.find(s => s.id === selectedSubject);
                          const Icon = subj ? subj.icon : BookOpen;
                          return <Icon size={16} className={`md:w-5 md:h-5 ${subj?.color || "text-on-surface"}`} />;
                        })()}
                      </div>
                      <div>
                        <div className="text-[9px] md:text-[11px] font-black text-primary uppercase tracking-widest mb-0.5">{t.selectedSubject}</div>
                        <div className="text-[12px] md:text-[14px] font-bold text-on-surface capitalize leading-snug">{t.subjects[selectedSubject] || selectedSubject}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[12px] md:text-[14px] font-bold text-on-surface-variant pl-1 md:pl-2">{t.selectSubjectPlaceholder}</span>
                  )}
                  <ChevronRight size={16} className="text-on-surface-variant group-hover:text-primary transition-colors md:w-[18px] md:h-[18px]" />
                </button>
              </div>

              <div className={`space-y-2 md:space-y-3 ${!selectedSubject ? 'opacity-40 pointer-events-none grayscale transition-all' : 'transition-all'}`}>
                <label className="text-[10px] md:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-1 block">
                  {t.step2}
                </label>
                <div className="relative">
                  <textarea
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder={t.topicPlaceholder}
                    className="w-full bg-surface-container border border-outline-variant hover:border-primary focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_12%,transparent)] p-3 md:p-4 rounded-m3-md text-[13px] md:text-[14px] font-medium text-on-surface outline-none transition-all shadow-elev-1 min-h-[80px] md:min-h-[100px] resize-none custom-scrollbar"
                  />
                </div>
              </div>

              <div className={`space-y-2 md:space-y-3 ${!isReadyToGenerate ? 'opacity-40 pointer-events-none grayscale transition-all' : 'transition-all'}`}>
                <label className="text-[10px] md:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-1 block">{t.step3}</label>
                <div className="grid grid-cols-2 gap-1.5 md:gap-2 p-1 md:p-1.5 bg-surface-container rounded-m3-sm md:rounded-m3-md border border-outline-variant shadow-inner">
                  {difficulties.map(diff => {
                    const isSelected = difficulty === diff.id;
                    return (
                      <button
                        key={diff.id} onClick={() => setDifficulty(diff.id)}
                        className={`py-1.5 md:py-2.5 px-1 md:px-2 rounded-m3-xs md:rounded-m3-sm text-[10px] md:text-[13px] font-bold transition-all text-center ${isSelected ? diff.active : `bg-surface-container-lowest border border-outline-variant text-on-surface-variant ${diff.color}`}`}
                      >
                        {diff.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={`space-y-2 md:space-y-3 ${!isReadyToGenerate ? 'opacity-40 pointer-events-none grayscale transition-all' : 'transition-all'}`}>
                <label className="text-[10px] md:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-1 block">{t.step4}</label>
                <div className="flex items-center bg-surface-container p-1 rounded-m3-sm md:rounded-m3-md border border-outline-variant shadow-inner h-[36px] md:h-[46px]">
                  <button onClick={() => setCount(prev => Math.max(1, prev - 1))} className="w-8 md:w-10 h-full flex items-center justify-center rounded-m3-xs md:rounded-m3-sm text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface hover:shadow-elev-1 transition-all disabled:text-disabled-fg" disabled={count <= 1}>
                    <Minus size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
                  </button>
                  <div className="flex-1 text-center flex items-center justify-center flex-col">
                    <span className="text-[12px] md:text-[15px] font-black text-on-surface leading-none">{count}</span>
                  </div>
                  {/* 🟢 NEW: Disable Plus button if count exceeds monthly limit */}
                  <button
                    onClick={() => setCount(prev => Math.min(15, aiData?.isUnlimited ? 15 : (aiData?.remaining ?? 15), prev + 1))}
                    className="w-8 md:w-10 h-full flex items-center justify-center rounded-m3-xs md:rounded-m3-sm text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface hover:shadow-elev-1 transition-all disabled:text-disabled-fg"
                    disabled={count >= 15 || (!aiData?.isUnlimited && count >= (aiData?.remaining ?? 15))}
                  >
                    <Plus size={14} className="md:w-4 md:h-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* 🟢 NEW: Show warning if running low on monthly limits */}
              {aiData && !aiData.isUnlimited && aiData.remaining < 15 && (
                <div className="bg-warning-container rounded-m3-sm md:rounded-m3-md p-2 md:p-3 flex gap-2 md:gap-3 items-start">
                  <Zap size={14} className="text-on-warning-container shrink-0 mt-0.5 md:w-4 md:h-4" />
                  <p className="text-[9px] md:text-[11px] font-bold text-on-warning-container leading-snug">
                    {t.lowLimitWarning(aiData.remaining)}
                  </p>
                </div>
              )}

            </div>

            {/* 🟢 STICKY BOTTOM GENERATE BUTTON */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 bg-gradient-to-t from-surface-container-low via-surface-container-low to-transparent pt-8 md:pt-10 z-20">
              <Button
                variant="filled"
                size="lg"
                className="w-full"
                icon={<Wand2 strokeWidth={2.5}/>}
                loading={isGenerating}
                onClick={() => {
                  // 🟢 NEW: Pre-check monthly limits
                  if (!aiData.isUnlimited && aiData.remaining < count) {
                    setLimitModalMessage(t.limitLeftGenerate(aiData.remaining));
                    setIsLimitModalOpen(true);
                    return;
                  }
                  handleGenerate();
                }}
                disabled={isGenerating || !isReadyToGenerate}
              >
                {isGenerating ? t.generating : t.generateBtn}
              </Button>
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 overflow-y-auto custom-scrollbar relative w-full pt-[60px] lg:pt-0 pb-24 lg:pb-0">

        <div className="hidden lg:flex sticky top-0 z-20 bg-[color-mix(in_oklab,var(--m3-surface)_85%,transparent)] backdrop-blur-md border-b border-outline-variant px-8 py-3 justify-between items-center shadow-elev-1">
          <div className="flex items-center gap-4">
            <h1 className="text-[16px] font-bold text-on-surface tracking-tight">{t.draftTitle}</h1>
            {generatedQuestions.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container rounded-full animate-in fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                <span className="text-[11px] font-bold text-on-primary-container tracking-wide uppercase">{t.questionCountBadge(generatedQuestions.length)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 🟢 NEW: AiMonthlyLimitCard Replaces the old card */}
            <AiMonthlyLimitCard aiData={aiData} />

            <Button
              variant="tonal"
              size="sm"
              icon={<Database />}
              loading={isSavingToBank}
              onClick={() => openTopicModal("bank")}
              disabled={isPublishing || isSavingToBank || isGenerating || generatedQuestions.length === 0}
            >
              {t.saveToBank}
            </Button>

            <Button
              variant="filled"
              size="sm"
              icon={<CheckCircle2 />}
              onClick={() => openTopicModal("publish")}
              disabled={isPublishing || isSavingToBank || isGenerating || generatedQuestions.length === 0}
            >
              {t.publish}
            </Button>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto p-3 md:p-8 space-y-4 md:space-y-6">
          {generatedQuestions.length === 0 && !isGenerating ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-[60vh] flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-m3-lg bg-surface-container-low lg:mt-6 p-4 md:p-6 text-center shadow-elev-1 mx-1 lg:mx-0">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-primary-container rounded-m3-md flex items-center justify-center mb-3 md:mb-4"><Sparkles size={24} className="text-on-primary-container md:w-6 md:h-6" /></div>
              <p className="font-bold text-on-surface text-[14px] md:text-[16px]">{t.emptyTitle}</p>
              <p className="text-[11px] md:text-[14px] text-on-surface-variant mt-1 max-w-[300px]">{t.emptyDesc}</p>
            </motion.div>
          ) : (
            <div className="space-y-4 md:space-y-6 lg:pb-12">
              <div className="lg:hidden flex items-center justify-between mb-1 px-1">
                <span className="text-[10px] md:text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">{t.mobileCount(generatedQuestions.length)}</span>
                {/* 🟢 NEW: Mobile Monthly Limit Card */}
                <AiMonthlyLimitCard aiData={aiData} />
              </div>

              {generatedQuestions.map((q, idx) => (
                <AIQuestionCard key={q.id} q={q} idx={idx} onRemove={removeQuestion} />
              ))}

              {isGenerating && (
                <div className="bg-surface-container-low p-4 md:p-5 rounded-m3-lg border border-outline-variant shadow-elev-1 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--m3-primary)_8%,transparent)] to-transparent w-[200%] animate-[shimmer_2s_infinite]" />
                  <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6"><Skeleton className="w-16 h-5 md:w-20 md:h-6 rounded-full" /><Skeleton className="w-24 h-5 md:w-32 md:h-6 rounded-full" /></div>
                  <Skeleton className="w-3/4 h-4 md:h-5 rounded-m3-sm mb-4 md:mb-6" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">{[1, 2, 3, 4].map(i => <Skeleton className="w-full h-10 md:h-12 rounded-m3-md" key={i} />)}</div>
                </div>
              )}

              {!isGenerating && generatedQuestions.length > 0 && (
                <div className="py-8 md:py-10 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
                  <div className="w-10 h-10 bg-surface-container-high text-on-surface-variant rounded-full flex items-center justify-center mb-2.5 md:mb-3"><Layers size={16} className="md:w-[18px] md:h-[18px]" /></div>
                  <p className="text-[13px] md:text-[14px] font-bold text-on-surface">{t.morePrompt}</p>
                  <p className="text-[11px] md:text-[13px] text-on-surface-variant mt-1 max-w-[280px] mb-4 md:mb-5">{t.morePromptDesc}</p>
                </div>
              )}

              <div ref={bottomRef} className="h-8" />
            </div>
          )}
        </div>
      </main>

      {/* 🟢 MOBILE FLOATING ACTIONS */}
      {mounted && !isSidebarOpen && generatedQuestions.length > 0 && createPortal(
        <div className="lg:hidden fixed bottom-6 left-0 right-0 px-4 flex items-center gap-3 z-[100] animate-in slide-in-from-bottom-10">

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-[52px] h-[52px] bg-inverse-surface text-inverse-on-surface rounded-full shadow-elev-2 flex items-center justify-center active:scale-95 transition-transform shrink-0 relative overflow-hidden"
          >
             <span className="text-[18px] font-black tracking-widest relative z-10">N</span>
             <div className="absolute inset-0 bg-gradient-to-tr from-[color-mix(in_oklab,var(--m3-primary)_25%,transparent)] to-transparent opacity-50"></div>
          </button>

          <div className="flex-1 flex gap-2">
            <Button
              variant="tonal"
              icon={<Database />}
              loading={isSavingToBank}
              onClick={() => openTopicModal("bank")}
              disabled={isSavingToBank || isPublishing || isGenerating}
              className="flex-1 h-[52px] rounded-m3-lg"
            >
              {t.mobileSave}
            </Button>

            <Button
              variant="filled"
              icon={<CheckCircle2 />}
              loading={isPublishing}
              onClick={() => openTopicModal("publish")}
              disabled={isPublishing || isSavingToBank || isGenerating}
              className="flex-1 h-[52px] rounded-m3-lg shadow-elev-2"
            >
              {t.mobilePublish}
            </Button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}