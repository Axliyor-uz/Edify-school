'use client';

// IELTS listening builder — mirrors the reading builder (split-pane, live global numbering,
// per-test localStorage drafts) but the left pane is audio + transcript per part (1–4 parts,
// real IELTS = 4). Question-block editors are imported 1:1 from the reading builder.
// Reusable by the admin platform panel via { asPlatform: true }.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, CheckCircle, Settings2, LayoutGrid, Eye, ArrowUp, ArrowDown, X, Headphones, ListChecks } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { saveIeltsTest, loadTestForEdit } from '@/services/ieltsService';
import type { IeltsListeningTest } from '@/lib/ielts/types';
import { Button, IconButton, StatusChip, EmptyState, Spinner } from '@/components/ui';

// Question-block editors reused 1:1 from the reading builder (do not duplicate).
import MultipleChoiceBlock from '../../../reading/manual/_components/multiplechoice';
import SummaryCompletionBlock from '../../../reading/manual/_components/summarycompletion';
import SentenceCompletionBlock from '../../../reading/manual/_components/sentencecompletion';
import ShortAnswerBlock from '../../../reading/manual/_components/shortanswer';
import MatchingFeaturesBlock from '../../../reading/manual/_components/matchingfeatures';
import MatchingSentenceEndingsBlock from '../../../reading/manual/_components/matchingsentenceendings';
import ListSelectionBlock from '../../../reading/manual/_components/listselection';
import TableCompletionBlock from '../../../reading/manual/_components/tablecompletion';
import FlowchartCompletionBlock from '../../../reading/manual/_components/flowchartcompletion';
import DiagramCompletionBlock from '../../../reading/manual/_components/diagramcompletion';
import PreviewModal from '../../../reading/manual/_components/preview';
import BlockExtras from '../../../reading/manual/_components/blockextras';

import PartPane from './partpane';

const T = {
  uz: {
    setup: "Yangi Listening Test", desc: "Test parametrlarini kiriting",
    title: "Test nomi (masalan: Cambridge 18 Listening 1)", time: "Vaqt (daq)", next: "Boshlash",
    save: "Saqlash", saving: "Saqlanmoqda...", addBlock: "Yangi Savol Qo'shish", preview: "Ko'zdan kechirish",
    back: "Ortga", labelTitle: "Test nomi", labelTime: "Vaqt chegarasi",
    deletePartConfirm: "Haqiqatan ham bu qismni o'chirmoqchimisiz?",
    deletePartTitle: "Qismni o'chirish",
    noQuestions: "Hozircha savollar qo'shilmagan.",
    selectType: "Savol turini tanlang",
    errNoTitle: "Test nomini kiriting!",
    errNoAudio: (n: number) => `Part ${n}: Audio fayl yuklanmagan!`,
    errNoInstructions: (n: number) => `Part ${n}: Yo'riqnoma kiritilmagan!`,
    errNoAnswer: (n: number, q: string | number) => `Part ${n}, Savol ${q}: To'g'ri javob kiritilmagan!`,
    saveSuccess: "Test muvaffaqiyatli saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi!",
    loading: "Test yuklanmoqda...",
    loadError: "Testni yuklashda xatolik!",
    paneAudio: "Audio", paneQuestions: "Savollar",
  },
  en: {
    setup: "New Listening Test", desc: "Initialize test parameters",
    title: "Test Title (e.g. Cambridge 18 Listening 1)", time: "Time (mins)", next: "Initialize",
    save: "Save", saving: "Saving...", addBlock: "Add Question Block", preview: "Preview",
    back: "Back", labelTitle: "Test Title", labelTime: "Time Limit",
    deletePartConfirm: "Are you sure you want to delete this part?",
    deletePartTitle: "Delete Part",
    noQuestions: "No questions added yet.",
    selectType: "Select Question Type",
    errNoTitle: "Enter a test title!",
    errNoAudio: (n: number) => `Part ${n}: audio file is missing!`,
    errNoInstructions: (n: number) => `Part ${n}: instructions are missing!`,
    errNoAnswer: (n: number, q: string | number) => `Part ${n}, Question ${q}: correct answer is missing!`,
    saveSuccess: "Test saved successfully!",
    saveError: "Failed to save!",
    loading: "Loading the test...",
    loadError: "Failed to load the test!",
    paneAudio: "Audio", paneQuestions: "Questions",
  },
  ru: {
    setup: "Новый Listening тест", desc: "Введите параметры теста",
    title: "Название теста (например: Cambridge 18 Listening 1)", time: "Время (мин)", next: "Начать",
    save: "Сохранить", saving: "Сохранение...", addBlock: "Добавить блок вопросов", preview: "Предпросмотр",
    back: "Назад", labelTitle: "Название теста", labelTime: "Лимит времени",
    deletePartConfirm: "Вы действительно хотите удалить эту часть?",
    deletePartTitle: "Удалить часть",
    noQuestions: "Вопросы пока не добавлены.",
    selectType: "Выберите тип вопроса",
    errNoTitle: "Введите название теста!",
    errNoAudio: (n: number) => `Part ${n}: не загружен аудиофайл!`,
    errNoInstructions: (n: number) => `Part ${n}: не указана инструкция!`,
    errNoAnswer: (n: number, q: string | number) => `Part ${n}, вопрос ${q}: не указан правильный ответ!`,
    saveSuccess: "Тест успешно сохранён!",
    saveError: "Ошибка при сохранении!",
    loading: "Тест загружается...",
    loadError: "Не удалось загрузить тест!",
    paneAudio: "Аудио", paneQuestions: "Вопросы",
  }
};

interface ListeningBuilderProps {
  asPlatform?: boolean;
  backHref?: string;
  editTestId?: string;
}

const emptyPart = (n: number) => ({
  part_number: n,
  audio_url: '',
  audio_duration_seconds: 0,
  transcript: '',
  questions: [] as any[],
});

// Listening-appropriate subset of the shared editors (no headings/paragraph-matching/TFNG —
// those are reading-passage constructs). table_completion covers form/note completion;
// diagram_completion covers plan/map labelling.
const LISTENING_TYPE_MENU = [
  { type: 'table_completion', label: 'Form / Note / Table' },
  { type: 'multiple_choice', label: 'Multiple Choice' },
  { type: 'list_selection', label: 'List Selection' },
  { type: 'matching_features', label: 'Matching' },
  { type: 'sentence_completion', label: 'Sentence Completion' },
  { type: 'short_answer', label: 'Short Answer' },
  { type: 'summary_completion', label: 'Summary Completion' },
  { type: 'flowchart_completion', label: 'Flowchart Completion' },
  { type: 'matching_sentence_endings', label: 'Match Sentence Endings' },
  { type: 'diagram_completion', label: 'Plan / Map / Diagram' },
];

export default function ListeningBuilder({ asPlatform = false, backHref, editTestId }: ListeningBuilderProps) {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T.uz;
  const listHref = backHref || '/teacher/ielts/listening';

  const draftKey = `${asPlatform ? 'ielts_platform_listening_draft' : 'ielts_listening_draft'}_${editTestId || 'new'}`;

  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editTestId);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mobilePane, setMobilePane] = useState<'left' | 'right'>('left');

  const [meta, setMeta] = useState({ id: '', title: '', time: 32 });
  const [parts, setParts] = useState<any[]>([emptyPart(1)]);
  const hydrated = useRef(false);

  const [leftWidth, setLeftWidth] = useState(42);
  const isDragging = useRef(false);

  // ==========================================================================
  // DRAG TO RESIZE (desktop)
  // ==========================================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseUp = () => { isDragging.current = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setLeftWidth(newWidth);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ==========================================================================
  // TOTAL QUESTIONS (mirrors the reading builder / renumberTest semantics)
  // ==========================================================================
  const totalQuestionsCount = parts.reduce((acc, p) => {
    return acc + p.questions.reduce((qAcc: number, qb: any) => {
      if (qb.type === 'list_selection') {
        return qAcc + qb.questions.reduce((lAcc: number, r: any) =>
          lAcc + Math.max(1, Array.isArray(r.correct_answer) ? r.correct_answer.length : 1), 0);
      }
      return qAcc + (qb.questions ? qb.questions.length : 0);
    }, 0);
  }, 0);

  // ==========================================================================
  // DRAFT RESTORE / EDIT LOAD (per-test key)
  // ==========================================================================
  useEffect(() => {
    let cancelled = false;

    const restoreDraft = (raw: string | null): boolean => {
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.meta && parsed.parts) {
          setMeta(parsed.meta);
          setParts(parsed.parts);
          return true;
        }
      } catch (e) {
        console.error('Draft parsing failed', e);
      }
      return false;
    };

    const init = async () => {
      if (restoreDraft(localStorage.getItem(draftKey))) {
        hydrated.current = true;
        setIsLoadingEdit(false);
        return;
      }
      if (editTestId) {
        try {
          const test = await loadTestForEdit('listening', editTestId) as IeltsListeningTest;
          if (cancelled) return;
          setMeta({
            id: test.test_id || editTestId,
            title: test.test_title || '',
            time: test.total_time_minutes || 32,
          });
          const loaded = (test.parts as any[])?.length ? (test.parts as any[]) : [emptyPart(1)];
          setParts(loaded.map((p, i) => ({ ...emptyPart(i + 1), ...p, part_number: i + 1 })));
        } catch (e) {
          console.error('Edit load failed', e);
          toast.error(t.loadError);
          router.replace(listHref);
          return;
        } finally {
          if (!cancelled) setIsLoadingEdit(false);
        }
      }
      hydrated.current = true;
    };

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (meta.title) {
      localStorage.setItem(draftKey, JSON.stringify({ meta, parts }));
    }
  }, [meta, parts, draftKey]);

  // ==========================================================================
  // GLOBAL AUTO-NUMBERING ACROSS PARTS (same algorithm as reading/renumberTest)
  // ==========================================================================
  useEffect(() => {
    let globalCounter = 1;
    let needsUpdate = false;
    const newParts = JSON.parse(JSON.stringify(parts));

    newParts.forEach((part: any) => {
      part.questions.forEach((qb: any) => {
        if (qb.questions && qb.questions.length > 0) {
          const expectedStart = globalCounter;

          qb.questions.forEach((row: any) => {
            if (row.question_number !== globalCounter) {
              row.question_number = globalCounter;
              needsUpdate = true;
            }
            if (qb.type === 'list_selection') {
              globalCounter += Math.max(1, Array.isArray(row.correct_answer) ? row.correct_answer.length : 1);
            } else {
              globalCounter++;
            }
          });

          const expectedEnd = globalCounter - 1;
          if (qb.start_question !== expectedStart) { qb.start_question = expectedStart; needsUpdate = true; }
          if (qb.end_question !== expectedEnd) { qb.end_question = expectedEnd; needsUpdate = true; }
        }
      });
    });

    if (needsUpdate) setParts(newParts);
  }, [parts]);

  // ==========================================================================
  // UPDATERS
  // ==========================================================================
  const updateActivePart = (key: string, val: any) => {
    const updated = [...parts];
    updated[activeTab][key] = val;
    setParts(updated);
  };

  const updateBlock = (qbIdx: number, key: string, val: any) => {
    const q = [...parts[activeTab].questions];
    q[qbIdx][key] = val;
    updateActivePart('questions', q);
  };

  const deleteBlock = (qbIdx: number) => {
    const q = [...parts[activeTab].questions];
    q.splice(qbIdx, 1);
    updateActivePart('questions', q);
  };

  const deletePart = (idx: number) => {
    if (parts.length <= 1) return;
    if (!confirm(t.deletePartConfirm)) return;

    const newParts = [...parts];
    newParts.splice(idx, 1);
    newParts.forEach((p, i) => { p.part_number = i + 1; });
    setParts(newParts);

    if (activeTab >= newParts.length) setActiveTab(newParts.length - 1);
    else if (activeTab > idx) setActiveTab(activeTab - 1);
  };

  const addPart = () => {
    if (parts.length >= 4) return;
    setParts([...parts, emptyPart(parts.length + 1)]);
    setActiveTab(parts.length);
  };

  const moveBlockUp = (qbIdx: number) => {
    if (qbIdx === 0) return;
    const q = [...parts[activeTab].questions];
    [q[qbIdx - 1], q[qbIdx]] = [q[qbIdx], q[qbIdx - 1]];
    updateActivePart('questions', q);
  };

  const moveBlockDown = (qbIdx: number) => {
    const q = [...parts[activeTab].questions];
    if (qbIdx === q.length - 1) return;
    [q[qbIdx + 1], q[qbIdx]] = [q[qbIdx], q[qbIdx + 1]];
    updateActivePart('questions', q);
  };

  const addBlock = (type: string) => {
    const q = [...parts[activeTab].questions];
    let newBlock: any = { type, start_question: 1, end_question: 1 };

    switch (type) {
      case 'multiple_choice':
        newBlock = { ...newBlock, instructions: 'Choose the correct letter, A, B or C.', questions: [{ question_number: 0, question_text: '', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }], correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'summary_completion':
        newBlock = { ...newBlock, instructions: 'Complete the summary below. Write NO MORE THAN TWO WORDS.', summary_title: '', summary_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'sentence_completion':
        newBlock = { ...newBlock, instructions: 'Complete the sentences below. Write NO MORE THAN TWO WORDS.', questions: [{ question_number: 0, sentence: '... [0] ...', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'short_answer':
        newBlock = { ...newBlock, instructions: 'Answer the questions below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.', questions: [{ question_number: 0, question_text: '', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_features':
        newBlock = { ...newBlock, instructions: 'What does the speaker say about each item? Choose the correct letter.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, statement: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'matching_sentence_endings':
        newBlock = { ...newBlock, instructions: 'Complete each sentence with the correct ending.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, sentence_start: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'list_selection':
        newBlock = { ...newBlock, instructions: 'Choose TWO letters, A-E.', questions: [{ question_number: 0, question_text: 'Which TWO things are mentioned?', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }], correct_answer: ['A', 'B'], passage_reference: '' }] };
        break;
      case 'table_completion':
        newBlock = { ...newBlock, instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.', table_title: '', options: null, headers: ['Item', 'Detail'], rows: [{ cells: ['', ''] }], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'flowchart_completion':
        newBlock = { ...newBlock, instructions: 'Complete the flow-chart below.', flowchart_title: '', options: null, steps: ['Step 1 with [0]'], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'diagram_completion':
        newBlock = { ...newBlock, instructions: 'Label the plan below.', diagram_title: '', diagram_url: '', diagram_alt_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
    }

    q.push(newBlock);
    updateActivePart('questions', q);
    setShowAddMenu(false);

    setTimeout(() => {
      const container = document.getElementById('questions-container');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const validateTest = () => {
    if (!meta.title.trim()) { toast.error(t.errNoTitle); return false; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.audio_url) { setActiveTab(i); setMobilePane('left'); toast.error(t.errNoAudio(p.part_number)); return false; }
      for (let j = 0; j < p.questions.length; j++) {
        const qb = p.questions[j];
        if (!qb.instructions?.trim()) { setActiveTab(i); toast.error(t.errNoInstructions(p.part_number)); return false; }
        for (let k = 0; k < qb.questions.length; k++) {
          const q = qb.questions[k];
          let isAnswerMissing = false;
          if (Array.isArray(q.correct_answer)) {
            if (q.correct_answer.length === 0 || q.correct_answer.every((a: string) => !a.trim())) isAnswerMissing = true;
          } else if (!q.correct_answer || !String(q.correct_answer).trim()) {
            isAnswerMissing = true;
          }
          if (isAnswerMissing) { setActiveTab(i); toast.error(t.errNoAnswer(p.part_number, q.question_number || '?')); return false; }
        }
      }
    }
    return true;
  };

  const sanitizeQuestionBlocks = (blocks: any[]) =>
    blocks.map((qb: any) => {
      const clean = { ...qb };
      if (!(Number(clean.word_limit) > 0)) delete clean.word_limit;
      clean.questions = (qb.questions || []).map((row: any) => {
        const r = { ...row };
        if (!(r.explanation || '').trim()) delete r.explanation;
        return r;
      });
      return clean;
    });

  const handleSaveTest = async () => {
    if (!validateTest()) return;
    setIsSaving(true);
    try {
      const finalPayload = {
        test_id: meta.id,
        test_title: meta.title,
        module: 'listening' as const,
        total_time_minutes: meta.time || 32,
        total_questions: totalQuestionsCount,
        parts: parts.map((p, i) => ({
          part_number: i + 1,
          audio_url: p.audio_url,
          ...(p.audio_duration_seconds > 0 ? { audio_duration_seconds: p.audio_duration_seconds } : {}),
          ...((p.transcript || '').trim() ? { transcript: p.transcript } : {}),
          questions: sanitizeQuestionBlocks(p.questions),
        })),
      };

      await saveIeltsTest(finalPayload as unknown as IeltsListeningTest, asPlatform ? { asPlatform: true } : undefined);
      localStorage.removeItem(draftKey);
      toast.success(t.saveSuccess);
      router.push(listHref);
    } catch (error) {
      console.error('Save failed', error);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitialize = () => {
    if (!meta.id) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const baseSlug = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      setMeta({ ...meta, id: `${baseSlug}_${uniqueSuffix}` });
    }
    setStep(2);
  };

  // Preview reuses the reading PreviewModal with a synthetic "passage" of the active part.
  const previewPassage = {
    passage_number: parts[activeTab]?.part_number || 1,
    title: `Part ${parts[activeTab]?.part_number || 1}`,
    subtitle: '',
    blocks: (parts[activeTab]?.transcript || '').trim()
      ? [{ type: 'text', label: '', content: parts[activeTab].transcript }]
      : [],
    questions: parts[activeTab]?.questions || [],
  };

  if (isLoadingEdit) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-surface">
        <Spinner size={28} className="mb-4" />
        <p className="text-on-surface-variant font-bold text-[13px]">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface text-on-surface font-t-body selection:bg-primary-container overflow-hidden flex flex-col text-[13px]">
      <AnimatePresence mode="wait">

        {step === 1 && (
          <motion.div key="setup" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full px-3 bg-surface">
            <div className="w-full max-w-sm bg-surface-container-low border border-outline-variant p-8 rounded-m3-xl shadow-elev-1 relative">
              <Link href={listHref} className="absolute -top-10 left-0 text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors font-medium">
                <ArrowLeft size={15}/> {t.back}
              </Link>
              <div className="flex flex-col items-center text-center gap-3 mb-8">
                <div className="w-14 h-14 bg-primary-container rounded-m3-lg flex items-center justify-center text-on-primary-container"><Settings2 size={24} strokeWidth={2.5} /></div>
                <div><h2 className="text-[18px] font-black tracking-tight text-on-surface">{t.setup}</h2><p className="text-[12px] text-on-surface-variant font-medium mt-0.5">{t.desc}</p></div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">{t.labelTitle}</label>
                  <input type="text" value={meta.title} onChange={e => setMeta({...meta, title: e.target.value})} placeholder={t.title} className="w-full bg-surface-container border border-outline-variant px-4 py-3.5 rounded-m3-md text-[14px] font-semibold focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors text-on-surface placeholder:text-on-surface-variant shadow-elev-1" autoFocus />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">{t.labelTime}</label>
                  <div className="bg-surface-container border border-outline-variant rounded-m3-md px-4 py-3 flex items-center justify-between focus-within:border-primary focus-within:bg-surface-container-lowest transition-colors shadow-elev-1">
                    <span className="text-[13px] text-on-surface-variant font-bold">{t.time}</span>
                    <input type="number" value={meta.time} onChange={e => setMeta({...meta, time: +e.target.value})} className="w-16 bg-transparent text-right text-[15px] font-black outline-none text-primary" />
                  </div>
                </div>
                <Button variant="filled" size="lg" onClick={handleInitialize} disabled={!meta.title} className="w-full mt-4">
                  {t.next} <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">

            <header className="flex-none h-12 bg-surface-container-low border-b border-outline-variant px-3 md:px-4 flex items-center justify-between gap-3 z-40 shadow-elev-1">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <IconButton aria-label={t.back} size="sm" onClick={() => setStep(1)}><ArrowLeft size={16} /></IconButton>
                <h1 className="font-black text-[13px] text-on-surface max-w-[110px] md:max-w-[300px] truncate">{meta.title}</h1>

                <StatusChip tone={totalQuestionsCount === 40 ? 'success' : 'warning'} className="text-[10px] font-black uppercase select-none hidden sm:flex">
                  <span>{meta.time}M</span><span>•</span><span>{totalQuestionsCount} / 40 Qs</span>
                </StatusChip>
              </div>

              <div className="flex items-center gap-2 md:gap-5 min-w-0">

                <div className="hidden md:flex bg-surface-container p-1 rounded-m3-sm border border-outline-variant shadow-elev-1 gap-1">
                  {parts.map((p, idx) => (
                    <div key={p.part_number} className={`flex items-center gap-1 px-2.5 py-1 rounded-m3-sm transition-all group/tab relative ${activeTab === idx ? 'bg-surface-container-lowest text-primary shadow-elev-1 border border-outline-variant' : 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface'}`}>
                      <button onClick={() => setActiveTab(idx)} className="text-[11px] font-black uppercase tracking-wider">
                        Part {p.part_number}
                      </button>

                      {parts.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePart(idx); }}
                          className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors
                            ${activeTab === idx ? 'text-on-surface-variant hover:bg-error-container hover:text-on-error-container' : 'opacity-0 group-hover/tab:opacity-100 text-on-surface-variant hover:bg-error-container hover:text-on-error-container'}`}
                          title={t.deletePartTitle}
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                  {parts.length < 4 && (
                    <button onClick={addPart} className="w-6 h-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors ml-1"><Plus size={14}/></button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outlined" size="sm" icon={<Eye size={14} />} onClick={() => setIsPreviewMode(true)}>
                    <span className="hidden md:inline">{t.preview}</span>
                  </Button>
                  <Button variant="filled" size="sm" icon={<CheckCircle size={13} />} loading={isSaving} onClick={handleSaveTest}>
                    <span className="hidden md:inline">{isSaving ? t.saving : t.save}</span>
                  </Button>
                </div>
              </div>
            </header>

            {/* Mobile: part strip + pane toggle */}
            <div className="md:hidden flex-none bg-surface-container-low border-b border-outline-variant px-3 py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {parts.map((p, idx) => (
                  <button key={p.part_number} onClick={() => setActiveTab(idx)} className={`px-2 py-1 rounded-m3-sm text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
                    P{p.part_number}
                  </button>
                ))}
                {parts.length < 4 && (
                  <button onClick={addPart} className="w-6 h-6 flex items-center justify-center text-on-surface-variant"><Plus size={12}/></button>
                )}
              </div>
              <div className="flex p-0.5 bg-surface-container rounded-m3-sm border border-outline-variant gap-0.5 shrink-0">
                <button onClick={() => setMobilePane('left')} className={`px-2.5 py-1 rounded-m3-sm text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${mobilePane === 'left' ? 'bg-surface-container-lowest text-primary shadow-elev-1' : 'text-on-surface-variant'}`}>
                  <Headphones size={11} /> {t.paneAudio}
                </button>
                <button onClick={() => setMobilePane('right')} className={`px-2.5 py-1 rounded-m3-sm text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${mobilePane === 'right' ? 'bg-surface-container-lowest text-primary shadow-elev-1' : 'text-on-surface-variant'}`}>
                  <ListChecks size={11} /> {t.paneQuestions}
                </button>
              </div>
            </div>

            <main className="flex-1 flex overflow-hidden">

              <div
                style={{ '--pane-l': `${leftWidth}%` } as React.CSSProperties}
                className={`h-full overflow-y-auto md:border-r border-outline-variant bg-surface-container-lowest custom-scrollbar relative w-full md:w-[var(--pane-l)] ${mobilePane === 'left' ? 'block' : 'hidden'} md:block`}
              >
                <PartPane part={parts[activeTab]} update={updateActivePart} testId={meta.id || 'draft'} />
              </div>

              <div
                onMouseDown={handleMouseDown}
                className="hidden md:flex w-2 bg-surface-container border-x border-outline-variant hover:bg-surface-container-high cursor-col-resize transition-colors flex-shrink-0 items-center justify-center z-10"
              >
                <div className="w-0.5 h-6 bg-outline rounded-full"></div>
              </div>

              <div
                style={{ '--pane-r': `${100 - leftWidth}%` } as React.CSSProperties}
                className={`h-full overflow-hidden bg-surface relative flex-col w-full md:w-[var(--pane-r)] ${mobilePane === 'right' ? 'flex' : 'hidden'} md:flex`}
              >

                <div id="questions-container" className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-40 space-y-6">

                  {parts[activeTab].questions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center pb-20">
                       <EmptyState icon={<LayoutGrid strokeWidth={1.5} />} title={t.noQuestions} />
                    </div>
                  ) : (
                    parts[activeTab].questions.map((qb: any, qbIdx: number) => {
                      const props = { qb, qbIdx, updateBlock, deleteBlock };
                      return (
                        <div key={qbIdx} className="relative group/wrapper">

                          <div className="absolute -left-10 top-2 opacity-0 group-hover/wrapper:opacity-100 flex flex-col gap-1 transition-opacity z-10">
                            <button onClick={() => moveBlockUp(qbIdx)} disabled={qbIdx === 0} className="p-1.5 bg-surface-container-lowest border border-outline-variant rounded-m3-sm shadow-elev-1 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowUp size={14}/></button>
                            <button onClick={() => moveBlockDown(qbIdx)} disabled={qbIdx === parts[activeTab].questions.length - 1} className="p-1.5 bg-surface-container-lowest border border-outline-variant rounded-m3-sm shadow-elev-1 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowDown size={14}/></button>
                          </div>

                          {qb.type === 'multiple_choice' && <MultipleChoiceBlock {...props} />}
                          {qb.type === 'summary_completion' && <SummaryCompletionBlock {...props} />}
                          {qb.type === 'sentence_completion' && <SentenceCompletionBlock {...props} />}
                          {qb.type === 'short_answer' && <ShortAnswerBlock {...props} />}
                          {qb.type === 'matching_features' && <MatchingFeaturesBlock {...props} />}
                          {qb.type === 'matching_sentence_endings' && <MatchingSentenceEndingsBlock {...props} />}
                          {qb.type === 'list_selection' && <ListSelectionBlock {...props} />}
                          {qb.type === 'table_completion' && <TableCompletionBlock {...props} />}
                          {qb.type === 'flowchart_completion' && <FlowchartCompletionBlock {...props} />}
                          {qb.type === 'diagram_completion' && <DiagramCompletionBlock {...props} />}

                          <BlockExtras qb={qb} qbIdx={qbIdx} updateBlock={updateBlock} />
                        </div>
                      );
                    })
                  )}

                </div>

                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                  <div className="pointer-events-auto relative">
                    <button
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      className="m3-interactive h-11 px-5 bg-inverse-surface text-inverse-on-surface rounded-full font-bold text-[12px] flex items-center gap-2 shadow-elev-3 transition-all active:scale-95"
                    >
                      <Plus size={14} className={`transition-transform duration-300 ${showAddMenu ? 'rotate-45' : 'rotate-0'}`} /> {t.addBlock}
                    </button>

                    <AnimatePresence>
                      {showAddMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, x: "-50%", scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                          exit={{ opacity: 0, y: 15, x: "-50%", scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          style={{ transformOrigin: "bottom center" }}
                          className="absolute bottom-[130%] left-1/2 w-max max-w-[calc(100vw-2rem)] bg-surface-container-low rounded-m3-lg border border-outline-variant p-3 shadow-elev-3 z-50"
                        >
                          <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-2">{t.selectType}</div>
                          <div className="grid grid-cols-2 gap-1.5 w-[min(380px,calc(100vw-4rem))]">
                            {LISTENING_TYPE_MENU.map((item) => (
                              <button key={item.type} onClick={() => addBlock(item.type)} className="text-left px-3 py-2 text-[11px] font-bold text-on-surface bg-surface-container hover:bg-primary-container hover:text-on-primary-container border border-outline-variant hover:border-primary rounded-m3-sm transition-colors truncate">
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPreviewMode && (
          <PreviewModal isOpen={isPreviewMode} onClose={() => setIsPreviewMode(false)} meta={meta} passage={previewPassage} />
        )}
      </AnimatePresence>

    </div>
  );
}
