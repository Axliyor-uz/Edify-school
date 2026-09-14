'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, SquareSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    selectLetter: "Harfni tanlang...",
    answersRowPh: "masalan: floods, flood damage",
    refPh: "Ref",
    instructionsPh: "Yo'riqnoma...",
    wordBankOn: "So'z banki: YOQILGAN",
    wordBankOff: "So'z banki: O'CHIQ",
    hideWordBank: "So'z bankini yashirish",
    editWordBank: "So'z bankini tahrirlash",
    wordPh: "So'z yoki ibora...",
    addWordOption: "So'z varianti qo'shish",
    tableTitlePh: "Jadval sarlavhasi (ixtiyoriy)...",
    headerPh: (n: number) => `Ustun ${n}`,
    addColumn: "Ustun qo'shish",
    cellPh: "Shu yerga yozing...",
    blank: "BO'SH JOY",
    blankTitle: "Kursor turgan joyga bo'sh joy qo'shish",
    addTableRow: "Jadval qatorini qo'shish",
    qNum: "Savol raqami",
    correctLetter: "To'g'ri harf",
    acceptedAnswers: "Qabul qilinadigan javoblar (vergul bilan)",
    ref: "Ref",
    addAnswerBox: "Javob katagini qo'shish",
  },
  en: {
    selectLetter: "Select letter...",
    answersRowPh: "e.g. floods, flood damage",
    refPh: "Ref",
    instructionsPh: "Instructions...",
    wordBankOn: "Word Bank: ON",
    wordBankOff: "Word Bank: OFF",
    hideWordBank: "Hide Word Bank",
    editWordBank: "Edit Word Bank",
    wordPh: "Word or phrase...",
    addWordOption: "Add Word Option",
    tableTitlePh: "Table Title (Optional)...",
    headerPh: (n: number) => `Header ${n}`,
    addColumn: "Add Column",
    cellPh: "Type here...",
    blank: "BLANK",
    blankTitle: "Insert a blank at your cursor position",
    addTableRow: "Add Table Row",
    qNum: "Q#",
    correctLetter: "Correct Letter",
    acceptedAnswers: "Accepted Answers (Comma separated)",
    ref: "Ref",
    addAnswerBox: "Add Answer Box",
  },
  ru: {
    selectLetter: "Выберите букву...",
    answersRowPh: "напр.: floods, flood damage",
    refPh: "Ref",
    instructionsPh: "Инструкция...",
    wordBankOn: "Банк слов: ВКЛ",
    wordBankOff: "Банк слов: ВЫКЛ",
    hideWordBank: "Скрыть банк слов",
    editWordBank: "Редактировать банк слов",
    wordPh: "Слово или фраза...",
    addWordOption: "Добавить слово-вариант",
    tableTitlePh: "Заголовок таблицы (необязательно)...",
    headerPh: (n: number) => `Столбец ${n}`,
    addColumn: "Добавить столбец",
    cellPh: "Введите здесь...",
    blank: "ПРОПУСК",
    blankTitle: "Вставить пропуск в позиции курсора",
    addTableRow: "Добавить строку таблицы",
    qNum: "№",
    correctLetter: "Правильная буква",
    acceptedAnswers: "Допустимые ответы (через запятую)",
    ref: "Ref",
    addAnswerBox: "Добавить поле ответа",
  },
};

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
          ${row.passage_reference ? 'bg-secondary-container border border-transparent text-on-secondary-container focus:border-primary' : 'bg-transparent border border-dashed border-outline text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
      />

      <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
    </div>
  );
};

export default function TableCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);
  const isWordBank = Array.isArray(qb.options);

  useEffect(() => {
    let needsUpdate = false;
    let globalBracketIndex = 0;
    const currentNumbers = qb.questions.map((q: any) => q.question_number);

    // 🌟 Using rowObj.cells to satisfy Firebase logic
    const newRows = qb.rows.map((rowObj: any) => {
      const cellArray = rowObj.cells || rowObj; // Fallback in case old data structure exists
      
      const newCells = cellArray.map((cell: string) => {
        if (!cell) return cell;
        let cellUpdated = false;
        
        const newCell = cell.replace(/\[\s*\d*\s*\]|\[_\]|\[\]/g, (match) => {
          const expectedNum = currentNumbers[globalBracketIndex++];
          const replacement = expectedNum ? `[${expectedNum}]` : `[?]`;
          if (match !== replacement) cellUpdated = true;
          return replacement;
        });
        
        if (cellUpdated) needsUpdate = true;
        return newCell;
      });

      return { cells: newCells };
    });

    if (needsUpdate) {
      updateBlock(qbIdx, 'rows', newRows);
    }
  }, [qb.rows, qb.questions]);

  const toggleMode = () => {
    if (isWordBank) {
      updateBlock(qbIdx, 'options', null);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: [''] })));
    } else {
      updateBlock(qbIdx, 'options', [{ id: 'A', text: '' }, { id: 'B', text: '' }]);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: 'A' })));
    }
  };

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

  // 🌟 Table Grid Handlers Updated for Firebase ({cells: []})
  const addTableColumn = () => {
    updateBlock(qbIdx, 'headers', [...qb.headers, '']);
    updateBlock(qbIdx, 'rows', qb.rows.map((r: any) => ({ cells: [...(r.cells || r), ''] })));
  };

  const removeTableColumn = (cIdx: number) => {
    const newHeaders = [...qb.headers];
    newHeaders.splice(cIdx, 1);
    const newRows = qb.rows.map((r: any) => {
      const copy = [...(r.cells || r)];
      copy.splice(cIdx, 1);
      return { cells: copy };
    });
    updateBlock(qbIdx, 'headers', newHeaders);
    updateBlock(qbIdx, 'rows', newRows);
  };

  const addTableRow = () => {
    const newRows = [...qb.rows];
    newRows.push({ cells: new Array(qb.headers.length).fill('') });
    updateBlock(qbIdx, 'rows', newRows);
  };

  const updateCell = (rIdx: number, cIdx: number, val: string) => {
    const newRows = [...qb.rows];
    const cellArray = [...(newRows[rIdx].cells || newRows[rIdx])];
    cellArray[cIdx] = val;
    newRows[rIdx] = { cells: cellArray };
    updateBlock(qbIdx, 'rows', newRows);
  };

  const insertBlank = (rIdx: number, cIdx: number) => {
    const cellId = `table-cell-${qbIdx}-${rIdx}-${cIdx}`;
    const el = document.getElementById(cellId) as HTMLTextAreaElement;
    
    const cellArray = qb.rows[rIdx].cells || qb.rows[rIdx];
    const currentVal = cellArray[cIdx] || '';
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
    
    updateCell(rIdx, cIdx, newVal);
    addQuestionRow();
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">TABLE COMPLETION</span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span> - <span className="w-8 h-5 flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-m3-xs font-bold text-on-surface-variant">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-4 mb-3">
          <input type="text" placeholder={t.instructionsPh} value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} className="flex-1 bg-transparent border-none text-[11px] font-bold text-on-surface outline-none p-0 mt-1" />
          <button onClick={toggleMode} className={`m3-interactive flex items-center gap-1.5 px-2 py-1 rounded-m3-sm text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 border ${isWordBank ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
            {isWordBank ? <><List size={12}/> {t.wordBankOn}</> : <><Type size={12}/> {t.wordBankOff}</>}
          </button>
        </div>

        {isWordBank && (
          <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant">
            <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-secondary uppercase tracking-wider mb-2">
              <Edit3 size={10} /> {showOptions ? t.hideWordBank : t.editWordBank} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showOptions && (
              <div className="space-y-1.5 pt-2 border-t border-outline-variant">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-secondary bg-surface-container-lowest border border-outline-variant rounded-m3-sm text-center outline-none focus:border-primary" maxLength={2} />
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

        <div className="bg-surface-container p-3 rounded-m3-sm border border-outline-variant mb-4 overflow-x-auto custom-scrollbar">
          <input type="text" placeholder={t.tableTitlePh} value={qb.table_title} onChange={e => updateBlock(qbIdx, 'table_title', e.target.value)} className="w-full bg-transparent border-none text-[13px] font-black text-on-surface outline-none mb-4 p-0 text-center placeholder:text-on-surface-variant" />

          <div className="min-w-[500px]">
            <div className="flex gap-2 mb-2">
              {qb.headers.map((h: string, hIdx: number) => (
                <div key={hIdx} className="flex-1 relative group/col">
                  <input type="text" placeholder={t.headerPh(hIdx + 1)} value={h} onChange={e => { const newH = [...qb.headers]; newH[hIdx] = e.target.value; updateBlock(qbIdx, 'headers', newH); }} className="w-full h-8 text-[11px] font-bold bg-surface-container-high text-on-surface border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary text-center" />
                  <button onClick={() => removeTableColumn(hIdx)} disabled={qb.headers.length === 1} className="absolute -top-2 -right-2 w-4 h-4 bg-error text-on-error rounded-full flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity disabled:opacity-0 shadow-elev-1"><X size={10}/></button>
                </div>
              ))}
              <IconButton aria-label={t.addColumn} variant="tonal" size="sm" onClick={addTableColumn} className="rounded-m3-sm shrink-0" title={t.addColumn}><Plus size={14}/></IconButton>
            </div>

            <div className="space-y-2">
              {qb.rows.map((rowObj: any, rIdx: number) => (
                <div key={rIdx} className="flex gap-2 group/trow">
                  {(rowObj.cells || rowObj).map((cell: string, cIdx: number) => (
                    <div key={cIdx} className="flex-1 relative group/cell">
                      <textarea id={`table-cell-${qbIdx}-${rIdx}-${cIdx}`} placeholder={t.cellPh} value={cell} onChange={e => { updateCell(rIdx, cIdx, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} className="w-full bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 pt-1.5 pb-6 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary resize-none overflow-hidden min-h-[46px] leading-relaxed" rows={1} />
                      <button onClick={() => insertBlank(rIdx, cIdx)} className="m3-interactive absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-1 bg-secondary-container text-on-secondary-container rounded-m3-xs text-[9px] font-black transition-colors border border-transparent" title={t.blankTitle}><SquareSquare size={10} /> {t.blank}</button>
                    </div>
                  ))}
                  <button onClick={() => { const newR = [...qb.rows]; newR.splice(rIdx, 1); updateBlock(qbIdx, 'rows', newR); }} disabled={qb.rows.length === 1} className="w-8 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/trow:opacity-100 transition-opacity disabled:opacity-0 shrink-0"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>

            <Button variant="text" size="sm" icon={<Plus />} onClick={addTableRow} className="mt-3">{t.addTableRow}</Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex gap-2 px-2 pb-1 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
            <span className="w-8 text-center">{t.qNum}</span>
            <span className="flex-1">{isWordBank ? t.correctLetter : t.acceptedAnswers}</span>
            <span className="w-14 text-center">{t.ref}</span>
            <span className="w-6"></span>
          </div>

          {qb.questions.map((row: any, rIdx: number) => (
            <AnswerRow key={rIdx} row={row} rIdx={rIdx} updateRow={updateRow} deleteRow={deleteQuestionRow} isWordBank={isWordBank} options={qb.options} totalRows={qb.questions.length} t={t} />
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addQuestionRow} className="mt-3">{t.addAnswerBox}</Button>
      </div>
    </div>
  );
}