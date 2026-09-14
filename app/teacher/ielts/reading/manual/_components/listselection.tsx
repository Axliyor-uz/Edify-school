'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma (masalan: Choose TWO letters, A-E)...",
    promptPh: "Savol matni... (Savol + variantlarni shu yerga joylashtirib ko'ring!)",
    optionPh: (id: string) => `Variant ${id}...`,
    addChoice: "Variant qo'shish",
    correctAnswers: "To'g'ri javoblar:",
    answersPh: "masalan: B, D",
    refPh: "Matn manbasi (ixt)",
  },
  en: {
    instructionsPh: "Instructions (e.g. Choose TWO letters, A-E)...",
    promptPh: "Question prompt... (Try pasting question + options here!)",
    optionPh: (id: string) => `Option ${id}...`,
    addChoice: "Add Choice",
    correctAnswers: "Correct Answers:",
    answersPh: "e.g. B, D",
    refPh: "Passage Ref (opt)",
  },
  ru: {
    instructionsPh: "Инструкция (например: Choose TWO letters, A-E)...",
    promptPh: "Текст вопроса... (Попробуйте вставить сюда вопрос с вариантами!)",
    optionPh: (id: string) => `Вариант ${id}...`,
    addChoice: "Добавить вариант",
    correctAnswers: "Правильные ответы:",
    answersPh: "напр.: B, D",
    refPh: "Ссылка на текст (необяз.)",
  },
};

export default function ListSelectionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  // List Selection usually has exactly 1 "question" object that covers multiple numbers.
  const row = qb.questions[0]; 

  // ==========================================================================
  // 1. LOCAL STATE FIX (For Smooth Comma Typing)
  // ==========================================================================
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    const finalArr = arr.length ? arr : ['A']; // Fallback to avoid empty breaking
    
    const updatedQs = [...qb.questions];
    updatedQs[0].correct_answer = finalArr;
    updateBlock(qbIdx, 'questions', updatedQs);
    
    setAnsText(finalArr.join(', ')); // Clean up the UI
  };

  // ==========================================================================
  // ROW & OPTION HANDLERS
  // ==========================================================================
  const updateField = (key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[0][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const updateOption = (oIdx: number, val: string) => {
    const updatedQs = [...qb.questions];
    updatedQs[0].options[oIdx].text = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const removeOption = (oIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs[0].options.splice(oIdx, 1);
    
    // Auto-recalculate IDs so it's always A, B, C, D...
    updatedQs[0].options.forEach((opt: any, i: number) => {
      opt.id = String.fromCharCode(65 + i);
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addOption = () => {
    const updatedQs = [...qb.questions];
    const nextId = String.fromCharCode(65 + updatedQs[0].options.length);
    updatedQs[0].options.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 2. ULTRA-SMART PASTE ENGINE
  // ==========================================================================
  const handleSmartPaste = (e: any) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Normal paste if no newlines
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    // Line 0 is the question text
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    const newOptions = [];
    for (let i = 1; i < lines.length; i++) {
      const optText = lines[i].replace(/^[a-zA-Z][\.\)]\s*/, '');
      newOptions.push({
        id: String.fromCharCode(65 + newOptions.length),
        text: optText
      });
    }

    const updatedQs = [...qb.questions];
    updatedQs[0].question_text = qText;
    if (newOptions.length > 0) {
      updatedQs[0].options = newOptions;
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            LIST SELECTION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs:
            <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            -
            <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error opacity-0 group-hover/block:opacity-100 transition-colors">
          <Trash2 size={14}/>
        </button>
      </div>

      <div className="p-3">
        <input
          type="text" placeholder={t.instructionsPh}
          value={qb.instructions}
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
          className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none mb-3 p-0"
        />

        <div className="bg-surface-container rounded-m3-sm p-3 border border-outline-variant relative transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)]">

          {/* QUESTION TEXT */}
          <div className="flex gap-2 mb-3">
            <input
              type="text" placeholder={t.promptPh}
              value={row.question_text}
              onChange={e => updateField('question_text', e.target.value)}
              onPaste={handleSmartPaste}
              className="flex-1 h-8 text-[13px] font-bold bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-3 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:font-normal placeholder:text-on-surface-variant"
            />
          </div>

          {/* OPTIONS MAPPING */}
          <div className="pl-2 space-y-1.5 mb-4">
            {row.options.map((opt: any, oIdx: number) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-on-surface-variant w-4">{opt.id}.</span>
                <input
                  type="text" placeholder={t.optionPh(opt.id)}
                  value={opt.text}
                  onChange={e => updateOption(oIdx, e.target.value)}
                  className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                />
                <button
                  onClick={() => removeOption(oIdx)}
                  disabled={row.options.length <= 2}
                  className="text-on-surface-variant hover:text-error disabled:opacity-0 transition-colors shrink-0"
                >
                  <X size={14}/>
                </button>
              </div>
            ))}
            <Button variant="text" size="sm" icon={<Plus />} onClick={addOption} className="mt-2">
              {t.addChoice}
            </Button>
          </div>

          {/* BOTTOM BAR (ANSWERS & REFERENCE) */}
          <div className="flex items-center gap-3 bg-surface-container-lowest p-2 border border-outline-variant rounded-m3-sm">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t.correctAnswers}</span>

            <input
              type="text" placeholder={t.answersPh}
              value={ansText}
              onChange={e => setAnsText(e.target.value)}
              onBlur={handleAnsBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
              className="w-24 h-7 text-[11px] font-black bg-transparent border-b border-outline outline-none text-success focus:border-primary text-center uppercase"
            />

            <div className="flex-1 border-l border-outline-variant pl-3">
              <input
                type="text" placeholder={t.refPh}
                value={row.passage_reference || ''}
                onChange={e => updateField('passage_reference', e.target.value.toUpperCase())}
                className={`w-full h-7 text-[10px] font-bold rounded-m3-sm outline-none uppercase transition-colors px-2
                  ${row.passage_reference
                    ? 'bg-secondary-container border border-transparent text-on-secondary-container focus:border-primary'
                    : 'bg-transparent text-on-surface-variant placeholder:text-on-surface-variant focus:text-secondary'}`}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}