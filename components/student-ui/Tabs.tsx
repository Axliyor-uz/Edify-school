'use client';

import { motion } from 'framer-motion';
import { cn } from './cn';
import { MOTION_ON, springTransition } from './config';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Count shown as a small badge, e.g. unread notifications. */
  badge?: number;
}

export interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

/** Scrollable tab bar with a sliding active indicator. */
export function Tabs<T extends string>({ tabs, value, onChange, label, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('s-no-scrollbar flex gap-1 overflow-x-auto border-b border-outline-variant', className)}
    >
      {tabs.map((tab) => {
        const on = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-4 py-3 text-[14px] font-extrabold',
              'transition-colors duration-m3-fast ease-m3-std',
              on ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="s-num grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 text-[10.5px] font-black text-on-error">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
            {on && (
              <motion.span
                layoutId="s-tab-indicator"
                transition={MOTION_ON ? springTransition : { duration: 0 }}
                className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
