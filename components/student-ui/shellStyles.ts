/**
 * Sidebar style recipes for the student shell — each side variant of
 * design.config.ts › App_shell_navigation is pure data: panel background,
 * item colors, and which animated indicator it uses. Consumed by
 * components/student-ui/Shell.tsx (the real shell) and by
 * /theme-check-student (static previews), so what the gallery shows is
 * exactly what the shell renders.
 *
 * `rail` and `topbar` keep their own bespoke markup; `floating` reuses the
 * 'sidebar' recipe inside a detached card — the container difference lives in
 * Shell.tsx, not here.
 *
 * ⚠️ Student-kit rules apply: token utilities only, and NEVER a Tailwind
 * opacity modifier on a token color (a `/20`-style suffix renders opaque).
 * Where a recipe needs a translucent tint on a colored panel it uses an
 * arbitrary `color-mix()` value instead.
 */

export type SideVariant = 'sidebar' | 'classic' | 'tonal' | 'inverse' | 'gradient' | 'minimal';
export type IndicatorKind = 'pill' | 'bar' | 'dot';

export interface SideStyle {
  /** Fixed desktop panel: background + optional right border. */
  panel: string;
  /** Border under the brand strip ('' on colored/chromeless panels). */
  headerBorder: string;
  /**
   * Wrapper around the layout-provided brand node. Colored panels chip it on
   * a surface so the wordmark stays legible in every palette/mode ('' = none).
   */
  brandWrap: string;
  /** Nav row corner shape. */
  itemShape: string;
  /** Idle nav row (text + hover treatment). */
  idle: string;
  /** Active nav row text (the indicator supplies any background). */
  active: string;
  /** Static background painted on the active row itself (classic look). */
  activeRowBg: string;
  /** Extra class for the active icon ('' = inherit the row color). */
  iconActive: string;
  /** Which framer-motion layoutId indicator glides between rows. */
  indicator: IndicatorKind;
  /** Color/effect classes for that indicator. */
  indicatorCls: string;
}

export const SIDE_STYLES: Record<SideVariant, SideStyle> = {
  /* The original labelled drawer, now recipe-driven: neutral surface, gliding
   * tonal pill. */
  sidebar: {
    panel: 'bg-surface border-r border-outline-variant',
    headerBorder: 'border-b border-outline-variant',
    brandWrap: '',
    itemShape: 'rounded-m3-btn',
    idle: 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface',
    active: 'text-on-primary-container',
    activeRowBg: '',
    iconActive: '',
    indicator: 'pill',
    indicatorCls: 'bg-primary-container',
  },
  /* Desktop-software look: sliding left accent bar + tinted active row. */
  classic: {
    panel: 'bg-surface-container-low border-r border-outline-variant',
    headerBorder: 'border-b border-outline-variant',
    brandWrap: '',
    itemShape: 'rounded-m3-sm',
    idle: 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface',
    active: 'text-primary',
    // Token colors reject /opacity modifiers, so the tint is a color-mix() var.
    activeRowBg: 'bg-[color-mix(in_srgb,var(--m3-primary)_10%,transparent)]',
    iconActive: 'text-primary',
    indicator: 'bar',
    indicatorCls: 'bg-primary',
  },
  /* Panel washed in the palette's secondary-container tint; the active row is
   * a raised surface pill (white in light mode, deep in dark — both contrast). */
  tonal: {
    panel: 'bg-secondary-container',
    headerBorder: '',
    brandWrap: 'rounded-m3-md bg-surface px-2.5 py-1.5 shadow-elev-1',
    itemShape: 'rounded-full',
    idle: 'text-on-secondary-container opacity-70 hover:opacity-100',
    active: 'text-primary',
    activeRowBg: '',
    iconActive: '',
    indicator: 'pill',
    indicatorCls: 'bg-surface shadow-elev-1',
  },
  /* High-contrast inverse-surface panel (dark in light mode, light in dark). */
  inverse: {
    panel: 'bg-inverse-surface',
    headerBorder: '',
    brandWrap: 'rounded-m3-md bg-surface px-2.5 py-1.5 shadow-elev-1',
    itemShape: 'rounded-full',
    idle: 'text-inverse-on-surface opacity-65 hover:opacity-100',
    active: 'text-primary',
    activeRowBg: '',
    iconActive: '',
    indicator: 'pill',
    indicatorCls: 'bg-surface shadow-elev-2',
  },
  /* Brand-gradient panel. --s-grad-a/b are saturated in light mode and pastel
   * in dark, so on-primary (white → deep ink) is the correct text both times. */
  gradient: {
    panel: 'bg-[linear-gradient(165deg,var(--s-grad-a),var(--s-grad-b))]',
    headerBorder: '',
    brandWrap: 'rounded-m3-md bg-surface px-2.5 py-1.5 shadow-elev-1',
    itemShape: 'rounded-full',
    idle: 'text-on-primary opacity-75 hover:opacity-100',
    active: 'text-primary',
    activeRowBg: '',
    iconActive: '',
    indicator: 'pill',
    indicatorCls: 'bg-surface shadow-elev-2',
  },
  /* Chromeless: transparent panel over the page background, sliding dot. */
  minimal: {
    panel: 'bg-transparent',
    headerBorder: '',
    brandWrap: '',
    itemShape: 'rounded-full',
    idle: 'text-on-surface-variant hover:text-on-surface',
    active: 'text-primary',
    activeRowBg: '',
    iconActive: '',
    indicator: 'dot',
    indicatorCls: 'bg-primary',
  },
};

/** Maps any App_shell_navigation value to its side recipe (rail/topbar/
 *  floating resolve to 'sidebar' — their difference is the container). */
export function resolveSideStyle(shell: string): SideStyle {
  return SIDE_STYLES[shell as SideVariant] || SIDE_STYLES.sidebar;
}
