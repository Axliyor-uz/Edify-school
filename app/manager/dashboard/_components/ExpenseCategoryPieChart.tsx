"use client";

// Current month's expense-category distribution (docs/FINANCE.md §12) — the
// FIRST pie/donut chart in this repo (grep confirmed no PieChart/<Pie usage
// anywhere else). Fed by `groupExpensesByCategory` (lib/finance/financeStats.ts,
// the exact same grouping ExpensesTab.tsx's category chips use). Per-category
// colors mirror ExpensesTab's CATEGORY_META tonal assignment (salary=success,
// ijara=tertiary, kommunal=warning, marketing=secondary, jihozlar=primary,
// boshqa=outline) so a category is the same hue everywhere it appears — those
// are Tailwind `bg-*-container` classes there (not valid SVG fill values), so
// this file keeps its own small CSS-var map instead of importing them.

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import ChartFrame from "@/components/ChartFrame";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

const CATEGORY_COLORS: Record<string, string> = {
  salary: "var(--m3-success)",
  ijara: "var(--m3-tertiary)",
  kommunal: "var(--m3-warning)",
  marketing: "var(--m3-secondary)",
  jihozlar: "var(--m3-primary)",
  boshqa: "var(--m3-outline)",
};
const FALLBACK_COLORS = ["var(--m3-primary)", "var(--m3-secondary)", "var(--m3-tertiary)", "var(--m3-success)", "var(--m3-warning)", "var(--m3-error)"];
const colorFor = (category: string, i: number) => CATEGORY_COLORS[category] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];

const CATEGORY_LABELS: Record<LangType, Record<string, string>> = {
  uz: { salary: "Oylik", ijara: "Ijara", kommunal: "Kommunal", marketing: "Marketing", jihozlar: "Jihozlar", boshqa: "Boshqa" },
  en: { salary: "Salary", ijara: "Rent", kommunal: "Utilities", marketing: "Marketing", jihozlar: "Equipment", boshqa: "Other" },
  ru: { salary: "Зарплата", ijara: "Аренда", kommunal: "Коммунальные", marketing: "Маркетинг", jihozlar: "Оборудование", boshqa: "Прочее" },
};

export default function ExpenseCategoryPieChart({ byCategory }: { byCategory: [string, number][] }) {
  const { lang } = useManagerLanguage();
  const labels = CATEGORY_LABELS[lang];

  const data = useMemo(
    () => byCategory.map(([category, amount]) => ({ category, amount, label: labels[category] || category })),
    [byCategory, labels]
  );
  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data]);

  if (data.length === 0) return null;

  return (
    <ChartFrame className="w-full h-[220px]">
      {({ width, height }) => {
        const size = Math.min(width, height);
        return (
          <PieChart width={width} height={height}>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={size * 0.22}
              outerRadius={size * 0.4}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.category} fill={colorFor(d.category, i)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => {
                const n = Number(value);
                return [`${formatUZS(n)} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, (entry as any)?.payload?.label];
              }}
              contentStyle={{
                background: "var(--m3-surface-container)",
                border: "1px solid var(--m3-outline-variant)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
          </PieChart>
        );
      }}
    </ChartFrame>
  );
}
