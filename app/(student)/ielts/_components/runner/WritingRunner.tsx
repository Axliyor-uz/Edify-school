'use client';

// CD-IELTS writing runner: Task 1 / Task 2 tabs, one shared countdown, plain
// no-spellcheck editor, live word counts (≥150 / ≥250 hints), session-resilient
// drafts, submit → pending teacher review (assignment) or model answers
// (practice). Rendered full-screen like the other runners.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Clock, Eye, PenLine, X, Zap } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '@/app/(student)/layout';
import {
  Banner, Button, Card, Chip, ConfirmDialog, IconButton, Page, SegmentedControl,
  Spinner, cn, sToast,
} from '@/components/student-ui';
import type { IeltsWritingTest } from '@/lib/ielts/types';
import { submitIeltsAttempt, type SubmitResult } from '@/services/ieltsService';
import { clearSession, formatClock, loadSession, saveSession, sessionKey, wordCount } from './shared';
import { runnerT } from './i18n';

export interface WritingRunnerProps {
  kind: 'assignment' | 'practice';
  mode: 'simulation' | 'practice';
  test: IeltsWritingTest & { test_id: string };
  groupId?: string;
  assignmentId?: string;
  dueAtMs?: number | null;
  durationMinutes?: number; // default 60 (official writing timing)
  backHref: string;
}

type Phase = 'lobby' | 'taking' | 'submitted';

export default function WritingRunner({
  kind, mode, test, groupId, assignmentId, dueAtMs, durationMinutes, backHref,
}: WritingRunnerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = runnerT(lang);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [activeTask, setActiveTask] = useState<'task1' | 'task2'>('task1');
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');
  const [endTime, setEndTime] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const submittedRef = useRef(false);
  const isAwayRef = useRef(false);

  const isSim = mode === 'simulation';
  const durationMin = durationMinutes || test.total_time_minutes || 60;
  const STORAGE_KEY = sessionKey(user?.uid || 'anon', assignmentId, test.test_id);

  const remainingSec = endTime ? Math.round((endTime - nowTick) / 1000) : 0;
  const autoSubmits = isSim || (kind === 'assignment' && !!dueAtMs && endTime === dueAtMs);

  const w1 = wordCount(task1Text);
  const w2 = wordCount(task2Text);

  // ----- session restore -----
  useEffect(() => {
    if (!user) return;
    const saved = loadSession(STORAGE_KEY);
    if (!saved?.endTime || !saved.startedAt) return;
    let end = saved.endTime;
    if (dueAtMs && end > dueAtMs) end = dueAtMs;
    if (end - Date.now() <= 0 && (isSim || kind === 'assignment')) {
      clearSession(STORAGE_KEY);
      sToast.error(t.runner.expired);
      return;
    }
    setTask1Text(saved.writing?.task1 || '');
    setTask2Text(saved.writing?.task2 || '');
    setEndTime(end);
    setStartedAt(saved.startedAt);
    setTabSwitches(saved.tabSwitches || 0);
    setPhase('taking');
    sToast.success(t.runner.restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ----- autosave -----
  useEffect(() => {
    if (phase !== 'taking' || !endTime || !startedAt) return;
    saveSession(STORAGE_KEY, {
      writing: { task1: task1Text, task2: task2Text },
      endTime, startedAt, tabSwitches,
    });
  }, [task1Text, task2Text, endTime, startedAt, tabSwitches, phase, STORAGE_KEY]);

  // ----- timer -----
  useEffect(() => {
    if (phase !== 'taking') return;
    const id = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'taking' || !endTime || isSubmitting || submittedRef.current) return;
    // Never let practice overtime cross an assignment deadline (server rejects late writes).
    const deadlineHit = kind === 'assignment' && !!dueAtMs && nowTick >= dueAtMs;
    if ((autoSubmits && endTime - nowTick <= 0) || deadlineHit) {
      sToast.reward(t.runner.timeUp, '⏰');
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, phase, endTime, autoSubmits, isSubmitting]);

  // ----- focus tracking -----
  useEffect(() => {
    if (phase !== 'taking' || isSubmitting) return;
    const trigger = () => {
      if (isAwayRef.current) return;
      isAwayRef.current = true;
      setTabSwitches((c) => c + 1);
    };
    const onVisibility = () => { if (document.hidden) trigger(); else isAwayRef.current = false; };
    const onBlur = () => trigger();
    const onFocus = () => { isAwayRef.current = false; };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [phase, isSubmitting]);

  const start = () => {
    const now = Date.now();
    let end = now + durationMin * 60 * 1000;
    if (dueAtMs) end = Math.min(end, dueAtMs);
    setStartedAt(now);
    setEndTime(end);
    setNowTick(now);
    setPhase('taking');
  };

  const handleSubmit = async () => {
    if (submittedRef.current || isSubmitting) return;
    submittedRef.current = true;
    setShowSubmitConfirm(false);
    setIsSubmitting(true);
    try {
      const res = await submitIeltsAttempt({
        kind,
        ...(kind === 'assignment' ? { groupId, assignmentId } : {}),
        testId: test.test_id,
        skill: 'writing',
        mode,
        writing: { task1Text, task2Text },
        tabSwitches,
        timeSpentSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
        startedAt: startedAt || Date.now(),
      });
      clearSession(STORAGE_KEY);
      setResult(res);
      setPhase('submitted');
      sToast.success(t.result.title);
    } catch (e: any) {
      submittedRef.current = false;
      sToast.error(e?.message || t.runner.submitFail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmExit = () => {
    if (phase !== 'taking' || window.confirm(t.runner.exitConfirm)) router.push(backHref);
  };

  // ===========================================================================

  if (phase === 'lobby') {
    return (
      <Page width="full" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background">
        <Card variant="outlined" className="w-full max-w-lg space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-m3-lg bg-primary-container text-on-primary-container">
            <PenLine size={30} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="s-display text-[24px] font-bold leading-tight text-on-surface">{test.test_title}</h1>
            <p className="mt-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
              Task 1 + Task 2 • <span className="s-num">{durationMin}</span> {t.lobby.minutes}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Chip status="primary">IELTS writing</Chip>
              <Chip status={isSim ? 'warning' : 'neutral'}>{isSim ? t.lobby.simulation : t.lobby.practice}</Chip>
            </div>
          </div>
          <Banner
            status="warning"
            className="text-left"
            icon={<AlertCircle size={20} strokeWidth={2.5} />}
            title={t.lobby.rulesTitle}
            description={
              <ul className="list-inside list-disc space-y-1">
                <li>{t.writing.min1} (Task 1) · {t.writing.min2} (Task 2)</li>
                <li>{t.lobby.rule1}</li>
              </ul>
            }
          />
          <div className="space-y-2">
            <Button fullWidth size="lg" onClick={start}>{t.lobby.start}</Button>
            <Button fullWidth variant="text" onClick={() => router.push(backHref)}>{t.common.cancel}</Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (phase === 'submitted' && result) {
    const showModels = kind === 'practice' && (test.task1?.modelAnswer || test.task2?.modelAnswer);
    return (
      <Page width="full" className="fixed inset-0 z-[100] overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-2xl space-y-4 py-6">
          <Card variant="outlined" className="space-y-4 text-center">
            <h1 className="s-display text-[26px] font-bold text-on-surface">{t.result.title}</h1>
            <p className="text-[13.5px] font-bold text-on-surface-variant">
              {result.pendingReview ? t.result.pending : `Task 1: ${w1} ${t.writing.words} · Task 2: ${w2} ${t.writing.words}`}
            </p>
            {result.xpSuggested > 0 && (
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-gold-container px-4 py-2 text-on-gold-container">
                <Zap size={16} fill="currentColor" />
                <span className="s-num text-[15px] font-black">+{result.xpSuggested} {t.result.xp}</span>
              </div>
            )}
            <div className="space-y-2 pt-1">
              {kind === 'practice' && (
                <Button
                  fullWidth
                  icon={<Eye size={18} strokeWidth={2.6} />}
                  onClick={() => router.push(`/ielts/review/${result.attemptId}`)}
                >
                  {t.result.review}
                </Button>
              )}
              <Button fullWidth variant="outlined" onClick={() => router.push(backHref)}>{t.result.back}</Button>
            </div>
          </Card>
          {showModels && (
            <>
              {test.task1?.modelAnswer && (
                <Card variant="outlined" className="space-y-2">
                  <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-on-surface-variant">{t.writing.model} — Task 1</h2>
                  <p className="whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-on-surface">{test.task1.modelAnswer}</p>
                </Card>
              )}
              {test.task2?.modelAnswer && (
                <Card variant="outlined" className="space-y-2">
                  <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-on-surface-variant">{t.writing.model} — Task 2</h2>
                  <p className="whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-on-surface">{test.task2.modelAnswer}</p>
                </Card>
              )}
            </>
          )}
        </div>
      </Page>
    );
  }

  // -------------------------- TAKING --------------------------
  const task = activeTask === 'task1' ? test.task1 : test.task2;
  const text = activeTask === 'task1' ? task1Text : task2Text;
  const setText = activeTask === 'task1' ? setTask1Text : setTask2Text;
  const words = activeTask === 'task1' ? w1 : w2;
  const minWords = activeTask === 'task1' ? 150 : 250;
  const timerDanger = remainingSec <= 600;
  const timerPulse = remainingSec <= 300;

  return (
    <Page width="full" className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background !p-0">
      {isSubmitting && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-[color-mix(in_srgb,var(--m3-surface)_92%,transparent)] backdrop-blur-md">
          <Spinner size={48} label={t.runner.submitting} />
        </div>
      )}

      <ConfirmDialog
        open={showSubmitConfirm && !isSubmitting}
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmit}
        title={t.runner.submitTitle}
        description={`Task 1: ${w1} ${t.writing.words} · Task 2: ${w2} ${t.writing.words}`}
        confirmLabel={t.common.submit}
        cancelLabel={t.common.cancel}
      />

      {/* HEADER */}
      <header className="z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface px-2 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <IconButton aria-label={t.common.back} size="sm" onClick={confirmExit}>
            <X size={18} strokeWidth={2.6} />
          </IconButton>
          <span className="hidden truncate text-[12.5px] font-bold text-on-surface-variant lg:block">{test.test_title}</span>
        </div>
        <SegmentedControl
          label="Task"
          options={[
            { value: 'task1', label: t.writing.task1 },
            { value: 'task2', label: t.writing.task2 },
          ] as const}
          value={activeTask}
          onChange={setActiveTask}
        />
        <div className="flex flex-1 items-center justify-end">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-m3-sm border px-2.5 py-1.5 text-[13px] font-black',
              timerDanger || remainingSec < 0
                ? cn('border-error bg-error-container text-on-error-container', timerPulse && 'animate-pulse')
                : 'border-outline-variant bg-surface-container text-on-surface',
            )}
          >
            <Clock size={14} strokeWidth={2.6} />
            <span className="s-num">{formatClock(remainingSec)}</span>
          </div>
        </div>
      </header>

      {/* MAIN: prompt above (or left on desktop), editor below */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div className="s-scroll max-h-[38%] shrink-0 overflow-y-auto border-b border-outline-variant bg-surface-container-lowest md:max-h-none md:w-[42%] md:border-b-0">
          <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
              {activeTask === 'task1' ? t.writing.task1 : t.writing.task2}
            </p>
            <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-on-surface">{task?.prompt || ''}</p>
            {activeTask === 'task1' && test.task1?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={test.task1.imageUrl}
                alt="Task 1"
                className="max-h-[320px] w-auto rounded-m3-sm border border-outline-variant bg-surface object-contain"
              />
            )}
          </div>
        </div>

        <div className="hidden w-px shrink-0 bg-outline-variant md:block" />

        <div className="flex min-h-0 flex-1 flex-col bg-surface">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.writing.placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            className="s-scroll min-h-0 w-full flex-1 resize-none bg-transparent p-4 text-[15px] font-medium leading-relaxed text-on-surface outline-none placeholder:text-on-surface-variant md:p-6"
          />
          <div className="flex shrink-0 items-center justify-between border-t border-outline-variant bg-surface-container-low px-4 py-2">
            <span
              className={cn(
                's-num text-[12px] font-black uppercase tracking-[0.1em]',
                words >= minWords ? 'text-success' : 'text-on-surface-variant',
              )}
            >
              {words} {t.writing.words} · {activeTask === 'task1' ? t.writing.min1 : t.writing.min2}
            </span>
            <Button size="sm" tone="success" onClick={() => setShowSubmitConfirm(true)}>{t.common.submit}</Button>
          </div>
        </div>
      </main>
    </Page>
  );
}
