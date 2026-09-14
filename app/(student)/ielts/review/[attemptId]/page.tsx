'use client';

// Review mode: your answer vs correct answer per question, teacher explanation,
// and "Locate" — flash-highlights the row's passage_reference in the passage
// (reading) or shows it inside the part transcript (listening). Writing shows
// essays + teacher grade (+ model answers), speaking shows recordings + grade.
// Keeps normal student chrome (no full-screen overlay).
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { Lock, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '@/app/(student)/layout';
import {
  Button, Card, Chip, ErrorState, Page, PageHeader, SegmentedControl, Spinner, cn, sToast,
} from '@/components/student-ui';
import { analyzeWritingAttempt, fetchReview } from '@/services/ieltsService';
import type { IeltsWritingCriteria } from '@/lib/ielts/types';
import StudentQuestionRenderer from '@/app/(student)/ielts/_components/runner/StudentQuestionRenderer';
import { TEST_COLLECTIONS, TYPE_LABELS, wordCount, type AnswerMap } from '@/app/(student)/ielts/_components/runner/shared';
import { runnerT } from '@/app/(student)/ielts/_components/runner/i18n';

interface Loaded {
  status: 'loading' | 'error' | 'denied' | 'ready';
  attempt?: any;
  correctAnswers?: Record<string, string | string[]>;
  test?: any;
  deniedMsg?: string;
}

/** Render text with \n→<br> and, when `mark` occurs inside it, the occurrence
 *  wrapped in a highlighted span (id=locate-target) to scroll to. */
function MarkedText({ text, mark }: { text: string; mark?: string | null }) {
  const idx = mark ? text.indexOf(mark) : -1;
  if (!mark || idx < 0) {
    return <span dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }} />;
  }
  const before = text.slice(0, idx);
  const after = text.slice(idx + mark.length);
  return (
    <span>
      <span dangerouslySetInnerHTML={{ __html: before.replace(/\n/g, '<br/>') }} />
      <span
        id="locate-target"
        className="rounded-m3-xs bg-tertiary-container px-0.5 text-on-tertiary-container"
        dangerouslySetInnerHTML={{ __html: mark.replace(/\n/g, '<br/>') }}
      />
      <span dangerouslySetInnerHTML={{ __html: after.replace(/\n/g, '<br/>') }} />
    </span>
  );
}

/** TA / CC / LR / GRA sub-score tiles (exam jargon — same labels in all languages). */
function CriteriaGrid({ c }: { c: IeltsWritingCriteria }) {
  const items: [string, number][] = [['TA', c.ta], ['CC', c.cc], ['LR', c.lr], ['GRA', c.gra]];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([label, band]) => (
        <div key={label} className="rounded-m3-sm bg-surface-container px-2 py-2 text-center">
          <div className="text-[10.5px] font-black uppercase tracking-widest text-on-surface-variant">{label}</div>
          <div className="s-num text-[15px] font-black text-on-surface">{Number(band).toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

export default function IeltsReviewPage() {
  const { attemptId } = useParams() as { attemptId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = runnerT(lang);

  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const [aiLoading, setAiLoading] = useState(false);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [mobilePane, setMobilePane] = useState<'passage' | 'questions'>('questions');
  const [locate, setLocate] = useState<{ text: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { attempt, correctAnswers } = await fetchReview(attemptId);
        let test: any = null;
        const skill = (attempt as any).skill as string;
        const coll = TEST_COLLECTIONS[skill];
        if (coll && (attempt as any).testId) {
          const snap = await getDoc(doc(db, coll, (attempt as any).testId));
          if (snap.exists()) test = snap.data();
        }
        if (!cancelled) setState({ status: 'ready', attempt, correctAnswers, test });
      } catch (e: any) {
        if (cancelled) return;
        // Structured API error codes (IeltsClientError) — visibility gates read as "denied".
        const code: string | undefined = e?.code;
        if (code === 'RESULTS_HIDDEN' || code === 'RESULTS_AFTER_DUE' || code === 'FORBIDDEN') {
          setState({ status: 'denied', deniedMsg: e?.message });
        } else {
          setState({ status: 'error' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user, attemptId]);

  // Scroll to the located reference once it renders.
  useEffect(() => {
    if (!locate) return;
    const id = setTimeout(() => {
      document.getElementById('locate-target')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => clearTimeout(id);
  }, [locate, activeGroupIdx]);

  if (!user || state.status === 'loading') {
    return (
      <Page className="grid min-h-[70vh] place-items-center">
        <Spinner size={32} label={t.common.loading} />
      </Page>
    );
  }

  if (state.status === 'denied') {
    return (
      <Page className="flex min-h-[70vh] items-center justify-center">
        <Card variant="outlined" className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-m3-lg bg-surface-container-high text-on-surface-variant">
            <Lock size={30} strokeWidth={2.5} />
          </div>
          <h1 className="s-display text-[22px] font-bold text-on-surface">{t.review.noAccess}</h1>
          <p className="text-[13.5px] font-bold leading-relaxed text-on-surface-variant">
            {state.deniedMsg || t.review.noAccessDesc}
          </p>
          <Button fullWidth variant="outlined" onClick={() => router.back()}>{t.common.back}</Button>
        </Card>
      </Page>
    );
  }

  if (state.status === 'error' || !state.attempt) {
    return (
      <Page className="grid min-h-[70vh] place-items-center">
        <ErrorState title={t.common.error} onRetry={() => router.back()} retryLabel={t.common.back} />
      </Page>
    );
  }

  const attempt = state.attempt;
  const test = state.test;
  const skill: string = attempt.skill;
  const answers: AnswerMap = attempt.answers || {};

  const summary = (
    <div className="flex flex-wrap items-center gap-2">
      {attempt.bandScore != null && (
        <Chip status="primary">
          {t.review.band} <span className="s-num">{Number(attempt.bandScore).toFixed(1)}</span>
        </Chip>
      )}
      {attempt.rawScore != null && (
        <Chip status="neutral">
          <span className="s-num">{attempt.rawScore}/{attempt.totalQuestions}</span>
        </Chip>
      )}
      {attempt.typeStats && Object.entries(attempt.typeStats as Record<string, { correct: number; total: number }>).map(([type, s]) => (
        <Chip key={type} size="sm" status={s.correct === s.total ? 'success' : s.correct === 0 ? 'error' : 'neutral'}>
          {TYPE_LABELS[type] || type} <span className="s-num">{s.correct}/{s.total}</span>
        </Chip>
      ))}
    </div>
  );

  // ---------------- WRITING ----------------
  if (skill === 'writing') {
    const w = attempt.writing || {};
    const grade = attempt.teacherGrade;
    const ai = attempt.aiEstimate;
    const isOwner = attempt.userId === user.uid;
    const runAi = async () => {
      setAiLoading(true);
      try {
        const { aiEstimate } = await analyzeWritingAttempt(attemptId);
        setState(s => ({ ...s, attempt: { ...s.attempt, aiEstimate } }));
      } catch (e: any) {
        sToast.error(e?.message || t.common.error);
      } finally {
        setAiLoading(false);
      }
    };
    return (
      <Page>
        <PageHeader title={`${t.review.title} — IELTS Writing`} onBack={() => router.back()} />
        <div className="space-y-4">
          <Card variant="outlined" className="space-y-3">
            {grade ? (
              <div className="space-y-2">
                <Chip status="primary">{t.review.band} <span className="s-num">{Number(grade.band).toFixed(1)}</span></Chip>
                {grade.criteria && <CriteriaGrid c={grade.criteria} />}
                {grade.comments && (
                  <p className="text-[14px] font-medium leading-relaxed text-on-surface">
                    <span className="font-black text-on-surface-variant">{t.review.teacherComment}: </span>
                    {grade.comments}
                  </p>
                )}
              </div>
            ) : attempt.kind === 'practice' ? (
              // Self-practice writing is never teacher-graded — say so honestly instead of
              // showing a "not graded yet" that will never resolve.
              <Chip status="neutral">{t.review.selfPractice}</Chip>
            ) : (
              <Chip status="warning">{t.review.notGraded}</Chip>
            )}
          </Card>

          {/* AI first-pass estimate — advisory, teacher grade always wins */}
          {(ai || isOwner) && (
            <Card variant="outlined" className="space-y-3">
              <h2 className="inline-flex items-center gap-2 text-[14px] font-black uppercase tracking-[0.1em] text-on-surface-variant">
                <Sparkles size={16} strokeWidth={2.5} className="text-primary" /> {t.review.aiTitle}
              </h2>
              {ai ? (
                <div className="space-y-2.5">
                  <Chip status="gold">{t.review.band} ~<span className="s-num">{Number(ai.band).toFixed(1)}</span></Chip>
                  {ai.criteria && <CriteriaGrid c={ai.criteria} />}
                  <p className="whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-on-surface">
                    {ai.feedback?.[lang] || ai.feedback?.en || ''}
                  </p>
                  <p className="text-[12px] font-bold text-on-surface-variant">{t.review.aiDisclaimer}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="tonal" loading={aiLoading} onClick={runAi} icon={<Sparkles size={16} strokeWidth={2.5} />}>
                    {aiLoading ? t.review.aiLoading : t.review.aiGet}
                  </Button>
                  <p className="text-[12px] font-bold text-on-surface-variant">{t.review.aiDisclaimer}</p>
                </div>
              )}
            </Card>
          )}
          {(['task1', 'task2'] as const).map((key, i) => {
            const textAns: string = key === 'task1' ? (w.task1Text || '') : (w.task2Text || '');
            const words = key === 'task1' ? (w.task1Words ?? wordCount(textAns)) : (w.task2Words ?? wordCount(textAns));
            const model = test?.[key]?.modelAnswer;
            return (
              <Card key={key} variant="outlined" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-on-surface-variant">
                    {t.review.task} {i + 1}
                  </h2>
                  <Chip size="sm" status="neutral"><span className="s-num">{words}</span> {t.writing.words}</Chip>
                </div>
                {test?.[key]?.prompt && (
                  <p className="whitespace-pre-wrap rounded-m3-sm bg-surface-container-low p-3 text-[13.5px] font-medium leading-relaxed text-on-surface-variant">
                    {test[key].prompt}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[14.5px] font-medium leading-relaxed text-on-surface">{textAns || '—'}</p>
                {model && (
                  <div className="rounded-m3-sm border border-outline-variant bg-surface-container-low p-3">
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.writing.model}</p>
                    <p className="whitespace-pre-wrap text-[13.5px] font-medium leading-relaxed text-on-surface">{model}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Page>
    );
  }

  // ---------------- SPEAKING ----------------
  if (skill === 'speaking') {
    const sp = attempt.speaking || {};
    const grade = attempt.teacherGrade;
    const urls = [sp.part1AudioUrl, sp.part2AudioUrl, sp.part3AudioUrl];
    return (
      <Page>
        <PageHeader title={`${t.review.title} — IELTS Speaking`} onBack={() => router.back()} />
        <div className="space-y-4">
          <Card variant="outlined" className="space-y-2">
            {grade ? (
              <div className="space-y-1.5">
                <Chip status="primary">{t.review.band} <span className="s-num">{Number(grade.band).toFixed(1)}</span></Chip>
                {grade.comments && (
                  <p className="text-[14px] font-medium leading-relaxed text-on-surface">
                    <span className="font-black text-on-surface-variant">{t.review.teacherComment}: </span>
                    {grade.comments}
                  </p>
                )}
              </div>
            ) : attempt.kind === 'practice' ? (
              <Chip status="neutral">{t.review.selfPractice}</Chip>
            ) : (
              <Chip status="warning">{t.review.notGraded}</Chip>
            )}
          </Card>
          <Card variant="outlined" className="space-y-3">
            <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-on-surface-variant">{t.review.recordings}</h2>
            {urls.map((url, i) => (
              <div key={i} className="rounded-m3-md border border-outline-variant bg-surface-container-low p-3">
                <p className="mb-2 text-[12px] font-black uppercase tracking-[0.1em] text-on-surface-variant">
                  {t.speaking.part} {i + 1}
                </p>
                {url ? <audio controls src={url} preload="metadata" className="h-9 w-full" /> : <p className="text-[13px] font-bold text-on-surface-variant">—</p>}
              </div>
            ))}
          </Card>
        </div>
      </Page>
    );
  }

  // ---------------- READING / LISTENING ----------------
  const isReading = skill === 'reading';
  const groups: any[] = (isReading ? test?.passages : test?.parts) || [];
  const group = groups[activeGroupIdx] || {};

  if (!test) {
    return (
      <Page className="grid min-h-[70vh] place-items-center">
        <ErrorState title={t.common.notFound} onRetry={() => router.back()} retryLabel={t.common.back} />
      </Page>
    );
  }

  const handleLocate = (qn: number, reference: string) => {
    // Find the group whose passage blocks / transcript contain the reference.
    let target = activeGroupIdx;
    const contains = (g: any) => isReading
      ? (g.blocks || []).some((b: any) => String(b.content || '').includes(reference))
      : String(g.transcript || '').includes(reference);
    if (!contains(groups[activeGroupIdx])) {
      const found = groups.findIndex(contains);
      if (found >= 0) target = found;
    }
    setActiveGroupIdx(target);
    setLocate({ text: reference, nonce: Date.now() });
    setMobilePane('passage');
  };

  const reviewCtx = {
    perQuestion: attempt.perQuestion as Record<string, { correct: boolean }> | undefined,
    correctAnswers: state.correctAnswers,
    onLocate: (isReading || groups.some((g) => g.transcript)) ? handleLocate : undefined,
  };

  const passagePane = (
    <div className="text-[14.5px] leading-[1.65]">
      {isReading ? (
        <>
          <h2 className="mb-1 text-center font-serif text-[1.4em] font-bold text-on-surface">{group.title}</h2>
          {group.subtitle && <p className="mb-4 text-center font-serif italic text-on-surface-variant">{group.subtitle}</p>}
          <div className="space-y-3 text-justify font-serif text-on-surface">
            {(group.blocks || []).map((b: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                {b.label && <div className="mt-[0.15em] w-4 shrink-0 font-sans font-bold text-on-surface-variant">{b.label}</div>}
                <div className="min-w-0 flex-1">
                  <MarkedText key={locate?.nonce || 0} text={String(b.content || '')} mark={locate?.text} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : group.transcript ? (
        <>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
            {t.review.transcript} — {t.runner.part} {group.part_number || activeGroupIdx + 1}
          </p>
          <div className="whitespace-normal font-medium leading-relaxed text-on-surface">
            <MarkedText key={locate?.nonce || 0} text={String(group.transcript)} mark={locate?.text} />
          </div>
        </>
      ) : (
        <p className="mt-8 text-center italic text-on-surface-variant">—</p>
      )}
    </div>
  );

  const questionsPane = (
    <div className="space-y-6 text-[14.5px]">
      {(group.questions || []).map((qb: any, idx: number) => (
        <StudentQuestionRenderer key={`${activeGroupIdx}-${idx}`} qb={qb} answers={answers} review={reviewCtx} />
      ))}
    </div>
  );

  return (
    <Page width="wide">
      <PageHeader
        title={`${t.review.title} — ${test.test_title || 'IELTS'}`}
        onBack={() => router.back()}
        actions={
          <div className="flex items-center rounded-m3-sm border border-outline-variant bg-surface-container p-0.5">
            {groups.map((g: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveGroupIdx(i)}
                className={cn(
                  'rounded-m3-xs px-3 py-1 text-[12px] font-bold transition-colors',
                  activeGroupIdx === i ? 'bg-surface text-primary shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                P{g.passage_number || g.part_number || i + 1}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4">{summary}</div>

      {/* Mobile pane toggle */}
      <div className="mb-3 flex justify-center md:hidden">
        <SegmentedControl
          label={t.runner.passage}
          options={[
            { value: 'passage', label: isReading ? t.runner.passage : t.review.transcript },
            { value: 'questions', label: t.runner.questions },
          ] as const}
          value={mobilePane}
          onChange={setMobilePane}
          className="w-full [&>button]:flex-1"
        />
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-4">
        <Card variant="outlined" className={cn('mb-4 md:mb-0 md:max-h-[75vh] md:overflow-y-auto', mobilePane === 'passage' ? 'block' : 'hidden md:block')}>
          {passagePane}
        </Card>
        <Card variant="outlined" className={cn('md:max-h-[75vh] md:overflow-y-auto', mobilePane === 'questions' ? 'block' : 'hidden md:block')}>
          {questionsPane}
        </Card>
      </div>
    </Page>
  );
}
