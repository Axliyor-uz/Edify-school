'use client';

import { cn } from './cn';
import type { Status } from './Chip';

export interface BannerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: Status;
  icon?: React.ReactNode;
  /** Inline actions, e.g. "Start now" / "Remind me". */
  actions?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const BANNER_STYLES: Record<Status, string> = {
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-surface-container-high text-on-surface',
  gold: 'bg-gold-container text-on-gold-container',
  primary: 'bg-primary-container text-on-primary-container',
};

/**
 * Persistent in-page notice — deadlines, streak at risk, offline state.
 *
 * Unlike a toast this does not disappear, so use it only when the student
 * genuinely needs to act.
 */
export function Banner({
  title,
  description,
  status = 'info',
  icon,
  actions,
  onDismiss,
  className,
}: BannerProps) {
  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-m3-md p-4', BANNER_STYLES[status], className)}
    >
      {icon && <span className="mt-0.5 shrink-0 text-[18px]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-black leading-tight">{title}</p>
        {description && <p className="mt-1 text-[13px] font-bold opacity-85">{description}</p>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 hover:bg-black/10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
