'use client';

// Read-only teacher preview for reading & listening tests — replaces the old broken
// simulator (dead Submit button, desktop-only drag panes, 903-line duplicate renderer).
// Answers come from loadTestForEdit: own tests show the key inline; platform tests
// (key not teacher-readable) render answer-free with an explanatory chip.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Clock, EyeOff, Headphones, ListChecks } from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { loadTestForEdit } from '@/services/ieltsService';
import { typeLabelLong } from '@/lib/ielts/typeLabels';

const T: Record<string, any> = {
  uz: {
    preview: 'Ko‘rib chiqish',
    questions: 'savol',
    minutes: 'daqiqa',
    passage: 'Matn',
    part: 'Qism',
    transcript: 'Transkript',
    answersHidden: 'Javoblar yashirin (platforma testi)',
    answer: 'Javob',
    wordLimit: (n: number) => `Ko‘pi bilan ${n} so‘z`,
    explanation: 'Izoh',
    wordBank: 'Variantlar',
    errTitle: 'Test topilmadi',
    errDesc: 'Test o‘chirilgan yoki sizga tegishli emas.',
    back: 'Ortga',
    edit: 'Tahrirlash',
  },
  en: {
    preview: 'Preview',
    questions: 'questions',
    minutes: 'min',
    passage: 'Passage',
    part: 'Part',
    transcript: 'Transcript',
    answersHidden: 'Answers hidden (platform test)',
    answer: 'Answer',
    wordLimit: (n: number) => `No more than ${n} words`,
    explanation: 'Explanation',
    wordBank: 'Options',
    errTitle: 'Test not found',
    errDesc: 'The test was deleted or does not belong to you.',
    back: 'Back',
    edit: 'Edit',
  },
  ru: {
    preview: 'Просмотр',
    questions: 'вопросов',
    minutes: 'мин',
    passage: 'Текст',
    part: 'Часть',
    transcript: 'Транскрипт',
    answersHidden: 'Ответы скрыты (тест платформы)',
    answer: 'Ответ',
    wordLimit: (n: number) => `Не более ${n} слов`,
    explanation: 'Пояснение',
    wordBank: 'Варианты',
    errTitle: 'Тест не найден',
    errDesc: 'Тест удалён или не принадлежит вам.',
    back: 'Назад',
    edit: 'Редактировать',
  },
};

const fmtAnswer = (a: unknown): string => (Array.isArray(a) ? a.join(', ') : String(a ?? ''));

/** One option entry — the builder stores strings, {id,text} or {label,description}. */
function optionText(o: any): string {
  if (o == null) return '';
  if (typeof o === 'string') return o;
  if (o.id != null || o.text != null) return [o.id, o.text].filter(Boolean).join('. ');
  if (o.label != null) return [o.label, o.description].filter(Boolean).join(' — ');
  return String(o);
}

function AnswerChip({ answer, t }: { answer: unknown; t: any }) {
  if (answer == null || answer === '') return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-m3-xs bg-success-container text-on-success-container text-[12px] font-black">
      {t.answer}: {fmtAnswer(answer)}
    </span>
  );
}

function QuestionBlockPreview({ qb, t }: { qb: any; t: any }) {
  const rows: any[] = qb.questions || [];
  return (
    <div className="flex flex-col gap-3">
      {/* Block header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-1 rounded-m3-xs bg-secondary-container text-on-secondary-container text-[11px] font-black uppercase tracking-wide">
          {qb.start_question === qb.end_question ? qb.start_question : `${qb.start_question}–${qb.end_question}`} · {typeLabelLong(qb.type)}
        </span>
        {qb.word_limit ? (
          <span className="text-[11.5px] font-bold text-on-surface-variant">{t.wordLimit(qb.word_limit)}</span>
        ) : null}
      </div>
      {qb.instructions && (
        <p className="text-[13px] font-bold text-on-surface-variant whitespace-pre-wrap">{qb.instructions}</p>
      )}

      {/* Block-level content */}
      {qb.summary_title && <p className="text-[14px] font-black text-on-surface">{qb.summary_title}</p>}
      {qb.summary_text && (
        <p className="text-[13.5px] font-medium text-on-surface whitespace-pre-wrap leading-relaxed bg-surface-container rounded-m3-md p-3">
          {qb.summary_text}
        </p>
      )}
      {qb.table_title && <p className="text-[14px] font-black text-on-surface">{qb.table_title}</p>}
      {Array.isArray(qb.headers) && qb.headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-outline-variant rounded-m3-sm">
            <thead>
              <tr className="bg-surface-container">
                {qb.headers.map((h: string, i: number) => (
                  <th key={i} className="px-2.5 py-1.5 text-[12px] font-black text-on-surface border-b border-outline-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(qb.rows || []).map((r: any, i: number) => (
                <tr key={i} className="border-b border-outline-variant last:border-b-0">
                  {(r.cells || []).map((c: string, j: number) => (
                    <td key={j} className="px-2.5 py-1.5 text-[12.5px] font-medium text-on-surface whitespace-pre-wrap">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {qb.flowchart_title && <p className="text-[14px] font-black text-on-surface">{qb.flowchart_title}</p>}
      {Array.isArray(qb.steps) && qb.steps.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {qb.steps.map((s: string, i: number) => (
            <li key={i} className="text-[13px] font-medium text-on-surface bg-surface-container rounded-m3-sm px-3 py-2">
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      )}
      {qb.diagram_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qb.diagram_url} alt={qb.diagram_alt_text || qb.diagram_title || 'diagram'} className="max-w-full rounded-m3-md border border-outline-variant" />
      )}
      {Array.isArray(qb.options) && qb.options.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-1.5">{t.wordBank}</p>
          <div className="flex flex-wrap gap-1.5">
            {qb.options.map((o: any, i: number) => (
              <span key={i} className="px-2 py-1 rounded-m3-xs bg-surface-container text-on-surface text-[12px] font-bold">
                {optionText(o)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row: any) => {
          const prompt = row.statement || row.question_text || row.sentence || row.sentence_start
            || (row.target_paragraph ? `¶ ${row.target_paragraph}` : '');
          return (
            <div key={row.question_number} className="flex flex-col gap-1 rounded-m3-md bg-surface-container-lowest border border-outline-variant p-3">
              <div className="flex flex-wrap items-start gap-2">
                <span className="shrink-0 grid place-items-center min-w-[26px] h-[26px] rounded-m3-xs bg-surface-container text-on-surface text-[12px] font-black">
                  {row.question_number}
                </span>
                <p className="flex-1 min-w-0 text-[13.5px] font-medium text-on-surface whitespace-pre-wrap">{prompt || '—'}</p>
                <AnswerChip answer={row.correct_answer} t={t} />
              </div>
              {Array.isArray(row.options) && row.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {row.options.map((o: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-m3-xs bg-surface-container text-on-surface-variant text-[12px] font-bold">
                      {optionText(o)}
                    </span>
                  ))}
                </div>
              )}
              {row.explanation && (
                <p className="pl-9 text-[12px] font-bold text-on-surface-variant">
                  {t.explanation}: <span className="font-medium">{row.explanation}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TestPreview({ skill, testId }: { skill: 'reading' | 'listening'; testId: string }) {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [test, setTest] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    loadTestForEdit(skill, testId)
      .then((data) => { if (alive) { setTest(data); setState('ready'); } })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [skill, testId]);

  if (state === 'loading') {
    return <div className="flex justify-center py-24"><Spinner size={30} /></div>;
  }
  if (state === 'error' || !test) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <EmptyState
          icon={<BookOpen strokeWidth={2.5} />}
          title={t.errTitle}
          description={t.errDesc}
          action={<Button variant="tonal" onClick={() => router.back()} icon={<ArrowLeft strokeWidth={2.5} />}>{t.back}</Button>}
        />
      </div>
    );
  }

  const isListening = skill === 'listening';
  const groups: any[] = (isListening ? test.parts : test.passages) || [];
  const Icon = isListening ? Headphones : BookOpen;
  // answers_split docs with no merged key (platform tests) → make it explicit, not blank.
  const answersHidden = !!test.answers_split && !groups.some((g: any) =>
    (g.questions || []).some((qb: any) => (qb.questions || []).some((r: any) => r.correct_answer != null)));

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-16">
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
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-black text-on-surface truncate">{test.test_title}</h1>
          <p className="text-[12px] font-bold text-on-surface-variant capitalize">IELTS {skill} · {t.preview}</p>
        </div>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface text-[13px] font-black inline-flex items-center gap-1.5">
          <ListChecks size={13} strokeWidth={2.5} /> {test.total_questions || 0} {t.questions}
        </span>
        <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface text-[13px] font-black inline-flex items-center gap-1.5">
          <Clock size={13} strokeWidth={2.5} /> {test.total_time_minutes || 0} {t.minutes}
        </span>
        {test.test_category && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-surface-container text-on-surface-variant text-[13px] font-black capitalize">
            {test.test_category}
          </span>
        )}
        {answersHidden && (
          <span className="px-3 py-1.5 rounded-m3-sm bg-warning-container text-on-warning-container text-[13px] font-black inline-flex items-center gap-1.5">
            <EyeOff size={13} strokeWidth={2.5} /> {t.answersHidden}
          </span>
        )}
      </div>

      {/* Groups */}
      {groups.map((g: any, gi: number) => (
        <section key={gi} className="flex flex-col gap-4">
          <h2 className="text-[14px] font-black text-on-surface-variant uppercase tracking-wider">
            {isListening ? t.part : t.passage} {g.part_number || g.passage_number || gi + 1}
          </h2>

          <div className={isListening ? 'flex flex-col gap-4' : 'grid gap-4 lg:grid-cols-2'}>
            {/* Content pane */}
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4 lg:max-h-[70vh] lg:overflow-y-auto">
              {isListening ? (
                <div className="flex flex-col gap-3">
                  {g.audio_url
                    ? <audio controls src={g.audio_url} preload="metadata" className="w-full h-10" />
                    : <p className="text-[13px] font-bold text-on-surface-variant">—</p>}
                  {g.transcript && (
                    <details>
                      <summary className="cursor-pointer text-[12px] font-black text-on-surface-variant uppercase tracking-wider">
                        {t.transcript}
                      </summary>
                      <p className="mt-2 text-[13.5px] font-medium text-on-surface whitespace-pre-wrap leading-relaxed">{g.transcript}</p>
                    </details>
                  )}
                </div>
              ) : (
                <div className="text-[14px] leading-[1.65]">
                  <h3 className="mb-1 text-center font-serif text-[1.35em] font-bold text-on-surface">{g.title}</h3>
                  {g.subtitle && <p className="mb-4 text-center font-serif italic text-on-surface-variant">{g.subtitle}</p>}
                  <div className="space-y-3 text-justify font-serif text-on-surface">
                    {(g.blocks || []).map((b: any, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        {b.label && <div className="mt-[0.15em] w-4 shrink-0 font-sans font-bold text-on-surface-variant">{b.label}</div>}
                        <p className="min-w-0 flex-1 whitespace-pre-wrap">{b.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Questions pane */}
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-4 lg:max-h-[70vh] lg:overflow-y-auto flex flex-col gap-6">
              {(g.questions || []).map((qb: any, qi: number) => (
                <QuestionBlockPreview key={qi} qb={qb} t={t} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
