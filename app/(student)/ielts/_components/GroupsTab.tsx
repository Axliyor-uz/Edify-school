// app/(student)/ielts/_components/GroupsTab.tsx — "My groups" tab of the IELTS hub.
// Groups only: teacher-assigned mocks live one level deeper, in /ielts/{groupId}.
'use client';

import Link from 'next/link';
import { Target, Users, ChevronRight, BookOpen } from 'lucide-react';
import { Card, Tile, Chip, Button, Banner, EmptyState, ErrorState } from '@/components/student-ui';
import type { IeltsGroup } from '@/lib/ielts/types';

function bandBadgeStatus(band: number) {
  if (band >= 8)   return 'success' as const;
  if (band >= 6.5) return 'gold' as const;
  return                  'error' as const;
}

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({ group, t }: { group: IeltsGroup; t: any }) {
  const band = Number(group.targetBand);
  return (
    <Link href={`/ielts/${group.id}`} className="block">
      <Card interactive flush className="group flex h-full flex-col overflow-hidden">

        {/* Body */}
        <div className="flex flex-col gap-4 p-s-card">
          {/* Band badge + arrow */}
          <div className="flex items-start justify-between gap-2">
            {Number.isFinite(band) && band > 0 ? (
              <Chip status={bandBadgeStatus(band)} size="md">
                🎯 Band {band.toFixed(1)}
              </Chip>
            ) : <span />}
            <Tile tone="neutral" size="sm" className="group-hover:bg-primary group-hover:text-on-primary">
              <ChevronRight size={18} strokeWidth={3} />
            </Tile>
          </div>

          {/* Title + description */}
          <div>
            <h3 className="s-display text-xl font-bold leading-tight line-clamp-2">
              {group.title}
            </h3>
            {group.description && (
              <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-on-surface-variant">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer — deliberately NO joinCode: members must not be able to re-share the
            group's code and bypass the teacher's request/approve flow. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-outline-variant px-s-card py-4">
          <div className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-on-surface-variant">
            <Users size={14} strokeWidth={3} />
            {group.studentIds?.length ?? 0} {t.groups.students}
          </div>
        </div>

      </Card>
    </Link>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
export default function GroupsTab({
  groups, error, t, onJoin, onGoPractice, joinButton,
}: {
  groups: IeltsGroup[];
  error: boolean;
  t: any;
  onJoin: () => void;
  onGoPractice: () => void;
  joinButton: React.ReactNode;
}) {
  if (error) {
    return (
      <Card>
        <ErrorState
          title={t.groups.errorTitle}
          description={t.groups.errorDesc}
          retryLabel={t.groups.errorRetry}
          onRetry={() => window.location.reload()}
        />
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Target size={30} strokeWidth={2.5} />}
          title={t.groups.emptyTitle}
          description={t.groups.emptyDesc}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {joinButton}
              <Button
                variant="tonal"
                icon={<BookOpen size={16} strokeWidth={2.75} />}
                onClick={onGoPractice}
              >
                {t.groups.emptyPractice}
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-s-gap">
      <div>
        <h2 className="s-display text-lg font-bold">{t.groups.title}</h2>
        <p className="mt-0.5 text-[13px] font-bold text-on-surface-variant">{t.groups.subtitle}</p>
      </div>

      <div className="grid gap-s-gap sm:grid-cols-2">
        {groups.map(g => (
          <GroupCard key={g.id} group={g} t={t} />
        ))}
      </div>

      <Banner
        status="gold"
        icon="💡"
        title={
          <span className="font-bold">
            {t.groups.tip.before}{' '}
            <button onClick={onJoin} className="font-black underline underline-offset-2">
              {t.groups.tip.link}
            </button>{' '}
            {t.groups.tip.middle} <span className="font-black">I-XXXX</span> {t.groups.tip.after}
          </span>
        }
      />
    </section>
  );
}
