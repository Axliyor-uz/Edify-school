'use client';

import { Plus, X, GripVertical, AlignLeft, Type } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTeacherLanguage } from '@/app/teacher/layout';

import { Button } from '@/components/ui';

const TRANSLATIONS = {
  uz: {
    words: "ta so'z",
    easy: "OSON",
    medium: "O'RTA",
    hard: "QIYIN",
    instructionsPh: "Yo'riqnoma (masalan: You should spend about 20 minutes...)",
    titlePh: "Matn sarlavhasi...",
    subtitlePh: "Kichik sarlavha (ixtiyoriy)...",
    pastePh: "Matnni shu yerga joylashtiring...",
    removeLabel: "Belgini olib tashlash",
    addLabel: "Belgi qo'shish (A, B, C...)",
    addParagraph: "Paragraf qo'shish",
  },
  en: {
    words: "words",
    easy: "EASY",
    medium: "MEDIUM",
    hard: "HARD",
    instructionsPh: "Instructions (e.g. You should spend about 20 minutes...)",
    titlePh: "Passage Title...",
    subtitlePh: "Subtitle (Optional)...",
    pastePh: "Paste text here...",
    removeLabel: "Remove Label",
    addLabel: "Add Label (A, B, C...)",
    addParagraph: "Add Paragraph",
  },
  ru: {
    words: "слов",
    easy: "ЛЁГКИЙ",
    medium: "СРЕДНИЙ",
    hard: "СЛОЖНЫЙ",
    instructionsPh: "Инструкция (например: You should spend about 20 minutes...)",
    titlePh: "Заголовок текста...",
    subtitlePh: "Подзаголовок (необязательно)...",
    pastePh: "Вставьте текст сюда...",
    removeLabel: "Убрать метку",
    addLabel: "Добавить метку (A, B, C...)",
    addParagraph: "Добавить абзац",
  },
};

export default function PassagePane({ passage, update }: any) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // 1. LIVE WORD COUNT CALCULATOR
  // ==========================================================================
  const totalWords = passage.blocks.reduce((total: number, block: any) => {
    return total + (block.content.match(/\S+/g) || []).length;
  }, 0);

  // ==========================================================================
  // 2. ROBUST AUTO-RESIZE ENGINE (No scrollbars)
  // ==========================================================================
  const autoResize = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => {
    if (containerRef.current) {
      const textareas = containerRef.current.querySelectorAll('textarea');
      textareas.forEach(t => autoResize(t));
    }
  }, [passage.blocks, passage.instruction, passage.title, passage.subtitle]);

  // ==========================================================================
  // 3. ULTRA-EASY MAGIC PASTE HANDLER
  // ==========================================================================
  const handleSmartPaste = (e: any, currentBlockIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    
    // Split by 2 or more line breaks (catches true paragraphs, ignores PDF line-wraps)
    const newParagraphs = pastedText
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    if (newParagraphs.length > 1) {
      e.preventDefault(); 
      const updatedBlocks = [...passage.blocks];
      
      // Replace the current block with the first pasted paragraph
      updatedBlocks[currentBlockIdx].content = newParagraphs[0];

      // Insert the rest as new blocks
      for (let i = 1; i < newParagraphs.length; i++) {
        let nextLabel = '';
        const prevLabel = updatedBlocks[currentBlockIdx + i - 1].label;
        if (prevLabel && /^[A-Z]$/.test(prevLabel)) {
          nextLabel = String.fromCharCode(prevLabel.charCodeAt(0) + 1);
        }
        updatedBlocks.splice(currentBlockIdx + i, 0, { type: 'text', label: nextLabel, content: newParagraphs[i] });
      }

      update('blocks', updatedBlocks);
    }
  };

  const handleKeyDown = (e: any, idx: number) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const updatedBlocks = [...passage.blocks];
      let nextLabel = '';
      if (updatedBlocks[idx].label && /^[A-Z]$/.test(updatedBlocks[idx].label)) {
        nextLabel = String.fromCharCode(updatedBlocks[idx].label.charCodeAt(0) + 1);
      }
      updatedBlocks.splice(idx + 1, 0, { type: 'text', label: nextLabel, content: '' });
      update('blocks', updatedBlocks);
    }
  };

  const addParagraph = () => {
    const blocks = [...passage.blocks];
    const lastLabel = blocks.length > 0 ? blocks[blocks.length - 1].label : '';
    let nextLabel = '';
    if (lastLabel && /^[A-Z]$/.test(lastLabel)) {
      nextLabel = String.fromCharCode(lastLabel.charCodeAt(0) + 1);
    } else if (blocks.length === 0 || lastLabel !== '') {
      nextLabel = String.fromCharCode(65 + blocks.length); 
    }
    blocks.push({ type: 'text', label: nextLabel, content: '' });
    update('blocks', blocks);
  };

  // ==========================================================================
  // 4. LABEL TOGGLER
  // ==========================================================================
  const toggleLabel = (idx: number) => {
    const blocks = [...passage.blocks];
    if (blocks[idx].label !== "") {
      // Hide label (save as empty string)
      blocks[idx].label = "";
    } else {
      // Show label (try to guess the next letter)
      let nextLabel = 'A';
      for (let i = idx - 1; i >= 0; i--) {
        if (blocks[i].label && /^[A-Z]$/.test(blocks[i].label)) {
          nextLabel = String.fromCharCode(blocks[i].label.charCodeAt(0) + 1);
          break;
        }
      }
      blocks[idx].label = nextLabel;
    }
    update('blocks', blocks);
  };

  return (
    <div ref={containerRef} className="px-2 py-4 sm:px-6 sm:py-8 max-w-[800px] mx-auto selection:bg-primary-container font-t-body">
      
      {/* ===================================================================== */}
      {/* TINY TOP METADATA BAR                                                 */}
      {/* ===================================================================== */}
      <div className="flex justify-end items-center gap-3 mb-6 opacity-60 hover:opacity-100 transition-opacity">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${totalWords < 700 ? 'text-warning' : totalWords > 950 ? 'text-error' : 'text-success'}`}>
          {totalWords} {t.words}
        </span>
        <select
          value={passage.difficulty || 'medium'}
          onChange={e => update('difficulty', e.target.value)}
          className="bg-transparent border-none text-[10px] font-bold uppercase tracking-widest text-on-surface-variant p-0 outline-none cursor-pointer appearance-none text-right"
        >
          <option value="easy">{t.easy}</option>
          <option value="medium">{t.medium}</option>
          <option value="hard">{t.hard}</option>
        </select>
      </div>

      {/* ===================================================================== */}
      {/* HEADER SECTION (Title, Subtitle, Instructions)                        */}
      {/* ===================================================================== */}
      <div className="flex flex-col items-center space-y-3 mb-10">
        <textarea 
          placeholder={t.instructionsPh}
          value={passage.instruction} 
          onChange={e => { update('instruction', e.target.value); autoResize(e.target); }} 
          className="w-full text-center text-[13px] font-medium text-on-surface-variant bg-transparent border-none focus:ring-0 p-0 outline-none resize-none overflow-hidden italic leading-relaxed placeholder:text-outline"
          rows={1}
        />
        <textarea
          placeholder={t.titlePh}
          value={passage.title}
          onChange={e => { update('title', e.target.value); autoResize(e.target); }}
          className="w-full text-center text-[26px] sm:text-[32px] font-black tracking-tight bg-transparent border-none focus:ring-0 p-0 outline-none resize-none overflow-hidden placeholder:text-outline-variant text-on-surface leading-tight"
          rows={1}
        />
        <textarea
          placeholder={t.subtitlePh}
          value={passage.subtitle || ''}
          onChange={e => { update('subtitle', e.target.value); autoResize(e.target); }}
          className="w-full text-center text-[14.5px] font-serif italic bg-transparent border-none focus:ring-0 p-0 outline-none resize-none overflow-hidden placeholder:text-outline text-on-surface-variant leading-relaxed"
          rows={1}
        />
      </div>

      {/* ===================================================================== */}
      {/* PARAGRAPH BLOCKS (Minimalistic, Auto-sizing, Serif Font)              */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        {passage.blocks.map((block: any, idx: number) => {
          const isFocused = focusedIndex === idx;
          const hasLabel = block.label !== "";

          return (
            <div key={idx} className="relative group flex gap-2 sm:gap-4 items-start">
              
              {/* LABEL TOGGLE AREA */}
              <div className="w-6 pt-1.5 flex flex-col items-center shrink-0">
                {hasLabel ? (
                  <div className="relative group/label">
                    <input 
                      type="text" value={block.label} 
                      onChange={e => { const b = [...passage.blocks]; b[idx].label = e.target.value.toUpperCase(); update('blocks', b); }}
                      className="w-6 text-center bg-transparent border-none focus:ring-0 p-0 outline-none font-bold text-[14px] text-on-surface uppercase"
                      maxLength={2}
                    />
                    <button onClick={() => toggleLabel(idx)} className="absolute -left-4 top-1 opacity-0 group-hover/label:opacity-100 text-outline hover:text-error" title={t.removeLabel}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => toggleLabel(idx)} className="opacity-0 group-hover:opacity-100 text-outline hover:text-primary transition-opacity mt-0.5" title={t.addLabel}>
                    <Type size={14} />
                  </button>
                )}
              </div>

              {/* SEAMLESS CONTENT EDITOR */}
              <div className="flex-1 relative">
                <textarea 
                  placeholder={t.pastePh}
                  value={block.content} 
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex(null)}
                  onPaste={(e) => handleSmartPaste(e, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onChange={e => { 
                    const b = [...passage.blocks]; 
                    b[idx].content = e.target.value; 
                    update('blocks', b); 
                    autoResize(e.target); 
                  }} 
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-[15.5px] leading-[1.9] text-on-surface outline-none resize-none overflow-hidden min-h-[30px] font-serif placeholder:font-t-body placeholder:text-[13px] placeholder:text-outline"
                  rows={1}
                />
              </div>

              {/* FLOATING ACTION BUTTONS */}
              <div className={`flex flex-col gap-1 absolute -right-8 top-1 transition-opacity duration-200 ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button className="text-on-surface-variant hover:text-primary cursor-grab active:cursor-grabbing p-1"><GripVertical size={14}/></button>
                <button onClick={() => { const b = [...passage.blocks]; b.splice(idx,1); update('blocks', b); }} className="text-on-surface-variant hover:text-error p-1"><X size={14}/></button>
              </div>

            </div>
          );
        })}
      </div>

      {/* ADD PARAGRAPH BUTTON */}
      <div className="pt-6 pb-20 flex justify-start ml-8 sm:ml-10">
        <Button variant="text" size="sm" icon={<AlignLeft />} onClick={addParagraph}>
          {t.addParagraph}
        </Button>
      </div>
      
    </div>
  );
}