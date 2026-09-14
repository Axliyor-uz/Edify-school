'use client';

// ─── Teacher's own salary ────────────────────────────────────────────────────
// Everything here comes from GET /api/teacher/payroll (Admin SDK). The finance
// collections stay manager-only in firestore.rules — never query `center_payouts`
// from the client (docs/FINANCE.md).
//
// Only APPROVED payouts are shown. The current month is intentionally blank
// until the manager approves it: the live figure depends on center revenue the
// teacher must not see, and showing an unapproved number would read as a promise.

import { useEffect, useState } from 'react';
import {
  Wallet, CircleDollarSign, CheckCircle2, Clock, Percent, CalendarCheck, Coins, Info,
} from 'lucide-react';
import { Banner, EmptyState, StatTile, StatusChip, Skeleton, cn } from '@/components/ui';
import { monthKeyOf, getTodayKey } from '@/lib/dateUtils';

const T: Record<string, any> = {
  uz: {
    title: 'Oyligim', config: 'Oylik shartlari', history: "To'lovlar tarixi",
    fixed: 'Fiks oylik', percent: 'Foiz', perLesson: 'Har bir dars uchun',
    noConfig: 'Oylik shartlari belgilanmagan',
    noConfigDesc: "Markaz menejeri oylik shartlaringizni kiritganda ular shu yerda ko'rinadi.",
    thisMonth: 'Shu oy', pending: 'Hisoblanmoqda', approved: 'Tasdiqlangan', paid: "To'langan",
    pendingDesc: "Bu oylik hali menejer tomonidan tasdiqlanmagan.",
    totalPaid: "Jami olingan", sum: "so'm", lessons: 'dars',
    breakdown: 'Hisob-kitob', bonus: "Qo'shimcha", penalty: 'Jarima',
    noHistory: "Hali to'lov yo'q",
    noHistoryDesc: "Menejer birinchi oylikni tasdiqlaganda u shu yerda ko'rinadi.",
    readOnly: "Bu ma'lumot faqat ko'rish uchun. Savollar bo'lsa markaz menejeriga murojaat qiling.",
  },
  en: {
    title: 'My salary', config: 'Salary terms', history: 'Payout history',
    fixed: 'Fixed monthly', percent: 'Percentage', perLesson: 'Per lesson',
    noConfig: 'No salary terms set',
    noConfigDesc: 'Your terms appear here once the center manager configures them.',
    thisMonth: 'This month', pending: 'Being calculated', approved: 'Approved', paid: 'Paid',
    pendingDesc: 'This month has not been approved by your manager yet.',
    totalPaid: 'Total received', sum: 'UZS', lessons: 'lessons',
    breakdown: 'Breakdown', bonus: 'Bonus', penalty: 'Penalty',
    noHistory: 'No payouts yet',
    noHistoryDesc: 'Your first approved payout will appear here.',
    readOnly: 'Read-only. Contact your center manager with any questions.',
  },
  ru: {
    title: 'Моя зарплата', config: 'Условия оплаты', history: 'История выплат',
    fixed: 'Фиксированная', percent: 'Процент', perLesson: 'За занятие',
    noConfig: 'Условия не заданы',
    noConfigDesc: 'Условия появятся, когда менеджер центра их настроит.',
    thisMonth: 'Этот месяц', pending: 'Рассчитывается', approved: 'Утверждено', paid: 'Выплачено',
    pendingDesc: 'Этот месяц ещё не утверждён менеджером.',
    totalPaid: 'Всего получено', sum: 'сум', lessons: 'занятий',
    breakdown: 'Расчёт', bonus: 'Бонус', penalty: 'Штраф',
    noHistory: 'Выплат пока нет',
    noHistoryDesc: 'Первая утверждённая выплата появится здесь.',
    readOnly: 'Только для просмотра. По вопросам обращайтесь к менеджеру центра.',
  },
};

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

interface PayoutView {
  id: string;
  periodKey: string;
  breakdown?: {
    fixed: number;
    percent: { rate: number; baseAmount: number; amount: number };
    perLesson: { count: number; rate: number; amount: number };
  };
  calculatedAmount: number;
  adjustment: number;
  adjustmentNote?: string;
  finalAmount: number;
  status: 'approved' | 'paid';
  paidAt?: string;
}

interface PayrollData {
  salary: { fixed?: number; percent?: number; perLesson?: number };
  payouts: PayoutView[];
  totalPaid: number;
}

export default function SalaryTab({ token, lang }: { token: string | null; lang: string }) {
  const t = T[lang] || T.uz;

  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [thisMonthKey] = useState(() => monthKeyOf(getTodayKey()));

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    fetch('/api/teacher/payroll', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('payroll'))))
      .then((json) => {
        if (!mounted) return;
        setData({ salary: json.salary || {}, payouts: json.payouts || [], totalPaid: json.totalPaid || 0 });
      })
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-m3-lg" />
        <Skeleton className="h-40 w-full rounded-m3-lg" />
      </div>
    );
  }

  if (error || !data) {
    return <EmptyState icon={<Wallet size={28} strokeWidth={2.5} />} title={t.noConfig} description={t.noConfigDesc} />;
  }

  const { salary, payouts, totalPaid } = data;
  const hasConfig = !!(salary.fixed || salary.percent || salary.perLesson);
  const current = payouts.find((p) => p.periodKey === thisMonthKey) || null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── This month + total received ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-m3-lg bg-surface-container-low p-4 shadow-elev-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
              {t.thisMonth}
            </span>
            {current ? (
              <StatusChip tone={current.status === 'paid' ? 'success' : 'info'} noDot className="gap-1">
                {current.status === 'paid'
                  ? <><CheckCircle2 size={12} strokeWidth={3} /> {t.paid}</>
                  : <><Clock size={12} strokeWidth={3} /> {t.approved}</>}
              </StatusChip>
            ) : (
              <StatusChip tone="muted">{t.pending}</StatusChip>
            )}
          </div>
          <p className="mt-2 text-[24px] font-extrabold leading-none text-on-surface tabular-nums">
            {current ? `${fmt(current.finalAmount)}` : '—'}
            {current && <span className="ml-1 text-[13px] font-bold text-on-surface-variant">{t.sum}</span>}
          </p>
          {!current && (
            <p className="mt-1.5 text-[11.5px] font-medium text-on-surface-variant">{t.pendingDesc}</p>
          )}
        </div>

        <StatTile
          label={t.totalPaid}
          value={`${fmt(totalPaid)} ${t.sum}`}
          icon={<CircleDollarSign size={16} strokeWidth={2.8} />}
        />
      </div>

      {/* ── Salary terms ── */}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 px-1 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
          <Coins size={15} strokeWidth={3} className="text-primary" /> {t.config}
        </h3>
        {!hasConfig ? (
          <EmptyState icon={<Wallet size={26} strokeWidth={2.5} />} title={t.noConfig} description={t.noConfigDesc} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {salary.fixed ? (
              <TermCard icon={<Wallet size={16} strokeWidth={2.5} />} label={t.fixed} value={`${fmt(salary.fixed)} ${t.sum}`} />
            ) : null}
            {salary.percent ? (
              <TermCard icon={<Percent size={16} strokeWidth={2.5} />} label={t.percent} value={`${salary.percent}%`} />
            ) : null}
            {salary.perLesson ? (
              <TermCard icon={<CalendarCheck size={16} strokeWidth={2.5} />} label={t.perLesson} value={`${fmt(salary.perLesson)} ${t.sum}`} />
            ) : null}
          </div>
        )}
      </section>

      {/* ── History ── */}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 px-1 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
          <Wallet size={15} strokeWidth={3} className="text-primary" /> {t.history}
        </h3>
        {payouts.length === 0 ? (
          <EmptyState icon={<Wallet size={26} strokeWidth={2.5} />} title={t.noHistory} description={t.noHistoryDesc} />
        ) : (
          <ul className="flex flex-col gap-2">
            {payouts.map((p) => <PayoutRow key={p.id} payout={p} t={t} />)}
          </ul>
        )}
      </section>

      <Banner tone="info" icon={<Info size={16} />}>{t.readOnly}</Banner>
    </div>
  );
}

function TermCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-m3-md bg-surface-container-low p-3 shadow-elev-1">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm bg-primary-container text-on-primary-container">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-black uppercase tracking-wider text-on-surface-variant">{label}</p>
        <p className="truncate text-[14px] font-extrabold text-on-surface tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function PayoutRow({ payout, t }: { payout: PayoutView; t: any }) {
  const [open, setOpen] = useState(false);
  const b = payout.breakdown;

  return (
    <li className="overflow-hidden rounded-m3-md bg-surface-container-low shadow-elev-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-state-hover"
      >
        <span className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-m3-sm',
          payout.status === 'paid'
            ? 'bg-success-container text-on-success-container'
            : 'bg-surface-container-high text-on-surface-variant',
        )}>
          {payout.status === 'paid' ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <Clock size={18} strokeWidth={2.5} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-on-surface tabular-nums">{payout.periodKey}</p>
          <p className="text-[11.5px] font-semibold text-on-surface-variant">
            {payout.status === 'paid' ? `${t.paid}${payout.paidAt ? ` · ${payout.paidAt}` : ''}` : t.approved}
          </p>
        </div>

        <span className="shrink-0 text-right text-[14px] font-extrabold text-on-surface tabular-nums">
          {fmt(payout.finalAmount)}
          <span className="ml-1 text-[11px] font-bold text-on-surface-variant">{t.sum}</span>
        </span>
      </button>

      {open && b && (
        <div className="border-t border-outline-variant px-3.5 py-3">
          <p className="mb-2 text-[10.5px] font-black uppercase tracking-wider text-on-surface-variant">
            {t.breakdown}
          </p>
          <dl className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            {b.fixed > 0 && <Line label={t.fixed} value={`${fmt(b.fixed)} ${t.sum}`} />}
            {b.percent.rate > 0 && (
              <Line label={`${t.percent} · ${b.percent.rate}%`} value={`${fmt(b.percent.amount)} ${t.sum}`} />
            )}
            {b.perLesson.rate > 0 && (
              <Line
                label={`${t.perLesson} · ${b.perLesson.count} ${t.lessons}`}
                value={`${fmt(b.perLesson.amount)} ${t.sum}`}
              />
            )}
            {payout.adjustment !== 0 && (
              <Line
                label={`${payout.adjustment > 0 ? t.bonus : t.penalty}${payout.adjustmentNote ? ` · ${payout.adjustmentNote}` : ''}`}
                value={`${payout.adjustment > 0 ? '+' : '−'}${fmt(Math.abs(payout.adjustment))} ${t.sum}`}
                tone={payout.adjustment > 0 ? 'success' : 'error'}
              />
            )}
          </dl>
        </div>
      )}
    </li>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'error' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="min-w-0 text-on-surface-variant">{label}</dt>
      <dd className={cn(
        'shrink-0 tabular-nums',
        tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-on-surface',
      )}>
        {value}
      </dd>
    </div>
  );
}
