"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Snowflake,
  X,
} from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import { getUserProfile, type UserProfile } from "@/services/userService";
import type { ClassData } from "@/hooks/useCenterClasses";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  fetchStudentPayments,
  openAmountOf,
  patchStudentFinanceApi,
} from "@/services/financeService";
import type { Charge, Payment, StudentFinanceProfile } from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { initialsOf, PAYMENT_METHOD_T, periodLabelOf, shortDateLabel } from "./financeFormat";

interface Props {
  centerId: string;
  studentId: string;
  /** Name snapshot from the list row — shown instantly while the profile loads. */
  fallbackName: string;
  classes: ClassData[];
  onClose: () => void;
  /** Close this dialog and open the payment modal preselected on the student. */
  onRecordPayment: (studentId: string) => void;
}

const T_UZ = {
  loadError: "Ma'lumotlarni yuklashda xatolik.",
  discountRange: "Chegirma 0–100% oralig'ida bo'lishi kerak.",
  discountRemoved: "Chegirma olib tashlandi.",
  discountSaved: (v: number) => `Chegirma ${v}% saqlandi — keyingi hisoblarga qo'llanadi.`,
  genericError: "Xatolik yuz berdi.",
  activated: "O'quvchi aktivlashtirildi — hisob-kitob davom etadi.",
  frozenToast: "O'quvchi muzlatildi — yangi hisoblar yaratilmaydi.",
  frozenChip: "Muzlatilgan",
  discountChip: (n: number) => `Chegirma ${n}%`,
  closeLabel: "Yopish",
  balance: "Balans",
  debt: "Qarz",
  monthly: "Oyiga to'lov",
  lastPayment: "Oxirgi to'lov:",
  noPaymentYet: "Hali to'lov qilmagan",
  discountTitle: "Chegirma foizi",
  discountDesc: "Keyingi hisob-kitoblardan boshlab qo'llanadi. 0% — chegirmani olib tashlaydi.",
  cancel: "Bekor qilish",
  save: "Saqlash",
  addDiscount: "Chegirma qo'shish",
  unfreeze: "Aktivlashtirish",
  freeze: "Muzlatish",
  groupsTitle: (n: number) => `Guruhlari · ${n} ta`,
  noGroups: "Guruhlarga qo'shilmagan",
  noPrice: "Narx belgilanmagan",
  openChargesTitle: "To'lanmagan hisoblar",
  noDebt: "Qarzi yo'q — barcha hisoblar to'langan",
  dueLabel: (date: string) => `Muddat: ${date}`,
  paidPart: (amount: string) => `to'landi ${amount}`,
  totalDebt: "Jami qarz",
  paymentsTitle: "So'nggi to'lovlar",
  noPayments: "Hali to'lovlar yo'q",
  cancelledLabel: "Bekor qilingan",
  recordPayment: "To'lov qabul qilish",
  freezeTitle: "O'quvchini muzlatish",
  freezeMessage: (name: string) =>
    `${name} muzlatiladi: keyingi hisob-kitoblarda unga yangi oylik hisob YARATILMAYDI. Mavjud qarzlari saqlanadi va to'lov qabul qilish mumkin bo'lib qoladi. Qaytib kelganda "Aktivlashtirish" bosiladi.`,
  freezeConfirm: "Muzlatish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    loadError: "Failed to load data.",
    discountRange: "The discount must be between 0 and 100%.",
    discountRemoved: "Discount removed.",
    discountSaved: (v: number) => `Discount ${v}% saved — it applies to future charges.`,
    genericError: "Something went wrong.",
    activated: "Student reactivated — billing continues.",
    frozenToast: "Student frozen — no new charges will be created.",
    frozenChip: "Frozen",
    discountChip: (n: number) => `Discount ${n}%`,
    closeLabel: "Close",
    balance: "Balance",
    debt: "Debt",
    monthly: "Monthly fee",
    lastPayment: "Last payment:",
    noPaymentYet: "No payments yet",
    discountTitle: "Discount percent",
    discountDesc: "Applies starting from the next billing run. 0% removes the discount.",
    cancel: "Cancel",
    save: "Save",
    addDiscount: "Add discount",
    unfreeze: "Reactivate",
    freeze: "Freeze",
    groupsTitle: (n: number) => `Groups · ${n}`,
    noGroups: "Not enrolled in any group",
    noPrice: "No price set",
    openChargesTitle: "Unpaid charges",
    noDebt: "No debt — all charges are paid",
    dueLabel: (date: string) => `Due: ${date}`,
    paidPart: (amount: string) => `paid ${amount}`,
    totalDebt: "Total debt",
    paymentsTitle: "Recent payments",
    noPayments: "No payments yet",
    cancelledLabel: "Cancelled",
    recordPayment: "Record payment",
    freezeTitle: "Freeze student",
    freezeMessage: (name: string) =>
      `${name} will be frozen: future billing runs will NOT create new monthly charges for them. Existing debts are kept and payments can still be recorded. When they return, press "Reactivate".`,
    freezeConfirm: "Freeze",
  },
  ru: {
    loadError: "Не удалось загрузить данные.",
    discountRange: "Скидка должна быть в диапазоне 0–100%.",
    discountRemoved: "Скидка удалена.",
    discountSaved: (v: number) => `Скидка ${v}% сохранена — применяется к следующим начислениям.`,
    genericError: "Произошла ошибка.",
    activated: "Ученик снова активен — начисления продолжаются.",
    frozenToast: "Ученик заморожен — новые начисления создаваться не будут.",
    frozenChip: "Заморожен",
    discountChip: (n: number) => `Скидка ${n}%`,
    closeLabel: "Закрыть",
    balance: "Баланс",
    debt: "Долг",
    monthly: "Оплата в месяц",
    lastPayment: "Последний платёж:",
    noPaymentYet: "Ещё не платил",
    discountTitle: "Процент скидки",
    discountDesc: "Применяется начиная со следующих начислений. 0% — убирает скидку.",
    cancel: "Отмена",
    save: "Сохранить",
    addDiscount: "Добавить скидку",
    unfreeze: "Активировать",
    freeze: "Заморозить",
    groupsTitle: (n: number) => `Группы · ${n}`,
    noGroups: "Не зачислен в группы",
    noPrice: "Цена не задана",
    openChargesTitle: "Неоплаченные начисления",
    noDebt: "Долга нет — все начисления оплачены",
    dueLabel: (date: string) => `Срок: ${date}`,
    paidPart: (amount: string) => `оплачено ${amount}`,
    totalDebt: "Общий долг",
    paymentsTitle: "Последние платежи",
    noPayments: "Платежей пока нет",
    cancelledLabel: "Отменён",
    recordPayment: "Принять платёж",
    freezeTitle: "Заморозить ученика",
    freezeMessage: (name: string) =>
      `${name} будет заморожен: при следующих начислениях новые месячные счета для него СОЗДАВАТЬСЯ НЕ БУДУТ. Существующие долги сохраняются, платежи по-прежнему можно принимать. Когда он вернётся, нажмите «Активировать».`,
    freezeConfirm: "Заморозить",
  },
};

/**
 * Full finance profile of one student: identity, balance/debt summary, groups
 * with effective monthly price, open charges, and recent payment history.
 */
export default function StudentInfoDialog({
  centerId,
  studentId,
  fallbackName,
  classes,
  onClose,
  onRecordPayment,
}: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finance, setFinance] = useState<StudentFinanceProfile | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Discount / freeze management (same API as the students-menu finance card).
  const [busy, setBusy] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const todayYear = useMemo(() => getTodayKey().slice(0, 4), []);

  // The dialog remounts per student (keyed in page.tsx), so `loading` starts true.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      getUserProfile(studentId),
      fetchStudentFinanceProfile(centerId, studentId),
      fetchStudentCharges(centerId, studentId),
      fetchStudentPayments(centerId, studentId, 30),
    ])
      .then(([prof, fin, ch, pays]) => {
        if (!mounted) return;
        setProfile(prof);
        setFinance(fin);
        setCharges(ch);
        setPayments(pays);
      })
      .catch(() => mounted && toast.error(t.loadError))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, studentId]);

  const groups = useMemo(
    () => classes.filter((c) => (c.studentIds || []).includes(studentId)),
    [classes, studentId]
  );

  /** Override beats monthlyFee AND discountPercent (types/finance.ts). */
  const effectiveFee = (c: ClassData) => {
    const override = finance?.priceOverrides?.[c.id];
    if (typeof override === "number") return override;
    const base = c.monthlyFee || 0;
    const discount = finance?.discountPercent || 0;
    return discount > 0 ? Math.round(base * (1 - discount / 100)) : base;
  };

  const openCharges = useMemo(
    () =>
      charges
        .filter((c) => c.status === "pending" || c.status === "partial")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [charges]
  );
  const totalDebt = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
  const monthlyTotal = groups.reduce((s, c) => s + effectiveFee(c), 0);
  const balance = finance?.balance ?? 0;
  const frozen = finance?.financeStatus === "frozen";
  const lastPayment = payments.find((p) => p.type === "payment" && p.status === "confirmed");

  const refreshFinance = async () => {
    setFinance(await fetchStudentFinanceProfile(centerId, studentId));
  };

  const saveDiscount = async () => {
    const v = discountInput.trim() === "" ? 0 : parseInt(discountInput, 10);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      toast.error(t.discountRange);
      return;
    }
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentId, { discountPercent: v === 0 ? null : v });
      toast.success(v === 0 ? t.discountRemoved : t.discountSaved(v));
      setEditingDiscount(false);
      await refreshFinance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.genericError);
    } finally {
      setBusy(false);
    }
  };

  const toggleFreeze = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentId, { financeStatus: frozen ? "active" : "frozen" });
      toast.success(frozen ? t.activated : t.frozenToast);
      setConfirmFreeze(false);
      await refreshFinance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.genericError);
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = (dateKey: string) =>
    dateKey.slice(0, 4) === todayYear
      ? shortDateLabel(dateKey, lang)
      : `${shortDateLabel(dateKey, lang)} ${dateKey.slice(0, 4)}`;

  const name = profile?.displayName || fallbackName;

  return (
    <>
    <ManagerSheet onClose={onClose}>
      <div className="p-5 sm:p-6">
        {/* ── Header: identity ── */}
        <div className="flex items-start gap-4">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary auth providers (Google etc.); plain <img> like the rest of the manager panel
            <img
              src={profile.photoURL}
              alt=""
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[20px] font-bold shrink-0">
              {initialsOf(name)}
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[17px] font-bold text-on-surface tracking-tight truncate">{name}</h3>
            {profile?.email && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-on-surface-variant mt-1 truncate">
                <Mail size={12} className="shrink-0" /> {profile.email}
              </p>
            )}
            {profile?.phone && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-on-surface-variant mt-0.5">
                <Phone size={12} className="shrink-0" /> {profile.phone}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {finance?.financeStatus === "frozen" && (
                <span className="px-2.5 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[11px] font-bold">
                  {t.frozenChip}
                </span>
              )}
              {(finance?.discountPercent || 0) > 0 && (
                <span className="px-2.5 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[11px] font-bold">
                  {t.discountChip(finance!.discountPercent!)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t.closeLabel}
            className="w-9 h-9 rounded-full hover:bg-state-hover text-on-surface-variant flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-14 flex justify-center text-on-surface-variant">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* ── Summary: balance / debt / monthly ── */}
            <div className="bg-surface-container-low border border-outline-variant rounded-m3-xl px-4 py-3">
              <div className="grid grid-cols-3 divide-x divide-outline-variant">
                <div className="pr-3">
                  <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.balance}</p>
                  <p
                    className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${
                      balance < 0 ? "text-error" : balance > 0 ? "text-success" : "text-on-surface"
                    }`}
                  >
                    {formatUZS(balance)}
                  </p>
                </div>
                <div className="px-3">
                  <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.debt}</p>
                  <p
                    className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${
                      totalDebt > 0 ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {formatUZS(totalDebt)}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.monthly}</p>
                  <p className="text-[13.5px] font-bold text-on-surface tabular-nums mt-0.5 truncate">
                    {formatUZS(monthlyTotal)}
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-2.5 pt-2.5 border-t border-outline-variant">
                {lastPayment ? (
                  <>
                    {t.lastPayment}{" "}
                    <span className="font-bold text-on-surface">
                      {dateLabel(lastPayment.paidAt)} · {formatUZS(lastPayment.amount)} ·{" "}
                      {PAYMENT_METHOD_T[lang][lastPayment.method] || lastPayment.method}
                    </span>
                  </>
                ) : (
                  t.noPaymentYet
                )}
              </p>
            </div>

            {/* ── Discount / freeze management ── */}
            {editingDiscount ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-4">
                <p className="text-[13.5px] font-bold text-on-surface flex items-center gap-1.5">
                  <BadgePercent size={15} className="text-tertiary" /> {t.discountTitle}
                </p>
                <p className="text-[12px] text-on-surface-variant mt-1">
                  {t.discountDesc}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[0, 5, 10, 15, 20, 50].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDiscountInput(String(v))}
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-bold border transition-colors ${
                        discountInput === String(v)
                          ? "bg-tertiary text-on-tertiary border-tertiary"
                          : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="%"
                    className="w-20 px-3 py-2.5 bg-transparent border border-outline-variant rounded-full text-[14px] font-bold text-on-surface text-center tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setEditingDiscount(false)}
                    disabled={busy}
                    className="flex-1 py-2.5 bg-surface-container hover:bg-surface-container-highest text-on-surface rounded-full text-[12.5px] font-bold transition-colors disabled:opacity-60"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={saveDiscount}
                    disabled={busy}
                    className="flex-1 py-2.5 bg-tertiary text-on-tertiary rounded-full text-[12.5px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {busy && <Loader2 size={13} className="animate-spin" />}
                    {t.save}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setDiscountInput(finance?.discountPercent ? String(finance.discountPercent) : "");
                    setEditingDiscount(true);
                  }}
                  disabled={busy}
                  className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                    (finance?.discountPercent || 0) > 0
                      ? "bg-tertiary-container text-on-tertiary-container border-transparent"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary hover:text-tertiary"
                  }`}
                >
                  <BadgePercent size={15} />
                  {finance?.discountPercent ? t.discountChip(finance.discountPercent) : t.addDiscount}
                </button>
                <button
                  onClick={() => (frozen ? toggleFreeze() : setConfirmFreeze(true))}
                  disabled={busy}
                  className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                    frozen
                      ? "bg-tertiary-container text-on-tertiary-container border-transparent"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary hover:text-tertiary"
                  }`}
                >
                  {busy && !editingDiscount ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Snowflake size={15} />
                  )}
                  {frozen ? t.unfreeze : t.freeze}
                </button>
              </div>
            )}

            {/* ── Groups ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-on-surface-variant px-1.5 mb-1.5">
                {t.groupsTitle(groups.length)}
              </h4>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
                {groups.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-on-surface-variant">{t.noGroups}</p>
                ) : (
                  groups.map((g) => {
                    const fee = effectiveFee(g);
                    const base = g.monthlyFee || 0;
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                          <GraduationCap size={18} strokeWidth={2.1} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-on-surface truncate">{g.title}</p>
                          <p className="text-[12.5px] text-on-surface-variant mt-0.5 truncate">{g.teacherName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {base === 0 && fee === 0 ? (
                            <p className="text-[12px] font-bold text-warning">{t.noPrice}</p>
                          ) : (
                            <>
                              <p className="text-[13.5px] font-bold text-on-surface tabular-nums">{formatUZS(fee)}</p>
                              {fee !== base && base > 0 && (
                                <p className="text-[11.5px] text-on-surface-variant tabular-nums line-through">
                                  {formatUZS(base)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ── Open charges ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-on-surface-variant px-1.5 mb-1.5">{t.openChargesTitle}</h4>
              {openCharges.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl py-5 px-4 flex items-center justify-center gap-2 text-success">
                  <CheckCircle2 size={16} />
                  <p className="text-[13px] font-bold">{t.noDebt}</p>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
                  {openCharges.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-on-surface truncate">
                          {periodLabelOf(c, lang)} · {c.classTitle}
                        </p>
                        <p className="text-[12px] text-on-surface-variant mt-0.5">
                          {t.dueLabel(dateLabel(c.dueDate))}
                          {c.status === "partial" && ` · ${t.paidPart(formatUZS(c.paidAmount || 0))}`}
                        </p>
                      </div>
                      <p className="text-[13.5px] font-bold text-error tabular-nums shrink-0">
                        {formatUZS(openAmountOf(c))}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-error-container">
                    <p className="text-[13px] font-bold text-on-error-container">{t.totalDebt}</p>
                    <p className="text-[14px] font-bold text-on-error-container tabular-nums">{formatUZS(totalDebt)}</p>
                  </div>
                </div>
              )}
            </section>

            {/* ── Payment history ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-on-surface-variant px-1.5 mb-1.5">{t.paymentsTitle}</h4>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
                {payments.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-on-surface-variant">{t.noPayments}</p>
                ) : (
                  payments.slice(0, 8).map((p) => {
                    const cancelled = p.status === "cancelled";
                    const isRefund = p.type === "refund";
                    const DirIcon = isRefund ? ArrowUpRight : ArrowDownLeft;
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            cancelled
                              ? "bg-surface-container-highest text-on-surface-variant"
                              : isRefund
                              ? "bg-error-container text-on-error-container"
                              : "bg-success-container text-on-success-container"
                          }`}
                        >
                          <DirIcon size={15} strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] font-semibold truncate ${
                              cancelled ? "text-on-surface-variant line-through" : "text-on-surface"
                            }`}
                          >
                            {dateLabel(p.paidAt)} · {PAYMENT_METHOD_T[lang][p.method] || p.method}
                          </p>
                          {(p.note || cancelled) && (
                            <p className="text-[11.5px] text-on-surface-variant mt-0.5 truncate">
                              {cancelled ? t.cancelledLabel : p.note}
                            </p>
                          )}
                        </div>
                        <p
                          className={`text-[13px] font-bold tabular-nums shrink-0 ${
                            cancelled ? "text-on-surface-variant line-through" : isRefund ? "text-error" : "text-success"
                          }`}
                        >
                          {isRefund ? "−" : "+"}
                          {formatUZS(p.amount)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <Button icon={<Banknote />} onClick={() => onRecordPayment(studentId)} className="w-full">
              {t.recordPayment}
            </Button>
          </div>
        )}
      </div>
    </ManagerSheet>

    {confirmFreeze && (
      <ConfirmDialog
        title={t.freezeTitle}
        message={t.freezeMessage(name)}
        confirmLabel={t.freezeConfirm}
        isLoading={busy}
        onConfirm={toggleFreeze}
        onClose={() => setConfirmFreeze(false)}
      />
    )}
    </>
  );
}
