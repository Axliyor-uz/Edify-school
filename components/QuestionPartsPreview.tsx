'use client';

import { Check } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import type { NormalizedQuestion } from '@/types/question';

/**
 * The answer section of a BLOCK question — the shared A–F pool (printed once)
 * plus every sub-question with its correct answer marked.
 *
 * Every teacher surface that shows a question must render this when
 * `q.isBlock`: a block's answer lives in `q.parts`, NOT in the top-level
 * `options`/`answer`, so without it a block appears as a stem with an empty
 * answer — which is exactly how it used to look in the bank, the cart and print.
 *
 * Read-only. The student runner has its own interactive version.
 */
export default function QuestionPartsPreview({
  question,
  compact = false,
}: {
  question: NormalizedQuestion;
  compact?: boolean;
}) {
  if (!question.isBlock) return null;

  // `shared_options`: normalizeQuestion hands every part the SAME optionList
  // array as the block, so the pool is printed once rather than per part.
  const sharedPool =
    question.optionList.length > 0 && question.parts.every((p) => p.optionList === question.optionList)
      ? question.optionList
      : [];

  const correctOf = (p: NormalizedQuestion['parts'][number]) =>
    Array.isArray(p.correctAnswer.value) ? p.correctAnswer.value : [String(p.correctAnswer.value ?? '')];

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* The pool — shown once for the whole block. */}
      {sharedPool.length > 0 && (
        <div className="rounded-m3-md border border-outline-variant bg-surface-container p-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
            Umumiy variantlar
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {sharedPool.map((o) => (
              <div key={o.id} className="flex items-start gap-1.5 text-[12px] text-on-surface">
                <span className="font-black shrink-0">{o.id})</span>
                <div className="min-w-0 break-words">
                  <LatexRenderer latex={o.text.uz || o.text.ru || o.text.en || ''} />
                  {o.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.imageUrl} alt="" loading="lazy" className="mt-1 max-h-[60px] w-auto rounded-m3-xs border border-outline-variant object-contain" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Each sub-question, with its correct answer marked. */}
      {question.parts.map((part) => {
        const correct = correctOf(part);
        const isTyped = part.optionList.length === 0;

        return (
          <div key={part.id} className="rounded-m3-md border border-outline-variant p-2.5">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-6 h-6 rounded-m3-xs bg-primary-container text-on-primary-container font-black text-[11px] flex items-center justify-center">
                {part.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-on-surface break-words">
                  <LatexRenderer latex={part.prompt.uz || part.prompt.ru || part.prompt.en || ''} />
                </div>

                {isTyped ? (
                  <p className="mt-1.5 text-[12px] font-bold text-success flex flex-wrap items-center gap-1.5">
                    <Check size={13} /> <LatexRenderer latex={correct.join(', ')} />
                    {part.correctAnswer.acceptedAnswers.length > 0 && (
                      <span className="font-medium text-on-surface-variant">
                        (≈ {part.correctAnswer.acceptedAnswers.join(', ')})
                      </span>
                    )}
                  </p>
                ) : sharedPool.length > 0 ? (
                  // The pool is above — just name the correct letter.
                  <p className="mt-1.5 text-[12px] font-bold text-success flex items-center gap-1.5">
                    <Check size={13} /> {correct.join(', ')}
                  </p>
                ) : (
                  // The part owns its options — show them.
                  <div className="mt-1.5 grid gap-1">
                    {part.optionList.map((o) => {
                      const ok = correct.includes(o.id);
                      return (
                        <div
                          key={o.id}
                          className={`flex items-start gap-1.5 rounded-m3-xs px-1.5 py-1 text-[12px] ${ok ? 'bg-success-container text-on-success-container font-bold' : 'text-on-surface-variant'}`}
                        >
                          <span className="font-black shrink-0">{o.id})</span>
                          <div className="min-w-0 break-words">
                            <LatexRenderer latex={o.text.uz || o.text.ru || o.text.en || ''} />
                          </div>
                          {ok && <Check size={12} className="shrink-0 mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-bold text-on-surface-variant">{part.points} b.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
