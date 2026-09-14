/**
 * Bridges design.manager.config.ts to the manager kit.
 *
 * Components import their DEFAULT variant from here, so changing one word in
 * design.manager.config.ts changes every instance across the panel — while any
 * single usage can still override it with an explicit prop.
 *
 * Nothing here reads the DOM, so it is safe in both Server and Client
 * Components.
 */
import { MANAGER_DESIGN, type ManagerDesignConfig } from '@/design.manager.config';

export { MANAGER_DESIGN };
export type { ManagerDesignConfig };

/** The data-mg-* attributes the CSS in theme.css keys off. Stamped on <html>
 *  by <ManagerThemeProvider> while the manager layout is mounted (and removed
 *  on unmount, so nothing leaks into the other role trees). `data-mg-mode` is
 *  resolved at runtime — 'system' depends on the device and managers can
 *  override it per-device — so it is intentionally absent here. */
export function managerThemeAttributes(): Record<string, string> {
  return {
    'data-mg-palette': MANAGER_DESIGN.Color_palette,
    'data-mg-shape': MANAGER_DESIGN.Shape_style,
    'data-mg-density': MANAGER_DESIGN.Density,
    'data-mg-font': MANAGER_DESIGN.Font_style,
    'data-mg-motion': MANAGER_DESIGN.Motion_level,
    'data-mg-bg': MANAGER_DESIGN.Page_background,
    'data-mg-button': MANAGER_DESIGN.Button_style,
  };
}

/** True when animation is enabled at all. Device reduced-motion is handled
 *  separately (CSS media query + framer-motion's useReducedMotion). */
export const MOTION_ON = MANAGER_DESIGN.Motion_level !== 'none';

/** True for the springy tier — components use this to decide between
 *  staggered/overshoot choreography and plain quick fades. */
export const MOTION_EXPRESSIVE = MANAGER_DESIGN.Motion_level === 'expressive';

/** Framer Motion transition matching the configured motion level. */
export const springTransition = MOTION_ON
  ? MOTION_EXPRESSIVE
    ? { type: 'spring' as const, stiffness: 380, damping: 30 }
    : { duration: 0.18, ease: [0.2, 0, 0, 1] as const }
  : { duration: 0 };

/** Shared entrance animation props for page sections / popovers. */
export const fadeUp = MOTION_ON
  ? {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: springTransition,
    }
  : { initial: false as const };

/** Popover/menu entrance (scale from its origin). */
export const popIn = MOTION_ON
  ? {
      initial: { opacity: 0, y: 6, scale: 0.97 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 6, scale: 0.97 },
      transition: MOTION_EXPRESSIVE
        ? { type: 'spring' as const, stiffness: 480, damping: 34 }
        : { duration: 0.14, ease: [0.2, 0, 0, 1] as const },
    }
  : { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } };

/** Route-level page transition variants, per Page_transitions. Applied by the
 *  manager layout around `children`, keyed on the pathname. */
export const pageTransition = (() => {
  if (!MOTION_ON || MANAGER_DESIGN.Page_transitions === 'none') {
    return { initial: false as const };
  }
  if (MANAGER_DESIGN.Page_transitions === 'slide') {
    return {
      initial: { opacity: 0, x: 24 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const },
    };
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as const },
  };
})();

/** Stagger container for lists of tiles/cards (expressive motion only —
 *  otherwise children render instantly). */
export const staggerContainer = MOTION_EXPRESSIVE
  ? {
      initial: 'hidden',
      animate: 'show',
      variants: {
        hidden: {},
        show: { transition: { staggerChildren: 0.045 } },
      },
    }
  : {};

export const staggerItem = MOTION_EXPRESSIVE
  ? {
      variants: {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: springTransition },
      },
    }
  : {};
