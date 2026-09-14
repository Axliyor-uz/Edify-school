'use client';

import { cn } from './cn';
import { DESIGN } from './config';

export interface ProgressBarProps {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  /** Accessible description, e.g. "Unit 3 progress". */
  label: string;
  tone?: 'primary' | 'success' | 'gold' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  /** Animated sweep across the fill — for XP and rewards, not for file uploads. */
  shine?: boolean;
  className?: string;
}

const BAR_TONES = {
  primary: 'bg-primary',
  success: 'bg-success',
  gold: 'bg-gold',
  gradient: 'bg-[linear-gradient(90deg,var(--s-grad-a),var(--s-grad-b))]',
} as const;

/** Determinate or indeterminate progress bar. */
export function ProgressBar({
  value,
  label,
  tone = 'primary',
  size = 'md',
  shine = false,
  className,
}: ProgressBarProps) {
  const indeterminate = value == null;
  const pct = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-container-highest',
        size === 'sm' && 'h-1.5',
        size === 'md' && 'h-2.5',
        size === 'lg' && 'h-3.5',
        className,
      )}
    >
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-full',
          BAR_TONES[tone],
          shine && 's-shine',
          indeterminate ? 's-indeterminate w-full' : 'transition-[width] duration-m3-slow ease-m3-std',
        )}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

export interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

/** Circular loading indicator. */
export function Spinner({ size = 28, label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('s-spin inline-block rounded-full border-[3px] border-surface-container-highest border-t-primary', className)}
      style={{ width: size, height: size }}
    />
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

/** Content-shaped loading placeholder. */
export function Skeleton({ width, height = 16, circle = false, className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('s-skeleton', circle && 'rounded-full', className)}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}

export interface LoadingStateProps {
  /** How many skeleton rows to draw (skeleton style only). */
  rows?: number;
  label?: string;
  className?: string;
}

/**
 * The app's standard "still loading" state.
 *
 * Renders whichever treatment design.config.ts › Loading_style selects, so
 * every page's loading experience changes from that one word.
 */
export function LoadingState({ rows = 4, label = 'Loading', className }: LoadingStateProps) {
  if (DESIGN.Loading_style === 'spinner') {
    return (
      <div className={cn('grid min-h-56 place-items-center', className)}>
        <Spinner size={34} label={label} />
      </div>
    );
  }

  if (DESIGN.Loading_style === 'wavy') {
    return (
      <div className={cn('grid min-h-56 place-items-center px-8', className)}>
        <div className="w-full max-w-xs">
          <WavyProgress label={label} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-s-gap', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-m3-md bg-surface p-s-card">
          <Skeleton width={44} height={44} className="rounded-m3-sm" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton width="62%" height={13} />
            <Skeleton width="38%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The M3 Expressive wavy progress indicator. */
export function WavyProgress({ label, className }: { label: string; className?: string }) {
  return (
    <div role="progressbar" aria-label={label} className={cn('relative h-5 w-full overflow-hidden', className)}>
      <svg className="absolute inset-0 h-5 w-full" viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden>
        <path
          d="M0 10 Q6 2 12 10 T24 10 T36 10 T48 10 T60 10 T72 10 T84 10 T96 10 T108 10 T120 10 T132 10 T144 10 T156 10 T168 10 T180 10 T192 10 T204 10 T216 10 T228 10 T240 10"
          fill="none"
          stroke="var(--m3-primary)"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-24 0"
            dur="1.1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );
}
