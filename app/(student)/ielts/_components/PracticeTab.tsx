// app/(student)/ielts/_components/PracticeTab.tsx — "Practice" tab of the IELTS hub.
// Platform tests only (source: 'platform', unlimited retakes). Summaries come from
// ielts_test_meta via fetchPlatformTestSummaries — see docs/IELTS.md.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ListChecks, Play, X } from 'lucide-react';
import {
  Card, Chip, Button, FilterChip, EmptyState, ErrorState, LoadingState,
} from '@/components/student-ui';
import { fetchPlatformTestSummaries, type PlatformTestSummary } from '@/services/ieltsService';
import type { IeltsSkill } from '@/lib/ielts/types';
import { typeLabel } from '@/lib/ielts/typeLabels';
import { SKILLS } from './hubTexts';

// ─── Module-level 60s cache (student-page convention) ────────────────────────
const CACHE_TTL = 60_000;
const platformTestsCache: Record<string, { at: number; data: PlatformTestSummary[] }> = {};

// ─── Practice test card ───────────────────────────────────────────────────────
function PracticeTestCard({
  test, skill, bestBand, t,
}: {
  test: PlatformTestSummary; skill: IeltsSkill; bestBand: number | null; t: any;
}) {
  const title = test.test_title || test.id;
  const minutes = test.total_time_minutes;

  // Question-type mix (reading/listening) — precomputed in ielts_test_meta.
  const mixChips = Object.entries(test.typeBreakdown || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, n]) => ({ label: typeLabel(type), n }));

  const info = skill === 'writing'
    ? t.practice.writingInfo
    : skill === 'speaking'
      ? t.practice.speakingInfo
      : `${test.total_questions} ${t.practice.questions}`;

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="s-display min-w-0 text-[16px] font-bold leading-tight line-clamp-2">{title}</h3>
        {bestBand != null && (
          <Chip status="gold" size="sm">{t.practice.bestBand} {bestBand.toFixed(1)}</Chip>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-bold text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <ListChecks size={14} strokeWidth={2.5} /> {info}
        </span>
        {minutes > 0 && (
          <span className="s-num inline-flex items-center gap-1">
            <Clock size={14} strokeWidth={2.5} /> {minutes} {t.practice.minutes}
          </span>
        )}
      </div>

      {mixChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mixChips.map(({ label, n }) => (
            <Chip key={label} status="neutral" size="sm">{n} × {label}</Chip>
          ))}
        </div>
      )}

      <div className="mt-auto pt-1">
        <Link href={`/ielts/practice/${skill}/${test.id}`} className="block">
          <Button fullWidth variant="tonal" icon={<Play size={16} strokeWidth={3} />}>
            {t.practice.practiceBtn}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
export default function PracticeTab({
  skill, typeFilter, bestBandByTest, t, onSkillChange, onClearType,
}: {
  skill: IeltsSkill;
  /** Weak-type deep link from the group page (`?type=`) — reading/listening only. */
  typeFilter: string | null;
  bestBandByTest: Record<string, number>;
  t: any;
  onSkillChange: (skill: IeltsSkill) => void;
  onClearType: () => void;
}) {
  const [tests, setTests] = useState<PlatformTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Lazy per selected skill, 60s module cache.
  useEffect(() => {
    let alive = true;
    const cached = platformTestsCache[skill];
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setTests(cached.data);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPlatformTestSummaries(skill)
      .then(data => {
        platformTestsCache[skill] = { at: Date.now(), data };
        if (alive) { setTests(data); setError(false); setLoading(false); }
      })
      .catch(() => { if (alive) { setTests([]); setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [skill]);

  const visibleTests = typeFilter && (skill === 'reading' || skill === 'listening')
    ? tests.filter(test => (test.typeBreakdown?.[typeFilter] || 0) > 0)
    : tests;

  return (
    <section className="flex flex-col gap-s-gap">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="s-display text-lg font-bold">{t.practice.title}</h2>
          <p className="mt-0.5 text-[13px] font-bold text-on-surface-variant">{t.practice.subtitle}</p>
        </div>
        {!loading && !error && visibleTests.length > 0 && (
          <Chip status="neutral" size="sm">{t.practice.count(visibleTests.length)}</Chip>
        )}
      </div>

      {/* Skill filter chips */}
      <div className="s-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {SKILLS.map(({ icon: Icon, key }) => (
          <FilterChip
            key={key}
            selected={skill === key}
            onClick={() => onSkillChange(key)}
            icon={<Icon size={15} strokeWidth={2.5} />}
          >
            {t.skills[key]}
          </FilterChip>
        ))}
      </div>

      {/* Active weak-type filter (deep link from the group page) */}
      {typeFilter && (skill === 'reading' || skill === 'listening') && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-black uppercase tracking-widest text-on-surface-variant">
            {t.practice.filteredBy}
          </span>
          <FilterChip selected onClick={onClearType} icon={<X size={15} strokeWidth={2.5} />}>
            {typeLabel(typeFilter)} — {t.practice.typeFilterClear}
          </FilterChip>
        </div>
      )}

      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <Card>
          <ErrorState
            title={t.practice.loadError}
            description={t.groups.errorDesc}
            retryLabel={t.groups.errorRetry}
            onRetry={() => window.location.reload()}
          />
        </Card>
      ) : visibleTests.length === 0 ? (
        <Card>
          <EmptyState icon="📚" title={t.practice.emptyTitle} description={t.practice.emptyDesc} />
        </Card>
      ) : (
        <div className="grid gap-s-gap sm:grid-cols-2">
          {visibleTests.map(test => (
            <PracticeTestCard
              key={test.id}
              test={test}
              skill={skill}
              bestBand={bestBandByTest[test.id] ?? null}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}
