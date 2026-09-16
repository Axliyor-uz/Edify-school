"use client";

/**
 * Multi-branch owner view (docs/MANAGER.md § "Multi-branch owner view") — a
 * read-only comparison table across every branch this owner can operate, each
 * row reusing the EXACT same already-centerId-scoped fetchers/helpers the
 * single-branch dashboard uses (`computeFinanceStats`, `rateOfSessions`) —
 * zero new aggregation logic, just looped once per branch. Only ever rendered
 * when the manager has more than one branch (app/manager/layout.tsx hides the
 * nav item otherwise), so a single-branch manager never sees this page change
 * anything about their experience.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeftRight, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { fetchMyBranches, switchBranchApi } from "@/services/branchService";
import {
  fetchChargesForMonth,
  fetchExpensesForMonth,
  fetchFinanceSettings,
  fetchOpenCharges,
  fetchPaymentsForMonth,
} from "@/services/financeService";
import { computeFinanceStats } from "@/lib/finance/financeStats";
import { fetchCenterSessions, rateOfSessions } from "@/services/attendanceService";
import { getTodayKey, monthKeyOf } from "@/lib/dateUtils";
import { formatUZS } from "@/lib/finance/money";
import { Button, EmptyState, PageHeader, Spinner, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import type { BranchSummary } from "@/types/branch";

const T_UZ = {
  title: "Filiallar",
  subtitle: "Sizga tegishli barcha filiallarni taqqoslang",
  loadError: "Filiallarni yuklashda xatolik.",
  switchError: "Filialni almashtirishda xatolik.",
  current: "Joriy",
  switchAction: "O'tish",
  switching: "O'tilmoqda...",
  revenue: "Tushum (shu oy)",
  expenses: "Xarajat (shu oy)",
  profit: "Foyda (shu oy)",
  debt: "Qarzdorlik",
  attendance: "Davomat (shu oy)",
  emptyTitle: "Boshqa filiallar yo'q",
  emptyDesc: "Sizga faqat bitta filial biriktirilgan.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    title: "Branches",
    subtitle: "Compare every branch you can operate",
    loadError: "Failed to load branches.",
    switchError: "Failed to switch branch.",
    current: "Current",
    switchAction: "Switch",
    switching: "Switching...",
    revenue: "Revenue (this month)",
    expenses: "Expenses (this month)",
    profit: "Profit (this month)",
    debt: "Debt",
    attendance: "Attendance (this month)",
    emptyTitle: "No other branches",
    emptyDesc: "Only one branch is linked to you.",
  },
  ru: {
    title: "Филиалы",
    subtitle: "Сравните все филиалы, которыми вы управляете",
    loadError: "Не удалось загрузить филиалы.",
    switchError: "Не удалось переключить филиал.",
    current: "Текущий",
    switchAction: "Переключить",
    switching: "Переключение...",
    revenue: "Доход (за этот месяц)",
    expenses: "Расход (за этот месяц)",
    profit: "Прибыль (за этот месяц)",
    debt: "Задолженность",
    attendance: "Посещаемость (за этот месяц)",
    emptyTitle: "Других филиалов нет",
    emptyDesc: "К вам привязан только один филиал.",
  },
};

interface BranchRow extends BranchSummary {
  collected: number;
  expensesTotal: number;
  profit: number;
  debtTotal: number;
  attendanceRate: number | null;
}

export default function BranchesPage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      if (p?.centerId) setCenterId(p.centerId);
    });
  }, [user]);

  const reload = useCallback(async () => {
    if (!user || !centerId) return;
    setLoading(true);
    try {
      const branches = await fetchMyBranches(user.uid, centerId);
      const today = getTodayKey();
      const monthKey = monthKeyOf(today);
      const monthStart = `${monthKey}-01`;

      const detailed = await Promise.all(
        branches.map(async (b): Promise<BranchRow> => {
          try {
            const settings = await fetchFinanceSettings(b.centerId);
            const [charges, monthPayments, openCharges, expenses, sessions] = await Promise.all([
              fetchChargesForMonth(b.centerId, monthKey, settings.billingAnchor),
              fetchPaymentsForMonth(b.centerId, monthKey),
              fetchOpenCharges(b.centerId),
              fetchExpensesForMonth(b.centerId, monthKey),
              fetchCenterSessions(b.centerId, monthStart, today),
            ]);
            const stats = computeFinanceStats({ charges, monthPayments, openCharges, expenses });
            return {
              ...b,
              collected: stats.collected,
              expensesTotal: stats.expensesTotal,
              profit: stats.profit,
              debtTotal: stats.debtTotal,
              attendanceRate: rateOfSessions(sessions, today).rate,
            };
          } catch (err) {
            console.error(`Branch stats error (${b.centerId}):`, err);
            return { ...b, collected: 0, expensesTotal: 0, profit: 0, debtTotal: 0, attendanceRate: null };
          }
        })
      );
      setRows(detailed);
    } catch (err) {
      console.error("Branches load error:", err);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, centerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const switchTo = async (targetCenterId: string) => {
    setSwitchingId(targetCenterId);
    try {
      await switchBranchApi(targetCenterId);
      // Hard navigation: app/manager/layout.tsx resolves centerId once per
      // mount, so a soft client-side route change would keep showing the
      // PREVIOUS branch's data until a manual reload.
      window.location.assign("/manager/dashboard");
    } catch (err: any) {
      toast.error(err.message || t.switchError);
      setSwitchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {loading || !rows ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size={28} />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState icon={<Building2 />} title={t.emptyTitle} description={t.emptyDesc} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.centerId} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <p className="text-[14.5px] font-bold text-on-surface truncate">{r.centerName}</p>
                </div>
                {r.isActive && (
                  <StatusChip tone="success" noDot className="shrink-0">
                    {t.current}
                  </StatusChip>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stat label={t.revenue} value={formatUZS(r.collected)} tone="text-success" />
                <Stat label={t.expenses} value={formatUZS(r.expensesTotal)} tone="text-error" />
                <Stat label={t.profit} value={formatUZS(r.profit)} tone={r.profit >= 0 ? "text-success" : "text-error"} />
                <Stat label={t.debt} value={formatUZS(r.debtTotal)} tone={r.debtTotal > 0 ? "text-error" : "text-on-surface"} />
              </div>
              <Stat label={t.attendance} value={r.attendanceRate === null ? "—" : `${r.attendanceRate}%`} tone="text-tertiary" wide />

              {!r.isActive && (
                <Button
                  variant="tonal"
                  icon={<ArrowLeftRight size={15} />}
                  loading={switchingId === r.centerId}
                  onClick={() => switchTo(r.centerId)}
                  className="w-full"
                >
                  {switchingId === r.centerId ? t.switching : t.switchAction}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, wide }: { label: string; value: string; tone: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="text-[11px] font-semibold text-on-surface-variant">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
