'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma...",
    hideHeadings: "Sarlavhalar ro'yxatini yashirish",
    editHeadings: "Sarlavhalar ro'yxatini tahrirlash",
    headingPh: "Sarlavhalar ro'yxatini shu yerga joylashtiring...",
    addHeading: "Sarlavha qo'shish",
    paragraph: "Paragraf",
    select: "Tanlang...",
    addTarget: "Paragraf qo'shish",
  },
  en: {
    instructionsPh: "Instructions...",
    hideHeadings: "Hide Headings List",
    editHeadings: "Edit Headings List",
    headingPh: "Paste list of headings here...",
    addHeading: "Add Heading",
    paragraph: "Paragraph",
    select: "Select...",
    addTarget: "Add Target Paragraph",
  },
  ru: {
    instructionsPh: "Инструкция...",
    hideHeadings: "Скрыть список заголовков",
    editHeadings: "Редактировать список заголовков",
    headingPh: "Вставьте список заголовков сюда...",
    addHeading: "Добавить заголовок",
    paragraph: "Абзац",
    select: "Выберите...",
    addTarget: "Добавить абзац",
  },
};

// Helper array for auto-generating Roman Numerals
const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];

export default function MatchingHeadingsBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);

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
    
    // Magic Feature: Auto-guess the next paragraph letter (A -> B -> C)
    const lastTarget = updatedQs.length > 0 ? updatedQs[updatedQs.length - 1].target_paragraph : '';
    let nextTarget = '';
    if (lastTarget && /^[A-Z]$/i.test(lastTarget)) {
      nextTarget = String.fromCharCode(lastTarget.toUpperCase().charCodeAt(0) + 1);
    } else if (updatedQs.length === 0) {
      nextTarget = 'A';
    }

    updatedQs.push({ 
      question_number: 0, 
      target_paragraph: nextTarget, 
      correct_answer: '' 
      // Removed passage_reference entirely!
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // OPTIONS (HEADINGS) HANDLERS
  // ==========================================================================
  const handlePasteOptions = (e: any, oIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText.includes('\n')) {
      e.preventDefault();
      
      // Clean up pasted lines (removes bullet points, numbers, or old roman numerals if present)
      const lines = pastedText.split('\n')
        .map((l: string) => l.replace(/^([0-9]+|[ivx]+)[\.\)]\s*/i, '').trim())
        .filter(Boolean);
      
      const newOpts = [...qb.options];
      newOpts[oIdx].text = lines[0]; // Set current row
      
      // Append the rest of the lines with auto-generated Roman Numerals
      for (let i = 1; i < lines.length; i++) {
        const nextId = ROMAN_NUMERALS[newOpts.length] || `opt${newOpts.length + 1}`;
        newOpts.push({ id: nextId, text: lines[i] });
      }
      updateBlock(qbIdx, 'options', newOpts);
    }
  };

  const addOption = () => {
    const newOpts = [...qb.options];
    const nextId = ROMAN_NUMERALS[newOpts.length] || `opt${newOpts.length + 1}`;
    newOpts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'options', newOpts);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            MATCHING HEADINGS
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
          type="text" placeholder={t.instructionsPh} value={qb.instructions}
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
          className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none mb-2 p-0"
        />

        {/* 2. OPTIONS EDITOR (List of Headings) */}
        <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant transition-colors hover:border-outline">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-primary uppercase tracking-wider mb-1 transition-colors">
            <Edit3 size={10} /> {showOptions ? t.hideHeadings : t.editHeadings} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-outline-variant">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <input
                    type="text" value={opt.id}
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toLowerCase(); updateBlock(qbIdx, 'options', newOpts); }}
                    className="w-10 text-[10px] font-black tracking-wider text-primary bg-surface-container-lowest border border-outline-variant px-1 py-1.5 rounded-m3-sm text-center outline-none focus:border-primary"
                  />
                  <input
                    type="text" value={opt.text} placeholder={t.headingPh}
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }}
                    onPaste={e => handlePasteOptions(e, oIdx)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-sm py-1.5 px-2 text-[11px] font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant"
                  />
                  <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-on-surface-variant hover:text-error shrink-0"><X size={14}/></button>
                </div>
              ))}
              <Button variant="text" size="sm" icon={<Plus />} onClick={addOption} className="mt-2">
                {t.addHeading}
              </Button>
            </div>
          )}
        </div>
        
        {/* 3. QUESTIONS GRID (Target Paragraphs) */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)] p-1 rounded-m3-sm border border-transparent">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0">{row.question_number}</span>

              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2">
                <span className="text-[11px] font-bold text-on-surface-variant">{t.paragraph}</span>
                <input
                  type="text" placeholder="A" value={row.target_paragraph}
                  onChange={e => updateRow(rIdx, 'target_paragraph', e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter' && rIdx === qb.questions.length - 1) { e.preventDefault(); addRow(); } }}
                  className="w-12 h-7 text-[12px] bg-transparent outline-none font-black text-on-surface uppercase text-center focus:text-primary"
                  maxLength={2}
                />
              </div>

              <select
                value={row.correct_answer} onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)}
                className="w-24 h-7 text-[10px] font-black bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-1 outline-none text-success focus:border-primary cursor-pointer shrink-0"
              >
                <option value="">{t.select}</option>
                {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
              </select>

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addTarget}
        </Button>
      </div>
    </div>
  );
}