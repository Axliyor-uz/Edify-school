'use client';

// Shared per-block extras rendered under every question-block editor (reading + listening
// builders): optional word_limit for free-text completion types, the answer-alternates
// syntax hint, and collapsed per-row explanation textareas (power review mode).

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, MessageSquareText } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';

const FREE_TEXT_TYPES = [
  'summary_completion', 'sentence_completion', 'short_answer',
  'table_completion', 'flowchart_completion', 'diagram_completion',
];

const T: Record<string, any> = {
  uz: {
    wordLimit: 'So\'z chegarasi',
    wordLimitPh: '—',
    wordLimitHint: (n: number) => `NO MORE THAN ${n === 1 ? 'ONE WORD' : n === 2 ? 'TWO WORDS' : n === 3 ? 'THREE WORDS' : n + ' WORDS'}`,
    altHint: 'Javob sintaksisi: "taxi/cab" — ikkalasi ham qabul qilinadi; "(the) library" — qavsdagi so\'z ixtiyoriy.',
    explanations: 'Izohlar (review uchun)',
    explanationPh: (q: number) => `Savol ${q} uchun izoh (ixtiyoriy)...`,
  },
  en: {
    wordLimit: 'Word limit',
    wordLimitPh: '—',
    wordLimitHint: (n: number) => `NO MORE THAN ${n === 1 ? 'ONE WORD' : n === 2 ? 'TWO WORDS' : n === 3 ? 'THREE WORDS' : n + ' WORDS'}`,
    altHint: 'Answer syntax: "taxi/cab" = either accepted; "(the) library" = word in brackets is optional.',
    explanations: 'Explanations (for review)',
    explanationPh: (q: number) => `Explanation for question ${q} (optional)...`,
  },
  ru: {
    wordLimit: 'Лимит слов',
    wordLimitPh: '—',
    wordLimitHint: (n: number) => `NO MORE THAN ${n === 1 ? 'ONE WORD' : n === 2 ? 'TWO WORDS' : n === 3 ? 'THREE WORDS' : n + ' WORDS'}`,
    altHint: 'Синтаксис ответа: "taxi/cab" — принимается любой; "(the) library" — слово в скобках необязательно.',
    explanations: 'Пояснения (для разбора)',
    explanationPh: (q: number) => `Пояснение к вопросу ${q} (необязательно)...`,
  },
};

export default function BlockExtras({ qb, qbIdx, updateBlock }: any) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T.uz;
  const [showExpl, setShowExpl] = useState(false);

  // Free-text mode only (word-bank blocks have options set — the limit is meaningless there).
  const isFreeText = FREE_TEXT_TYPES.includes(qb.type) && qb.options == null;
  const filled = (qb.questions || []).filter((r: any) => (r.explanation || '').trim()).length;

  const updateRowExplanation = (rIdx: number, val: string) => {
    const rows = [...(qb.questions || [])];
    rows[rIdx] = { ...rows[rIdx], explanation: val };
    updateBlock(qbIdx, 'questions', rows);
  };

  return (
    <div className="px-1 -mt-2 mb-2">
      {isFreeText && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1.5">
          <label className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0">
            {t.wordLimit}
            <input
              type="number" min={1} max={5} placeholder={t.wordLimitPh}
              value={qb.word_limit || ''}
              onChange={(e) => updateBlock(qbIdx, 'word_limit', e.target.value ? Math.max(1, Math.min(5, +e.target.value)) : 0)}
              className="w-12 h-6 text-[11px] font-black text-center bg-surface-container-lowest border border-outline-variant rounded-m3-sm outline-none focus:border-primary text-primary"
            />
            {qb.word_limit > 0 && (
              <span className="text-[9px] font-black text-on-tertiary-container bg-tertiary-container px-1.5 py-0.5 rounded-m3-xs normal-case tracking-normal">
                {t.wordLimitHint(qb.word_limit)}
              </span>
            )}
          </label>
          <p className="flex items-start gap-1 text-[10px] text-on-surface-variant font-medium leading-relaxed">
            <Info size={11} className="shrink-0 mt-0.5" /> {t.altHint}
          </p>
        </div>
      )}

      <button
        onClick={() => setShowExpl(!showExpl)}
        className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant hover:text-primary uppercase tracking-wider transition-colors"
      >
        <MessageSquareText size={11} /> {t.explanations}
        {filled > 0 && <span className="text-primary">({filled})</span>}
        {showExpl ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {showExpl && (
        <div className="mt-2 space-y-1.5 bg-surface-container p-2 rounded-m3-sm border border-outline-variant">
          {(qb.questions || []).map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-start gap-2">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-on-surface-variant bg-surface-container-high rounded-m3-xs shrink-0">
                {row.question_number}
              </span>
              <textarea
                rows={1}
                placeholder={t.explanationPh(row.question_number)}
                value={row.explanation || ''}
                onChange={(e) => updateRowExplanation(rIdx, e.target.value)}
                className="flex-1 text-[11px] bg-surface-container-lowest border border-outline-variant rounded-m3-sm px-2 py-1.5 outline-none focus:border-primary placeholder:text-on-surface-variant font-medium resize-y min-h-[30px]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
