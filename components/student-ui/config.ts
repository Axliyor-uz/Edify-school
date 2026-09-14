/**
 * Bridges design.config.ts to the kit.
 *
 * Components import their DEFAULT variant from here, so changing one word in
 * design.config.ts changes every instance across the app — while any single
 * usage can still override it with an explicit prop.
 *
 * Nothing here reads the DOM, so it is safe in both Server and Client
 * Components.
 */
import { DESIGN, type DesignConfig } from '@/design.config';

export { DESIGN };
export type { DesignConfig };

/** The data-* attributes the CSS in theme.css keys off. Spread onto the shell
 *  root by <StudentThemeProvider>. `data-mode` is resolved at runtime because
 *  'system' depends on the device, so it is intentionally absent here. */
export function themeAttributes() {
  return {
    'data-palette': DESIGN.Color_palette,
    'data-shape': DESIGN.Shape_style,
    'data-density': DESIGN.Density,
    'data-layout': DESIGN.Layout_density,
    'data-motion': DESIGN.Motion_level,
  } as const;
}

/** True when animation is enabled at all (device reduced-motion is handled
 *  separately in CSS and in useReducedMotion). */
export const MOTION_ON = DESIGN.Motion_level !== 'none';

/** Framer Motion transition matching the configured motion level. */
export const springTransition = MOTION_ON
  ? DESIGN.Motion_level === 'playful'
    ? { type: 'spring' as const, stiffness: 380, damping: 30 }
    : { duration: 0.2, ease: [0.2, 0, 0, 1] as const }
  : { duration: 0 };

/** Shared entrance animation props for page sections. */
export const fadeUp = MOTION_ON
  ? {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: springTransition,
    }
  : { initial: false as const };
