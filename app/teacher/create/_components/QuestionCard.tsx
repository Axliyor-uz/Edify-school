'use client';

import { useState } from 'react';
import { Check, Plus, Minus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { db } from '@/lib/firebase';
import { doc, setDoc, arrayUnion, increment, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { normalizeQuestion } from '@/lib/questionSchema';
import QuestionPartsPreview from '@/components/QuestionPartsPreview';
import QuestionCreator from '@/components/QuestionCreator';

import { Button, Dialog, Radio, uiToast, cn } from '@/components/ui';

// --- TRANSLATION DICTIONARY FOR REPORTING ---
const REPORT_TRANSLATIONS = {
  uz: {
    reportBtn: "Report",
    modalTitle: "Xatoni xabar qilish",
    modalDesc: "Nima uchun bu savol xato?",
    reasons: {
      wrongAns: "Noto'g'ri javob",
      typo: "Imlo xatosi / Format",
      missing: "Ma'lumot/Rasm yetishmaydi",
      wrongTopic: "Boshqa mavzudan",
      other: "Boshqa"
    },
    submit: "Yuborish",
    cancel: "Bekor qilish",
    success: "Xabar yuborildi. Rahmat!",
    fail: "Yuborishda xatolik yuz berdi."
  },
  en: {
    reportBtn: "Report",
    modalTitle: "Report an Error",
    modalDesc: "What is wrong with this question?",
    reasons: {
      wrongAns: "Wrong Answer",
      typo: "Typo / Formatting",
      missing: "Missing Info/Image",
      wrongTopic: "Wrong Topic",
      other: "Other"
    },
    submit: "Submit",
    cancel: "Cancel",
    success: "Report submitted. Thank you!",
    fail: "Failed to submit report."
  },
  ru: {
    reportBtn: "Ошибка",
    modalTitle: "Сообщить об ошибке",
    modalDesc: "Что не так с этим вопросом?",
    reasons: {
      wrongAns: "Неверный ответ",
      typo: "Опечатка / Формат",
      missing: "Нет данных/картинки",
      wrongTopic: "Не по теме",
      other: "Другое"
    },
    submit: "Отправить",
    cancel: "Отмена",
    success: "Жалоба отправлена. Спасибо!",
    fail: "Ошибка отправки."
  }
};

interface Props {
  question: any;
  isAdded: boolean;
  onToggle: () => void;
  index: number;
  disabled?: boolean;
}

// Difficulty is a real state — semantic container colors are correct here.
const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'bg-success-container text-on-success-container',
  medium: 'bg-warning-container text-on-warning-container',
  hard: 'bg-error-container text-on-error-container',
};

export default function QuestionCard({ question, isAdded, onToggle, index, disabled }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const rt = REPORT_TRANSLATIONS[lang];

  // UI States
  const [showOptions, setShowOptions] = useState(false);

  // Reporting States
  const [isReporting, setIsReporting] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const getText = (obj: any) => {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;
    return obj?.uz || obj?.en || obj?.ru || "No text";
  };

  // Normalized here rather than at each caller: this card is fed both freshly
  // generated in-memory questions (legacy shape) and docs straight out of
  // Firestore (v1 shape). normalizeQuestion is idempotent, so either is fine.
  const q = normalizeQuestion(question);

  const questionText = getText(q.question);
  const options = q.options;
  // multiple_select marks several letters correct; mcq just one.
  const correctKeys = Array.isArray(q.correctAnswer.value) ? q.correctAnswer.value : [q.answer];
  const difficulty = q.difficulty;
  const badgeClass = DIFFICULTY_BADGE[difficulty] || 'bg-surface-container-highest text-on-surface-variant';

  // Spam-proof report logic: question ID as the doc ID + merge prevents duplicates
  const handleReportSubmit = async () => {
    if (!user || !selectedReason) return;
    setIsSubmittingReport(true);

    try {
      const reportRef = doc(db, 'reported_questions', question.id);

      await setDoc(reportRef, {
        questionId: question.id,
        subjectId: question.subjectId || '01',
        topicId: question.topicId || 'unknown',
        chapterId: question.chapterId || 'unknown',
        subtopicId: question.subtopicId || 'unknown',

        // arrayUnion ensures the same teacher/reason isn't added twice
        reasons: arrayUnion(selectedReason),
        reportedBy: arrayUnion(user.uid),

        reportCount: increment(1),
        status: 'pending',
        lastReportedAt: serverTimestamp()
      }, { merge: true });

      uiToast.success(rt.success);
      setIsReporting(false);
      setSelectedReason(null);
    } catch (error) {
      console.error("Report Error:", error);
      uiToast.error(rt.fail);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative bg-surface-container-low rounded-m3-lg transition-all duration-200 group",
          isAdded ? "ring-2 ring-inset ring-primary shadow-elev-2 z-10" : "shadow-elev-1 hover:shadow-elev-2",
        )}
      >
        <div className="p-3 md:p-4 flex gap-3 md:gap-4 items-start">

          {/* 1. Left: Number */}
          <div className="pt-1 shrink-0">
            <span className="text-xs font-bold text-on-surface-variant font-mono tabular-nums">#{index}</span>
          </div>

          {/* 2. Middle: Content */}
          <div className="flex-1 min-w-0">

            {/* Metadata Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("px-2 py-0.5 rounded-m3-xs text-[10px] font-bold uppercase tracking-wide", badgeClass)}>
                {difficulty}
              </span>
              {q.isBlock && (
                <span className="px-2 py-0.5 rounded-m3-xs text-[10px] font-bold uppercase tracking-wide bg-primary-container text-on-primary-container">
                  Blok · {q.parts.length}
                </span>
              )}
            </div>

            {/* Question Text */}
            <div className="text-on-surface text-sm leading-relaxed overflow-x-auto min-w-0 break-words custom-scrollbar">
              <LatexRenderer latex={questionText} />
            </div>

            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="mt-2 max-h-[140px] w-auto rounded-m3-sm border border-outline-variant object-contain bg-surface-container" />
            )}

            <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mt-2 text-on-surface-variant" />

            {/* Actions Row */}
            <div className="mt-3 flex items-center gap-4">
              {(Object.keys(options).length > 0 || q.isBlock) && (
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="m3-interactive text-[11px] font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors px-2 py-1 rounded-m3-xs bg-surface-container-high"
                >
                  {showOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showOptions ? 'Hide Options' : 'Show Options'}
                </button>
              )}

              {/* Subtle Report Button */}
              <button
                onClick={() => setIsReporting(true)}
                className="text-[11px] font-bold text-on-surface-variant hover:text-error flex items-center gap-1 transition-colors px-2 py-1 rounded-m3-xs hover:bg-error-container"
                title="Report error in this question"
              >
                <AlertTriangle size={12} />
                {rt.reportBtn}
              </button>
            </div>
          </div>

          {/* 3. Right: Add/Remove Button */}
          <div className="pt-0.5 shrink-0 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled || isAdded) onToggle();
              }}
              disabled={disabled && !isAdded}
              title={isAdded ? "Remove" : disabled ? "Limit reached (Max 100)" : "Add"}
              className={cn(
                "m3-interactive w-9 h-9 rounded-m3-md flex items-center justify-center transition-all duration-200 shadow-elev-1",
                isAdded
                  ? "bg-error-container text-on-error-container"
                  : disabled
                    ? "bg-disabled-bg text-disabled-fg cursor-not-allowed shadow-none"
                    : "bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary hover:scale-105",
              )}
            >
              {isAdded ? <Minus size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
            </button>
          </div>

        </div>

        {/* Options Panel */}
        {showOptions && q.isBlock && (
          <div className="bg-surface-container border-t border-outline-variant px-3 py-3 md:px-4 rounded-b-m3-lg animate-in slide-in-from-top-1 fade-in duration-200">
            <QuestionPartsPreview question={q} compact />
          </div>
        )}

        {showOptions && !q.isBlock && (
          <div className="bg-surface-container border-t border-outline-variant px-3 py-3 md:px-4 rounded-b-m3-lg animate-in slide-in-from-top-1 fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(options).map(([key, val]: any) => {
                const isCorrect = correctKeys.includes(key);
                return (
                  <div key={key} className={cn(
                    "flex items-start gap-2 p-2 rounded-m3-sm text-xs",
                    isCorrect ? "bg-success-container text-on-success-container" : "bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface-variant",
                  )}>
                    <span className={cn(
                      "w-5 h-5 flex items-center justify-center rounded-m3-xs text-[10px] font-bold shrink-0 mt-0.5",
                      isCorrect ? "bg-success text-surface-container-lowest" : "bg-surface-container-high text-on-surface-variant",
                    )}>{key}</span>
                    <div className="min-w-0 overflow-x-auto break-words flex-1">
                      <LatexRenderer latex={getText(val)} />
                      {val?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={val.imageUrl} alt="" className="mt-1 max-h-[70px] w-auto rounded-m3-xs border border-outline-variant object-contain bg-surface" />
                      )}
                    </div>
                    {isCorrect && <Check size={14} className="text-success shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* REPORT MODAL */}
      <Dialog
        open={isReporting}
        onClose={() => setIsReporting(false)}
        title={rt.modalTitle}
        description={rt.modalDesc}
        icon={<AlertTriangle />}
        actions={
          <>
            <Button variant="text" onClick={() => setIsReporting(false)} disabled={isSubmittingReport}>
              {rt.cancel}
            </Button>
            <Button variant="danger" onClick={handleReportSubmit} disabled={!selectedReason} loading={isSubmittingReport}>
              {rt.submit}
            </Button>
          </>
        }
      >
        <div className="space-y-2 mt-4">
          {Object.entries(rt.reasons).map(([key, label]) => (
            <label
              key={key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-m3-md cursor-pointer transition-colors",
                selectedReason === label
                  ? "bg-secondary-container text-on-secondary-container ring-1 ring-inset ring-primary"
                  : "bg-surface-container-lowest ring-1 ring-inset ring-outline-variant hover:bg-state-hover",
              )}
            >
              <Radio
                name="reportReason"
                value={label}
                checked={selectedReason === label}
                onChange={() => setSelectedReason(label)}
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </Dialog>
    </>
  );
}
