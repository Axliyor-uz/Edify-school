'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, ArrowDown, BookOpen, AlertTriangle } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    close: "Yopish",
    previewBadge: "Ko'rib chiqish",
    readOnly: "Faqat o'qish",
    untitledTest: "Nomsiz test",
    passageLabel: "Matn",
    passageTitleFallback: "Matn sarlavhasi",
    noQuestions: "Hali savollar biriktirilmagan.",
    noInstructions: "Ko'rsatmalar berilmagan.",
    diagramPending: "[Diagramma rasmi kutilmoqda]",
  },
  en: {
    close: "Close",
    previewBadge: "Preview",
    readOnly: "Read-Only",
    untitledTest: "Untitled Test",
    passageLabel: "Passage",
    passageTitleFallback: "Passage Title",
    noQuestions: "No questions mapped yet.",
    noInstructions: "No instructions provided.",
    diagramPending: "[Diagram Image Pending]",
  },
  ru: {
    close: "Закрыть",
    previewBadge: "Предпросмотр",
    readOnly: "Только чтение",
    untitledTest: "Тест без названия",
    passageLabel: "Текст",
    passageTitleFallback: "Заголовок текста",
    noQuestions: "Вопросы ещё не привязаны.",
    noInstructions: "Инструкции не указаны.",
    diagramPending: "[Изображение диаграммы ожидается]",
  },
};

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: any;
  passage: any;
}

export default function PreviewModal({ isOpen, onClose, meta, passage }: PreviewModalProps) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  if (!isOpen || !passage || !mounted) return null;

  // ==========================================================================
  // 🌟 AUTHENTIC IELTS EXAM BLANK RENDERER
  // ==========================================================================
  const renderInlineBlanks = (text: string) => {
    if (!text || typeof text !== 'string') return null;
    const parts = text.split(/(\[\s*\d*\s*\]|\[_\]|\[\])/g);
    
    return parts.map((part, i) => {
      if (/^\[.*\]$/.test(part)) {
        const numMatch = part.match(/\d+/);
        const num = numMatch ? numMatch[0] : '';
        
        return (
          <span key={i} className="inline-flex items-center mx-1.5 align-baseline">
            <span className="flex items-center justify-center bg-inverse-surface text-inverse-on-surface font-bold rounded-m3-xs text-[11px] w-6 h-6 shadow-elev-1 mr-2 translate-y-[2px]">
              {num}
            </span>
            <span className="w-20 sm:w-28 border-b-[1.5px] border-outline inline-block translate-y-[2px]"></span>
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ==========================================================================
  // 🌟 AUTHENTIC WORD BANK RENDERER
  // ==========================================================================
  const renderWordBank = (options: any[]) => {
    if (!Array.isArray(options) || options.length === 0) return null;
    return (
      <div className="mb-8 p-5 bg-surface-container-lowest border border-outline-variant rounded-m3-sm shadow-elev-1">
        <div className="font-bold text-[13px] mb-4 text-on-surface text-center uppercase tracking-widest">List of Options</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
          {options.map((opt: any, i: number) => (
            <div key={i} className="text-[14px] text-on-surface leading-relaxed flex items-start">
              <strong className="text-on-surface mr-2.5 w-4 shrink-0">{opt.id || opt.label}</strong> 
              <span>{opt.text || opt.description || ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999999] bg-scrim backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 font-t-body antialiased">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.98, y: 15 }} 
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-surface-container-low w-full max-w-[1300px] h-full max-h-[92vh] rounded-m3-xl shadow-elev-3 flex flex-col overflow-hidden border border-outline-variant"
      >
        
        {/* 🌟 SLEEK HEADER */}
        <div className="h-12 border-b border-outline-variant bg-surface-container-low flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-primary" strokeWidth={2.5}/>
            <span className="text-[10px] font-black tracking-widest uppercase text-on-primary-container bg-primary-container px-2 py-0.5 rounded-m3-xs">{t.previewBadge}</span>
            <div className="h-4 w-px bg-outline-variant mx-1"></div>
            <h2 className="font-bold text-[13px] text-on-surface tracking-tight">
              {meta?.title || t.untitledTest} <span className="text-on-surface-variant mx-1.5">•</span> {t.passageLabel} {passage?.passage_number || 1}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex text-on-surface-variant text-[10px] font-black px-2 items-center gap-1.5 uppercase tracking-widest">
              <AlertTriangle size={12} strokeWidth={2.5}/> {t.readOnly}
            </div>
            <IconButton aria-label={t.close} size="sm" onClick={onClose}>
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          </div>
        </div>

        {/* 🌟 SPLIT VIEWPORT */}
        <div className="flex-1 flex overflow-hidden bg-surface">
          
          {/* LEFT: READING PASSAGE (Serif, Clean, Easy to Read) */}
          <div className="w-1/2 h-full overflow-y-auto border-r border-outline-variant bg-surface-container-lowest p-8 lg:p-12 custom-scrollbar">
            <div className="max-w-xl mx-auto pb-12">
              <h1 className="text-[24px] lg:text-[28px] font-black text-on-surface mb-3 leading-tight">{passage?.title || t.passageTitleFallback}</h1>
              {passage?.subtitle && <p className="text-[15px] text-on-surface-variant font-serif italic mb-8 leading-relaxed">{passage.subtitle}</p>}
              
              <div className="space-y-5 pt-6 text-[15.5px] leading-[1.9] text-on-surface font-serif">
                {passage?.blocks?.map((b: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    {b.label && <div className="font-bold text-on-surface-variant w-5 shrink-0 font-t-body">{b.label}</div>}
                    <div className="flex-1 whitespace-pre-wrap">{b.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: QUESTIONS PREVIEW (Flat, Minimalistic Exam Style) */}
          <div className="w-1/2 h-full overflow-y-auto bg-surface p-8 lg:p-12 custom-scrollbar">
            <div className="max-w-xl mx-auto pb-12 space-y-12">
              
              {(!passage?.questions || passage.questions.length === 0) ? (
                <div className="text-center text-on-surface-variant mt-20 text-[14px] font-medium">{t.noQuestions}</div>
              ) : (
                passage.questions.map((qb: any, qbIdx: number) => {
                  const isWordBank = Array.isArray(qb.options) && qb.options.length > 0;
                  const hasSharedOptions = isWordBank || (qb.type === 'matching_paragraph_information' && Array.isArray(qb.options));

                  return (
                    <div key={qbIdx} className="group">
                      
                      {/* BLOCK HEADER */}
                      <div className="mb-6">
                        <div className="font-bold text-[14.5px] text-on-surface mb-1.5">
                          Questions {qb.start_question || '?'} - {qb.end_question || '?'}
                        </div>
                        <div className="text-[14px] text-on-surface italic leading-relaxed">
                          {qb.instructions || t.noInstructions}
                        </div>
                      </div>

                      {/* SHARED OPTIONS / WORD BANK */}
                      {hasSharedOptions && renderWordBank(qb.options)}

                      {/* BLOCK TITLES */}
                      {(qb.summary_title || qb.table_title || qb.flowchart_title || qb.diagram_title) && (
                        <div className="text-center font-bold text-[15px] text-on-surface mb-6 uppercase tracking-wider">
                          {qb.summary_title || qb.table_title || qb.flowchart_title || qb.diagram_title}
                        </div>
                      )}

                      {/* =======================================================
                          TYPE SPECIFIC RENDERERS (FLATTENED DESIGN)
                      ======================================================= */}

                      {/* 1. MULTIPLE CHOICE & LIST SELECTION */}
                      {(qb.type === 'multiple_choice' || qb.type === 'list_selection') && (
                        <div className="space-y-8">
                          {qb.questions.map((q: any, i: number) => (
                            <div key={i}>
                              <div className="flex gap-3 items-start mb-4">
                                <span className="w-6 h-6 bg-inverse-surface text-inverse-on-surface rounded-m3-xs flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{q.question_number}</span>
                                <p className="text-[14.5px] font-medium text-on-surface leading-relaxed">{q.question_text}</p>
                              </div>
                              <div className="pl-9 space-y-3">
                                {q.options?.map((opt: any, oIdx: number) => (
                                  <div key={oIdx} className="flex gap-3.5 items-start">
                                    <div className={`w-[18px] h-[18px] mt-[3px] shrink-0 border-2 border-outline ${qb.type === 'multiple_choice' ? 'rounded-full' : 'rounded-m3-xs'} bg-surface-container-lowest`}></div>
                                    <span className="text-[14px] text-on-surface leading-relaxed">
                                      <strong className="mr-2 text-on-surface">{opt.id}.</strong>{opt.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 2. STATEMENTS & MATCHING (TFNG, Paragraph Info, Features, Endings) */}
                      {(qb.type === 'true_false_not_given' || qb.type === 'matching_paragraph_information' || qb.type === 'matching_features' || qb.type === 'matching_sentence_endings') && (
                        <div className="space-y-5">
                          {qb.questions.map((q: any, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-inverse-surface text-inverse-on-surface font-bold text-xs rounded-m3-xs flex items-center justify-center shrink-0 mt-0.5">{q.question_number}</span>
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                <p className="text-[14.5px] text-on-surface font-medium leading-relaxed">{q.statement || q.sentence_start}</p>
                                <span className="w-16 border-b-[1.5px] border-outline mb-1.5 shrink-0"></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 3. MATCHING HEADINGS */}
                      {qb.type === 'matching_headings' && (
                        <div className="space-y-4">
                          {qb.questions.map((q: any, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-6 h-6 bg-inverse-surface text-inverse-on-surface font-bold text-xs rounded-m3-xs flex items-center justify-center shrink-0">{q.question_number}</span>
                              <div className="text-[14.5px] text-on-surface w-24">Paragraph <strong className="text-on-surface">{q.target_paragraph}</strong></div>
                              <span className="w-20 border-b-[1.5px] border-outline shrink-0"></span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 4. SHORT ANSWER */}
                      {qb.type === 'short_answer' && (
                        <div className="space-y-5">
                          {qb.questions.map((q: any, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-inverse-surface text-inverse-on-surface font-bold text-xs rounded-m3-xs flex items-center justify-center shrink-0 mt-0.5">{q.question_number}</span>
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                <p className="text-[14.5px] text-on-surface font-medium leading-relaxed">{q.question_text}</p>
                                <span className="w-32 border-b-[1.5px] border-outline mb-1.5 shrink-0"></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 5. SUMMARY COMPLETION */}
                      {qb.type === 'summary_completion' && qb.summary_text && (
                        <div className="bg-surface-container-lowest border border-outline-variant p-6 sm:p-8 rounded-m3-md shadow-elev-1">
                          <div className="text-[14.5px] text-on-surface leading-[2.6] font-medium tracking-wide">
                            {renderInlineBlanks(qb.summary_text)}
                          </div>
                        </div>
                      )}

                      {/* 6. SENTENCE COMPLETION */}
                      {qb.type === 'sentence_completion' && (
                         <div className="space-y-5 bg-surface-container-lowest border border-outline-variant p-6 rounded-m3-md shadow-elev-1">
                           {qb.questions.map((q:any, i:number) => (
                              <div key={i} className="flex gap-3 leading-[2] text-[14.5px] text-on-surface font-medium">
                                 <span className="shrink-0 font-bold w-5">{q.question_number}.</span>
                                 <div>{renderInlineBlanks(q.sentence)}</div>
                              </div>
                           ))}
                         </div>
                      )}

                      {/* 7. TABLE COMPLETION */}
                      {qb.type === 'table_completion' && Array.isArray(qb.headers) && Array.isArray(qb.rows) && (
                        <div className="overflow-x-auto mt-2">
                          <div className="min-w-[500px] border-2 border-outline-variant rounded-m3-sm bg-surface-container-lowest overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-surface-container border-b-2 border-outline-variant">
                                  {qb.headers.map((h: string, i: number) => (
                                    <th key={i} className="px-4 py-3 font-bold text-on-surface text-[13px] uppercase tracking-wide border-r border-outline-variant last:border-0 align-bottom">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="text-[14px]">
                                {qb.rows.map((rowObj: any, rIdx: number) => {
                                  const cells = Array.isArray(rowObj) ? rowObj : (rowObj.cells || []);
                                  return (
                                    <tr key={rIdx} className="border-b border-outline-variant last:border-0">
                                      {cells.map((cell: string, cIdx: number) => (
                                        <td key={cIdx} className="px-4 py-4 text-on-surface align-top font-medium border-r border-outline-variant last:border-0 leading-[2.2]">
                                          {renderInlineBlanks(cell)}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                     {/* 8. FLOWCHART COMPLETION */}
                      {qb.type === 'flowchart_completion' && Array.isArray(qb.steps) && (
                        <div className="flex flex-col items-center justify-center w-full mt-2 bg-surface-container-lowest py-8 px-4 rounded-m3-md border border-outline-variant shadow-elev-1">
                          {qb.steps.map((step: string, sIdx: number) => (
                            <div key={sIdx} className="w-full flex flex-col items-center">
                              {sIdx > 0 && (
                                <div className="flex flex-col items-center my-1">
                                  <div className="w-[2px] h-5 bg-outline"></div>
                                  <ArrowDown size={18} className="text-on-surface-variant -mt-1.5" strokeWidth={3} />
                                </div>
                              )}
                              <div className="w-full max-w-md bg-surface-container-lowest border-2 border-outline-variant rounded-m3-sm p-4">
                                <div className="text-[14px] text-on-surface leading-[2.2] font-medium text-center">
                                  {renderInlineBlanks(step)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 9. DIAGRAM COMPLETION */}
                      {qb.type === 'diagram_completion' && (
                        <div className="mt-2 bg-surface-container-lowest border border-outline-variant rounded-m3-md p-6 shadow-elev-1">
                          <div className="flex justify-center mb-8">
                            {qb.diagram_url ? (
                              <img src={qb.diagram_url} alt={qb.diagram_alt_text || "Diagram"} className="max-h-[320px] w-auto object-contain mix-blend-multiply" />
                            ) : (
                              <div className="h-40 w-full flex items-center justify-center text-[13px] font-bold text-on-surface-variant border-2 border-dashed border-outline-variant rounded-m3-sm bg-surface-container">
                                {t.diagramPending}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                            {qb.questions?.map((q: any, i: number) => (
                              <div key={i} className="flex items-end gap-2.5">
                                <span className="flex items-center justify-center bg-inverse-surface text-inverse-on-surface font-bold rounded-m3-xs text-[11px] w-6 h-6 shadow-elev-1">
                                  {q.question_number}
                                </span>
                                <span className={`border-b-[1.5px] border-outline inline-block mb-1 ${isWordBank ? 'w-12' : 'w-24'}`}></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}