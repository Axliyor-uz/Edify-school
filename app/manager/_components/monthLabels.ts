// Month-name helpers shared across the manager panel (trilingual uz/en/ru).
// Lifted out of the route-local `app/manager/finance/_components/financeFormat.ts`
// (which re-exports these for its existing importers) so `app/manager/dashboard/*`
// can build a trailing-months trend series without a cross-route import —
// `app/office/page.tsx` already imports `monthLabelOf`/`shiftMonthKey` from the
// finance route directly, and a third consumer (the dashboard) is the trigger to
// finally give these a shared home instead of a second copy of the same smell.

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
export const MONTHS_RU_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "2026-07" → "Iyul 2026" / "July 2026" / "Июль 2026". */
export function monthLabelOf(monthKey: string, lang: LangType): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[lang][(m || 1) - 1]} ${y}`;
}
