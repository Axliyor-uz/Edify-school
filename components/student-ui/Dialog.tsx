'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { cn } from './cn';
import { MOTION_ON, springTransition } from './config';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Footer actions, right-aligned. */
  actions?: React.ReactNode;
  /** Icon badge above the title — used by ConfirmDialog. */
  icon?: React.ReactNode;
  /** Slides up from the bottom on phones instead of centring. */
  sheetOnMobile?: boolean;
  className?: string;
}

/**
 * Modal dialog. Locks body scroll, closes on Escape and backdrop click, and
 * traps nothing else — keep the content simple.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  icon,
  sheetOnMobile = false,
  className,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-[200] flex p-4',
            sheetOnMobile ? 'items-end sm:items-center' : 'items-center',
            'justify-center',
          )}
        >
          <motion.div
            initial={MOTION_ON ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-scrim-bg backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={MOTION_ON ? { opacity: 0, scale: 0.95, y: sheetOnMobile ? 40 : 12 } : false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: sheetOnMobile ? 40 : 12 }}
            transition={springTransition}
            className={cn(
              // s-contain stops a nested full-bleed ListGroup escaping the panel.
              's-contain relative w-full max-w-sm bg-surface-container-high p-6 shadow-elev-3',
              sheetOnMobile ? 'rounded-t-m3-xl sm:rounded-m3-xl' : 'rounded-m3-xl',
              className,
            )}
          >
            {icon && <div className="mb-4 flex justify-center">{icon}</div>}
            {title && (
              <h2 className={cn('s-display mb-2 text-[19px] font-bold', icon && 'text-center')}>
                {title}
              </h2>
            )}
            <div className={cn('text-[14px] font-medium text-on-surface-variant', icon && 'text-center')}>
              {children}
            </div>
            {actions && <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">{actions}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Paints the confirm button in the error tone for irreversible actions. */
  destructive?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

/** Yes/no confirmation — sign out, leave a test, delete an account. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  icon,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      icon={
        icon ?? (
          <div
            className={cn(
              'grid h-14 w-14 place-items-center rounded-full',
              destructive
                ? 'bg-error-container text-on-error-container'
                : 'bg-primary-container text-on-primary-container',
            )}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
        )
      }
      actions={
        <>
          <Button variant="text" tone="primary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="filled"
            tone={destructive ? 'error' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description}
    </Dialog>
  );
}
