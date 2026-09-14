import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions: at most ONE filled Button (the main action). */
  actions?: ReactNode;
  className?: string;
}

/** Standard page top: every manager page starts with this for consistency. */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-t-gap", className)}>
      <div className="min-w-0">
        <h1 className="font-t-display text-[22px] font-bold tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-none flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
