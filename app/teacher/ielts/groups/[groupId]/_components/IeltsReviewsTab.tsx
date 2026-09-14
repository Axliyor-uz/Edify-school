'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { PenTool, Mic, ChevronDown, ClipboardCheck, Award, Sparkles } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Spinner, EmptyState } from '@/components/ui';
import { analyzeWritingAttempt, gradeWSAttempt, type AiWritingEstimate } from '@/services/ieltsService';
import type { IeltsWritingCriteria } from '@/lib/ielts/types';
import { GroupAttempt, submittedMillis, timeAgo, toDateSafe } from './groupData';

const T: Record<string, any> = {
  uz: {
    empty: "Tekshirishga ishlar yo'q",
    emptyDesc: "O'quvchilar Writing yoki Speaking topshirganda shu yerda paydo bo'ladi.",
    pending: "Tekshirilmoqda",
    graded: "Baholangan",
    task1: "Task 1",
    task2: "Task 2",
    words: (n: number) => `${n} so'z`,
    part: (n: number) => `${n}-qism`,
    noAudio: "Audio yozuvlar topilmadi",
    bandLabel: "Band",
    commentsLabel: "Izoh",
    commentsPlaceholder: "O'quvchi uchun izoh (ixtiyoriy)...",
    saveGrade: "Baholash",
    updateGrade: "Bahoni yangilash",
    gradedOk: "Baho saqlandi!",
    fail: "Xatolik yuz berdi",
    criteriaHint: "Mezonlar bo'yicha baholang — umumiy band avtomatik hisoblanadi",
    aiDraft: "AI taklifi",
    aiNote: "AI taxmini — tekshirib, o'zgartirib tasdiqlang.",
    aiApplied: "AI taklifi qo'yildi — tekshirib saqlang",
  },
  en: {
    empty: "Nothing to review",
    emptyDesc: "Writing and Speaking submissions will appear here.",
    pending: "Pending review",
    graded: "Graded",
    task1: "Task 1",
    task2: "Task 2",
    words: (n: number) => `${n} words`,
    part: (n: number) => `Part ${n}`,
    noAudio: "No audio recordings found",
    bandLabel: "Band",
    commentsLabel: "Comments",
    commentsPlaceholder: "Feedback for the student (optional)...",
    saveGrade: "Save grade",
    updateGrade: "Update grade",
    gradedOk: "Grade saved!",
    fail: "An error occurred",
    criteriaHint: "Score each criterion — the overall band is computed automatically",
    aiDraft: "AI draft",
    aiNote: "AI estimate — review, adjust, then save.",
    aiApplied: "AI draft applied — review and save",
  },
  ru: {
    empty: "Нет работ на проверку",
    emptyDesc: "Сдачи Writing и Speaking появятся здесь.",
    pending: "На проверке",
    graded: "Оценено",
    task1: "Task 1",
    task2: "Task 2",
    words: (n: number) => `${n} слов`,
    part: (n: number) => `Часть ${n}`,
    noAudio: "Аудиозаписи не найдены",
    bandLabel: "Band",
    commentsLabel: "Комментарий",
    commentsPlaceholder: "Отзыв для ученика (необязательно)...",
    saveGrade: "Оценить",
    updateGrade: "Обновить оценку",
    gradedOk: "Оценка сохранена!",
    fail: "Произошла ошибка",
    criteriaHint: "Оцените по критериям — общий band считается автоматически",
    aiDraft: "Черновик AI",
    aiNote: "Оценка ИИ — проверьте, поправьте и сохраните.",
    aiApplied: "Черновик AI применён — проверьте и сохраните",
  },
};

const BAND_OPTIONS: number[] = [];
for (let b = 4; b <= 9; b += 0.5) BAND_OPTIONS.push(b);

interface Props {
  attempts: GroupAttempt[];
  loaded: boolean;
  onGraded: (attemptId: string, band: number, comments: string) => void;
  /** Cross-group queue page: groupId → title, shown next to the student name. */
  groupTitles?: Record<string, string>;
}

export default function IeltsReviewsTab({ attempts, loaded, onGraded, groupTitles }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const wsAttempts = useMemo(() => {
    const list = attempts.filter((a) => a.skill === 'writing' || a.skill === 'speaking');
    return list.sort((a, b) => {
      const ap = a.reviewStatus === 'pending_review' ? 0 : 1;
      const bp = b.reviewStatus === 'pending_review' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return submittedMillis(b) - submittedMillis(a);
    });
  }, [attempts]);

  if (!loaded) {
    return <div className="py-16 flex justify-center"><Spinner size={28} /></div>;
  }

  if (wsAttempts.length === 0) {
    return (
      <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
        <EmptyState icon={<ClipboardCheck strokeWidth={2.5} />} title={t.empty} description={t.emptyDesc} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {wsAttempts.map((a) => (
        <ReviewCard
          key={a.id}
          attempt={a}
          t={t}
          lang={lang}
          isExpanded={expandedId === a.id}
          onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
          onGraded={onGraded}
          groupTitle={groupTitles && a.groupId ? groupTitles[a.groupId] : undefined}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  attempt, t, lang, isExpanded, onToggle, onGraded, groupTitle,
}: {
  attempt: GroupAttempt;
  t: any;
  lang: string;
  isExpanded: boolean;
  onToggle: () => void;
  onGraded: (attemptId: string, band: number, comments: string) => void;
  groupTitle?: string;
}) {
  const isPending = attempt.reviewStatus === 'pending_review';
  const isWriting = attempt.skill === 'writing';
  const Icon = isWriting ? PenTool : Mic;
  const [band, setBand] = useState<string>(attempt.teacherGrade?.band != null ? String(attempt.teacherGrade.band) : '6.5');
  const [comments, setComments] = useState(attempt.teacherGrade?.comments || '');
  const savedCriteria = (attempt.teacherGrade as { criteria?: IeltsWritingCriteria } | undefined)?.criteria;
  // Writing rubric sub-scores; '' = not scored (band stays manual).
  const [criteria, setCriteria] = useState<Record<keyof IeltsWritingCriteria, string>>({
    ta: savedCriteria ? String(savedCriteria.ta) : '',
    cc: savedCriteria ? String(savedCriteria.cc) : '',
    lr: savedCriteria ? String(savedCriteria.lr) : '',
    gra: savedCriteria ? String(savedCriteria.gra) : '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ai, setAi] = useState<AiWritingEstimate | null>((attempt as { aiEstimate?: AiWritingEstimate }).aiEstimate || null);

  const criteriaComplete = (['ta', 'cc', 'lr', 'gra'] as const).every((k) => criteria[k] !== '');

  const setCriterion = (key: keyof IeltsWritingCriteria, value: string) => {
    const next = { ...criteria, [key]: value };
    setCriteria(next);
    // Auto-average once all four are scored (.25/.75 rounds up via doubled Math.round).
    if ((['ta', 'cc', 'lr', 'gra'] as const).every((k) => next[k] !== '')) {
      const mean = (Number(next.ta) + Number(next.cc) + Number(next.lr) + Number(next.gra)) / 4;
      setBand(String(Math.round(mean * 2) / 2));
    }
  };

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const { aiEstimate } = await analyzeWritingAttempt(attempt.id);
      setAi(aiEstimate);
      setCriteria({
        ta: String(aiEstimate.criteria.ta), cc: String(aiEstimate.criteria.cc),
        lr: String(aiEstimate.criteria.lr), gra: String(aiEstimate.criteria.gra),
      });
      setBand(String(aiEstimate.band));
      if (!comments.trim()) {
        setComments(aiEstimate.feedback?.[lang as 'uz' | 'ru' | 'en'] || aiEstimate.feedback?.en || '');
      }
      toast.success(t.aiApplied);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t.fail);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const b = Number(band);
      const crit = isWriting && criteriaComplete
        ? { ta: Number(criteria.ta), cc: Number(criteria.cc), lr: Number(criteria.lr), gra: Number(criteria.gra) }
        : undefined;
      await gradeWSAttempt(attempt.id, b, comments.trim(), crit);
      toast.success(t.gradedOk);
      onGraded(attempt.id, b, comments.trim());
    } catch (e) {
      console.error(e);
      toast.error(t.fail);
    } finally {
      setIsSaving(false);
    }
  };

  const audioParts = attempt.skill === 'speaking'
    ? ([1, 2, 3] as const)
        .map((n) => ({ n, url: attempt.speaking?.[`part${n}AudioUrl` as keyof NonNullable<typeof attempt.speaking>] }))
        .filter((p) => !!p.url)
    : [];

  return (
    <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden">
      {/* Header row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <div className={`w-10 h-10 rounded-m3-md flex items-center justify-center shrink-0 ${
          attempt.skill === 'writing' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'
        }`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black text-on-surface truncate">
            {attempt.userName || '—'}
            <span className="text-on-surface-variant font-medium"> · </span>
            <span className="capitalize">{attempt.skill}</span>
          </p>
          <p className="text-[11px] font-bold text-on-surface-variant mt-0.5">
            {timeAgo(toDateSafe(attempt.submittedAt), lang)}
            {groupTitle ? <span> · {groupTitle}</span> : null}
          </p>
        </div>
        {isPending ? (
          <span className="shrink-0 text-[11px] font-black px-2 py-1 rounded-m3-xs bg-warning-container text-on-warning-container">
            {t.pending}
          </span>
        ) : (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-m3-xs bg-success-container text-on-success-container">
            <Award size={11} strokeWidth={2.5} />
            {attempt.teacherGrade?.band != null ? Number(attempt.teacherGrade.band).toFixed(1) : t.graded}
          </span>
        )}
        <ChevronDown
          size={16} strokeWidth={2.5}
          className={`text-on-surface-variant shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Detail */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-outline-variant px-4 py-4 flex flex-col gap-4 bg-surface-container-lowest">

              {/* Writing: essays */}
              {attempt.skill === 'writing' && attempt.writing && (
                <>
                  {([1, 2] as const).map((n) => {
                    const text = n === 1 ? attempt.writing!.task1Text : attempt.writing!.task2Text;
                    const words = n === 1 ? attempt.writing!.task1Words : attempt.writing!.task2Words;
                    if (!text) return null;
                    return (
                      <div key={n}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">
                            {n === 1 ? t.task1 : t.task2}
                          </p>
                          <span className="text-[11px] font-black text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-m3-xs">
                            {t.words(words || 0)}
                          </span>
                        </div>
                        <div className="max-h-56 overflow-y-auto custom-scrollbar bg-surface-container rounded-m3-md p-3.5">
                          <p className="text-[13.5px] font-medium text-on-surface whitespace-pre-wrap leading-relaxed">{text}</p>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Speaking: audio players */}
              {attempt.skill === 'speaking' && (
                audioParts.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {audioParts.map((p) => (
                      <div key={p.n}>
                        <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-1.5">{t.part(p.n)}</p>
                        <audio controls src={p.url as string} className="w-full h-10" preload="none" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] font-bold text-on-surface-variant">{t.noAudio}</p>
                )
              )}

              {/* Grading form */}
              <div className="flex flex-col gap-3 pt-1">
                {isWriting && (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[11px] font-bold text-on-surface-variant">{t.criteriaHint}</p>
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={handleAiDraft}
                        loading={aiLoading}
                        icon={<Sparkles size={14} strokeWidth={2.5} />}
                      >
                        {t.aiDraft}{ai ? ` · ~${Number(ai.band).toFixed(1)}` : ''}
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['ta', 'cc', 'lr', 'gra'] as const).map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider text-center">
                            {key.toUpperCase()}
                          </span>
                          <select
                            value={criteria[key]}
                            onChange={(e) => setCriterion(key, e.target.value)}
                            className="px-1.5 py-2 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] font-black text-on-surface text-center outline-none focus:border-primary cursor-pointer appearance-none transition-colors"
                          >
                            <option value="">—</option>
                            {BAND_OPTIONS.map((b) => (
                              <option key={b} value={String(b)}>{b.toFixed(1)}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {ai && <p className="text-[11px] font-bold text-on-surface-variant">{t.aiNote}</p>}
                  </>
                )}
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">{t.bandLabel}</span>
                    <select
                      value={band}
                      onChange={(e) => setBand(e.target.value)}
                      className="px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-black text-on-surface outline-none focus:border-primary cursor-pointer appearance-none transition-colors"
                    >
                      {BAND_OPTIONS.map((b) => (
                        <option key={b} value={String(b)}>{b.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">{t.commentsLabel}</span>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={t.commentsPlaceholder}
                      rows={2}
                      className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] font-medium text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary resize-y transition-colors"
                    />
                  </div>
                </div>
                <Button
                  variant="filled"
                  onClick={handleSave}
                  loading={isSaving}
                  icon={<ClipboardCheck strokeWidth={2.5} />}
                  className="self-end"
                >
                  {isPending ? t.saveGrade : t.updateGrade}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
