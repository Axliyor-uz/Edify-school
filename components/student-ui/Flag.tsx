'use client';

// ─── Crisp SVG language flags ────────────────────────────────────────────────
// Emoji flags render inconsistently (many platforms fall back to "UZ"/"GB"
// letter glyphs or mismatched art styles) — these are real vector flags with a
// shared rounded-rect mask and a subtle inner keyline so they read as one set
// on any OS, at any size, in light and dark themes.

import { useId } from 'react';
import { cn } from './cn';

export type FlagCode = 'uz' | 'en' | 'ru';

interface FlagProps {
  code: FlagCode;
  /** Rendered height in px (width keeps the 7:5 ratio). */
  size?: number;
  className?: string;
}

const W = 28;
const H = 20;
const R = 4; // corner radius of the mask

function UzArt() {
  return (
    <>
      <rect width={W} height={H} fill="#1EB53A" />
      <rect width={W} height={H * 0.55} fill="#FFFFFF" />
      <rect width={W} height={H * 0.36} fill="#0099B5" />
      {/* red fimbriations */}
      <rect y={H * 0.36} width={W} height={0.8} fill="#CE1126" />
      <rect y={H * 0.55} width={W} height={0.8} fill="#CE1126" />
      {/* crescent */}
      <circle cx={5.2} cy={3.9} r={2.5} fill="#FFFFFF" />
      <circle cx={6.3} cy={3.9} r={2.1} fill="#0099B5" />
      {/* stars (hinted row) */}
      <circle cx={10.6} cy={2.4} r={0.55} fill="#FFFFFF" />
      <circle cx={13.2} cy={2.4} r={0.55} fill="#FFFFFF" />
      <circle cx={15.8} cy={2.4} r={0.55} fill="#FFFFFF" />
      <circle cx={11.9} cy={4.6} r={0.55} fill="#FFFFFF" />
      <circle cx={14.5} cy={4.6} r={0.55} fill="#FFFFFF" />
    </>
  );
}

function GbArt() {
  return (
    <>
      <rect width={W} height={H} fill="#012169" />
      {/* St Andrew (white diagonals) */}
      <path d={`M0 0 L${W} ${H} M${W} 0 L0 ${H}`} stroke="#FFFFFF" strokeWidth={4} />
      {/* St Patrick (red diagonals) */}
      <path d={`M0 0 L${W} ${H} M${W} 0 L0 ${H}`} stroke="#C8102E" strokeWidth={1.6} />
      {/* St George cross */}
      <path d={`M${W / 2} 0 V${H} M0 ${H / 2} H${W}`} stroke="#FFFFFF" strokeWidth={6.4} />
      <path d={`M${W / 2} 0 V${H} M0 ${H / 2} H${W}`} stroke="#C8102E" strokeWidth={3.8} />
    </>
  );
}

function RuArt() {
  return (
    <>
      <rect width={W} height={H} fill="#FFFFFF" />
      <rect y={H / 3} width={W} height={H / 3} fill="#0039A6" />
      <rect y={(H / 3) * 2} width={W} height={H / 3} fill="#D52B1E" />
    </>
  );
}

const ART: Record<FlagCode, () => React.JSX.Element> = { uz: UzArt, en: GbArt, ru: RuArt };

export function Flag({ code, size = 16, className }: FlagProps) {
  const clipId = useId();
  const Art = ART[code] || GbArt;
  return (
    <svg
      width={(size / H) * W}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <Art />
        {/* keyline so white flag areas keep an edge on light surfaces */}
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={R - 0.5} fill="none" stroke="rgba(0,0,0,0.18)" />
      </g>
    </svg>
  );
}
