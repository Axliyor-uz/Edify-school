"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  Users, CheckCircle, CalendarDays, Clock, AlertTriangle, TrendingUp,
  ArrowRight, GraduationCap, UserPlus, DoorOpen, Banknote, Wallet,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { fetchCenterSessions, rateOfSessions, tallyStudent, type CenterSession } from "@/services/attendanceService";
import { fetchOpenCharges, fetchPaymentsForMonth, openAmountOf } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { PageHeader, EmptyState, Spinner, staggerContainer, staggerItem } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

// Locale for the header date line only (attendance time math stays en-GB/Tashkent).
const DATE_LOCALE: Record<LangType, string> = { uz: "uz-UZ", en: "en-US", ru: "ru-RU" };

const TRANSLATIONS = {
  uz: {
    title: "Boshqaruv paneli",
    acceptPayment: "To'lov qabul qilish",
    markAttendance: "Davomat belgilash",
    kpi: {
      students: "O'quvchilar",
      groupsCount: (n: number) => `${n} guruh`,
      income: "Tushum",
      thisMonth: "shu oy",
      debt: "Qarzdorlik",
      debtors: (n: number) => `${n} ta qarzdor`,
      total: "jami",
      todayAttendance: "Bugungi davomat",
      markedLessons: "belgilangan darslar",
      notMarkedYet: "hali belgilanmagan",
      monthlyAttendance: "Oylik davomat",
      monthAvg: "shu oy o'rtacha",
      needsAttention: "E'tibor talab",
      lowAttendance: "past davomatli o'quvchi",
    },
    todayLessons: "Bugungi darslar",
    roomsBusy: (used: number, total: number) => `${used}/${total} xona band`,
    all: "Barchasi",
    noLessonsToday: "Bugun dars yo'q",
    noLessonsTodayDesc: "Jadval bo'yicha bugunga dars rejalashtirilmagan",
    noTeacher: "O'qituvchi yo'q",
    markedOf: (marked: number, total: number) => `${marked}/${total} belgilandi`,
    needsAttention: "E'tibor talab",
    allGood: "Hammasi joyida",
    noLowAttendance: "Past davomatli o'quvchi yo'q",
    loading: "Yuklanmoqda...",
    absentTimes: (n: number) => `${n} marta kelmagan`,
    unknown: "Noma'lum",
    allStudents: "Barcha o'quvchilar",
    paymentsAndDebtors: "To'lovlar va qarzdorlar",
    groupAttendance: "Guruhlar bo'yicha davomat",
    noGroups: "Guruhlar yo'q",
  },
  en: {
    title: "Dashboard",
    acceptPayment: "Accept payment",
    markAttendance: "Mark attendance",
    kpi: {
      students: "Students",
      groupsCount: (n: number) => `${n} groups`,
      income: "Revenue",
      thisMonth: "this month",
      debt: "Debt",
      debtors: (n: number) => `${n} debtors`,
      total: "total",
      todayAttendance: "Today's attendance",
      markedLessons: "lessons marked",
      notMarkedYet: "not marked yet",
      monthlyAttendance: "Monthly attendance",
      monthAvg: "month average",
      needsAttention: "Needs attention",
      lowAttendance: "low-attendance students",
    },
    todayLessons: "Today's lessons",
    roomsBusy: (used: number, total: number) => `${used}/${total} rooms in use`,
    all: "View all",
    noLessonsToday: "No lessons today",
    noLessonsTodayDesc: "No lessons are scheduled for today",
    noTeacher: "No teacher",
    markedOf: (marked: number, total: number) => `${marked}/${total} marked`,
    needsAttention: "Needs attention",
    allGood: "All good",
    noLowAttendance: "No students with low attendance",
    loading: "Loading...",
    absentTimes: (n: number) => `missed ${n} times`,
    unknown: "Unknown",
    allStudents: "All students",
    paymentsAndDebtors: "Payments and debtors",
    groupAttendance: "Attendance by group",
    noGroups: "No groups",
  },
  ru: {
    title: "Панель управления",
    acceptPayment: "Принять оплату",
    markAttendance: "Отметить посещаемость",
    kpi: {
      students: "Ученики",
      groupsCount: (n: number) => `${n} групп`,
      income: "Выручка",
      thisMonth: "этот месяц",
      debt: "Задолженность",
      debtors: (n: number) => `должников: ${n}`,
      total: "всего",
      todayAttendance: "Посещаемость сегодня",
      markedLessons: "отмеченные занятия",
      notMarkedYet: "ещё не отмечено",
      monthlyAttendance: "За месяц",
      monthAvg: "среднее за месяц",
      needsAttention: "Требует внимания",
      lowAttendance: "ученики с низкой посещаемостью",
    },
    todayLessons: "Сегодняшние занятия",
    roomsBusy: (used: number, total: number) => `${used}/${total} кабинетов занято`,
    all: "Все",
    noLessonsToday: "Сегодня занятий нет",
    noLessonsTodayDesc: "На сегодня по расписанию занятий нет",
    noTeacher: "Учитель не назначен",
    markedOf: (marked: number, total: number) => `${marked}/${total} отмечено`,
    needsAttention: "Требует внимания",
    allGood: "Всё в порядке",
    noLowAttendance: "Нет учеников с низкой посещаемостью",
    loading: "Загрузка...",
    absentTimes: (n: number) => `пропусков: ${n}`,
    unknown: "Неизвестно",
    allStudents: "Все ученики",
    paymentsAndDebtors: "Платежи и должники",
    groupAttendance: "Посещаемость по группам",
    noGroups: "Групп нет",
  },
};
type T = typeof TRANSLATIONS.uz;

function rateColor(rate: number | null): string {
  if (rate === null) return "text-on-surface-variant";
  if (rate >= 90) return "text-success";
  if (rate >= 75) return "text-warning";
  return "text-error";
}
function rateBar(rate: number | null): string {
  if (rate === null) return "bg-surface-container-highest";
  if (rate >= 90) return "bg-success";
  if (rate >= 75) return "bg-warning";
  return "bg-error";
}
function getInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

interface FinanceSummary {
  collected: number;
  debtTotal: number;
  debtorCount: number;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const today = useMemo(() => getTodayKey(), []);
  const monthStart = useMemo(() => today.slice(0, 8) + "01", [today]);
  const todayWeekday = useMemo(() => parseDateKey(today).getDay(), [today]);

  const currentDate = useMemo(
    () => new Date().toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [lang]
  );

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);
  const { rooms } = useCenterRooms(centerId);

  // Rooms occupied right now (a lesson today whose time window contains the current Tashkent time).
  const nowTime = useMemo(() => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" }), []);
  const roomsInUse = useMemo(() => {
    const inUse = new Set<string>();
    for (const c of classes)
      for (const s of c.schedule || [])
        if (s.dayOfWeek === todayWeekday && s.roomId && s.startTime <= nowTime && nowTime < s.endTime) inUse.add(s.roomId);
    return inUse;
  }, [classes, todayWeekday, nowTime]);

  const [sessions, setSessions] = useState<CenterSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});

  // Month's money snapshot — failure never blocks the attendance widgets.
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeLoading, setFinanceLoading] = useState(true);

  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    setLoadingSessions(true);
    fetchCenterSessions(centerId, monthStart, today)
      .then((s) => { if (mounted) setSessions(s); })
      .catch((e) => console.error(e))
      .finally(() => { if (mounted) setLoadingSessions(false); });
    return () => { mounted = false; };
  }, [centerId, monthStart, today]);

  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    setFinanceLoading(true);
    Promise.all([fetchPaymentsForMonth(centerId, today.slice(0, 7)), fetchOpenCharges(centerId)])
      .then(([pays, open]) => {
        if (!mounted) return;
        const confirmed = pays.filter((p) => p.status === "confirmed");
        setFinance({
          collected: confirmed.reduce((s, p) => s + (p.type === "refund" ? -p.amount : p.amount), 0),
          debtTotal: open.reduce((s, c) => s + openAmountOf(c), 0),
          debtorCount: new Set(open.map((c) => c.studentId)).size,
        });
      })
      .catch((e) => console.error("Dashboard finance error:", e))
      .finally(() => { if (mounted) setFinanceLoading(false); });
    return () => { mounted = false; };
  }, [centerId, today]);

  // Class-roster students — the ones attendance math can say anything about.
  const uniqueStudentIds = useMemo(() => {
    const s = new Set<string>();
    classes.forEach((c) => (c.studentIds || []).forEach((id) => s.add(id)));
    return [...s];
  }, [classes]);

  // Total student KPI is `center_students`-anchored (links ∪ class rosters —
  // same derivation as the students page), so group-less students count too.
  // Falls back to the class-derived count if the link query fails.
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    getDocs(query(collection(db, "center_students"), where("centerId", "==", centerId)))
      .then((snap) => {
        if (mounted) setLinkedStudentIds(snap.docs.map((d) => d.data().studentId).filter(Boolean));
      })
      .catch(() => { if (mounted) setLinkedStudentIds([]); });
    return () => { mounted = false; };
  }, [centerId]);

  const totalStudents = useMemo(
    () => new Set([...uniqueStudentIds, ...(linkedStudentIds || [])]).size,
    [uniqueStudentIds, linkedStudentIds],
  );

  const todaySessions = useMemo(() => sessions.filter((s) => s.date === today), [sessions, today]);
  const todayRate = useMemo(() => rateOfSessions(todaySessions, today).rate, [todaySessions, today]);
  const monthRate = useMemo(() => rateOfSessions(sessions, today).rate, [sessions, today]);

  // Students under 75% with enough data — the ones to watch.
  const chronic = useMemo(() => {
    return uniqueStudentIds
      .map((uid) => ({ uid, t: tallyStudent(sessions, uid, today) }))
      .filter((x) => x.t.rate !== null && x.t.denom >= 3 && (x.t.rate as number) < 75)
      .sort((a, b) => (a.t.rate as number) - (b.t.rate as number));
  }, [uniqueStudentIds, sessions, today]);

  const chronicTop = useMemo(() => chronic.slice(0, 8), [chronic]);

  // Fetch display names for the flagged students only.
  useEffect(() => {
    const need = chronicTop.map((c) => c.uid).filter((id) => !(id in names));
    if (need.length === 0) return;
    let mounted = true;
    Promise.all(need.map((id) => getDoc(doc(db, "users", id)))).then((snaps) => {
      if (!mounted) return;
      setNames((prev) => {
        const m = { ...prev };
        snaps.forEach((s) => { if (s.exists()) m[s.id] = s.data()?.displayName || t.unknown; });
        return m;
      });
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronicTop]);

  const todayLessons = useMemo(() => {
    return classes
      .filter((c) => c.schedule?.some((s) => s.dayOfWeek === todayWeekday))
      .map((c) => {
        const sess = todaySessions.find((s) => s.classId === c.id);
        const marked = sess ? Object.keys(sess.records).length : 0;
        const total = c.studentIds?.length || 0;
        const slot = c.schedule?.find((s) => s.dayOfWeek === todayWeekday);
        const rate = sess ? rateOfSessions([sess], today).rate : null;
        return { id: c.id, title: c.title, teacherName: c.teacherName, slot, marked, total, rate };
      })
      .sort((a, b) => (a.slot?.startTime || "").localeCompare(b.slot?.startTime || ""));
  }, [classes, todaySessions, todayWeekday, today]);

  const groupRates = useMemo(() => {
    return classes
      .map((c) => ({
        id: c.id, title: c.title, teacherName: c.teacherName,
        count: c.studentIds?.length || 0,
        ...rateOfSessions(sessions.filter((s) => s.classId === c.id), today),
      }))
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
  }, [classes, sessions, today]);

  const loading = loadingClasses || loadingSessions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t.title}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" /> {currentDate}
          </span>
        }
        actions={
          <>
            <Link href="/manager/finance" className="inline-flex items-center gap-1.5 h-t-control-sm px-4 bg-primary-container text-on-primary-container hover:shadow-elev-1 rounded-full font-bold text-[13px] transition-all">
              <Banknote size={15} /> {t.acceptPayment}
            </Link>
            <Link href="/manager/attendance" className="inline-flex items-center gap-1.5 h-t-control-sm px-4 bg-primary text-on-primary rounded-full font-bold text-[13px] shadow-elev-1 hover:shadow-elev-2 transition-all">
              <CheckCircle size={15} /> {t.markAttendance}
            </Link>
          </>
        }
      />

      {/* KPI band — one row on desktop, swipeable on mobile (same pattern as FinanceStats) */}
      <motion.div {...staggerContainer} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 xl:grid-cols-6 md:overflow-visible md:pb-0">
        <KpiCard
          href="/manager/students" Icon={Users} label={t.kpi.students} sub={t.kpi.groupsCount(classes.length)}
          tone="success"
          value={loading || linkedStudentIds === null ? null : String(totalStudents)}
        />
        <KpiCard
          href="/manager/finance" Icon={TrendingUp} label={t.kpi.income} sub={t.kpi.thisMonth}
          tone="success"
          value={financeLoading ? null : finance ? formatUZS(finance.collected) : "—"}
          valueClass="text-success"
        />
        <KpiCard
          href="/manager/finance" Icon={Wallet} label={t.kpi.debt} sub={finance ? t.kpi.debtors(finance.debtorCount) : t.kpi.total}
          tone="error"
          value={financeLoading ? null : finance ? formatUZS(finance.debtTotal) : "—"}
          valueClass={finance && finance.debtTotal > 0 ? "text-error" : "text-on-surface"}
        />
        <KpiCard
          href="/manager/attendance" Icon={CheckCircle} label={t.kpi.todayAttendance} sub={todaySessions.length > 0 ? t.kpi.markedLessons : t.kpi.notMarkedYet}
          tone="tertiary"
          value={loading ? null : todayRate === null ? "—" : `${todayRate}%`}
          valueClass={rateColor(todayRate)}
        />
        <KpiCard
          href="/manager/attendance" Icon={CalendarDays} label={t.kpi.monthlyAttendance} sub={t.kpi.monthAvg}
          tone="tertiary"
          value={loading ? null : monthRate === null ? "—" : `${monthRate}%`}
          valueClass={rateColor(monthRate)}
        />
        <KpiCard
          href="/manager/students" Icon={AlertTriangle} label={t.kpi.needsAttention} sub={t.kpi.lowAttendance}
          tone="warning"
          value={loading ? null : String(chronic.length)}
          valueClass={chronic.length > 0 ? "text-error" : "text-on-surface"}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's lessons */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-on-surface tracking-tight">{t.todayLessons}</h2>
              {rooms.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {t.roomsBusy(roomsInUse.size, rooms.length)}
                </span>
              )}
            </div>
            <Link href="/manager/attendance" className="text-[13px] font-bold text-primary hover:underline underline-offset-4 transition-colors">{t.all}</Link>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Spinner size={26} /></div>
            ) : todayLessons.length === 0 ? (
              <EmptyState
                className="py-14"
                icon={<CalendarDays />}
                title={t.noLessonsToday}
                description={t.noLessonsTodayDesc}
              />
            ) : (
              <div className="divide-y divide-outline-variant">
                {todayLessons.map((l) => {
                  const done = l.total > 0 && l.marked >= l.total;
                  return (
                    <Link key={l.id} href={`/manager/attendance/${l.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-state-hover transition-colors group">
                      <div className="w-16 shrink-0">
                        <div className="flex items-center gap-1 text-[13px] font-bold text-on-surface"><Clock size={13} className="text-primary" />{l.slot?.startTime}</div>
                        <p className="text-[11px] text-on-surface-variant tabular-nums">{l.slot?.endTime}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{l.title}</p>
                        <p className="text-[12px] text-on-surface-variant truncate flex items-center gap-1.5">
                          {l.teacherName || t.noTeacher}
                          {l.slot?.roomName && <span className="inline-flex items-center gap-0.5 text-primary font-semibold"><DoorOpen size={11} /> {l.slot.roomName}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {l.rate !== null && <p className={`text-[14px] font-bold tabular-nums ${rateColor(l.rate)}`}>{l.rate}%</p>}
                        <p className={`text-[11px] font-semibold ${done ? "text-success" : "text-on-surface-variant"} tabular-nums`}>{t.markedOf(l.marked, l.total)}</p>
                      </div>
                      <ArrowRight size={16} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Watch list */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-error" />
            <h2 className="text-[16px] font-bold text-on-surface tracking-tight">{t.needsAttention}</h2>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-2">
            {loading ? (
              <div className="flex items-center justify-center py-14"><Spinner size={22} /></div>
            ) : chronicTop.length === 0 ? (
              <EmptyState
                className="py-12"
                icon={<CheckCircle />}
                title={t.allGood}
                description={t.noLowAttendance}
              />
            ) : (
              <div className="space-y-0.5">
                {chronicTop.map((c) => (
                  <div key={c.uid} className="flex items-center gap-2.5 px-2.5 py-2 rounded-m3-lg hover:bg-state-hover transition-colors">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-error-container text-on-error-container font-bold text-[11px] flex items-center justify-center">{getInitials(names[c.uid] || "?")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface truncate">{names[c.uid] || t.loading}</p>
                      <p className="text-[11px] text-on-surface-variant tabular-nums">{t.absentTimes(c.t.absent)}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-error tabular-nums">{c.t.rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/manager/students" className="flex items-center justify-between p-3.5 bg-surface-container-lowest border border-outline-variant rounded-m3-xl hover:shadow-elev-1 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container"><UserPlus size={17} /></div>
              <span className="font-bold text-[13px] text-on-surface">{t.allStudents}</span>
            </div>
            <ArrowRight size={16} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
          <Link href="/manager/finance" className="flex items-center justify-between p-3.5 bg-surface-container-lowest border border-outline-variant rounded-m3-xl hover:shadow-elev-1 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container"><Wallet size={17} /></div>
              <span className="font-bold text-[13px] text-on-surface">{t.paymentsAndDebtors}</span>
            </div>
            <ArrowRight size={16} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Per-group rates */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-bold text-on-surface tracking-tight">{t.groupAttendance}</h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-2">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Spinner size={24} /></div>
          ) : groupRates.length === 0 ? (
            <p className="text-center text-[13px] text-on-surface-variant py-10">{t.noGroups}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {groupRates.map((g) => (
                <Link key={g.id} href={`/manager/attendance/${g.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-m3-lg hover:bg-state-hover transition-colors group">
                  <div className="w-9 h-9 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center"><GraduationCap size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{g.title}</p>
                      <span className={`text-[13px] font-bold tabular-nums shrink-0 ${rateColor(g.rate)}`}>{g.rate === null ? "—" : `${g.rate}%`}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div className={`h-full rounded-full ${rateBar(g.rate)}`} style={{ width: `${g.rate ?? 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** KPI tile — same anatomy as the finance stats cards, but clickable.
 *  Tones map by MEANING onto the token system's semantic containers. */
type KpiTone = "success" | "error" | "tertiary" | "warning";
const KPI_ICON: Record<KpiTone, string> = {
  success: "bg-success-container text-on-success-container",
  error: "bg-error-container text-on-error-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  warning: "bg-warning-container text-on-warning-container",
};

function KpiCard({ href, Icon, tone, label, sub, value, valueClass }: {
  href: string; Icon: LucideIcon; tone: KpiTone;
  label: string; sub: string; value: string | null; valueClass?: string;
}) {
  return (
    <motion.div {...staggerItem} className="snap-start shrink-0 w-[176px] md:w-auto md:shrink">
      <Link
        href={href}
        className="block h-full bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-4 transition-all shadow-elev-1 hover:shadow-elev-2 hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`w-9 h-9 rounded-m3-md flex items-center justify-center ${KPI_ICON[tone]}`}>
            <Icon size={17} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-[11.5px] font-bold text-on-surface">{label}</p>
            <p className="text-[10px] text-on-surface-variant truncate">{sub}</p>
          </div>
        </div>
        {value === null ? (
          <div className="h-6 flex items-center"><Spinner size={16} /></div>
        ) : (
          <p className={`text-[15px] xl:text-[16px] font-bold tabular-nums leading-tight whitespace-nowrap ${valueClass || "text-on-surface"}`}>
            {value}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
