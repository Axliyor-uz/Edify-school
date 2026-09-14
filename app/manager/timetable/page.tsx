"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Loader2, DoorOpen, AlertTriangle, User, Clock, X, Plus, Pencil, Search, Users2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { overlaps } from "@/services/roomService";
import { roomTheme } from "@/lib/roomColors";
import type { ScheduleEntry } from "@/types/attendance";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import ScheduleTab from "@/app/manager/groups/[classId]/_components/ScheduleTab";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun display order

const TRANSLATIONS = {
  uz: {
    dayLabels: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"], // index = getDay()
    dayShorts: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"], // index = getDay()
    title: "Haftalik jadval",
    subtitle: "Qaysi xonada, qachon, qaysi guruh va o'qituvchi",
    clashCount: (n: number) => `${n} o'qituvchi ziddiyati`,
    week: "Hafta",
    allTeachers: "Barcha o'qituvchilar",
    legendTitle: (title: string) => `${title} — jadvalini tahrirlash`,
    chipTitle: "Tahrirlash — vaqt va xonani o'zgartirish",
    emptyTitle: "Jadval bo'sh",
    emptyDesc: "Xonalar yarating va guruh jadvalida ularni biriktiring.",
    room: "Xona",
    today: "Bugun",
    seats: (n: number) => `${n} o'rin`,
    addCellTitle: "Bu xona va kunga guruh qo'shish",
    add: "Qo'shish",
    unassigned: "Biriktirilmagan",
    unassignedSub: "xona tanlanmagan",
    assignRoomTitle: "Xona biriktirish uchun bosing",
    pickGroup: "Guruh tanlang",
    drawerFallback: "Jadval",
    editTimeRoom: "Vaqt va xonani tahrirlang",
    pickPlaceholder: "Guruh yoki o'qituvchi...",
    groupNotFound: "Guruh topilmadi",
    noTeacher: "O'qituvchi yo'q",
  },
  en: {
    dayLabels: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], // index = getDay()
    dayShorts: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], // index = getDay()
    title: "Weekly timetable",
    subtitle: "Which room, when, which group and teacher",
    clashCount: (n: number) => `${n} teacher conflicts`,
    week: "Week",
    allTeachers: "All teachers",
    legendTitle: (title: string) => `${title} — edit its schedule`,
    chipTitle: "Edit — change the time and room",
    emptyTitle: "Timetable is empty",
    emptyDesc: "Create rooms and assign them in the group schedule.",
    room: "Room",
    today: "Today",
    seats: (n: number) => `${n} seats`,
    addCellTitle: "Add a group to this room and day",
    add: "Add",
    unassigned: "Unassigned",
    unassignedSub: "no room selected",
    assignRoomTitle: "Click to assign a room",
    pickGroup: "Pick a group",
    drawerFallback: "Schedule",
    editTimeRoom: "Edit the time and room",
    pickPlaceholder: "Group or teacher...",
    groupNotFound: "No groups found",
    noTeacher: "No teacher",
  },
  ru: {
    dayLabels: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], // index = getDay()
    dayShorts: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"], // index = getDay()
    title: "Недельное расписание",
    subtitle: "Какой кабинет, когда, какая группа и учитель",
    clashCount: (n: number) => `Конфликтов учителей: ${n}`,
    week: "Неделя",
    allTeachers: "Все учителя",
    legendTitle: (title: string) => `${title} — редактировать расписание`,
    chipTitle: "Редактировать — изменить время и кабинет",
    emptyTitle: "Расписание пусто",
    emptyDesc: "Создайте кабинеты и закрепите их в расписании группы.",
    room: "Кабинет",
    today: "Сегодня",
    seats: (n: number) => `${n} мест`,
    addCellTitle: "Добавить группу в этот кабинет и день",
    add: "Добавить",
    unassigned: "Без кабинета",
    unassignedSub: "кабинет не выбран",
    assignRoomTitle: "Нажмите, чтобы назначить кабинет",
    pickGroup: "Выберите группу",
    drawerFallback: "Расписание",
    editTimeRoom: "Измените время и кабинет",
    pickPlaceholder: "Группа или учитель...",
    groupNotFound: "Группы не найдены",
    noTeacher: "Нет учителя",
  },
};
type PageT = typeof TRANSLATIONS.uz;

interface Booking {
  classId: string; title: string; teacherId: string; teacherName: string;
  dayOfWeek: number; startTime: string; endTime: string; roomId?: string; roomName?: string;
}
const bookingKey = (b: Booking) => `${b.classId}|${b.dayOfWeek}|${b.startTime}|${b.endTime}`;

// One color per GROUP (not per room) — the same group reads as the same color
// in every cell, so managers can spot a group across the whole week at a glance.
const GROUP_THEMES = [
  { cell: "bg-primary-container border-outline-variant text-on-primary-container", dot: "bg-primary" },
  { cell: "bg-secondary-container border-outline-variant text-on-secondary-container", dot: "bg-secondary" },
  { cell: "bg-tertiary-container border-outline-variant text-on-tertiary-container", dot: "bg-tertiary" },
];
function groupTheme(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_THEMES[h % GROUP_THEMES.length];
}

// Uniform column sizing — every day column is identical, cells share a min height.
const DAY_COL = "w-[170px] min-w-[170px]";
const ROOM_COL = "w-[180px] min-w-[180px]";
const CELL_MIN_H = "min-h-[76px]";

export default function TimetablePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  // Language-resolved day list (display only — dayOfWeek keys stay numeric).
  const DAYS = useMemo(
    () => DAY_ORDER.map((dw) => ({ dayOfWeek: dw, label: t.dayLabels[dw], short: t.dayShorts[dw] })),
    [t]
  );
  const [centerId, setCenterId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");

  // Editor drawer state.
  const [editing, setEditing] = useState<string | null>(null);          // classId being edited
  const [prefill, setPrefill] = useState<{ dayOfWeek: number; roomId?: string } | undefined>(undefined);
  const [picking, setPicking] = useState<{ dayOfWeek: number; roomId?: string } | null>(null); // empty-cell → choose group
  const [pickSearch, setPickSearch] = useState("");
  // Optimistic schedule overrides so a saved edit moves on the grid instantly.
  const [overrides, setOverrides] = useState<Record<string, ScheduleEntry[]>>({});

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, teachers, isLoading: loadingClasses, refetch } = useCenterClasses(centerId);
  const { rooms, isLoading: loadingRooms } = useCenterRooms(centerId);
  const loading = loadingClasses || loadingRooms;

  const effectiveClasses = useMemo(
    () => classes.map((c) => (overrides[c.id] ? { ...c, schedule: overrides[c.id] } : c)),
    [classes, overrides]
  );

  const openEditor = (classId: string, pf?: { dayOfWeek: number; roomId?: string }) => {
    setPrefill(pf); setPicking(null); setEditing(classId);
  };
  const openPicker = (roomId: string, dayOfWeek: number) => {
    setEditing(null); setPrefill(undefined); setPickSearch(""); setPicking({ dayOfWeek, roomId });
  };
  const closeDrawer = () => { setEditing(null); setPicking(null); setPrefill(undefined); setPickSearch(""); };

  const handleSaved = (classId: string, newSchedule: ScheduleEntry[]) => {
    setOverrides((o) => ({ ...o, [classId]: newSchedule }));
    closeDrawer();
    refetch().then(() => setOverrides((o) => { const n = { ...o }; delete n[classId]; return n; }));
  };

  // Esc closes the drawer.
  useEffect(() => {
    if (!editing && !picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, picking]);

  const allBookings = useMemo<Booking[]>(() =>
    effectiveClasses.flatMap((c) => (c.schedule || []).map((s) => ({
      classId: c.id, title: c.title, teacherId: c.teacherId, teacherName: c.teacherName,
      dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId, roomName: s.roomName,
    }))),
  [effectiveClasses]);

  const bookings = useMemo(
    () => allBookings.filter((b) => teacherFilter === "all" || b.teacherId === teacherFilter),
    [allBookings, teacherFilter]
  );

  // Flag room double-bookings (same room + day + overlapping time).
  const roomClashKeys = useMemo(() => {
    const flagged = new Set<string>();
    const byRoomDay = new Map<string, Booking[]>();
    for (const b of allBookings) {
      if (!b.roomId) continue;
      const k = `${b.roomId}|${b.dayOfWeek}`;
      (byRoomDay.get(k) || byRoomDay.set(k, []).get(k)!).push(b);
    }
    byRoomDay.forEach((list) => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (overlaps(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
            flagged.add(bookingKey(list[i])); flagged.add(bookingKey(list[j]));
          }
    });
    return flagged;
  }, [allBookings]);

  // Count teacher double-bookings (same teacher + day + overlap, any room).
  const teacherClashCount = useMemo(() => {
    let count = 0;
    const byTeacherDay = new Map<string, Booking[]>();
    for (const b of allBookings) {
      const k = `${b.teacherId}|${b.dayOfWeek}`;
      (byTeacherDay.get(k) || byTeacherDay.set(k, []).get(k)!).push(b);
    }
    byTeacherDay.forEach((list) => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (overlaps(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) count++;
    });
    return count;
  }, [allBookings]);

  const days = dayFilter === "all" ? DAYS : DAYS.filter((d) => d.dayOfWeek === dayFilter);
  const hasUnassigned = bookings.some((b) => !b.roomId);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  const cellBookings = (roomId: string | null, dayOfWeek: number) =>
    bookings
      .filter((b) => (roomId === null ? !b.roomId : b.roomId === roomId) && b.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const renderChip = (b: Booking) => {
    const clash = roomClashKeys.has(bookingKey(b));
    const gt = groupTheme(b.classId);
    return (
      <button key={bookingKey(b)} type="button" onClick={() => openEditor(b.classId)}
        title={t.chipTitle}
        className={`group/chip w-full rounded-m3-md px-2 py-1.5 border text-left transition-all hover:shadow-elev-2 hover:-translate-y-px cursor-pointer ${
          clash ? "bg-error-container border-error text-on-error-container" : `${gt.cell} hover:brightness-[0.97]`
        }`}>
        <div className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums opacity-80">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${clash ? "bg-error" : gt.dot}`} />
          <Clock size={9} /> {b.startTime}–{b.endTime}
          {clash ? <AlertTriangle size={10} className="text-error ml-auto" /> : <Pencil size={9} className="ml-auto opacity-0 group-hover/chip:opacity-70 transition-opacity" />}
        </div>
        <p className="text-[12px] font-bold leading-tight truncate mt-0.5">{b.title}</p>
        <p className="text-[10.5px] opacity-70 truncate flex items-center gap-0.5"><User size={9} /> {b.teacherName}</p>
      </button>
    );
  };

  const roomRows = rooms; // ordered by orderIndex

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
              <CalendarDays className="text-primary" size={24} /> {t.title}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
          </div>
          {teacherClashCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error-container text-on-error-container rounded-full text-[12px] font-semibold">
              <AlertTriangle size={14} /> {t.clashCount(teacherClashCount)}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 bg-surface-container-lowest border border-outline-variant rounded-full p-1">
          <button onClick={() => setDayFilter("all")} className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${dayFilter === "all" ? "bg-primary text-on-primary shadow-elev-1" : "text-on-surface-variant hover:bg-state-hover hover:text-primary"}`}>{t.week}</button>
          {DAYS.map((d) => (
            <button key={d.dayOfWeek} onClick={() => setDayFilter(d.dayOfWeek)} className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${dayFilter === d.dayOfWeek ? "bg-primary text-on-primary shadow-elev-1" : "text-on-surface-variant hover:bg-state-hover hover:text-primary"}`}>{d.short}</button>
          ))}
        </div>
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}
          className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[13px] font-bold text-on-surface-variant focus:outline-none focus:border-primary cursor-pointer">
          <option value="all">{t.allTeachers}</option>
          {teachers.map((tch) => <option key={tch.teacherId} value={tch.teacherId}>{tch.teacherName}</option>)}
        </select>
      </div>

      {/* Group color legend — same color everywhere on the grid; click = edit that group */}
      {!loading && effectiveClasses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {effectiveClasses.map((c) => {
            const gt = groupTheme(c.id);
            return (
              <button key={c.id} type="button" onClick={() => openEditor(c.id)}
                title={t.legendTitle(c.title)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-bold transition-all hover:shadow-elev-1 ${gt.cell}`}>
                <span className={`w-2 h-2 rounded-full ${gt.dot}`} /> {c.title}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={30} /></div>
      ) : rooms.length === 0 && !hasUnassigned ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3"><CalendarDays size={28} /></div>
          <h3 className="text-[15px] font-semibold text-on-surface">{t.emptyTitle}</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-[300px]">{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl overflow-auto [scrollbar-width:thin]">
          <table className="border-separate border-spacing-0 w-full table-fixed">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-30 bg-inverse-surface text-left px-3 py-3 ${ROOM_COL} border-r border-outline-variant`}>
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-inverse-primary">
                    <DoorOpen size={13} /> {t.room}
                  </span>
                </th>
                {days.map((d) => {
                  const isToday = d.dayOfWeek === todayWeekday;
                  return (
                    <th key={d.dayOfWeek}
                      className={`sticky top-0 z-20 px-2 py-2.5 ${DAY_COL} border-l border-outline-variant ${isToday ? "bg-primary" : "bg-inverse-surface"}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[12.5px] font-bold ${isToday ? "text-on-primary" : "text-inverse-on-surface"}`}>{d.label}</span>
                        {isToday
                          ? <span className="text-[9px] font-black uppercase tracking-widest text-on-primary opacity-80">{t.today}</span>
                          : <span className="text-[9px] font-semibold uppercase tracking-widest text-inverse-on-surface opacity-60">{d.short}</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomRows.map((room) => {
                const th = roomTheme(room.color);
                return (
                  <tr key={room.id} className="align-top">
                    <td className={`sticky left-0 z-10 bg-surface-container-lowest border-b border-r border-outline-variant px-3 py-2.5 ${ROOM_COL}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-1 h-9 rounded-full shrink-0 ${th.bar}`} />
                        <div className="min-w-0">
                          <p className={`text-[13px] font-bold text-on-surface truncate ${!room.isActive ? "opacity-50" : ""}`}>{room.name}</p>
                          <p className="text-[10.5px] text-on-surface-variant">{t.seats(room.capacity)}</p>
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const cell = cellBookings(room.id, d.dayOfWeek);
                      const isToday = d.dayOfWeek === todayWeekday;
                      return (
                        <td key={d.dayOfWeek} className={`group/cell border-b border-l border-outline-variant px-1.5 py-1.5 ${DAY_COL} align-top ${isToday ? "bg-t-primary-soft" : ""}`}>
                          <div className={`flex flex-col gap-1 ${CELL_MIN_H}`}>
                            {cell.map(renderChip)}
                            <button type="button" onClick={() => openPicker(room.id, d.dayOfWeek)}
                              title={t.addCellTitle}
                              className={`w-full rounded-m3-md border border-dashed border-outline-variant text-on-surface-variant flex items-center justify-center gap-1 text-[11px] font-semibold transition-all hover:border-primary hover:text-primary hover:bg-t-primary-soft ${
                                cell.length === 0 ? "flex-1 min-h-[40px] opacity-60" : "py-1 opacity-0 group-hover/cell:opacity-100"
                              }`}>
                              <Plus size={13} /> {cell.length === 0 ? t.add : ""}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Unassigned bookings row */}
              {hasUnassigned && (
                <tr className="align-top">
                  <td className={`sticky left-0 z-10 bg-warning-container border-b border-r border-outline-variant px-3 py-2.5 ${ROOM_COL}`}>
                    <div className="flex items-center gap-2">
                      <DoorOpen size={14} className="text-on-warning-container shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-on-warning-container">{t.unassigned}</p>
                        <p className="text-[10px] text-on-warning-container opacity-70">{t.unassignedSub}</p>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = cellBookings(null, d.dayOfWeek);
                    return (
                      <td key={d.dayOfWeek} className={`border-b border-l border-outline-variant px-1.5 py-1.5 ${DAY_COL} align-top bg-surface-container-low`}>
                        <div className={`flex flex-col gap-1 ${CELL_MIN_H}`}>
                          {cell.map((b) => {
                            const gt = groupTheme(b.classId);
                            return (
                              <button key={bookingKey(b)} type="button" onClick={() => openEditor(b.classId)}
                                title={t.assignRoomTitle}
                                className={`group/chip w-full rounded-m3-md px-2 py-1.5 border border-dashed text-left transition-all hover:shadow-elev-2 hover:-translate-y-px cursor-pointer ${gt.cell}`}>
                                <div className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums opacity-80">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gt.dot}`} />
                                  <Clock size={9} /> {b.startTime}–{b.endTime}
                                  <DoorOpen size={10} className="ml-auto opacity-0 group-hover/chip:opacity-70 transition-opacity" />
                                </div>
                                <p className="text-[12px] font-bold leading-tight truncate mt-0.5">{b.title}</p>
                                <p className="text-[10.5px] opacity-70 truncate flex items-center gap-0.5"><User size={9} /> {b.teacherName}</p>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Editor drawer: reuses the group's ScheduleTab ── */}
      {(editing || picking) && (() => {
        const editingClass = editing ? effectiveClasses.find((c) => c.id === editing) : null;
        const ctx = picking || prefill;
        const ctxRoom = ctx?.roomId ? rooms.find((r) => r.id === ctx.roomId) : undefined;
        const ctxDay = ctx ? DAYS.find((d) => d.dayOfWeek === ctx.dayOfWeek) : undefined;
        const pickList = picking
          ? effectiveClasses.filter((c) => {
              const q = pickSearch.trim().toLowerCase();
              if (!q) return true;
              return c.title.toLowerCase().includes(q) || (c.teacherName || "").toLowerCase().includes(q);
            })
          : [];
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={closeDrawer} />
            <div className={`relative w-full ${picking ? "sm:max-w-md" : "sm:max-w-3xl"} bg-surface-container-lowest rounded-t-m3-xl sm:rounded-m3-xl shadow-elev-3 max-h-[92vh] flex flex-col overflow-hidden`}>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-surface-container-lowest border-b border-outline-variant shrink-0">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-on-surface truncate">
                    {editingClass && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${groupTheme(editingClass.id).dot}`} />}
                    {picking ? t.pickGroup : editingClass?.title || t.drawerFallback}
                  </h3>
                  <p className="text-[12px] text-on-surface-variant truncate">
                    {ctxDay || ctxRoom ? (
                      <span className="inline-flex items-center gap-1.5">
                        {ctxDay && <span className="font-semibold text-on-surface">{ctxDay.label}</span>}
                        {ctxRoom && <span className="inline-flex items-center gap-1 text-primary font-semibold"><DoorOpen size={12} /> {ctxRoom.name}</span>}
                      </span>
                    ) : (
                      t.editTimeRoom
                    )}
                  </p>
                </div>
                <button onClick={closeDrawer} className="w-8 h-8 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-state-hover hover:text-on-surface transition-colors shrink-0"><X size={18} /></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
                {picking ? (
                  <div className="p-4">
                    <div className="relative mb-3">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                      <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} autoFocus
                        placeholder={t.pickPlaceholder}
                        className="w-full pl-9 pr-3 py-2.5 text-[14px] bg-surface-container-lowest text-on-surface border border-outline-variant rounded-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="space-y-1.5">
                      {pickList.length === 0 ? (
                        <p className="py-8 text-center text-[13px] text-on-surface-variant">{t.groupNotFound}</p>
                      ) : pickList.map((c) => (
                        <button key={c.id} onClick={() => openEditor(c.id, picking!)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-lg text-left hover:border-primary hover:shadow-elev-1 transition-all">
                          <span className="w-9 h-9 shrink-0 rounded-full bg-primary-container text-on-primary-container font-bold text-[13px] flex items-center justify-center">
                            {(c.title || "?").charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold text-on-surface truncate">{c.title}</p>
                            <p className="text-[11.5px] text-on-surface-variant truncate">{c.teacherName || t.noTeacher}</p>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
                            <Users2 size={12} /> {c.studentIds?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : editingClass ? (
                  <ScheduleTab
                    key={editingClass.id}
                    classId={editingClass.id}
                    centerId={centerId || ""}
                    teacherId={editingClass.teacherId}
                    studentCount={editingClass.studentIds?.length || 0}
                    currentSchedule={editingClass.schedule || []}
                    autoEdit
                    prefill={prefill}
                    onUpdate={(newSchedule) => handleSaved(editingClass.id, newSchedule)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
