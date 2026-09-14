'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Printer, Columns, Type, Layout,
  Minus, Plus, Smartphone, Grid, ZoomIn, ZoomOut,
  CheckSquare, ScanLine,
  List, Grid3X3, Shuffle, Settings, Edit3, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { useTeacherLanguage } from '@/app/teacher/layout';
import DownloadPdfButton from '@/app/teacher/print/_components/DownloadPdfButton';
import { Button, IconButton } from '@/components/ui';
import { normalizeQuestions, getText } from '@/lib/questionSchema';
import type { NormalizedOption, NormalizedPart, NormalizedQuestion } from '@/types/question';

// --- TRANSLATION DICTIONARY ---
const PRINT_TRANSLATIONS = {
  uz: {
    title: "Chop Etish Studiyasi", back: "Ortga", shuffle: "Savollarni Aralashtirish",
    layout: "Ko'rinish", cols: "{n} Ustun", lines: "Ajratuvchi chiziqlar",
    header: "Sarlavha Ma'lumotlari", schoolPlace: "Maktab / O'quv markaz nomi", teacherPlace: "O'qituvchi", studentInfo: "O'quvchi Ma'lumotlari (Ism, Sana...)",
    typography: "Matn Sozlamalari", size: "O'lcham",
    answers: "Javoblar Varaqasi", ansStyles: { none: "Yo'q", standard: "Standart", writein: "Yozma (Katak)", grid: "Katakli" },
    keys: "Javoblar Kaliti", keyStyles: { none: "Yashirin", inline: "Savol yonida", end: "Sahifa oxirida" },
    download: "HTML Yuklab Olish", print: "Hujjatni Chop Etish", preview: "Ko'rib Chiqish",
    total: "Jami Savollar", name: "Ism", date: "Sana", group: "Guruh", score: "Ball",
    ans: "Javob"
  },
  en: {
    title: "Print Studio", back: "Go Back", shuffle: "Shuffle Questions",
    layout: "Layout", cols: "{n} Col", lines: "Divider Lines",
    header: "Header Details", schoolPlace: "School / Center Name", teacherPlace: "Teacher Name", studentInfo: "Student Info Header",
    typography: "Typography", size: "Size",
    answers: "Bubble Sheet", ansStyles: { none: "None", standard: "Standard", writein: "Write-in", grid: "Grid" },
    keys: "Answer Key", keyStyles: { none: "Hidden", inline: "Inline", end: "End of Page" },
    download: "Download HTML", print: "Print Document", preview: "Preview",
    total: "Total Questions", name: "Name", date: "Date", group: "Group", score: "Score",
    ans: "Answer"
  },
  ru: {
    title: "Студия Печати", back: "Назад", shuffle: "Перемешать Вопросы",
    layout: "Макет", cols: "{n} Кол", lines: "Разделительные линии",
    header: "Заголовок", schoolPlace: "Название Школы", teacherPlace: "Имя Учителя", studentInfo: "Шапка Ученика",
    typography: "Типография", size: "Размер",
    answers: "Бланк Ответов", ansStyles: { none: "Нет", standard: "Стандарт", writein: "Вписать", grid: "Сетка" },
    keys: "Ключи Ответов", keyStyles: { none: "Скрыто", inline: "Рядом", end: "В конце" },
    download: "Скачать HTML", print: "Распечатать", preview: "Предпросмотр",
    total: "Всего вопросов", name: "Имя", date: "Дата", group: "Группа", score: "Балл",
    ans: "Ответ"
  }
};

// Trilingual text → a printable string. Goes through the schema helper so an
// image-only option (empty {uz,ru,en}) yields "" instead of a JSON dump.
const getContentText = (content: any) => getText(content);

// ─── Blocks (multi_part / shared_options) ──────────────────────────────────
// A block is ONE document holding a stem plus N sub-questions (`q.parts`). Its
// answer lives per PART — `q.answer` / `q.optionList` are empty or (for
// `shared_options`) a pool the parts share, so a block rendered like a normal
// question prints as a bare stem with no sub-questions and no answers.

/**
 * The shared A–F pool of a `shared_options` block, or [] for `multi_part`.
 * `normalizeQuestion()` hands every part of a shared_options block the SAME
 * `optionList` ARRAY as the block itself, so identity (not deep-equality) is the
 * exact test — the runner and QuestionPartsPreview detect it the same way.
 */
const sharedPoolOf = (q: NormalizedQuestion): NormalizedOption[] =>
  q.isBlock && q.optionList.length > 0 && q.parts.every(p => p.optionList === q.optionList)
    ? q.optionList
    : [];

/**
 * How a part is addressed on the answer key / bubble sheet.
 * Parts already numbered like a paper ("33", "34") stand alone; letter parts
 * hang off the question number → "12a", "12b".
 */
const partLabel = (qIdx: number, partId: string) =>
  /^\d+$/.test(partId) ? partId : `${qIdx + 1}${partId}`;

/** Correct answer of a part as a printable string (letter, letters, or typed text). */
const partAnswerText = (part: NormalizedPart) => {
  const v = part.correctAnswer.value;
  return (Array.isArray(v) ? v : [v]).map(x => String(x ?? '')).filter(Boolean).join(', ');
};

// ─── A4 dimensions at 96dpi (browser px) ───────────────────────────────────
// 210mm × 297mm  →  794px × 1123px
const A4_W_PX = 794;
const A4_H_PX = 1123;

// ─── Shared print styles injected once into <head> ─────────────────────────
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  body { background: white !important; }
  body * { visibility: hidden; }
  #print-pages-root, #print-pages-root * { visibility: visible; }
  #print-pages-root {
    position: absolute;
    left: 0; top: 0;
    width: 100%;
    transform: none !important;
  }
  .print-page {
    width: 210mm !important;
    height: 297mm !important;
    padding: 15mm !important;
    box-shadow: none !important;
    margin: 0 !important;
    page-break-after: always;
    break-after: page;
    overflow: hidden !important;
  }
  .print-page:last-child { page-break-after: avoid; break-after: avoid; }
  .katex { line-height: normal !important; }
  .katex-html { padding-top: 0.2em; padding-bottom: 0.2em; }
}
`;

export default function PrintStudioPage() {
  const { lang } = useTeacherLanguage();
  const t = PRINT_TRANSLATIONS[lang] || PRINT_TRANSLATIONS['en'];

  const [isLoaded, setIsLoaded] = useState(false);
  const [originalData, setOriginalData] = useState<{ title: string } | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<NormalizedQuestion[]>([]);

  // ─── Config ────────────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<1 | 2 | 3>(2);
  const [showLines, setShowLines] = useState(true);
  const [headerInfo, setHeaderInfo] = useState({ school: '', teacher: '' });
  const [showStudentHeader, setShowStudentHeader] = useState(true);
  const [fontSize, setFontSize] = useState<number>(11);
  const [showAnswers, setShowAnswers] = useState<'none' | 'inline' | 'end'>('none');
  const [answerSheet, setAnswerSheet] = useState<'none' | 'standard' | 'writein' | 'grid'>('none');
  const [previewZoom, setPreviewZoom] = useState(0.75);

  // ─── Pagination state ──────────────────────────────────────────────────────
  // pages[i] = array of question indices that belong on page i
  const [pages, setPages] = useState<number[][]>([]);

  // Ref to the hidden measurement container
  const measureRef = useRef<HTMLDivElement>(null);
  // Ref to the print pages root (for PDF download)
  const printRootRef = useRef<HTMLDivElement>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  // The payload is a frozen snapshot of custom_tests.questions[] handed over by
  // PrintLauncher — it may be legacy-shaped OR canonical v1. Normalize once here,
  // at the read boundary; everything below renders the legacy-shaped view model.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('print_payload');
      if (stored) {
        const parsed = JSON.parse(stored);
        setOriginalData({ title: parsed?.title || '' });
        setActiveQuestions(normalizeQuestions(parsed?.questions));
      }
    } catch (e) { console.error("Load error"); }
    finally { setIsLoaded(true); }
  }, []);

  // ─── Inject print CSS once ─────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ─── Pagination engine ─────────────────────────────────────────────────────
  // We measure each question's rendered height inside a hidden off-screen div
  // that exactly mirrors the A4 content-area width, then bin questions into pages.
  const paginate = useCallback(() => {
    if (!measureRef.current || activeQuestions.length === 0) return;

    const container = measureRef.current;

    // A4 content area height in px (A4_H_PX minus top+bottom padding)
    // padding: 15mm each side → 15/25.4*96 ≈ 56.7px per side
    const MM_TO_PX = 96 / 25.4;
    const PAD_TOP = 15 * MM_TO_PX;    // 15mm top padding
    const PAD_BOTTOM = 15 * MM_TO_PX; // 15mm bottom padding
    // First page also has the header block — measured dynamically below
    const contentHeight = A4_H_PX - PAD_TOP - PAD_BOTTOM;

    // Measure the header height (rendered once in the measure container)
    const headerEl = container.querySelector<HTMLElement>('.measure-header');
    const headerH = headerEl ? headerEl.getBoundingClientRect().height + 20 : 120; // +20 for margin

    // Measure the answer-sheet section height
    const ansEl = container.querySelector<HTMLElement>('.measure-anssheet');
    const ansH = ansEl ? ansEl.getBoundingClientRect().height + 48 : 0; // +48 for border/padding

    // Measure each question item
    const questionEls = container.querySelectorAll<HTMLElement>('.measure-question');
    const qHeights: number[] = [];
    questionEls.forEach(el => {
      qHeights.push(el.getBoundingClientRect().height + 24); // +24 for mb-6 gap
    });

    // ── Bin into pages ─────────────────────────────────────────────────────
    // For multi-column layout we divide content height into column height.
    // Questions flow left-to-right across columns on a page.
    const newPages: number[][] = [];
    let currentPage: number[] = [];
    // Columns per page
    const colCount = columns;
    // Each column has its own fill level
    let colFills = new Array(colCount).fill(0); // px filled in each column
    let currentCol = 0;

    const firstPageColHeight = (contentHeight - headerH) / colCount > 0
      ? contentHeight - headerH  // total height minus header, then columns share it
      : contentHeight;

    // Actually: columns run in parallel, so available height = contentHeight - headerH (page 1)
    const pageColHeight = (isFirstPage: boolean) =>
      isFirstPage ? contentHeight - headerH : contentHeight;

    let isFirst = true;

    for (let i = 0; i < activeQuestions.length; i++) {
      const qH = qHeights[i] ?? 80;
      const availH = pageColHeight(isFirst);

      // Find a column on the current page that fits
      let placed = false;
      for (let c = currentCol; c < colCount; c++) {
        if (colFills[c] + qH <= availH) {
          colFills[c] += qH;
          currentPage.push(i);
          currentCol = c;
          placed = true;
          break;
        }
      }

      if (!placed) {
        // No column fits → start a new page
        newPages.push(currentPage);
        currentPage = [i];
        colFills = new Array(colCount).fill(0);
        colFills[0] = qH;
        currentCol = 0;
        isFirst = false;
      }
    }

    if (currentPage.length > 0) {
      newPages.push(currentPage);
    }

    setPages(newPages);
  }, [activeQuestions, columns, fontSize, headerInfo, showStudentHeader, answerSheet]);

  // Re-paginate whenever relevant config changes
  useEffect(() => {
    // Small delay so React has rendered the measure container
    const id = setTimeout(paginate, 100);
    return () => clearTimeout(id);
  }, [paginate]);

  const handleShuffle = () => {
    setActiveQuestions(prev => [...prev].sort(() => 0.5 - Math.random()));
  };

  const handleNativePrint = () => window.print();

  // ─── Render helpers ────────────────────────────────────────────────────────
  // One option of a normal question / of a part that owns its options — the same
  // markup either way, so a block's options print exactly like everyone else's.
  const renderOption = (opt: NormalizedOption, correctKeys: string[]) => {
    const isCorrect = correctKeys.includes(opt.id);
    const showCorrect = showAnswers === 'inline' && isCorrect;
    const rawText = getContentText(opt.text);
    const safeText = rawText ? rawText.replace(/\$\$/g, '$') : '';
    return (
      <div key={opt.id} className={`flex items-start gap-1.5 text-on-surface ${showCorrect ? 'font-bold' : ''}`}>
        <span className="font-bold shrink-0 mt-[0.15em] text-[0.95em] text-on-surface">
          {opt.id}.
        </span>
        <span className="text-[0.95em] leading-relaxed break-words py-0.5">
          {safeText && <LatexRenderer latex={safeText} />}
          {opt.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={opt.imageUrl}
              alt=""
              style={{ maxHeight: '22mm', marginTop: safeText ? '0.25rem' : 0 }}
              className="block max-w-full object-contain border border-outline-variant rounded-m3-xs"
            />
          )}
        </span>
      </div>
    );
  };

  /**
   * The body of a BLOCK: the shared pool (printed ONCE, boxed, two columns —
   * the "33-35 testlar" layout), then every sub-question with either its own
   * options or a `Javob: ____` line.
   */
  const renderBlockBody = (q: NormalizedQuestion) => {
    const sharedPool = sharedPoolOf(q);
    const optCols = columns === 3 ? '1fr' : 'repeat(2, 1fr)';

    return (
      <div style={{ marginLeft: '1.5rem' }}>
        {/* The pool — once for the whole block, never per part. */}
        {sharedPool.length > 0 && (
          <div
            className="border border-outline rounded-m3-xs"
            style={{
              display: 'grid',
              gridTemplateColumns: optCols,
              gap: '0.35rem 1rem',
              padding: '2mm 3mm',
              marginBottom: '0.75rem',
            }}
          >
            {sharedPool.map((opt) => {
              const rawText = getContentText(opt.text);
              const safeText = rawText ? rawText.replace(/\$\$/g, '$') : '';
              return (
                <div key={opt.id} className="flex items-start gap-1.5 text-on-surface">
                  <span className="font-bold shrink-0 text-[0.95em]">{opt.id})</span>
                  <span className="text-[0.95em] leading-relaxed break-words">
                    {safeText && <LatexRenderer latex={safeText} />}
                    {opt.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.imageUrl}
                        alt=""
                        style={{ maxHeight: '18mm', marginTop: safeText ? '0.25rem' : 0 }}
                        className="block max-w-full object-contain border border-outline-variant rounded-m3-xs"
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Every sub-question. */}
        {q.parts.map((part) => {
          const correctKeys = Array.isArray(part.correctAnswer.value)
            ? part.correctAnswer.value
            : [String(part.correctAnswer.value ?? '')];
          const isTyped = part.optionList.length === 0;
          const ownsOptions = part.optionList.length > 0 && sharedPool.length === 0;

          return (
            <div key={part.id} style={{ marginBottom: '0.6rem' }}>
              <div className="flex items-start gap-1.5">
                <span className="font-bold shrink-0 text-[1em] mt-[0.1em] text-on-surface">
                  {part.id})
                </span>
                <div className="text-on-surface leading-relaxed text-[1em]">
                  <LatexRenderer latex={getContentText(part.prompt)} />
                </div>
              </div>

              {/* The part owns its options (multi_part) → print them under it. */}
              {ownsOptions && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: optCols,
                  gap: '0.4rem 1rem',
                  marginLeft: '1.2rem',
                  marginTop: '0.35rem',
                }}>
                  {part.optionList.map((opt) => renderOption(opt, correctKeys))}
                </div>
              )}

              {/* The part picks from the pool above → only the letter is needed. */}
              {!isTyped && !ownsOptions && showAnswers === 'inline' && (
                <div
                  className="font-bold text-[0.95em] text-on-surface"
                  style={{ marginLeft: '1.2rem', marginTop: '0.2rem' }}
                >
                  {t.ans}: {correctKeys.join(', ')}
                </div>
              )}

              {/* Typed part → a blank to write on, or the answer when keys are inline. */}
              {isTyped && (
                <div
                  className="flex items-end gap-2 text-[0.95em] text-on-surface"
                  style={{ marginLeft: '1.2rem', marginTop: '0.3rem' }}
                >
                  <span className="font-bold shrink-0">{t.ans}:</span>
                  {showAnswers === 'inline' ? (
                    <span
                      className="font-bold border-b border-on-surface"
                      style={{ minWidth: '30mm', paddingBottom: '0.1rem' }}
                    >
                      <LatexRenderer latex={partAnswerText(part)} />
                    </span>
                  ) : (
                    <span
                      className="inline-block border-b border-on-surface"
                      style={{ width: '40mm', height: '1.1em' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestion = (q: NormalizedQuestion, idx: number, globalIdx: number) => {
    return (
      <div
        key={q.id || globalIdx}
        className="mb-6"
        style={{ breakInside: 'avoid-column', display: 'inline-block', width: '100%', paddingTop: '0.2rem' }}
      >
        <div className="flex items-start gap-2 mb-2.5">
          <span className="font-bold text-on-surface shrink-0 text-[1.1em] mt-[0.1em]">
            {globalIdx + 1}.
          </span>
          <div className="text-on-surface leading-relaxed text-[1em] py-1">
            <LatexRenderer latex={getContentText(q.question)} />
          </div>
        </div>

        {/* Prompt image (v1 `image.downloadUrl` / legacy `imageUrl`) */}
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={q.imageUrl}
            alt=""
            style={{ maxHeight: '38mm', marginLeft: '1.5rem', marginBottom: '0.75rem' }}
            className="max-w-full object-contain border border-outline-variant rounded-m3-xs"
          />
        )}

        <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="ml-6 mb-2 text-on-surface-variant" iconSize={10} />

        {/* A block answers through its PARTS — its own optionList is either empty
            (multi_part) or the shared pool, which renderBlockBody prints once. */}
        {q.isBlock ? renderBlockBody(q) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: columns === 3 ? '1fr' : 'repeat(2, 1fr)',
            gap: '0.75rem 1rem',
            marginLeft: '1.5rem'
          }}>
            {q.optionList.map((opt) =>
              // multiple_select stores a letter[] — a `=== q.answer` compare would highlight nothing.
              renderOption(opt, Array.isArray(q.correctAnswer.value) ? q.correctAnswer.value : [q.answer])
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="mb-5 pb-3 border-b-2 border-on-surface">
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          {headerInfo.school && (
            <h3 className="text-[1.1em] font-black uppercase tracking-widest text-on-surface-variant mb-1">
              {headerInfo.school}
            </h3>
          )}
          <h1 className="text-[2em] font-black text-on-surface uppercase leading-tight">
            {originalData?.title}
          </h1>
          {headerInfo.teacher && (
            <div className="text-[0.9em] font-bold text-on-surface-variant mt-1">
              {t.teacherPlace}: {headerInfo.teacher}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-on-surface-variant text-[0.8em] uppercase tracking-widest">
            {t.total}: <span className="text-on-surface text-[1.2em] ml-1">{activeQuestions.length}</span>
          </div>
        </div>
      </div>
      {showStudentHeader && (
        <div className="flex gap-4 mt-5 pt-2 text-[0.9em]">
          <div className="flex-1 flex items-end gap-2">
            <span className="font-bold uppercase tracking-wide shrink-0">{t.name}:</span>
            <div className="flex-1 border-b border-outline h-4"></div>
          </div>
          <div className="w-32 flex items-end gap-2">
            <span className="font-bold uppercase tracking-wide shrink-0">{t.date}:</span>
            <div className="flex-1 border-b border-outline h-4"></div>
          </div>
          <div className="w-24 flex items-end gap-2">
            <span className="font-bold uppercase tracking-wide shrink-0">{t.group}:</span>
            <div className="flex-1 border-b border-outline h-4"></div>
          </div>
          <div className="w-20 flex items-end gap-2">
            <span className="font-bold uppercase tracking-wide shrink-0">{t.score}:</span>
            <div className="flex-1 border-b border-outline h-4"></div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Bubble-sheet rows ─────────────────────────────────────────────────────
  // One row per ANSWER, not per document: a normal question is one row with the
  // hardcoded A–D bubbles it has always had; a block contributes one row PER PART,
  // bubbled with that part's own option ids (which run up to F on a shared pool).
  // Typed parts carry no bubbles — they get a write-in line, and are skipped by
  // the bubbled styles entirely.
  type SheetRow = { key: string; label: string; bubbles: string[] };

  const sheetRows: SheetRow[] = [];
  activeQuestions.forEach((q, idx) => {
    if (q.isBlock) {
      q.parts.forEach((part) => {
        sheetRows.push({
          key: `${idx}-${part.id}`,
          label: partLabel(idx, part.id),
          bubbles: part.optionList.map((o) => o.id),
        });
      });
      return;
    }
    sheetRows.push({ key: String(idx), label: String(idx + 1), bubbles: ['A', 'B', 'C', 'D'] });
  });
  const bubbleRows = sheetRows.filter((r) => r.bubbles.length > 0);

  const renderAnswerSheet = () => {
    if (answerSheet === 'none') return null;
    return (
      <div className="mt-8 pt-6 border-t-2 border-on-surface">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[1.2em] font-black uppercase tracking-widest">{t.answers}</h2>
          <div className="flex items-end gap-2">
            <span className="text-[0.9em] font-bold uppercase tracking-wide">{t.score}:</span>
            <div className="w-16 h-8 border-2 border-on-surface rounded-m3-xs"></div>
          </div>
        </div>
        {answerSheet === 'standard' && (
          <div style={{ columnCount: columns === 1 ? 2 : columns === 2 ? 3 : 4, columnGap: '2rem', fontSize: '0.9em' }}>
            {bubbleRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3 mb-2" style={{ breakInside: 'avoid' }}>
                <span className="font-black w-6 text-right">{row.label}.</span>
                <div className="flex gap-1.5">
                  {row.bubbles.map(opt => (
                    <div key={opt} className="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center font-bold text-[0.7em] text-on-surface-variant">
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {answerSheet === 'writein' && (
          // The write-in sheet is a blank line, so typed parts belong here too.
          <div style={{ columnCount: columns === 1 ? 2 : columns === 2 ? 4 : 5, columnGap: '1.5rem', fontSize: '0.9em' }}>
            {sheetRows.map((row) => (
              <div key={row.key} className="flex items-end gap-2 mb-3" style={{ breakInside: 'avoid' }}>
                <span className="font-black w-6 text-right">{row.label}.</span>
                <div className="w-10 h-6 border-b-2 border-on-surface bg-surface-container"></div>
              </div>
            ))}
          </div>
        )}
        {answerSheet === 'grid' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns === 1 ? 2 : columns === 2 ? 4 : 5}, 1fr)`,
            gap: '0.75rem',
            fontSize: '0.85em'
          }}>
            {bubbleRows.map((row) => (
              <div key={row.key} className="border-2 border-outline-variant p-2 rounded-m3-sm flex justify-between items-center bg-surface-container">
                <span className="font-black mr-2">{row.label}</span>
                <div className="flex gap-1">
                  {row.bubbles.map(opt => (
                    <div key={opt} className="w-4 h-4 rounded-full border border-outline flex items-center justify-center text-[0.65em] font-bold text-on-surface-variant bg-surface-container-lowest">
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAnswerKey = () => {
    if (showAnswers !== 'end') return null;
    return (
      <div className="mt-8 pt-6 border-t-2 border-dashed border-outline">
        <h3 className="font-black text-[1.2em] text-on-surface mb-4 uppercase tracking-widest flex items-center gap-2">
          <CheckSquare size={18} /> {t.keys}
        </h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[1em] font-mono">
          {activeQuestions.map((q, idx) =>
            // A block has no top-level answer — one entry PER PART ("12a. 2", "33. C").
            q.isBlock
              ? q.parts.map((part) => (
                  <span key={`${idx}-${part.id}`} className="inline-block bg-surface-container px-2 py-1 border border-outline-variant rounded-m3-xs">
                    <strong className="text-on-surface-variant mr-1">{partLabel(idx, part.id)}.</strong>
                    <span className="font-black">{partAnswerText(part)}</span>
                  </span>
                ))
              : (
                <span key={idx} className="inline-block bg-surface-container px-2 py-1 border border-outline-variant rounded-m3-xs">
                  <strong className="text-on-surface-variant mr-1">{idx + 1}.</strong>
                  <span className="font-black">{q.answer}</span>
                </span>
              )
          )}
        </div>
      </div>
    );
  };

  // ─── A4 page paper style ───────────────────────────────────────────────────
  const paperStyle: React.CSSProperties = {
    width: `${A4_W_PX}px`,
    height: `${A4_H_PX}px`,
    padding: '15mm',
    fontSize: `${fontSize}pt`,
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  if (!isLoaded) return null;
  if (!originalData) return (
    <div className="p-10 text-center font-bold text-on-surface-variant">
      No data found. Please return to the library and select a test to print.
    </div>
  );

  return (
    /*
      ROOT: full viewport, no overflow, flex row
      - Sidebar: fixed width, independent scroll
      - Preview: flex-1, overflow-hidden (its inner scroller handles scroll)
    */
    <div className="h-screen overflow-hidden bg-surface flex flex-row font-t-body text-on-surface print:bg-surface-container-lowest print:block print:h-auto print:overflow-visible">

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 bg-surface-container-low border-r border-outline-variant h-screen overflow-y-auto flex flex-col shadow-elev-2 z-20 print:hidden">

        <div className="p-5 border-b border-outline-variant bg-surface-container-low sticky top-0 z-10 flex items-center justify-between">
          <h2 className="font-black text-[16px] text-on-surface tracking-tight flex items-center gap-2">
            <Printer size={18} className="text-primary" /> {t.title}
          </h2>
          <Link href="/teacher/library" className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors">
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">

          <Button variant="tonal" size="lg" onClick={handleShuffle} icon={<Shuffle strokeWidth={2.5} />} className="w-full">
            {t.shuffle}
          </Button>

          {/* Layout */}
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-m3-lg shadow-elev-1 space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Layout size={14} /> {t.layout}</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(col => (
                <button key={col} onClick={() => setColumns(col as any)} className={`p-2 rounded-m3-md border text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all ${columns === col ? 'bg-primary text-on-primary border-primary shadow-elev-2' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-state-hover hover:text-on-surface'}`}>
                  {col === 1 ? <Smartphone size={16} /> : col === 2 ? <Columns size={16} /> : <Grid size={16} />}
                  {t.cols.replace("{n}", col.toString())}
                </button>
              ))}
            </div>
            {columns > 1 && (
              <label className="flex items-center gap-2 cursor-pointer mt-3 text-[12px] font-bold text-on-surface-variant">
                <input type="checkbox" checked={showLines} onChange={() => setShowLines(!showLines)} className="rounded border-outline text-primary focus:ring-primary" /> {t.lines}
              </label>
            )}
          </div>

          {/* Header Info */}
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-m3-lg shadow-elev-1 space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Settings size={14} /> {t.header}</label>
            <input type="text" placeholder={t.schoolPlace} value={headerInfo.school} onChange={e => setHeaderInfo({ ...headerInfo, school: e.target.value })} className="w-full px-3 py-2.5 text-[13px] bg-surface-container-lowest border border-outline-variant rounded-m3-md focus:border-primary outline-none font-medium transition-colors" />
            <input type="text" placeholder={t.teacherPlace} value={headerInfo.teacher} onChange={e => setHeaderInfo({ ...headerInfo, teacher: e.target.value })} className="w-full px-3 py-2.5 text-[13px] bg-surface-container-lowest border border-outline-variant rounded-m3-md focus:border-primary outline-none font-medium transition-colors" />
            <label className="flex items-center gap-2 cursor-pointer mt-2 text-[12px] font-bold text-on-surface-variant">
              <input type="checkbox" checked={showStudentHeader} onChange={() => setShowStudentHeader(!showStudentHeader)} className="rounded border-outline text-primary focus:ring-primary" /> {t.studentInfo}
            </label>
          </div>

          {/* Typography */}
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-m3-lg shadow-elev-1 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><Type size={14} /> {t.typography}</label>
              <span className="text-[10px] font-black bg-surface-container-high px-2 py-0.5 rounded-m3-xs text-on-surface-variant">{fontSize}pt</span>
            </div>
            <div className="flex items-center gap-3 bg-surface-container p-1.5 rounded-m3-md border border-outline-variant">
              <IconButton aria-label="Shriftni kichraytirish" size="sm" onClick={() => setFontSize(Math.max(8, fontSize - 1))} className="bg-surface-container-lowest shadow-elev-1"><Minus /></IconButton>
              <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((fontSize - 8) / 16) * 100}%` }}></div>
              </div>
              <IconButton aria-label="Shriftni kattalashtirish" size="sm" onClick={() => setFontSize(Math.min(24, fontSize + 1))} className="bg-surface-container-lowest shadow-elev-1"><Plus /></IconButton>
            </div>
          </div>

          {/* Answer Sheet */}
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-m3-lg shadow-elev-1 space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><ScanLine size={14} /> {t.answers}</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAnswerSheet('none')} className={`p-2 rounded-m3-md border text-[11px] font-bold ${answerSheet === 'none' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}>{t.ansStyles.none}</button>
              <button onClick={() => setAnswerSheet('standard')} className={`p-2 rounded-m3-md border text-[11px] font-bold flex items-center justify-center gap-1 ${answerSheet === 'standard' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}><List size={14} /> {t.ansStyles.standard}</button>
              <button onClick={() => setAnswerSheet('writein')} className={`p-2 rounded-m3-md border text-[11px] font-bold flex items-center justify-center gap-1 ${answerSheet === 'writein' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}><Edit3 size={14} /> {t.ansStyles.writein}</button>
              <button onClick={() => setAnswerSheet('grid')} className={`p-2 rounded-m3-md border text-[11px] font-bold flex items-center justify-center gap-1 ${answerSheet === 'grid' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-state-hover'}`}><Grid3X3 size={14} /> {t.ansStyles.grid}</button>
            </div>
          </div>

          {/* Answer Key */}
          <div className="bg-surface-container-low border border-outline-variant p-4 rounded-m3-lg shadow-elev-1 space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5"><CheckSquare size={14} /> {t.keys}</label>
            <select value={showAnswers} onChange={(e) => setShowAnswers(e.target.value as any)} className="w-full p-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] font-bold outline-none focus:border-primary transition-colors cursor-pointer">
              <option value="none">{t.keyStyles.none}</option>
              <option value="inline">{t.keyStyles.inline}</option>
              <option value="end">{t.keyStyles.end}</option>
            </select>
          </div>

        </div>

        {/* Bottom actions */}
        <div className="p-5 border-t border-outline-variant bg-surface-container-low sticky bottom-0 space-y-3 z-10">
          <DownloadPdfButton
            targetRef={printRootRef as any}
            fileName={`${originalData?.title || 'Test'}_Edify.pdf`}
            buttonText={lang === 'uz' ? "PDF Yuklab Olish" : lang === 'ru' ? "Скачать PDF" : "Download PDF"}
          />
          <Button variant="filled" size="lg" onClick={handleNativePrint} icon={<Printer />} className="w-full">
            {t.print}
          </Button>
        </div>
      </aside>

      {/* ── PREVIEW AREA ─────────────────────────────────────────────────────── */}
      {/*
        This div is flex-1, overflow-hidden.
        Its child (the scroll container) gets overflow-y-auto so ONLY this scrolls.
      */}
      <div className="flex-1 relative overflow-hidden flex flex-col bg-surface-container print:hidden">

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-1.5 bg-[color-mix(in_oklab,var(--m3-surface-container-low)_90%,transparent)] backdrop-blur-md p-1.5 rounded-m3-md shadow-elev-1 border border-outline-variant">
          <IconButton aria-label="Uzoqlashtirish" size="sm" onClick={() => setPreviewZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(1))))}><ZoomOut /></IconButton>
          <span className="text-[12px] font-black self-center w-12 text-center text-on-surface">{Math.round(previewZoom * 100)}%</span>
          <IconButton aria-label="Yaqinlashtirish" size="sm" onClick={() => setPreviewZoom(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}><ZoomIn /></IconButton>
        </div>

        {/* Page count badge */}
        {pages.length > 0 && (
          <div className="absolute top-4 left-4 z-10 bg-[color-mix(in_oklab,var(--m3-surface-container-low)_90%,transparent)] backdrop-blur-md px-3 py-1.5 rounded-m3-md shadow-elev-1 border border-outline-variant text-[12px] font-black text-on-surface-variant">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </div>
        )}

        {/*
          SCROLL CONTAINER — this is the element that scrolls vertically.
          Using overflow-y-auto and h-full so it fills the parent exactly.
        */}
        <div className="h-full overflow-y-auto overflow-x-auto">
          <div
            id="preview-pages-scaler"
            className="flex flex-col items-center py-8 gap-6"
            style={{
              // Scale the entire stack of pages together
              transform: `scale(${previewZoom})`,
              transformOrigin: 'top center',
              // Make the container tall enough for the scaled content
              minHeight: `${(A4_H_PX * previewZoom + 24) * Math.max(pages.length, 1) + 64}px`,
              width: `${A4_W_PX * previewZoom}px`,
              margin: '0 auto',
            }}
          >
            {/* Render stacked A4 pages */}
            {pages.length === 0 ? (
              // Fallback single page while paginating
              <div
                className="bg-surface-container-lowest shadow-elev-3 font-serif tracking-tight"
                style={{ ...paperStyle, transformOrigin: 'top center' }}
              >
                {renderHeader()}
                <div style={{
                  columnCount: columns,
                  columnGap: columns > 1 ? '2rem' : '0',
                  columnRule: columns > 1 && showLines ? '1px solid #cbd5e1' : 'none',
                  flex: 'none',
                  columnFill: 'balance',
                }}>
                  {activeQuestions.map((q, idx) => renderQuestion(q, idx, idx))}
                </div>
                {renderAnswerKey()}
                {renderAnswerSheet()}
              </div>
            ) : (
              pages.map((pageQIndices, pageNum) => {
                const isLastPage = pageNum === pages.length - 1;
                return (
                  <div
                    key={pageNum}
                    className="a4-capture-page bg-surface-container-lowest shadow-elev-3 font-serif tracking-tight relative"
                    style={paperStyle}
                  >
                    {/* Page number */}
                    <div className="absolute bottom-3 right-4 text-[8pt] text-outline font-bold select-none">
                      {pageNum + 1} / {pages.length}
                    </div>

                    {/* Header only on first page */}
                    {pageNum === 0 && renderHeader()}

                    {/* Questions for this page */}
                    <div style={{
                      columnCount: columns,
                      columnGap: columns > 1 ? '2rem' : '0',
                      columnRule: columns > 1 && showLines ? '1px solid #cbd5e1' : 'none',
                      flex: isLastPage ? 'none' : 1,
                      minHeight: 0,
                      columnFill: isLastPage ? 'balance' : 'auto',
                    }}>
                      {pageQIndices.map((qIdx) =>
                        renderQuestion(activeQuestions[qIdx], qIdx, qIdx)
                      )}
                    </div>

                    {/* Answer key + bubble sheet on last page */}
                    {isLastPage && renderAnswerKey()}
                    {isLastPage && renderAnswerSheet()}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── HIDDEN MEASUREMENT CONTAINER ─────────────────────────────────────── */}
      {/*
        Positioned off-screen (not display:none — we need actual layout/heights).
        Matches A4 content-area width minus padding so heights are accurate.
      */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          // Content width: A4_W_PX minus left+right 15mm padding
          width: `${A4_W_PX - 2 * 15 * (96 / 25.4)}px`,
          fontSize: `${fontSize}pt`,
          fontFamily: 'serif',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Measure header */}
        <div className="measure-header mb-5 pb-3 border-b-2 border-on-surface">
          {renderHeader()}
        </div>

        {/* Measure each question */}
        {activeQuestions.map((q, idx) => (
          <div key={q.id || idx} className="measure-question">
            {renderQuestion(q, idx, idx)}
          </div>
        ))}

        {/* Measure answer sheet */}
        <div className="measure-anssheet">
          {renderAnswerSheet()}
        </div>
      </div>

      {/* ── PRINT OUTPUT (invisible in UI, used for native print + PDF) ──────── */}
      <div
        id="print-pages-root"
        ref={printRootRef}
        className="hidden print:block"
        style={{ fontFamily: 'serif' }}
      >
        {pages.map((pageQIndices, pageNum) => {
          const isLastPage = pageNum === pages.length - 1;
          return (
            <div
              key={pageNum}
              className="print-page"
              style={{
                width: '210mm',
                height: '297mm',
                padding: '15mm',
                fontSize: `${fontSize}pt`,
                overflow: 'hidden',
                pageBreakAfter: isLastPage ? 'avoid' : 'always',
                position: 'relative',
                fontFamily: 'serif',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {pageNum === 0 && renderHeader()}
              <div style={{
                columnCount: columns,
                columnGap: columns > 1 ? '2rem' : '0',
                columnRule: columns > 1 && showLines ? '1px solid #cbd5e1' : 'none',
                flex: isLastPage ? 'none' : 1,
                minHeight: 0,
                columnFill: isLastPage ? 'balance' : 'auto',
              }}>
                {pageQIndices.map((qIdx) =>
                  renderQuestion(activeQuestions[qIdx], qIdx, qIdx)
                )}
              </div>
              {isLastPage && renderAnswerKey()}
              {isLastPage && renderAnswerSheet()}
            </div>
          );
        })}
      </div>

    </div>
  );
}