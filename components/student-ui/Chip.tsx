'use client';

import { cn } from './cn';

/**
 * Semantic status. Color alone never carries meaning here — every StatusChip
 * shows a label too, so colorblind students and screen readers get the state.
 */
export type Status =
  | 'success' | 'warning' | 'error' | 'info'
  | 'neutral' | 'gold' | 'primary';

const STATUS_STYLES: Record<Status, string> = {
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  gold: 'bg-gold-container text-on-gold-container',
  primary: 'bg-primary-container text-on-primary-container',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: Status;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

/** Small non-interactive label: due dates, counts, states. */
export function Chip({ status = 'neutral', size = 'sm', icon, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-black',
        size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[13px]',
        STATUS_STYLES[status],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
}

/** Toggleable filter — library subjects, leaderboard scopes. */
export function FilterChip({ selected = false, icon, className, children, ...rest }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-m3-sm border-[1.5px] px-4 py-2',
        'text-[13.5px] font-extrabold s-press',
        'transition-colors duration-m3-fast ease-m3-std',
        selected
          ? 'border-transparent bg-secondary-container text-on-secondary-container'
          : 'border-outline-variant text-on-surface-variant hover:bg-state-hover',
        className,
      )}
      {...rest}
    >
      {selected && (
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2">
          <polyline points="4 12.5 9.5 18 20 6.5" />
        </svg>
      )}
      {icon}
      {children}
    </button>
  );
}
