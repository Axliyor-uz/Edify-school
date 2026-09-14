"use client";

import { AlertCircle, HandCoins, PiggyBank, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  monthLabel: string;
  collected: number;
  charged: number;
  debtTotal: number;
  avansTotal: number;
  expensesTotal: number;
  profit: number;
}

const T_UZ = {
  collected: "Tushum",
  charged: "Hisoblangan",
  expenses: "Xarajatlar",
  profit: "Foyda",
  debt: "Qarzdorlik",
  debtSub: "jami",
  avans: "Avans",
  avansSub: "oldindan to'lovlar",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    collected: "Income",
    charged: "Charged",
    expenses: "Expenses",
    profit: "Profit",
    debt: "Debt",
    debtSub: "total",
    avans: "Prepaid",
    avansSub: "advance payments",
  },
  ru: {
    collected: "Поступления",
    charged: "Начислено",
    expenses: "Расходы",
    profit: "Прибыль",
    debt: "Задолженность",
    debtSub: "всего",
    avans: "Аванс",
    avansSub: "предоплаты",
  },
};

/**
 * Headline P&L as ONE row on desktop (xl: 6 columns), a swipeable snap
 * carousel on mobile. Token-toned icon tiles give each metric its own
 * identity at a glance (success/tertiary/warning/error/secondary).
 */
export default function FinanceStats({ monthLabel, collected, charged, debtTotal, avansTotal, expensesTotal, profit }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];

  const cards = [
    {
      Icon: TrendingUp,
      label: t.collected,
      sub: monthLabel,
      value: formatUZS(collected),
      tile: "bg-success text-on-success",
      valueCls: "text-success",
    },
    {
      Icon: ReceiptText,
      label: t.charged,
      sub: monthLabel,
      value: formatUZS(charged),
      tile: "bg-tertiary text-on-tertiary",
      valueCls: "text-on-surface",
    },
    {
      Icon: HandCoins,
      label: t.expenses,
      sub: monthLabel,
      value: formatUZS(expensesTotal),
      tile: "bg-warning text-on-warning",
      valueCls: "text-on-surface",
    },
    {
      Icon: Wallet,
      label: t.profit,
      sub: monthLabel,
      value: formatUZS(profit),
      tile: profit >= 0 ? "bg-success text-on-success" : "bg-error text-on-error",
      valueCls: profit >= 0 ? "text-success" : "text-error",
    },
    {
      Icon: AlertCircle,
      label: t.debt,
      sub: t.debtSub,
      value: formatUZS(debtTotal),
      tile: "bg-error text-on-error",
      valueCls: debtTotal > 0 ? "text-error" : "text-on-surface",
    },
    {
      Icon: PiggyBank,
      label: t.avans,
      sub: t.avansSub,
      value: formatUZS(avansTotal),
      tile: "bg-secondary text-on-secondary",
      valueCls: "text-on-surface",
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 xl:grid-cols-6 md:overflow-visible md:pb-0">
      {cards.map((c) => (
        <div
          key={c.label}
          className="snap-start shrink-0 w-[172px] md:w-auto md:shrink bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-4 transition-shadow hover:shadow-elev-2"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-m3-md flex items-center justify-center shadow-elev-1 ${c.tile}`}>
              <c.Icon size={17} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[11.5px] font-bold text-on-surface">{c.label}</p>
              <p className="text-[10px] text-on-surface-variant truncate">{c.sub}</p>
            </div>
          </div>
          <p className={`text-[15px] xl:text-[16px] font-bold tabular-nums leading-tight whitespace-nowrap ${c.valueCls}`}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
