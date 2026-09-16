// Route-local formatting helpers for the finance UI (trilingual uz/en/ru).
// Every label-producing helper takes the current manager language — components
// pass `lang` from useManagerLanguage().

import { addMonthsClamped } from "@/lib/finance/billingEngine";
import { formatSum } from "@/lib/finance/money";
import type { Charge, ChargeStatus, PaymentMethod, PaymentMethodSplit } from "@/types/finance";
import type { LangType } from "@/app/manager/_components/ManagerLanguage";

export const MONTHS: Record<LangType, string[]> = {
  uz: [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  ru: [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ],
};

/** Russian genitive month names for "15 июля"-style dates. */
const MONTHS_RU_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "2026-07" → "Iyul 2026" / "July 2026" / "Июль 2026". */
export function monthLabelOf(monthKey: string, lang: LangType): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[lang][(m || 1) - 1]} ${y}`;
}

/** "2026-07-15" → "15-iyul" / "Jul 15" / "15 июля". */
export function shortDateLabel(dateKey: string, lang: LangType): string {
  const [, m, d] = dateKey.split("-").map(Number);
  const i = (m || 1) - 1;
  if (lang === "en") return `${MONTHS.en[i].slice(0, 3)} ${d}`;
  if (lang === "ru") return `${d} ${MONTHS_RU_GEN[i]}`;
  return `${d}-${MONTHS.uz[i].toLowerCase()}`;
}

export const WEEKDAYS: Record<LangType, string[]> = {
  uz: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
};

const RELATIVE_DAY: Record<LangType, { today: string; yesterday: string }> = {
  uz: { today: "Bugun", yesterday: "Kecha" },
  en: { today: "Today", yesterday: "Yesterday" },
  ru: { today: "Сегодня", yesterday: "Вчера" },
};

/** Feed section header: "Bugun" / "Kecha" / "Dushanba, 15-iyul" (+ year when not current). */
export function dayLabelOf(dateKey: string, todayKey: string, lang: LangType): string {
  if (dateKey === todayKey) return RELATIVE_DAY[lang].today;
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 1) return RELATIVE_DAY[lang].yesterday;
  const label = `${WEEKDAYS[lang][date.getDay()]}, ${shortDateLabel(dateKey, lang)}`;
  return dateKey.slice(0, 4) === todayKey.slice(0, 4) ? label : `${label} ${dateKey.slice(0, 4)}`;
}

/** "Aziz Abdullayev" → "AA" for avatar circles. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + second).toUpperCase();
}

/** Charge period label: calendar charges show the month, rolling ones the cycle range. */
export function periodLabelOf(
  charge: Pick<Charge, "periodKey" | "periodStart" | "periodEnd">,
  lang: LangType
): string {
  if (charge.periodKey.length === 7) return monthLabelOf(charge.periodKey, lang);
  return `${shortDateLabel(charge.periodStart, lang)} – ${shortDateLabel(charge.periodEnd, lang)}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  return addMonthsClamped(`${monthKey}-01`, delta).slice(0, 7);
}

// ── Shared UI label maps (used by several sibling tabs) ──────────────────────
// Keys are the stored Firestore values — never translated. The uz values match
// the legacy CHARGE_STATUS_LABELS / PAYMENT_METHOD_LABELS in types/finance.ts.

export const CHARGE_STATUS_T: Record<LangType, Record<ChargeStatus, string>> = {
  uz: {
    pending: "To'lanmagan",
    partial: "Qisman",
    paid: "To'langan",
    waived: "Kechirilgan",
    cancelled: "Bekor qilingan",
  },
  en: {
    pending: "Unpaid",
    partial: "Partial",
    paid: "Paid",
    waived: "Waived",
    cancelled: "Cancelled",
  },
  ru: {
    pending: "Не оплачен",
    partial: "Частично",
    paid: "Оплачен",
    waived: "Прощён",
    cancelled: "Отменён",
  },
};

export const PAYMENT_METHOD_T: Record<LangType, Record<PaymentMethod, string>> = {
  uz: { cash: "Naqd", card: "Karta", click: "Click", payme: "Payme", transfer: "O'tkazma", other: "Boshqa" },
  en: { cash: "Cash", card: "Card", click: "Click", payme: "Payme", transfer: "Transfer", other: "Other" },
  ru: { cash: "Наличные", card: "Карта", click: "Click", payme: "Payme", transfer: "Перевод", other: "Другое" },
};

/** Stable method order for pickers (values, not labels). */
export const PAYMENT_METHOD_KEYS: PaymentMethod[] = ["cash", "card", "click", "payme", "transfer", "other"];

/**
 * "Karta" for a plain single-method payment/expense, or
 * "Naqd 200 000 + Karta (AAA karta) 300 000" once it was split
 * (`Payment.methodSplit` / `Expense.methodSplit`). Falls back to the scalar
 * `method` (or "—" for an old expense that has neither) when there is no split.
 */
export function formatMethodSplit(
  doc: { method?: PaymentMethod; methodSplit?: PaymentMethodSplit[] },
  lang: LangType
): string {
  if (doc.methodSplit?.length) {
    return doc.methodSplit
      .map((s) => `${PAYMENT_METHOD_T[lang][s.method]}${s.label ? ` (${s.label})` : ""} ${formatSum(s.amount)}`)
      .join(" + ");
  }
  return doc.method ? PAYMENT_METHOD_T[lang][doc.method] : "—";
}
