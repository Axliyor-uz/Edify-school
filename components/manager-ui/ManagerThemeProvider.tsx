'use client';

import {
  createContext, useContext, useEffect, useLayoutEffect, useState, useCallback,
} from 'react';
import { usePathname } from 'next/navigation';
import { MANAGER_DESIGN, managerThemeAttributes } from './config';

/**
 * Stamps the design.manager.config.ts choices onto <html> as data-mg-*
 * attributes, which every token rule in components/manager-ui/theme.css keys off.
 *
 * Why <html> and not a wrapper div (the student kit wraps): the manager tokens
 * have always lived at :root, and things that portal to <body> — react-hot-
 * toast, dialogs — must resolve the ACTIVE palette, not the fallback. The
 * attributes are removed on unmount, so the moment you navigate to another
 * role tree everything reverts to the :root defaults. The student tree is
 * additionally immune because it re-declares every --m3-* var inside its own
 * scoped wrapper.
 *
 * Mode resolution, in priority order:
 *   1. /manager/print* routes are pinned to light — html-to-image snapshots
 *      the screen, and printed A4 sheets must always use light ink.
 *   2. The manager's own per-device choice (localStorage), set via the in-app
 *      toggle. Cleared by choosing "system" again.
 *   3. Color_mode in design.manager.config.ts ('system' follows the OS live).
 */

const STORAGE_KEY = 'edify-mg-mode';

type ModePreference = 'system' | 'light' | 'dark';

interface ManagerThemeContextValue {
  /** The resolved mode actually on screen. */
  mode: 'light' | 'dark';
  /** The manager's stored preference ('system' = no override). */
  preference: ModePreference;
  /** Set + persist a per-device preference. 'system' clears the override. */
  setPreference: (p: ModePreference) => void;
  /** Convenience flip between light and dark (persists). */
  toggleMode: () => void;
  /** Whether the config wants the toggle UI rendered at all. */
  toggleEnabled: boolean;
}

const ManagerThemeContext = createContext<ManagerThemeContextValue | undefined>(undefined);

export function useManagerTheme() {
  const ctx = useContext(ManagerThemeContext);
  if (!ctx) throw new Error('useManagerTheme must be used within ManagerThemeProvider');
  return ctx;
}

function readStoredPreference(): ModePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ManagerThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Server and first client render must agree, so start deterministic and
  // consult localStorage / the device only after mount.
  const [preference, setPreferenceState] = useState<ModePreference>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredPreference());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setSystemDark(mq.matches);
    apply();
    setHydrated(true);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const setPreference = useCallback((p: ModePreference) => {
    setPreferenceState(p);
    try {
      if (p === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, p);
    } catch { /* private mode */ }
  }, []);

  // Resolve: print pin → per-device override → config (system follows OS).
  const isPrintRoute = pathname?.startsWith('/manager/print') ?? false;
  const configured = MANAGER_DESIGN.Color_mode;
  let mode: 'light' | 'dark';
  if (isPrintRoute) mode = 'light';
  else if (preference !== 'system') mode = preference;
  else if (configured === 'system') mode = hydrated && systemDark ? 'dark' : 'light';
  else mode = configured;

  const toggleMode = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setPreference]);

  // Stamp attributes on <html>. Layout effect so the very first painted frame
  // after hydration already has the right palette/mode.
  useLayoutEffect(() => {
    const el = document.documentElement;
    const attrs = { ...managerThemeAttributes(), 'data-mg-mode': mode };
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const prevScheme = el.style.colorScheme;
    el.style.colorScheme = mode; // native controls, scrollbars, browser UI
    return () => {
      for (const k of Object.keys(attrs)) el.removeAttribute(k);
      el.style.colorScheme = prevScheme;
    };
  }, [mode]);

  return (
    <ManagerThemeContext.Provider
      value={{
        mode,
        preference,
        setPreference,
        toggleMode,
        toggleEnabled: MANAGER_DESIGN.Mode_toggle === 'shown',
      }}
    >
      {children}
    </ManagerThemeContext.Provider>
  );
}
