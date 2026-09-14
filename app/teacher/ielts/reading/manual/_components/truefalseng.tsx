'use client';

import { Plus, Trash2, X, Repeat, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    toggleVariant: "YES/NO/NOT GIVEN turiga o'zgartirish",
    instructionsPh: "Yo'riqnoma (masalan: Do the following statements agree...)",
    hideOptions: "Variant tavsiflarini yashirish",
    editOptions: "Variant tavsiflarini tahrirlash",
    optionDescPh: "Ushbu variantning tavsifi...",
    statementPh: "Tasdiq matni...",
    refPh: "Ref",
    addRow: "Qator qo'shish",
  },
  en: {
    toggleVariant: "Change to YES/NO/NOT GIVEN",
    instructionsPh: "Instructions (e.g. Do the following statements agree...)",
    hideOptions: "Hide option descriptions",
    editOptions: "Edit option descriptions",
    optionDescPh: "Description of this option...",
    statementPh: "Statement text...",
    refPh: "Ref",
    addRow: "Add Row",
  },
  ru: {
    toggleVariant: "Переключить на YES/NO/NOT GIVEN",
    instructionsPh: "Инструкция (например: Do the following statements agree...)",
    hideOptions: "Скрыть описания вариантов",
    editOptions: "Редактировать описания вариантов",
    optionDescPh: "Описание этого варианта...",
    statementPh: "Текст утверждения...",
    refPh: "Ref",
    addRow: "Добавить строку",
  },
};

export default function TFNGBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  
  // UX State: Hide the bulky options template by default to keep the UI clean
  const [showOptions, setShowOptions] = useState(false);
  const isYesNo = qb.options?.[0]?.label === 'YES';

  // Handlers
  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ 
      question_number: 0, // Parent Global Engine will instantly fix this!
      statement: '', 
      correct_answer: isYesNo ? 'YES' : 'TRUE', 
      passage_reference: '' // Will save as "" if the user leaves it blank
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Toggle Variant & Reset Templates
  const toggleVariant = () => {
    const newIsYesNo = !isYesNo;
    const newOptions = newIsYesNo 
      ? [
          { label: 'YES', description: 'if the statement agrees with the claims of the writer' },
          { label: 'NO', description: 'if the statement contradicts the claims of the writer' },
          { label: 'NOT GIVEN', description: 'if it is impossible to say what the writer thinks about this' }
        ] 
      : [
          { label: 'TRUE', description: 'if the statement agrees with the information' },
          { label: 'FALSE', description: 'if the statement contradicts the information' },
          { label: 'NOT GIVEN', description: 'if there is no information on this' }
        ];
    
    const newQs = qb.questions.map((q: any) => {
      let mappedAns = q.correct_answer;
      if (newIsYesNo) {
        if (mappedAns === 'TRUE') mappedAns = 'YES';
        if (mappedAns === 'FALSE') mappedAns = 'NO';
      } else {
        if (mappedAns === 'YES') mappedAns = 'TRUE';
        if (mappedAns === 'NO') mappedAns = 'FALSE';
      }
      return { ...q, correct_answer: mappedAns };
    });

    updateBlock(qbIdx, 'options', newOptions);
    updateBlock(qbIdx, 'questions', newQs);
  };

  // Fluid Keyboard Entry
  const handleKeyDown = (e: any, rIdx: number) => {
    if (e.key === 'Enter' && rIdx === qb.questions.length - 1) {
      e.preventDefault();
      addRow();
    }
  };

  // Smart Paste
  const handlePaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText.includes('\n')) {
      e.preventDefault();
      const lines = pastedText.split('\n').map((l: string) => l.replace(/^[0-9]+[\.\)]\s*/, '').trim()).filter(Boolean);
      const updatedQs = [...qb.questions];
      updatedQs[rIdx].statement = lines[0]; 
      for (let i = 1; i < lines.length; i++) {
        updatedQs.splice(rIdx + i, 0, { question_number: 0, statement: lines[i], correct_answer: isYesNo ? 'YES' : 'TRUE', passage_reference: '' });
      }
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block">

      {/* 1. HEADER ROW */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs">
            <span className="text-[9px] font-black uppercase tracking-wider">
              {isYesNo ? 'YNNG' : 'TFNG'}
            </span>
            <button onClick={toggleVariant} className="hover:text-primary transition-colors" title={t.toggleVariant}>
              <Repeat size={10} strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-semibold">
            Qs:
            {/* MADE READ-ONLY: So teachers don't break the global numbering */}
            <input
              type="number" value={qb.start_question} readOnly
              className="w-8 h-5 text-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-1 outline-none font-bold text-on-surface cursor-default"
            />
            -
            <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs text-on-surface-variant font-bold select-none">
              {qb.end_question}
            </span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover/block:opacity-100">
          <Trash2 size={14}/>
        </button>
      </div>

      <div className="p-3">
        
        {/* 2. META DATA (Instructions & Collapsible Options) */}
        <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-transparent hover:border-outline-variant transition-colors">
          
          <textarea 
            placeholder={t.instructionsPh} value={qb.instructions}
            onChange={e => {
              updateBlock(qbIdx, 'instructions', e.target.value);
              e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
            }} 
            className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none p-0 resize-none overflow-hidden min-h-[16px]"
          />

          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-primary uppercase tracking-wider mt-1 transition-colors"
          >
            <Edit3 size={10} /> {showOptions ? t.hideOptions : t.editOptions}
            {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showOptions && (
            <div className="mt-2 space-y-1.5 pt-2 border-t border-outline-variant">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-16 text-[9px] font-black tracking-wider text-on-surface-variant bg-surface-container-lowest border border-outline-variant px-1 py-1 rounded-m3-xs text-center select-none shrink-0">
                    {opt.label}
                  </span>
                  <input 
                    type="text" value={opt.description} 
                    onChange={e => {
                      const newOptions = [...qb.options];
                      newOptions[oIdx].description = e.target.value;
                      updateBlock(qbIdx, 'options', newOptions);
                    }}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-xs py-1 px-2 text-[11px] font-medium text-on-surface-variant outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary transition-colors"
                    placeholder={t.optionDescPh}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 3. INLINE DATA GRID FOR ROWS */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container border border-outline-variant rounded-m3-xs select-none shrink-0">
                {row.question_number}
              </span>

              <input
                type="text" placeholder={t.statementPh}
                value={row.statement}
                onChange={e => updateRow(rIdx, 'statement', e.target.value)}
                onPaste={e => handlePaste(e, rIdx)}
                className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant font-medium"
              />

              <select
                value={row.correct_answer}
                onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)}
                className="w-[88px] h-7 text-[10px] font-bold bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-1 outline-none text-success focus:border-primary cursor-pointer shrink-0"
              >
                {isYesNo ? (
                  <><option value="YES">YES</option><option value="NO">NO</option><option value="NOT GIVEN">NOT GIVEN</option></>
                ) : (
                  <><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option><option value="NOT GIVEN">NOT GIVEN</option></>
                )}
              </select>
              
              <input 
                type="text" placeholder={t.refPh}
                value={row.passage_reference}
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                onKeyDown={e => handleKeyDown(e, rIdx)}
                className="w-10 h-7 text-[10px] text-center font-bold bg-surface-container-lowest border border-outline-variant rounded-m3-xs outline-none placeholder:text-outline uppercase focus:border-primary shrink-0"
              />

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-outline hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0">
                <X size={14}/>
              </button>
            </div>
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addRow}
        </Button>
      </div>
    </div>
  );
}