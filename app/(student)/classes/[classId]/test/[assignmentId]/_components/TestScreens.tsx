'use client';

import { Clock, AlertCircle, Zap, Eye, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Banner, Button, Card, Page, Tile, cn } from '@/components/student-ui';

export function TestLobby({ state, startTest, router, t }: any) {
  return (
    <Page width="full" className="flex min-h-[80vh] items-center justify-center">
      <Card variant="outlined" className="w-full max-w-lg space-y-6 text-center">
        <Tile tone="primary" size="lg" className="mx-auto h-20 w-20 rounded-full">
          <Clock size={40} />
        </Tile>
        <div>
          <h1 className="s-display text-[28px] font-bold leading-tight text-on-surface">{state.test.title}</h1>
          <p className="mt-1.5 text-[13px] font-bold text-on-surface-variant">
            {state.questions.length} {t.lobby.questions} • {state.test.duration || 60} {t.lobby.minutes}
          </p>
        </div>
        <Banner
          status="warning"
          className="text-left"
          icon={<AlertCircle size={22} />}
          title={t.lobby.instructions}
          description={
            <ul className="list-inside list-disc space-y-1">
              <li>{t.lobby.rule1}</li>
              <li>{t.lobby.rule2}</li>
              <li>{t.lobby.rule3}</li>
            </ul>
          }
        />
        <div className="space-y-2">
          <Button fullWidth size="lg" onClick={startTest}>{t.lobby.startBtn}</Button>
          <Button fullWidth variant="text" onClick={() => router.back()}>{t.lobby.cancel}</Button>
        </div>
      </Card>
    </Page>
  );
}

export function TestResults({ state, classId, assignmentId, isPastDeadline, router, t }: any) {
  const visibility = state.test.resultsVisibility || (state.test.showResults ? 'always' : 'never');
  const canShow = visibility === 'always' || (visibility === 'after_due' && isPastDeadline(state.assignment.dueAt));
  const accuracy = Math.round((state.score! / state.questions.length) * 100);

  return (
    <Page width="full" className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-10">
         <div className="absolute left-10 top-10 text-9xl">🎉</div>
         <div className="absolute bottom-10 right-10 text-9xl">✨</div>
      </div>

      <Card variant="outlined" className="relative z-10 w-full max-w-md space-y-6 text-center">
        <div>
           <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-full bg-gold-container text-on-gold-container">
              <div className="text-6xl">🏆</div>
           </div>
           <h1 className="s-display text-[28px] font-bold leading-tight text-on-surface">{t.result.submitted}</h1>
           <p className="mt-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.result.saved}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
           {state.earnedXP !== undefined && state.earnedXP > 0 && (
             <div className="col-span-2 flex flex-col items-center overflow-hidden rounded-m3-lg bg-gold p-5 text-on-gold">
                <div className="mb-1 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] opacity-80">
                  <Zap size={16} fill="currentColor" /> {t.result.xpEarned}
                </div>
                <span className="s-display s-num text-[46px] font-bold leading-none tracking-tight">+{state.earnedXP}</span>
                {state.xpBreakdown && state.xpBreakdown.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {state.xpBreakdown.map((item: string, idx: number) => (
                      <span key={idx} className="rounded-full bg-gold-container px-2 py-0.5 text-[10px] font-black text-on-gold-container">
                        {item.split(':')[0]}
                      </span>
                    ))}
                  </div>
                )}
             </div>
           )}

           <div className="flex flex-col items-center justify-center rounded-m3-lg border border-outline-variant bg-surface p-4">
              <span className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.result.score}</span>
              <span className="s-display s-num text-[24px] font-bold text-primary">
                {state.score} <span className="text-[14px] text-on-surface-variant">/ {state.questions.length}</span>
              </span>
           </div>

           <div className="flex flex-col items-center justify-center rounded-m3-lg border border-outline-variant bg-surface p-4">
              <span className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{t.result.accuracy}</span>
              <span className={cn('s-display s-num text-[24px] font-bold', accuracy >= 80 ? 'text-success' : accuracy >= 60 ? 'text-gold' : 'text-error')}>
                {accuracy}%
              </span>
           </div>
        </div>

        <div className="space-y-3 pt-2">
          {canShow ? (
            <Button
              fullWidth
              size="lg"
              icon={<Eye size={22} />}
              onClick={() => router.push(`/classes/${classId}/test/${assignmentId}/results`)}
            >
              {t.actions.viewResults}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-m3-md border border-dashed border-outline-variant bg-surface-container p-4 text-[13px] font-bold text-on-surface-variant">
              <Lock size={16} /> {t.result.hidden}
            </div>
          )}
          <Button fullWidth variant="outlined" onClick={() => router.push(`/classes/${classId}`)}>
            {t.actions.returnClass}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
