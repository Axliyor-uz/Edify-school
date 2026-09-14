"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Sparkles, Wand2,
  BookOpen, Plus, Minus, AlignLeft, Type,
  GripVertical, Check, Zap, X, ChevronDown, ChevronRight,
  Trash2, Building2, GraduationCap, CheckSquare, Bot,
  FileText, Crown
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, collection, writeBatch, serverTimestamp } from "firebase/firestore";
import katex from 'katex';
import 'katex/dist/katex.min.css';

// 🟢 NEW MONTHLY LIMIT IMPORTS
import { useMonthlyLimit } from "@/hooks/useMonthlyLimit";
import AiMonthlyLimitCard from "@/app/teacher/create/_components/AiMonthlyLimitCard"; 

import maktabMap from "@/data/maktab/structure.json";
import ixtisosMap from "@/data/ixtisoslashtirilgan_maktab/structure.json";
import { useTeacherLanguage } from "@/app/teacher/layout";

// --- TRANSLATION DICTIONARY ---
const BSB_TRANSLATIONS: Record<string, any> = {
  uz: {
    thinkingTitle: "AI Studiya ishlamoqda",
    thinkingPhrases: [
      "Matritsa tahlil qilinmoqda...",
      "Mavzularga oid ma'lumotlar o'qilmoqda...",
      "Qiyinlik darajasi moslashtirilmoqda...",
      "Savollar va javoblar yozilmoqda...",
      "Formula va chizmalar tekshirilmoqda...",
      "Yakuniy imtihon qog'ozi yig'ilmoqda..."
    ],
    deleteQuestion: "Savolni o'chirish", pointsUnit: "Ball", answerLabel: "Javob:",
    trueLabel: "Rost", falseLabel: "Yolg'on",
    sampleSolution: "Namuna Yechim", rubricLabel: "Baholash Mezoni",
    qTypes: { mcq: "Test (MCQ)", short_answer: "Qisqa javob", open_ended: "Ochiq (Tahlil)", matching: "Moslashtirish", true_false: "Rost / Yolg'on" },
    diffLabels: { "Aralash": "Aralash", "Oson": "Oson", "O'rta": "O'rta", "Qiyin": "Qiyin" },
    toasts: {
      syllabusNotFound: "Syllabus topilmadi!",
      selectClassSubject: "Sinf va fanni tanlang.",
      selectTopic: "Kamida bitta mavzuni tanlang.",
      enableQuestionType: "Kamida bitta savol turini faollashtiring.",
      created: (n: number) => `${n} ta savol yaratildi!`,
      readError: "Savollarni o'qishda xatolik.",
      enterTitle: "Test nomini kiriting",
      saved: "Imtihon muvaffaqiyatli saqlandi!",
      saveError: "Saqlashda xatolik yuz berdi."
    },
    limitNeeded: (needed: number, remaining: number) => `Ushbu imtihon uchun ${needed} ta savol kerak, lekin sizda ${remaining} ta limit qolgan. Matritsani qisqartiring yoki tarifni oshiring.`,
    limitReached: "Oylik AI limitingiz yetarli emas. Tarifingizni oshiring yoki keyingi oyni kuting.",
    headerTitle: "BSB/CHSB Generatori", headerSave: "Saqlash", studioMode: "Studiya Rejimi",
    schoolGeneral: "Umumta'lim", schoolSpecialized: "Ixtisos",
    step1: "1. Sinf va Fan", notSelected: "Tanlanmagan",
    step2: "2. Mavzular", selectedCount: (n: number) => `${n} ta tanlandi`,
    step3: "3. Matritsa", matrixDesc: "Savollar va ballarni sozlang",
    totalQuestions: "Jami Savol", totalPoints: "Jami Ball", generateBtn: "Imtihonni Yaratish",
    paperTitle: "Imtihon Qog'ozi", paperDesc: "Savollarni tekshiring. Noto'g'ri savollarni o'chirishingiz mumkin.",
    confirmedPoints: (n: number) => `Tasdiqlangan: ${n} Ball`,
    premiumFeature: "Premium Xususiyat", viewPlans: "Tariflarni ko'rish", close: "Yopish",
    classSubjectModal: { title: "Sinf va Fan", selectClass: "1. Sinfni tanlang", selectSubject: "2. Fanni tanlang", confirm: "Tasdiqlash" },
    topicsModal: { title: "Qamrov (Mavzular)", empty: "Dastur yuklanmadi. Fan tanlang.", confirm: "Tanlovni Tasdiqlash" },
    titleModal: { title: "Hujjat nomi", desc: "O'quvchilarga ko'rinadigan rasmiy nomni yozing.", placeholder: "Masalan: 7-sinf Biologiya CHSB", cancel: "Bekor qilish", saving: "Saqlanmoqda...", save: "Saqlash" }
  },
  en: {
    thinkingTitle: "AI Studio is working",
    thinkingPhrases: [
      "Analyzing the matrix...",
      "Reading topic materials...",
      "Adjusting the difficulty level...",
      "Writing questions and answers...",
      "Checking formulas and diagrams...",
      "Assembling the final exam paper..."
    ],
    deleteQuestion: "Delete question", pointsUnit: "Pts", answerLabel: "Answer:",
    trueLabel: "True", falseLabel: "False",
    sampleSolution: "Sample Solution", rubricLabel: "Grading Rubric",
    qTypes: { mcq: "Test (MCQ)", short_answer: "Short answer", open_ended: "Open (Analysis)", matching: "Matching", true_false: "True / False" },
    diffLabels: { "Aralash": "Mixed", "Oson": "Easy", "O'rta": "Medium", "Qiyin": "Hard" },
    toasts: {
      syllabusNotFound: "Syllabus not found!",
      selectClassSubject: "Select a grade and subject.",
      selectTopic: "Select at least one topic.",
      enableQuestionType: "Enable at least one question type.",
      created: (n: number) => `${n} questions created!`,
      readError: "Error reading the questions.",
      enterTitle: "Enter a test title",
      saved: "Exam saved successfully!",
      saveError: "An error occurred while saving."
    },
    limitNeeded: (needed: number, remaining: number) => `This exam needs ${needed} questions, but you only have ${remaining} left in your limit. Reduce the matrix or upgrade your plan.`,
    limitReached: "Your monthly AI limit is not enough. Upgrade your plan or wait for next month.",
    headerTitle: "BSB/CHSB Generator", headerSave: "Save", studioMode: "Studio Mode",
    schoolGeneral: "General", schoolSpecialized: "Specialized",
    step1: "1. Grade & Subject", notSelected: "Not selected",
    step2: "2. Topics", selectedCount: (n: number) => `${n} selected`,
    step3: "3. Matrix", matrixDesc: "Configure questions and points",
    totalQuestions: "Total Questions", totalPoints: "Total Points", generateBtn: "Generate Exam",
    paperTitle: "Exam Paper", paperDesc: "Review the questions. You can delete incorrect ones.",
    confirmedPoints: (n: number) => `Confirmed: ${n} Pts`,
    premiumFeature: "Premium Feature", viewPlans: "View plans", close: "Close",
    classSubjectModal: { title: "Grade & Subject", selectClass: "1. Select a grade", selectSubject: "2. Select a subject", confirm: "Confirm" },
    topicsModal: { title: "Coverage (Topics)", empty: "Syllabus not loaded. Select a subject.", confirm: "Confirm Selection" },
    titleModal: { title: "Document title", desc: "Write the official name visible to students.", placeholder: "E.g.: Grade 7 Biology CHSB", cancel: "Cancel", saving: "Saving...", save: "Save" }
  },
  ru: {
    thinkingTitle: "AI Студия работает",
    thinkingPhrases: [
      "Анализ матрицы...",
      "Чтение материалов по темам...",
      "Настройка уровня сложности...",
      "Составление вопросов и ответов...",
      "Проверка формул и схем...",
      "Сборка итоговой экзаменационной работы..."
    ],
    deleteQuestion: "Удалить вопрос", pointsUnit: "Балл", answerLabel: "Ответ:",
    trueLabel: "Верно", falseLabel: "Неверно",
    sampleSolution: "Пример решения", rubricLabel: "Критерии оценивания",
    qTypes: { mcq: "Тест (MCQ)", short_answer: "Краткий ответ", open_ended: "Открытый (Анализ)", matching: "Сопоставление", true_false: "Верно / Неверно" },
    diffLabels: { "Aralash": "Смешанный", "Oson": "Лёгкий", "O'rta": "Средний", "Qiyin": "Сложный" },
    toasts: {
      syllabusNotFound: "Учебная программа не найдена!",
      selectClassSubject: "Выберите класс и предмет.",
      selectTopic: "Выберите хотя бы одну тему.",
      enableQuestionType: "Включите хотя бы один тип вопросов.",
      created: (n: number) => `Создано вопросов: ${n}!`,
      readError: "Ошибка при чтении вопросов.",
      enterTitle: "Введите название теста",
      saved: "Экзамен успешно сохранён!",
      saveError: "Произошла ошибка при сохранении."
    },
    limitNeeded: (needed: number, remaining: number) => `Для этого экзамена нужно ${needed} вопросов, но в вашем лимите осталось ${remaining}. Сократите матрицу или повысьте тариф.`,
    limitReached: "Вашего месячного AI-лимита недостаточно. Повысьте тариф или дождитесь следующего месяца.",
    headerTitle: "Генератор BSB/CHSB", headerSave: "Сохранить", studioMode: "Режим Студии",
    schoolGeneral: "Общеобразовательная", schoolSpecialized: "Специализированная",
    step1: "1. Класс и Предмет", notSelected: "Не выбрано",
    step2: "2. Темы", selectedCount: (n: number) => `Выбрано: ${n}`,
    step3: "3. Матрица", matrixDesc: "Настройте вопросы и баллы",
    totalQuestions: "Всего вопросов", totalPoints: "Всего баллов", generateBtn: "Создать экзамен",
    paperTitle: "Экзаменационная работа", paperDesc: "Проверьте вопросы. Неверные вопросы можно удалить.",
    confirmedPoints: (n: number) => `Подтверждено: ${n} Балл.`,
    premiumFeature: "Премиум-функция", viewPlans: "Посмотреть тарифы", close: "Закрыть",
    classSubjectModal: { title: "Класс и Предмет", selectClass: "1. Выберите класс", selectSubject: "2. Выберите предмет", confirm: "Подтвердить" },
    topicsModal: { title: "Охват (Темы)", empty: "Программа не загружена. Выберите предмет.", confirm: "Подтвердить выбор" },
    titleModal: { title: "Название документа", desc: "Напишите официальное название, видимое ученикам.", placeholder: "Например: 7 класс Биология CHSB", cancel: "Отмена", saving: "Сохранение...", save: "Сохранить" }
  }
};

type SchoolType = "maktab" | "ixtisos";
type AssessmentType = "BSB" | "CHSB";
type Difficulty = "Aralash" | "Oson" | "O'rta" | "Qiyin";

interface QuestionConfig {
  id: "mcq" | "short_answer" | "open_ended" | "matching" | "true_false";
  icon: any;
  label: string;
  enabled: boolean;
  count: number;
  points: number;
}

const AiThinkingModal = ({ isVisible }: { isVisible: boolean }) => {
  const { lang } = useTeacherLanguage();
  const t = BSB_TRANSLATIONS[lang] || BSB_TRANSLATIONS['uz'];
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const phrases: string[] = t.thinkingPhrases;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => setPhraseIndex((prev) => (prev + 1) % phrases.length), 2500); 
    return () => clearInterval(interval);
  }, [isVisible, phrases.length]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative w-full max-w-sm bg-surface-container-low rounded-m3-xl shadow-elev-3 p-8 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)] rounded-full blur-[60px] animate-pulse"></div>
            <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-[color-mix(in_oklab,var(--m3-tertiary)_20%,transparent)] rounded-full blur-[60px] animate-pulse" style={{ animationDelay: "1s" }}></div>
            <div className="relative mb-6 mt-2">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-tr from-primary to-tertiary rounded-full blur-xl opacity-40" />
              <div className="relative w-20 h-20 bg-surface-container-lowest rounded-m3-lg flex items-center justify-center shadow-elev-3">
                <Bot size={36} className="text-primary animate-bounce" style={{ animationDuration: "2s" }} />
                <Sparkles size={16} className="absolute -top-2 -right-2 text-warning animate-pulse" />
              </div>
            </div>
            <h3 className="text-[18px] font-black text-on-surface mb-2 relative z-10 tracking-tight text-center">{t.thinkingTitle}</h3>
            <div className="h-5 relative z-10 overflow-hidden flex items-center justify-center w-full">
              <motion.p key={phraseIndex} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4 }} className="text-[13px] font-bold text-on-surface-variant absolute text-center w-full">{phrases[phraseIndex]}</motion.p>
            </div>
            <div className="w-[70%] h-1.5 bg-surface-container-high rounded-full mt-6 overflow-hidden relative z-10">
              <motion.div className="h-full bg-gradient-to-r from-primary via-tertiary to-primary rounded-full w-[200%]" animate={{ x: ["-50%", "0%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
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
    <span className="break-words leading-relaxed text-on-surface">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="block my-3 text-center overflow-x-auto custom-scrollbar" />;
          } catch (e) { return <span key={index} className="text-error font-mono text-[13px] bg-error-container px-1 rounded-m3-xs">{part}</span>; }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false, strict: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="px-0.5 inline-block align-middle" />;
          } catch (e) { return <span key={index} className="text-error font-mono text-[13px] bg-error-container px-1 rounded-m3-xs">{part}</span>; }
        }
        return <span key={index}>{part.split('\n').map((line, i, arr) => (<span key={i}>{line}{i < arr.length - 1 && <br />}</span>))}</span>;
      })}
    </span>
  );
};

const ExamQuestionCard = ({ q, idx, onRemove }: { q: any, idx: number, onRemove: (id: string) => void }) => {
  const { lang } = useTeacherLanguage();
  const t = BSB_TRANSLATIONS[lang] || BSB_TRANSLATIONS['uz'];
  const getText = (field: any) => field?.uz || field || "";

  return (
    <div className="bg-surface-container-low p-5 md:p-8 rounded-m3-lg shadow-elev-1 relative group mb-5 hover:shadow-elev-2 transition-shadow">
      <div className="absolute top-4 right-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onRemove(q.id)} className="m3-interactive p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-m3-md transition-colors" title={t.deleteQuestion}>
          <Trash2 size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 pr-8">
        <span className="bg-secondary text-on-secondary text-[11px] font-black px-2.5 py-1 rounded-m3-xs shrink-0">{idx + 1}</span>
        <span className="text-[10px] font-black text-on-surface-variant px-2 py-1 rounded-m3-xs uppercase tracking-widest bg-surface-container-high truncate">
          {q.type.replace('_', ' ')} • {q.points} {t.pointsUnit}
        </span>
      </div>

      <div className="text-[14px] md:text-[15px] font-bold text-on-surface mb-5 leading-snug">
        <FormattedText text={getText(q.question)} />
      </div>

      <div className="pl-3 border-l-2 border-primary-container">
        {q.type === "mcq" && q.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(q.options).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, value]) => {
              const isCorrect = q.answer === key;
              return (
                <div key={key} className={`flex items-start p-2.5 rounded-m3-md border ${isCorrect ? 'bg-success-container border-transparent shadow-elev-1' : 'bg-surface-container-lowest border-outline-variant'}`}>
                  <div className={`w-6 h-6 rounded-m3-xs flex items-center justify-center text-[12px] font-bold mr-3 shrink-0 ${isCorrect ? 'bg-success text-surface-container-lowest' : 'bg-surface-container-high text-on-surface-variant'}`}>{key}</div>
                  <div className={`text-[13px] pt-0.5 leading-snug ${isCorrect ? 'text-on-success-container font-bold' : 'text-on-surface font-medium'}`}><FormattedText text={getText(value)} /></div>
                </div>
              );
            })}
          </div>
        )}

        {q.type === "short_answer" && (
          <div className="bg-surface-container p-3.5 rounded-m3-md border border-outline-variant flex items-center gap-3">
            <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest">{t.answerLabel}</span>
            <span className="text-[14px] font-bold text-primary"><FormattedText text={getText(q.answer)} /></span>
          </div>
        )}

        {q.type === "true_false" && (
          <div className="flex gap-2.5">
            <div className={`flex-1 md:flex-none px-5 py-2.5 rounded-m3-md text-[13px] text-center font-bold border ${q.answer === true ? 'bg-success-container border-transparent text-on-success-container shadow-elev-1' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant'}`}>{t.trueLabel}</div>
            <div className={`flex-1 md:flex-none px-5 py-2.5 rounded-m3-md text-[13px] text-center font-bold border ${q.answer === false ? 'bg-error-container border-transparent text-on-error-container shadow-elev-1' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant'}`}>{t.falseLabel}</div>
          </div>
        )}

        {q.type === "matching" && q.pairs && (
          <div className="grid gap-2">
            {q.pairs.map((pair: any, i: number) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                <div className="flex-1 bg-surface-container-lowest p-3 rounded-m3-md border border-outline-variant text-[13px] font-medium text-on-surface shadow-elev-1 leading-snug"><FormattedText text={getText(pair.left)} /></div>
                <div className="hidden sm:block text-outline font-black">➔</div>
                <div className="flex-1 bg-surface-container p-3 rounded-m3-md border border-outline-variant text-[13px] font-bold text-on-surface shadow-elev-1 leading-snug"><FormattedText text={getText(pair.right)} /></div>
              </div>
            ))}
          </div>
        )}

        {q.type === "open_ended" && (
          <div className="space-y-3">
            <div className="bg-surface-container p-4 rounded-m3-md border border-outline-variant">
              <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 block">{t.sampleSolution}</span>
              <p className="text-[13px] font-medium text-on-surface leading-relaxed"><FormattedText text={getText(q.answer)} /></p>
            </div>
            {q.rubric && (
              <div className="bg-tertiary-container p-4 rounded-m3-md">
                <span className="text-[11px] font-black text-on-tertiary-container uppercase tracking-widest mb-1.5 block">{t.rubricLabel}</span>
                <p className="text-[13px] font-bold text-on-tertiary-container leading-relaxed"><FormattedText text={getText(q.rubric)} /></p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export default function BsbChsbGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = BSB_TRANSLATIONS[lang] || BSB_TRANSLATIONS['uz'];
  const aiData = useMonthlyLimit(); // 🟢 NEW LIMIT HOOK
  const bottomRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [schoolType, setSchoolType] = useState<SchoolType>("maktab");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("BSB");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  
  const [syllabusData, setSyllabusData] = useState<any>(null);
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]); 
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

  const [difficulty, setDifficulty] = useState<Difficulty>("Aralash");
  const [distribution, setDistribution] = useState<QuestionConfig[]>([
    { id: "mcq", icon: CheckSquare, label: "Test (MCQ)", enabled: true, count: 5, points: 2 },
    { id: "short_answer", icon: Type, label: "Qisqa javob", enabled: true, count: 2, points: 3 },
    { id: "open_ended", icon: AlignLeft, label: "Ochiq (Tahlil)", enabled: true, count: 1, points: 5 },
    { id: "matching", icon: GripVertical, label: "Moslashtirish", enabled: false, count: 1, points: 4 },
    { id: "true_false", icon: Check, label: "Rost / Yolg'on", enabled: false, count: 2, points: 1 },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  
  const [isClassSubjectModalOpen, setIsClassSubjectModalOpen] = useState(false);
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitModalMessage, setLimitModalMessage] = useState(""); // 🟢 NEW MODAL STATE
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  
  const [testTitle, setTestTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const currentStructureMap = schoolType === "maktab" ? maktabMap : ixtisosMap;
  const availableClasses = Object.keys(currentStructureMap).sort((a, b) => parseInt(a) - parseInt(b));
  // @ts-ignore
  const availableSubjects = selectedClass ? (currentStructureMap[selectedClass] || []) : [];
  
  const totalQuestions = distribution.filter(d => d.enabled).reduce((acc, curr) => acc + curr.count, 0);
  const totalPoints = distribution.filter(d => d.enabled).reduce((acc, curr) => acc + (curr.count * curr.points), 0);

  useEffect(() => {
    setSelectedClass(""); setSelectedSubject(""); setSyllabusData(null); setSelectedScopes([]);
  }, [schoolType]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      setIsLoadingSyllabus(true);
      setSelectedScopes([]); setExpandedChapters([]);
      const track = schoolType === "maktab" ? "maktab" : "ixtisoslashtirilgan_maktab";
      
      fetch(`/api/syllabus?track=${track}&class=${selectedClass}&subject=${selectedSubject}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data[0]) {
            setSyllabusData(data[0]);
            if(data[0].chapters?.length > 0) setExpandedChapters([data[0].chapters[0].chapter]);
          }
        })
        .catch(() => toast.error(t.toasts.syllabusNotFound))
        .finally(() => setIsLoadingSyllabus(false));
    }
  }, [selectedClass, selectedSubject, schoolType]);

  useEffect(() => {
    if (generatedQuestions.length > 0 && !isGenerating) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [generatedQuestions, isGenerating]);

  const toggleChapterExpand = (chapterName: string) => setExpandedChapters(prev => prev.includes(chapterName) ? prev.filter(c => c !== chapterName) : [...prev, chapterName]);
  const toggleSubtopic = (subtopicName: string) => setSelectedScopes(prev => prev.includes(subtopicName) ? prev.filter(s => s !== subtopicName) : [...prev, subtopicName]);
  const handleChapterCheckbox = (chapter: any) => {
    const subNames = chapter.subtopics.map((s: any) => s.name);
    const allSelected = subNames.every((name: string) => selectedScopes.includes(name));
    if (allSelected) setSelectedScopes(prev => prev.filter(s => !subNames.includes(s)));
    else setSelectedScopes(prev => Array.from(new Set([...prev, ...subNames])));
  };

  const updateDistribution = (id: string, field: "enabled" | "count" | "points", value: boolean | number) => {
    setDistribution(prev => prev.map(item => {
      if (item.id === id) {
        let finalVal = value;
        if (field === "count" && typeof value === "number") finalVal = Math.max(1, Math.min(20, value));
        if (field === "points" && typeof value === "number") finalVal = Math.max(1, Math.min(20, value));
        return { ...item, [field]: finalVal };
      }
      return item;
    }));
  };

  const handleGenerate = async () => {
    if (!selectedClass || !selectedSubject) return toast.error(t.toasts.selectClassSubject);
    if (selectedScopes.length === 0) return toast.error(t.toasts.selectTopic);
    if (totalQuestions === 0) return toast.error(t.toasts.enableQuestionType);

    // 🟢 PRE-CHECK LIMITS
    if (!aiData.isUnlimited && aiData.remaining < totalQuestions) {
      setLimitModalMessage(t.limitNeeded(totalQuestions, aiData.remaining));
      setIsLimitModalOpen(true);
      return;
    }

    setIsGenerating(true);

    let response;
    let data;
    let retries = 3;

    while (retries > 0) {
      try {
        let selectedContexts: string[] = [];
        syllabusData?.chapters?.forEach((ch: any) => {
          ch.subtopics.forEach((sub: any) => {
            if (selectedScopes.includes(sub.name)) selectedContexts.push(`${ch.chapter}: ${sub.name}`);
          });
        });

        const payload = {
          userId: user?.uid, schoolType, assessmentType, topic: selectedClass, subject: selectedSubject,
          scopes: selectedContexts, difficulty, distribution: distribution.filter(d => d.enabled), language: "uz"
        };

        response = await fetch("/teacher/create/bsb-chsb/api", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });

        data = await response.json();
        
        // 🟢 GATEKEEPER ERROR HANDLING
        if (!response.ok) {
          if (data.code === 'LIMIT_REACHED') {
            setLimitModalMessage(t.limitReached);
            setIsLimitModalOpen(true);
            return;
          }
          throw new Error(data.error);
        }

        break;
      } catch (error: any) {
        if (retries === 1) {
          toast.error(error.message);
          setIsGenerating(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    }

    try {
      const enrichedQuestions = data.questions.map((q: any) => ({ ...q, id: `temp_${Math.random().toString(36).substr(2, 9)}` }));
      setGeneratedQuestions(enrichedQuestions);
      toast.success(t.toasts.created(totalQuestions));
    } catch(err) {
      toast.error(t.toasts.readError);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalPublish = async () => {
    if (!testTitle.trim()) return toast.error(t.toasts.enterTitle);
    if (!user) return;
    setIsPublishing(true);
    
    try {
      const newTestRef = doc(collection(db, "bsb_chsb_tests")); 
      const examPaper = {
        id: newTestRef.id, teacherId: user.uid, teacherName: user.displayName || "Teacher",
        title: testTitle, schoolType, assessmentType, grade: selectedClass, subject: selectedSubject,
        scopesCovered: selectedScopes, totalPoints, questionCount: generatedQuestions.length,
        difficultyTarget: difficulty, questions: generatedQuestions, status: "active", createdAt: serverTimestamp(),
      };

      await writeBatch(db).set(newTestRef, examPaper).commit();
      toast.success(t.toasts.saved);
      setIsTitleModalOpen(false);
      router.push("/teacher/library/assessments"); 
    } catch (error) {
      toast.error(t.toasts.saveError);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface font-t-body pb-[100px] text-on-surface selection:bg-primary-container selection:text-on-primary-container pt-[64px] md:pt-[72px]">
      
      <AiThinkingModal isVisible={isGenerating} />
      
      {mounted && createPortal(
        <div className="fixed top-0 left-0 right-0 h-[64px] md:h-[72px] bg-[color-mix(in_oklab,var(--m3-surface)_95%,transparent)] backdrop-blur-xl border-b border-outline-variant z-[99999] px-4 sm:px-6 flex items-center justify-between shadow-elev-1">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => router.push('/teacher/create')} className="m3-interactive p-2 -ml-2 text-on-surface-variant hover:text-on-surface hover:bg-state-hover rounded-m3-md transition-all active:scale-95">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="w-px h-5 bg-outline-variant hidden sm:block"></div>
            <h1 className="text-[14px] sm:text-[16px] font-black text-on-surface tracking-tight flex items-center gap-2 truncate">
              <FileText size={16} className="text-primary hidden sm:block" /> {t.headerTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="scale-[0.85] sm:scale-100 origin-right">
               <AiMonthlyLimitCard aiData={aiData} />
            </div>

            <AnimatePresence>
              {generatedQuestions.length > 0 && !isGenerating && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => { setTestTitle(`${selectedClass} ${selectedSubject.replace(/-/g,' ')} ${assessmentType}`); setIsTitleModalOpen(true); }}
                  className="m3-interactive bg-primary text-on-primary px-3 sm:px-5 py-2 sm:py-2.5 rounded-m3-btn font-black transition-all active:scale-95 flex items-center gap-2 shadow-elev-2 text-[12px] sm:text-[14px]"
                >
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span className="hidden sm:block">{t.headerSave}</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>,
        document.body
      )}

      {mounted && createPortal(
        <div className="fixed bottom-0 left-0 right-0 h-[calc(env(safe-area-inset-bottom)+70px)] bg-surface z-[99998] sm:hidden flex items-center justify-center border-t border-outline-variant">
           <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest relative -top-3">{t.studioMode}</span>
        </div>,
        document.body
      )}

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 mt-6 flex flex-col lg:flex-row gap-6 md:gap-8">
        
        <div className="w-full lg:w-[40%] flex flex-col gap-4 md:gap-6">
          <div className="bg-surface-container-low rounded-m3-xl p-5 md:p-6 shadow-elev-1">
            <div className="flex bg-surface-container-high p-1.5 rounded-m3-md mb-6">
              <button onClick={() => setSchoolType('maktab')} className={`m3-interactive flex-1 py-2 text-[12px] md:text-[13px] font-bold rounded-m3-sm flex items-center justify-center gap-2 transition-all ${schoolType === 'maktab' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <Building2 size={16}/> {t.schoolGeneral}
              </button>
              <button onClick={() => setSchoolType('ixtisos')} className={`m3-interactive flex-1 py-2 text-[12px] md:text-[13px] font-bold rounded-m3-sm flex items-center justify-center gap-2 transition-all ${schoolType === 'ixtisos' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <GraduationCap size={16}/> {t.schoolSpecialized}
              </button>
            </div>

            <div className="flex gap-2.5 mb-6">
              <button onClick={() => setAssessmentType('BSB')} className={`m3-interactive flex-1 py-2.5 border rounded-m3-md text-[13px] font-bold transition-all ${assessmentType === 'BSB' ? 'border-primary text-on-primary-container bg-primary-container shadow-elev-1' : 'border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}>BSB</button>
              <button onClick={() => setAssessmentType('CHSB')} className={`m3-interactive flex-1 py-2.5 border rounded-m3-md text-[13px] font-bold transition-all ${assessmentType === 'CHSB' ? 'border-primary text-on-primary-container bg-primary-container shadow-elev-1' : 'border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}>CHSB</button>
            </div>

            <div className="space-y-2.5">
              <div onClick={() => setIsClassSubjectModalOpen(true)} className="group border border-outline-variant hover:border-primary rounded-m3-lg p-4 flex justify-between items-center bg-surface-container hover:bg-state-hover cursor-pointer transition-all active:scale-[0.98]">
                <div>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{t.step1}</p>
                  <p className="text-[14px] font-bold text-on-surface">{selectedClass && selectedSubject ? `${selectedClass} • ${selectedSubject.replace(/-/g, ' ')}` : t.notSelected}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center group-hover:border-primary shadow-elev-1"><ChevronRight size={16} className="text-on-surface-variant group-hover:text-primary" /></div>
              </div>

              <div onClick={() => setIsTopicsModalOpen(true)} className={`group border border-outline-variant hover:border-primary rounded-m3-lg p-4 flex justify-between items-center bg-surface-container hover:bg-state-hover cursor-pointer transition-all active:scale-[0.98] ${(!selectedClass || !selectedSubject) ? 'opacity-40 pointer-events-none' : ''}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest group-hover:text-primary transition-colors">{t.step2}</p>
                    {isLoadingSyllabus && <Spinner size={12} />}
                  </div>
                  <p className="text-[14px] font-bold text-on-surface">{selectedScopes.length > 0 ? t.selectedCount(selectedScopes.length) : t.notSelected}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center group-hover:border-primary shadow-elev-1"><ChevronRight size={16} className="text-on-surface-variant group-hover:text-primary" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[60%] flex flex-col">
          <div className="bg-surface-container-low rounded-m3-xl shadow-elev-1 flex flex-col h-full overflow-hidden">

            <div className="p-5 md:p-6 border-b border-outline-variant bg-surface-container flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <div>
                <h2 className="text-[16px] md:text-[18px] font-black text-on-surface">{t.step3}</h2>
                <p className="text-[12px] font-bold text-on-surface-variant mt-0.5">{t.matrixDesc}</p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-md p-1 flex shadow-elev-1 w-full sm:w-auto">
                {['Aralash', 'Oson', "O'rta", 'Qiyin'].map((diff) => (
                  <button key={diff} onClick={() => setDifficulty(diff as Difficulty)} className={`m3-interactive flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-black rounded-m3-sm transition-colors uppercase tracking-wide ${difficulty === diff ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t.diffLabels[diff]}</button>
                ))}
              </div>
            </div>

            <div className="p-4 md:p-6 flex-1">
              <div className="space-y-3">
                {distribution.map((item) => (
                  <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-m3-lg border transition-all ${item.enabled ? 'bg-surface-container border-outline-variant shadow-elev-1' : 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-state-hover'}`}>

                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={item.enabled} onChange={() => updateDistribution(item.id, 'enabled', !item.enabled)} className="w-5 h-5 text-primary rounded-m3-xs border-outline shadow-elev-1" />
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-m3-sm shrink-0 ${item.enabled ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}><item.icon size={16} strokeWidth={2.5}/></div>
                        <span className={`text-[13px] md:text-[14px] font-bold ${item.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}>{t.qTypes[item.id] || item.label}</span>
                      </div>
                    </div>

                    <div className={`flex items-center gap-3 ml-8 sm:ml-0 ${!item.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-m3-md p-1 shadow-elev-1 w-[90px]">
                        <button onClick={() => updateDistribution(item.id, 'count', item.count - 1)} className="m3-interactive p-1 hover:bg-state-hover rounded-m3-sm text-on-surface-variant hover:text-on-surface active:scale-95"><Minus size={14} strokeWidth={3}/></button>
                        <span className="text-[13px] font-black text-on-surface">{item.count}</span>
                        <button onClick={() => updateDistribution(item.id, 'count', item.count + 1)} className="m3-interactive p-1 hover:bg-state-hover rounded-m3-sm text-on-surface-variant hover:text-on-surface active:scale-95"><Plus size={14} strokeWidth={3}/></button>
                      </div>
                      <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant rounded-m3-md px-2.5 shadow-elev-1 h-9">
                        <input type="number" min="1" max="20" value={item.points} onChange={(e) => updateDistribution(item.id, 'points', parseInt(e.target.value) || 1)} className="w-6 text-center bg-transparent text-[13px] font-black text-on-surface outline-none" />
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t.pointsUnit}</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 md:p-6 border-t border-outline-variant bg-surface-container shrink-0">
              <div className="flex justify-between items-center mb-5 px-1">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-black tracking-widest mb-0.5">{t.totalQuestions}</p>
                  <p className="text-[22px] font-black text-on-surface leading-none">{totalQuestions}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-on-surface-variant uppercase font-black tracking-widest mb-0.5">{t.totalPoints}</p>
                  <p className="text-[22px] font-black text-primary leading-none">{totalPoints}</p>
                </div>
              </div>
              <Button
                variant="filled"
                size="lg"
                className="w-full"
                onClick={handleGenerate}
                disabled={isGenerating || totalQuestions === 0 || selectedScopes.length === 0}
                icon={<Wand2 size={18} strokeWidth={2.5} />}
              >
                {t.generateBtn}
              </Button>
            </div>

          </div>
        </div>
      </div>

      <AnimatePresence>
        {generatedQuestions.length > 0 && !isGenerating && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[900px] mx-auto px-4 sm:px-6 mt-12">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-[20px] md:text-[24px] font-black text-on-surface">{t.paperTitle}</h2>
                <p className="text-[13px] font-medium text-on-surface-variant mt-1">{t.paperDesc}</p>
              </div>
              <div className="text-[12px] font-black text-on-primary-container bg-primary-container px-4 py-2 rounded-m3-md shadow-elev-1 self-start sm:self-auto uppercase tracking-wide">
                {t.confirmedPoints(generatedQuestions.reduce((acc, q) => acc + (q.points || 0), 0))}
              </div>
            </div>

            <div ref={bottomRef} className="scroll-mt-24">
              {generatedQuestions.map((q, idx) => (
                <ExamQuestionCard key={q.id} q={q} idx={idx} onRemove={(id) => setGeneratedQuestions(prev => prev.filter(x => x.id !== id))} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟢 PREMIUM LIMIT MODAL */}
      {mounted && createPortal(
        <AnimatePresence>
          {isLimitModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsLimitModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-surface-container-low rounded-m3-xl p-6 md:p-8 w-full max-w-sm shadow-elev-3 z-10 flex flex-col items-center text-center">
                <button onClick={() => setIsLimitModalOpen(false)} className="m3-interactive absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-state-hover rounded-full transition-colors"><X size={20} /></button>
                <div className="w-14 h-14 bg-primary-container rounded-m3-md flex items-center justify-center mb-4">
                  <Crown size={28} className="text-warning" />
                </div>
                <h3 className="text-[18px] font-black text-on-surface mb-2">{t.premiumFeature}</h3>
                <p className="text-[13px] text-on-surface-variant mb-6 font-medium leading-relaxed px-2">
                  {limitModalMessage}
                </p>
                <div className="w-full flex flex-col gap-2.5">
                  <Button variant="filled" size="lg" className="w-full" onClick={() => router.push('/teacher/subscription')}>{t.viewPlans}</Button>
                  <Button variant="outlined" size="lg" className="w-full" onClick={() => setIsLimitModalOpen(false)}>{t.close}</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* OTHER MODALS */}
      {mounted && createPortal(
        <AnimatePresence>
          {isClassSubjectModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsClassSubjectModalOpen(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl p-6 md:p-8 w-full max-w-md shadow-elev-3 z-10 flex flex-col max-h-[90dvh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="text-[18px] font-black text-on-surface">{t.classSubjectModal.title}</h3>
                  <button onClick={() => setIsClassSubjectModalOpen(false)} className="m3-interactive p-2 bg-surface-container text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-6">
                  <div>
                    <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-3 block">{t.classSubjectModal.selectClass}</label>
                    <div className="flex flex-wrap gap-2">
                      {availableClasses.map(c => (
                        <button key={c} onClick={() => { setSelectedClass(c); setSelectedSubject(""); }} className={`m3-interactive px-4 py-2.5 rounded-m3-md text-[14px] font-bold border transition-colors ${selectedClass === c ? 'bg-primary border-primary text-on-primary shadow-elev-2' : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-state-hover'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className={`transition-opacity duration-300 ${!selectedClass ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-3 block">{t.classSubjectModal.selectSubject}</label>
                    <div className="flex flex-wrap gap-2">
                      {availableSubjects.map((s: string) => (
                        <button key={s} onClick={() => setSelectedSubject(s)} className={`m3-interactive px-4 py-2.5 rounded-m3-md text-[13px] font-bold border capitalize transition-colors ${selectedSubject === s ? 'bg-primary border-primary text-on-primary shadow-elev-2' : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-state-hover'}`}>{s.replace(/-/g, ' ')}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant shrink-0 mt-auto">
                  <Button variant="filled" size="lg" className="w-full" onClick={() => setIsClassSubjectModalOpen(false)}>{t.classSubjectModal.confirm}</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {isTopicsModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsTopicsModalOpen(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-2xl shadow-elev-3 z-10 h-[90dvh] flex flex-col overflow-hidden">

                <div className="p-5 md:p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0 z-20 shadow-elev-1">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-[17px] md:text-[18px] font-black text-on-surface truncate">{t.topicsModal.title}</h3>
                    <p className="text-[12px] font-bold text-primary mt-0.5 truncate">{selectedClass} • {selectedSubject.replace(/-/g, ' ')}</p>
                  </div>
                  <button onClick={() => setIsTopicsModalOpen(false)} className="m3-interactive p-2 bg-surface-container text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shrink-0"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-surface-container">
                  {!syllabusData && !isLoadingSyllabus && <div className="text-center py-10 text-on-surface-variant text-[13px] font-bold">{t.topicsModal.empty}</div>}
                  {isLoadingSyllabus && <div className="flex justify-center py-10"><Spinner size={24}/></div>}
                  
                  {syllabusData?.chapters?.map((chapter: any, cIdx: number) => {
                    const isExpanded = expandedChapters.includes(chapter.chapter);
                    const subNames = chapter.subtopics.map((s: any) => s.name);
                    const selectedCount = subNames.filter((name: string) => selectedScopes.includes(name)).length;
                    const isAllSelected = selectedCount === subNames.length && subNames.length > 0;
                    
                    return (
                      <div key={cIdx} className="mb-4 bg-surface-container-lowest border border-outline-variant rounded-m3-lg overflow-hidden shadow-elev-1 transition-all hover:border-outline">
                        <div className="flex items-center p-4 cursor-pointer" onClick={() => toggleChapterExpand(chapter.chapter)}>
                          <div onClick={(e) => { e.stopPropagation(); handleChapterCheckbox(chapter); }} className="mr-3 cursor-pointer p-1">
                            <div className={`w-5 h-5 rounded-m3-xs border-2 flex items-center justify-center transition-colors ${isAllSelected ? 'bg-primary border-primary text-on-primary' : selectedCount > 0 ? 'bg-primary-container border-primary text-on-primary-container' : 'bg-surface-container-lowest border-outline'}`}>
                              {isAllSelected && <Check size={14} strokeWidth={3} />}
                              {!isAllSelected && selectedCount > 0 && <Minus size={14} strokeWidth={3} />}
                            </div>
                          </div>
                          <span className="flex-1 text-[13px] md:text-[14px] font-bold text-on-surface leading-snug">{chapter.chapter}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-[11px] font-black text-on-primary-container bg-primary-container px-2 py-1 rounded-m3-xs">{selectedCount}/{subNames.length}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'}`}><ChevronDown size={16} strokeWidth={2.5}/></div>
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-outline-variant bg-surface-container">
                              <div className="p-2 space-y-1">
                                {chapter.subtopics.map((sub: any, sIdx: number) => (
                                  <label key={sIdx} className="flex items-start gap-3 p-3 rounded-m3-md hover:bg-surface-container-lowest border border-transparent hover:border-outline-variant cursor-pointer transition-colors group">
                                    <div className={`w-4 h-4 mt-0.5 rounded-m3-xs border-2 flex items-center justify-center transition-colors shrink-0 ${selectedScopes.includes(sub.name) ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline group-hover:border-primary'}`}>
                                      {selectedScopes.includes(sub.name) && <Check size={12} strokeWidth={4} />}
                                    </div>
                                    <span className={`text-[13px] leading-snug ${selectedScopes.includes(sub.name) ? 'text-on-surface font-bold' : 'text-on-surface-variant font-medium'}`}>{sub.name}</span>
                                  </label>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 md:p-5 border-t border-outline-variant bg-surface-container-low shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
                  <Button variant="filled" size="lg" className="w-full" onClick={() => setIsTopicsModalOpen(false)}>{t.topicsModal.confirm}</Button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {isTitleModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsTitleModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container-low rounded-m3-xl p-6 md:p-8 w-full max-w-sm shadow-elev-3 z-10">
                <div className="w-14 h-14 bg-primary-container rounded-m3-md flex items-center justify-center mb-5"><BookOpen size={24} className="text-on-primary-container" /></div>
                <h3 className="text-[18px] font-black text-on-surface mb-1.5">{t.titleModal.title}</h3>
                <p className="text-[12px] font-bold text-on-surface-variant mb-6">{t.titleModal.desc}</p>

                <input type="text" value={testTitle} onChange={e => setTestTitle(e.target.value)} className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-m3-md text-[14px] font-black text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-[color-mix(in_oklab,var(--m3-primary)_20%,transparent)] transition-all mb-6" autoFocus placeholder={t.titleModal.placeholder}/>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button variant="tonal" className="w-full" onClick={() => setIsTitleModalOpen(false)}>{t.titleModal.cancel}</Button>
                  <Button variant="filled" className="w-full" onClick={handleFinalPublish} loading={isPublishing} icon={<CheckCircle2 size={16}/>}>
                    {isPublishing ? t.titleModal.saving : t.titleModal.save}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}