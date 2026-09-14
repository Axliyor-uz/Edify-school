'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma (masalan: Choose the correct letter, A, B, C or D...)",
    questionPh: "Savol matni... (Savol + variantlarni shu yerga joylashtirib ko'ring!)",
    optionPh: (id: string) => `Variant ${id}...`,
    addOption: "Variant qo'shish",
    correctAnswer: "To'g'ri javob:",
    refPh: "Ref (ixt)",
    addQuestion: "Savol qo'shish",
  },
  en: {
    instructionsPh: "Instructions (e.g. Choose the correct letter, A, B, C or D...)",
    questionPh: "Question text... (Try pasting question + options here!)",
    optionPh: (id: string) => `Option ${id}...`,
    addOption: "Add Option",
    correctAnswer: "Correct Answer:",
    refPh: "Ref (opt)",
    addQuestion: "Add Question",
  },
  ru: {
    instructionsPh: "Инструкция (например: Choose the correct letter, A, B, C or D...)",
    questionPh: "Текст вопроса... (Попробуйте вставить сюда вопрос с вариантами!)",
    optionPh: (id: string) => `Вариант ${id}...`,
    addOption: "Добавить вариант",
    correctAnswer: "Правильный ответ:",
    refPh: "Ref (необяз.)",
    addQuestion: "Добавить вопрос",
  },
};

export default function MultipleChoiceBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  
  // ==========================================================================
  // ROW & OPTION HANDLERS
  // ==========================================================================
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
      options: [
        { id: 'A', text: '' }, { id: 'B', text: '' }, 
        { id: 'C', text: '' }, { id: 'D', text: '' }
      ],
      correct_answer: ['A'], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const updateOption = (rIdx: number, oIdx: number, val: string) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].options[oIdx].text = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Dynamically add an option (E, F, G...)
  const addOption = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    const opts = updatedQs[rIdx].options;
    const nextId = String.fromCharCode(65 + opts.length); // 65 is 'A'
    opts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Delete an option and mathematically recalculate letters
  const removeOption = (rIdx: number, oIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].options.splice(oIdx, 1);
    
    // Auto-recalculate IDs so it's always A, B, C, D
    updatedQs[rIdx].options.forEach((opt: any, i: number) => {
      opt.id = String.fromCharCode(65 + i);
    });

    // Fallback if the correct answer was the deleted option
    const currentAns = updatedQs[rIdx].correct_answer[0];
    if (!updatedQs[rIdx].options.find((o: any) => o.id === currentAns)) {
      updatedQs[rIdx].correct_answer = [updatedQs[rIdx].options[0]?.id || 'A'];
    }

    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 🌟 ULTRA-SMART PASTE ENGINE
  // ==========================================================================
  const handleSmartPaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Normal paste
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    // Line 0 is the question text (strip leading numbers like "11. ")
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    const newOptions = [];
    for (let i = 1; i < lines.length; i++) {
      // Strip leading A., B), etc. from the options
      const optText = lines[i].replace(/^[a-eA-E][\.\)]\s*/, '');
      newOptions.push({
        id: String.fromCharCode(65 + newOptions.length),
        text: optText
      });
    }

    const updatedQs = [...qb.questions];
    updatedQs[rIdx].question_text = qText;
    
    if (newOptions.length > 0) {
      updatedQs[rIdx].options = newOptions;
      // Ensure the correct answer maps to a valid option
      if (!newOptions.find(o => o.id === updatedQs[rIdx].correct_answer[0])) {
        updatedQs[rIdx].correct_answer = [newOptions[0].id];
      }
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">

      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            MULTIPLE CHOICE
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs:
            <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            -
            <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS */}
        <input 
          type="text" placeholder={t.instructionsPh}
          value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none mb-4 p-0"
        />
        
        {/* 2. QUESTIONS LIST */}
        <div className="space-y-4">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="bg-surface-container rounded-m3-sm p-3 border border-outline-variant relative group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)]">

              <div className="flex gap-2 mb-3">
                <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-inverse-on-surface bg-inverse-surface rounded-m3-xs shadow-elev-1 shrink-0">
                  {row.question_number}
                </span>
                <input 
                  type="text" placeholder={t.questionPh}
                  value={row.question_text} 
                  onChange={e => updateRow(rIdx, 'question_text', e.target.value)} 
                  onPaste={e => handleSmartPaste(e, rIdx)}
                  className="flex-1 h-7 text-[13px] font-bold bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:font-normal placeholder:text-on-surface-variant"
                />
              </div>

              {/* DYNAMIC OPTIONS */}
              <div className="pl-10 space-y-1.5 mb-3">
                {row.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-on-surface-variant w-4">{opt.id}.</span>
                    <input
                      type="text" placeholder={t.optionPh(opt.id)} value={opt.text}
                      onChange={e => updateOption(rIdx, oIdx, e.target.value)}
                      className="flex-1 h-6 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                    />
                    <button
                      onClick={() => removeOption(rIdx, oIdx)}
                      disabled={row.options.length <= 2} // Minimum 2 options
                      className="text-outline hover:text-error disabled:opacity-0 transition-colors shrink-0"
                    >
                      <X size={14}/>
                    </button>
                  </div>
                ))}
                
                <Button variant="text" size="sm" icon={<Plus />} onClick={() => addOption(rIdx)} className="mt-1 ml-3.5">
                  {t.addOption}
                </Button>
              </div>

              {/* 3. BOTTOM BAR (Correct Answer & Ref) */}
              <div className="pl-10 flex items-center gap-3">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t.correctAnswer}</span>
                <select
                  value={row.correct_answer[0] || 'A'}
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])}
                  className="w-16 h-7 text-[11px] font-black bg-surface-container-lowest border border-outline-variant rounded-m3-xs outline-none text-success focus:border-primary cursor-pointer text-center"
                >
                  {row.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>

                <input
                  type="text" placeholder={t.refPh}
                  value={row.passage_reference || ''}
                  onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                  className={`w-14 h-7 text-[10px] text-center font-bold rounded-m3-xs outline-none uppercase shrink-0 transition-colors
                    ${row.passage_reference
                      ? 'bg-primary-container border border-transparent text-on-primary-container focus:border-primary'
                      : 'bg-transparent border border-dashed border-outline text-on-surface-variant placeholder:text-outline hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
                />
              </div>

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="absolute top-3 right-3 text-outline hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addQuestion}
        </Button>
      </div>
    </div>
  );
}