'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, SquareSquare, ArrowDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    selectLetter: "Harfni tanlang...",
    answersRowPh: "masalan: water, rainfall",
    refPh: "Ref",
    instructionsPh: "Yo'riqnoma...",
    wordBankOn: "So'z banki: YOQILGAN",
    wordBankOff: "So'z banki: O'CHIQ",
    hideWordBank: "So'z bankini yashirish",
    editWordBank: "So'z bankini tahrirlash",
    wordPh: "So'z yoki ibora...",
    addWordOption: "So'z varianti qo'shish",
    flowchartTitlePh: "Sxema sarlavhasi (ixtiyoriy)...",
    stepPh: "Ushbu bosqichni tavsiflang... (Ro'yxatni joylashtiring!)",
    blank: "BO'SH JOY",
    addStep: "Sxema bosqichini qo'shish",
    qNum: "Savol raqami",
    correctLetter: "To'g'ri harf",
    acceptedAnswers: "Qabul qilinadigan javoblar (vergul bilan)",
    ref: "Ref",
    addAnswerBox: "Javob katagini qo'shish",
  },
  en: {
    selectLetter: "Select letter...",
    answersRowPh: "e.g. water, rainfall",
    refPh: "Ref",
    instructionsPh: "Instructions...",
    wordBankOn: "Word Bank: ON",
    wordBankOff: "Word Bank: OFF",
    hideWordBank: "Hide Word Bank",
    editWordBank: "Edit Word Bank",
    wordPh: "Word or phrase...",
    addWordOption: "Add Word Option",
    flowchartTitlePh: "Flowchart Title (Optional)...",
    stepPh: "Describe this step... (Paste list here!)",
    blank: "BLANK",
    addStep: "Add Flowchart Step",
    qNum: "Q#",
    correctLetter: "Correct Letter",
    acceptedAnswers: "Accepted Answers (Comma separated)",
    ref: "Ref",
    addAnswerBox: "Add Answer Box",
  },
  ru: {
    selectLetter: "Выберите букву...",
    answersRowPh: "напр.: water, rainfall",
    refPh: "Ref",
    instructionsPh: "Инструкция...",
    wordBankOn: "Банк слов: ВКЛ",
    wordBankOff: "Банк слов: ВЫКЛ",
    hideWordBank: "Скрыть банк слов",
    editWordBank: "Редактировать банк слов",
    wordPh: "Слово или фраза...",
    addWordOption: "Добавить слово-вариант",
    flowchartTitlePh: "Заголовок схемы (необязательно)...",
    stepPh: "Опишите этот шаг... (Вставьте список сюда!)",
    blank: "ПРОПУСК",
    addStep: "Добавить шаг схемы",
    qNum: "№",
    correctLetter: "Правильная буква",
    acceptedAnswers: "Допустимые ответы (через запятую)",
    ref: "Ref",
    addAnswerBox: "Добавить поле ответа",
  },
};

// ==========================================================================
// INDIVIDUAL ANSWER ROW (Fixes Comma Typing)
// ==========================================================================
const AnswerRow = ({ row, rIdx, updateRow, deleteRow, isWordBank, options, totalRows, t }: any) => {
  const [ansText, setAnsText] = useState(Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : '');

  useEffect(() => {
    setAnsText(Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : '');
  }, [row.correct_answer]);

  const handleAnsBlur = () => {
    if (isWordBank) return;
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', '));
  };

  return (
    <div className="flex items-center gap-2 group/row transition-colors focus-within:border-primary focus-within:bg-[color-mix(in_oklab,var(--m3-primary)_5%,transparent)] p-1 rounded-m3-sm border border-transparent">
      <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shadow-elev-1 shrink-0">
        {row.question_number}
      </span>

      {isWordBank ? (
        <select
          value={row.correct_answer || ''}
          onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)}
          className="flex-1 h-7 text-[11px] font-black bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none text-success focus:border-primary cursor-pointer"
        >
          <option value="">{t.selectLetter}</option>
          {options.map((o: any) => <option key={o.id} value={o.id}>{o.id} - {o.text}</option>)}
        </select>
      ) : (
        <input
          type="text" placeholder={t.answersRowPh}
          value={ansText}
          onChange={e => setAnsText(e.target.value)}
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant font-medium"
        />
      )}

      <input
        type="text" placeholder={t.refPh} value={row.passage_reference || ''}
        onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())}
        className={`w-14 h-7 text-[10px] text-center font-bold rounded-m3-sm outline-none uppercase shrink-0 transition-colors
          ${row.passage_reference ? 'bg-primary-container border border-transparent text-on-primary-container focus:border-primary' : 'bg-transparent border border-dashed border-outline text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
      />

      <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function FlowchartCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);
  const isWordBank = Array.isArray(qb.options);

  // ==========================================================================
  // 🌟 AUTO-HEALING REGEX ENGINE (Numbers the steps perfectly)
  // ==========================================================================
  useEffect(() => {
    let needsUpdate = false;
    let globalBracketIndex = 0;
    const currentNumbers = qb.questions.map((q: any) => q.question_number);

    const newSteps = qb.steps.map((stepStr: string) => {
      let stepUpdated = false;
      const newStep = stepStr.replace(/\[\s*\d*\s*\]|\[_\]|\[\]/g, (match) => {
        const expectedNum = currentNumbers[globalBracketIndex++];
        const replacement = expectedNum ? `[${expectedNum}]` : `[?]`;
        if (match !== replacement) stepUpdated = true;
        return replacement;
      });
      if (stepUpdated) needsUpdate = true;
      return newStep;
    });

    if (needsUpdate) {
      updateBlock(qbIdx, 'steps', newSteps);
    }
  }, [qb.steps, qb.questions]);

  // ==========================================================================
  // TOGGLE MODE (Direct Entry <--> Word Bank)
  // ==========================================================================
  const toggleMode = () => {
    if (isWordBank) {
      updateBlock(qbIdx, 'options', null);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: [''] })));
    } else {
      updateBlock(qbIdx, 'options', [{ id: 'A', text: '' }, { id: 'B', text: '' }]);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: 'A' })));
    }
  };

  // ==========================================================================
  // QUESTION HANDLERS
  // ==========================================================================
  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addQuestionRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ question_number: 0, correct_answer: isWordBank ? (qb.options.length > 0 ? qb.options[0].id : 'A') : [''], passage_reference: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteQuestionRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // STEP HANDLERS (Flowchart UI)
  // ==========================================================================
  const updateStep = (sIdx: number, val: string) => {
    const newSteps = [...qb.steps];
    newSteps[sIdx] = val;
    updateBlock(qbIdx, 'steps', newSteps);
  };

  const addStep = () => {
    updateBlock(qbIdx, 'steps', [...qb.steps, '']);
  };

  const deleteStep = (sIdx: number) => {
    const newSteps = [...qb.steps];
    newSteps.splice(sIdx, 1);
    updateBlock(qbIdx, 'steps', newSteps);
  };

  // 🌟 THE MAGIC "INSERT BLANK IN STEP" ENGINE
  const insertBlank = (sIdx: number) => {
    const elId = `flowchart-step-${qbIdx}-${sIdx}`;
    const el = document.getElementById(elId) as HTMLTextAreaElement;
    
    const currentVal = qb.steps[sIdx] || '';
    let newVal = currentVal + ' [] ';
    
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      newVal = currentVal.substring(0, start) + ' [] ' + currentVal.substring(end);
      
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 4, start + 4);
      }, 10);
    }
    
    updateStep(sIdx, newVal);
    addQuestionRow(); // Auto-create the answer box
  };

  // 🌟 SMART-SPLIT PASTE ENGINE FOR STEPS
  const handlePasteSteps = (e: any, sIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return;
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    const newSteps = [...qb.steps];
    newSteps[sIdx] = lines[0]; // update current
    
    // Inject the rest as new steps
    for (let i = 1; i < lines.length; i++) {
      newSteps.splice(sIdx + i, 0, lines[i]);
    }
    updateBlock(qbIdx, 'steps', newSteps);
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            FLOWCHART COMPLETION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS & TOGGLE */}
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
          <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant">
            <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-primary uppercase tracking-wider mb-2">
              <Edit3 size={10} /> {showOptions ? t.hideWordBank : t.editWordBank} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showOptions && (
              <div className="space-y-1.5 pt-2 border-t border-outline-variant">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-primary bg-surface-container-lowest border border-outline-variant rounded-m3-sm text-center outline-none focus:border-primary" maxLength={2} />
                    <input type="text" value={opt.text} placeholder={t.wordPh} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-m3-sm py-1 px-2 text-[11px] font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary" />
                    <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-on-surface-variant hover:text-error"><X size={14}/></button>
                  </div>
                ))}
                <Button variant="text" size="sm" icon={<Plus />} onClick={() => { const newOpts = [...qb.options]; newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' }); updateBlock(qbIdx, 'options', newOpts); }} className="mt-2">
                  {t.addWordOption}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 3. FLOWCHART EDITOR (Visual UI) */}
        <div className="bg-surface-container p-4 rounded-m3-sm border border-outline-variant mb-4 flex flex-col items-center">
          <input
            type="text" placeholder={t.flowchartTitlePh}
            value={qb.flowchart_title} onChange={e => updateBlock(qbIdx, 'flowchart_title', e.target.value)}
            className="w-full bg-transparent border-none text-[13px] font-black text-on-surface outline-none mb-6 p-0 text-center placeholder:text-on-surface-variant"
          />

          <div className="w-full max-w-md space-y-0 flex flex-col items-center">
            {qb.steps.map((stepStr: string, sIdx: number) => (
              <div key={sIdx} className="w-full flex flex-col items-center group/step">

                {/* Visual Arrow (except for first item) */}
                {sIdx > 0 && (
                  <div className="h-6 flex items-center justify-center text-primary my-1">
                    <ArrowDown size={18} strokeWidth={2.5} />
                  </div>
                )}

                {/* The Step Box */}
                <div className="w-full relative bg-surface-container-lowest border-2 border-outline-variant rounded-m3-sm p-2 shadow-elev-1 transition-colors focus-within:border-primary focus-within:shadow-elev-2">
                  <textarea
                    id={`flowchart-step-${qbIdx}-${sIdx}`}
                    placeholder={t.stepPh}
                    value={stepStr}
                    onChange={e => {
                      updateStep(sIdx, e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onPaste={e => handlePasteSteps(e, sIdx)}
                    className="w-full bg-transparent border-none text-[12px] font-medium text-on-surface outline-none resize-none overflow-hidden min-h-[44px] pb-6 leading-relaxed placeholder:font-normal placeholder:text-on-surface-variant text-center"
                    rows={1}
                  />

                  {/* Magic Blank Button */}
                  <button
                    onClick={() => insertBlank(sIdx)}
                    className="m3-interactive absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-1 bg-primary-container text-on-primary-container rounded-m3-xs text-[9px] font-black transition-colors border border-transparent"
                  >
                    <SquareSquare size={10} /> {t.blank}
                  </button>

                  {/* Delete Step Button */}
                  <button
                    onClick={() => deleteStep(sIdx)} disabled={qb.steps.length === 1}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center opacity-0 group-hover/step:opacity-100 transition-opacity disabled:opacity-0 shadow-elev-1"
                  >
                    <X size={12}/>
                  </button>
                </div>
              </div>
            ))}

            {/* Add Step Button */}
            <div className="mt-4 pt-2 w-full flex justify-center border-t border-outline-variant">
              <Button variant="tonal" size="sm" icon={<Plus />} onClick={addStep} className="rounded-full">
                {t.addStep}
              </Button>
            </div>
          </div>
        </div>

        {/* 4. ANSWERS LIST */}
        <div className="space-y-1">
          <div className="flex gap-2 px-2 pb-1 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
            <span className="w-8 text-center">{t.qNum}</span>
            <span className="flex-1">{isWordBank ? t.correctLetter : t.acceptedAnswers}</span>
            <span className="w-14 text-center">{t.ref}</span>
            <span className="w-6"></span>
          </div>

          {qb.questions.map((row: any, rIdx: number) => (
            <AnswerRow
              key={rIdx} row={row} rIdx={rIdx}
              updateRow={updateRow} deleteRow={deleteQuestionRow}
              isWordBank={isWordBank} options={qb.options} totalRows={qb.questions.length}
              t={t}
            />
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addQuestionRow} className="mt-3">
          {t.addAnswerBox}
        </Button>
      </div>
    </div>
  );
}