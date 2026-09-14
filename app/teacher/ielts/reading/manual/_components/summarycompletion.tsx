'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, SquareSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    instructionsPh: "Yo'riqnoma (masalan: Choose NO MORE THAN TWO WORDS...)",
    wordBankOn: "So'z banki: YOQILGAN",
    wordBankOff: "So'z banki: O'CHIQ",
    wordPh: "So'z yoki ibora...",
    addWordOption: "So'z varianti qo'shish",
    summaryTitlePh: "Xulosa sarlavhasi (ixtiyoriy)...",
    insertBlank: "Bo'sh joy qo'yish",
    insertBlankTitle: "Kursor turgan joyga bo'sh joy qo'shish",
    summaryTextPh: "Xulosa matnini shu yerga yozing. Javob turadigan joyda 'Bo'sh joy qo'yish' tugmasini bosing...",
    selectLetter: "Harfni tanlang...",
    answersPh: "masalan: floods, flood damage",
    refPh: "Ref",
  },
  en: {
    instructionsPh: "Instructions (e.g. Choose NO MORE THAN TWO WORDS...)",
    wordBankOn: "Word Bank: ON",
    wordBankOff: "Word Bank: OFF",
    wordPh: "Word or phrase...",
    addWordOption: "Add Word Option",
    summaryTitlePh: "Summary Title (Optional)...",
    insertBlank: "Insert Blank",
    insertBlankTitle: "Insert a blank at your cursor position",
    summaryTextPh: "Type your summary here. Click 'Insert Blank' where an answer should go...",
    selectLetter: "Select letter...",
    answersPh: "e.g. floods, flood damage",
    refPh: "Ref",
  },
  ru: {
    instructionsPh: "Инструкция (например: Choose NO MORE THAN TWO WORDS...)",
    wordBankOn: "Банк слов: ВКЛ",
    wordBankOff: "Банк слов: ВЫКЛ",
    wordPh: "Слово или фраза...",
    addWordOption: "Добавить слово-вариант",
    summaryTitlePh: "Заголовок резюме (необязательно)...",
    insertBlank: "Вставить пропуск",
    insertBlankTitle: "Вставить пропуск в позиции курсора",
    summaryTextPh: "Введите текст резюме. Нажмите «Вставить пропуск» там, где должен быть ответ...",
    selectLetter: "Выберите букву...",
    answersPh: "напр.: floods, flood damage",
    refPh: "Ref",
  },
};

export default function SummaryCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const isWordBank = Array.isArray(qb.options);

  // ==========================================================================
  // 🌟 MAGIC AUTO-HEALING REGEX ENGINE
  // ==========================================================================
  // This ensures the numbers in the text ALWAYS match the actual question rows!
  useEffect(() => {
    if (!qb.summary_text) return;
    
    const currentNumbers = qb.questions.map((q: any) => q.question_number);
    let text = qb.summary_text;
    
    // Find all bracketed numbers like [14] OR empty brackets like [] or [_]
    const matches = text.match(/\[\s*\d*\s*\]|\[_\]/g) || [];
    let needsUpdate = false;
    
    matches.forEach((match: string, idx: number) => {
      const expectedNum = currentNumbers[idx];
      if (expectedNum && match !== `[${expectedNum}]`) {
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      let i = 0;
      // Replace all brackets with the correctly synced numbers
      const newText = text.replace(/\[\s*\d*\s*\]|\[_\]/g, () => {
         const num = currentNumbers[i++];
         return num ? `[${num}]` : `[?]`;
      });
      updateBlock(qbIdx, 'summary_text', newText);
    }
  }, [qb.questions, qb.summary_text]);


  // ==========================================================================
  // 🌟 MAGIC "INSERT BLANK" BUTTON
  // ==========================================================================
  const insertBlankAtCursor = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = qb.summary_text || '';

    // The temporary number (the engine will instantly fix this if it's wrong)
    const nextNum = (qb.start_question || 0) + qb.questions.length;
    const blankToInsert = ` [${nextNum}] `;

    // Inject the blank at the exact cursor position
    const newText = text.substring(0, start) + blankToInsert + text.substring(end);
    updateBlock(qbIdx, 'summary_text', newText);

    // Automatically add the corresponding answer row!
    addRow();

    // Refocus the textarea so the teacher can keep typing smoothly
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + blankToInsert.length, start + blankToInsert.length);
    }, 10);
  };

  // ==========================================================================
  // TOGGLE MODE (Direct Entry <--> Word Bank)
  // ==========================================================================
  const toggleMode = () => {
    if (isWordBank) {
      updateBlock(qbIdx, 'options', null);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: [''] })));
    } else {
      updateBlock(qbIdx, 'options', [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }]);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: 'A' })));
    }
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
    updatedQs.push({ 
      question_number: 0, 
      correct_answer: isWordBank ? (qb.options.length > 0 ? qb.options[0].id : 'A') : [''], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">

      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            SUMMARY COMPLETION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS & MODE TOGGLE */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <input 
            type="text" placeholder={t.instructionsPh}
            value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)}
            className="flex-1 bg-transparent border-none text-[11px] font-bold text-on-surface outline-none p-0 mt-1"
          />
          <button onClick={toggleMode} className={`m3-interactive flex items-center gap-1.5 px-2 py-1 rounded-m3-sm text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 border ${isWordBank ? 'bg-primary-container text-on-primary-container border-transparent' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
            {isWordBank ? <><List size={12}/> {t.wordBankOn}</> : <><Type size={12}/> {t.wordBankOff}</>}
          </button>
        </div>

        {/* 2. OPTIONAL WORD BANK EDITOR */}
        {isWordBank && (
          <div className="mb-4 bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)] p-2 rounded-m3-sm border border-outline-variant">
             {/* Word bank editor UI remains exactly the same */}
             <div className="space-y-1.5 pt-1">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-primary bg-surface-container-lowest border border-outline-variant rounded-m3-xs text-center outline-none focus:border-primary" maxLength={2} />
                    <input type="text" value={opt.text} placeholder={t.wordPh} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-xs py-1 px-2 text-[11px] font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary" />
                    <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-outline hover:text-error"><X size={14}/></button>
                  </div>
                ))}
                <Button variant="text" size="sm" icon={<Plus />} onClick={() => { const newOpts = [...qb.options]; newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' }); updateBlock(qbIdx, 'options', newOpts); }} className="mt-2">
                  {t.addWordOption}
                </Button>
              </div>
          </div>
        )}

        {/* 3. SUMMARY TEXT AREA WITH MAGIC BUTTON */}
        <div className="bg-[color-mix(in_oklab,var(--m3-secondary)_6%,transparent)] p-3 rounded-m3-sm border border-outline-variant mb-4">
          <div className="flex items-center justify-between mb-2">
            <input
              type="text" placeholder={t.summaryTitlePh}
              value={qb.summary_title} onChange={e => updateBlock(qbIdx, 'summary_title', e.target.value)}
              className="flex-1 bg-transparent border-none text-[13px] font-black text-on-surface outline-none p-0 placeholder:text-on-surface-variant"
            />
            {/* 🌟 THE MAGIC BUTTON 🌟 */}
            <Button
              variant="tonal" size="sm" icon={<SquareSquare />}
              onClick={insertBlankAtCursor}
              className="shrink-0"
              title={t.insertBlankTitle}
            >
              {t.insertBlank}
            </Button>
          </div>
          <textarea 
            ref={textAreaRef}
            placeholder={t.summaryTextPh}
            value={qb.summary_text} 
            onChange={e => {
              updateBlock(qbIdx, 'summary_text', e.target.value);
              e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
            }}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-m3-xs p-2 text-[13px] leading-relaxed text-on-surface outline-none resize-none overflow-hidden min-h-[80px] focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary shadow-elev-1"
          />
        </div>
        
        {/* 4. INLINE DATA GRID FOR ANSWERS */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-inverse-on-surface bg-inverse-surface rounded-m3-xs shadow-elev-1 shrink-0">
                {row.question_number}
              </span>

              {isWordBank ? (
                <select
                  value={row.correct_answer || ''}
                  onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)}
                  className="flex-1 h-7 text-[11px] font-black bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 outline-none text-success focus:border-primary cursor-pointer"
                >
                  <option value="">{t.selectLetter}</option>
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id} - {o.text}</option>)}
                </select>
              ) : (
                <input 
                  type="text" placeholder={t.answersPh}
                  value={Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : ''}
                  onChange={e => {
                    const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    updateRow(rIdx, 'correct_answer', arr.length ? arr : ['']);
                  }} 
                  className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-xs px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant font-medium"
                />
              )}

              <input
                type="text" placeholder={t.refPh} value={row.passage_reference || ''}
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())}
                className={`w-14 h-7 text-[10px] text-center font-bold rounded-m3-xs outline-none uppercase shrink-0 transition-colors ${row.passage_reference ? 'bg-secondary-container border border-transparent text-on-secondary-container focus:border-primary' : 'bg-transparent border border-dashed border-outline text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
              />

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-outline hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}