import type { ReactNode } from "react";
import { MANAGER_DESIGN } from "./config";
import { ProgressBar } from "./Progress";
import { cn } from "./cn";

/** Switchboard values (design.manager.config.ts › StatTile_style). */
export type StatTileVariant = "accent" | "tonal" | "outline" | "glass";

export interface StatTileProps {
  /** Lucide icon shown in a tinted square. */
  icon: ReactNode;
  label: ReactNode;
  /** The number. Use suffix for things like "/100". */
  value: ReactNode;
  suffix?: ReactNode;
  /** Small line under the value — compose with <StatusChip> for deltas. */
  delta?: ReactNode;
  /** 0–100: renders a progress bar instead of the delta line. */
  progress?: number;
  tone?: "primary" | "secondary" | "tertiary" | "success" | "warning";
  /** App-wide default comes from MANAGER_DESIGN.StatTile_style. Override sparingly. */
  variant?: StatTileVariant;
  className?: string;
}

/** Tile shell per variant. `tonal` preserves the original (pre-switchboard)
 *  elevated-card look; `accent` adds a left tone bar over a neutral surface. */
const SHELL: Record<StatTileVariant, string> = {
  accent: "relative bg-surface-container-lowest shadow-elev-1 transition-shadow duration-t-fast hover:shadow-elev-2",
  tonal: "bg-surface-container-low shadow-elev-1 transition-shadow duration-t-fast hover:shadow-elev-2",
  outline: "bg-surface-container-lowest border border-outline-variant",
  glass: "bg-t-glass backdrop-blur border border-t-glass-border",
};

/** Icon in the tone's container color (tonal + glass variants). */
const ICON_TONE = {
  primary: "bg-primary-container text-on-primary-container",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-on-warning-container",
} as const;

/** Icon in a soft tone wash (accent variant). Only primary has a dedicated
 *  soft token; the other tones fall back to their container colors. */
const ICON_SOFT = {
  primary: "bg-t-primary-soft text-primary",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-on-warning-container",
} as const;

/** Bare tone-colored icon, no container (outline variant). */
const ICON_PLAIN = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  success: "text-success",
  warning: "text-warning",
} as const;

/** Left accent bar color (accent variant). */
const BAR_TONE = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  success: "bg-success",
  warning: "bg-warning",
} as const;

/** Dashboard KPI tile: icon + label, big tabular number, delta or progress. */
export function StatTile({
  icon,
  label,
  value,
  suffix,
  delta,
  progress,
  tone = "primary",
  variant = MANAGER_DESIGN.StatTile_style,
  className,
}: StatTileProps) {
  const iconClass =
    variant === "accent" ? ICON_SOFT[tone] : variant === "outline" ? ICON_PLAIN[tone] : ICON_TONE[tone];

  return (
    <div className={cn("flex flex-col gap-2 rounded-m3-lg px-4 py-4", SHELL[variant], className)}>
      {variant === "accent" && (
        <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", BAR_TONE[tone])} />
      )}
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-m3-md [&_svg]:h-4 [&_svg]:w-4", iconClass)}>
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-on-surface-variant">{label}</span>
      </div>
      <div className="font-t-display text-[27px] font-extrabold leading-none tracking-tight text-on-surface [font-variant-numeric:tabular-nums]">
        {value}
        {suffix && <span className="text-sm font-semibold tracking-normal text-on-surface-variant">{suffix}</span>}
      </div>
      {progress !== undefined ? (
        <ProgressBar value={progress} tone={progress >= 100 ? "error" : progress >= 80 ? "warning" : "primary"} />
      ) : (
        delta && <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">{delta}</div>
      )}
    </div>
  );
}
