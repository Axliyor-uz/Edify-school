"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Home,
  Megaphone,
  Package,
  Plus,
  Undo2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Expense } from "@/types/finance";
import { cancelExpenseApi, createExpenseApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { Button, EmptyState, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { formatMethodSplit, shortDateLabel } from "./financeFormat";
import MethodSplitEditor, {
  methodSplitPayload,
  methodSplitValid,
  singleSplitLine,
  type MethodSplitLine,
} from "./MethodSplitEditor";
import MonthNav from "./MonthNav";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

interface Props {
  expenses: Expense[];
  categories: string[];
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  onChanged: () => void;
  /** 🟢 Office panel (docs/OFFICE.md): a DIRECTOR reads expenses but may not
   *  add or cancel one. Defaults to true — manager + accountant unchanged. */
  canRecord?: boolean;
}

// Keys are the stored category values — never translated.
const CATEGORY_LABELS: Record<LangType, Record<string, string>> = {
  uz: {
    salary: "Oylik",
    ijara: "Ijara",
    kommunal: "Kommunal",
    marketing: "Marketing",
    jihozlar: "Jihozlar",
    boshqa: "Boshqa",
  },
  en: {
    salary: "Salary",
    ijara: "Rent",
    kommunal: "Utilities",
    marketing: "Marketing",
    jihozlar: "Equipment",
    boshqa: "Other",
  },
  ru: {
    salary: "Зарплата",
    ijara: "Аренда",
    kommunal: "Коммунальные",
    marketing: "Маркетинг",
    jihozlar: "Оборудование",
    boshqa: "Прочее",
  },
};
const categoryLabel = (c: string, lang: LangType) => CATEGORY_LABELS[lang][c] || c;

const T_UZ = {
  addExpense: "Xarajat qo'shish",
  searchPlaceholder: "Kategoriya yoki izohni qidiring...",
  total: (amount: string) => `Jami: ${amount}`,
  emptySearchTitle: "Hech narsa topilmadi",
  emptyTitle: "Bu oyda xarajatlar yo'q",
  emptySearchDesc: "Qidiruvni o'zgartirib ko'ring",
  emptyDesc: "Ijara, kommunal va boshqa sarflarni shu yerga yozib boring",
  cancelledChip: "Bekor qilingan",
  cancelExpenseTitle: "Xarajatni bekor qilish",
  cancelMessage: (category: string, amount: string) =>
    `${category} — ${amount}. Xarajat o'chirilmaydi, "bekor qilingan" deb belgilanadi.`,
  cancelConfirm: "Bekor qilish",
  expenseCancelled: "Xarajat bekor qilindi.",
  genericError: "Xatolik yuz berdi.",
  amountPlaceholder: "Summa (so'm)",
  notePlaceholder: "Izoh (ixtiyoriy)",
  save: "Saqlash",
  expenseSaved: "Xarajat saqlandi.",
  saveError: "Saqlashda xatolik.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    addExpense: "Add expense",
    searchPlaceholder: "Search by category or note...",
    total: (amount: string) => `Total: ${amount}`,
    emptySearchTitle: "Nothing found",
    emptyTitle: "No expenses this month",
    emptySearchDesc: "Try changing your search",
    emptyDesc: "Record rent, utilities and other spending here",
    cancelledChip: "Cancelled",
    cancelExpenseTitle: "Cancel expense",
    cancelMessage: (category: string, amount: string) =>
      `${category} — ${amount}. The expense is not deleted — it is marked "cancelled".`,
    cancelConfirm: "Cancel expense",
    expenseCancelled: "Expense cancelled.",
    genericError: "Something went wrong.",
    amountPlaceholder: "Amount (so'm)",
    notePlaceholder: "Note (optional)",
    save: "Save",
    expenseSaved: "Expense saved.",
    saveError: "Failed to save.",
  },
  ru: {
    addExpense: "Добавить расход",
    searchPlaceholder: "Поиск по категории или комментарию...",
    total: (amount: string) => `Всего: ${amount}`,
    emptySearchTitle: "Ничего не найдено",
    emptyTitle: "В этом месяце расходов нет",
    emptySearchDesc: "Попробуйте изменить запрос",
    emptyDesc: "Записывайте здесь аренду, коммунальные и прочие траты",
    cancelledChip: "Отменён",
    cancelExpenseTitle: "Отменить расход",
    cancelMessage: (category: string, amount: string) =>
      `${category} — ${amount}. Расход не удаляется — он помечается как «отменён».`,
    cancelConfirm: "Отменить",
    expenseCancelled: "Расход отменён.",
    genericError: "Произошла ошибка.",
    amountPlaceholder: "Сумма (so'm)",
    notePlaceholder: "Комментарий (необязательно)",
    save: "Сохранить",
    expenseSaved: "Расход сохранён.",
    saveError: "Не удалось сохранить.",
  },
};

/** MD3 leading avatar per category: own icon + tonal color, so rows scan at a glance. */
const CATEGORY_META: Record<string, { Icon: LucideIcon; avatar: string }> = {
  salary: { Icon: Users, avatar: "bg-success-container text-on-success-container" },
  ijara: { Icon: Home, avatar: "bg-tertiary-container text-on-tertiary-container" },
  kommunal: { Icon: Zap, avatar: "bg-warning-container text-on-warning-container" },
  marketing: { Icon: Megaphone, avatar: "bg-secondary-container text-on-secondary-container" },
  jihozlar: { Icon: Package, avatar: "bg-primary-container text-on-primary-container" },
  boshqa: { Icon: Wallet, avatar: "bg-surface-container-highest text-on-surface-variant" },
};
const categoryMeta = (c: string) => CATEGORY_META[c] || CATEGORY_META.boshqa;

/** Month's expenses: per-category totals, add, cancel. Salary rows come from payroll and are protected. */
export default function ExpensesTab({ expenses, categories, monthLabel, onShiftMonth, onChanged, canRecord = true }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [showAdd, setShowAdd] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) => categoryLabel(e.category, lang).toLowerCase().includes(q) || (e.note || "").toLowerCase().includes(q)
    );
  }, [expenses, search, lang]);

  const active = useMemo(() => filtered.filter((e) => e.status === "active"), [filtered]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of active) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const total = active.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        {canRecord && (
          <Button icon={<Plus />} onClick={() => setShowAdd(true)}>
            {t.addExpense}
          </Button>
        )}
      </div>

      {expenses.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
      )}

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-3.5 py-1.5 bg-inverse-surface text-inverse-on-surface rounded-full text-[12px] font-bold tabular-nums">
            {t.total(formatUZS(total))}
          </span>
          {byCategory.map(([cat, sum]) => (
            <span
              key={cat}
              className="px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface-variant rounded-full text-[12px] font-bold tabular-nums"
            >
              {categoryLabel(cat, lang)}: {formatUZS(sum)}
            </span>
          ))}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet />}
            title={search ? t.emptySearchTitle : t.emptyTitle}
            description={search ? t.emptySearchDesc : t.emptyDesc}
          />
        ) : (
          filtered.map((e) => {
            const cancelled = e.status === "cancelled";
            const meta = categoryMeta(e.category);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-state-hover transition-colors">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    cancelled ? "bg-surface-container-highest text-on-surface-variant" : meta.avatar
                  }`}
                >
                  <meta.Icon size={18} strokeWidth={2.1} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[14.5px] font-semibold truncate ${
                      cancelled ? "text-on-surface-variant line-through" : "text-on-surface"
                    }`}
                  >
                    {categoryLabel(e.category, lang)}
                    {e.note && <span className="font-medium text-on-surface-variant"> · {e.note}</span>}
                  </p>
                  <p className="text-[12.5px] text-on-surface-variant mt-0.5">
                    {shortDateLabel(e.date, lang)}
                    {(e.method || e.methodSplit?.length) && ` · ${formatMethodSplit(e, lang)}`}
                  </p>
                </div>
                {cancelled && (
                  <StatusChip tone="muted" noDot className="shrink-0">
                    {t.cancelledChip}
                  </StatusChip>
                )}
                <p
                  className={`text-[14.5px] font-bold tabular-nums shrink-0 ${
                    cancelled ? "text-on-surface-variant line-through" : "text-on-surface"
                  }`}
                >
                  −{formatUZS(e.amount)}
                </p>
                {!cancelled && !e.payoutId && canRecord && (
                  <button
                    onClick={() => setCancelTarget(e)}
                    title={t.cancelExpenseTitle}
                    className="w-9 h-9 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors shrink-0"
                  >
                    <Undo2 size={15} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAdd && (
        <AddExpenseModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            onChanged();
          }}
        />
      )}
      {cancelTarget && (
        <ReasonDialog
          title={t.cancelExpenseTitle}
          message={t.cancelMessage(categoryLabel(cancelTarget.category, lang), formatUZS(cancelTarget.amount))}
          confirmLabel={t.cancelConfirm}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelExpenseApi(cancelTarget.id, reason);
              toast.success(t.expenseCancelled);
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

function AddExpenseModal({
  categories,
  onClose,
  onDone,
}: {
  categories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const todayKey = getTodayKey();
  const options = categories.filter((c) => c !== "salary");
  const [category, setCategory] = useState(options[0] || "boshqa");
  const [amount, setAmount] = useState("");
  const [methodLines, setMethodLines] = useState<MethodSplitLine[]>(singleSplitLine());
  const [date, setDate] = useState(todayKey);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseInt(amount, 10);
  const amountValid = Number.isInteger(parsed) && parsed > 0;
  const valid = amountValid && !!category && methodSplitValid(methodLines, parsed);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await createExpenseApi({
        category,
        amount: parsed,
        method: methodLines[0].method,
        ...(methodLines.length > 1 ? { methodSplit: methodSplitPayload(methodLines) } : {}),
        ...(date !== todayKey ? { date } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(t.expenseSaved);
      onDone();
    } catch (e: any) {
      toast.error(e.message || t.saveError);
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.addExpense}</h3>

        <div className="flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3.5 py-2.5 rounded-m3-md text-[13px] font-bold border transition-colors ${
                category === c
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
              }`}
            >
              {categoryLabel(c, lang)}
            </button>
          ))}
        </div>

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

        <MethodSplitEditor
          lang={lang}
          totalAmount={amountValid ? parsed : 0}
          lines={methodLines}
          onChange={setMethodLines}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className="px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <Button onClick={submit} disabled={!valid} loading={submitting} className="w-full">
          {t.save}
        </Button>
      </div>
    </ManagerSheet>
  );
}
