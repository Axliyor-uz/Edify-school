"use client";

/**
 * OFFICE → O'qituvchilar (docs/OFFICE.md).
 *
 * The "school info" half of the panel: every teacher of the center on one row
 * with their groups, this month's attendance, and this month's salary. Strictly
 * READ-ONLY for both roles — approving or paying a payout stays in the manager
 * panel's Oyliklar tab, so this view can never move money.
 *
 * Three sources, all already used elsewhere:
 *   • `center_teachers` (via useCenterClasses) — the employment roster
 *   • `center_staff_attendance` (fetchStaffSessions) — the month board's data
 *   • `/payroll/calculate` — the SAME live figures the manager's Oyliklar tab
 *     shows. It writes nothing, which is why a director may call it.
 *
 * ⚠️ A live-calculated amount is NOT an agreed salary. Rows carry the payout
 * status (`tasdiqlanmagan` / `tasdiqlangan` / `to'langan`) so a director never
 * mistakes a preview for something the manager has approved — same reasoning as
 * FINANCE.md §9.1, where the teacher's own view deliberately hides live numbers.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  Loader2,
  Wallet,
} from "lucide-react";
import type { CenterTeacher, ClassData } from "@/hooks/useCenterClasses";
import { fetchStaffSessions, type StaffSession } from "@/services/attendanceService";
import { calculatePayrollApi } from "@/services/financeService";
import type { PayrollRow } from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { EmptyState, StatTile, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import MonthNav from "@/app/manager/finance/_components/MonthNav";

interface Props {
  centerId: string;
  teachers: CenterTeacher[];
  classes: ClassData[];
  /** "YYYY-MM" — the page's browsed month, shared with the finance tabs. */
  monthKey: string;
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
}

const T_UZ = {
  title: "O'qituvchilar",
  staffCount: (n: number) => `${n} ta o'qituvchi`,
  emptyTitle: "O'qituvchilar yo'q",
  emptyDesc: "Markazga hali o'qituvchi biriktirilmagan.",
  statTeachers: "O'qituvchilar",
  statAttendance: "O'rtacha davomat",
  statPayroll: "Oylik jamg'armasi",
  groups: (n: number) => `${n} ta guruh`,
  noGroups: "Guruhsiz",
  attendanceCol: "Davomat",
  salaryCol: "Oylik",
  daysWorked: (p: number, total: number) => `${p}/${total} kun`,
  hours: (h: number) => `${h} soat`,
  noAttendance: "Belgilanmagan",
  payoutNone: "Tasdiqlanmagan",
  payoutApproved: "Tasdiqlangan",
  payoutPaid: "To'langan",
  noSalaryConfig: "Oylik belgilanmagan",
  breakdownFixed: "Belgilangan",
  breakdownPercent: (rate: number) => `Foiz (${rate}%)`,
  breakdownPerLesson: (count: number, rate: number) => `Darslar (${count} × ${formatUZS(rate)})`,
  adjustment: "Bonus / jarima",
  payrollError: "Oyliklarni yuklashda xatolik.",
  attendanceError: "Davomatni yuklashda xatolik.",
  readOnlyNote: "Bu sahifa faqat ko'rish uchun — oyliklar menejer panelida tasdiqlanadi.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    title: "Teachers",
    staffCount: (n) => `${n} teachers`,
    emptyTitle: "No teachers",
    emptyDesc: "No teacher is linked to this center yet.",
    statTeachers: "Teachers",
    statAttendance: "Average attendance",
    statPayroll: "Payroll total",
    groups: (n) => `${n} groups`,
    noGroups: "No groups",
    attendanceCol: "Attendance",
    salaryCol: "Salary",
    daysWorked: (p, total) => `${p}/${total} days`,
    hours: (h) => `${h} h`,
    noAttendance: "Not marked",
    payoutNone: "Not approved",
    payoutApproved: "Approved",
    payoutPaid: "Paid",
    noSalaryConfig: "No salary configured",
    breakdownFixed: "Fixed",
    breakdownPercent: (rate) => `Percent (${rate}%)`,
    breakdownPerLesson: (count, rate) => `Lessons (${count} × ${formatUZS(rate)})`,
    adjustment: "Bonus / penalty",
    payrollError: "Failed to load payroll.",
    attendanceError: "Failed to load attendance.",
    readOnlyNote: "This page is read-only — salaries are approved in the manager panel.",
  },
  ru: {
    title: "Учителя",
    staffCount: (n) => `${n} учителей`,
    emptyTitle: "Нет учителей",
    emptyDesc: "К центру ещё не привязан ни один учитель.",
    statTeachers: "Учителя",
    statAttendance: "Средняя посещаемость",
    statPayroll: "Фонд зарплаты",
    groups: (n) => `${n} групп`,
    noGroups: "Без групп",
    attendanceCol: "Посещаемость",
    salaryCol: "Зарплата",
    daysWorked: (p, total) => `${p}/${total} дней`,
    hours: (h) => `${h} ч`,
    noAttendance: "Не отмечено",
    payoutNone: "Не утверждено",
    payoutApproved: "Утверждено",
    payoutPaid: "Выплачено",
    noSalaryConfig: "Зарплата не задана",
    breakdownFixed: "Фиксированная",
    breakdownPercent: (rate) => `Процент (${rate}%)`,
    breakdownPerLesson: (count, rate) => `Уроки (${count} × ${formatUZS(rate)})`,
    adjustment: "Бонус / штраф",
    payrollError: "Не удалось загрузить зарплаты.",
    attendanceError: "Не удалось загрузить посещаемость.",
    readOnlyNote: "Страница только для чтения — зарплаты утверждаются в панели менеджера.",
  },
};

/** Attendance rate over MARKED days only, excusing `leave`/`holiday` —
 *  the staff twin of ATTENDANCE.md rule #6 (an approved day off must not
 *  count against the teacher). */
function staffTally(sessions: StaffSession[]) {
  let attended = 0;
  let denom = 0;
  let hours = 0;
  for (const s of sessions) {
    if (s.status === "leave" || s.status === "holiday") continue;
    denom += 1;
    if (s.status === "present" || s.status === "late") attended += 1;
    hours += s.hoursWorked || 0;
  }
  return {
    attended,
    denom,
    hours: Math.round(hours * 10) / 10,
    rate: denom === 0 ? null : Math.round((attended / denom) * 100),
  };
}

export default function OfficeTeachersTab({
  centerId,
  teachers,
  classes,
  monthKey,
  monthLabel,
  onShiftMonth,
}: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];

  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const todayKey = useMemo(() => getTodayKey(), []);

  useEffect(() => {
    if (!centerId) return;
    let alive = true;
    setLoading(true);
    setErrors([]);

    // The month window never runs past today: an unmarked future day is not an
    // absence, and counting it would drag every rate down as the month starts.
    const monthStart = `${monthKey}-01`;
    const [y, m] = monthKey.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEndRaw = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
    const monthEnd = monthEndRaw > todayKey ? todayKey : monthEndRaw;

    // Settled independently: a payroll failure must not blank the attendance
    // column (and vice versa) — each half degrades on its own.
    Promise.allSettled([
      monthStart > monthEnd
        ? Promise.resolve<StaffSession[]>([])
        : fetchStaffSessions(centerId, monthStart, monthEnd),
      calculatePayrollApi(monthKey),
    ]).then(([att, pay]) => {
      if (!alive) return;
      const errs: string[] = [];
      if (att.status === "fulfilled") setSessions(att.value);
      else {
        setSessions([]);
        errs.push(t.attendanceError);
      }
      if (pay.status === "fulfilled") setPayroll(pay.value.rows);
      else {
        setPayroll([]);
        errs.push(t.payrollError);
      }
      setErrors(errs);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, monthKey, todayKey]);

  const byTeacher = useMemo(() => {
    const att = new Map<string, StaffSession[]>();
    for (const s of sessions) {
      const arr = att.get(s.staffUid);
      if (arr) arr.push(s);
      else att.set(s.staffUid, [s]);
    }
    const pay = new Map(payroll.map((r) => [r.teacherId, r]));
    const groups = new Map<string, ClassData[]>();
    for (const c of classes) {
      if (!c.teacherId) continue;
      const arr = groups.get(c.teacherId);
      if (arr) arr.push(c);
      else groups.set(c.teacherId, [c]);
    }

    return teachers
      .map((teacher) => ({
        teacher,
        tally: staffTally(att.get(teacher.teacherId) || []),
        row: pay.get(teacher.teacherId) || null,
        groups: groups.get(teacher.teacherId) || [],
      }))
      .sort((a, b) => a.teacher.teacherName.localeCompare(b.teacher.teacherName));
  }, [teachers, sessions, payroll, classes]);

  const totals = useMemo(() => {
    const rated = byTeacher.filter((r) => r.tally.rate !== null);
    const avgRate =
      rated.length === 0
        ? null
        : Math.round(rated.reduce((s, r) => s + (r.tally.rate as number), 0) / rated.length);
    // The payout the center is actually on the hook for: an approved/paid
    // payout is the agreed number, otherwise the live calculation.
    const payrollTotal = byTeacher.reduce(
      (s, r) => s + (r.row ? (r.row.payout?.finalAmount ?? r.row.calculatedAmount) : 0),
      0
    );
    return { avgRate, payrollTotal };
  }, [byTeacher]);

  const payoutChip = (row: PayrollRow | null) => {
    if (!row || !row.payout) return { tone: "muted" as const, label: t.payoutNone };
    if (row.payout.status === "paid") return { tone: "success" as const, label: t.payoutPaid };
    return { tone: "info" as const, label: t.payoutApproved };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        <p className="text-[12.5px] text-on-surface-variant">{t.staffCount(teachers.length)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <StatTile icon={<GraduationCap />} label={t.statTeachers} value={String(teachers.length)} />
        <StatTile
          icon={<CalendarCheck />}
          label={t.statAttendance}
          value={totals.avgRate === null ? "—" : `${totals.avgRate}%`}
          delta={monthLabel}
        />
        <StatTile
          icon={<Wallet />}
          label={t.statPayroll}
          value={formatUZS(totals.payrollTotal)}
          delta={monthLabel}
        />
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-m3-lg bg-error-container text-on-error-container">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-[12.5px] font-medium">{errors.join(" ")}</p>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-on-surface-variant">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : byTeacher.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState icon={<GraduationCap />} title={t.emptyTitle} description={t.emptyDesc} />
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
          {byTeacher.map(({ teacher, tally, row, groups }) => {
            const chip = payoutChip(row);
            const amount = row ? (row.payout?.finalAmount ?? row.calculatedAmount) : 0;
            const hasSalary = !!row && (row.config.fixed || row.config.percent || row.config.perLesson);
            const open = expanded === teacher.teacherId;
            return (
              <div key={teacher.teacherId}>
                <button
                  onClick={() => setExpanded(open ? null : teacher.teacherId)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-state-hover transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 text-[12.5px] font-bold">
                    {teacher.teacherName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-semibold text-on-surface truncate">
                      {teacher.teacherName}
                    </p>
                    <p className="text-[12.5px] text-on-surface-variant mt-0.5 truncate">
                      {groups.length > 0 ? t.groups(groups.length) : t.noGroups}
                      {tally.denom > 0 && ` · ${t.daysWorked(tally.attended, tally.denom)}`}
                    </p>
                  </div>

                  <div className="hidden sm:block text-right shrink-0 w-24">
                    <p className="text-[13px] font-bold tabular-nums text-on-surface">
                      {tally.rate === null ? "—" : `${tally.rate}%`}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">{t.attendanceCol}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-bold tabular-nums text-on-surface">
                      {hasSalary ? formatUZS(amount) : "—"}
                    </p>
                    <StatusChip tone={chip.tone} noDot className="mt-0.5">
                      {chip.label}
                    </StatusChip>
                  </div>

                  <ChevronDown
                    size={16}
                    className={`text-on-surface-variant shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 bg-surface-container-low space-y-3">
                    {/* Attendance detail */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                      <span className="text-on-surface-variant">
                        {t.attendanceCol}:{" "}
                        <b className="text-on-surface tabular-nums">
                          {tally.denom === 0
                            ? t.noAttendance
                            : `${t.daysWorked(tally.attended, tally.denom)} · ${tally.rate}%`}
                        </b>
                      </span>
                      {tally.hours > 0 && (
                        <span className="text-on-surface-variant">
                          <b className="text-on-surface tabular-nums">{t.hours(tally.hours)}</b>
                        </span>
                      )}
                    </div>

                    {/* Salary breakdown — mirrors the manager's Oyliklar rows */}
                    {!hasSalary || !row ? (
                      <p className="text-[12.5px] text-on-surface-variant">{t.noSalaryConfig}</p>
                    ) : (
                      <div className="space-y-1">
                        {row.breakdown.fixed > 0 && (
                          <BreakRow label={t.breakdownFixed} amount={row.breakdown.fixed} />
                        )}
                        {row.breakdown.percent.amount > 0 && (
                          <BreakRow
                            label={t.breakdownPercent(row.breakdown.percent.rate)}
                            amount={row.breakdown.percent.amount}
                            note={formatUZS(row.breakdown.percent.baseAmount)}
                          />
                        )}
                        {row.breakdown.perLesson.amount > 0 && (
                          <BreakRow
                            label={t.breakdownPerLesson(
                              row.breakdown.perLesson.count,
                              row.breakdown.perLesson.rate
                            )}
                            amount={row.breakdown.perLesson.amount}
                          />
                        )}
                        {row.payout && row.payout.adjustment !== 0 && (
                          <BreakRow
                            label={`${t.adjustment}${row.payout.adjustmentNote ? ` · ${row.payout.adjustmentNote}` : ""}`}
                            amount={row.payout.adjustment}
                            signed
                          />
                        )}
                      </div>
                    )}

                    {/* Groups */}
                    {groups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {groups.map((g) => (
                          <span
                            key={g.id}
                            className="px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-[11.5px] font-medium"
                          >
                            {g.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-on-surface-variant px-1.5">{t.readOnlyNote}</p>
    </div>
  );
}

function BreakRow({
  label,
  amount,
  note,
  signed,
}: {
  label: string;
  amount: number;
  note?: string;
  signed?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-on-surface-variant truncate">
        {label}
        {note && <span className="opacity-70"> · {note}</span>}
      </span>
      <span
        className={`text-[12.5px] font-bold tabular-nums shrink-0 ${
          signed && amount < 0 ? "text-error" : "text-on-surface"
        }`}
      >
        {signed && amount > 0 ? "+" : ""}
        {formatUZS(amount)}
      </span>
    </div>
  );
}
