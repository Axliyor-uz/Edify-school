'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Optional preview of the subject (e.g. student name + avatar) */
  subject?: React.ReactNode;
  /** Error text to show inside the dialog if the action fails */
  error?: string | null;
  variant?: 'danger' | 'default';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  subject,
  error,
  variant = 'danger',
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Focus the safe (cancel) button by default, and close on Esc.
  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
      {/* OVERLAY */}
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* DIALOG */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative bg-surface-container-low rounded-m3-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300 shadow-elev-3"
      >
        <IconButton
          size="sm"
          onClick={() => !loading && onClose()}
          className="absolute top-4 right-4"
          disabled={loading}
          aria-label={cancelLabel}
        >
          <X strokeWidth={2.5} />
        </IconButton>

        <div className="px-6 pt-8 pb-6">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-m3-lg flex items-center justify-center mb-4 ${
              isDanger ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
            }`}
          >
            <AlertTriangle size={24} strokeWidth={2.25} />
          </div>

          <h2
            id="confirm-dialog-title"
            className="text-[18px] font-black text-on-surface tracking-tight leading-tight"
          >
            {title}
          </h2>
          <p className="text-[14px] text-on-surface-variant font-medium mt-1.5 leading-relaxed">{message}</p>

          {/* Subject preview */}
          {subject && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-m3-lg bg-surface-container border border-outline-variant">
              {subject}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-[13px] font-semibold text-on-error-container bg-error-container rounded-m3-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            ref={cancelRef}
            variant="outlined"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'filled'}
            onClick={handleConfirm}
            loading={loading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
