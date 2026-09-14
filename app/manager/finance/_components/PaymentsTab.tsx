"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDownLeft, ArrowUpRight, Plus, ReceiptText, Undo2 } from "lucide-react";
import type { Payment } from "@/types/finance";
import { cancelPaymentApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { Button, EmptyState, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { dayLabelOf, PAYMENT_METHOD_T } from "./financeFormat";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

interface Props {
  payments: Payment[];
  onOpenModal: () => void;
  onChanged: () => void;
}

const T_UZ = {
  searchPlaceholder: "O'quvchini qidiring...",
  recentOps: (n: number) => `So'nggi amaliyotlar · ${n} ta`,
  opsHistory: "Amaliyotlar tarixi",
  recordPayment: "To'lov qabul qilish",
  emptySearchTitle: "Hech narsa topilmadi",
  emptyTitle: "Hali to'lovlar yo'q",
  emptySearchDesc: "Qidiruvni o'zgartirib ko'ring",
  emptyDesc: "O'quvchi pul olib kelganda «To'lov qabul qilish» tugmasini bosing",
  refundTag: "qaytarim",
  cancelledChip: "Bekor qilingan",
  cancelPaymentTitle: "To'lovni bekor qilish",
  cancelMessage: (name: string, amount: string) =>
    `${name} — ${amount}. To'lov o'chirilmaydi, "bekor qilingan" deb belgilanadi va qarzdorlik qayta hisoblanadi.`,
  cancelConfirm: "Bekor qilish",
  cancelled: "To'lov bekor qilindi.",
  genericError: "Xatolik yuz berdi.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    searchPlaceholder: "Search for a student...",
    recentOps: (n: number) => `Recent transactions · ${n}`,
    opsHistory: "Transaction history",
    recordPayment: "Record payment",
    emptySearchTitle: "Nothing found",
    emptyTitle: "No payments yet",
    emptySearchDesc: "Try changing your search",
    emptyDesc: "When a student brings money, press the “Record payment” button",
    refundTag: "refund",
    cancelledChip: "Cancelled",
    cancelPaymentTitle: "Cancel payment",
    cancelMessage: (name: string, amount: string) =>
      `${name} — ${amount}. The payment is not deleted — it is marked "cancelled" and the debt is recalculated.`,
    cancelConfirm: "Cancel payment",
    cancelled: "Payment cancelled.",
    genericError: "Something went wrong.",
  },
  ru: {
    searchPlaceholder: "Поиск ученика...",
    recentOps: (n: number) => `Последние операции · ${n}`,
    opsHistory: "История операций",
    recordPayment: "Принять платёж",
    emptySearchTitle: "Ничего не найдено",
    emptyTitle: "Платежей пока нет",
    emptySearchDesc: "Попробуйте изменить запрос",
    emptyDesc: "Когда ученик приносит деньги, нажмите кнопку «Принять платёж»",
    refundTag: "возврат",
    cancelledChip: "Отменён",
    cancelPaymentTitle: "Отменить платёж",
    cancelMessage: (name: string, amount: string) =>
      `${name} — ${amount}. Платёж не удаляется — он помечается как «отменён», и задолженность пересчитывается.`,
    cancelConfirm: "Отменить",
    cancelled: "Платёж отменён.",
    genericError: "Произошла ошибка.",
  },
};

/** Recent payments feed (grouped by day, MD3 list items) + entry point for recording a new one. */
export default function PaymentsTab({ payments, onOpenModal, onChanged }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const todayKey = useMemo(() => getTodayKey(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) => p.studentName.toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  /** Day groups (newest first); each keeps the feed's original in-day order. */
  const dayGroups = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of filtered) {
      const arr = map.get(p.paidAt);
      if (arr) arr.push(p);
      else map.set(p.paidAt, [p]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const dayTotal = (items: Payment[]) =>
    items
      .filter((p) => p.status !== "cancelled")
      .reduce((s, p) => s + (p.type === "refund" ? -p.amount : p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {payments.length > 5 ? (
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        ) : (
          <p className="text-[13px] text-on-surface-variant">
            {payments.length > 0 ? t.recentOps(payments.length) : t.opsHistory}
          </p>
        )}
        <Button icon={<Plus />} onClick={onOpenModal}>
          {t.recordPayment}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState
            icon={<ReceiptText />}
            title={search ? t.emptySearchTitle : t.emptyTitle}
            description={search ? t.emptySearchDesc : t.emptyDesc}
          />
        </div>
      ) : (
        dayGroups.map(([dateKey, items]) => {
          const total = dayTotal(items);
          return (
            <section key={dateKey}>
              <div className="flex items-baseline justify-between px-1.5 mb-1.5">
                <h3 className="text-[12.5px] font-bold text-on-surface-variant">{dayLabelOf(dateKey, todayKey, lang)}</h3>
                <p
                  className={`text-[12px] font-bold tabular-nums ${
                    total >= 0 ? "text-success" : "text-error"
                  }`}
                >
                  {total >= 0 ? "+" : "−"}
                  {formatUZS(Math.abs(total))}
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
                {items.map((p) => {
                  const cancelled = p.status === "cancelled";
                  const isRefund = p.type === "refund";
                  const DirIcon = isRefund ? ArrowUpRight : ArrowDownLeft;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-state-hover transition-colors">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          cancelled
                            ? "bg-surface-container-highest text-on-surface-variant"
                            : isRefund
                            ? "bg-error-container text-on-error-container"
                            : "bg-success-container text-on-success-container"
                        }`}
                      >
                        <DirIcon size={18} strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[14.5px] font-semibold truncate ${
                            cancelled ? "text-on-surface-variant line-through" : "text-on-surface"
                          }`}
                        >
                          {p.studentName}
                        </p>
                        <p className="text-[12.5px] text-on-surface-variant mt-0.5 truncate">
                          {PAYMENT_METHOD_T[lang][p.method] || p.method}
                          {isRefund && ` · ${t.refundTag}`}
                          {p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      {cancelled && (
                        <StatusChip tone="muted" noDot className="shrink-0">
                          {t.cancelledChip}
                        </StatusChip>
                      )}
                      <p
                        className={`text-[14.5px] font-bold tabular-nums shrink-0 ${
                          cancelled ? "text-on-surface-variant line-through" : isRefund ? "text-error" : "text-success"
                        }`}
                      >
                        {isRefund ? "−" : "+"}
                        {formatUZS(p.amount)}
                      </p>
                      {!cancelled && (
                        <button
                          onClick={() => setCancelTarget(p)}
                          title={t.cancelPaymentTitle}
                          className="w-9 h-9 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors shrink-0"
                        >
                          <Undo2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {cancelTarget && (
        <ReasonDialog
          title={t.cancelPaymentTitle}
          message={t.cancelMessage(cancelTarget.studentName, formatUZS(cancelTarget.amount))}
          confirmLabel={t.cancelConfirm}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelPaymentApi(cancelTarget.id, reason);
              toast.success(t.cancelled);
              setCancelTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || t.genericError);
            }
          }}
        />
      )}
    </div>
  );
}
