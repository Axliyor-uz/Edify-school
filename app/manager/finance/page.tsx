"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
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
  openAmountOf,
} from "@/services/financeService";
import type { Charge, Expense, FinanceSettings, Payment } from "@/types/finance";
import { getTodayKey, monthKeyOf } from "@/lib/dateUtils";
import { Badge, Tabs } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import FinanceStats from "./_components/FinanceStats";
import GenerateChargesBanner from "./_components/GenerateChargesBanner";
import PaymentsTab from "./_components/PaymentsTab";
import DebtorsTab from "./_components/DebtorsTab";
import ChargesTab from "./_components/ChargesTab";
import PayrollTab from "./_components/PayrollTab";
import ExpensesTab from "./_components/ExpensesTab";
import SettingsTab from "./_components/SettingsTab";
import RecordPaymentModal from "./_components/RecordPaymentModal";
import RecordTeacherPayoutModal from "./_components/RecordTeacherPayoutModal";
import PaymentKindSheet from "./_components/PaymentKindSheet";
import ExportFinanceButton from "./_components/ExportFinanceButton";
import StartGuide from "./_components/StartGuide";
import StudentInfoDialog from "./_components/StudentInfoDialog";
import { monthLabelOf, shiftMonthKey } from "./_components/financeFormat";

type Tab = "payments" | "debtors" | "charges" | "payroll" | "expenses" | "settings";

const TAB_KEYS: Tab[] = ["payments", "debtors", "charges", "payroll", "expenses", "settings"];

const T_UZ = {
  tabs: {
    payments: "To'lovlar",
    debtors: "Qarzdorlar",
    charges: "Hisob-kitob",
    payroll: "Oyliklar",
    expenses: "Xarajatlar",
    settings: "Sozlamalar",
  },
  settingsLoadError: "Sozlamalarni yuklashda xatolik.",
  dataLoadError: "Ma'lumotlarni yuklashda xatolik.",
  title: "Moliya",
  subtitle: "To'lovlar, qarzdorlar va hisob-kitob",
  guide: {
    step1Title: "Guruh narxlarini belgilang",
    step1Desc: "Har bir guruhga oylik narx qo'ying — hisob-kitob shu narxdan hisoblanadi.",
    step1Action: "Narx belgilash",
    step2Title: "Hisob-kitob yarating",
    step2Desc: "Oyda bir marta bosiladi — kim qancha to'lashi kerakligi avtomatik hisoblanadi.",
    step2Action: "Hisob-kitob",
    step3Title: "To'lovlarni qabul qiling",
    step3Desc: "O'quvchi pul olib kelganda shu yerga yozasiz — qarz avtomatik kamayadi.",
    step3Action: "To'lov kiritish",
  },
  fabLabel: "To'lov qabul qilish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    tabs: {
      payments: "Payments",
      debtors: "Debtors",
      charges: "Billing",
      payroll: "Payroll",
      expenses: "Expenses",
      settings: "Settings",
    },
    settingsLoadError: "Failed to load settings.",
    dataLoadError: "Failed to load data.",
    title: "Finance",
    subtitle: "Payments, debtors and billing",
    guide: {
      step1Title: "Set group prices",
      step1Desc: "Give each group a monthly price — billing is calculated from it.",
      step1Action: "Set prices",
      step2Title: "Generate charges",
      step2Desc: "Click once a month — who owes how much is calculated automatically.",
      step2Action: "Billing",
      step3Title: "Record payments",
      step3Desc: "When a student brings money, record it here — the debt shrinks automatically.",
      step3Action: "Record payment",
    },
    fabLabel: "Record payment",
  },
  ru: {
    tabs: {
      payments: "Платежи",
      debtors: "Должники",
      charges: "Начисления",
      payroll: "Зарплаты",
      expenses: "Расходы",
      settings: "Настройки",
    },
    settingsLoadError: "Не удалось загрузить настройки.",
    dataLoadError: "Не удалось загрузить данные.",
    title: "Финансы",
    subtitle: "Платежи, должники и начисления",
    guide: {
      step1Title: "Установите цены групп",
      step1Desc: "Задайте каждой группе месячную цену — начисления рассчитываются по ней.",
      step1Action: "Установить цены",
      step2Title: "Создайте начисления",
      step2Desc: "Нажимается раз в месяц — кто сколько должен, рассчитывается автоматически.",
      step2Action: "Начисления",
      step3Title: "Принимайте платежи",
      step3Desc: "Когда ученик приносит деньги, запишите их здесь — долг уменьшится автоматически.",
      step3Action: "Внести платёж",
    },
    fabLabel: "Принять платёж",
  },
};

export default function ManagerFinancePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const { classes, teachers, refetch: refetchClasses } = useCenterClasses(centerId);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(getTodayKey()));
  const [tab, setTab] = useState<Tab>("payments");

  const [charges, setCharges] = useState<Charge[]>([]);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [avansTotal, setAvansTotal] = useState(0);
  const [bannerToken, setBannerToken] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [attendanceRates, setAttendanceRates] = useState<Record<string, number | null> | null>(null);
  const [payModal, setPayModal] = useState<{ open: boolean; uid?: string; kind?: "student" | "teacher" }>({
    open: false,
  });
  const [infoStudent, setInfoStudent] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      if (p?.centerId) setCenterId(p.centerId);
    });
  }, [user]);

  useEffect(() => {
    if (!centerId) return;
    fetchFinanceSettings(centerId)
      .then(setSettings)
      .catch(() => toast.error(t.settingsLoadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

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
      setBannerToken((tk) => tk + 1);
    } catch (err) {
      console.error("Finance load error:", err);
      toast.error(t.dataLoadError);
    } finally {
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, anchor, monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Current-month attendance % for the debtor list (a "he owes 2 months AND
  // missed 6 lessons" conversation aid). Failure here never blocks the list.
  useEffect(() => {
    if (!centerId || openCharges.length === 0) {
      setAttendanceRates({});
      return;
    }
    let mounted = true;
    fetchCenterSessions(centerId, `${monthKeyOf(todayKey)}-01`, todayKey)
      .then((sessions) => {
        if (!mounted) return;
        const map: Record<string, number | null> = {};
        for (const uid of new Set(openCharges.map((c) => c.studentId))) {
          map[uid] = tallyStudent(sessions, uid, todayKey).rate;
        }
        setAttendanceRates(map);
      })
      .catch(() => mounted && setAttendanceRates(null));
    return () => {
      mounted = false;
    };
  }, [centerId, openCharges, todayKey]);

  const stats = useMemo(() => {
    const confirmed = monthPayments.filter((p) => p.status === "confirmed");
    const collected = confirmed.reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
    const charged = charges.filter((c) => c.status !== "cancelled").reduce((s, c) => s + c.amount, 0);
    const debtTotal = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
    const expensesTotal = expenses.filter((e) => e.status === "active").reduce((s, e) => s + e.amount, 0);
    return { collected, charged, debtTotal, expensesTotal, profit: collected - expensesTotal };
  }, [monthPayments, charges, openCharges, expenses]);

  const unbilledClassTitles = useMemo(
    () => classes.filter((c) => (c.studentIds?.length || 0) > 0 && !(c.monthlyFee && c.monthlyFee > 0)).map((c) => c.title),
    [classes]
  );

  const debtorCount = useMemo(() => new Set(openCharges.map((c) => c.studentId)).size, [openCharges]);
  const monthLabel = monthLabelOf(monthKey, lang);

  // Onboarding: data-driven checklist, disappears once the center is fully set up.
  const guideSteps = useMemo(() => {
    const step1 = classes.some((c) => (c.monthlyFee || 0) > 0);
    const step2 = charges.length > 0 || openCharges.length > 0;
    const step3 = recentPayments.length > 0;
    return { step1, step2, step3, allDone: step1 && step2 && step3 };
  }, [classes, charges, openCharges, recentPayments]);

  if (!centerId || !settings) {
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
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
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

      {!loadingData && !guideSteps.allDone && (
        <StartGuide
          steps={[
            {
              done: guideSteps.step1,
              title: t.guide.step1Title,
              desc: t.guide.step1Desc,
              actionLabel: t.guide.step1Action,
              onAction: () => setTab("settings"),
            },
            {
              done: guideSteps.step2,
              title: t.guide.step2Title,
              desc: t.guide.step2Desc,
              actionLabel: t.guide.step2Action,
              onAction: () => setTab("charges"),
            },
            {
              done: guideSteps.step3,
              title: t.guide.step3Title,
              desc: t.guide.step3Desc,
              actionLabel: t.guide.step3Action,
              onAction: () => setPayModal({ open: true }),
            },
          ]}
        />
      )}

      <GenerateChargesBanner
        anchor={settings.billingAnchor}
        monthKey={monthKey}
        monthLabel={monthLabel}
        refreshToken={bannerToken}
        onGenerated={reload}
      />

      <FinanceStats
        monthLabel={monthLabel}
        collected={stats.collected}
        charged={stats.charged}
        debtTotal={stats.debtTotal}
        avansTotal={avansTotal}
        expensesTotal={stats.expensesTotal}
        profit={stats.profit}
      />

      {/* Switchboard-driven tab bar; sticky under the mobile top bar (56px) so
          it stays reachable while scrolling. */}
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

      {loadingData && tab !== "settings" ? (
        <div className="py-16 flex justify-center text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : tab === "payments" ? (
        <PaymentsTab
          payments={recentPayments}
          onOpenModal={() => setPayModal({ open: true })}
          onChanged={reload}
        />
      ) : tab === "debtors" ? (
        <DebtorsTab
          openCharges={openCharges}
          attendanceRates={attendanceRates}
          todayKey={todayKey}
          classes={classes}
          onRecordPayment={(uid) => setPayModal({ open: true, uid, kind: "student" })}
          onShowStudent={(uid, name) => setInfoStudent({ uid, name })}
        />
      ) : tab === "charges" ? (
        <ChargesTab
          charges={charges}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          unbilledClassTitles={unbilledClassTitles}
          classes={classes}
          onShowStudent={(uid, name) => setInfoStudent({ uid, name })}
          onChanged={reload}
        />
      ) : tab === "payroll" ? (
        <PayrollTab
          monthKey={monthKey}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          onExpensesChanged={reload}
        />
      ) : tab === "expenses" ? (
        <ExpensesTab
          expenses={expenses}
          categories={settings.expenseCategories}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          onChanged={reload}
        />
      ) : (
        <SettingsTab
          settings={settings}
          onSaved={setSettings}
          classes={classes}
          onClassesChanged={() => {
            refetchClasses();
            reload();
          }}
        />
      )}

      {/* Mobile FAB — the #1 action (record a payment) is always one thumb away. */}
      <button
        onClick={() => setPayModal({ open: true })}
        aria-label={t.fabLabel}
        className="sm:hidden fixed bottom-5 right-4 z-40 w-14 h-14 rounded-full bg-primary text-on-primary shadow-elev-3 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {payModal.open && !payModal.kind && (
        <PaymentKindSheet
          onPick={(kind) => setPayModal((m) => ({ ...m, kind }))}
          onClose={() => setPayModal({ open: false })}
        />
      )}

      {payModal.open && payModal.kind === "student" && (
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

      {payModal.open && payModal.kind === "teacher" && (
        <RecordTeacherPayoutModal
          teachers={teachers}
          monthKey={monthKeyOf(todayKey)}
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
          onClose={() => setInfoStudent(null)}
          onRecordPayment={(uid) => {
            setInfoStudent(null);
            setPayModal({ open: true, uid, kind: "student" });
          }}
        />
      )}
    </div>
  );
}
