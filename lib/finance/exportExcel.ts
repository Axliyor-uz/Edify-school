// Pure workbook-building logic (no Firestore) for the Moliya export button —
// bundles whichever money-cycle sheets the manager picked (Hisob-kitob,
// To'lovlar, Qarzdorlar, Oyliklar, Xarajatlar) into a single .xlsx. Kept
// dependency-free of app/services (own small translation maps instead of
// importing financeFormat.ts/financeService.ts) so lib/ doesn't reach up into
// app/ — status/method labels are intentionally simple, not the full i18n
// treatment those files give the on-screen tabs.
import * as XLSX from "xlsx";
import type { Charge, Expense, Payment, PaymentMethod, PaymentMethodSplit, PayrollRow } from "@/types/finance";
import type { LangType } from "@/app/manager/_components/ManagerLanguage";

export type FinanceExportSection = "charges" | "payments" | "debtors" | "payroll" | "expenses";

export const FINANCE_EXPORT_SECTIONS: FinanceExportSection[] = ["charges", "payments", "debtors", "payroll", "expenses"];

const SECTION_LABEL_T: Record<LangType, Record<FinanceExportSection, string>> = {
  uz: {
    charges: "Hisob-kitob",
    payments: "To'lovlar",
    debtors: "Qarzdorlar",
    payroll: "Oyliklar",
    expenses: "Xarajatlar",
  },
  en: {
    charges: "Billing",
    payments: "Payments",
    debtors: "Debtors",
    payroll: "Payroll",
    expenses: "Expenses",
  },
  ru: {
    charges: "Начисления",
    payments: "Платежи",
    debtors: "Должники",
    payroll: "Зарплаты",
    expenses: "Расходы",
  },
};

const SECTION_DESC_T: Record<LangType, Record<FinanceExportSection, string>> = {
  uz: {
    charges: "Bu oy hisoblangan to'lovlar",
    payments: "Bu oy qabul qilingan to'lov/qaytarimlar",
    debtors: "Joriy holat — hozir qarzi bor o'quvchilar",
    payroll: "Bu oy o'qituvchilar oyligi",
    expenses: "Bu oy xarajatlar",
  },
  en: {
    charges: "This month's billed charges",
    payments: "This month's payments/refunds",
    debtors: "Current snapshot — students who owe right now",
    payroll: "This month's teacher payroll",
    expenses: "This month's expenses",
  },
  ru: {
    charges: "Начисления за этот месяц",
    payments: "Платежи/возвраты за этот месяц",
    debtors: "Текущий срез — у кого есть долг сейчас",
    payroll: "Зарплаты учителей за этот месяц",
    expenses: "Расходы за этот месяц",
  },
};

export function sectionLabel(section: FinanceExportSection, lang: LangType): string {
  return SECTION_LABEL_T[lang][section];
}
export function sectionDescription(section: FinanceExportSection, lang: LangType): string {
  return SECTION_DESC_T[lang][section];
}

const TOTAL_LABEL_T: Record<LangType, string> = { uz: "Jami", en: "Total", ru: "Итого" };

const CHARGE_STATUS_T: Record<LangType, Record<Charge["status"], string>> = {
  uz: { pending: "To'lanmagan", partial: "Qisman", paid: "To'langan", waived: "Kechirilgan", cancelled: "Bekor qilingan" },
  en: { pending: "Unpaid", partial: "Partial", paid: "Paid", waived: "Waived", cancelled: "Cancelled" },
  ru: { pending: "Не оплачен", partial: "Частично", paid: "Оплачен", waived: "Прощён", cancelled: "Отменён" },
};

const PAYMENT_TYPE_T: Record<LangType, Record<Payment["type"], string>> = {
  uz: { payment: "To'lov", refund: "Qaytarim" },
  en: { payment: "Payment", refund: "Refund" },
  ru: { payment: "Платёж", refund: "Возврат" },
};

const PAYMENT_STATUS_T: Record<LangType, Record<Payment["status"], string>> = {
  uz: { confirmed: "Tasdiqlangan", cancelled: "Bekor qilingan" },
  en: { confirmed: "Confirmed", cancelled: "Cancelled" },
  ru: { confirmed: "Подтверждён", cancelled: "Отменён" },
};

const EXPENSE_STATUS_T: Record<LangType, Record<string, string>> = {
  uz: { active: "Faol", cancelled: "Bekor qilingan" },
  en: { active: "Active", cancelled: "Cancelled" },
  ru: { active: "Активен", cancelled: "Отменён" },
};

const PAYOUT_STATUS_T: Record<LangType, Record<"none" | "approved" | "paid", string>> = {
  uz: { none: "Hisoblanmagan", approved: "Tasdiqlangan", paid: "To'langan" },
  en: { none: "Not approved", approved: "Approved", paid: "Paid" },
  ru: { none: "Не утверждено", approved: "Утверждено", paid: "Выплачено" },
};

const openAmountOf = (c: Charge) => Math.max(0, c.amount - (c.paidAmount || 0));

// Own small label map, matching the header comment: this file must not import
// financeFormat.ts (that would reach up into app/).
const PAYMENT_METHOD_T: Record<LangType, Record<PaymentMethod, string>> = {
  uz: { cash: "Naqd", card: "Karta", click: "Click", payme: "Payme", transfer: "O'tkazma", other: "Boshqa" },
  en: { cash: "Cash", card: "Card", click: "Click", payme: "Payme", transfer: "Transfer", other: "Other" },
  ru: { cash: "Наличные", card: "Карта", click: "Click", payme: "Payme", transfer: "Перевод", other: "Другое" },
};

/** "Karta" for a plain single-method doc, or "Naqd 200000 + Karta (AAA) 300000" once split. */
function methodSummary(doc: { method?: PaymentMethod; methodSplit?: PaymentMethodSplit[] }, lang: LangType): string {
  if (doc.methodSplit?.length) {
    return doc.methodSplit
      .map((s) => `${PAYMENT_METHOD_T[lang][s.method]}${s.label ? ` (${s.label})` : ""} ${s.amount}`)
      .join(" + ");
  }
  return doc.method ? PAYMENT_METHOD_T[lang][doc.method] : "";
}

function appendSheet(wb: XLSX.WorkBook, name: string, aoa: (string | number)[][], colWidths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export interface BuildFinanceWorkbookParams {
  sections: Set<FinanceExportSection>;
  charges: Charge[]; // this browsed month
  payments: Payment[]; // this browsed month
  openCharges: Charge[]; // all-time open (pending/partial) — the debtors snapshot
  payrollRows: PayrollRow[];
  expenses: Expense[]; // this browsed month
  monthKey: string; // "YYYY-MM"
  lang: LangType;
}

export function buildFinanceWorkbook(params: BuildFinanceWorkbookParams): { blob: Blob; filename: string } {
  const { sections, charges, payments, openCharges, payrollRows, expenses, monthKey, lang } = params;
  const wb = XLSX.utils.book_new();

  if (sections.has("charges")) {
    const chargeStatusT = CHARGE_STATUS_T[lang];
    const rows: (string | number)[][] = charges.map((c) => [
      c.studentName,
      c.classTitle,
      c.periodKey,
      c.amount,
      c.paidAmount || 0,
      chargeStatusT[c.status] || c.status,
      c.dueDate,
    ]);
    const total = charges.filter((c) => c.status !== "cancelled").reduce((s, c) => s + c.amount, 0);
    appendSheet(
      wb,
      sectionLabel("charges", lang),
      [
        ["O'quvchi", "Guruh", "Davr", "Summa (so'm)", "To'langan (so'm)", "Holat", "Muddat"],
        ...rows,
        [],
        [TOTAL_LABEL_T[lang], "", "", total, "", "", ""],
      ],
      [22, 20, 12, 14, 16, 16, 12]
    );
  }

  if (sections.has("payments")) {
    const typeT = PAYMENT_TYPE_T[lang];
    const statusT = PAYMENT_STATUS_T[lang];
    const rows: (string | number)[][] = payments.map((p) => [
      p.paidAt,
      p.studentName,
      typeT[p.type] || p.type,
      methodSummary(p, lang),
      p.amount,
      p.note || "",
      statusT[p.status] || p.status,
    ]);
    const total = payments
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + (p.type === "refund" ? -p.amount : p.amount), 0);
    appendSheet(
      wb,
      sectionLabel("payments", lang),
      [
        ["Sana", "O'quvchi", "Turi", "Usul", "Summa (so'm)", "Izoh", "Holat"],
        ...rows,
        [],
        [TOTAL_LABEL_T[lang], "", "", "", total, "", ""],
      ],
      [12, 22, 12, 28, 14, 26, 16]
    );
  }

  if (sections.has("debtors")) {
    const rows: (string | number)[][] = openCharges.map((c) => [
      c.studentName,
      c.classTitle,
      c.periodKey,
      openAmountOf(c),
      c.dueDate,
    ]);
    const total = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
    appendSheet(
      wb,
      sectionLabel("debtors", lang),
      [["O'quvchi", "Guruh", "Davr", "Qarz (so'm)", "Muddat"], ...rows, [], [TOTAL_LABEL_T[lang], "", "", total, ""]],
      [22, 20, 12, 14, 12]
    );
  }

  if (sections.has("payroll")) {
    const payStatusT = PAYOUT_STATUS_T[lang];
    const rows: (string | number)[][] = payrollRows.map((r) => [
      r.teacherName,
      r.calculatedAmount,
      r.payout?.adjustment || 0,
      r.payout ? r.payout.finalAmount : r.calculatedAmount,
      r.payout ? payStatusT[r.payout.status] : payStatusT.none,
      r.payout?.paidAt || "",
    ]);
    const total = payrollRows.reduce((s, r) => s + (r.payout ? r.payout.finalAmount : r.calculatedAmount), 0);
    appendSheet(
      wb,
      sectionLabel("payroll", lang),
      [
        ["O'qituvchi", "Hisoblangan (so'm)", "Bonus/Jarima (so'm)", "Yakuniy (so'm)", "Holat", "To'langan sana"],
        ...rows,
        [],
        [TOTAL_LABEL_T[lang], "", "", total, "", ""],
      ],
      [22, 18, 18, 16, 16, 14]
    );
  }

  if (sections.has("expenses")) {
    const statusT = EXPENSE_STATUS_T[lang];
    const rows: (string | number)[][] = expenses.map((e) => [
      e.date,
      e.category,
      methodSummary(e, lang),
      e.amount,
      e.note || "",
      statusT[e.status] || e.status,
    ]);
    const total = expenses.filter((e) => e.status === "active").reduce((s, e) => s + e.amount, 0);
    appendSheet(
      wb,
      sectionLabel("expenses", lang),
      [
        ["Sana", "Kategoriya", "Usul", "Summa (so'm)", "Izoh", "Holat"],
        ...rows,
        [],
        [TOTAL_LABEL_T[lang], "", "", total, "", ""],
      ],
      [12, 14, 28, 14, 32, 16]
    );
  }

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, filename: `Moliya_${monthKey}.xlsx` };
}
