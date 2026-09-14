"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Loader2, Search, Settings2, Users } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import type { CalculatePayrollResult, PayrollRow } from "@/types/finance";
import {
  calculatePayrollApi,
  markPayoutPaidApi,
  savePayoutApi,
  saveTeacherSalaryApi,
} from "@/services/financeService";
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
  /** Fired after a payout is marked paid (a salary expense appears). */
  onExpensesChanged: () => void;
}

const T_UZ = {
  calcError: "Oyliklarni hisoblashda xatolik.",
  markedPaid: "Oylik to'landi deb belgilandi.",
  genericError: "Xatolik yuz berdi.",
  fixedPart: (amount: string) => `Fiks ${amount}`,
  percentBaseCollected: "tushumdan",
  percentBaseCharged: "hisoblanganidan",
  lessonsPart: (count: number, rate: string, amount: string) => `${count} dars × ${rate} = ${amount}`,
  salaryNotConfigured: "Oylik sozlanmagan",
  percentBaseLabel: "Foiz bazasi:",
  percentBaseValueCollected: "yig'ilgan puldan",
  percentBaseValueCharged: "hisoblangan puldan",
  percentBaseHint: "(Sozlamalarda o'zgartiriladi)",
  emptyTitle: "Markazda o'qituvchilar yo'q",
  emptyDesc: "O'qituvchi qo'shilganda oyliklar shu yerda hisoblanadi",
  searchPlaceholder: "O'qituvchini qidiring...",
  emptySearchTitle: "Hech narsa topilmadi",
  emptySearchDesc: "Qidiruvni o'zgartirib ko'ring",
  paidChip: "To'langan",
  approvedChip: "Tasdiqlangan",
  bonus: "Bonus",
  penalty: "Jarima",
  salaryConfigTitle: "Oylik sozlamalari",
  recalc: "Qayta hisoblash",
  approve: "Tasdiqlash",
  markPaid: "To'landi",
  markPaidTitle: "Oylikni to'langan deb belgilash",
  markPaidMessage: (name: string, amount: string) =>
    `${name} — ${amount}. Bu summa xarajatlarga ("Oylik") avtomatik qo'shiladi va payout boshqa o'zgartirilmaydi.`,
  invalidValues: "Qiymatlar noto'g'ri kiritildi.",
  salaryConfigSaved: "Oylik sozlamalari saqlandi.",
  saveError: "Saqlashda xatolik.",
  sumOfParts: "qismlar yig'indisi to'lanadi",
  fixedLabel: "Fiks oylik (so'm)",
  fixedHint: "Har oy o'zgarmas summa. Bo'sh — yo'q.",
  percentLabel: "Guruh daromadidan foiz (%)",
  percentHint: "O'z guruhlari pulidan ulush. Bo'sh — yo'q.",
  perLessonLabel: "Har dars uchun (so'm)",
  perLessonHint: "Davomatdagi o'tilgan darslar soniga ko'paytiriladi. Bo'sh — yo'q.",
  cancel: "Bekor qilish",
  save: "Saqlash",
  payoutApproved: "Oylik tasdiqlandi.",
  approveTitle: "Oylikni tasdiqlash",
  calculatedLabel: "hisoblangan:",
  adjustmentLabel: "Bonus (+) / Jarima (−)",
  noteRequired: "Izoh (majburiy)",
  noteOptional: "Izoh (ixtiyoriy)",
  finalLabel: "Yakuniy:",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    calcError: "Failed to calculate payroll.",
    markedPaid: "Salary marked as paid.",
    genericError: "Something went wrong.",
    fixedPart: (amount: string) => `Fixed ${amount}`,
    percentBaseCollected: "of collected",
    percentBaseCharged: "of charged",
    lessonsPart: (count: number, rate: string, amount: string) => `${count} lessons × ${rate} = ${amount}`,
    salaryNotConfigured: "Salary not configured",
    percentBaseLabel: "Percent base:",
    percentBaseValueCollected: "collected money",
    percentBaseValueCharged: "charged money",
    percentBaseHint: "(changed in Settings)",
    emptyTitle: "No teachers in the center",
    emptyDesc: "Once a teacher is added, payroll is calculated here",
    searchPlaceholder: "Search for a teacher...",
    emptySearchTitle: "Nothing found",
    emptySearchDesc: "Try changing your search",
    paidChip: "Paid",
    approvedChip: "Approved",
    bonus: "Bonus",
    penalty: "Penalty",
    salaryConfigTitle: "Salary settings",
    recalc: "Recalculate",
    approve: "Approve",
    markPaid: "Paid",
    markPaidTitle: "Mark salary as paid",
    markPaidMessage: (name: string, amount: string) =>
      `${name} — ${amount}. This amount is automatically added to expenses ("Salary") and the payout can no longer be changed.`,
    invalidValues: "Invalid values entered.",
    salaryConfigSaved: "Salary settings saved.",
    saveError: "Failed to save.",
    sumOfParts: "the sum of the parts is paid",
    fixedLabel: "Fixed salary (so'm)",
    fixedHint: "A constant amount every month. Empty — none.",
    percentLabel: "Percent of group income (%)",
    percentHint: "A share of their own groups' money. Empty — none.",
    perLessonLabel: "Per lesson (so'm)",
    perLessonHint: "Multiplied by the number of lessons held in attendance. Empty — none.",
    cancel: "Cancel",
    save: "Save",
    payoutApproved: "Salary approved.",
    approveTitle: "Approve salary",
    calculatedLabel: "calculated:",
    adjustmentLabel: "Bonus (+) / Penalty (−)",
    noteRequired: "Note (required)",
    noteOptional: "Note (optional)",
    finalLabel: "Final:",
  },
  ru: {
    calcError: "Не удалось рассчитать зарплаты.",
    markedPaid: "Зарплата отмечена как выплаченная.",
    genericError: "Произошла ошибка.",
    fixedPart: (amount: string) => `Фикс ${amount}`,
    percentBaseCollected: "от поступлений",
    percentBaseCharged: "от начислений",
    lessonsPart: (count: number, rate: string, amount: string) => `${count} занятий × ${rate} = ${amount}`,
    salaryNotConfigured: "Зарплата не настроена",
    percentBaseLabel: "База процента:",
    percentBaseValueCollected: "от собранных денег",
    percentBaseValueCharged: "от начисленных денег",
    percentBaseHint: "(меняется в настройках)",
    emptyTitle: "В центре нет учителей",
    emptyDesc: "Когда учитель будет добавлен, зарплаты рассчитываются здесь",
    searchPlaceholder: "Поиск учителя...",
    emptySearchTitle: "Ничего не найдено",
    emptySearchDesc: "Попробуйте изменить запрос",
    paidChip: "Выплачено",
    approvedChip: "Утверждено",
    bonus: "Бонус",
    penalty: "Штраф",
    salaryConfigTitle: "Настройки зарплаты",
    recalc: "Пересчитать",
    approve: "Утвердить",
    markPaid: "Выплачено",
    markPaidTitle: "Отметить зарплату выплаченной",
    markPaidMessage: (name: string, amount: string) =>
      `${name} — ${amount}. Эта сумма автоматически добавится в расходы («Зарплата»), и выплату больше нельзя будет изменить.`,
    invalidValues: "Введены некорректные значения.",
    salaryConfigSaved: "Настройки зарплаты сохранены.",
    saveError: "Не удалось сохранить.",
    sumOfParts: "выплачивается сумма частей",
    fixedLabel: "Фиксированная зарплата (so'm)",
    fixedHint: "Постоянная сумма каждый месяц. Пусто — нет.",
    percentLabel: "Процент от дохода групп (%)",
    percentHint: "Доля от денег своих групп. Пусто — нет.",
    perLessonLabel: "За каждое занятие (so'm)",
    perLessonHint: "Умножается на число проведённых занятий по посещаемости. Пусто — нет.",
    cancel: "Отмена",
    save: "Сохранить",
    payoutApproved: "Зарплата утверждена.",
    approveTitle: "Утвердить зарплату",
    calculatedLabel: "рассчитано:",
    adjustmentLabel: "Бонус (+) / Штраф (−)",
    noteRequired: "Комментарий (обязательно)",
    noteOptional: "Комментарий (необязательно)",
    finalLabel: "Итог:",
  },
};

/**
 * Payroll board: live per-teacher calculation from attendance + payments,
 * approve (persists the payout), then mark paid (creates the salary expense).
 * Amounts are always recomputed server-side — the client never sends them.
 */
export default function PayrollTab({ monthKey, monthLabel, onShiftMonth, onExpensesChanged }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [result, setResult] = useState<CalculatePayrollResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [configTarget, setConfigTarget] = useState<PayrollRow | null>(null);
  const [approveTarget, setApproveTarget] = useState<PayrollRow | null>(null);
  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    if (!q) return result.rows;
    return result.rows.filter((r) => r.teacherName.toLowerCase().includes(q));
  }, [result, search]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await calculatePayrollApi(monthKey));
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

  const breakdownLine = (r: PayrollRow) => {
    const parts: string[] = [];
    if (r.breakdown.fixed > 0) parts.push(t.fixedPart(formatUZS(r.breakdown.fixed)));
    if (r.breakdown.percent.rate > 0) {
      const baseLabel = r.breakdown.percent.base === "collected" ? t.percentBaseCollected : t.percentBaseCharged;
      parts.push(
        `${r.breakdown.percent.rate}% (${baseLabel} ${formatUZS(r.breakdown.percent.baseAmount)}) = ${formatUZS(r.breakdown.percent.amount)}`
      );
    }
    if (r.breakdown.perLesson.rate > 0) {
      parts.push(
        t.lessonsPart(r.breakdown.perLesson.count, formatUZS(r.breakdown.perLesson.rate), formatUZS(r.breakdown.perLesson.amount))
      );
    }
    return parts.length ? parts.join(" + ") : t.salaryNotConfigured;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        {result && (
          <p className="text-[12.5px] text-on-surface-variant">
            {t.percentBaseLabel}{" "}
            <span className="font-bold text-on-surface">
              {result.percentBase === "collected" ? t.percentBaseValueCollected : t.percentBaseValueCharged}
            </span>{" "}
            {t.percentBaseHint}
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !result || result.rows.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState
            icon={<Users />}
            title={t.emptyTitle}
            description={t.emptyDesc}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {result.rows.length > 5 && (
            <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
          )}
          {filteredRows.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
              <EmptyState
                icon={<Search />}
                title={t.emptySearchTitle}
                description={t.emptySearchDesc}
              />
            </div>
          )}
          {filteredRows.map((r) => {
            const paid = r.payout?.status === "paid";
            const approved = r.payout?.status === "approved";
            return (
              <div key={r.teacherId} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                      paid ? "bg-success-container text-on-success-container" : "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    {initialsOf(r.teacherName)}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-semibold text-on-surface">{r.teacherName}</p>
                      {paid && (
                        <StatusChip tone="success" noDot>
                          <BadgeCheck size={11} /> {t.paidChip}
                        </StatusChip>
                      )}
                      {approved && (
                        <StatusChip tone="info" noDot>
                          {t.approvedChip}
                        </StatusChip>
                      )}
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
                        <button
                          onClick={() => setConfigTarget(r)}
                          title={t.salaryConfigTitle}
                          className="w-9 h-9 rounded-full border border-outline-variant hover:border-primary hover:text-primary text-on-surface-variant flex items-center justify-center transition-colors"
                        >
                          <Settings2 size={14} />
                        </button>
                      )}
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

      {configTarget && (
        <SalaryConfigModal
          row={configTarget}
          onClose={() => setConfigTarget(null)}
          onDone={() => {
            setConfigTarget(null);
            reload();
          }}
        />
      )}
      {approveTarget && (
        <ApprovePayoutModal
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
          message={t.markPaidMessage(payTarget.teacherName, formatUZS(payTarget.payout.finalAmount))}
          confirmLabel={t.markPaid}
          isLoading={paying}
          onConfirm={markPaid}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

function SalaryConfigModal({ row, onClose, onDone }: { row: PayrollRow; onClose: () => void; onDone: () => void }) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [fixed, setFixed] = useState(row.config.fixed ? String(row.config.fixed) : "");
  const [percent, setPercent] = useState(row.config.percent ? String(row.config.percent) : "");
  const [perLesson, setPerLesson] = useState(row.config.perLesson ? String(row.config.perLesson) : "");
  const [submitting, setSubmitting] = useState(false);

  const parseOrNull = (s: string) => {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };

  const submit = async () => {
    if (submitting) return;
    const f = parseOrNull(fixed);
    const p = parseOrNull(percent);
    const l = parseOrNull(perLesson);
    if (Number.isNaN(f) || Number.isNaN(l) || Number.isNaN(p) || (typeof p === "number" && p > 100)) {
      toast.error(t.invalidValues);
      return;
    }
    setSubmitting(true);
    try {
      await saveTeacherSalaryApi(row.teacherId, { fixed: f, percent: p, perLesson: l });
      toast.success(t.salaryConfigSaved);
      onDone();
    } catch (e: any) {
      toast.error(e.message || t.saveError);
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    hint: string,
    value: string,
    set: (v: string) => void,
    placeholder: string
  ) => (
    <div>
      <p className="text-[13px] font-bold text-on-surface mb-1">{label}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <p className="text-[11.5px] text-on-surface-variant mt-1">{hint}</p>
    </div>
  );

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.salaryConfigTitle}</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">{row.teacherName} · {t.sumOfParts}</p>
        </div>
        {field(t.fixedLabel, t.fixedHint, fixed, setFixed, "2000000")}
        {field(t.percentLabel, t.percentHint, percent, setPercent, "0")}
        {field(t.perLessonLabel, t.perLessonHint, perLesson, setPerLesson, "0")}
        <div className="flex gap-3 pt-1">
          <Button variant="tonal" onClick={onClose} disabled={submitting} className="flex-1">
            {t.cancel}
          </Button>
          <Button onClick={submit} loading={submitting} className="flex-1">
            {t.save}
          </Button>
        </div>
      </div>
    </ManagerSheet>
  );
}

function ApprovePayoutModal({
  row,
  periodKey,
  onClose,
  onDone,
}: {
  row: PayrollRow;
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
      await savePayoutApi({
        teacherId: row.teacherId,
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
            {row.teacherName} · {t.calculatedLabel} <span className="font-bold">{formatUZS(row.calculatedAmount)}</span>
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
