'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma... (Avtomatik tuzish uchun to'liq matn blokini istalgan joyga joylashtiring!)",
    hideEndings: "Tugallanmalarni yashirish",
    editEndings: "Tugallanmalarni tahrirlash",
    endingPh: "Tugallanma matni...",
    addEnding: "Tugallanma qo'shish",
    sentenceStartPh: "Gap boshlanishi...",
    matches: "Mosligi:",
    refPh: "Ref (ixt)",
    addSentenceStart: "Gap boshlanishini qo'shish",
  },
  en: {
    instructionsPh: "Instructions... (Paste full block of text anywhere to auto-build!)",
    hideEndings: "Hide Endings",
    editEndings: "Edit Endings",
    endingPh: "Ending text...",
    addEnding: "Add Ending",
    sentenceStartPh: "Sentence start...",
    matches: "Matches:",
    refPh: "Ref (opt)",
    addSentenceStart: "Add Sentence Start",
  },
  ru: {
    instructionsPh: "Инструкция... (Вставьте полный блок текста в любое поле для автосборки!)",
    hideEndings: "Скрыть окончания",
    editEndings: "Редактировать окончания",
    endingPh: "Текст окончания...",
    addEnding: "Добавить окончание",
    sentenceStartPh: "Начало предложения...",
    matches: "Соответствие:",
    refPh: "Ref (необяз.)",
    addSentenceStart: "Добавить начало предложения",
  },
};

export default function MatchingSentenceEndingsBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);

  // ==========================================================================
  // 🌟 UNIVERSAL OMNI-PASTE ENGINE
  // ==========================================================================
  const handleUniversalPaste = (e: any, fallbackContext: 'instructions' | 'options' | 'questions', targetIdx: number = 0) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; 
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const optionRegex = /^([a-zA-Z])[\.\)]\s+(.+)/;
    const questionRegex = /^(\d+)[\.\)]\s+(.+)/;

    const hasOptions = lines.some((l: string) => optionRegex.test(l));
const hasQuestions = lines.some((l: string) => questionRegex.test(l));

    if (hasOptions && hasQuestions) {
      let extractedInstructions: string[] = [];
      let extractedOptions: { id: string, text: string }[] = [];
      let extractedQuestions: any[] = [];

      lines.forEach((line: string) => {
        const optMatch = line.match(optionRegex);
        const qMatch = line.match(questionRegex);
        if (qMatch) extractedQuestions.push({ question_number: 0, sentence_start: qMatch[2], correct_answer: ['A'], passage_reference: '' });
        else if (optMatch) extractedOptions.push({ id: String.fromCharCode(65 + extractedOptions.length), text: optMatch[2] });
        else extractedInstructions.push(line);
      });

      if (extractedInstructions.length > 0) updateBlock(qbIdx, 'instructions', extractedInstructions.join(' '));
      if (extractedOptions.length > 0) updateBlock(qbIdx, 'options', extractedOptions);
      if (extractedQuestions.length > 0) {
        const defaultAns = extractedOptions.length > 0 ? extractedOptions[0].id : 'A';
        updateBlock(qbIdx, 'questions', extractedQuestions.map(q => ({ ...q, correct_answer: [defaultAns] })));
      }
      return;
    }

    if (hasOptions || fallbackContext === 'options') {
      const newOpts = [...qb.options];
      newOpts[targetIdx].text = lines[0].replace(optionRegex, '$2'); 
      for (let i = 1; i < lines.length; i++) {
        newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: lines[i].replace(optionRegex, '$2') });
      }
      updateBlock(qbIdx, 'options', newOpts);
    } 
    else if (hasQuestions || fallbackContext === 'questions') {
      const updatedQs = [...qb.questions];
      updatedQs[targetIdx].sentence_start = lines[0].replace(questionRegex, '$2');
      const defaultAns = qb.options.length > 0 ? qb.options[0].id : 'A';
      for (let i = 1; i < lines.length; i++) {
        updatedQs.splice(targetIdx + i, 0, { question_number: 0, sentence_start: lines[i].replace(questionRegex, '$2'), correct_answer: [defaultAns], passage_reference: '' });
      }
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  };

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
    updatedQs.push({ question_number: 0, sentence_start: '', correct_answer: qb.options.length > 0 ? [qb.options[0].id] : ['A'], passage_reference: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addOption = () => {
    const newOpts = [...qb.options];
    newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' });
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

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            SENTENCE ENDINGS
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error opacity-0 group-hover/block:opacity-100 transition-colors"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS */}
        <div className="relative mb-2">
          <input 
            type="text" 
            placeholder={t.instructionsPh}
            value={qb.instructions} 
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            onPaste={e => handleUniversalPaste(e, 'instructions')}
            className="w-full bg-[color-mix(in_oklab,var(--m3-tertiary)_6%,transparent)] border border-dashed border-[color-mix(in_oklab,var(--m3-tertiary)_40%,transparent)] rounded-m3-xs p-2 text-[11px] font-bold text-on-surface outline-none focus:border-tertiary focus:bg-surface-container-lowest transition-colors pr-8"
          />
          <Wand2 className="absolute right-2 top-2 text-tertiary" size={14} />
        </div>
        
        {/* OPTIONS EDITOR */}
        <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant transition-colors hover:border-outline">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-tertiary uppercase tracking-wider mb-2 transition-colors">
            <Edit3 size={10} /> {showOptions ? t.hideEndings : t.editEndings} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          
          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-outline-variant">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[11px] font-black text-on-surface-variant">{opt.id}.</span>
                  <input
                    type="text" value={opt.text} placeholder={t.endingPh}
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }}
                    onPaste={e => handleUniversalPaste(e, 'options', oIdx)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-xs py-1.5 px-2 text-[11px] font-medium text-on-surface-variant outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant"
                  />
                  <button onClick={() => removeOption(oIdx)} disabled={qb.options.length <= 2} className="text-outline hover:text-error disabled:opacity-0 transition-colors shrink-0"><X size={14}/></button>
                </div>
              ))}
              <Button variant="text" size="sm" icon={<Plus />} onClick={addOption} className="mt-2 ml-5">
                {t.addEnding}
              </Button>
            </div>
          )}
        </div>
        
        {/* SENTENCE STARTS (Questions) - UPGRADED TO TEXTAREA */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-start gap-2 group/row transition-colors focus-within:border-tertiary focus-within:bg-[color-mix(in_oklab,var(--m3-tertiary)_5%,transparent)] p-1.5 rounded-m3-sm border border-transparent">

              <span className="w-8 h-7 mt-0.5 flex items-center justify-center text-[11px] font-black text-inverse-on-surface bg-inverse-surface rounded-m3-xs shadow-elev-1 shrink-0">
                {row.question_number}
              </span>
              
              <textarea 
                placeholder={t.sentenceStartPh}
                value={row.sentence_start} 
                onChange={e => {
                  updateRow(rIdx, 'sentence_start', e.target.value);
                  // Magic Auto-Resizer
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }} 
                onPaste={e => handleUniversalPaste(e, 'questions', rIdx)}
                onKeyDown={(e) => { 
                  // If they hit Enter (without holding Shift), it creates a new row instead of breaking the line
                  if (e.key === 'Enter' && !e.shiftKey && rIdx === qb.questions.length - 1) { 
                    e.preventDefault(); 
                    addRow(); 
                  } 
                }}
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 py-1.5 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary font-medium placeholder:font-normal placeholder:text-on-surface-variant resize-none overflow-hidden min-h-[32px] leading-relaxed"
                rows={1}
              />

              {/* DROPDOWN */}
              <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 shrink-0 mt-0.5 h-7">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t.matches}</span>
                <select
                  value={row.correct_answer[0] || ''}
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])}
                  className="w-12 h-6 text-[11px] font-black bg-transparent outline-none text-success cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>
              </div>

              {/* GHOST REFERENCE */}
              <input 
                type="text" placeholder={t.refPh}
                value={row.passage_reference || ''}
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                className={`w-14 h-7 mt-0.5 text-[10px] text-center font-bold rounded-m3-xs outline-none uppercase shrink-0 transition-colors
                  ${row.passage_reference ? 'bg-tertiary-container border border-transparent text-on-tertiary-container focus:border-primary' : 'bg-transparent border border-dashed border-outline text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
              />

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 mt-0.5 flex items-center justify-center text-outline hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
        
        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addSentenceStart}
        </Button>
      </div>
    </div>
  );
}