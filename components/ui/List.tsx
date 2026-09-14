import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { TEACHER_DESIGN } from "./config";

export interface ListItemProps {
  /** Left slot — usually an <Avatar> or an icon in a tinted square. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right slot — StatusChip, Badge, chevron, meta text… */
  trailing?: ReactNode;
  /** Makes the row an interactive button. */
  onClick?: () => void;
  className?: string;
}

export function ListItem({ leading, title, subtitle, trailing, onClick, className }: ListItemProps) {
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-on-surface">{title}</span>
        {subtitle && <span className="block truncate text-xs text-on-surface-variant">{subtitle}</span>}
      </span>
      {trailing && <span className="flex flex-none items-center gap-2">{trailing}</span>}
    </>
  );
  // List_style 'divided' keeps the classic row (pages supply the container +
  // divide-y). 'cards' makes each row its own floating card; `[&+&]` spaces
  // adjacent ListItems so sibling lists look right without a container change.
  const classes = cn(
    "flex min-h-t-row w-full items-center gap-3.5 px-2.5 py-2.5 text-left",
    TEACHER_DESIGN.List_style === "cards"
      ? "rounded-m3-md bg-surface-container-lowest px-3.5 shadow-elev-1 [&+&]:mt-t-gap"
      : "rounded-m3-sm",
    onClick && "m3-interactive",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

export type AvatarTone = "primary" | "secondary" | "tertiary" | "neutral";

const AVATAR_TONE: Record<AvatarTone, string> = {
  primary: "bg-primary-container text-on-primary-container",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  neutral: "bg-surface-container-highest text-on-surface-variant",
};

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: AvatarTone;
  /** Square (rounded-m3-md) instead of a circle — for entities, not people. */
  square?: boolean;
}

/** Initials/icon avatar: <Avatar>AK</Avatar> or <Avatar square><Users /></Avatar> */
export function Avatar({ tone = "primary", square = false, className, children, ...rest }: AvatarProps) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 flex-none select-none place-items-center text-sm font-bold [&_svg]:h-[18px] [&_svg]:w-[18px]",
        square ? "rounded-m3-md" : "rounded-full",
        AVATAR_TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "error" | "primary";
}

/** Small count bubble (unread notifications, pending requests). */
export function Badge({ tone = "error", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-grid h-[19px] min-w-[19px] flex-none place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none",
        tone === "error" ? "bg-error text-on-error" : "bg-primary text-on-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
