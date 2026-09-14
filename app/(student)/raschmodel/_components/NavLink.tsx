// app/(student)/raschmodel/_components/NavLink.tsx
'use client';

import Link from 'next/link';
import { cn } from '@/components/student-ui';

/**
 * A link that carries a Button's shape without nesting a `<button>` inside an
 * `<a>` (invalid HTML, and it breaks keyboard activation).
 *
 * Used by the "where to next" row at the bottom of every Rasch results screen —
 * the mock exam and the teacher quiz both end with one, and they must look the
 * same.
 */
export default function NavLink({
  href, tone = 'outlined', label, className, children,
}: {
  href: string;
  tone?: 'outlined' | 'filled' | 'tonal';
  /** The accessible name. Required when the label itself is hidden on phones. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-m3-btn px-5',
        'text-[14.5px] font-extrabold leading-none s-press',
        tone === 'filled' && 'bg-primary text-on-primary',
        tone === 'tonal' && 'bg-secondary-container text-on-secondary-container',
        tone === 'outlined' && 'border-[1.5px] border-outline text-primary hover:bg-state-hover',
        className,
      )}
    >
      {children}
    </Link>
  );
}
