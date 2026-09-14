'use client';

import { useEffect, useState } from 'react';
import { DESIGN, themeAttributes } from './config';

/**
 * Stamps the design.config.ts choices onto the student shell root as data-*
 * attributes, which every token rule in theme.css keys off.
 *
 * Only `data-mode` needs runtime work: 'system' has to follow the device and
 * keep following it if the student flips their OS theme mid-session.
 *
 * This wraps the shell rather than <html> on purpose — the tokens stay scoped
 * to app/(student)/** and can never leak into the teacher/manager/admin trees.
 */
export function StudentThemeProvider({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Server and first client render must agree, so start from a deterministic
  // value and only consult the device after mount.
  const [mode, setMode] = useState<'light' | 'dark'>(
    DESIGN.Color_mode === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    if (DESIGN.Color_mode !== 'system') {
      setMode(DESIGN.Color_mode);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setMode(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Keeps native form controls, scrollbars and the browser UI in step.
  useEffect(() => {
    const prev = document.documentElement.style.colorScheme;
    document.documentElement.style.colorScheme = mode;
    return () => {
      document.documentElement.style.colorScheme = prev;
    };
  }, [mode]);

  return (
    <div {...themeAttributes()} data-mode={mode} className={className}>
      {children}
    </div>
  );
}
