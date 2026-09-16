"use client";

// Trailing-6-months revenue vs. expense trend (docs/FINANCE.md §12). First
// manager-side chart in the repo — via ChartFrame per CLAUDE.md (never a raw
// <ResponsiveContainer>). Colors are CSS vars (`var(--m3-*)`), theme-reactive,
// matching the newer student-page chart examples rather than the older raw-hex ones.

import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import ChartFrame from "@/components/ChartFrame";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

export interface TrendPoint {
  label: string;
  revenue: number;
  expenses: number;
}

const T: Record<LangType, { revenue: string; expenses: string }> = {
  uz: { revenue: "Tushum", expenses: "Xarajat" },
  en: { revenue: "Revenue", expenses: "Expenses" },
  ru: { revenue: "Доход", expenses: "Расход" },
};

export default function RevenueExpenseTrendChart({ data }: { data: TrendPoint[] }) {
  const { lang } = useManagerLanguage();
  const t = T[lang];

  return (
    <ChartFrame className="w-full h-[220px]">
      {({ width, height }) => (
        <AreaChart width={width} height={height} data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--m3-success)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--m3-success)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--m3-error)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--m3-error)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--m3-outline-variant)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--m3-on-surface-variant)" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--m3-on-surface-variant)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : `${Math.round(v / 1000)}k`)}
            width={40}
          />
          <Tooltip
            formatter={(value, name) => [formatUZS(Number(value)), name === "revenue" ? t.revenue : t.expenses]}
            contentStyle={{
              background: "var(--m3-surface-container)",
              border: "1px solid var(--m3-outline-variant)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="revenue" name="revenue" stroke="var(--m3-success)" strokeWidth={2} fill="url(#revGrad)" />
          <Area type="monotone" dataKey="expenses" name="expenses" stroke="var(--m3-error)" strokeWidth={2} fill="url(#expGrad)" />
        </AreaChart>
      )}
    </ChartFrame>
  );
}
