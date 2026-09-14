import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filter chips: filled + check-style emphasis when selected. */
  selected?: boolean;
  /** Leading icon, sized automatically. */
  icon?: ReactNode;
  /** Renders a trailing ✕ (input chips, removable filters). */
  onRemove?: () => void;
  size?: "sm" | "md";
}

export function Chip({
  selected = false,
  icon,
  onRemove,
  size = "md",
  className,
  children,
  type,
  ...rest
}: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "m3-interactive inline-flex flex-none select-none items-center rounded-m3-xs font-medium",
        size === "md" ? "h-t-control-sm gap-1.5 px-3.5 text-[13px] [&_svg]:h-4 [&_svg]:w-4" : "h-[26px] gap-1 px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        selected
          ? "bg-secondary-container font-semibold text-on-secondary-container"
          : "text-on-surface-variant ring-1 ring-inset ring-outline-variant",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {onRemove && (
        <span
          role="button"
          aria-label="Olib tashlash"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onRemove();
            }
          }}
          className="-mr-1 grid h-4 w-4 place-items-center rounded-full hover:bg-state-hover"
        >
          <X className="!h-3 !w-3" />
        </span>
      )}
    </button>
  );
}

export type StatusTone = "success" | "warning" | "error" | "info" | "muted";

const TONE: Record<StatusTone, string> = {
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-on-warning-container",
  error: "bg-error-container text-on-error-container",
  info: "bg-primary-container text-on-primary-container",
  muted: "bg-surface-container-highest text-on-surface-variant",
};

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Hide the leading state dot (it's on by default). */
  noDot?: boolean;
}

/** Read-only state label (Baholandi / Kutilmoqda / Faol …). Status colors are
 *  reserved for state — never use them decoratively. */
export function StatusChip({ tone, noDot = false, className, children, ...rest }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] flex-none select-none items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {!noDot && <i aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-current" />}
      {children}
    </span>
  );
}
