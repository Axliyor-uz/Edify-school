"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Clock, Loader2, CalendarCheck, CalendarX2, ArrowRight, GraduationCap, LayoutGrid, UserCheck, ScanFace } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import FaceTerminalStatus from "@/components/attendance/FaceTerminalStatus";
import WalkInCheckIn from "./_components/WalkInCheckIn";

type Schedule = { dayOfWeek: number; startTime: string; endTime: string }[];

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun display order

const TRANSLATIONS = {
  uz: {
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"], // index = getDay()
    title: "Davomat",
    subGroups: "Guruh tanlang va davomatni belgilang",
    subWalkin: "O'quvchini toping va bugungi darslarga belgilang",
    groupCount: (n: number) => `${n} guruh`,
    studentCount: (n: number) => `${n} o'quvchi`,
    lessonsToday: (n: number) => `Bugun ${n} ta dars`,
    tabGroups: "Guruhlar",
    tabWalkin: "Tez davomat",
    emptyTitle: "Guruhlar yo'q",
    emptyDesc: "Markazingizga hali hech qanday guruh qo'shilmagan.",
    noTeacher: "O'qituvchi yo'q",
    today: "Bugun",
    studentsSuffix: "o'quvchi",
    lessonsPerWeek: "dars/hafta",
    todayTime: (a: string, b: string) => `Bugun ${a}–${b}`,
    noSchedule: "Jadval yo'q",
    faceConfig: "Face ID",
  },
  en: {
    dayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], // index = getDay()
    title: "Attendance",
    subGroups: "Pick a group and mark attendance",
    subWalkin: "Find a student and mark them for today's lessons",
    groupCount: (n: number) => `${n} groups`,
    studentCount: (n: number) => `${n} students`,
    lessonsToday: (n: number) => `${n} lessons today`,
    tabGroups: "Groups",
    tabWalkin: "Quick check-in",
    emptyTitle: "No groups",
    emptyDesc: "No groups have been added to your center yet.",
    noTeacher: "No teacher",
    today: "Today",
    studentsSuffix: "students",
    lessonsPerWeek: "lessons/week",
    todayTime: (a: string, b: string) => `Today ${a}–${b}`,
    noSchedule: "No schedule",
    faceConfig: "Face ID",
  },
  ru: {
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"], // index = getDay()
    title: "Посещаемость",
    subGroups: "Выберите группу и отметьте посещаемость",
    subWalkin: "Найдите ученика и отметьте его на сегодняшних занятиях",
    groupCount: (n: number) => `${n} групп`,
    studentCount: (n: number) => `${n} учеников`,
    lessonsToday: (n: number) => `Сегодня ${n} занятий`,
    tabGroups: "Группы",
    tabWalkin: "Быстрая отметка",
    emptyTitle: "Групп нет",
    emptyDesc: "В ваш центр пока не добавлено ни одной группы.",
    noTeacher: "Нет учителя",
    today: "Сегодня",
    studentsSuffix: "учеников",
    lessonsPerWeek: "занятий/нед.",
    todayTime: (a: string, b: string) => `Сегодня ${a}–${b}`,
    noSchedule: "Нет расписания",
    faceConfig: "Face ID",
  },
};
type PageT = typeof TRANSLATIONS.uz;

// Token-driven tonal themes; each card gets one deterministically so the grid feels alive.
const THEMES = [
  { avatar: "bg-primary-container text-on-primary-container", bar: "bg-primary", dayOn: "bg-primary-container text-on-primary-container", dayToday: "bg-primary text-on-primary", badge: "bg-primary-container text-on-primary-container", hoverBorder: "hover:border-primary", arrow: "group-hover:bg-primary group-hover:text-on-primary" },
  { avatar: "bg-secondary-container text-on-secondary-container", bar: "bg-secondary", dayOn: "bg-secondary-container text-on-secondary-container", dayToday: "bg-secondary text-on-secondary", badge: "bg-secondary-container text-on-secondary-container", hoverBorder: "hover:border-secondary", arrow: "group-hover:bg-secondary group-hover:text-on-secondary" },
  { avatar: "bg-tertiary-container text-on-tertiary-container", bar: "bg-tertiary", dayOn: "bg-tertiary-container text-on-tertiary-container", dayToday: "bg-tertiary text-on-tertiary", badge: "bg-tertiary-container text-on-tertiary-container", hoverBorder: "hover:border-tertiary", arrow: "group-hover:bg-tertiary group-hover:text-on-tertiary" },
];

function themeFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THEMES[h % THEMES.length];
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type Tab = "groups" | "walkin";

export default function AttendancePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("groups");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    });
  }, [user]);

  const { classes, isLoading } = useCenterClasses(centerId);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  const totalStudents = useMemo(
    () => classes.reduce((sum, c) => sum + (c.studentIds?.length || 0), 0),
    [classes]
  );
  const meetingToday = useMemo(
    () => classes.filter((c) => c.schedule?.some((s) => s.dayOfWeek === todayWeekday)).length,
    [classes, todayWeekday]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {tab === "groups" ? t.subGroups : t.subWalkin}
          </p>
        </div>
        {!isLoading && classes.length > 0 && tab === "groups" && (
          <div className="flex items-center gap-2">
            {/* Face terminal status badge */}
            <FaceTerminalStatus />

            {/* Face ID config link */}
            <Link
              href="/manager/face-config"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-bold text-on-surface-variant hover:bg-state-hover hover:text-primary transition-colors"
            >
              <ScanFace size={13} /> {t.faceConfig}
            </Link>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
              <CalendarCheck size={14} className="text-on-surface-variant" /> {t.groupCount(classes.length)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
              <Users size={14} className="text-on-surface-variant" /> {t.studentCount(totalStudents)}
            </span>
            {meetingToday > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary-container rounded-full text-[12px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {t.lessonsToday(meetingToday)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-full">
        {([
          { id: "groups" as Tab, label: t.tabGroups, Icon: LayoutGrid },
          { id: "walkin" as Tab, label: t.tabWalkin, Icon: UserCheck },
        ]).map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-colors ${
                active ? "bg-primary text-on-primary shadow-elev-1" : "text-on-surface-variant hover:bg-state-hover hover:text-primary"
              }`}
            >
              <tb.Icon size={15} /> {tb.label}
            </button>
          );
        })}
      </div>

      {/* ── Walk-in (front-desk) check-in ── */}
      {tab === "walkin" && (
        isLoading || !centerId || !user ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-on-surface-variant" size={32} />
          </div>
        ) : (
          <WalkInCheckIn centerId={centerId} classes={classes} markedBy={user.uid} />
        )
      )}

      {/* Loading */}
      {tab === "groups" && isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-on-surface-variant" size={32} />
        </div>
      )}

      {/* Empty */}
      {tab === "groups" && !isLoading && classes.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3">
            <CalendarX2 size={28} />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">{t.emptyTitle}</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-[260px]">
            {t.emptyDesc}
          </p>
        </div>
      )}

      {/* Class Grid */}
      {tab === "groups" && !isLoading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} todayWeekday={todayWeekday} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, todayWeekday }: { cls: ClassData & { schedule?: Schedule }; todayWeekday: number }) {
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const schedule = cls.schedule || [];
  const theme = themeFor(cls.id);
  const scheduledDays = new Set(schedule.map((s) => s.dayOfWeek));
  const todayEntry = schedule.find((s) => s.dayOfWeek === todayWeekday);

  return (
    <Link
      href={`/manager/attendance/${cls.id}`}
      className={`group relative block bg-surface-container-lowest rounded-m3-xl border border-outline-variant hover:shadow-elev-2 hover:-translate-y-0.5 transition-all overflow-hidden ${theme.hoverBorder}`}
    >
      {/* Accent bar */}
      <div className={`h-1.5 ${theme.bar}`} />

      <div className="p-5">
        {/* Header: avatar + title + teacher */}
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-m3-lg flex items-center justify-center text-[18px] font-black shrink-0 ${theme.avatar}`}>
            {(cls.title || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-bold text-on-surface tracking-tight truncate">{cls.title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant text-[9px] font-bold flex items-center justify-center shrink-0">
                {getInitials(cls.teacherName)}
              </span>
              <span className="text-[12.5px] font-medium text-on-surface-variant truncate">{cls.teacherName || t.noTeacher}</span>
            </div>
          </div>

          {/* Today badge */}
          {todayEntry && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${theme.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.bar}`} /> {t.today}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <Users size={15} className="text-on-surface-variant" />
            <span className="text-[13px] font-semibold tabular-nums">{cls.studentIds?.length || 0}</span>
            <span className="text-[12px] text-on-surface-variant">{t.studentsSuffix}</span>
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <GraduationCap size={15} className="text-on-surface-variant" />
            <span className="text-[13px] font-semibold tabular-nums">{schedule.length}</span>
            <span className="text-[12px] text-on-surface-variant">{t.lessonsPerWeek}</span>
          </div>
        </div>

        {/* Week strip */}
        <div className="flex items-center gap-1 mt-4">
          {WEEK_ORDER.map((dow) => {
            const on = scheduledDays.has(dow);
            const isToday = dow === todayWeekday;
            return (
              <span
                key={dow}
                className={`flex-1 h-7 rounded-m3-md flex items-center justify-center text-[10px] font-bold transition-colors ${
                  on ? (isToday ? theme.dayToday : theme.dayOn) : "bg-surface-container-low text-on-surface-variant opacity-60"
                }`}
              >
                {t.dayShort[dow]}
              </span>
            );
          })}
        </div>

        {/* Footer: time + CTA */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-on-surface-variant">
            <Clock size={13} className="text-on-surface-variant" />
            {todayEntry ? (
              <span className="tabular-nums">{t.todayTime(todayEntry.startTime, todayEntry.endTime)}</span>
            ) : schedule.length > 0 ? (
              <span className="tabular-nums">{schedule[0].startTime}–{schedule[0].endTime}</span>
            ) : (
              <span className="text-on-surface-variant">{t.noSchedule}</span>
            )}
          </span>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center bg-surface-container text-on-surface-variant transition-colors ${theme.arrow}`}>
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
