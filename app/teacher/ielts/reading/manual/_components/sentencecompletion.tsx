'use client';

import { Plus, Trash2, X, SquareSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    sentencePh: "Gapni yozing... ([] kiritsangiz, bo'sh joy avtomatik qo'yiladi)",
    addBlank: "Bo'sh joy qo'shish",
    addBlankTitle: "Ushbu gapga bo'sh joy qavsini qo'shish",
    answersPh: "Qabul qilinadigan javoblar (vergul bilan ajrating)",
    refPh: "Ref (ixt)",
    instructionsPh: "Yo'riqnoma (masalan: Choose NO MORE THAN TWO WORDS...)",
    addSentence: "Gap qo'shish",
  },
  en: {
    sentencePh: "Type sentence... (Type [] to auto-insert blank)",
    addBlank: "Add Blank",
    addBlankTitle: "Add a blank bracket to this sentence",
    answersPh: "Accepted Answers (comma separated)",
    refPh: "Ref (opt)",
    instructionsPh: "Instructions (e.g. Choose NO MORE THAN TWO WORDS...)",
    addSentence: "Add Sentence",
  },
  ru: {
    sentencePh: "Введите предложение... (Введите [], чтобы вставить пропуск)",
    addBlank: "Добавить пропуск",
    addBlankTitle: "Добавить пропуск в это предложение",
    answersPh: "Допустимые ответы (через запятую)",
    refPh: "Ref (необяз.)",
    instructionsPh: "Инструкция (например: Choose NO MORE THAN TWO WORDS...)",
    addSentence: "Добавить предложение",
  },
};

// ==========================================================================
// INDIVIDUAL ROW COMPONENT (Fixes the Comma Typing Issue)
// ==========================================================================
const SentenceRow = ({ row, rIdx, updateRow, deleteRow, insertBlank, totalRows, t }: any) => {
  // Local state allows smooth typing with commas
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  // Sync if parent updates
  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  // Only format and save to JSON when the user clicks away or hits enter
  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', ')); // Cleans up UI (e.g. "a , b" -> "a, b")
  };

  return (
    <div className="bg-surface-container rounded-m3-sm p-2 border border-outline-variant relative group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)]">
      <div className="flex items-start gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0 mt-0.5">
          {row.question_number}
        </span>

        <textarea
          placeholder={t.sentencePh}
          value={row.sentence}
          onChange={e => {
            updateRow(rIdx, 'sentence', e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 py-1 text-[12px] font-medium text-on-surface outline-none resize-none overflow-hidden min-h-[32px] focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant"
        />

        {/* CLEARER MAGIC BUTTON */}
        <button
          onClick={() => insertBlank(rIdx)}
          className="m3-interactive mt-0.5 px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold text-on-tertiary-container bg-tertiary-container rounded-m3-xs shadow-elev-1 shrink-0 transition-colors border border-transparent"
          title={t.addBlankTitle}
        >
          <SquareSquare size={12} /> {t.addBlank}
        </button>
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
              ? 'bg-tertiary-container border border-transparent text-on-tertiary-container focus:border-primary'
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
export default function SentenceCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  // 🌟 MAGIC AUTO-HEALING REGEX ENGINE (Per Row)
  useEffect(() => {
    let needsUpdate = false;
    const updatedQs = qb.questions.map((row: any) => {
      if (!row.sentence) return row;
      
      const expectedBlank = `[${row.question_number}]`;
      const newSentence = row.sentence.replace(/\[\s*\d*\s*\]|\[_\]/g, expectedBlank);
      
      if (newSentence !== row.sentence) {
        needsUpdate = true;
        return { ...row, sentence: newSentence };
      }
      return row;
    });

    if (needsUpdate) {
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  }, [qb.questions]);

  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ 
      question_number: 0, 
      sentence: '', 
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

  // Helper to instantly insert the blank into the sentence
  const insertBlank = (rIdx: number) => {
    const row = qb.questions[rIdx];
    const expectedBlank = ` [${row.question_number}] `;
    if (!row.sentence.includes(`[${row.question_number}]`)) {
      updateRow(rIdx, 'sentence', row.sentence + expectedBlank);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            SENTENCE COMPLETION
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
          type="text" placeholder={t.instructionsPh}
          value={qb.instructions}
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
          className="w-full bg-transparent border-none text-[11px] font-bold text-on-surface outline-none mb-3 p-0"
        />
        
        {/* 2. QUESTIONS GRID */}
        <div className="space-y-3">
          {qb.questions.map((row: any, rIdx: number) => (
            <SentenceRow 
              key={rIdx} 
              row={row} 
              rIdx={rIdx} 
              updateRow={updateRow} 
              deleteRow={deleteRow} 
              insertBlank={insertBlank}
              totalRows={qb.questions.length}
              t={t}
            />
          ))}
        </div>
        
        <Button variant="text" size="sm" icon={<Plus />} onClick={addRow} className="mt-3">
          {t.addSentence}
        </Button>
      </div>
    </div>
  );
}