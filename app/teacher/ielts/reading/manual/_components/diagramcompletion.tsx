'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Button, Spinner } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';

// 🌟 FIREBASE IMPORTS
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    selectLetter: "Select letter...",
    ansExample: "e.g. vegetation, plants",
    ref: "Ref",
    imgUploaded: "Rasm yuklandi!",
    imgUploadError: "Rasmni yuklashda xatolik yuz berdi!",
    qsLabel: "Qs:",
    wordBankOn: "Word Bank: ON",
    wordBankOff: "Word Bank: OFF",
    instructionsPh: "Instructions (e.g. Label the diagram below)...",
    hideWordBank: "Hide Word Bank",
    editWordBank: "Edit Word Bank",
    wordPh: "Word or phrase...",
    addWordOption: "Add Word Option",
    diagramTitlePh: "Diagram Title (Optional)...",
    uploading: "Yuklanmoqda...",
    clickToUpload: "Rasmni yuklash uchun bosing",
    altTextPh: "Alt Text (Impaired vision description)...",
    removeImage: "Remove Image",
    diagramPreview: "Diagram preview",
    colQ: "Q#",
    colCorrectLetter: "Correct Letter",
    colAcceptedAnswers: "Accepted Answers (Comma separated)",
    addLabelBox: "Add Label Box",
  },
  en: {
    selectLetter: "Select letter...",
    ansExample: "e.g. vegetation, plants",
    ref: "Ref",
    imgUploaded: "Image uploaded!",
    imgUploadError: "An error occurred while uploading the image!",
    qsLabel: "Qs:",
    wordBankOn: "Word Bank: ON",
    wordBankOff: "Word Bank: OFF",
    instructionsPh: "Instructions (e.g. Label the diagram below)...",
    hideWordBank: "Hide Word Bank",
    editWordBank: "Edit Word Bank",
    wordPh: "Word or phrase...",
    addWordOption: "Add Word Option",
    diagramTitlePh: "Diagram Title (Optional)...",
    uploading: "Uploading...",
    clickToUpload: "Click to upload an image",
    altTextPh: "Alt Text (Impaired vision description)...",
    removeImage: "Remove Image",
    diagramPreview: "Diagram preview",
    colQ: "Q#",
    colCorrectLetter: "Correct Letter",
    colAcceptedAnswers: "Accepted Answers (Comma separated)",
    addLabelBox: "Add Label Box",
  },
  ru: {
    selectLetter: "Выберите букву...",
    ansExample: "напр. растительность, растения",
    ref: "Ссыл.",
    imgUploaded: "Изображение загружено!",
    imgUploadError: "Произошла ошибка при загрузке изображения!",
    qsLabel: "Вопр.:",
    wordBankOn: "Банк слов: ВКЛ",
    wordBankOff: "Банк слов: ВЫКЛ",
    instructionsPh: "Инструкция (напр. Подпишите диаграмму ниже)...",
    hideWordBank: "Скрыть банк слов",
    editWordBank: "Редактировать банк слов",
    wordPh: "Слово или фраза...",
    addWordOption: "Добавить вариант",
    diagramTitlePh: "Название диаграммы (необязательно)...",
    uploading: "Загрузка...",
    clickToUpload: "Нажмите, чтобы загрузить изображение",
    altTextPh: "Альт. текст (описание для слабовидящих)...",
    removeImage: "Удалить изображение",
    diagramPreview: "Предпросмотр диаграммы",
    colQ: "В№",
    colCorrectLetter: "Верная буква",
    colAcceptedAnswers: "Принимаемые ответы (через запятую)",
    addLabelBox: "Добавить поле метки",
  },
};

// ==========================================================================
// INDIVIDUAL ANSWER ROW
// ==========================================================================
const AnswerRow = ({ row, rIdx, updateRow, deleteRow, isWordBank, options, totalRows }: any) => {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
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
          type="text" placeholder={t.ansExample}
          value={ansText}
          onChange={e => setAnsText(e.target.value)}
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary placeholder:text-on-surface-variant font-medium"
        />
      )}

      <input
        type="text" placeholder={t.ref} value={row.passage_reference || ''}
        onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())}
        className={`w-14 h-7 text-[10px] text-center font-bold rounded-m3-sm outline-none uppercase shrink-0 transition-colors
          ${row.passage_reference ? 'bg-tertiary-container border border-transparent text-on-tertiary-container focus:border-primary' : 'bg-transparent border border-dashed border-outline text-on-surface-variant hover:border-on-surface-variant focus:border-primary focus:bg-surface-container-lowest'}`}
      />

      <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-on-surface-variant hover:text-error opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function DiagramCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [showOptions, setShowOptions] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isWordBank = Array.isArray(qb.options);

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

  // ==========================================================================
  // 🌟 REAL FIREBASE IMAGE UPLOAD
  // ==========================================================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // 1. Create a safe, unique filename
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `ielts_diagrams/${timestamp}_${cleanFileName}`);

      // 2. Upload to Firebase Storage
      const snapshot = await uploadBytes(storageRef, file);
      
      // 3. Get the public URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // 4. Save the URL to your database schema
      updateBlock(qbIdx, 'diagram_url', downloadURL);

      // 5. Lazy Teacher Magic: Auto-fill diagram title if it's currently empty
      if (!qb.diagram_title) {
        const autoTitle = file.name
          .replace(/\.[^/.]+$/, "") // Remove extension
          .replace(/[-_]/g, " ")    // Replace dashes/underscores with spaces
          .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
        updateBlock(qbIdx, 'diagram_title', autoTitle);
      }

      toast.success(t.imgUploaded); // Image uploaded!
    } catch (error) {
      console.error("Upload failed", error);
      toast.error(t.imgUploadError);
    } finally {
      setIsUploading(false);
      // Reset input so they can upload the exact same file again if they deleted it
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  // ==========================================================================
  // 🌟 REAL FIREBASE IMAGE DELETE (Keeps storage clean!)
  // ==========================================================================
  const handleDeleteImage = async () => {
    if (!qb.diagram_url) return;
    
    try {
      // Create a reference directly from the download URL
      const imageRef = ref(storage, qb.diagram_url);
      await deleteObject(imageRef);
    } catch (error) {
      console.log("File already deleted or not found in storage.");
    }

    updateBlock(qbIdx, 'diagram_url', '');
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-m3-sm shadow-elev-1 group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-surface-container border-b border-outline-variant px-3 py-2 flex items-center justify-between rounded-t-m3-sm">
        <div className="flex items-center gap-3">
          <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-wider">
            DIAGRAM COMPLETION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-semibold select-none">
            {t.qsLabel} <span className="w-8 h-5 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded-m3-xs font-bold text-on-surface shadow-elev-1">{qb.start_question || 0}</span>
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
          <button onClick={toggleMode} className={`m3-interactive flex items-center gap-1.5 px-2 py-1 rounded-m3-sm text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 border ${isWordBank ? 'bg-tertiary-container text-on-tertiary-container border-transparent' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
            {isWordBank ? <><List size={12}/> {t.wordBankOn}</> : <><Type size={12}/> {t.wordBankOff}</>}
          </button>
        </div>

        {/* OPTIONAL WORD BANK EDITOR */}
        {isWordBank && (
          <div className="mb-4 bg-surface-container p-2 rounded-m3-sm border border-outline-variant">
            <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant hover:text-tertiary uppercase tracking-wider mb-2">
              <Edit3 size={10} /> {showOptions ? t.hideWordBank : t.editWordBank} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showOptions && (
              <div className="space-y-1.5 pt-2 border-t border-outline-variant">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-tertiary bg-surface-container-lowest border border-outline-variant rounded-m3-sm text-center outline-none focus:border-primary" maxLength={2} />
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

        {/* 🌟 IMAGE DROPZONE / PREVIEW AREA 🌟 */}
        <div className="bg-surface-container p-4 rounded-m3-sm border border-outline-variant mb-4 flex flex-col items-center">
          <input
            type="text" placeholder={t.diagramTitlePh}
            value={qb.diagram_title} onChange={e => updateBlock(qbIdx, 'diagram_title', e.target.value)}
            className="w-full bg-transparent border-none text-[13px] font-black text-on-surface outline-none mb-4 p-0 text-center placeholder:text-on-surface-variant"
          />

          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

          {!qb.diagram_url ? (
            // DROPZONE UI
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm h-32 border-2 border-dashed border-outline bg-surface-container-lowest rounded-m3-md flex flex-col items-center justify-center text-tertiary hover:bg-state-hover hover:border-tertiary transition-colors cursor-pointer"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Spinner size={24} />
                  <span className="text-[11px] font-bold">{t.uploading}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloud size={28} />
                  <span className="text-[11px] font-bold">{t.clickToUpload}</span>
                </div>
              )}
            </div>
          ) : (
            // IMAGE PREVIEW UI
            <div className="w-full flex flex-col items-center gap-3">
              <div className="relative group/img w-full max-w-sm">
                <img
                  src={qb.diagram_url}
                  alt={t.diagramPreview}
                  className="w-full rounded-m3-sm border border-outline-variant shadow-elev-1 object-contain max-h-48 bg-surface-container-lowest"
                />
                <button
                  onClick={handleDeleteImage}
                  className="absolute top-2 right-2 p-1.5 bg-surface-container-lowest text-error rounded-m3-sm shadow-elev-2 opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-error-container"
                  title={t.removeImage}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Alt Text Input */}
              <div className="w-full max-w-sm flex items-center gap-2 bg-surface-container-lowest px-2 rounded-m3-sm border border-outline-variant focus-within:border-primary">
                <ImageIcon size={14} className="text-on-surface-variant" />
                <input
                  type="text" placeholder={t.altTextPh}
                  value={qb.diagram_alt_text} onChange={e => updateBlock(qbIdx, 'diagram_alt_text', e.target.value)}
                  className="flex-1 h-7 text-[11px] bg-transparent outline-none text-on-surface placeholder:text-on-surface-variant"
                />
              </div>
            </div>
          )}
        </div>

        {/* ANSWERS LIST */}
        <div className="space-y-1">
          <div className="flex gap-2 px-2 pb-1 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
            <span className="w-8 text-center">{t.colQ}</span>
            <span className="flex-1">{isWordBank ? t.colCorrectLetter : t.colAcceptedAnswers}</span>
            <span className="w-14 text-center">{t.ref}</span>
            <span className="w-6"></span>
          </div>

          {qb.questions.map((row: any, rIdx: number) => (
            <AnswerRow
              key={rIdx} row={row} rIdx={rIdx}
              updateRow={updateRow} deleteRow={deleteQuestionRow}
              isWordBank={isWordBank} options={qb.options} totalRows={qb.questions.length}
            />
          ))}
        </div>

        <Button variant="text" size="sm" icon={<Plus />} onClick={addQuestionRow} className="mt-3">
          {t.addLabelBox}
        </Button>
      </div>
    </div>
  );
}