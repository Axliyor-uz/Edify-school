"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BadgePercent, Loader2, Snowflake, Wallet } from "lucide-react";
import type { Charge, Payment, StudentFinanceProfile } from "@/types/finance";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  fetchStudentPayments,
  patchStudentFinanceApi,
} from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { CHARGE_STATUS_T, PAYMENT_METHOD_T, periodLabelOf, shortDateLabel } from "./financeFormat";

interface Props {
  centerId: string;
  studentUid: string;
}

const T_UZ = {
  activated: "O'quvchi aktivlashtirildi.",
  frozenToast: "O'quvchi muzlatildi — yangi hisoblar yaratilmaydi.",
  genericError: "Xatolik yuz berdi.",
  discountRange: "Chegirma 0–100% oralig'ida bo'lishi kerak.",
  discountSaved: "Chegirma saqlandi. Keyingi hisoblarga qo'llanadi.",
  sectionTitle: "Moliya",
  balance: "Balans",
  unfreeze: "Muzlatilgan — aktivlashtirish",
  freeze: "Muzlatish",
  ok: "OK",
  cancelShort: "Bekor",
  discount: (n: number) => `Chegirma ${n}%`,
  addDiscount: "Chegirma qo'shish",
  chargesTitle: "Hisoblar",
  noCharges: "Hisoblar hali yaratilmagan.",
  paymentsTitle: "So'nggi to'lovlar",
  noPayments: "To'lovlar yo'q.",
  refundTag: "qaytarim",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    activated: "Student reactivated.",
    frozenToast: "Student frozen — no new charges will be created.",
    genericError: "Something went wrong.",
    discountRange: "The discount must be between 0 and 100%.",
    discountSaved: "Discount saved. It applies to future charges.",
    sectionTitle: "Finance",
    balance: "Balance",
    unfreeze: "Frozen — reactivate",
    freeze: "Freeze",
    ok: "OK",
    cancelShort: "Cancel",
    discount: (n: number) => `Discount ${n}%`,
    addDiscount: "Add discount",
    chargesTitle: "Charges",
    noCharges: "No charges have been created yet.",
    paymentsTitle: "Recent payments",
    noPayments: "No payments.",
    refundTag: "refund",
  },
  ru: {
    activated: "Ученик снова активен.",
    frozenToast: "Ученик заморожен — новые начисления создаваться не будут.",
    genericError: "Произошла ошибка.",
    discountRange: "Скидка должна быть в диапазоне 0–100%.",
    discountSaved: "Скидка сохранена. Применяется к следующим начислениям.",
    sectionTitle: "Финансы",
    balance: "Баланс",
    unfreeze: "Заморожен — активировать",
    freeze: "Заморозить",
    ok: "OK",
    cancelShort: "Отмена",
    discount: (n: number) => `Скидка ${n}%`,
    addDiscount: "Добавить скидку",
    chargesTitle: "Начисления",
    noCharges: "Начисления ещё не созданы.",
    paymentsTitle: "Последние платежи",
    noPayments: "Платежей нет.",
    refundTag: "возврат",
  },
};

const STATUS_CLS: Record<string, string> = {
  pending: "bg-error-container text-on-error-container",
  partial: "bg-warning-container text-on-warning-container",
  paid: "bg-success-container text-on-success-container",
  waived: "bg-tertiary-container text-on-tertiary-container",
  cancelled: "bg-surface-container-highest text-on-surface-variant",
};

/**
 * Finance card inside ManagerStudentInfoPanel: balance, freeze, discount,
 * recent charges + payments. Read-mostly; mutations go through the finance API.
 */
export default function StudentFinanceSection({ centerId, studentUid }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  const reload = useCallback(async () => {
    try {
      const [prof, ch, pay] = await Promise.all([
        fetchStudentFinanceProfile(centerId, studentUid),
        fetchStudentCharges(centerId, studentUid),
        fetchStudentPayments(centerId, studentUid, 5),
      ]);
      setProfile(prof);
      setCharges(ch.slice(0, 8));
      setPayments(pay);
    } catch (err) {
      console.error("Student finance load error:", err);
    } finally {
      setLoading(false);
    }
  }, [centerId, studentUid]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const frozen = profile?.financeStatus === "frozen";
  const balance = profile?.balance ?? 0;

  const toggleFreeze = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentUid, { financeStatus: frozen ? "active" : "frozen" });
      toast.success(frozen ? t.activated : t.frozenToast);
      await reload();
    } catch (e: any) {
      toast.error(e.message || t.genericError);
    } finally {
      setBusy(false);
    }
  };

  const saveDiscount = async () => {
    const v = discountInput.trim() === "" ? 0 : parseInt(discountInput, 10);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      toast.error(t.discountRange);
      return;
    }
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentUid, { discountPercent: v === 0 ? null : v });
      toast.success(t.discountSaved);
      setEditingDiscount(false);
      await reload();
    } catch (e: any) {
      toast.error(e.message || t.genericError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest p-6 rounded-m3-xl shadow-elev-1 border border-outline-variant">
      <h3 className="text-[12px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-1.5">
        <Wallet size={14} /> {t.sectionTitle}
      </h3>

      {loading ? (
        <div className="flex justify-center py-8 text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Balance + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-4 py-3 rounded-m3-md ${
                balance < 0 ? "bg-error-container" : "bg-success-container"
              }`}
            >
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  balance < 0 ? "text-on-error-container" : "text-on-success-container"
                }`}
              >
                {t.balance}
              </p>
              <p
                className={`text-[16px] font-black tabular-nums ${
                  balance < 0 ? "text-on-error-container" : "text-on-success-container"
                }`}
              >
                {formatUZS(balance)}
              </p>
            </div>

            <button
              onClick={toggleFreeze}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-m3-md text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                frozen
                  ? "bg-tertiary-container text-on-tertiary-container border-transparent"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
              }`}
            >
              <Snowflake size={14} />
              {frozen ? t.unfreeze : t.freeze}
            </button>

            {editingDiscount ? (
              <div className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="%"
                  className="w-16 px-2.5 py-2 bg-transparent border border-outline-variant rounded-m3-md text-[13px] font-bold text-on-surface text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={saveDiscount}
                  disabled={busy}
                  className="px-3 py-2 bg-primary text-on-primary rounded-m3-md text-[12px] font-bold disabled:opacity-50"
                >
                  {t.ok}
                </button>
                <button
                  onClick={() => setEditingDiscount(false)}
                  className="px-2 py-2 text-on-surface-variant text-[12px] font-bold"
                >
                  {t.cancelShort}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDiscountInput(profile?.discountPercent ? String(profile.discountPercent) : "");
                  setEditingDiscount(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-m3-md text-[12.5px] font-bold border bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary transition-colors"
              >
                <BadgePercent size={14} />
                {profile?.discountPercent ? t.discount(profile.discountPercent) : t.addDiscount}
              </button>
            )}
          </div>

          {/* Charges history */}
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t.chargesTitle}</p>
            {charges.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">{t.noCharges}</p>
            ) : (
              <div className="space-y-1">
                {charges.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[12.5px] py-1">
                    <span className="text-on-surface-variant truncate flex-1">
                      {periodLabelOf(c, lang)} · {c.classTitle}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${STATUS_CLS[c.status]}`}>
                      {CHARGE_STATUS_T[lang][c.status]}
                    </span>
                    <span className="font-bold text-on-surface tabular-nums shrink-0">{formatUZS(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent payments */}
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t.paymentsTitle}</p>
            {payments.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">{t.noPayments}</p>
            ) : (
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-[12.5px] py-1">
                    <span className={`truncate flex-1 ${p.status === "cancelled" ? "text-on-surface-variant line-through" : "text-on-surface-variant"}`}>
                      {shortDateLabel(p.paidAt, lang)} · {PAYMENT_METHOD_T[lang][p.method] || p.method}
                      {p.type === "refund" && ` · ${t.refundTag}`}
                    </span>
                    <span
                      className={`font-bold tabular-nums shrink-0 ${
                        p.status === "cancelled" ? "text-on-surface-variant line-through" : p.type === "refund" ? "text-error" : "text-success"
                      }`}
                    >
                      {p.type === "refund" ? "−" : "+"}
                      {formatUZS(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
