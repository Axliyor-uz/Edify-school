"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "./config";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** Lucide icon, shown in a tinted circle. */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call-to-action, usually a filled <Button>. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div {...fadeUp} className={cn("flex flex-col items-center gap-3 px-5 py-9 text-center", className)}>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-container text-on-primary-container [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </span>
      <b className="text-base font-bold text-on-surface">{title}</b>
      {description && <p className="max-w-[36ch] text-[13px] text-on-surface-variant">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </motion.div>
  );
}
