"use client";

/**
 * THE OFFICE PAGE — director & buxgalter (docs/OFFICE.md).
 *
 * One page: a month's money summary pinned at the top, then four tabs —
 * payments, expenses, who owes what, and the teaching staff with their
 * attendance and salaries.
 *
 * It is deliberately built FROM THE MANAGER'S OWN finance components rather
 * than a parallel set: the numbers a director questions must be the exact
 * numbers the manager sees, and a second implementation is how those two drift.
 * Each reused component takes a `canRecord`/`canManage` flag that defaults to
 * the manager's full behavior, so this page only ever SUBTRACTS capability.
 *
 * Capability, in one place:
 *   director   → read-only, EXCEPT approving/rejecting the accountant's
 *                pending expenses (docs/FINANCE.md §9) — never creates one
 *   accountant → read-only plus recording/cancelling payments and expenses;
 *                an accountant's own expense starts `pending_approval`
 * The flags below are UX. The real gates are `requireCenterOffice(..., [...])`
 * on the server — a director who forges `canRecord`, or an accountant who
 * forges `canApprove`, client-side still gets a 403 from the server.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus } from "lucide-react";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { fetchCenterSessions, tallyStudent } from "@/services/attendanceService";
import {
  fetchChargesForMonth,
  fetchExpensesForMonth,
  fetchFinanceSettings,
  fetchOpenCharges,
  fetchPaymentsForMonth,
  fetchPositiveBalances,
  fetchRecentPayments,
} from "@/services/financeService";
import { computeFinanceStats } from "@/lib/finance/financeStats";
import type { Charge, Expense, FinanceSettings, Payment } from "@/types/finance";
import { getTodayKey, monthKeyOf } from "@/lib/dateUtils";
import { Badge, Tabs } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import FinanceStats from "@/app/manager/finance/_components/FinanceStats";
import PaymentsTab from "@/app/manager/finance/_components/PaymentsTab";
import DebtorsTab from "@/app/manager/finance/_components/DebtorsTab";
import ExpensesTab from "@/app/manager/finance/_components/ExpensesTab";
import RecordPaymentModal from "@/app/manager/finance/_components/RecordPaymentModal";
import StudentInfoDialog from "@/app/manager/finance/_components/StudentInfoDialog";
import ExportFinanceButton from "@/app/manager/finance/_components/ExportFinanceButton";
import { monthLabelOf, shiftMonthKey } from "@/app/manager/finance/_components/financeFormat";
import { useOfficeSession } from "./layout";
import OfficeTeachersTab from "./_components/OfficeTeachersTab";

// No "overview" tab: FinanceStats sits ABOVE the tab bar and is visible on all
// of them, so a summary tab would only repeat it.
type Tab = "payments" | "expenses" | "debtors" | "teachers";

const TAB_KEYS: Tab[] = ["payments", "expenses", "debtors", "teachers"];

const T_UZ = {
  tabs: {
    payments: "To'lovlar",
    expenses: "Xarajatlar",
    debtors: "Qarzdorlar",
    teachers: "O'qituvchilar",
  },
  titleDirector: "Direktor paneli",
  titleAccountant: "Buxgalteriya",
  subtitle: "To'lovlar, xarajatlar va xodimlar",
  settingsLoadError: "Sozlamalarni yuklashda xatolik.",
  dataLoadError: "Ma'lumotlarni yuklashda xatolik.",
  fabLabel: "To'lov qabul qilish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    tabs: {
      payments: "Payments",
      expenses: "Expenses",
      debtors: "Debtors",
      teachers: "Teachers",
    },
    titleDirector: "Director panel",
    titleAccountant: "Accounting",
    subtitle: "Payments, expenses and staff",
    settingsLoadError: "Failed to load settings.",
    dataLoadError: "Failed to load data.",
    fabLabel: "Record payment",
  },
  ru: {
    tabs: {
      payments: "Платежи",
      expenses: "Расходы",
      debtors: "Должники",
      teachers: "Учителя",
    },
    titleDirector: "Панель директора",
    titleAccountant: "Бухгалтерия",
    subtitle: "Платежи, расходы и сотрудники",
    settingsLoadError: "Не удалось загрузить настройки.",
    dataLoadError: "Не удалось загрузить данные.",
    fabLabel: "Принять платёж",
  },
};

export default function OfficePage() {
  const session = useOfficeSession();
  const { centerId, canRecord } = session;
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];

  const { classes, teachers } = useCenterClasses(centerId);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(getTodayKey()));
  const [tab, setTab] = useState<Tab>("payments");

  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [avansTotal, setAvansTotal] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [attendanceRates, setAttendanceRates] = useState<Record<string, number | null> | null>(null);
  const [payModal, setPayModal] = useState<{ open: boolean; uid?: string }>({ open: false });
  const [infoStudent, setInfoStudent] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    if (!centerId) return;
    fetchFinanceSettings(centerId)
      .then(setSettings)
      .catch(() => toast.error(t.settingsLoadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  // The billing anchor decides how a "month" of charges is queried (calendar
  // months vs rolling cycles) — same dependency the manager page has.
  const anchor = settings?.billingAnchor;
  const reload = useCallback(async () => {
    if (!centerId || !anchor) return;
    setLoadingData(true);
    try {
      const [ch, open, mp, rp, positives, exp] = await Promise.all([
        fetchChargesForMonth(centerId, monthKey, anchor),
        fetchOpenCharges(centerId),
        fetchPaymentsForMonth(centerId, monthKey),
        fetchRecentPayments(centerId, 50),
        fetchPositiveBalances(centerId),
        fetchExpensesForMonth(centerId, monthKey),
      ]);
      setCharges(ch);
      setOpenCharges(open);
      setMonthPayments(mp);
      setRecentPayments(rp);
      setAvansTotal(positives.reduce((s, p) => s + p.balance, 0));
      setExpenses(exp);
    } catch (err) {
      console.error("Office finance load error:", err);
      toast.error(t.dataLoadError);
    } finally {
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, anchor, monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Current-month attendance % beside each debtor (the "owes 2 months AND
  // missed 6 lessons" conversation aid). A failure never blocks the list.
  useEffect(() => {
    if (!centerId || openCharges.length === 0) {
      setAttendanceRates({});
      return;
    }
    let alive = true;
    fetchCenterSessions(centerId, `${monthKeyOf(todayKey)}-01`, todayKey)
      .then((sessions) => {
        if (!alive) return;
        const map: Record<string, number | null> = {};
        for (const uid of new Set(openCharges.map((c) => c.studentId))) {
          map[uid] = tallyStudent(sessions, uid, todayKey).rate;
        }
        setAttendanceRates(map);
      })
      .catch(() => alive && setAttendanceRates(null));
    return () => {
      alive = false;
    };
  }, [centerId, openCharges, todayKey]);

  const stats = useMemo(
    () => computeFinanceStats({ charges, monthPayments, openCharges, expenses }),
    [monthPayments, charges, openCharges, expenses]
  );

  const debtorCount = useMemo(() => new Set(openCharges.map((c) => c.studentId)).size, [openCharges]);
  const monthLabel = monthLabelOf(monthKey, lang);
  const title = session.staffRole === "director" ? t.titleDirector : t.titleAccountant;

  if (!settings) {
    return (
      <div className="py-24 flex justify-center text-on-surface-variant">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <ExportFinanceButton
          charges={charges}
          payments={monthPayments}
          openCharges={openCharges}
          expenses={expenses}
          monthKey={monthKey}
        />
      </div>

      <FinanceStats
        monthLabel={monthLabel}
        collected={stats.collected}
        charged={stats.charged}
        debtTotal={stats.debtTotal}
        avansTotal={avansTotal}
        expensesTotal={stats.expensesTotal}
        profit={stats.profit}
      />

      <div className="sticky top-[60px] lg:top-2 z-30 -mx-1 px-1">
        <Tabs
          className="rounded-m3-md bg-surface-blur backdrop-blur"
          tabs={TAB_KEYS.map((key) => ({
            id: key,
            label: t.tabs[key],
            badge: key === "debtors" && debtorCount > 0 ? <Badge tone="error">{debtorCount}</Badge> : undefined,
          }))}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      </div>

      {loadingData && tab !== "teachers" ? (
        <div className="py-16 flex justify-center text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : tab === "payments" ? (
        <PaymentsTab
          payments={recentPayments}
          onOpenModal={() => setPayModal({ open: true })}
          onChanged={reload}
          canRecord={canRecord}
        />
      ) : tab === "expenses" ? (
        <ExpensesTab
          expenses={expenses}
          categories={settings.expenseCategories}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          onChanged={reload}
          canRecord={canRecord}
          canApprove={session.staffRole === "director"}
          currentUid={session.uid}
        />
      ) : tab === "debtors" ? (
        <DebtorsTab
          openCharges={openCharges}
          attendanceRates={attendanceRates}
          todayKey={todayKey}
          classes={classes}
          onRecordPayment={(uid) => canRecord && setPayModal({ open: true, uid })}
          onShowStudent={(uid, name) => setInfoStudent({ uid, name })}
        />
      ) : (
        <OfficeTeachersTab
          centerId={centerId}
          teachers={teachers}
          classes={classes}
          monthKey={monthKey}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
        />
      )}

      {/* Mobile FAB — accountant only; a director has nothing to record. */}
      {canRecord && (
        <button
          onClick={() => setPayModal({ open: true })}
          aria-label={t.fabLabel}
          className="sm:hidden fixed bottom-5 right-4 z-40 w-14 h-14 rounded-full bg-primary text-on-primary shadow-elev-3 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {payModal.open && canRecord && (
        <RecordPaymentModal
          centerId={centerId}
          classes={classes}
          preselectUid={payModal.uid || null}
          onClose={() => setPayModal({ open: false })}
          onDone={() => {
            setPayModal({ open: false });
            reload();
          }}
        />
      )}

      {infoStudent && (
        <StudentInfoDialog
          key={infoStudent.uid}
          centerId={centerId}
          studentId={infoStudent.uid}
          fallbackName={infoStudent.name}
          classes={classes}
          // Discount + freeze are manager-only writes; the route would 403.
          canManage={false}
          onClose={() => setInfoStudent(null)}
          onRecordPayment={
            canRecord
              ? (uid) => {
                  setInfoStudent(null);
                  setPayModal({ open: true, uid });
                }
              : null
          }
        />
      )}
    </div>
  );
}
