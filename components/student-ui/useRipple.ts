'use client';

import { useCallback } from 'react';
import { MOTION_ON } from './config';

/**
 * Material ink ripple that spawns from the actual touch point.
 *
 * Returns an onPointerDown handler; the host element needs the
 * `s-ripple-host` class so the ripple is clipped to its shape.
 */
export function useRipple() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!MOTION_ON) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = e.currentTarget;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    const span = document.createElement('span');
    span.className = 's-ripple';
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;

    host.appendChild(span);
    span.addEventListener('animationend', () => span.remove(), { once: true });
  }, []);
}
