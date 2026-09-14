'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma... (Avtomatik tuzish uchun to'liq matn blokini shu yerga joylashtiring!)",
    hideCategories: "Kategoriyalarni yashirish (masalan: Researchers, Cities)",
    editCategories: "Kategoriyalarni tahrirlash (masalan: Researchers, Cities)",
    categoryPh: "Kategoriya (masalan: City authorities)...",
    addCategory: "Kategoriya qo'shish",
    statementPh: "Tasdiq matni... (Ro'yxatni joylashtirib ko'ring!)",
    matches: "Mosligi:",
    refPh: "Ref (ixt)",
    addStatement: "Tasdiq qo'shish",
  },
  en: {
    instructionsPh: "Instructions... (Paste full block of text here to auto-build!)",
    hideCategories: "Hide Categories (e.g. Researchers, Cities)",
    editCategories: "Edit Categories (e.g. Researchers, Cities)",
    categoryPh: "Category (e.g. City authorities)...",
    addCategory: "Add Category",
    statementPh: "Statement text... (Try pasting a list!)",
    matches: "Matches:",
    refPh: "Ref (opt)",
    addStatement: "Add Statement",
  },
  ru: {
    instructionsPh: "Инструкция... (Вставьте сюда полный блок текста для автосборки!)",
    hideCategories: "Скрыть категории (напр.: Researchers, Cities)",
    editCategories: "Редактировать категории (напр.: Researchers, Cities)",
    categoryPh: "Категория (напр.: City authorities)...",
    addCategory: "Добавить категорию",
    statementPh: "Текст утверждения... (Попробуйте вставить список!)",
    matches: "Соответствие:",
    refPh: "Ref (необяз.)",
    addStatement: "Добавить утверждение",
  },
};

export default function MatchingFeaturesBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);

  // ==========================================================================
  // 🌟 OMNI-PASTE MAGIC ENGINE (Parses Full Text Chunks)
  // ==========================================================================
  const handleOmniPaste = (e: any) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // If it's just one line, paste normally
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    let extractedInstructions: string[] = [];
    let extractedOptions: { id: string, text: string }[] = [];
    let extractedQuestions: any[] = [];

    // Regex to detect "A. Category" or "A) Category"
    const optionRegex = /^([A-Z])[\.\)]\s+(.+)/i;
    // Regex to detect "1. Statement" or "14) Statement"
    const questionRegex = /^(\d+)[\.\)]\s+(.+)/;

    lines.forEach((line: string) => {
      const optMatch = line.match(optionRegex);
      const qMatch = line.match(questionRegex);

      if (qMatch) {
        // It's a statement!
        extractedQuestions.push({
          question_number: 0, // Global engine handles this
          statement: qMatch[2],
          correct_answer: ['A'], // Temporary fallback
          passage_reference: ''
        });
      } else if (optMatch) {
        // It's a category option!
        extractedOptions.push({
          id: String.fromCharCode(65 + extractedOptions.length), // Auto format A, B, C
          text: optMatch[2]
        });
      } else {
        // It's an instruction!
        extractedInstructions.push(line);
      }
    });

    // Update the block with whatever the engine found
    if (extractedInstructions.length > 0) {
      updateBlock(qbIdx, 'instructions', extractedInstructions.join(' '));
    }
    
    if (extractedOptions.length > 0) {
      updateBlock(qbIdx, 'options', extractedOptions);
    }
    
    if (extractedQuestions.length > 0) {
      // Safely link the correct answer default to the new options
      const defaultAns = extractedOptions.length > 0 ? extractedOptions[0].id : (qb.options.length > 0 ? qb.options[0].id : 'A');
      const mappedQs = extractedQuestions.map(q => ({ ...q, correct_answer: [defaultAns] }));
      updateBlock(qbIdx, 'questions', mappedQs);
    }
  };

  // ==========================================================================
  // ROW (STATEMENT) HANDLERS
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
      statement: '', 
      correct_answer: qb.options.length > 0 ? [qb.options[0].id] : ['A'], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Micro-Paste for Statements specifically
  const handlePasteStatements = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return;
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.replace(/^[0-9]+[\.\)]\s*/, '').trim()).filter(Boolean);
    
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].statement = lines[0];
    
    const defaultAns = qb.options.length > 0 ? qb.options[0].id : 'A';
    for (let i = 1; i < lines.length; i++) {
      updatedQs.splice(rIdx + i, 0, { question_number: 0, statement: lines[i], correct_answer: [defaultAns], passage_reference: '' });
    }
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // OPTIONS (CATEGORIES) HANDLERS
  // ==========================================================================
  const addOption = () => {
    const newOpts = [...qb.options];
    const nextId = String.fromCharCode(65 + newOpts.length);
    newOpts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'options', newOpts);
  };

  const removeOption = (oIdx: number) => {
    const newOpts = [...qb.options];
    newOpts.splice(oIdx, 1);
    
    newOpts.forEach((opt: any, i: number) => { opt.id = String.fromCharCode(65 + i); });
    updateBlock(qbIdx, 'options', newOpts);

    const updatedQs = [...qb.questions];
    updatedQs.forEach(q => {
      if (!newOpts.find((o: any) => o.id === q.correct_answer[0])) {
        q.correct_answer = newOpts.length > 0 ? [newOpts[0].id] : [''];
      }
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Micro-Paste for Categories specifically
  const handlePasteOptions = (e: any, oIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return;
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.replace(/^[a-zA-Z][\.\)]\s*/, '').trim()).filter(Boolean);
    
    const newOpts = [...qb.options];
    newOpts[oIdx].text = lines[0]; 
    
    for (let i = 1; i < lines.length; i++) {
      newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: lines[i] });
    }
    updateBlock(qbIdx, 'options', newOpts);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            MATCHING FEATURES
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error opacity-0 group-hover/block:opacity-100 transition-colors"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS WITH OMNI-PASTE */}
        <div className="relative mb-2">
          <input
            type="text"
            placeholder={t.instructionsPh}
            value={qb.instructions}
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
            onPaste={handleOmniPaste}
            className="w-full bg-[color-mix(in_oklab,var(--m3-primary)_8%,transparent)] border border-dashed border-outline rounded-m3-sm p-2 text-[11px] font-bold text-on-surface outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors pr-8"
          />
          <Wand2 className="absolute right-2 top-2 text-primary" size={14} />
        </div>

        {/* 2. CATEGORIES EDITOR (A, B, C) */}
        <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant transition-colors hover:border-outline">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-primary uppercase tracking-wider mb-2 transition-colors">
            <Edit3 size={10} /> {showOptions ? t.hideCategories : t.editCategories} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-outline-variant">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[11px] font-black text-on-surface-variant">{opt.id}.</span>
                  <input
                    type="text" value={opt.text} placeholder={t.categoryPh}
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }}
                    onPaste={e => handlePasteOptions(e, oIdx)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-sm py-1.5 px-2 text-[11px] font-medium text-on-surface-variant outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant"
                  />
                  <button onClick={() => removeOption(oIdx)} disabled={qb.options.length <= 2} className="text-on-surface-variant hover:text-error disabled:opacity-0 transition-colors shrink-0"><X size={14}/></button>
                </div>
              ))}
              <Button variant="text" size="sm" icon={<Plus />} onClick={addOption} className="mt-2 ml-8">
                {t.addCategory}
              </Button>
            </div>
          )}
        </div>

        {/* 3. STATEMENTS TO CLASSIFY */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)] p-1 rounded-m3-sm border border-transparent">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0">
                {row.question_number}
              </span>

              <input
                type="text" placeholder={t.statementPh}
                value={row.statement}
                onChange={e => updateRow(rIdx, 'statement', e.target.value)}
                onPaste={e => handlePasteStatements(e, rIdx)}
                onKeyDown={(e) => { if (e.key === 'Enter' && rIdx === qb.questions.length - 1) { e.preventDefault(); addRow(); } }}
                className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary font-medium placeholder:font-normal placeholder:text-on-surface-variant"
              />

              {/* DROPDOWN (Saves to JSON as an Array!) */}
              <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 shrink-0">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t.matches}</span>
                <select
                  value={row.correct_answer[0] || ''}
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])}
                  className="w-12 h-7 text-[11px] font-black bg-transparent outline-none text-success cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>
              </div>

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

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
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