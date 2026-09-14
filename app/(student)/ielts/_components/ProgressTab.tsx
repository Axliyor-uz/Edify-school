// app/(student)/ielts/_components/ProgressTab.tsx — "My journey" tab of the IELTS hub.
// Cross-group + practice band trajectory built from the attempts already loaded by the hub.
'use client';

import { TrendingUp, Play } from 'lucide-react';
import { Card, Chip, Button, EmptyState, Sparkline, StatTile } from '@/components/student-ui';
import { overallBand } from '@/lib/ielts/bands';
import type { IeltsSkill } from '@/lib/ielts/types';
import { SKILLS } from './hubTexts';
import { attemptBand, type AttemptDoc } from './hubData';

export default function ProgressTab({
  attempts, t, onGoPractice,
}: {
  /** Newest-first, as returned by fetchMyAttempts. */
  attempts: AttemptDoc[];
  t: any;
  onGoPractice: () => void;
}) {
  const graded = attempts.filter(a => attemptBand(a) != null);

  // Oldest → newest for the trend line, last 16 points.
  const bands = [...graded].reverse().map(a => attemptBand(a) as number).slice(-16);

  const perSkill = SKILLS
    .map(({ key }) => {
      const list = graded.filter(a => a.skill === key);
      if (!list.length) return null;
      return {
        key,
        latest: attemptBand(list[0]) as number,
        best: Math.max(...list.map(a => attemptBand(a) as number)),
        count: list.length,
      };
    })
    .filter((s): s is { key: IeltsSkill; latest: number; best: number; count: number } => s != null);

  const overall = perSkill.length ? overallBand(perSkill.map(s => s.latest)) : null;

  if (graded.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="📈"
          title={t.progress.emptyTitle}
          description={t.progress.emptyDesc}
          action={
            <Button icon={<Play size={16} strokeWidth={3} />} onClick={onGoPractice}>
              {t.progress.emptyCta}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-s-gap">
      <div>
        <h2 className="s-display text-lg font-bold">{t.progress.title}</h2>
        <p className="mt-0.5 text-[13px] font-bold text-on-surface-variant">{t.progress.subtitle}</p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-s-gap sm:grid-cols-3">
        <StatTile
          label={t.progress.overall}
          value={overall != null ? overall.toFixed(1) : '—'}
          tone="gold"
        />
        <StatTile label={t.progress.attempts} value={attempts.length} />
        <StatTile label={t.progress.graded} value={graded.length} className="max-sm:col-span-2" />
      </div>

      {/* Trend line — needs at least two graded attempts to mean anything */}
      {bands.length >= 2 && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="s-display inline-flex items-center gap-2 text-[15px] font-bold">
              <TrendingUp size={18} strokeWidth={2.5} className="text-primary" />
              {t.progress.trend}
            </h3>
            <Chip status="neutral" size="sm">{bands.length}</Chip>
          </div>
          <Sparkline data={bands} className="text-primary" />
        </Card>
      )}

      {/* Per-skill latest / best */}
      <div className="grid grid-cols-2 gap-s-gap sm:grid-cols-4">
        {perSkill.map(s => (
          <Card key={s.key} className="flex flex-col gap-1">
            <div className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              {t.skills[s.key]}
            </div>
            <div className="s-num s-display text-[22px] font-bold leading-none">{s.latest.toFixed(1)}</div>
            <div className="text-[11.5px] font-bold text-on-surface-variant">
              {t.progress.best} {s.best.toFixed(1)} · {s.count}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
