'use client';

// Teacher-side attempt detail — the drill-down the group tabs link to.
// R/L: per-question "student answer vs accepted answer" with correctness; W/S: the
// submission + current grade. Data comes from GET /api/ielts/review (the API grants
// the group's teacher access); no student-ui imports — teacher chrome only.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Eye, Headphones, Mic, PenTool, XCircle } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { fetchReview } from '@/services/ieltsService';
import { typeLabel } from '@/lib/ielts/typeLabels';

const T: Record<string, any> = {
  uz: {
    title: 'Urinish tahlili',
    band: 'Band',
    raw: "To'g'ri javoblar",
    time: 'Sarflangan vaqt',
    tabs: 'Tab almashishlar',
    attemptsTaken: 'Urinishlar',
    q: 'Savol',
    studentAnswer: "O'quvchi javobi",
    correctAnswer: "To'g'ri javob",
    type: 'Turi',
    task1: 'Task 1',
    task2: 'Task 2',
    words: (n: number) => `${n} so'z`,
    part: (n: number) => `${n}-qism`,
    grade: 'Baho',
    comments: 'Izoh',
    notGraded: 'Hali baholanmagan',
    aiEstimate: 'AI taxmini',
    errTitle: 'Urinish topilmadi yoki ruxsat yo‘q',
    errDesc: 'Bu urinish sizning guruhingizga tegishli emas yoki o‘chirilgan.',
    back: 'Ortga',
    typeStats: 'Savol turlari bo‘yicha',
  },
  en: {
    title: 'Attempt review',
    band: 'Band',
    raw: 'Correct answers',
    time: 'Time spent',
    tabs: 'Tab switches',
    attemptsTaken: 'Attempts',
    q: 'Q',
    studentAnswer: 'Student answer',
    correctAnswer: 'Accepted answer',
    type: 'Type',
    task1: 'Task 1',
    task2: 'Task 2',
    words: (n: number) => `${n} words`,
    part: (n: number) => `Part ${n}`,
    grade: 'Grade',
    comments: 'Comments',
    notGraded: 'Not graded yet',
    aiEstimate: 'AI estimate',
    errTitle: 'Attempt not found or access denied',
    errDesc: 'This attempt does not belong to one of your groups, or it was deleted.',
    back: 'Back',
    typeStats: 'By question type',
  },
  ru: {
    title: 'Разбор попытки',
    band: 'Band',
    raw: 'Верные ответы',
    time: 'Затраченное время',
    tabs: 'Переключения вкладок',
    attemptsTaken: 'Попытки',
    q: 'Вопрос',
    studentAnswer: 'Ответ ученика',
    correctAnswer: 'Правильный ответ',
    type: 'Тип',
    task1: 'Task 1',
    task2: 'Task 2',
    words: (n: number) => `${n} слов`,
    part: (n: number) => `Часть ${n}`,
    grade: 'Оценка',
    comments: 'Комментарий',
    notGraded: 'Ещё не оценено',
    aiEstimate: 'Оценка ИИ',
    errTitle: 'Попытка не найдена или нет доступа',
    errDesc: 'Эта попытка не относится к вашим группам или была удалена.',
    back: 'Назад',
    typeStats: 'По типам вопросов',
  },
};

const SKILL_ICON: Record<string, typeof BookOpen> = {
  reading: BookOpen, listening: Headphones, writing: PenTool, speaking: Mic,
};

const fmt = (a: unknown): string => {
  if (a == null || a === '') return '—';
  return Array.isArray(a) ? a.join(', ') : String(a);
};

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

export default function TeacherIeltsAttemptReviewPage() {
  const { attemptId } = useParams() as { attemptId: string };
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [attempt, setAttempt] = useState<any>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    let cancelled = false;
    fetchReview(attemptId)
      .then(({ attempt, correctAnswers }) => {
        if (cancelled) return;
        setAttempt(attempt);
        setCorrectAnswers((correctAnswers as Record<string, string | string[]>) || {});
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [attemptId]);

  if (state === 'loading') {
    return <div className="flex justify-center py-24"><Spinner size={30} /></div>;
  }
  if (state === 'error' || !attempt) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <EmptyState
          icon={<Eye strokeWidth={2.5} />}
          title={t.errTitle}
          description={t.errDesc}
          action={<Button variant="tonal" onClick={() => router.back()} icon={<ArrowLeft strokeWidth={2.5} />}>{t.back}</Button>}
        />
      </div>
    );
  }

  const skill: string = attempt.skill;
  const Icon = SKILL_ICON[skill] || BookOpen;
  const answers: Record<string, unknown> = attempt.answers || {};
  const perQuestion: Record<string, { correct: boolean; type: string }> = attempt.perQuestion || {};
  const grade = attempt.teacherGrade;
  const ai = attempt.aiEstimate;

  const qns = Object.keys(perQuestion).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-m3-md border border-outline-variant bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label={t.back}
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="w-11 h-11 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[19px] font-black text-on-surface truncate">
            {attempt.userName || '—'} <span className="text-on-surface-variant font-bold">· {t.title}</span>
          </h1>
          <p className="text-[12px] font-bold text-on-surface-variant capitalize">IELTS {skill}</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {attempt.bandScore != null && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-primary-container text-on-primary-container text-[13px] font-black">
            {t.band} {Number(attempt.bandScore).toFixed(1)}
          </span>
        )}
        {attempt.rawScore != null && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface text-[13px] font-black">
            {t.raw}: {attempt.rawScore}/{attempt.totalQuestions}
          </span>
        )}
        {attempt.timeSpentSeconds > 0 && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface-variant text-[13px] font-black inline-flex items-center gap-1.5">
            <Clock size={13} strokeWidth={2.5} /> {fmtDuration(attempt.timeSpentSeconds)}
          </span>
        )}
        {attempt.tabSwitches > 0 && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-error-container text-on-error-container text-[13px] font-black">
            {t.tabs}: {attempt.tabSwitches}×
          </span>
        )}
        {attempt.attemptsTaken > 1 && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface-variant text-[13px] font-black">
            {t.attemptsTaken}: {attempt.attemptsTaken}
          </span>
        )}
      </div>

      {/* Type stats */}
      {attempt.typeStats && Object.keys(attempt.typeStats).length > 0 && (
        <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4">
          <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2">{t.typeStats}</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(attempt.typeStats as Record<string, { correct: number; total: number }>).map(([type, s]) => (
              <span
                key={type}
                className={`px-2 py-1 rounded-m3-xs text-[11.5px] font-black ${
                  s.correct === s.total
                    ? 'bg-success-container text-on-success-container'
                    : s.correct === 0
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {typeLabel(type)} {s.correct}/{s.total}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reading / listening: per-question table */}
      {(skill === 'reading' || skill === 'listening') && qns.length > 0 && (
        <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container">
                  <th className="px-3 py-2.5 text-[11px] font-black text-on-surface-variant uppercase tracking-wider w-12">{t.q}</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-on-surface-variant uppercase tracking-wider">{t.studentAnswer}</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-on-surface-variant uppercase tracking-wider">{t.correctAnswer}</th>
                  <th className="px-3 py-2.5 text-[11px] font-black text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">{t.type}</th>
                </tr>
              </thead>
              <tbody>
                {qns.map((qn) => {
                  const r = perQuestion[qn];
                  return (
                    <tr key={qn} className="border-b border-outline-variant last:border-b-0">
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-black text-on-surface">
                          {r.correct
                            ? <CheckCircle2 size={15} strokeWidth={2.5} className="text-success shrink-0" />
                            : <XCircle size={15} strokeWidth={2.5} className="text-error shrink-0" />}
                          {qn}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-[13px] font-bold ${r.correct ? 'text-on-surface' : 'text-error'}`}>
                        {fmt(answers[qn])}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-bold text-on-surface-variant">
                        {fmt(correctAnswers[qn])}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-on-surface-variant hidden sm:table-cell">
                        {typeLabel(r.type)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Writing */}
      {skill === 'writing' && (
        <>
          <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4 flex flex-col gap-2">
            {grade ? (
              <>
                <span className="self-start px-3 py-1.5 rounded-m3-sm bg-primary-container text-on-primary-container text-[13px] font-black">
                  {t.grade}: {Number(grade.band).toFixed(1)}
                </span>
                {grade.criteria && (
                  <div className="grid grid-cols-4 gap-2 max-w-sm">
                    {(['ta', 'cc', 'lr', 'gra'] as const).map((k) => (
                      <div key={k} className="rounded-m3-sm bg-surface-container px-2 py-1.5 text-center">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase">{k.toUpperCase()}</div>
                        <div className="text-[14px] font-black text-on-surface">{Number(grade.criteria[k]).toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {grade.comments && <p className="text-[13.5px] font-medium text-on-surface leading-relaxed">{grade.comments}</p>}
              </>
            ) : (
              <span className="self-start px-3 py-1.5 rounded-m3-sm bg-warning-container text-on-warning-container text-[13px] font-black">
                {t.notGraded}
              </span>
            )}
            {ai && (
              <p className="text-[12px] font-bold text-on-surface-variant">
                {t.aiEstimate}: ~{Number(ai.band).toFixed(1)}
              </p>
            )}
          </div>
          {([1, 2] as const).map((n) => {
            const text = n === 1 ? attempt.writing?.task1Text : attempt.writing?.task2Text;
            const words = n === 1 ? attempt.writing?.task1Words : attempt.writing?.task2Words;
            if (!text) return null;
            return (
              <div key={n} className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">{n === 1 ? t.task1 : t.task2}</p>
                  <span className="text-[11px] font-black text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-m3-xs">
                    {t.words(words || 0)}
                  </span>
                </div>
                <p className="text-[13.5px] font-medium text-on-surface whitespace-pre-wrap leading-relaxed">{text}</p>
              </div>
            );
          })}
        </>
      )}

      {/* Speaking */}
      {skill === 'speaking' && (
        <>
          <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4 flex flex-col gap-2">
            {grade ? (
              <>
                <span className="self-start px-3 py-1.5 rounded-m3-sm bg-primary-container text-on-primary-container text-[13px] font-black">
                  {t.grade}: {Number(grade.band).toFixed(1)}
                </span>
                {grade.comments && <p className="text-[13.5px] font-medium text-on-surface leading-relaxed">{grade.comments}</p>}
              </>
            ) : (
              <span className="self-start px-3 py-1.5 rounded-m3-sm bg-warning-container text-on-warning-container text-[13px] font-black">
                {t.notGraded}
              </span>
            )}
          </div>
          <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4 flex flex-col gap-3">
            {([1, 2, 3] as const).map((n) => {
              const url = attempt.speaking?.[`part${n}AudioUrl`];
              if (!url) return null;
              return (
                <div key={n}>
                  <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-1.5">{t.part(n)}</p>
                  <audio controls src={url} className="w-full h-10" preload="none" />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
