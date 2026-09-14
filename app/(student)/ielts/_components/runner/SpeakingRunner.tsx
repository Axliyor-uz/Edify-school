'use client';

// IELTS speaking runner: 3 parts, one MediaRecorder recording per part.
// Part 1 & 3: question lists shown one-at-a-time while recording.
// Part 2: cue card → 1:00 prep countdown → 2:00 talk countdown (recorded).
// Each finished part uploads to Storage (ielts_speaking/{uid}/…), URLs survive
// reloads via the session; re-record before submit in practice mode only.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, Mic, Square, Zap } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '@/app/(student)/layout';
import {
  Banner, Button, Card, Chip, IconButton, Page, Spinner, cn, sToast,
} from '@/components/student-ui';
import type { IeltsSpeakingTest } from '@/lib/ielts/types';
import { submitIeltsAttempt, type SubmitResult } from '@/services/ieltsService';
import { clearSession, formatClock, loadSession, saveSession, sessionKey } from './shared';
import { runnerT } from './i18n';

export interface SpeakingRunnerProps {
  kind: 'assignment' | 'practice';
  mode: 'simulation' | 'practice';
  test: IeltsSpeakingTest & { test_id: string };
  groupId?: string;
  assignmentId?: string;
  backHref: string;
}

type Step = 'intro' | 'part1' | 'part2prep' | 'part2talk' | 'part3' | 'review' | 'submitted';

const PREP_SEC = 60;   // Part 2 preparation
const TALK_SEC = 120;  // Part 2 talk

const pickMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
};

export default function SpeakingRunner({
  kind, mode, test, groupId, assignmentId, backHref,
}: SpeakingRunnerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = runnerT(lang);

  const [step, setStep] = useState<Step>('intro');
  const [urls, setUrls] = useState<Record<string, string>>({}); // "1" | "2" | "3" → download URL
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micError, setMicError] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null); // part-2 prep/talk seconds left
  const [elapsed, setElapsed] = useState(0); // recording elapsed (parts 1/3)
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const submittedRef = useRef(false);
  const isAwayRef = useRef(false);

  const STORAGE_KEY = sessionKey(user?.uid || 'anon', assignmentId, test.test_id);
  const isPractice = mode === 'practice';

  const part1: string[] = test.part1Questions || [];
  const part3: string[] = test.part3Questions || [];
  const cue = test.part2CueCard || { topic: '', bullets: [] };

  // ----- session restore: keep already-uploaded parts across reloads -----
  useEffect(() => {
    if (!user) return;
    const saved = loadSession(STORAGE_KEY);
    if (!saved?.speakingUrls || !saved.startedAt) return;
    setUrls(saved.speakingUrls);
    setStartedAt(saved.startedAt);
    setTabSwitches(saved.tabSwitches || 0);
    const done = saved.speakingUrls;
    if (done['1'] && done['2'] && done['3']) setStep('review');
    else if (done['1'] && done['2']) setStep('part3');
    else if (done['1']) setStep('part2prep');
    else setStep('part1');
    sToast.success(t.runner.restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ----- autosave -----
  useEffect(() => {
    if (step === 'intro' || step === 'submitted' || !startedAt) return;
    saveSession(STORAGE_KEY, { speakingUrls: urls, startedAt, tabSwitches });
  }, [urls, startedAt, tabSwitches, step, STORAGE_KEY]);

  // ----- focus counting -----
  useEffect(() => {
    if (step === 'intro' || step === 'submitted' || isSubmitting) return;
    const trigger = () => {
      if (isAwayRef.current) return;
      isAwayRef.current = true;
      setTabSwitches((c) => c + 1);
    };
    const onVisibility = () => { if (document.hidden) trigger(); else isAwayRef.current = false; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [step, isSubmitting]);

  // ----- countdowns -----
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      if (step === 'part2prep') {
        // prep over → start the 2:00 talk (recording)
        void startRecording(2);
        setStep('part2talk');
        setCountdown(TALK_SEC);
      } else if (step === 'part2talk') {
        stopRecording();
        setCountdown(null);
      }
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, step]);

  // recording elapsed ticker (parts 1/3 have no fixed limit)
  useEffect(() => {
    if (!recording) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => () => {
    // unmount: kill any live recorder + mic
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null; // don't upload on abandon
      rec.stop();
    }
    rec?.stream.getTracks().forEach((tr) => tr.stop());
  }, []);

  const partForStep = (s: Step): number => (s === 'part1' ? 1 : s === 'part3' ? 3 : 2);

  const uploadPart = async (part: number, blob: Blob) => {
    if (!user) return;
    setUploading(true);
    try {
      const r = storageRef(storage, `ielts_speaking/${user.uid}/${Date.now()}_part${part}.webm`);
      await uploadBytes(r, blob, { contentType: blob.type || 'audio/webm' });
      const url = await getDownloadURL(r);
      setUrls((prev) => ({ ...prev, [String(part)]: url }));
      // advance flow
      if (part === 1) setStep('part2prep');
      else if (part === 2) { setStep('part3'); setQuestionIdx(0); }
      else setStep('review');
    } catch {
      sToast.error(t.speaking.uploadFail);
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async (part: number) => {
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        void uploadPart(part, blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      if (!startedAt) setStartedAt(Date.now());
    } catch {
      setMicError(true);
      sToast.error(t.speaking.micDenied);
      // Part 2 flow: if the mic fails at talk start, fall back to the cue view.
      if (step === 'part2prep' || step === 'part2talk') { setStep('part2prep'); setCountdown(null); }
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };

  const rerecord = (part: number) => {
    setUrls((prev) => {
      const next = { ...prev };
      delete next[String(part)];
      return next;
    });
    setQuestionIdx(0);
    if (part === 1) setStep('part1');
    else if (part === 2) { setStep('part2prep'); setCountdown(null); }
    else setStep('part3');
  };

  const handleSubmit = async () => {
    if (submittedRef.current || isSubmitting) return;
    submittedRef.current = true;
    setIsSubmitting(true);
    try {
      const speaking: Record<string, string> = {};
      if (urls['1']) speaking.part1AudioUrl = urls['1'];
      if (urls['2']) speaking.part2AudioUrl = urls['2'];
      if (urls['3']) speaking.part3AudioUrl = urls['3'];
      const res = await submitIeltsAttempt({
        kind,
        ...(kind === 'assignment' ? { groupId, assignmentId } : {}),
        testId: test.test_id,
        skill: 'speaking',
        mode,
        speaking,
        tabSwitches,
        timeSpentSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
        startedAt: startedAt || Date.now(),
      });
      clearSession(STORAGE_KEY);
      setResult(res);
      setStep('submitted');
      sToast.success(t.result.title);
    } catch (e: any) {
      submittedRef.current = false;
      sToast.error(e?.message || t.runner.submitFail);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===========================================================================

  const Header = ({ label }: { label: string }) => (
    <header className="z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface px-2 sm:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <IconButton
          aria-label={t.common.back}
          size="sm"
          onClick={() => {
            if (step === 'intro' || window.confirm(t.runner.exitConfirm)) router.push(backHref);
          }}
        >
          <ChevronLeft size={18} strokeWidth={2.6} />
        </IconButton>
        <span className="truncate text-[12.5px] font-bold text-on-surface-variant">{test.test_title}</span>
      </div>
      <Chip status="primary" size="sm">{label}</Chip>
      <div className="flex flex-1 justify-end">
        {/* Part progress dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((p) => (
            <span
              key={p}
              className={cn(
                'h-2 w-2 rounded-full',
                urls[String(p)] ? 'bg-success' : 'bg-outline-variant',
              )}
            />
          ))}
        </div>
      </div>
    </header>
  );

  const RecordBar = ({ part }: { part: number }) => (
    <div className="flex shrink-0 flex-col items-center gap-2 border-t border-outline-variant bg-surface-container-low px-4 py-4 pb-[max(env(safe-area-inset-bottom,16px),16px)]">
      {micError && (
        <Banner status="error" title={t.speaking.micDenied} className="w-full max-w-md" />
      )}
      {uploading ? (
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Spinner size={18} label={t.speaking.uploading} />
          <span className="text-[13px] font-bold">{t.speaking.uploading}</span>
        </div>
      ) : recording ? (
        <>
          <div className="flex items-center gap-2 text-error">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
            <span className="text-[13px] font-black uppercase tracking-[0.1em]">{t.speaking.recording}</span>
            <span className="s-num text-[13px] font-black">{formatClock(elapsed)}</span>
          </div>
          <Button size="lg" tone="error" icon={<Square size={18} fill="currentColor" />} onClick={stopRecording}>
            {t.speaking.stop}
          </Button>
        </>
      ) : (
        <Button size="lg" icon={<Mic size={20} strokeWidth={2.6} />} onClick={() => startRecording(part)}>
          {t.speaking.record}
        </Button>
      )}
    </div>
  );

  if (step === 'intro') {
    return (
      <Page width="full" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background">
        <Card variant="outlined" className="w-full max-w-lg space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-m3-lg bg-primary-container text-on-primary-container">
            <Mic size={30} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="s-display text-[24px] font-bold leading-tight text-on-surface">{test.test_title}</h1>
            <div className="mt-3 flex justify-center gap-2">
              <Chip status="primary">IELTS speaking</Chip>
              <Chip status={mode === 'simulation' ? 'warning' : 'neutral'}>
                {mode === 'simulation' ? t.lobby.simulation : t.lobby.practice}
              </Chip>
            </div>
          </div>
          <Banner
            status="info"
            className="text-left"
            icon={<AlertCircle size={20} strokeWidth={2.5} />}
            title={t.speaking.intro}
            description={t.speaking.micNote}
          />
          <div className="space-y-2">
            <Button fullWidth size="lg" onClick={() => { setStartedAt(Date.now()); setStep('part1'); }}>
              {t.speaking.begin}
            </Button>
            <Button fullWidth variant="text" onClick={() => router.push(backHref)}>{t.common.cancel}</Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (step === 'submitted' && result) {
    return (
      <Page width="full" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background">
        <Card variant="outlined" className="w-full max-w-md space-y-4 text-center">
          <h1 className="s-display text-[26px] font-bold text-on-surface">{t.result.title}</h1>
          <p className="text-[13.5px] font-bold text-on-surface-variant">
            {result.pendingReview ? t.result.pending : t.result.title}
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
      </Page>
    );
  }

  if (step === 'review') {
    return (
      <Page width="full" className="fixed inset-0 z-[100] overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-xl space-y-4 py-6">
          <Card variant="outlined" className="space-y-4">
            <h1 className="s-display text-center text-[22px] font-bold text-on-surface">{t.speaking.reviewTitle}</h1>
            {[1, 2, 3].map((p) => (
              <div key={p} className="rounded-m3-md border border-outline-variant bg-surface-container-low p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-black uppercase tracking-[0.1em] text-on-surface-variant">
                    {t.speaking.part} {p}
                  </span>
                  {isPractice && (
                    <Button size="sm" variant="text" onClick={() => rerecord(p)}>{t.speaking.rerecord}</Button>
                  )}
                </div>
                {urls[String(p)] ? (
                  <audio controls src={urls[String(p)]} preload="metadata" className="h-9 w-full" />
                ) : (
                  <p className="text-[13px] font-bold text-on-surface-variant">—</p>
                )}
              </div>
            ))}
            <Button fullWidth size="lg" tone="success" loading={isSubmitting} onClick={handleSubmit}>
              {t.common.submit}
            </Button>
          </Card>
        </div>
      </Page>
    );
  }

  // ---------------- Part 1 / Part 3 (question list, one at a time) ----------------
  if (step === 'part1' || step === 'part3') {
    const questions = step === 'part1' ? part1 : part3;
    const partNo = partForStep(step);
    const q = questions[questionIdx] || '';
    return (
      <Page width="full" className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background !p-0">
        <Header label={`${t.speaking.part} ${partNo}`} />
        <main className="s-scroll flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          <p className="text-[12px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
            {t.speaking.question} <span className="s-num">{Math.min(questionIdx + 1, Math.max(questions.length, 1))} / {questions.length || 1}</span>
          </p>
          <h2 className="max-w-xl text-center text-[22px] font-bold leading-snug text-on-surface md:text-[26px]">{q}</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="outlined"
              size="sm"
              disabled={questionIdx === 0}
              icon={<ChevronLeft size={16} />}
              onClick={() => setQuestionIdx((i) => Math.max(0, i - 1))}
            >
              {t.speaking.prev}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={questionIdx >= questions.length - 1}
              trailingIcon={<ChevronRight size={16} />}
              onClick={() => setQuestionIdx((i) => Math.min(questions.length - 1, i + 1))}
            >
              {t.speaking.next}
            </Button>
          </div>
        </main>
        <RecordBar part={partNo} />
      </Page>
    );
  }

  // ---------------- Part 2: cue card, prep → talk ----------------
  const inPrep = step === 'part2prep';
  return (
    <Page width="full" className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background !p-0">
      <Header label={`${t.speaking.part} 2`} />
      <main className="s-scroll flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
        <Card variant="outlined" className="w-full max-w-xl space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.speaking.cueCard}</p>
          <h2 className="text-[19px] font-bold leading-snug text-on-surface">{cue.topic}</h2>
          {Array.isArray(cue.bullets) && cue.bullets.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-[14.5px] font-medium text-on-surface-variant">
              {cue.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </Card>

        {countdown != null ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
              {inPrep ? t.speaking.prep : t.speaking.talk}
            </span>
            <span
              className={cn(
                's-display s-num text-[44px] font-bold leading-none',
                countdown <= 10 ? 'animate-pulse text-error' : inPrep ? 'text-on-surface' : 'text-primary',
              )}
            >
              {formatClock(countdown)}
            </span>
            {!inPrep && recording && (
              <span className="mt-1 flex items-center gap-1.5 text-error">
                <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                <span className="text-[12px] font-black uppercase tracking-[0.1em]">{t.speaking.recording}</span>
              </span>
            )}
          </div>
        ) : uploading ? (
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Spinner size={18} label={t.speaking.uploading} />
            <span className="text-[13px] font-bold">{t.speaking.uploading}</span>
          </div>
        ) : (
          <Button size="lg" onClick={() => setCountdown(PREP_SEC)}>{t.speaking.startPrep}</Button>
        )}

        {micError && <Banner status="error" title={t.speaking.micDenied} className="w-full max-w-md" />}

        {!inPrep && recording && (
          <Button size="lg" tone="error" icon={<Square size={18} fill="currentColor" />} onClick={() => { stopRecording(); setCountdown(null); }}>
            {t.speaking.stop}
          </Button>
        )}
      </main>
    </Page>
  );
}
