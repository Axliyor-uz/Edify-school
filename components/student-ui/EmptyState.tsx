'use client';

import { cn } from './cn';

export interface EmptyStateProps {
  /** Large emoji or icon. */
  icon?: React.ReactNode;
  title: string;
  /** Say what to do next, not just that something is missing. */
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Shown when a list has nothing in it — always offers the next step. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      {icon && (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-container-high text-[28px]">
          {icon}
        </div>
      )}
      <h3 className="s-display text-[17px] font-bold">{title}</h3>
      {description && (
        <p className="max-w-[38ch] text-[13.5px] font-bold text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Failure state. Says what went wrong and offers a way forward. */
export function ErrorState({ title, description, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <div className="grid h-16 w-16 place-items-center rounded-full bg-error-container text-on-error-container">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="7.5" x2="12" y2="13" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <h3 className="s-display text-[17px] font-bold">{title}</h3>
      {description && (
        <p className="max-w-[38ch] text-[13.5px] font-bold text-on-surface-variant">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-m3-btn bg-primary px-5 py-2.5 text-[14px] font-extrabold text-on-primary s-press"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
