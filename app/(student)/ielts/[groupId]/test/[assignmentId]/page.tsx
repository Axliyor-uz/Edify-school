'use client';

// Assignment runner route: loads the group-scoped assignment + its test doc,
// enforces the openAt/dueAt window, assignedTo subset and the attempt limit,
// then hands off to the matching runner (reading/listening → IeltsRunner,
// writing → WritingRunner, speaking → SpeakingRunner).
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { CalendarClock, Eye, Lock, ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '@/app/(student)/layout';
import { Button, Card, ErrorState, Page, Spinner } from '@/components/student-ui';
import IeltsRunner from '@/app/(student)/ielts/_components/runner/IeltsRunner';
import WritingRunner from '@/app/(student)/ielts/_components/runner/WritingRunner';
import SpeakingRunner from '@/app/(student)/ielts/_components/runner/SpeakingRunner';
import { TEST_COLLECTIONS, tsToMs } from '@/app/(student)/ielts/_components/runner/shared';
import { runnerT } from '@/app/(student)/ielts/_components/runner/i18n';

type Block =
  | { kind: 'notOpen'; openAtMs: number }
  | { kind: 'deadline'; attemptExists: boolean }
  | { kind: 'maxAttempts' }
  | { kind: 'notAssigned' }
  | { kind: 'notReady' };

interface LoadedState {
  status: 'loading' | 'error' | 'blocked' | 'ready';
  assignment?: any;
  test?: any;
  block?: Block;
}

export default function IeltsAssignmentRunnerPage() {
  const { groupId, assignmentId } = useParams() as { groupId: string; assignmentId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = runnerT(lang);

  const [state, setState] = useState<LoadedState>({ status: 'loading' });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const aSnap = await getDoc(doc(db, 'ielts_groups', groupId, 'assignments', assignmentId));
        if (!aSnap.exists()) throw new Error('not-found');
        const assignment = aSnap.data();

        // assignedTo subset
        if (Array.isArray(assignment.assignedTo) && !assignment.assignedTo.includes(user.uid)) {
          if (!cancelled) setState({ status: 'blocked', assignment, block: { kind: 'notAssigned' } });
          return;
        }

        const now = Date.now();
        const openAtMs = tsToMs(assignment.openAt);
        const dueAtMs = tsToMs(assignment.dueAt);
        if (openAtMs && now < openAtMs) {
          if (!cancelled) setState({ status: 'blocked', assignment, block: { kind: 'notOpen', openAtMs } });
          return;
        }

        // Attempts: ONE deterministic doc with an attemptsTaken counter.
        const attemptSnap = await getDoc(doc(db, 'ielts_attempts', `${user.uid}_${groupId}_${assignmentId}`));
        const taken = attemptSnap.exists() ? (attemptSnap.data().attemptsTaken || 1) : 0;

        if (dueAtMs && now > dueAtMs) {
          if (!cancelled) setState({ status: 'blocked', assignment, block: { kind: 'deadline', attemptExists: attemptSnap.exists() } });
          return;
        }
        const limit = assignment.allowedAttempts || 1;
        if (taken >= limit) {
          if (!cancelled) setState({ status: 'blocked', assignment, block: { kind: 'maxAttempts' } });
          return;
        }

        const skill: string = assignment.skill;
        const coll = TEST_COLLECTIONS[skill];
        if (!coll) throw new Error('bad-skill');
        const testSnap = await getDoc(doc(db, coll, assignment.testId));
        if (!testSnap.exists()) throw new Error('not-found');
        const test = testSnap.data();

        // Legacy reading/listening docs still embed the key — refuse them.
        if ((skill === 'reading' || skill === 'listening') && !test.answers_split) {
          if (!cancelled) setState({ status: 'blocked', assignment, block: { kind: 'notReady' } });
          return;
        }

        if (!cancelled) setState({ status: 'ready', assignment, test });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [user, groupId, assignmentId]);

  const backHref = `/ielts/${groupId}`;

  if (!user || state.status === 'loading') {
    return (
      <Page width="full" className="grid min-h-[70vh] place-items-center">
        <Spinner size={32} label={t.common.loading} />
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page width="full" className="grid min-h-[70vh] place-items-center">
        <ErrorState title={t.common.error} onRetry={() => router.push(backHref)} retryLabel={t.common.back} />
      </Page>
    );
  }

  if (state.status === 'blocked' && state.block) {
    const b = state.block;
    const attemptDocId = `${user.uid}_${groupId}_${assignmentId}`;
    const info = {
      notOpen: { icon: <CalendarClock size={30} strokeWidth={2.5} />, title: t.guard.notOpen, desc: `${t.guard.notOpenDesc} ${new Date((b as any).openAtMs || 0).toLocaleString()}` },
      deadline: { icon: <Lock size={30} strokeWidth={2.5} />, title: t.guard.deadline, desc: t.guard.deadlineDesc },
      maxAttempts: { icon: <Lock size={30} strokeWidth={2.5} />, title: t.guard.maxAttempts, desc: t.guard.maxAttemptsDesc },
      notAssigned: { icon: <ShieldOff size={30} strokeWidth={2.5} />, title: t.guard.notAssigned, desc: t.guard.notAssignedDesc },
      notReady: { icon: <ShieldOff size={30} strokeWidth={2.5} />, title: t.common.notReady, desc: t.common.notReadyDesc },
    }[b.kind];
    const offerReview = b.kind === 'maxAttempts' || (b.kind === 'deadline' && b.attemptExists);
    return (
      <Page width="full" className="flex min-h-[70vh] items-center justify-center">
        <Card variant="outlined" className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-m3-lg bg-surface-container-high text-on-surface-variant">
            {info.icon}
          </div>
          <div>
            <h1 className="s-display text-[22px] font-bold text-on-surface">{info.title}</h1>
            <p className="mt-2 text-[13.5px] font-bold leading-relaxed text-on-surface-variant">{info.desc}</p>
          </div>
          <div className="space-y-2">
            {offerReview && (
              <Button
                fullWidth
                icon={<Eye size={18} strokeWidth={2.6} />}
                onClick={() => router.push(`/ielts/review/${attemptDocId}`)}
              >
                {t.guard.review}
              </Button>
            )}
            <Button fullWidth variant="outlined" onClick={() => router.push(backHref)}>{t.guard.toGroup}</Button>
          </div>
        </Card>
      </Page>
    );
  }

  // ready
  const { assignment, test } = state;
  const dueAtMs = tsToMs(assignment.dueAt);
  const mode: 'simulation' | 'practice' = assignment.mode === 'simulation' ? 'simulation' : 'practice';
  const common = {
    kind: 'assignment' as const,
    mode,
    groupId,
    assignmentId,
    dueAtMs,
    durationMinutes: assignment.totalTimeMinutes || undefined,
    backHref,
  };

  if (assignment.skill === 'writing') {
    return <WritingRunner {...common} test={test} />;
  }
  if (assignment.skill === 'speaking') {
    return <SpeakingRunner kind="assignment" mode={mode} groupId={groupId} assignmentId={assignmentId} test={test} backHref={backHref} />;
  }
  return <IeltsRunner {...common} skill={assignment.skill === 'listening' ? 'listening' : 'reading'} test={test} />;
}
