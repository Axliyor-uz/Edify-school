"use client";

// Trailing-6-months attendance-rate trend (docs/FINANCE.md §12 / docs/ATTENDANCE.md).
// Uses the SAME `rateOfSessions` helper the rest of the attendance surface uses
// (never re-implement the rate formula — docs/ATTENDANCE.md rule #6).

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import ChartFrame from "@/components/ChartFrame";

export interface AttendancePoint {
  label: string;
  rate: number | null;
}

export default function AttendanceTrendChart({ data }: { data: AttendancePoint[] }) {
  return (
    <ChartFrame className="w-full h-[220px]">
      {({ width, height }) => (
        <LineChart width={width} height={height} data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--m3-outline-variant)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--m3-on-surface-variant)" }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--m3-on-surface-variant)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={36}
          />
          <Tooltip
            formatter={(value) => [value === null || value === undefined ? "—" : `${value}%`, ""]}
            contentStyle={{
              background: "var(--m3-surface-container)",
              border: "1px solid var(--m3-outline-variant)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="rate" stroke="var(--m3-tertiary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      )}
    </ChartFrame>
  );
}
