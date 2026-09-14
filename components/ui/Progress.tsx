import type { HTMLAttributes } from "react";
import { cn } from "./cn";
import { TEACHER_DESIGN } from "./config";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100 (clamped). */
  value: number;
  /** warning ≈ near a limit, error ≈ limit exceeded. */
  tone?: "primary" | "warning" | "error";
}

const FILL = { primary: "bg-primary", warning: "bg-warning", error: "bg-error" } as const;

export function ProgressBar({ value, tone = "primary", className, ...rest }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary-container", className)}
      {...rest}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-t-med ease-t-std", FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ size = 28, className }: { size?: number; className?: string }) {
  return <div role="status" aria-label="Yuklanmoqda" className={cn("m3-spinner", className)} style={{ width: size, height: size }} />;
}

/** Loading placeholder block — size it with className (h-4 w-40 …). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("m3-skeleton", className)} />;
}

export interface LoaderProps {
  /** Number of body lines when Loading_style='skeleton' (default 3). */
  lines?: number;
  className?: string;
}

/** Page/section-level loading block. Renders whatever
 *  TEACHER_DESIGN.Loading_style says: content-shaped skeleton stack,
 *  a centered spinner, or three pulsing dots. */
export function Loader({ lines = 3, className }: LoaderProps) {
  if (TEACHER_DESIGN.Loading_style === "spinner") {
    return (
      <div className={cn("grid place-items-center py-10", className)}>
        <Spinner />
      </div>
    );
  }
  if (TEACHER_DESIGN.Loading_style === "dots") {
    return (
      <div role="status" aria-label="Yuklanmoqda" className={cn("flex items-center justify-center gap-1.5 py-10", className)}>
        <span className="t-dot" />
        <span className="t-dot" />
        <span className="t-dot" />
      </div>
    );
  }
  const widths = ["w-full", "w-11/12", "w-4/6"];
  return (
    <div aria-hidden className={cn("space-y-t-gap", className)}>
      <div className="m3-skeleton h-5 w-2/5" />
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <div key={i} className={cn("m3-skeleton h-4", widths[i % widths.length])} />
      ))}
    </div>
  );
}
