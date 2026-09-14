"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { MOTION_ON, springTransition, TEACHER_DESIGN, type TeacherDesignConfig } from "./config";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Optional trailing element (e.g. a <Badge>). */
  badge?: ReactNode;
}

export type TabsVariant = TeacherDesignConfig["Tab_style"];

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled: id of the active tab. */
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Overrides the switchboard's Tab_style for this one instance. */
  variant?: TabsVariant;
}

/** The tab row scrolls horizontally on narrow screens — never wraps or clips. */
const NO_SCROLLBAR = "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const CONTAINER: Record<TabsVariant, string> = {
  underline: "flex gap-1 border-b border-outline-variant",
  segmented: "flex w-fit max-w-full gap-1 rounded-m3-md bg-surface-container p-1",
  pills: "flex gap-2",
};

/** Active-tab indicator: glides between tabs via framer-motion's layoutId
 *  when motion is on; renders a plain instant element when it's off. */
function Indicator({ layoutId, className }: { layoutId: string; className: string }) {
  if (!MOTION_ON) return <span aria-hidden className={className} />;
  return <motion.span aria-hidden layoutId={layoutId} transition={springTransition} className={className} />;
}

export function Tabs({ tabs, value, onChange, className, variant }: TabsProps) {
  const style = variant ?? TEACHER_DESIGN.Tab_style;
  const layoutId = useId();

  return (
    <div role="tablist" className={cn(CONTAINER[style], NO_SCROLLBAR, className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex flex-none items-center whitespace-nowrap text-sm font-semibold transition-colors",
              style === "underline" &&
                cn("gap-2 px-4 pb-2.5 pt-3", active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"),
              style === "segmented" &&
                cn("h-t-control-sm rounded-m3-sm px-4", active ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"),
              style === "pills" &&
                cn(
                  "h-t-control-sm rounded-full px-4",
                  active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-state-hover",
                ),
            )}
          >
            {style === "segmented" && active && (
              <Indicator layoutId={layoutId} className="absolute inset-0 rounded-m3-sm bg-surface-container-lowest shadow-elev-1" />
            )}
            <span className="relative flex items-center gap-2">
              {t.label}
              {t.badge}
            </span>
            {style === "underline" && active && (
              <Indicator layoutId={layoutId} className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
