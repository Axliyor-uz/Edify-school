'use client';

// The IELTS reading builder, extracted from manual/page.tsx so the teacher page is a thin
// wrapper and the admin platform panel can reuse it (`asPlatform` writes teacherId: null +
// source: 'platform' via saveIeltsTest). Drafts are per-test:
//   ielts_reading_draft_new           — new test in progress (teacher)
//   ielts_reading_draft_{testId}      — unsaved edit of an existing test
//   ielts_platform_reading_draft_*    — same namespace for the admin panel
// which fixes the documented edit-flow clobber hack.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, CheckCircle, Settings2, LayoutGrid, Eye, ArrowUp, ArrowDown, X, FileText, ListChecks } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { saveIeltsTest, loadTestForEdit } from '@/services/ieltsService';
import type { IeltsReadingTest } from '@/lib/ielts/types';
import { Button, IconButton, StatusChip, EmptyState, Spinner } from '@/components/ui';

// ============================================================================
// COMPONENT IMPORTS
// ============================================================================
import PassagePane from './passsage';
import TFNGBlock from './truefalseng';
import MultipleChoiceBlock from './multiplechoice';
import SummaryCompletionBlock from './summarycompletion';
import MatchingHeadingsBlock from './matchingheadings';
import SentenceCompletionBlock from './sentencecompletion';
import MatchingParagraphInfoBlock from './matchingparagraphinfo';
import ShortAnswerBlock from './shortanswer';
import MatchingFeaturesBlock from './matchingfeatures';
import MatchingSentenceEndingsBlock from './matchingsentenceendings';
import ListSelectionBlock from './listselection';
import TableCompletionBlock from './tablecompletion';
import FlowchartCompletionBlock from './flowchartcompletion';
import DiagramCompletionBlock from './diagramcompletion';
import PreviewModal from './preview';
import BlockExtras from './blockextras';

const T = {
  uz: {
    setup: "Yangi Test", desc: "Test parametrlarini kiriting",
    title: "Test nomi (masalan: Cambridge 18 Test 1)", time: "Vaqt (daq)", next: "Boshlash",
    save: "Saqlash", saving: "Saqlanmoqda...", addBlock: "Yangi Savol Qo'shish", preview: "Ko'zdan kechirish",
    back: "Ortga", labelTitle: "Test nomi", labelTime: "Vaqt chegarasi",
    labelCategory: "Test turi", categoryAcademic: "Academic", categoryGeneral: "General Training",
    deletePassageConfirm: "Haqiqatan ham bu matnni o'chirmoqchimisiz?",
    deletePassageTitle: "Matnni o'chirish",
    noQuestions: "Hozircha savollar qo'shilmagan.",
    selectType: "Savol turini tanlang",
    errNoTitle: "Test nomini kiriting!",
    errNoPassageTitle: (n: number) => `Passage ${n}: Sarlavha kiritilmagan!`,
    errNoInstructions: (n: number) => `Passage ${n}: Yo'riqnoma kiritilmagan!`,
    errNoAnswer: (n: number, q: string | number) => `Passage ${n}, Savol ${q}: To'g'ri javob kiritilmagan!`,
    saveSuccess: "Test muvaffaqiyatli saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi!",
    loading: "Test yuklanmoqda...",
    loadError: "Testni yuklashda xatolik!",
    paneText: "Matn", paneQuestions: "Savollar",
  },
  en: {
    setup: "New Test", desc: "Initialize test parameters",
    title: "Test Title (e.g. Cambridge 18 Test 1)", time: "Time (mins)", next: "Initialize",
    save: "Save", saving: "Saving...", addBlock: "Add Question Block", preview: "Preview",
    back: "Back", labelTitle: "Test Title", labelTime: "Time Limit",
    labelCategory: "Test category", categoryAcademic: "Academic", categoryGeneral: "General Training",
    deletePassageConfirm: "Are you sure you want to delete this passage?",
    deletePassageTitle: "Delete Passage",
    noQuestions: "No questions added yet.",
    selectType: "Select Question Type",
    errNoTitle: "Enter a test title!",
    errNoPassageTitle: (n: number) => `Passage ${n}: title is missing!`,
    errNoInstructions: (n: number) => `Passage ${n}: instructions are missing!`,
    errNoAnswer: (n: number, q: string | number) => `Passage ${n}, Question ${q}: correct answer is missing!`,
    saveSuccess: "Test saved successfully!",
    saveError: "Failed to save!",
    loading: "Loading the test...",
    loadError: "Failed to load the test!",
    paneText: "Passage", paneQuestions: "Questions",
  },
  ru: {
    setup: "Новый тест", desc: "Введите параметры теста",
    title: "Название теста (например: Cambridge 18 Test 1)", time: "Время (мин)", next: "Начать",
    save: "Сохранить", saving: "Сохранение...", addBlock: "Добавить блок вопросов", preview: "Предпросмотр",
    back: "Назад", labelTitle: "Название теста", labelTime: "Лимит времени",
    labelCategory: "Тип теста", categoryAcademic: "Academic", categoryGeneral: "General Training",
    deletePassageConfirm: "Вы действительно хотите удалить этот текст?",
    deletePassageTitle: "Удалить текст",
    noQuestions: "Вопросы пока не добавлены.",
    selectType: "Выберите тип вопроса",
    errNoTitle: "Введите название теста!",
    errNoPassageTitle: (n: number) => `Passage ${n}: не указан заголовок!`,
    errNoInstructions: (n: number) => `Passage ${n}: не указана инструкция!`,
    errNoAnswer: (n: number, q: string | number) => `Passage ${n}, вопрос ${q}: не указан правильный ответ!`,
    saveSuccess: "Тест успешно сохранён!",
    saveError: "Ошибка при сохранении!",
    loading: "Тест загружается...",
    loadError: "Не удалось загрузить тест!",
    paneText: "Текст", paneQuestions: "Вопросы",
  }
};

const LEGACY_DRAFT_KEY = 'ielts_reading_draft';

interface ReadingBuilderProps {
  asPlatform?: boolean;
  backHref?: string;
  /** When set, the builder loads this test (draft first, then Firestore via loadTestForEdit). */
  editTestId?: string;
}

const emptyPassage = (n: number) => ({
  id: n === 1 ? 'passage_1' : `p_${Date.now()}`, passage_number: n, title: '', instruction: '',
  blocks: [{ type: 'text', label: 'A', content: '' }],
  questions: [] as any[],
});

export default function ReadingBuilder({ asPlatform = false, backHref, editTestId }: ReadingBuilderProps) {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T.uz;
  const listHref = backHref || '/teacher/ielts/reading';

  const draftKey = `${asPlatform ? 'ielts_platform_reading_draft' : 'ielts_reading_draft'}_${editTestId || 'new'}`;

  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editTestId);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mobilePane, setMobilePane] = useState<'left' | 'right'>('left');

  const [meta, setMeta] = useState({ id: '', title: '', time: 60, category: 'academic' as 'academic' | 'general' });
  const [passages, setPassages] = useState<any[]>([emptyPassage(1)]);
  const hydrated = useRef(false);

  const [leftWidth, setLeftWidth] = useState(50);
  const isDragging = useRef(false);

  // ==========================================================================
  // DRAG TO RESIZE ENGINE (desktop split-pane)
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
  // AUTO-CALCULATE TOTAL QUESTIONS ACROSS ALL PASSAGES
  // ==========================================================================
  const totalQuestionsCount = passages.reduce((acc, p) => {
    return acc + p.questions.reduce((qAcc: number, qb: any) => {
      if (qb.type === 'list_selection') {
        return qAcc + qb.questions.reduce((lAcc: number, r: any) =>
          lAcc + Math.max(1, Array.isArray(r.correct_answer) ? r.correct_answer.length : 1), 0);
      }
      return qAcc + (qb.questions ? qb.questions.length : 0);
    }, 0);
  }, 0);

  // ==========================================================================
  // DRAFT RESTORE / EDIT LOAD (per-test key — no cross-test clobbering)
  // ==========================================================================
  useEffect(() => {
    let cancelled = false;

    const restoreDraft = (raw: string | null): boolean => {
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.meta && parsed.passages) {
          setMeta({ category: 'academic', ...parsed.meta });
          setPassages(parsed.passages);
          return true;
        }
      } catch (e) {
        console.error('Draft parsing failed', e);
      }
      return false;
    };

    const init = async () => {
      // 1. An unsaved draft for THIS test (or this new-test session) wins.
      if (restoreDraft(localStorage.getItem(draftKey))) {
        hydrated.current = true;
        setIsLoadingEdit(false);
        return;
      }
      if (editTestId) {
        // 2. Edit flow: load the saved doc (answers re-inlined from ielts_answer_keys).
        try {
          const test = await loadTestForEdit('reading', editTestId) as IeltsReadingTest;
          if (cancelled) return;
          setMeta({
            id: test.test_id || editTestId,
            title: test.test_title || '',
            time: test.total_time_minutes || 60,
            category: (test.test_category as 'academic' | 'general') || 'academic',
          });
          setPassages((test.passages as any[])?.length ? (test.passages as any[]) : [emptyPassage(1)]);
        } catch (e) {
          console.error('Edit load failed', e);
          toast.error(t.loadError);
          router.replace(listHref);
          return;
        } finally {
          if (!cancelled) setIsLoadingEdit(false);
        }
      } else if (!asPlatform) {
        // 3. One-time migration from the old shared draft key.
        if (restoreDraft(localStorage.getItem(LEGACY_DRAFT_KEY))) {
          localStorage.removeItem(LEGACY_DRAFT_KEY);
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
      localStorage.setItem(draftKey, JSON.stringify({ meta, passages }));
    }
  }, [meta, passages, draftKey]);

  // ==========================================================================
  // GLOBAL AUTO-NUMBERING ENGINE
  // ==========================================================================
  useEffect(() => {
    let globalCounter = 1;
    let needsUpdate = false;
    const newPassages = JSON.parse(JSON.stringify(passages));

    newPassages.forEach((passage: any) => {
      passage.questions.forEach((qb: any) => {
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

          if (qb.start_question !== expectedStart) {
            qb.start_question = expectedStart;
            needsUpdate = true;
          }
          if (qb.end_question !== expectedEnd) {
            qb.end_question = expectedEnd;
            needsUpdate = true;
          }
        }
      });
    });

    if (needsUpdate) setPassages(newPassages);
  }, [passages]);

  // ==========================================================================
  // UPDATERS & STATE MANAGEMENT
  // ==========================================================================
  const updateActivePassage = (key: string, val: any) => {
    const updated = [...passages];
    updated[activeTab][key] = val;
    setPassages(updated);
  };

  const updateBlock = (qbIdx: number, key: string, val: any) => {
    const q = [...passages[activeTab].questions];
    q[qbIdx][key] = val;
    updateActivePassage('questions', q);
  };

  const deleteBlock = (qbIdx: number) => {
    const q = [...passages[activeTab].questions];
    q.splice(qbIdx, 1);
    updateActivePassage('questions', q);
  };

  const deletePassage = (idx: number) => {
    if (passages.length <= 1) return;
    if (!confirm(t.deletePassageConfirm)) return;

    const newPassages = [...passages];
    newPassages.splice(idx, 1);
    newPassages.forEach((p, i) => { p.passage_number = i + 1; });
    setPassages(newPassages);

    if (activeTab >= newPassages.length) {
      setActiveTab(newPassages.length - 1);
    } else if (activeTab > idx) {
      setActiveTab(activeTab - 1);
    }
  };

  const moveBlockUp = (qbIdx: number) => {
    if (qbIdx === 0) return;
    const q = [...passages[activeTab].questions];
    [q[qbIdx - 1], q[qbIdx]] = [q[qbIdx], q[qbIdx - 1]];
    updateActivePassage('questions', q);
  };

  const moveBlockDown = (qbIdx: number) => {
    const q = [...passages[activeTab].questions];
    if (qbIdx === q.length - 1) return;
    [q[qbIdx + 1], q[qbIdx]] = [q[qbIdx], q[qbIdx + 1]];
    updateActivePassage('questions', q);
  };

  const addBlock = (type: string) => {
    const q = [...passages[activeTab].questions];
    let newBlock: any = { type, start_question: 1, end_question: 1 };

    switch (type) {
      case 'true_false_not_given':
        newBlock = { ...newBlock, instructions: 'Do the following statements agree with the information given?', options: [{ label: 'TRUE', description: 'if the statement agrees' }, { label: 'FALSE', description: 'if the statement contradicts' }, { label: 'NOT GIVEN', description: 'if there is no information' }], questions: [{ question_number: 0, statement: '', correct_answer: 'TRUE', passage_reference: '' }] };
        break;
      case 'multiple_choice':
        newBlock = { ...newBlock, instructions: 'Choose the correct letter, A, B, C or D.', questions: [{ question_number: 0, question_text: '', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }], correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'summary_completion':
        newBlock = { ...newBlock, instructions: 'Complete the summary below. Choose NO MORE THAN TWO WORDS.', summary_title: '', summary_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_headings':
        newBlock = { ...newBlock, instructions: 'Choose the correct heading for paragraphs.', options: [{ id: 'i', text: '' }, { id: 'ii', text: '' }], questions: [{ question_number: 0, target_paragraph: '', correct_answer: '' }] };
        break;
      case 'sentence_completion':
        newBlock = { ...newBlock, instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS.', questions: [{ question_number: 0, sentence: '... [0] ...', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_paragraph_information':
        newBlock = { ...newBlock, instructions: 'Which paragraph contains the following information?', options: ['A', 'B', 'C', 'D'], questions: [{ question_number: 0, statement: '', correct_answer: 'A' }] };
        break;
      case 'short_answer':
        newBlock = { ...newBlock, instructions: 'Answer the questions below. Choose NO MORE THAN TWO WORDS.', questions: [{ question_number: 0, question_text: '', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_features':
        newBlock = { ...newBlock, instructions: 'Classify the following statements.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, statement: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'matching_sentence_endings':
        newBlock = { ...newBlock, instructions: 'Complete each sentence with the correct ending.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, sentence_start: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'list_selection':
        newBlock = { ...newBlock, instructions: 'Choose TWO letters, A-E.', questions: [{ question_number: 0, question_text: 'Which TWO things are mentioned?', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }], correct_answer: ['A', 'B'], passage_reference: '' }] };
        break;
      case 'table_completion':
        newBlock = { ...newBlock, instructions: 'Complete the table below.', table_title: '', options: null, headers: ['Header 1', 'Header 2'], rows: [{ cells: ['', ''] }], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'flowchart_completion':
        newBlock = { ...newBlock, instructions: 'Complete the flow-chart below.', flowchart_title: '', options: null, steps: ['Step 1 with [0]'], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'diagram_completion':
        newBlock = { ...newBlock, instructions: 'Label the diagram below.', diagram_title: '', diagram_url: '', diagram_alt_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
    }

    q.push(newBlock);
    updateActivePassage('questions', q);
    setShowAddMenu(false);

    setTimeout(() => {
      const container = document.getElementById('questions-container');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const validateTest = () => {
    if (!meta.title.trim()) { toast.error(t.errNoTitle); return false; }
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      if (!p.title?.trim()) { setActiveTab(i); toast.error(t.errNoPassageTitle(p.passage_number)); return false; }
      for (let j = 0; j < p.questions.length; j++) {
        const qb = p.questions[j];
        if (!qb.instructions?.trim()) { setActiveTab(i); toast.error(t.errNoInstructions(p.passage_number)); return false; }
        for (let k = 0; k < qb.questions.length; k++) {
          const q = qb.questions[k];
          let isAnswerMissing = false;
          if (Array.isArray(q.correct_answer)) {
            if (q.correct_answer.length === 0 || q.correct_answer.every((a: string) => !a.trim())) isAnswerMissing = true;
          } else if (!q.correct_answer || !String(q.correct_answer).trim()) {
            isAnswerMissing = true;
          }
          if (isAnswerMissing) { setActiveTab(i); toast.error(t.errNoAnswer(p.passage_number, q.question_number || '?')); return false; }
        }
      }
    }
    return true;
  };

  // Strip empty optional fields so we never write undefined/empty junk to Firestore.
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
        module: 'reading' as const,
        total_time_minutes: meta.time,
        total_questions: totalQuestionsCount,
        test_category: meta.category || 'academic',
        passages: passages.map((p) => {
          const wordCount = p.blocks.reduce((total: number, block: any) => total + (block.content || '').split(/\s+/).filter(Boolean).length, 0);
          const baseSlug = p.title ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') : 'passage';
          return {
            id: `${baseSlug}_p${p.passage_number}`, module: 'reading', passage_number: p.passage_number,
            title: p.title, subtitle: p.subtitle || '', instruction: p.instruction || '',
            word_count: wordCount, difficulty: p.difficulty || 'medium',
            blocks: p.blocks, questions: sanitizeQuestionBlocks(p.questions),
          };
        }),
      };

      await saveIeltsTest(finalPayload as unknown as IeltsReadingTest, asPlatform ? { asPlatform: true } : undefined);
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
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">{t.labelCategory}</label>
                  <div className="flex p-1 bg-surface-container rounded-m3-md border border-outline-variant gap-1">
                    {(['academic', 'general'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMeta({ ...meta, category: cat })}
                        className={`flex-1 py-2 text-[12px] font-bold rounded-m3-sm transition-all ${meta.category === cat ? 'bg-surface-container-lowest text-primary shadow-elev-1 border border-outline-variant' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        {cat === 'academic' ? t.categoryAcademic : t.categoryGeneral}
                      </button>
                    ))}
                  </div>
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
                  {passages.map((p, idx) => (
                    <div key={p.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-m3-sm transition-all group/tab relative ${activeTab === idx ? 'bg-surface-container-lowest text-primary shadow-elev-1 border border-outline-variant' : 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface'}`}>
                      <button onClick={() => setActiveTab(idx)} className="text-[11px] font-black uppercase tracking-wider">
                        Passage {p.passage_number}
                      </button>

                      {passages.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePassage(idx); }}
                          className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors
                            ${activeTab === idx ? 'text-on-surface-variant hover:bg-error-container hover:text-on-error-container' : 'opacity-0 group-hover/tab:opacity-100 text-on-surface-variant hover:bg-error-container hover:text-on-error-container'}`}
                          title={t.deletePassageTitle}
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                  {passages.length < 3 && (
                    <button onClick={() => setPassages([...passages, { id: `p_${Date.now()}`, passage_number: passages.length + 1, title: '', instruction: '', blocks: [{ type: 'text', label: 'A', content: '' }], questions: [] }])} className="w-6 h-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors ml-1"><Plus size={14}/></button>
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

            {/* Mobile: passage tab strip + pane toggle */}
            <div className="md:hidden flex-none bg-surface-container-low border-b border-outline-variant px-3 py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {passages.map((p, idx) => (
                  <button key={p.id} onClick={() => setActiveTab(idx)} className={`px-2 py-1 rounded-m3-sm text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
                    P{p.passage_number}
                  </button>
                ))}
                {passages.length < 3 && (
                  <button onClick={() => setPassages([...passages, { id: `p_${Date.now()}`, passage_number: passages.length + 1, title: '', instruction: '', blocks: [{ type: 'text', label: 'A', content: '' }], questions: [] }])} className="w-6 h-6 flex items-center justify-center text-on-surface-variant"><Plus size={12}/></button>
                )}
              </div>
              <div className="flex p-0.5 bg-surface-container rounded-m3-sm border border-outline-variant gap-0.5 shrink-0">
                <button onClick={() => setMobilePane('left')} className={`px-2.5 py-1 rounded-m3-sm text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${mobilePane === 'left' ? 'bg-surface-container-lowest text-primary shadow-elev-1' : 'text-on-surface-variant'}`}>
                  <FileText size={11} /> {t.paneText}
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
                <PassagePane passage={passages[activeTab]} update={updateActivePassage} />
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

                  {passages[activeTab].questions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center pb-20">
                       <EmptyState icon={<LayoutGrid strokeWidth={1.5} />} title={t.noQuestions} />
                    </div>
                  ) : (
                    passages[activeTab].questions.map((qb: any, qbIdx: number) => {
                      const props = { qb, qbIdx, updateBlock, deleteBlock };
                      return (
                        <div key={qbIdx} className="relative group/wrapper">

                          <div className="absolute -left-10 top-2 opacity-0 group-hover/wrapper:opacity-100 flex flex-col gap-1 transition-opacity z-10">
                            <button onClick={() => moveBlockUp(qbIdx)} disabled={qbIdx === 0} className="p-1.5 bg-surface-container-lowest border border-outline-variant rounded-m3-sm shadow-elev-1 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowUp size={14}/></button>
                            <button onClick={() => moveBlockDown(qbIdx)} disabled={qbIdx === passages[activeTab].questions.length - 1} className="p-1.5 bg-surface-container-lowest border border-outline-variant rounded-m3-sm shadow-elev-1 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowDown size={14}/></button>
                          </div>

                          {qb.type === 'true_false_not_given' && <TFNGBlock {...props} />}
                          {qb.type === 'multiple_choice' && <MultipleChoiceBlock {...props} />}
                          {qb.type === 'summary_completion' && <SummaryCompletionBlock {...props} />}
                          {qb.type === 'matching_headings' && <MatchingHeadingsBlock {...props} />}
                          {qb.type === 'sentence_completion' && <SentenceCompletionBlock {...props} />}
                          {qb.type === 'matching_paragraph_information' && <MatchingParagraphInfoBlock {...props} />}
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
                            {[
                              { type: 'matching_headings', label: 'Matching Headings' },
                              { type: 'true_false_not_given', label: 'True/False/Not Given' },
                              { type: 'multiple_choice', label: 'Multiple Choice' },
                              { type: 'summary_completion', label: 'Summary Completion' },
                              { type: 'matching_paragraph_information', label: 'Match Paragraph Info' },
                              { type: 'list_selection', label: 'List Selection' },
                              { type: 'matching_features', label: 'Matching Features' },
                              { type: 'sentence_completion', label: 'Sentence Completion' },
                              { type: 'matching_sentence_endings', label: 'Match Sentence Endings' },
                              { type: 'short_answer', label: 'Short Answer' },
                              { type: 'table_completion', label: 'Table Completion' },
                              { type: 'flowchart_completion', label: 'Flowchart Completion' },
                              { type: 'diagram_completion', label: 'Diagram Labeling' }
                            ].map((item) => (
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
          <PreviewModal isOpen={isPreviewMode} onClose={() => setIsPreviewMode(false)} meta={meta} passage={passages[activeTab]} />
        )}
      </AnimatePresence>

    </div>
  );
}
