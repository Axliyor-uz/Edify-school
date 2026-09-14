// lib/RASCHband.ts
//
// Band → colour and band → name, for BOTH UI kits.
//
// ⚠️ This file must stay free of component imports. The level is shown in the
// student tree (navbar chip, "My level" card, hub summary) AND in the teacher
// tree (Rasch paper results), and the two kits must never be mixed — a module
// that imported `@/components/student-ui` would drag the student kit into the
// teacher bundle. So the kit-agnostic part lives here as plain CSS-var strings,
// and each kit's own component adds its chip/tile/bar tokens on top.
//
// Both themes define the same `--m3-*` names, which is what makes one table
// serve both. The exception is `--m3-gold`, which only the student theme has —
// hence the CSS-level fallback on the olympiad band.

import type { LevelBand } from './RASCHscale';
import type { Lang } from '@/types/Math';

export interface BandVars {
  /** The accent: a ring, a bar fill, a number on a plain surface. */
  color: string;
  /** The soft companion surface, for a tinted header or pill. */
  container: string;
  /** Guaranteed-contrast ink on that container. */
  onContainer: string;
}

/**
 * ⚠️ **No band is grey.** The first version painted `beginner` and `simple` with
 * `--m3-outline` / `--m3-on-surface-variant`, which meant the two bands most
 * students actually start in rendered identically to "not measured yet" — a
 * student who had just sat a paper could not tell their level from an empty
 * state. Every band owns a real hue now, and `error` sits only at the literal
 * floor (θ ≈ −2.5, barely above the 25% guess rate), where flagging it is the
 * honest thing to do rather than a judgement.
 *
 * Hue is never the only carrier: every surface prints the band's NAME beside the
 * colour, which is the student-ui kit's own rule for status colour.
 */
export const BAND_VARS: Record<LevelBand, BandVars> = {
  beginner: {
    color: 'var(--m3-error)',
    container: 'var(--m3-error-container)',
    onContainer: 'var(--m3-on-error-container)',
  },
  simple: {
    color: 'var(--m3-tertiary)',
    container: 'var(--m3-tertiary-container)',
    onContainer: 'var(--m3-on-tertiary-container)',
  },
  easy: {
    color: 'var(--m3-secondary)',
    container: 'var(--m3-secondary-container)',
    onContainer: 'var(--m3-on-secondary-container)',
  },
  medium: {
    color: 'var(--m3-primary)',
    container: 'var(--m3-primary-container)',
    onContainer: 'var(--m3-on-primary-container)',
  },
  hard: {
    color: 'var(--m3-success)',
    container: 'var(--m3-success-container)',
    onContainer: 'var(--m3-on-success-container)',
  },
  olympiad: {
    // The teacher theme has no `--m3-gold`; the CSS fallback keeps the top band
    // amber there instead of resolving to nothing.
    color: 'var(--m3-gold, var(--m3-warning))',
    container: 'var(--m3-gold-container, var(--m3-warning-container))',
    onContainer: 'var(--m3-on-gold-container, var(--m3-on-warning-container))',
  },
};

/** One name per band, so no surface can word a band differently. */
export const BAND_LABEL: Record<Lang, Record<LevelBand, string>> = {
  uz: { beginner: "Boshlang'ich", simple: 'Oddiy', easy: 'Oson', medium: "O'rta", hard: 'Qiyin', olympiad: 'Olimpiada' },
  ru: { beginner: 'Начальный', simple: 'Простой', easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный', olympiad: 'Олимпиадный' },
  en: { beginner: 'Beginner', simple: 'Simple', easy: 'Easy', medium: 'Medium', hard: 'Hard', olympiad: 'Olympiad' },
};
