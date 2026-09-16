"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgePercent, CheckCircle2, ChevronLeft, Loader2, Search, Snowflake } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import { buildCenterRoster, type RosterStudent } from "@/services/checkInService";
import type { ClassData } from "@/hooks/useCenterClasses";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  openAmountOf,
  recordPaymentApi,
} from "@/services/financeService";
import type {
  Charge,
  PaymentType,
  RecordPaymentResult,
  StudentFinanceProfile,
} from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { formatMethodSplit, periodLabelOf } from "./financeFormat";
import MethodSplitEditor, {
  methodSplitPayload,
  methodSplitValid,
  singleSplitLine,
  type MethodSplitLine,
} from "./MethodSplitEditor";

interface Props {
  centerId: string;
  classes: ClassData[];
  preselectUid?: string | null;
  onClose: () => void;
  onDone: () => void;
}

const T_UZ = {
  loadError: "Ma'lumotlarni yuklashda xatolik.",
  refundNoteRequired: "Qaytarim uchun izoh majburiy.",
  saveError: "To'lovni saqlashda xatolik.",
  paymentAccepted: "To'lov qabul qilindi",
  refundSaved: "Qaytarim saqlandi",
  avansLine: "Avans (keyingi oylarga)",
  newBalance: "Yangi balans:",
  close: "Yopish",
  recordPayment: "To'lov qabul qilish",
  searchPlaceholder: "O'quvchini qidiring...",
  studentNotFound: "O'quvchi topilmadi",
  balance: "Balans:",
  discount: (n: number) => `Chegirma ${n}%`,
  frozen: "Muzlatilgan",
  totalDebt: "Jami qarz",
  typePayment: "To'lov",
  typeRefund: "Qaytarim",
  amountPlaceholder: "Summa (so'm)",
  noteRequired: "Izoh (majburiy)",
  noteOptional: "Izoh (ixtiyoriy)",
  submitPayment: "To'lovni qabul qilish",
  submitRefund: "Qaytarimni saqlash",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    loadError: "Failed to load data.",
    refundNoteRequired: "A note is required for a refund.",
    saveError: "Failed to save the payment.",
    paymentAccepted: "Payment recorded",
    refundSaved: "Refund saved",
    avansLine: "Prepaid (toward future months)",
    newBalance: "New balance:",
    close: "Close",
    recordPayment: "Record payment",
    searchPlaceholder: "Search for a student...",
    studentNotFound: "No students found",
    balance: "Balance:",
    discount: (n: number) => `Discount ${n}%`,
    frozen: "Frozen",
    totalDebt: "Total debt",
    typePayment: "Payment",
    typeRefund: "Refund",
    amountPlaceholder: "Amount (so'm)",
    noteRequired: "Note (required)",
    noteOptional: "Note (optional)",
    submitPayment: "Record payment",
    submitRefund: "Save refund",
  },
  ru: {
    loadError: "Не удалось загрузить данные.",
    refundNoteRequired: "Для возврата комментарий обязателен.",
    saveError: "Не удалось сохранить платёж.",
    paymentAccepted: "Платёж принят",
    refundSaved: "Возврат сохранён",
    avansLine: "Аванс (в счёт будущих месяцев)",
    newBalance: "Новый баланс:",
    close: "Закрыть",
    recordPayment: "Принять платёж",
    searchPlaceholder: "Поиск ученика...",
    studentNotFound: "Ученик не найден",
    balance: "Баланс:",
    discount: (n: number) => `Скидка ${n}%`,
    frozen: "Заморожен",
    totalDebt: "Общий долг",
    typePayment: "Платёж",
    typeRefund: "Возврат",
    amountPlaceholder: "Сумма (so'm)",
    noteRequired: "Комментарий (обязательно)",
    noteOptional: "Комментарий (необязательно)",
    submitPayment: "Принять платёж",
    submitRefund: "Сохранить возврат",
  },
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Search a student → see their open charges → enter amount+method → done in ~5s. */
export default function RecordPaymentModal({ centerId, classes, preselectUid, onClose, onDone }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RosterStudent | null>(null);

  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [amount, setAmount] = useState("");
  const [methodLines, setMethodLines] = useState<MethodSplitLine[]>(singleSplitLine());
  const [type, setType] = useState<PaymentType>("payment");
  const [paidAt, setPaidAt] = useState(todayKey);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecordPaymentResult | null>(null);

  useEffect(() => {
    let mounted = true;
    buildCenterRoster(classes).then((r) => {
      if (!mounted) return;
      setRoster(r);
      if (preselectUid) {
        const hit = r.find((s) => s.uid === preselectUid);
        if (hit) setSelected(hit);
      }
    });
    return () => {
      mounted = false;
    };
  }, [classes, preselectUid]);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    setLoadingStudent(true);
    Promise.all([
      fetchStudentFinanceProfile(centerId, selected.uid),
      fetchStudentCharges(centerId, selected.uid),
    ])
      .then(([prof, charges]) => {
        if (!mounted) return;
        setProfile(prof);
        setOpenCharges(
          charges
            .filter((c) => c.status === "pending" || c.status === "partial")
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        );
      })
      .catch(() => mounted && toast.error(t.loadError))
      .finally(() => mounted && setLoadingStudent(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, selected]);

  const filteredRoster = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roster.slice(0, 30);
    return roster
      .filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q)
      )
      .slice(0, 30);
  }, [roster, search]);

  const totalDebt = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
  const parsedAmount = parseInt(amount, 10);
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount > 0;
  const splitValid = methodSplitValid(methodLines, parsedAmount);
  const canSubmit = amountValid && splitValid;

  const submit = async () => {
    if (!selected || !canSubmit || submitting) return;
    if (type === "refund" && !note.trim()) {
      toast.error(t.refundNoteRequired);
      return;
    }
    setSubmitting(true);
    try {
      const res = await recordPaymentApi({
        studentId: selected.uid,
        amount: parsedAmount,
        type,
        method: methodLines[0].method,
        ...(methodLines.length > 1 ? { methodSplit: methodSplitPayload(methodLines) } : {}),
        ...(paidAt !== todayKey ? { paidAt } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e.message || t.saveError);
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
          <h3 className="text-lg font-bold text-on-surface">
            {type === "payment" ? t.paymentAccepted : t.refundSaved}
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {selected.displayName} · {formatUZS(parsedAmount)}
          </p>
          {methodLines.length > 1 && (
            <p className="text-[12.5px] text-on-surface-variant mt-0.5">
              {formatMethodSplit({ methodSplit: methodSplitPayload(methodLines) }, lang)}
            </p>
          )}

          {result.allocations.length > 0 && (
            <div className="mt-4 bg-surface-container-low border border-outline-variant rounded-m3-lg p-4 text-left space-y-1.5">
              {result.allocations.map((a) => {
                const charge = openCharges.find((c) => c.id === a.chargeId);
                return (
                  <div key={a.chargeId} className="flex justify-between text-[13px]">
                    <span className="text-on-surface-variant">
                      {charge ? `${periodLabelOf(charge, lang)} · ${charge.classTitle}` : a.chargeId}
                    </span>
                    <span className="font-bold text-success tabular-nums">{formatUZS(a.amount)}</span>
                  </div>
                );
              })}
              {result.unallocatedAmount > 0 && (
                <div className="flex justify-between text-[13px] pt-1.5 border-t border-outline-variant">
                  <span className="text-on-surface-variant">{t.avansLine}</span>
                  <span className="font-bold text-tertiary tabular-nums">{formatUZS(result.unallocatedAmount)}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-[13px] text-on-surface-variant mt-4">
            {t.newBalance}{" "}
            <span className={`font-bold ${result.newBalance < 0 ? "text-error" : "text-success"}`}>
              {formatUZS(result.newBalance)}
            </span>
          </p>
          <Button onClick={onDone} className="mt-5 w-full">
            {t.close}
          </Button>
        </div>
      </ManagerSheet>
    );
  }

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-5 sm:p-6">
        {/* ── Step 1: pick a student ── */}
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
              {roster === null ? (
                <div className="py-10 flex justify-center text-on-surface-variant">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : filteredRoster.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">{t.studentNotFound}</p>
              ) : (
                filteredRoster.map((s) => (
                  <button
                    key={s.uid}
                    onClick={() => setSelected(s)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-m3-md hover:bg-state-hover transition-colors text-left"
                  >
                    {s.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary auth providers (Google etc.); plain <img> like the rest of the manager panel
                      <img src={s.photoURL} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center text-[12px] font-bold">
                        {initialsOf(s.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{s.displayName}</p>
                      {s.username && <p className="text-[12px] text-on-surface-variant truncate">@{s.username}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* ── Step 2: amount + method ── */}
            <div className="flex items-center gap-2 mb-4">
              {!preselectUid && (
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-m3-sm hover:bg-state-hover flex items-center justify-center text-on-surface-variant"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-on-surface truncate">{selected.displayName}</h3>
                {profile && (
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className={`text-[12.5px] font-semibold ${profile.balance < 0 ? "text-error" : "text-success"}`}>
                      {t.balance} {formatUZS(profile.balance)}
                    </p>
                    {(profile.discountPercent || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tertiary-container text-on-tertiary-container rounded-full text-[11px] font-bold">
                        <BadgePercent size={11} /> {t.discount(profile.discountPercent!)}
                      </span>
                    )}
                    {profile.financeStatus === "frozen" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tertiary-container text-on-tertiary-container rounded-full text-[11px] font-bold">
                        <Snowflake size={11} /> {t.frozen}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {loadingStudent ? (
              <div className="py-10 flex justify-center text-on-surface-variant">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {openCharges.length > 0 && type === "payment" && (
                  <div className="bg-error-container rounded-m3-lg p-3.5 space-y-1.5">
                    {openCharges.map((c) => (
                      <div key={c.id} className="flex justify-between text-[13px]">
                        <span className="text-on-error-container truncate mr-2">
                          {periodLabelOf(c, lang)} · {c.classTitle}
                        </span>
                        <span className="font-bold text-on-error-container tabular-nums shrink-0">
                          {formatUZS(openAmountOf(c))}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[13px] pt-1.5 border-t border-outline-variant">
                      <span className="font-bold text-on-error-container">{t.totalDebt}</span>
                      <span className="font-bold text-on-error-container tabular-nums">{formatUZS(totalDebt)}</span>
                    </div>
                  </div>
                )}

                {/* type toggle */}
                <div className="flex gap-1 bg-surface-container rounded-m3-md p-1">
                  {(
                    [
                      ["payment", t.typePayment],
                      ["refund", t.typeRefund],
                    ] as [PaymentType, string][]
                  ).map(([ty, label]) => (
                    <button
                      key={ty}
                      onClick={() => setType(ty)}
                      className={`flex-1 py-2 rounded-m3-sm text-[13px] font-bold transition-colors ${
                        type === ty ? "bg-surface-container-lowest text-on-surface shadow-elev-1" : "text-on-surface-variant"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* amount */}
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t.amountPlaceholder}
                    className="w-full px-3.5 py-3 bg-transparent border border-outline-variant rounded-m3-md text-[16px] font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  {type === "payment" && totalDebt > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        onClick={() => setAmount(String(totalDebt))}
                        className="px-3 py-1.5 bg-secondary-container text-on-secondary-container hover:shadow-elev-1 rounded-m3-md text-[12px] font-bold transition-shadow"
                      >
                        {t.totalDebt} · {formatUZS(totalDebt)}
                      </button>
                      {openCharges.slice(0, 2).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setAmount(String(openAmountOf(c)))}
                          className="px-3 py-1.5 bg-secondary-container text-on-secondary-container hover:shadow-elev-1 rounded-m3-md text-[12px] font-bold transition-shadow"
                        >
                          {periodLabelOf(c, lang)} · {formatUZS(openAmountOf(c))}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* method */}
                <MethodSplitEditor
                  lang={lang}
                  totalAmount={amountValid ? parsedAmount : 0}
                  lines={methodLines}
                  onChange={setMethodLines}
                />

                {/* date + note */}
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="date"
                    value={paidAt}
                    max={todayKey}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={type === "refund" ? t.noteRequired : t.noteOptional}
                    className="px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Button
                  variant={type === "payment" ? "filled" : "danger"}
                  onClick={submit}
                  disabled={!canSubmit}
                  loading={submitting}
                  className="w-full"
                >
                  {type === "payment" ? t.submitPayment : t.submitRefund}
                  {amountValid && ` · ${formatUZS(parsedAmount)}`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ManagerSheet>
  );
}
