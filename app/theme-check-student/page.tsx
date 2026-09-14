'use client';

/**
 * DEV-ONLY student shell gallery — /theme-check-student
 *
 * Unguarded, data-free preview of the student shell recipes so the switchboard
 * can be eyeballed (and headless-screenshotted) without logging in. Renders
 * static MiniSidebar/MiniBar previews that consume the REAL SIDE_STYLES from
 * components/student-ui/shellStyles.ts — what you see here is exactly what
 * Shell.tsx renders.
 *
 * The student kit scopes its tokens via a wrapper (StudentThemeProvider), not
 * <html> attributes. The provider has no override props, but the token CSS
 * supports nested re-scoping ([data-palette] + [data-mode] on any element), so
 * URL params are applied on an inner wrapper:
 *
 *   /theme-check-student?palette=sunset&mode=dark
 *
 * Anything not overridden falls back to design.config.ts. This page lives
 * OUTSIDE app/(student), so the layout's theme.css import does not reach it —
 * importing theme.css here is required, mirroring /theme-check-manager.
 * Safe to delete at any time — nothing imports it.
 */

import { useEffect, useState } from 'react';
import '@/components/student-ui/theme.css';
import { StudentThemeProvider, cn } from '@/components/student-ui';
import { SIDE_STYLES, type SideStyle } from '@/components/student-ui/shellStyles';
import { ALL_PALETTES, DESIGN } from '@/design.config';
import {
  LayoutDashboard, BookOpen, Gamepad2, Trophy, GraduationCap, Menu,
} from 'lucide-react';

const MODES = ['light', 'dark'] as const;

const NAV_PREVIEW = [
  { icon: LayoutDashboard, label: 'Boshqaruv', active: false },
  { icon: BookOpen, label: 'Sinflarim', active: true },
  { icon: Gamepad2, label: "O'yinlar", active: false },
];

/** Static miniature of one sidebar recipe — same class bundles the real shell
 *  uses (components/student-ui/shellStyles.ts), no framer/no auth needed. */
function MiniSidebar({ name, s }: { name: string; s: SideStyle }) {
  const brand = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-m3-sm bg-[linear-gradient(135deg,var(--s-grad-a),var(--s-grad-b))] text-white shadow-elev-1">
        <GraduationCap size={14} strokeWidth={2.4} />
      </span>
      <b className="s-display truncate text-[12px] font-bold">
        Edify<span className="text-primary">Student</span>
      </b>
    </span>
  );
  return (
    <div className="overflow-hidden rounded-m3-lg border border-outline-variant bg-surface">
      <div className={cn('flex h-[210px] flex-col bg-background')}>
        <div className={cn('flex h-full flex-col p-3', s.panel, 'border-r-0')}>
          <div className={cn('mb-3 flex items-center', s.headerBorder, s.headerBorder && 'pb-2.5')}>
            {s.brandWrap ? <span className={cn('min-w-0', s.brandWrap)}>{brand}</span> : brand}
          </div>
          {NAV_PREVIEW.map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={cn(
                'relative mb-1 flex h-9 items-center gap-2 px-3 text-[11.5px] font-extrabold',
                s.itemShape,
                (s.indicator === 'bar' || s.indicator === 'dot') && 'pl-4',
                active ? cn(s.active, s.activeRowBg) : s.idle,
              )}
            >
              {active && s.indicator === 'pill' && (
                <span className={cn('absolute inset-0', s.itemShape, s.indicatorCls)} />
              )}
              {active && s.indicator === 'bar' && (
                <span className={cn('absolute left-0 top-[10px] h-4 w-1 rounded-r-full', s.indicatorCls)} />
              )}
              {active && s.indicator === 'dot' && (
                <span className={cn('absolute left-1 top-[15px] h-1.5 w-1.5 rounded-full', s.indicatorCls)} />
              )}
              <Icon size={14} className={cn('relative z-10 shrink-0', active && s.iconActive)} />
              <span className="relative z-10 truncate">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="border-t border-outline-variant px-3 py-2 text-[11px] font-black text-on-surface">{name}</p>
    </div>
  );
}

const BAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Boshqaruv', active: false },
  { icon: BookOpen, label: 'Sinflarim', active: true },
  { icon: Gamepad2, label: "O'yinlar", active: false },
  { icon: Trophy, label: 'Reyting', active: false },
];

/** Static miniature of one mobile navigation variant. */
function MiniBar({ name, variant }: { name: string; variant: 'dock' | 'floating' | 'iconic' | 'topline' | 'drawer' }) {
  let bar: React.ReactNode;
  if (variant === 'drawer') {
    // Drawer has no bottom bar — preview the hamburger top bar instead.
    bar = (
      <div className="flex items-center gap-2 rounded-m3-sm border border-outline-variant bg-surface-blur px-2 py-2 backdrop-blur-xl">
        <Menu size={16} className="text-on-surface-variant" />
        <span className="text-[9px] font-black text-on-surface-variant">slides in from the left</span>
      </div>
    );
  } else {
    bar = (
      <div
        className={cn(
          'flex bg-surface-blur backdrop-blur-xl',
          variant === 'floating'
            ? 'rounded-full border border-outline-variant px-2 py-1 shadow-elev-2'
            : 'border-t border-outline-variant px-1',
          variant === 'dock' && 'pb-1 pt-1',
          variant === 'iconic' && 'py-0.5',
          variant === 'topline' && 'pb-1',
        )}
      >
        {BAR_ITEMS.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-[2px]',
              variant === 'iconic' ? 'h-10 justify-center' : variant === 'topline' ? 'pb-0.5 pt-1.5' : 'py-0.5',
              active
                ? variant === 'topline' ? 'text-primary' : 'text-on-primary-container'
                : 'text-on-surface-variant',
            )}
          >
            {active && (variant === 'dock' || variant === 'floating') && (
              <span className="absolute -top-0.5 inset-x-0 mx-auto h-[24px] w-[44px] rounded-full bg-primary-container" />
            )}
            {active && variant === 'iconic' && (
              <span className="absolute inset-x-0 inset-y-1 mx-auto w-[44px] rounded-full bg-primary-container" />
            )}
            {active && variant === 'topline' && (
              <span className="absolute inset-x-0 top-0 mx-auto h-[3px] w-8 rounded-b-full bg-primary" />
            )}
            <Icon size={17} className="relative z-10" />
            {variant !== 'iconic' && (
              <span className={cn('relative z-10 text-[8px] font-black', active && variant !== 'topline' && 'text-primary')}>
                {label}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-m3-lg border border-outline-variant bg-surface">
      <div className="bg-background p-3">{bar}</div>
      <p className="border-t border-outline-variant px-3 py-2 text-[11px] font-black text-on-surface">{name}</p>
    </div>
  );
}

export default function ThemeCheckStudent() {
  const [params, setParams] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const overrides: Record<string, string> = {};
    for (const [k, v] of q.entries()) overrides[k] = v;
    setParams(overrides);
    setReady(true);
  }, []);

  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ ...params, ...patch });
    return `/theme-check-student?${q.toString()}`;
  };

  if (!ready) return null;

  const palette = params.palette || DESIGN.Color_palette;
  const mode = params.mode === 'dark' ? 'dark' : 'light';

  return (
    <StudentThemeProvider>
      {/* Inner re-scope: the token CSS keys off [data-palette]/[data-mode] on
          any element, so URL overrides simply nest a fresh scope. */}
      <div data-palette={palette} data-mode={mode} className="min-h-[100dvh] bg-background pb-24 text-on-surface">
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">

          {/* Switcher strip */}
          <div className="space-y-2 rounded-m3-lg border border-outline-variant bg-surface p-4">
            <div className="flex flex-wrap gap-1.5">
              {ALL_PALETTES.map((p) => (
                <a
                  key={p}
                  href={link({ palette: p })}
                  className={cn(
                    'rounded-m3-sm border px-3 py-1.5 text-[12px] font-extrabold',
                    palette === p
                      ? 'border-transparent bg-primary text-on-primary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-state-hover',
                  )}
                >
                  {p}
                </a>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <a
                  key={m}
                  href={link({ mode: m })}
                  className={cn(
                    'rounded-m3-sm border px-3 py-1.5 text-[12px] font-extrabold',
                    mode === m
                      ? 'border-transparent bg-primary-container text-on-primary-container'
                      : 'border-outline-variant text-on-surface-variant hover:bg-state-hover',
                  )}
                >
                  {m}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h1 className="s-display text-[20px] font-bold">Student shell gallery</h1>
            <p className="text-[12.5px] font-bold text-on-surface-variant">
              Static previews of the real shellStyles.ts recipes — change App_shell_navigation /
              Mobile_navigation in design.config.ts to ship one.
            </p>
          </div>

          {/* Desktop side recipes — the 6 recipe-bearing variants */}
          <section className="space-y-3">
            <h2 className="text-[13px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
              Sidebar recipes (App_shell_navigation)
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {(Object.entries(SIDE_STYLES) as [string, SideStyle][]).map(([name, s]) => (
                <MiniSidebar key={name} name={name} s={s} />
              ))}
            </div>
            <p className="text-[11.5px] font-bold text-on-surface-variant">
              floating / rail / topbar are containers, not recipes — floating puts the
              &lsquo;sidebar&rsquo; recipe inside a detached glass card, rail is the icon-only
              strip, topbar has no side panel at all.
            </p>
          </section>

          {/* Mobile navigations */}
          <section className="space-y-3">
            <h2 className="text-[13px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
              Mobile navigations (Mobile_navigation)
            </h2>
            <div className="grid max-w-[680px] grid-cols-1 gap-3 sm:grid-cols-2">
              {(['dock', 'floating', 'iconic', 'topline', 'drawer'] as const).map((v) => (
                <MiniBar key={v} name={v} variant={v} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </StudentThemeProvider>
  );
}
