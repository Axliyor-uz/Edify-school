'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma...",
    availableParagraphs: "Mavjud paragraflar:",
    optionsPh: "masalan: A, B, C, D, E",
    statementPh: "Ma'lumot tasdig'i...",
    foundIn: "Qayerda:",
    addStatement: "Tasdiq qo'shish",
  },
  en: {
    instructionsPh: "Instructions...",
    availableParagraphs: "Available Paragraphs:",
    optionsPh: "e.g. A, B, C, D, E",
    statementPh: "Information statement...",
    foundIn: "Found in:",
    addStatement: "Add Statement",
  },
  ru: {
    instructionsPh: "Инструкция...",
    availableParagraphs: "Доступные абзацы:",
    optionsPh: "напр.: A, B, C, D, E",
    statementPh: "Утверждение с информацией...",
    foundIn: "Находится в:",
    addStatement: "Добавить утверждение",
  },
};

export default function MatchingParagraphInfoBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  // 1. LOCAL STATE FIX for smooth typing
  // Change Line 9 to this:
const [optsInput, setOptsInput] = useState<string>(qb.options?.join(', ') || '');

  // Sync local state if parent changes (e.g., from database load)
  useEffect(() => {
    setOptsInput(qb.options.join(', '));
  }, [qb.options]);

  const handleOptsBlur = () => {
    const cleanArray = optsInput
      .split(',')
      .map((s: string) => s.trim().toUpperCase()) // <-- fixed here
      .filter(Boolean);
    
    updateBlock(qbIdx, 'options', cleanArray);
    setOptsInput(cleanArray.join(', ')); // Re-format the input box beautifully
  };

  // ==========================================================================
  // ROW HANDLERS
  // ==========================================================================
  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    // Default to the first available option, or 'A'
    const defaultAns = qb.options.length > 0 ? qb.options[0] : 'A';
    updatedQs.push({ question_number: 0, statement: '', correct_answer: defaultAns });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // 2. FLUID KEYBOARD ENTRY
  const handleKeyDown = (e: any, rIdx: number) => {
    if (e.key === 'Enter' && rIdx === qb.questions.length - 1) {
      e.preventDefault();
      addRow();
    }
  };

  // 3. SMART PASTE
  const handlePaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText.includes('\n')) {
      e.preventDefault();
      const lines = pastedText.split('\n').map((l: string) => l.replace(/^[0-9]+[\.\)]\s*/, '').trim()).filter(Boolean);
      
      const updatedQs = [...qb.questions];
      updatedQs[rIdx].statement = lines[0]; 
      
      const defaultAns = qb.options.length > 0 ? qb.options[0] : 'A';
      for (let i = 1; i < lines.length; i++) {
        updatedQs.splice(rIdx + i, 0, { question_number: 0, statement: lines[i], correct_answer: defaultAns });
      }
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">

      {/* HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            MATCHING INFO
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
        <input 
          type="text" placeholder={t.instructionsPh} value={qb.instructions}
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
          className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none mb-3 p-0"
        />

        {/* PARAGRAPH OPTIONS ARRAY EDITOR */}
        <div className="mb-3 flex items-center gap-2 flex-wrap bg-surface-container p-2 rounded-m3-sm border border-outline-variant transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)]">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase mr-2">{t.availableParagraphs}</span>
          <input
            type="text"
            value={optsInput}
            onChange={e => setOptsInput(e.target.value)} // Smooth local typing
            onBlur={handleOptsBlur} // Saves to JSON when clicked away
            onKeyDown={(e) => { if (e.key === 'Enter') handleOptsBlur(); }}
            className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-sm py-1 px-2 text-[11px] font-black text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary uppercase"
            placeholder={t.optionsPh}
          />
        </div>

        {/* QUESTIONS GRID */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)] p-1 rounded-m3-sm border border-transparent">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0">
                {row.question_number}
              </span>

              <input
                type="text" placeholder={t.statementPh} value={row.statement}
                onChange={e => updateRow(rIdx, 'statement', e.target.value)}
                onKeyDown={e => handleKeyDown(e, rIdx)}
                onPaste={e => handlePaste(e, rIdx)}
                className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary font-medium placeholder:text-on-surface-variant"
              />

              <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 shrink-0">
                <span className="text-[10px] font-bold text-on-surface-variant">{t.foundIn}</span>
                <select
                  value={row.correct_answer}
                  onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)}
                  className="w-12 h-7 text-[11px] font-black bg-transparent outline-none text-success cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors">
                <X size={14}/>
              </button>
            </div>
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addStatement}
        </Button>
      </div>
    </div>
  );
}