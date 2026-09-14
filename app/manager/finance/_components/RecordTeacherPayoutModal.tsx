"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, ChevronLeft, Loader2, Search } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import type { CenterTeacher } from "@/hooks/useCenterClasses";
import { calculatePayrollApi, markPayoutPaidApi, savePayoutApi } from "@/services/financeService";
import type { CalculatePayrollResult, PayrollRow } from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { Button, EmptyState, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { initialsOf, shortDateLabel } from "./financeFormat";

interface Props {
  teachers: CenterTeacher[];
  monthKey: string;
  onClose: () => void;
  onDone: () => void;
}

const T_UZ = {
  recordPayment: "To'lov qabul qilish",
  searchPlaceholder: "O'qituvchini qidiring...",
  teacherNotFound: "O'qituvchi topilmadi",
  emptyTitle: "Markazda o'qituvchilar yo'q",
  calcError: "Oylikni hisoblashda xatolik.",
  saveError: "To'lovni saqlashda xatolik.",
  salaryNotConfigured: "Oylik sozlanmagan",
  fixedPart: (amount: string) => `Fiks ${amount}`,
  percentBaseCollected: "tushumdan",
  percentBaseCharged: "hisoblanganidan",
  lessonsPart: (count: number, rate: string, amount: string) => `${count} dars × ${rate} = ${amount}`,
  calculatedLabel: "Hisoblangan:",
  adjustmentLabel: "Bonus (+) / Jarima (−)",
  noteRequired: "Izoh (majburiy)",
  noteOptional: "Izoh (ixtiyoriy)",
  finalLabel: "Yakuniy:",
  payButton: "To'lash",
  approvedChip: "Tasdiqlangan",
  alreadyPaidTitle: "Bu oy uchun to'langan",
  paidOnLabel: "To'langan sana:",
  close: "Yopish",
  confirmPayTitle: "Oylikni to'lash",
  confirmPayMessage: (name: string, amount: string) =>
    `${name} — ${amount}. Bu summa xarajatlarga ("Oylik") avtomatik qo'shiladi va keyinchalik o'zgartirib bo'lmaydi.`,
  paymentDone: "Oylik to'landi",
  addedToExpenses: "Xarajatlarga (\"Oylik\") qo'shildi.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    recordPayment: "Record payment",
    searchPlaceholder: "Search for a teacher...",
    teacherNotFound: "No teachers found",
    emptyTitle: "No teachers in the center",
    calcError: "Failed to calculate salary.",
    saveError: "Failed to save the payment.",
    salaryNotConfigured: "Salary not configured",
    fixedPart: (amount: string) => `Fixed ${amount}`,
    percentBaseCollected: "of collected",
    percentBaseCharged: "of charged",
    lessonsPart: (count: number, rate: string, amount: string) => `${count} lessons × ${rate} = ${amount}`,
    calculatedLabel: "Calculated:",
    adjustmentLabel: "Bonus (+) / Penalty (−)",
    noteRequired: "Note (required)",
    noteOptional: "Note (optional)",
    finalLabel: "Final:",
    payButton: "Pay",
    approvedChip: "Approved",
    alreadyPaidTitle: "Already paid this month",
    paidOnLabel: "Paid on:",
    close: "Close",
    confirmPayTitle: "Pay salary",
    confirmPayMessage: (name: string, amount: string) =>
      `${name} — ${amount}. This amount is automatically added to expenses ("Salary") and cannot be changed afterward.`,
    paymentDone: "Salary paid",
    addedToExpenses: "Added to expenses (\"Salary\").",
  },
  ru: {
    recordPayment: "Принять платёж",
    searchPlaceholder: "Поиск учителя...",
    teacherNotFound: "Учитель не найден",
    emptyTitle: "В центре нет учителей",
    calcError: "Не удалось рассчитать зарплату.",
    saveError: "Не удалось сохранить платёж.",
    salaryNotConfigured: "Зарплата не настроена",
    fixedPart: (amount: string) => `Фикс ${amount}`,
    percentBaseCollected: "от поступлений",
    percentBaseCharged: "от начислений",
    lessonsPart: (count: number, rate: string, amount: string) => `${count} занятий × ${rate} = ${amount}`,
    calculatedLabel: "Рассчитано:",
    adjustmentLabel: "Бонус (+) / Штраф (−)",
    noteRequired: "Комментарий (обязательно)",
    noteOptional: "Комментарий (необязательно)",
    finalLabel: "Итог:",
    payButton: "Оплатить",
    approvedChip: "Утверждено",
    alreadyPaidTitle: "В этом месяце уже выплачено",
    paidOnLabel: "Дата выплаты:",
    close: "Закрыть",
    confirmPayTitle: "Выплатить зарплату",
    confirmPayMessage: (name: string, amount: string) =>
      `${name} — ${amount}. Эта сумма автоматически добавится в расходы («Зарплата») и её больше нельзя будет изменить.`,
    paymentDone: "Зарплата выплачена",
    addedToExpenses: "Добавлено в расходы («Зарплата»).",
  },
};

/**
 * Teacher side of "To'lov qabul qilish": search a teacher → see their live
 * current-month payroll (same calculation as the Oyliklar tab) → pay it.
 * Reuses the existing approve (savePayout) + mark-paid (markPayoutPaid) APIs
 * unchanged — this is a shortcut into the payroll cycle, not a parallel one.
 */
export default function RecordTeacherPayoutModal({ teachers, monthKey, onClose, onDone }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CenterTeacher | null>(null);

  const [payroll, setPayroll] = useState<CalculatePayrollResult | null>(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  const [adjustment, setAdjustment] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ amount: number } | null>(null);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers.slice(0, 30);
    return teachers
      .filter((tc) => tc.teacherName.toLowerCase().includes(q) || (tc.teacherEmail || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [teachers, search]);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    setLoadingPayroll(true);
    calculatePayrollApi(monthKey)
      .then((res) => mounted && setPayroll(res))
      .catch(() => mounted && toast.error(t.calcError))
      .finally(() => mounted && setLoadingPayroll(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, monthKey]);

  const row: PayrollRow | null = useMemo(() => {
    if (!selected || !payroll) return null;
    return payroll.rows.find((r) => r.teacherId === selected.teacherId) || null;
  }, [selected, payroll]);

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

  const adj = adjustment.trim() === "" ? 0 : parseInt(adjustment, 10);
  const adjustable = !!row && !row.payout;
  const adjustmentValid = !adjustable || (Number.isInteger(adj) && (adj === 0 || note.trim().length > 0));
  const finalAmount = row ? (row.payout ? row.payout.finalAmount : row.calculatedAmount + (Number.isInteger(adj) ? adj : 0)) : 0;
  const canSubmit = !!row && row.payout?.status !== "paid" && adjustmentValid && finalAmount >= 0;

  const submit = async () => {
    if (!selected || !row || submitting) return;
    setSubmitting(true);
    try {
      let payoutId = row.payout?.id;
      let paidAmount = row.payout?.finalAmount ?? finalAmount;
      if (!row.payout) {
        await savePayoutApi({
          teacherId: selected.teacherId,
          periodKey: monthKey,
          adjustment: adj,
          ...(note.trim() ? { adjustmentNote: note.trim() } : {}),
        });
        const fresh = await calculatePayrollApi(monthKey);
        const freshRow = fresh.rows.find((r) => r.teacherId === selected.teacherId);
        if (!freshRow?.payout) throw new Error(t.saveError);
        payoutId = freshRow.payout.id;
        paidAmount = freshRow.payout.finalAmount;
      }
      await markPayoutPaidApi(payoutId!);
      setResult({ amount: paidAmount });
      setConfirming(false);
    } catch (e: any) {
      toast.error(e.message || t.saveError);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success view ──
  if (result && selected) {
    return (
      <ManagerSheet onClose={onDone}>
        <div className="p-6 sm:p-7 text-center">
          <div className="w-14 h-14 rounded-m3-lg bg-success-container text-on-success-container flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-lg font-bold text-on-surface">{t.paymentDone}</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {selected.teacherName} · {formatUZS(result.amount)}
          </p>
          <p className="text-[13px] text-on-surface-variant mt-4">{t.addedToExpenses}</p>
          <Button onClick={onDone} className="mt-5 w-full">
            {t.close}
          </Button>
        </div>
      </ManagerSheet>
    );
  }

  return (
    <>
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-5 sm:p-6">
        {/* ── Step 1: pick a teacher ── */}
        {!selected ? (
          <>
            <h3 className="text-lg font-bold text-on-surface tracking-tight mb-3">{t.recordPayment}</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mt-3 max-h-[45dvh] overflow-y-auto space-y-1">
              {teachers.length === 0 ? (
                <EmptyState icon={<Search />} title={t.emptyTitle} />
              ) : filteredTeachers.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">{t.teacherNotFound}</p>
              ) : (
                filteredTeachers.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setSelected(tc)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-m3-md hover:bg-state-hover transition-colors text-left"
                  >
                    {tc.teacherPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary auth providers (Google etc.); plain <img> like the rest of the manager panel
                      <img src={tc.teacherPhoto} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center text-[12px] font-bold">
                        {initialsOf(tc.teacherName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{tc.teacherName}</p>
                      {tc.teacherEmail && <p className="text-[12px] text-on-surface-variant truncate">{tc.teacherEmail}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* ── Step 2: this month's payroll + pay ── */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setSelected(null);
                  setPayroll(null);
                  setAdjustment("");
                  setNote("");
                }}
                className="w-8 h-8 rounded-m3-sm hover:bg-state-hover flex items-center justify-center text-on-surface-variant"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-on-surface truncate">{selected.teacherName}</h3>
                {row?.payout?.status === "approved" && (
                  <StatusChip tone="info" noDot className="mt-0.5">
                    {t.approvedChip}
                  </StatusChip>
                )}
              </div>
            </div>

            {loadingPayroll || !row ? (
              <div className="py-10 flex justify-center text-on-surface-variant">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : row.payout?.status === "paid" ? (
              <div className="space-y-4">
                <div className="bg-success-container text-on-success-container rounded-m3-lg p-4 text-center">
                  <p className="text-[15px] font-bold">{t.alreadyPaidTitle}</p>
                  <p className="text-lg font-bold tabular-nums mt-1">{formatUZS(row.payout.finalAmount)}</p>
                  {row.payout.paidAt && (
                    <p className="text-[12.5px] mt-1">
                      {t.paidOnLabel} {shortDateLabel(row.payout.paidAt, lang)}
                    </p>
                  )}
                </div>
                <Button onClick={onClose} variant="tonal" className="w-full">
                  {t.close}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-surface-container rounded-m3-lg p-3.5">
                  <p className="text-[13px] text-on-surface-variant">{breakdownLine(row)}</p>
                </div>

                {adjustable && (
                  <>
                    <div>
                      <p className="text-[13px] font-bold text-on-surface mb-1">{t.adjustmentLabel}</p>
                      <input
                        type="number"
                        inputMode="numeric"
                        step={1000}
                        value={adjustment}
                        onChange={(e) => setAdjustment(e.target.value)}
                        placeholder="0"
                        className="w-full px-3.5 py-3 bg-transparent border border-outline-variant rounded-m3-md text-[16px] font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={adj !== 0 ? t.noteRequired : t.noteOptional}
                      className="w-full px-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-sm text-on-surface-variant">
                      {t.calculatedLabel} <span className="font-bold text-on-surface">{formatUZS(row.calculatedAmount)}</span>
                    </p>
                  </>
                )}

                <p className="text-sm text-on-surface-variant">
                  {t.finalLabel}{" "}
                  <span className={`font-bold ${finalAmount < 0 ? "text-error" : "text-on-surface"}`}>{formatUZS(finalAmount)}</span>
                </p>

                <Button onClick={() => setConfirming(true)} disabled={!canSubmit} className="w-full">
                  {t.payButton} · {formatUZS(finalAmount)}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ManagerSheet>

    {confirming && row && selected && (
      <ConfirmDialog
        title={t.confirmPayTitle}
        message={t.confirmPayMessage(selected.teacherName, formatUZS(finalAmount))}
        confirmLabel={t.payButton}
        isLoading={submitting}
        onConfirm={submit}
        onClose={() => !submitting && setConfirming(false)}
      />
    )}
    </>
  );
}
