'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A sized box for a recharts chart.
 *
 * recharts' own `<ResponsiveContainer width="100%" height="100%">` starts at
 * width/height = -1 and only learns its real size once its ResizeObserver
 * fires. On that first pass it renders nothing and logs
 *   "The width(-1) and height(-1) of chart should be greater than 0 …"
 * on every mount — the warning is unavoidable from the outside, because -1 is
 * its default `initialDimension`.
 *
 * So we measure the box ourselves and hand the chart real numbers. The chart is
 * only mounted once the box has a positive width AND height, which means charts
 * inside a hidden/collapsed parent stay unmounted instead of warning.
 *
 * Give the frame its size through `className` (e.g. "w-full h-[200px]") — the
 * chart inside must take `width`/`height` from the render prop, never "100%".
 */
export default function ChartFrame({
  className,
  children,
}: {
  className?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
