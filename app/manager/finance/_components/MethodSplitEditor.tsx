"use client";

// A payment/expense's amount, entered as ONE method (the common case — looks
// exactly like the old single-method button row) or split across several
// (500,000 so'm as 300,000 by card + 200,000 cash, say). Shared by
// RecordPaymentModal and ExpensesTab's AddExpenseModal — same shape on both
// sides of the ledger (docs/FINANCE.md). No named-card registry: `label` is a
// free-text tag typed fresh each time (e.g. "AAA karta"), snapshotted as-is.

import { Plus, X } from "lucide-react";
import type { PaymentMethod, PaymentMethodSplit } from "@/types/finance";
import type { LangType } from "@/app/manager/_components/ManagerLanguage";
import { formatSum } from "@/lib/finance/money";
import { PAYMENT_METHOD_KEYS, PAYMENT_METHOD_T } from "./financeFormat";

export interface MethodSplitLine {
  method: PaymentMethod;
  /** Raw input text — parsed with parseInt at the read sites below. */
  amount: string;
  label: string;
}

export const singleSplitLine = (method: PaymentMethod = "cash"): MethodSplitLine[] => [
  { method, amount: "", label: "" },
];

const lineAmount = (l: MethodSplitLine): number => {
  const n = parseInt(l.amount, 10);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export const methodSplitTotal = (lines: MethodSplitLine[]): number =>
  lines.reduce((s, l) => s + lineAmount(l), 0);

/**
 * True when this is a plain single-method entry (nothing to validate beyond
 * the top-level amount field), OR every split line has a valid amount and
 * they sum EXACTLY to `totalAmount`.
 */
export const methodSplitValid = (lines: MethodSplitLine[], totalAmount: number): boolean =>
  lines.length <= 1 || (lines.every((l) => lineAmount(l) > 0) && methodSplitTotal(lines) === totalAmount);

/** The wire payload — `undefined` for a plain single-method entry (the caller
 *  then sends its own top-level `amount`/`method` exactly as before). */
export function methodSplitPayload(lines: MethodSplitLine[]): PaymentMethodSplit[] | undefined {
  if (lines.length <= 1) return undefined;
  return lines.map((l) => ({
    method: l.method,
    amount: lineAmount(l),
    ...(l.label.trim() ? { label: l.label.trim() } : {}),
  }));
}

const T = {
  uz: { split: "Bir nechta usulda to'lash", add: "Yana usul qo'shish", labelPh: "Nomi (masalan: AAA karta)", allocated: "Taqsimlangan", of: "/" },
  en: { split: "Split across methods", add: "Add another method", labelPh: "Label (e.g. AAA card)", allocated: "Allocated", of: "/" },
  ru: { split: "Разбить по способам", add: "Добавить способ", labelPh: "Название (напр. карта AAA)", allocated: "Распределено", of: "/" },
} satisfies Record<LangType, Record<string, string>>;

/** Every method not `cash` can carry a free-text label — a named card/account. */
const showLabel = (m: PaymentMethod) => m !== "cash";

export default function MethodSplitEditor({
  lang,
  totalAmount,
  lines,
  onChange,
}: {
  lang: LangType;
  totalAmount: number;
  lines: MethodSplitLine[];
  onChange: (next: MethodSplitLine[]) => void;
}) {
  const t = T[lang];
  const split = lines.length > 1;

  if (!split) {
    const line = lines[0] ?? { method: "cash" as PaymentMethod, amount: "", label: "" };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHOD_KEYS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange([{ ...line, method: m }])}
              className={`px-3.5 py-2 rounded-m3-md text-[13px] font-bold border transition-colors ${
                line.method === m
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
              }`}
            >
              {PAYMENT_METHOD_T[lang][m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange([{ ...line, method: line.method }, { method: "card", amount: "", label: "" }])}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
        >
          <Plus size={13} /> {t.split}
        </button>
      </div>
    );
  }

  const allocated = methodSplitTotal(lines);
  const exact = allocated === totalAmount;
  const usedMethods = new Set(lines.map((l) => l.method));
  const nextMethod = PAYMENT_METHOD_KEYS.find((m) => !usedMethods.has(m)) ?? "other";

  const update = (i: number, patch: Partial<MethodSplitLine>) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(lines.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={line.method}
            onChange={(e) => update(i, { method: e.target.value as PaymentMethod })}
            className="px-2.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {PAYMENT_METHOD_KEYS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_T[lang][m]}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={line.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
            placeholder="0"
            className="w-0 flex-1 px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {showLabel(line.method) && (
            <input
              value={line.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder={t.labelPh}
              className="w-0 flex-1 px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-9 h-9 shrink-0 rounded-m3-sm hover:bg-error-container hover:text-error text-on-surface-variant flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={lines.length >= PAYMENT_METHOD_KEYS.length}
          onClick={() => onChange([...lines, { method: nextMethod, amount: "", label: "" }])}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={13} /> {t.add}
        </button>
        <p className={`text-[12px] font-bold tabular-nums ${exact ? "text-success" : "text-error"}`}>
          {t.allocated}: {formatSum(allocated)} {t.of} {formatSum(totalAmount)}
        </p>
      </div>
    </div>
  );
}
