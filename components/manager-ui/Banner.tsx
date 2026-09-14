import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BannerTone = "info" | "success" | "warning" | "error";

const ICON_TONE: Record<BannerTone, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: BannerTone;
  icon?: ReactNode;
  title?: ReactNode;
}

/** Inline informational strip (AI limit notices, plan hints, warnings). */
export function Banner({ tone = "info", icon, title, className, children, ...rest }: BannerProps) {
  return (
    <div className={cn("flex items-start gap-t-gap rounded-m3-md bg-surface-container-high px-4 py-3.5 text-[13px] text-on-surface", className)} {...rest}>
      {icon && <span className={cn("mt-0.5 flex-none [&_svg]:h-[19px] [&_svg]:w-[19px]", ICON_TONE[tone])}>{icon}</span>}
      <div className="min-w-0">
        {title && <b className="mb-0.5 block font-semibold">{title}</b>}
        <span className="text-on-surface-variant">{children}</span>
      </div>
    </div>
  );
}
