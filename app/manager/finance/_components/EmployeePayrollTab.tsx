"use client";

/**
 * Non-teaching employee payroll board (docs/EMPLOYEES.md) — the employee
 * analog of PayrollTab.tsx: live calculation (fixed + hourly×hours worked +
 * allowances − deductions) → approve → mark paid. Kept as its OWN component
 * rather than merged into PayrollTab: the row shape (EmployeePayrollRow) and
 * breakdown are genuinely different (no percent/perLesson), and salary
 * CONFIG is edited from the employee's own info panel
 * (ManagerEmployeeInfoPanel), not from a gear icon here — this tab is purely
 * calculate/approve/pay, reusing `markPayoutPaidApi` verbatim (fully generic).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Loader2, Search, Users } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import type { CalculateEmployeePayrollResult, EmployeePayrollRow } from "@/types/finance";
import { calculateEmployeePayrollApi, markPayoutPaidApi, saveEmployeePayoutApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { Button, EmptyState, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { initialsOf } from "./financeFormat";
import MonthNav from "./MonthNav";
import SearchInput from "../../_components/SearchInput";

interface Props {
  monthKey: string;
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  onExpensesChanged: () => void;
}

const T_UZ = {
  calcError: "Xodimlar oyligini hisoblashda xatolik.",
  markedPaid: "Oylik to'landi deb belgilandi.",
  genericError: "Xatolik yuz berdi.",
  fixedPart: (amount: string) => `Fiks ${amount}`,
  hourlyPart: (hours: number, rate: string, amount: string) => `${hours} soat × ${rate} = ${amount}`,
  allowancePart: (amount: string) => `+ ${amount} ustama`,
  deductionPart: (amount: string) => `− ${amount} ushlab qolish`,
  salaryNotConfigured: "Oylik sozlanmagan",
  emptyTitle: "Markazda xodimlar yo'q",
  emptyDesc: "Xodim qo'shilganda oyliklar shu yerda hisoblanadi",
  searchPlaceholder: "Xodimni qidiring...",
  emptySearchTitle: "Hech narsa topilmadi",
  emptySearchDesc: "Qidiruvni o'zgartirib ko'ring",
  paidChip: "To'langan",
  approvedChip: "Tasdiqlangan",
  bonus: "Bonus",
  penalty: "Jarima",
  recalc: "Qayta hisoblash",
  approve: "Tasdiqlash",
  markPaid: "To'landi",
  markPaidTitle: "Oylikni to'langan deb belgilash",
  markPaidMessage: (name: string, amount: string) =>
    `${name} — ${amount}. Bu summa xarajatlarga ("Oylik") avtomatik qo'shiladi va payout boshqa o'zgartirilmaydi.`,
  cancel: "Bekor qilish",
  save: "Saqlash",
  payoutApproved: "Oylik tasdiqlandi.",
  approveTitle: "Oylikni tasdiqlash",
  calculatedLabel: "hisoblangan:",
  adjustmentLabel: "Bonus (+) / Jarima (−)",
  noteRequired: "Izoh (majburiy)",
  noteOptional: "Izoh (ixtiyoriy)",
  finalLabel: "Yakuniy:",
  saveError: "Saqlashda xatolik.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    calcError: "Failed to calculate employee payroll.",
    markedPaid: "Salary marked as paid.",
    genericError: "Something went wrong.",
    fixedPart: (amount) => `Fixed ${amount}`,
    hourlyPart: (hours, rate, amount) => `${hours} hrs × ${rate} = ${amount}`,
    allowancePart: (amount) => `+ ${amount} allowance`,
    deductionPart: (amount) => `− ${amount} deduction`,
    salaryNotConfigured: "Salary not configured",
    emptyTitle: "No employees in the center",
    emptyDesc: "Payroll is calculated here once an employee is added",
    searchPlaceholder: "Search employees...",
    emptySearchTitle: "Nothing found",
    emptySearchDesc: "Try changing your search",
    paidChip: "Paid",
    approvedChip: "Approved",
    bonus: "Bonus",
    penalty: "Penalty",
    recalc: "Recalculate",
    approve: "Approve",
    markPaid: "Paid",
    markPaidTitle: "Mark salary as paid",
    markPaidMessage: (name, amount) =>
      `${name} — ${amount}. This amount is automatically added to expenses ("Salary") and the payout can no longer be changed.`,
    cancel: "Cancel",
    save: "Save",
    payoutApproved: "Salary approved.",
    approveTitle: "Approve salary",
    calculatedLabel: "calculated:",
    adjustmentLabel: "Bonus (+) / Penalty (−)",
    noteRequired: "Note (required)",
    noteOptional: "Note (optional)",
    finalLabel: "Final:",
    saveError: "Failed to save.",
  },
  ru: {
    calcError: "Не удалось рассчитать зарплату сотрудников.",
    markedPaid: "Зарплата отмечена как выплаченная.",
    genericError: "Произошла ошибка.",
    fixedPart: (amount) => `Фикс. ${amount}`,
    hourlyPart: (hours, rate, amount) => `${hours} ч × ${rate} = ${amount}`,
    allowancePart: (amount) => `+ ${amount} надбавка`,
    deductionPart: (amount) => `− ${amount} удержание`,
    salaryNotConfigured: "Зарплата не настроена",
    emptyTitle: "В центре нет сотрудников",
    emptyDesc: "Зарплата будет рассчитана здесь после добавления сотрудника",
    searchPlaceholder: "Поиск сотрудника...",
    emptySearchTitle: "Ничего не найдено",
    emptySearchDesc: "Попробуйте изменить запрос",
    paidChip: "Выплачено",
    approvedChip: "Утверждено",
    bonus: "Бонус",
    penalty: "Штраф",
    recalc: "Пересчитать",
    approve: "Утвердить",
    markPaid: "Выплачено",
    markPaidTitle: "Отметить зарплату выплаченной",
    markPaidMessage: (name, amount) =>
      `${name} — ${amount}. Эта сумма автоматически добавится в расходы («Зарплата»), и выплату больше нельзя будет изменить.`,
    cancel: "Отмена",
    save: "Сохранить",
    payoutApproved: "Зарплата утверждена.",
    approveTitle: "Утвердить зарплату",
    calculatedLabel: "рассчитано:",
    adjustmentLabel: "Бонус (+) / Штраф (−)",
    noteRequired: "Комментарий (обязательно)",
    noteOptional: "Комментарий (необязательно)",
    finalLabel: "Итог:",
    saveError: "Не удалось сохранить.",
  },
};

export default function EmployeePayrollTab({ monthKey, monthLabel, onShiftMonth, onExpensesChanged }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [result, setResult] = useState<CalculateEmployeePayrollResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<EmployeePayrollRow | null>(null);
  const [payTarget, setPayTarget] = useState<EmployeePayrollRow | null>(null);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    if (!q) return result.rows;
    return result.rows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [result, search]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await calculateEmployeePayrollApi(monthKey));
    } catch (e: any) {
      toast.error(e.message || t.calcError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const markPaid = async () => {
    if (!payTarget?.payout || paying) return;
    setPaying(true);
    try {
      await markPayoutPaidApi(payTarget.payout.id);
      toast.success(t.markedPaid);
      setPayTarget(null);
      await reload();
      onExpensesChanged();
    } catch (e: any) {
      toast.error(e.message || t.genericError);
    } finally {
      setPaying(false);
    }
  };

  const breakdownLine = (r: EmployeePayrollRow) => {
    const parts: string[] = [];
    if (r.breakdown.fixed > 0) parts.push(t.fixedPart(formatUZS(r.breakdown.fixed)));
    if (r.breakdown.hourly.rate > 0) {
      parts.push(t.hourlyPart(r.breakdown.hourly.hours, formatUZS(r.breakdown.hourly.rate), formatUZS(r.breakdown.hourly.amount)));
    }
    if (r.breakdown.allowancesTotal > 0) parts.push(t.allowancePart(formatUZS(r.breakdown.allowancesTotal)));
    if (r.breakdown.deductionsTotal > 0) parts.push(t.deductionPart(formatUZS(r.breakdown.deductionsTotal)));
    return parts.length ? parts.join(" + ") : t.salaryNotConfigured;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !result || result.rows.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyDesc} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {result.rows.length > 5 && (
            <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
          )}
          {filteredRows.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
              <EmptyState icon={<Search />} title={t.emptySearchTitle} description={t.emptySearchDesc} />
            </div>
          )}
          {filteredRows.map((r) => {
            const paid = r.payout?.status === "paid";
            const approved = r.payout?.status === "approved";
            return (
              <div key={r.employeeId} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                      paid ? "bg-success-container text-on-success-container" : "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    {initialsOf(r.employeeName)}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-semibold text-on-surface">{r.employeeName}</p>
                      {paid && (
                        <StatusChip tone="success" noDot>
                          <BadgeCheck size={11} /> {t.paidChip}
                        </StatusChip>
                      )}
                      {approved && <StatusChip tone="info" noDot>{t.approvedChip}</StatusChip>}
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant mt-1">{breakdownLine(r)}</p>
                    {r.payout && r.payout.adjustment !== 0 && (
                      <p className="text-[12.5px] text-on-surface-variant mt-0.5">
                        {r.payout.adjustment > 0 ? t.bonus : t.penalty}: {formatUZS(Math.abs(r.payout.adjustment))}
                        {r.payout.adjustmentNote && ` (${r.payout.adjustmentNote})`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-on-surface tabular-nums">
                      {formatUZS(r.payout ? r.payout.finalAmount : r.calculatedAmount)}
                    </p>
                    <div className="flex gap-1.5 mt-1.5 justify-end">
                      {!paid && (
                        <Button variant="tonal" size="sm" onClick={() => setApproveTarget(r)}>
                          {approved ? t.recalc : t.approve}
                        </Button>
                      )}
                      {approved && (
                        <Button size="sm" onClick={() => setPayTarget(r)}>
                          {t.markPaid}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {approveTarget && (
        <ApproveEmployeePayoutModal
          row={approveTarget}
          periodKey={monthKey}
          onClose={() => setApproveTarget(null)}
          onDone={() => {
            setApproveTarget(null);
            reload();
          }}
        />
      )}
      {payTarget?.payout && (
        <ConfirmDialog
          title={t.markPaidTitle}
          message={t.markPaidMessage(payTarget.employeeName, formatUZS(payTarget.payout.finalAmount))}
          confirmLabel={t.markPaid}
          isLoading={paying}
          onConfirm={markPaid}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

function ApproveEmployeePayoutModal({
  row,
  periodKey,
  onClose,
  onDone,
}: {
  row: EmployeePayrollRow;
  periodKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [adjustment, setAdjustment] = useState(row.payout ? String(row.payout.adjustment || "") : "");
  const [note, setNote] = useState(row.payout?.adjustmentNote || "");
  const [submitting, setSubmitting] = useState(false);

  const adj = adjustment.trim() === "" ? 0 : parseInt(adjustment, 10);
  const valid = Number.isInteger(adj) && (adj === 0 || note.trim().length > 0);
  const finalAmount = row.calculatedAmount + (Number.isInteger(adj) ? adj : 0);

  const submit = async () => {
    if (!valid || submitting || finalAmount < 0) return;
    setSubmitting(true);
    try {
      await saveEmployeePayoutApi({
        employeeId: row.employeeId,
        periodKey,
        adjustment: adj,
        ...(note.trim() ? { adjustmentNote: note.trim() } : {}),
      });
      toast.success(t.payoutApproved);
      onDone();
    } catch (e: any) {
      toast.error(e.message || t.saveError);
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.approveTitle}</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {row.employeeName} · {t.calculatedLabel} <span className="font-bold">{formatUZS(row.calculatedAmount)}</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold text-on-surface mb-1">{t.adjustmentLabel}</p>
          <input
            type="number"
            inputMode="numeric"
            step={1000}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="0"
            className="w-full px-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={adj !== 0 ? t.noteRequired : t.noteOptional}
          className="w-full px-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <p className="text-sm text-on-surface-variant">
          {t.finalLabel} <span className={`font-bold ${finalAmount < 0 ? "text-error" : "text-on-surface"}`}>{formatUZS(finalAmount)}</span>
        </p>
        <div className="flex gap-3">
          <Button variant="tonal" onClick={onClose} disabled={submitting} className="flex-1">
            {t.cancel}
          </Button>
          <Button onClick={submit} disabled={!valid || finalAmount < 0} loading={submitting} className="flex-1">
            {t.approve}
          </Button>
        </div>
      </div>
    </ManagerSheet>
  );
}
