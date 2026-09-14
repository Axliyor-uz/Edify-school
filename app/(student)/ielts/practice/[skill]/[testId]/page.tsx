'use client';

// Practice runner route: any published test, any of the four skills, practice
// mode (replayable audio, non-blocking timer), unlimited retakes.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '@/app/(student)/layout';
import { Button, Card, ErrorState, Page, Spinner } from '@/components/student-ui';
import IeltsRunner from '@/app/(student)/ielts/_components/runner/IeltsRunner';
import WritingRunner from '@/app/(student)/ielts/_components/runner/WritingRunner';
import SpeakingRunner from '@/app/(student)/ielts/_components/runner/SpeakingRunner';
import { TEST_COLLECTIONS } from '@/app/(student)/ielts/_components/runner/shared';
import { runnerT } from '@/app/(student)/ielts/_components/runner/i18n';

const SKILLS = ['reading', 'listening', 'writing', 'speaking'] as const;
type Skill = (typeof SKILLS)[number];

export default function IeltsPracticeRunnerPage() {
  const params = useParams() as { skill: string; testId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = runnerT(lang);

  const skill = SKILLS.includes(params.skill as Skill) ? (params.skill as Skill) : null;
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'notReady' | 'ready'; test?: any }>({ status: 'loading' });

  useEffect(() => {
    if (!user || !skill) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, TEST_COLLECTIONS[skill], params.testId));
        if (!snap.exists()) throw new Error('not-found');
        const test = snap.data();
        if ((skill === 'reading' || skill === 'listening') && !test.answers_split) {
          if (!cancelled) setState({ status: 'notReady' });
          return;
        }
        if (!cancelled) setState({ status: 'ready', test });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [user, skill, params.testId]);

  const backHref = '/ielts';

  if (!skill || state.status === 'error') {
    return (
      <Page width="full" className="grid min-h-[70vh] place-items-center">
        <ErrorState title={t.common.notFound} onRetry={() => router.push(backHref)} retryLabel={t.common.back} />
      </Page>
    );
  }

  if (!user || state.status === 'loading') {
    return (
      <Page width="full" className="grid min-h-[70vh] place-items-center">
        <Spinner size={32} label={t.common.loading} />
      </Page>
    );
  }

  if (state.status === 'notReady') {
    return (
      <Page width="full" className="flex min-h-[70vh] items-center justify-center">
        <Card variant="outlined" className="w-full max-w-md space-y-4 text-center">
          <h1 className="s-display text-[22px] font-bold text-on-surface">{t.common.notReady}</h1>
          <p className="text-[13.5px] font-bold leading-relaxed text-on-surface-variant">{t.common.notReadyDesc}</p>
          <Button fullWidth variant="outlined" onClick={() => router.push(backHref)}>{t.common.back}</Button>
        </Card>
      </Page>
    );
  }

  const test = state.test;
  if (skill === 'writing') {
    return <WritingRunner kind="practice" mode="practice" test={test} backHref={backHref} />;
  }
  if (skill === 'speaking') {
    return <SpeakingRunner kind="practice" mode="practice" test={test} backHref={backHref} />;
  }
  return <IeltsRunner kind="practice" mode="practice" skill={skill} test={test} backHref={backHref} />;
}
