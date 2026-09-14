'use client';

import { useEffect, useRef } from 'react';
import { cn } from './cn';
import { DESIGN, MOTION_ON } from './config';
import { ProgressBar } from './Progress';
import { Avatar } from './List';

/* ============================================================================
 * XP / LEVEL
 * ========================================================================= */

export interface XpProgressProps {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP needed to finish the current level. */
  target: number;
  /** Overrides design.config.ts › Xp_display. */
  variant?: typeof DESIGN.Xp_display;
  levelLabel?: string;
  className?: string;
}

/**
 * Progress toward the next level, in whichever form design.config.ts
 * › Xp_display selects.
 */
export function XpProgress({
  level,
  current,
  target,
  variant,
  levelLabel = 'Level',
  className,
}: XpProgressProps) {
  const style = variant ?? DESIGN.Xp_display;
  const safeTarget = Math.max(1, target);
  const pct = Math.max(0, Math.min(100, (current / safeTarget) * 100));
  const a11y = `${levelLabel} ${level}, ${current} of ${safeTarget} XP`;

  if (style === 'ring') {
    return <XpRing level={level} pct={pct} label={levelLabel} a11y={a11y} className={className} />;
  }

  if (style === 'segmented') {
    const segments = 10;
    const filled = (pct / 100) * segments;
    return (
      <div className={cn('w-full', className)}>
        <XpCaption level={level} current={current} target={safeTarget} levelLabel={levelLabel} />
        <div className="flex gap-1.5" role="progressbar" aria-label={a11y} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          {Array.from({ length: segments }).map((_, i) => {
            const fill = Math.max(0, Math.min(1, filled - i));
            return (
              <span key={i} className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-m3-slow ease-m3-std"
                  style={{ width: `${fill * 100}%` }}
                />
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <XpCaption level={level} current={current} target={safeTarget} levelLabel={levelLabel} />
      <ProgressBar value={pct} label={a11y} tone="gradient" size="lg" shine />
    </div>
  );
}

function XpCaption({
  level,
  current,
  target,
  levelLabel,
}: {
  level: number;
  current: number;
  target: number;
  levelLabel: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="s-display text-[17px] font-bold">
        {levelLabel} {level}
      </span>
      <span className="s-num text-[13px] font-black text-on-surface-variant">
        {current.toLocaleString()} / {target.toLocaleString()} XP
      </span>
    </div>
  );
}

function XpRing({
  level,
  pct,
  label,
  a11y,
  className,
}: {
  level: number;
  pct: number;
  label: string;
  a11y: string;
  className?: string;
}) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={cn('relative h-[118px] w-[118px]', className)}
      role="progressbar"
      aria-label={a11y}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 118 118" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="59" cy="59" r={r} fill="none" stroke="var(--m3-surface-container-highest)" strokeWidth="9" />
        <circle
          cx="59"
          cy="59"
          r={r}
          fill="none"
          stroke="var(--m3-primary)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-m3-slow ease-m3-std"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="s-display s-num text-[26px] font-bold leading-none">{level}</span>
        <span className="text-[10.5px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
 * STREAK
 * ========================================================================= */

export interface StreakDisplayProps {
  days: number;
  /** Best streak ever, shown as context. */
  best?: number;
  /** Day keys (YYYY-MM-DD) the student earned XP on. */
  activeDays: readonly string[];
  /** Ordered day keys to render. week_dots expects 7, heat_grid expects ~28. */
  dayKeys: readonly string[];
  /** Short weekday initials aligned to dayKeys — week_dots only. */
  dayLabels?: readonly string[];
  todayKey?: string;
  variant?: typeof DESIGN.Streak_display;
  label?: string;
  className?: string;
}

/** Streak flame plus the recent-activity pattern behind it. */
export function StreakDisplay({
  days,
  best,
  activeDays,
  dayKeys,
  dayLabels,
  todayKey,
  variant,
  label = 'Current streak',
  className,
}: StreakDisplayProps) {
  const style = variant ?? DESIGN.Streak_display;
  const active = new Set(activeDays);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3">
        <span
          className="text-[26px] leading-none"
          style={{ filter: 'drop-shadow(0 2px 6px color-mix(in srgb, var(--s-flame) 45%, transparent))' }}
          aria-hidden
        >
          🔥
        </span>
        <div>
          <div className="s-display s-num text-[23px] font-bold leading-none">{days}</div>
          <div className="text-[12px] font-bold text-on-surface-variant">
            {label}
            {best != null && best > 0 ? ` · best ${best}` : ''}
          </div>
        </div>
      </div>

      {style === 'week_dots' ? (
        <div className="flex gap-2">
          {dayKeys.map((key, i) => {
            const on = active.has(key);
            const isToday = key === todayKey;
            return (
              <span
                key={key}
                title={key}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full text-[10px] font-black',
                  // Fixed medal gold, not the `gold` role: the role token is a
                  // dark olive in light mode, which reads as brown, not earned.
                  on ? 'bg-medal-gold text-medal-ink' : 'bg-surface-container-highest text-on-surface-variant',
                  isToday && !on && 'outline-dashed outline-2 outline-offset-2 outline-medal-gold',
                )}
              >
                {dayLabels?.[i] ?? ''}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5" aria-label="Activity calendar">
          {dayKeys.map((key) => (
            <span
              key={key}
              title={key}
              className={cn(
                'aspect-square rounded-[5px]',
                active.has(key) ? 'bg-primary' : 'bg-surface-container-highest',
                key === todayKey && 'ring-2 ring-gold ring-offset-1 ring-offset-surface',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * LEADERBOARD
 * ========================================================================= */

export interface RankEntry {
  id: string;
  name: string;
  xp: number;
  avatar?: string | null;
  /** Rank change since the previous period. */
  move?: number;
  isMe?: boolean;
}

export interface PodiumProps {
  /** Top three, already sorted best-first. */
  top: readonly RankEntry[];
  /** Called when a podium entry is activated — usually opens their profile.
   *  Omit to render the podium as non-interactive. */
  onSelect?: (entry: RankEntry) => void;
  className?: string;
}

/** Ceremonial top-3 podium. Renders nothing below three entries. */
export function Podium({ top, onSelect, className }: PodiumProps) {
  if (top.length < 3) return null;
  const [first, second, third] = top;

  const col = (entry: RankEntry, place: 1 | 2 | 3) => {
    const heights = { 1: 'h-[104px]', 2: 'h-[76px]', 3: 'h-[60px]' } as const;
    const borders = {
      1: 'border-medal-gold',
      2: 'border-medal-silver',
      3: 'border-medal-bronze',
    } as const;
    const interactive = Boolean(onSelect);
    return (
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? () => onSelect?.(entry) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(entry);
                }
              }
            : undefined
        }
        className={cn(
          'flex max-w-[110px] flex-1 flex-col items-center gap-2',
          interactive && 'cursor-pointer rounded-m3-sm s-press',
        )}
      >
        {place === 1 && <span className="-mb-1 text-[19px]" aria-hidden>👑</span>}
        <Avatar
          src={entry.avatar}
          name={entry.name}
          size={place === 1 ? 'lg' : 'md'}
          className={cn('border-[3px] shadow-elev-1', borders[place])}
        />
        <div
          className={cn(
            'flex w-full flex-col items-center gap-0.5 rounded-t-m3-sm px-2 pt-2.5',
            heights[place],
            place === 1 ? 'bg-gold-container text-on-gold-container' : 'bg-surface-container-high',
          )}
        >
          <span className="w-full truncate text-center text-[13px] font-bold">{entry.name}</span>
          <span className="s-num text-[11.5px] font-black opacity-75">{entry.xp.toLocaleString()} XP</span>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex items-end justify-center gap-2.5', className)}>
      {col(second, 2)}
      {col(first, 1)}
      {col(third, 3)}
    </div>
  );
}

export interface RankRowProps {
  entry: RankEntry;
  rank: number;
  /** Shown instead of the number, e.g. "20+" for unranked students. */
  rankLabel?: string;
  className?: string;
}

/** One leaderboard row. The signed-in student's row is highlighted. */
export function RankRow({ entry, rank, rankLabel, className }: RankRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-s-row-x py-2.5',
        entry.isMe && 'rounded-m3-sm bg-primary-container text-on-primary-container',
        className,
      )}
    >
      <span className="s-display s-num w-7 shrink-0 text-center text-[15px] font-bold opacity-70">
        {rankLabel ?? rank}
      </span>
      <Avatar src={entry.avatar} name={entry.name} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{entry.name}</span>
      {entry.move != null && entry.move !== 0 && (
        <span className={cn('text-[11px] font-black', entry.move > 0 ? 'text-success' : 'text-error')}>
          {entry.move > 0 ? '▲' : '▼'}
          {Math.abs(entry.move)}
        </span>
      )}
      <span className="s-num shrink-0 text-[13.5px] font-black opacity-80">{entry.xp.toLocaleString()}</span>
    </div>
  );
}

/* ============================================================================
 * QUESTS & BADGES
 * ========================================================================= */

export interface Quest {
  id: string;
  title: string;
  /** 0–100. */
  progress: number;
  reward: string;
  done?: boolean;
  icon?: React.ReactNode;
}

/** Daily quest list — the loop that brings students back. */
export function QuestList({ quests, className }: { quests: readonly Quest[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-s-gap', className)}>
      {quests.map((q) => (
        <div
          key={q.id}
          className={cn(
            'flex items-center gap-3 rounded-m3-md border border-outline-variant bg-surface p-3.5',
            q.done && 'opacity-75',
          )}
        >
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm text-[16px]',
              q.done
                ? 'bg-success-container text-on-success-container'
                : 'bg-tertiary-container text-on-tertiary-container',
            )}
            aria-hidden
          >
            {q.done ? '✓' : (q.icon ?? '🎯')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 truncate text-[13.5px] font-bold">{q.title}</p>
            <ProgressBar value={q.progress} label={q.title} size="sm" tone={q.done ? 'success' : 'primary'} />
          </div>
          <span className="shrink-0 rounded-full bg-gold-container px-2.5 py-1 text-[11.5px] font-black text-on-gold-container">
            {q.reward}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface BadgeItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  earned: boolean;
}

/** Achievement grid — earned badges plus locked silhouettes to chase. */
export function BadgeGrid({
  badges,
  variant,
  className,
}: {
  badges: readonly BadgeItem[];
  variant?: typeof DESIGN.Badge_style;
  className?: string;
}) {
  const style = variant ?? DESIGN.Badge_style;

  return (
    <div className={cn('flex flex-wrap justify-center gap-4', className)}>
      {badges.map((b) => (
        <div key={b.id} className="flex w-[78px] flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className={cn(
              'grid h-[60px] w-[60px] place-items-center rounded-full text-[24px]',
              !b.earned && 'border-2 border-dashed border-outline bg-surface-container text-outline',
              b.earned && style === 'medallion' && 'shadow-elev-1',
              b.earned && style === 'flat' && 'bg-gold-container text-on-gold-container',
            )}
            style={
              b.earned && style === 'medallion'
                ? {
                    background:
                      'radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--s-medal-gold) 45%, white), var(--s-medal-gold))',
                  }
                : undefined
            }
          >
            {b.earned ? b.icon : '🔒'}
          </span>
          <span className={cn('text-[11px] font-bold leading-tight text-on-surface-variant', !b.earned && 'opacity-70')}>
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * CELEBRATION
 * ========================================================================= */

/**
 * Confetti burst in the active palette's own colors.
 *
 * Respects design.config.ts › Celebration and the device reduced-motion
 * setting — with either off it renders nothing and costs no animation frames.
 */
export function Celebration({ fire, className }: { fire: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire || DESIGN.Celebration !== 'confetti' || !MOTION_ON) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const cs = getComputedStyle(canvas);
    const colors = ['--m3-primary', '--m3-tertiary', '--m3-secondary', '--m3-gold']
      .map((v) => cs.getPropertyValue(v).trim())
      .filter(Boolean);

    const parts = Array.from({ length: 90 }, (_, i) => ({
      x: rect.width / 2,
      y: rect.height * 0.62,
      vx: (Math.random() - 0.5) * 7,
      vy: -(2 + Math.random() * 6.5),
      size: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length] || '#888',
      life: 1,
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.rot += p.vr;
        p.life -= 0.011;
        if (p.life <= 0 || p.y > rect.height + 10) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, rect.width, rect.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  if (DESIGN.Celebration !== 'confetti') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}

/** Wraps a value that should pop when it changes (level number, XP total). */
export function PopOnChange({ value, className }: { value: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (DESIGN.Celebration === 'none' || !MOTION_ON) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove('s-pop');
    void el.offsetWidth; // restart the animation
    el.classList.add('s-pop');
  }, [value]);

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {value}
    </span>
  );
}
