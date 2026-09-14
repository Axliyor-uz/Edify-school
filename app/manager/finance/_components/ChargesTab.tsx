"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  HandCoins,
  Pencil,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Charge, ChargeStatus } from "@/types/finance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { adjustChargeApi, cancelChargeApi, openAmountOf, waiveChargeApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { Banner, Button, EmptyState } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { CHARGE_STATUS_T, periodLabelOf } from "./financeFormat";
import FilterSelect from "../../_components/FilterSelect";
import MonthNav from "./MonthNav";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

interface Props {
  charges: Charge[];
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  /** Titles of groups that have students but no monthlyFee — they are silently unbilled. */
  unbilledClassTitles: string[];
  classes: ClassData[];
  onShowStudent: (studentId: string, studentName: string) => void;
  onChanged: () => void;
}

const T_UZ = {
  searchPlaceholder: "O'quvchi yoki guruhni qidiring...",
  allTeachers: "Barcha o'qituvchilar",
  allGroups: "Barcha guruhlar",
  chargeCount: (n: number) => `${n} ta hisob`,
  charged: "Hisoblangan",
  paid: "To'langan",
  remaining: "Qoldiq",
  unbilledPrefix: (n: number) => `${n} ta guruhda oylik narx belgilanmagan`,
  unbilledSuffix: "— ular hisob-kitobga kirmaydi.",
  unbilledLink: "Guruh sozlamalarida narx qo'ying",
  emptySearchTitle: "Hech narsa topilmadi",
  emptyTitle: "Bu davr uchun hisoblar yo'q",
  emptySearchDesc: "Filtr yoki qidiruvni o'zgartirib ko'ring",
  emptyDesc: "Hisob-kitob yaratilganda ro'yxat shu yerda ko'rinadi",
  studentInfoTitle: "O'quvchi haqida to'liq ma'lumot",
  discountTag: (amount: string) => `chegirma ${amount}`,
  proratedTag: "qisman oy",
  paidPartial: (amount: string) => `To'landi ${amount}`,
  adjustTitle: "Summani o'zgartirish",
  cancelTitle: "Bekor qilish",
  waiveTitle: "Qoldiqni kechirish",
  waiveMessage: (name: string, period: string, amount: string) =>
    `${name} — ${period} uchun ${amount} kechiriladi. To'langan qism saqlanadi.`,
  waiveConfirm: "Kechirish",
  waived: "Qoldiq kechirildi.",
  cancelChargeTitle: "Hisobni bekor qilish",
  cancelChargeMessage: (name: string, period: string, amount: string) =>
    `${name} — ${period} uchun ${amount} hisob bekor qilinadi.`,
  cancelConfirm: "Bekor qilish",
  chargeCancelled: "Hisob bekor qilindi.",
  genericError: "Xatolik yuz berdi.",
  adjustSubtitle: (name: string, period: string, amount: string) => `${name} · ${period} · hozirgi: ${amount}`,
  notePlaceholder: "Izoh (ixtiyoriy)",
  cancel: "Bekor qilish",
  save: "Saqlash",
  amountChanged: "Summa o'zgartirildi.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    searchPlaceholder: "Search for a student or group...",
    allTeachers: "All teachers",
    allGroups: "All groups",
    chargeCount: (n: number) => `${n} charges`,
    charged: "Charged",
    paid: "Paid",
    remaining: "Remaining",
    unbilledPrefix: (n: number) => `${n} groups have no monthly price`,
    unbilledSuffix: "— they are not included in billing.",
    unbilledLink: "Set prices in group settings",
    emptySearchTitle: "Nothing found",
    emptyTitle: "No charges for this period",
    emptySearchDesc: "Try changing the filter or search",
    emptyDesc: "Once charges are generated, the list will appear here",
    studentInfoTitle: "Full student details",
    discountTag: (amount: string) => `discount ${amount}`,
    proratedTag: "partial month",
    paidPartial: (amount: string) => `Paid ${amount}`,
    adjustTitle: "Change amount",
    cancelTitle: "Cancel",
    waiveTitle: "Waive remainder",
    waiveMessage: (name: string, period: string, amount: string) =>
      `${name} — ${amount} for ${period} will be waived. The paid part is kept.`,
    waiveConfirm: "Waive",
    waived: "Remainder waived.",
    cancelChargeTitle: "Cancel charge",
    cancelChargeMessage: (name: string, period: string, amount: string) =>
      `${name} — the ${amount} charge for ${period} will be cancelled.`,
    cancelConfirm: "Cancel charge",
    chargeCancelled: "Charge cancelled.",
    genericError: "Something went wrong.",
    adjustSubtitle: (name: string, period: string, amount: string) => `${name} · ${period} · current: ${amount}`,
    notePlaceholder: "Note (optional)",
    cancel: "Cancel",
    save: "Save",
    amountChanged: "Amount changed.",
  },
  ru: {
    searchPlaceholder: "Поиск ученика или группы...",
    allTeachers: "Все учителя",
    allGroups: "Все группы",
    chargeCount: (n: number) => `Начислений: ${n}`,
    charged: "Начислено",
    paid: "Оплачено",
    remaining: "Остаток",
    unbilledPrefix: (n: number) => `В ${n} группах не задана месячная цена`,
    unbilledSuffix: "— они не участвуют в начислениях.",
    unbilledLink: "Задайте цену в настройках группы",
    emptySearchTitle: "Ничего не найдено",
    emptyTitle: "За этот период начислений нет",
    emptySearchDesc: "Попробуйте изменить фильтр или запрос",
    emptyDesc: "Когда начисления будут созданы, список появится здесь",
    studentInfoTitle: "Подробная информация об ученике",
    discountTag: (amount: string) => `скидка ${amount}`,
    proratedTag: "неполный месяц",
    paidPartial: (amount: string) => `Оплачено ${amount}`,
    adjustTitle: "Изменить сумму",
    cancelTitle: "Отменить",
    waiveTitle: "Простить остаток",
    waiveMessage: (name: string, period: string, amount: string) =>
      `${name} — за ${period} будет прощено ${amount}. Оплаченная часть сохраняется.`,
    waiveConfirm: "Простить",
    waived: "Остаток прощён.",
    cancelChargeTitle: "Отменить начисление",
    cancelChargeMessage: (name: string, period: string, amount: string) =>
      `${name} — начисление ${amount} за ${period} будет отменено.`,
    cancelConfirm: "Отменить",
    chargeCancelled: "Начисление отменено.",
    genericError: "Произошла ошибка.",
    adjustSubtitle: (name: string, period: string, amount: string) => `${name} · ${period} · текущая: ${amount}`,
    notePlaceholder: "Комментарий (необязательно)",
    cancel: "Отмена",
    save: "Сохранить",
    amountChanged: "Сумма изменена.",
  },
};

/** MD3 leading-avatar + status-text colors per charge state. */
const STATUS_META: Record<ChargeStatus, { Icon: LucideIcon; avatar: string; text: string }> = {
  pending: { Icon: Clock3, avatar: "bg-error-container text-on-error-container", text: "text-error" },
  partial: { Icon: CircleDollarSign, avatar: "bg-warning-container text-on-warning-container", text: "text-warning" },
  paid: { Icon: CheckCircle2, avatar: "bg-success-container text-on-success-container", text: "text-success" },
  waived: { Icon: HandCoins, avatar: "bg-tertiary-container text-on-tertiary-container", text: "text-tertiary" },
  cancelled: { Icon: XCircle, avatar: "bg-surface-container-highest text-on-surface-variant", text: "text-on-surface-variant" },
};

/** Month's charge register: totals, per-charge status, waive/cancel/adjust actions. */
export default function ChargesTab({
  charges,
  monthLabel,
  onShiftMonth,
  unbilledClassTitles,
  classes,
  onShowStudent,
  onChanged,
}: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [waiveTarget, setWaiveTarget] = useState<Charge | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Charge | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Charge | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (c.teacherId && !map.has(c.teacherId)) map.set(c.teacherId, c.teacherName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  /** Group options narrow to the picked teacher's groups. */
  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => !teacherFilter || c.teacherId === teacherFilter)
        .map((c) => ({ value: c.id, label: c.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classes, teacherFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charges.filter((c) => {
      if (classFilter && c.classId !== classFilter) return false;
      if (teacherFilter && classById.get(c.classId)?.teacherId !== teacherFilter) return false;
      if (q && !c.studentName.toLowerCase().includes(q) && !c.classTitle.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [charges, search, classFilter, teacherFilter, classById]);

  const hasFilters = classFilter !== "" || teacherFilter !== "" || search.trim() !== "";

  const totals = useMemo(() => {
    const active = filtered.filter((c) => c.status !== "cancelled");
    return {
      charged: active.reduce((s, c) => s + c.amount, 0),
      paid: active.reduce((s, c) => s + (c.paidAmount || 0), 0),
      open: filtered.reduce((s, c) => s + (c.status === "pending" || c.status === "partial" ? openAmountOf(c) : 0), 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        {charges.length > 5 && (
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        )}
      </div>

      {classes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            value={teacherFilter}
            onChange={(v) => {
              setTeacherFilter(v);
              // A group of another teacher can't stay selected.
              if (v && classFilter && classById.get(classFilter)?.teacherId !== v) setClassFilter("");
            }}
            options={teacherOptions}
            allLabel={t.allTeachers}
          />
          <FilterSelect
            value={classFilter}
            onChange={setClassFilter}
            options={classOptions}
            allLabel={t.allGroups}
          />
          {hasFilters && (
            <p className="text-[12.5px] text-on-surface-variant ml-auto">{t.chargeCount(filtered.length)}</p>
          )}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl px-4 py-3 grid grid-cols-3 divide-x divide-outline-variant">
        <div className="pr-3">
          <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.charged}</p>
          <p className="text-[13.5px] font-bold text-on-surface tabular-nums mt-0.5 truncate">
            {formatUZS(totals.charged)}
          </p>
        </div>
        <div className="px-3">
          <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.paid}</p>
          <p className="text-[13.5px] font-bold text-success tabular-nums mt-0.5 truncate">
            {formatUZS(totals.paid)}
          </p>
        </div>
        <div className="pl-3">
          <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.remaining}</p>
          <p className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${totals.open > 0 ? "text-error" : "text-on-surface"}`}>
            {formatUZS(totals.open)}
          </p>
        </div>
      </div>

      {unbilledClassTitles.length > 0 && (
        <Banner tone="info">
          {t.unbilledPrefix(unbilledClassTitles.length)} ({unbilledClassTitles.slice(0, 3).join(", ")}
          {unbilledClassTitles.length > 3 && "..."}) {t.unbilledSuffix}{" "}
          <Link href="/manager/groups" className="font-bold underline">
            {t.unbilledLink}
          </Link>
        </Banner>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={hasFilters ? t.emptySearchTitle : t.emptyTitle}
            description={hasFilters ? t.emptySearchDesc : t.emptyDesc}
          />
        ) : (
          filtered.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-state-hover transition-colors">
                <button
                  onClick={() => onShowStudent(c.studentId, c.studentName)}
                  title={t.studentInfoTitle}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.avatar}`}>
                    <meta.Icon size={18} strokeWidth={2.1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[14.5px] font-semibold truncate group-hover:text-primary transition-colors ${
                        c.status === "cancelled" ? "text-on-surface-variant line-through" : "text-on-surface"
                      }`}
                    >
                      {c.studentName}
                    </p>
                    <p className="text-[12.5px] text-on-surface-variant mt-0.5 truncate">
                      {c.classTitle} · {periodLabelOf(c, lang)}
                      {c.discountAmount > 0 && ` · ${t.discountTag(formatUZS(c.discountAmount))}`}
                      {c.proratedFrom && ` · ${t.proratedTag}`}
                    </p>
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <p
                    className={`text-[14.5px] font-bold tabular-nums ${
                      c.status === "cancelled" ? "text-on-surface-variant line-through" : "text-on-surface"
                    }`}
                  >
                    {formatUZS(c.amount)}
                  </p>
                  <p className={`text-[11.5px] font-bold mt-0.5 ${meta.text}`}>
                    {c.status === "partial"
                      ? t.paidPartial(formatUZS(c.paidAmount || 0))
                      : CHARGE_STATUS_T[lang][c.status]}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {c.status === "pending" && (c.paidAmount || 0) === 0 && (
                    <>
                      <button
                        onClick={() => setAdjustTarget(c)}
                        title={t.adjustTitle}
                        className="w-9 h-9 rounded-full hover:bg-state-hover text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setCancelTarget(c)}
                        title={t.cancelTitle}
                        className="w-9 h-9 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  {(c.status === "pending" || c.status === "partial") && (
                    <button
                      onClick={() => setWaiveTarget(c)}
                      title={t.waiveTitle}
                      className="w-9 h-9 rounded-full hover:bg-tertiary-container text-on-surface-variant hover:text-tertiary flex items-center justify-center transition-colors"
                    >
                      <HandCoins size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {waiveTarget && (
        <ReasonDialog
          title={t.waiveTitle}
          message={t.waiveMessage(
            waiveTarget.studentName,
            periodLabelOf(waiveTarget, lang),
            formatUZS(openAmountOf(waiveTarget))
          )}
          confirmLabel={t.waiveConfirm}
          onClose={() => setWaiveTarget(null)}
          onConfirm={async (reason) => {
            try {
              await waiveChargeApi(waiveTarget.id, reason);
              toast.success(t.waived);
              setWaiveTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || t.genericError);
            }
          }}
        />
      )}
      {cancelTarget && (
        <ReasonDialog
          title={t.cancelChargeTitle}
          message={t.cancelChargeMessage(
            cancelTarget.studentName,
            periodLabelOf(cancelTarget, lang),
            formatUZS(cancelTarget.amount)
          )}
          confirmLabel={t.cancelConfirm}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelChargeApi(cancelTarget.id, reason);
              toast.success(t.chargeCancelled);
              setCancelTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || t.genericError);
            }
          }}
        />
      )}
      {adjustTarget && (
        <AdjustDialog
          charge={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({ charge, onClose, onDone }: { charge: Charge; onClose: () => void; onDone: () => void }) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [amount, setAmount] = useState(String(charge.amount));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parsed = parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await adjustChargeApi(charge.id, parsed, note.trim() || undefined);
      toast.success(t.amountChanged);
      onDone();
    } catch (e: any) {
      toast.error(e.message || t.genericError);
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7">
        <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.adjustTitle}</h3>
        <p className="text-sm text-on-surface-variant mt-1.5">
          {t.adjustSubtitle(charge.studentName, periodLabelOf(charge, lang), formatUZS(charge.amount))}
        </p>
        <input
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-4 w-full px-3.5 py-3 bg-transparent border border-outline-variant rounded-m3-md text-[16px] font-bold text-on-surface tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.notePlaceholder}
          className="mt-2.5 w-full px-3.5 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-3 mt-5">
          <Button variant="tonal" onClick={onClose} disabled={submitting} className="flex-1">
            {t.cancel}
          </Button>
          <Button onClick={submit} disabled={!valid} loading={submitting} className="flex-1">
            {t.save}
          </Button>
        </div>
      </div>
    </ManagerSheet>
  );
}
