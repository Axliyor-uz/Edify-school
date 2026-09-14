'use client';

import { Plus, Trash2, X, Wand2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    questionPh: "To'g'ridan-to'g'ri savolni yozing... (Raqamlangan ro'yxatni joylashtirib ko'ring!)",
    answersPh: "Qabul qilinadigan javoblar (vergul bilan ajrating)",
    refPh: "Ref (ixt)",
    instructionsPh: "Yo'riqnoma (masalan: Answer the questions below. Choose NO MORE THAN TWO WORDS...)",
    addQuestion: "Savol qo'shish",
  },
  en: {
    questionPh: "Type the direct question... (Try pasting a numbered list here!)",
    answersPh: "Accepted Answers (comma separated)",
    refPh: "Ref (opt)",
    instructionsPh: "Instructions (e.g. Answer the questions below. Choose NO MORE THAN TWO WORDS...)",
    addQuestion: "Add Question",
  },
  ru: {
    questionPh: "Введите вопрос... (Попробуйте вставить нумерованный список!)",
    answersPh: "Допустимые ответы (через запятую)",
    refPh: "Ref (необяз.)",
    instructionsPh: "Инструкция (например: Answer the questions below. Choose NO MORE THAN TWO WORDS...)",
    addQuestion: "Добавить вопрос",
  },
};

// ==========================================================================
// INDIVIDUAL ROW COMPONENT (Fixes the Comma Typing Issue)
// ==========================================================================
const QuestionRow = ({ row, rIdx, updateRow, deleteRow, totalRows, handleSmartPaste, addRow, t }: any) => {
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', ')); 
  };

  return (
    <div className="bg-surface-container rounded-m3-sm p-2 border border-outline-variant relative group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)]">

      <div className="flex items-start gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0 mt-0.5">
          {row.question_number}
        </span>
        
        <textarea 
          placeholder={t.questionPh}
          value={row.question_text} 
          onChange={e => { 
            updateRow(rIdx, 'question_text', e.target.value); 
            e.target.style.height = 'auto'; 
            e.target.style.height = e.target.scrollHeight + 'px'; 
          }}
          onPaste={e => handleSmartPaste(e, rIdx)}
          onKeyDown={(e) => { 
            if (e.key === 'Enter' && !e.shiftKey && rIdx === totalRows - 1) { 
              e.preventDefault(); 
              addRow(); 
            } 
          }}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 py-1.5 text-[12px] font-medium text-on-surface outline-none resize-none overflow-hidden min-h-[32px] focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary leading-relaxed placeholder:font-normal placeholder:text-on-surface-variant"
          rows={1}
        />
      </div>

      <div className="pl-8 flex items-center gap-2">
        <input
          type="text" placeholder={t.answersPh}
          value={ansText}
          onChange={e => setAnsText(e.target.value)}
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[11px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary font-medium placeholder:text-on-surface-variant"
        />

        {/* GHOST REFERENCE INPUT */}
        <input
          type="text" placeholder={t.refPh}
          value={row.passage_reference || ''}
          onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())}
          className={`w-14 h-7 text-[10px] text-center font-bold rounded-m3-sm outline-none uppercase shrink-0 transition-colors
            ${row.passage_reference
              ? 'bg-primary-container border border-transparent text-on-primary-container focus:border-primary'
              : 'bg-transparent border border-dashed border-outline text-on-surface-variant placeholder:text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
        />

        <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
      </div>

    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function ShortAnswerBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ 
      question_number: 0, 
      question_text: '', 
      correct_answer: [''], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 🌟 OMNI-PASTE ENGINE FOR QUESTIONS
  // ==========================================================================
  const handleSmartPaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Let normal paste happen
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    const updatedQs = [...qb.questions];
    
    // Line 0 replaces current input, strip starting numbers if they exist
    updatedQs[rIdx].question_text = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    // Remaining lines spawn new inputs
    for (let i = 1; i < lines.length; i++) {
      const cleanLine = lines[i].replace(/^\d+[\.\)]\s*/, '');
      updatedQs.splice(rIdx + i, 0, { 
        question_number: 0, 
        question_text: cleanLine, 
        correct_answer: [''], 
        passage_reference: '' 
      });
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            SHORT ANSWER
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
        {/* INSTRUCTIONS */}
        <div className="relative mb-3">
          <input
            type="text" placeholder={t.instructionsPh}
            value={qb.instructions}
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
            className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none p-0 pr-6"
          />
          <Wand2 className="absolute right-0 top-0 text-primary" size={14} />
        </div>
        
        {/* 2. QUESTIONS GRID */}
        <div className="space-y-3">
          {qb.questions.map((row: any, rIdx: number) => (
            <QuestionRow 
              key={rIdx} 
              row={row} 
              rIdx={rIdx} 
              updateRow={updateRow} 
              deleteRow={deleteRow} 
              totalRows={qb.questions.length}
              handleSmartPaste={handleSmartPaste}
              addRow={addRow}
              t={t}
            />
          ))}
        </div>
        
        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addQuestion}
        </Button>
      </div>
    </div>
  );
}