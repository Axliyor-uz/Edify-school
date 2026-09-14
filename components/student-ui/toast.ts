'use client';

import toast from 'react-hot-toast';

/**
 * Token-styled toasts for the student app.
 *
 * react-hot-toast renders outside the themed shell (it portals to <body>), so
 * these read the tokens off the shell root instead of inheriting them.
 */
function tokens() {
  if (typeof document === 'undefined') return {};
  const root = document.querySelector('[data-palette]');
  if (!root) return {};
  const cs = getComputedStyle(root);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    background: v('--m3-inverse-surface'),
    color: v('--m3-inverse-on-surface'),
    borderRadius: v('--m3-shape-sm') || '12px',
    fontWeight: '700',
    fontSize: '14px',
    maxWidth: '92vw',
  } as React.CSSProperties;
}

export const sToast = {
  success: (message: string) => toast.success(message, { style: tokens() }),
  error: (message: string) => toast.error(message, { style: tokens() }),
  info: (message: string) => toast(message, { style: tokens() }),
  /** Celebration toast for XP, badges and level-ups. */
  reward: (message: string, emoji = '🎉') => toast(message, { icon: emoji, style: tokens() }),
  loading: (message: string) => toast.loading(message, { style: tokens() }),
  dismiss: (id?: string) => toast.dismiss(id),
};

export { toast as rawToast };
