import type { HTMLAttributes, ReactNode } from "react";
import { MANAGER_DESIGN } from "./config";
import { cn } from "./cn";

/** Switchboard values (design.manager.config.ts › Card_style) plus the legacy
 *  "tonal" value kept so existing call sites keep compiling. */
export type CardVariant = "elevated" | "filled" | "outlined" | "glass" | "flat" | "tonal";

const VARIANT: Record<CardVariant, string> = {
  elevated: "bg-surface-container-lowest shadow-elev-1",
  filled: "bg-surface-container-low",
  outlined: "bg-surface-container-lowest border border-outline-variant",
  glass: "bg-t-glass backdrop-blur-xl border border-t-glass-border",
  flat: "bg-surface-container-low border-0 shadow-none",
  // Legacy (pre-switchboard) value — not part of Card_style.
  tonal: "bg-surface-container-high",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** App-wide default comes from MANAGER_DESIGN.Card_style. Override sparingly. */
  variant?: CardVariant;
  /** Lifts on hover — use for clickable/linked cards. */
  hoverable?: boolean;
}

export function Card({ variant = MANAGER_DESIGN.Card_style, hoverable = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-m3-lg p-t-card",
        VARIANT[variant],
        hoverable && "transition-shadow duration-t-fast hover:shadow-elev-2",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Small muted text next to / under the title. */
  subtitle?: ReactNode;
  /** Right-aligned slot — usually a text Button or IconButton. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-baseline gap-2.5", className)}>
      <h3 className="text-[15px] font-bold text-on-surface">{title}</h3>
      {subtitle && <span className="text-xs text-on-surface-variant">{subtitle}</span>}
      {action && <div className="ml-auto flex flex-none items-center gap-1.5">{action}</div>}
    </div>
  );
}
