"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  Save, Loader2, Clock, CalendarDays, Edit3, CalendarX2, Hourglass,
  Trash2, Sunrise, Sunset, ArrowRight, Check, Sparkles, DoorOpen, AlertTriangle, Wand2, User,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ScheduleEntry } from "@/types/attendance";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { findScheduleConflicts } from "@/services/roomService";
import { roomTheme } from "@/lib/roomColors";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    // index = dayOfWeek (0 = Sunday)
    dayName: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
    dayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    duration: (h: number, m: number) => (h && m ? `${h} soat ${m} daqiqa` : h ? `${h} soat` : `${m} daqiqa`),
    presets: { odd: "Toq kunlar", even: "Juft kunlar", daily: "Har kuni" },
    hourAria: "soat",
    minuteAria: "daqiqa",
    roomNone: "Xona tanlanmagan",
    roomOption: (name: string, capacity: number) => `${name} · ${capacity} o'rin`,
    freeRoomFound: (name: string) => `Bo'sh xona: ${name}`,
    freeRoomNotFound: "Mos bo'sh xona topilmadi.",
    pickAtLeastOneDay: "Kamida bitta kun tanlang.",
    startBeforeEnd: (day: string) => `${day}: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak.`,
    scheduleSaved: "Dars jadvali saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi.",
    headerTitle: "Dars jadvali",
    headerEditDesc: "Kunlarni tanlang va vaqtni kiriting",
    headerViewDesc: "Guruh qaysi kunlari o'qiydi",
    edit: "O'zgartirish",
    cancel: "Bekor qilish",
    save: "Saqlash",
    emptyTitle: "Hali jadval yo'q",
    emptyDesc: "Guruh qaysi kunlari o'qishini belgilab qo'ying.",
    addSchedule: "Jadval qo'shish",
    lessonsPerWeek: (n: number) => `Haftasiga ${n} ta dars`,
    weeklyTotal: (h: number, m: number) =>
      `Jami ${[h > 0 ? `${h} soat` : "", m > 0 ? `${m} daq` : ""].filter(Boolean).join(" ")}`,
    conflictsTitle: "Diqqat: jadval ziddiyatlari",
    roomBusyLine: (room: string, other: string, s: string, e: string) => `«${room}» band: «${other}» (${s}–${e})`,
    teacherBusy: "O'qituvchi band",
    capacityShort: "Sig'im yetarli emas",
    capacityDetail: (n: number, cap?: number) => `${n} o'quvchi > ${cap} o'rin`,
    step1: "Dars kunlarini tanlang",
    clear: "Tozalash",
    selected: "Tanlandi:",
    step2: "Dars vaqtini kiriting",
    sameTimeToggle: "Har kuni bir xil",
    pickDaysFirstLeft: "Avval chapdan kunlarni tanlang",
    startLabel: "Boshlanishi",
    endLabel: "Tugashi",
    endLater: "Tugash vaqti kechroq bo'lsin",
    eachLesson: (dur: string) => `Har dars ${dur}`,
    step3: "Xonani biriktiring",
    optional: "(ixtiyoriy)",
    sameRoomToggle: "Hamma kun bir xona",
    noRoomsYet: "Hali xona qo'shilmagan.",
    addRoomLink: "Xona qo'shish →",
    pickDaysFirst: "Avval kunlarni tanlang",
    suggestFreeRoom: "Bo'sh xona",
  },
  en: {
    dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    dayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    duration: (h: number, m: number) => (h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`),
    presets: { odd: "Mon/Wed/Fri", even: "Tue/Thu/Sat", daily: "Every day" },
    hourAria: "hours",
    minuteAria: "minutes",
    roomNone: "No room selected",
    roomOption: (name: string, capacity: number) => `${name} · ${capacity} seats`,
    freeRoomFound: (name: string) => `Free room: ${name}`,
    freeRoomNotFound: "No suitable free room found.",
    pickAtLeastOneDay: "Select at least one day.",
    startBeforeEnd: (day: string) => `${day}: the start time must be before the end time.`,
    scheduleSaved: "Schedule saved!",
    saveError: "Something went wrong while saving.",
    headerTitle: "Class schedule",
    headerEditDesc: "Pick the days and set the time",
    headerViewDesc: "The days this group meets",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    emptyTitle: "No schedule yet",
    emptyDesc: "Set the days this group meets.",
    addSchedule: "Add schedule",
    lessonsPerWeek: (n: number) => `${n} lessons per week`,
    weeklyTotal: (h: number, m: number) =>
      `Total ${[h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""].filter(Boolean).join(" ")}`,
    conflictsTitle: "Warning: schedule conflicts",
    roomBusyLine: (room: string, other: string, s: string, e: string) => `"${room}" is taken by "${other}" (${s}–${e})`,
    teacherBusy: "Teacher is busy",
    capacityShort: "Not enough capacity",
    capacityDetail: (n: number, cap?: number) => `${n} students > ${cap} seats`,
    step1: "Pick the lesson days",
    clear: "Clear",
    selected: "Selected:",
    step2: "Set the lesson time",
    sameTimeToggle: "Same every day",
    pickDaysFirstLeft: "Pick the days on the left first",
    startLabel: "Start",
    endLabel: "End",
    endLater: "The end time must be later",
    eachLesson: (dur: string) => `Each lesson ${dur}`,
    step3: "Assign a room",
    optional: "(optional)",
    sameRoomToggle: "One room for all days",
    noRoomsYet: "No rooms added yet.",
    addRoomLink: "Add a room →",
    pickDaysFirst: "Pick the days first",
    suggestFreeRoom: "Free room",
  },
  ru: {
    dayName: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    duration: (h: number, m: number) => (h && m ? `${h} ч ${m} мин` : h ? `${h} ч` : `${m} мин`),
    presets: { odd: "Нечётные дни", even: "Чётные дни", daily: "Каждый день" },
    hourAria: "часы",
    minuteAria: "минуты",
    roomNone: "Кабинет не выбран",
    roomOption: (name: string, capacity: number) => `${name} · ${capacity} мест`,
    freeRoomFound: (name: string) => `Свободный кабинет: ${name}`,
    freeRoomNotFound: "Подходящий свободный кабинет не найден.",
    pickAtLeastOneDay: "Выберите хотя бы один день.",
    startBeforeEnd: (day: string) => `${day}: время начала должно быть раньше времени окончания.`,
    scheduleSaved: "Расписание сохранено!",
    saveError: "Не удалось сохранить расписание.",
    headerTitle: "Расписание занятий",
    headerEditDesc: "Выберите дни и укажите время",
    headerViewDesc: "Дни, когда занимается группа",
    edit: "Изменить",
    cancel: "Отмена",
    save: "Сохранить",
    emptyTitle: "Расписания пока нет",
    emptyDesc: "Укажите, в какие дни занимается группа.",
    addSchedule: "Добавить расписание",
    lessonsPerWeek: (n: number) => `${n} занятий в неделю`,
    weeklyTotal: (h: number, m: number) =>
      `Итого ${[h > 0 ? `${h} ч` : "", m > 0 ? `${m} мин` : ""].filter(Boolean).join(" ")}`,
    conflictsTitle: "Внимание: конфликты в расписании",
    roomBusyLine: (room: string, other: string, s: string, e: string) => `«${room}» занят: «${other}» (${s}–${e})`,
    teacherBusy: "Преподаватель занят",
    capacityShort: "Недостаточно мест",
    capacityDetail: (n: number, cap?: number) => `${n} учеников > ${cap} мест`,
    step1: "Выберите дни занятий",
    clear: "Очистить",
    selected: "Выбрано:",
    step2: "Укажите время занятий",
    sameTimeToggle: "Одинаково каждый день",
    pickDaysFirstLeft: "Сначала выберите дни слева",
    startLabel: "Начало",
    endLabel: "Окончание",
    endLater: "Время окончания должно быть позже",
    eachLesson: (dur: string) => `Каждое занятие ${dur}`,
    step3: "Закрепите кабинет",
    optional: "(необязательно)",
    sameRoomToggle: "Один кабинет на все дни",
    noRoomsYet: "Кабинеты ещё не добавлены.",
    addRoomLink: "Добавить кабинет →",
    pickDaysFirst: "Сначала выберите дни",
    suggestFreeRoom: "Свободный кабинет",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  classId: string;
  centerId: string;
  teacherId: string;
  studentCount: number;
  currentSchedule: ScheduleEntry[];
  onUpdate: (newSchedule: ScheduleEntry[]) => void;
  /** Open straight in edit mode (used when embedded in the timetable drawer). */
  autoEdit?: boolean;
  /** Pre-enable a day (and optionally assign a room) — for scheduling into an empty timetable cell. */
  prefill?: { dayOfWeek: number; roomId?: string };
}

// Mon..Sun iteration order; display names come from the language dict.
const DAYS = [
  { dayOfWeek: 1 },
  { dayOfWeek: 2 },
  { dayOfWeek: 3 },
  { dayOfWeek: 4 },
  { dayOfWeek: 5 },
  { dayOfWeek: 6 },
  { dayOfWeek: 0 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const sortSchedule = (schedule: ScheduleEntry[]) => {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return [...schedule].sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek));
};

const isWeekend = (dayOfWeek: number) => dayOfWeek === 0 || dayOfWeek === 6;

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Compact localized duration, or null if the range is invalid (end <= start).
const formatDuration = (start: string, end: string, t: T) => {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return t.duration(h, m);
};

type DayState = { enabled: boolean; startTime: string; endTime: string; roomId?: string };

function buildInitialState(
  schedule: ScheduleEntry[],
  prefill?: { dayOfWeek: number; roomId?: string }
): Record<number, DayState> {
  const uniform = detectUniform(schedule);
  const state: Record<number, DayState> = {};
  for (const d of DAYS) {
    const existing = schedule.find((s) => s.dayOfWeek === d.dayOfWeek);
    state[d.dayOfWeek] = {
      enabled: !!existing,
      startTime: existing?.startTime || "14:00",
      endTime: existing?.endTime || "15:30",
      roomId: existing?.roomId,
    };
  }
  // Scheduling into an empty timetable cell: turn on that day (inheriting the
  // group's uniform time when it has one) and assign the clicked room.
  if (prefill && state[prefill.dayOfWeek]) {
    const cur = state[prefill.dayOfWeek];
    state[prefill.dayOfWeek] = {
      enabled: true,
      startTime: cur.enabled ? cur.startTime : uniform.uniStart,
      endTime: cur.enabled ? cur.endTime : uniform.uniEnd,
      roomId: prefill.roomId ?? cur.roomId,
    };
  }
  return state;
}

// Do all saved lessons share one time? Then we can edit them together.
function detectUniform(schedule: ScheduleEntry[]) {
  if (schedule.length === 0) return { sameTime: true, uniStart: "14:00", uniEnd: "15:30" };
  const first = schedule[0];
  const same = schedule.every((s) => s.startTime === first.startTime && s.endTime === first.endTime);
  return { sameTime: same, uniStart: first.startTime, uniEnd: first.endTime };
}

// Do all saved lessons use one room? Then one picker can drive them all.
function detectUniformRoom(schedule: ScheduleEntry[]) {
  if (schedule.length === 0) return { sameRoom: true, uniRoom: "" };
  const first = schedule[0].roomId || "";
  const same = schedule.every((s) => (s.roomId || "") === first);
  return { sameRoom: same, uniRoom: first };
}

const PRESETS: { key: keyof T["presets"]; days: number[] }[] = [
  { key: "odd", days: [1, 3, 5] },
  { key: "even", days: [2, 4, 6] },
  { key: "daily", days: [1, 2, 3, 4, 5, 6] },
];

// 24-hour time picker (hour + minute dropdowns) — no AM/PM.
function TimeSelect({
  icon: Icon, tone, label, value, onChange, invalid, t,
}: {
  icon: React.ElementType; tone: string; label: string;
  value: string; onChange: (v: string) => void; invalid?: boolean; t: T;
}) {
  const h = (value.split(":")[0] || "00").padStart(2, "0");
  const m = (value.split(":")[1] || "00").padStart(2, "0");
  const minutes = MINUTES.includes(m) ? MINUTES : [m, ...MINUTES];

  const selectCls =
    "appearance-none bg-transparent outline-none cursor-pointer text-center text-[16px] font-bold text-on-surface tabular-nums";

  return (
    <div className="flex-1 min-w-0">
      <span className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">{label}</span>
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-m3-md border-2 bg-surface-container-lowest transition-colors ${
        invalid ? "border-error" : "border-outline-variant focus-within:border-primary"
      }`}>
        <span className={`w-8 h-8 rounded-m3-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={16} />
        </span>
        <div className="flex items-center gap-0.5">
          <select value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)} aria-label={`${label} ${t.hourAria}`} className={selectCls}>
            {HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
          </select>
          <span className="text-[16px] font-bold text-on-surface-variant">:</span>
          <select value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)} aria-label={`${label} ${t.minuteAria}`} className={selectCls}>
            {minutes.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTab({ classId, centerId, teacherId, studentCount, currentSchedule, onUpdate, autoEdit, prefill }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const initUniform = useMemo(() => detectUniform(currentSchedule), [currentSchedule]);
  const initRoom = useMemo(() => detectUniformRoom(currentSchedule), [currentSchedule]);

  const { rooms } = useCenterRooms(centerId);
  const { classes } = useCenterClasses(centerId);
  const activeRooms = useMemo(() => rooms.filter((r) => r.isActive), [rooms]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const [isEditing, setIsEditing] = useState(currentSchedule.length === 0 || !!autoEdit);
  const [dayStates, setDayStates] = useState<Record<number, DayState>>(() => buildInitialState(currentSchedule, prefill));
  const [sameTime, setSameTime] = useState(initUniform.sameTime);
  const [uniStart, setUniStart] = useState(initUniform.uniStart);
  const [uniEnd, setUniEnd] = useState(initUniform.uniEnd);
  // When scheduling into a specific room via prefill, keep per-day rooms so we
  // don't overwrite the group's other rooms with one uniform pick.
  const [sameRoom, setSameRoom] = useState(prefill?.roomId ? false : initRoom.sameRoom);
  const [uniRoom, setUniRoom] = useState(initRoom.uniRoom);
  const [isSaving, setIsSaving] = useState(false);

  const enabledDays = DAYS.filter((d) => dayStates[d.dayOfWeek].enabled);

  const setDayRoom = (dayOfWeek: number, roomId: string) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], roomId: roomId || undefined } }));
  };

  // The schedule the user is currently building — used for both conflict checks and save.
  const proposed: ScheduleEntry[] = enabledDays.map((d) => {
    const st = dayStates[d.dayOfWeek];
    const startTime = sameTime ? uniStart : st.startTime;
    const endTime = sameTime ? uniEnd : st.endTime;
    const roomId = sameRoom ? uniRoom : st.roomId;
    const entry: ScheduleEntry = { dayOfWeek: d.dayOfWeek, startTime, endTime };
    if (roomId) {
      entry.roomId = roomId;
      const r = roomById.get(roomId);
      if (r) entry.roomName = r.name;
    }
    return entry;
  });

  const conflicts = findScheduleConflicts(classes, classId, teacherId, proposed);
  const capacityWarnings = proposed.filter((s) => {
    if (!s.roomId) return false;
    const r = roomById.get(s.roomId);
    return r ? studentCount > r.capacity : false;
  });
  const hasIssues = conflicts.roomClashes.length > 0 || conflicts.teacherClashes.length > 0 || capacityWarnings.length > 0;

  // Suggest a room with no clashes + enough capacity for the current day/time set (uniform mode).
  const suggestFreeRoom = () => {
    const base = enabledDays.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      startTime: sameTime ? uniStart : dayStates[d.dayOfWeek].startTime,
      endTime: sameTime ? uniEnd : dayStates[d.dayOfWeek].endTime,
    }));
    for (const r of activeRooms) {
      if (r.capacity < studentCount) continue;
      const test: ScheduleEntry[] = base.map((s) => ({ ...s, roomId: r.id, roomName: r.name }));
      if (findScheduleConflicts(classes, classId, teacherId, test).roomClashes.length === 0) {
        setSameRoom(true);
        setUniRoom(r.id);
        toast.success(t.freeRoomFound(r.name));
        return;
      }
    }
    toast.error(t.freeRoomNotFound);
  };

  const toggleDay = (dayOfWeek: number) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], enabled: !prev[dayOfWeek].enabled } }));
  };

  const updateDayTime = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], [field]: value } }));
  };

  const applyPreset = (days: number[]) => {
    setDayStates((prev) => {
      const copy = { ...prev };
      DAYS.forEach((d) => { copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], enabled: days.includes(d.dayOfWeek) }; });
      return copy;
    });
  };

  const clearAll = () => {
    setDayStates((prev) => {
      const copy = { ...prev };
      DAYS.forEach((d) => { copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], enabled: false }; });
      return copy;
    });
  };

  // Turning off "same room" seeds each enabled day from the shared room first.
  const toggleSameRoom = () => {
    const next = !sameRoom;
    if (!next) {
      setDayStates((prev) => {
        const copy = { ...prev };
        DAYS.forEach((d) => { if (copy[d.dayOfWeek].enabled) copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], roomId: uniRoom || undefined }; });
        return copy;
      });
    }
    setSameRoom(next);
  };

  // Native room dropdown with a color dot preview. A plain render fn (not a
  // component) so it doesn't trip the static-components lint.
  const renderRoomSelect = (value: string, onChange: (v: string) => void) => {
    const r = value ? roomById.get(value) : undefined;
    const th = r ? roomTheme(r.color) : null;
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`w-3 h-3 rounded-full shrink-0 ${th ? th.bar : "bg-surface-container-highest"}`} />
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 appearance-none px-3 py-2.5 bg-surface-container-lowest border-2 border-outline-variant rounded-m3-md text-[13px] font-medium text-on-surface focus:outline-none focus:border-primary cursor-pointer">
          <option value="">{t.roomNone}</option>
          {activeRooms.map((rm) => <option key={rm.id} value={rm.id}>{t.roomOption(rm.name, rm.capacity)}</option>)}
        </select>
      </div>
    );
  };

  // When switching to per-day times, seed each day from the shared time first.
  const toggleSameTime = () => {
    const next = !sameTime;
    if (!next) {
      setDayStates((prev) => {
        const copy = { ...prev };
        DAYS.forEach((d) => {
          if (copy[d.dayOfWeek].enabled) copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], startTime: uniStart, endTime: uniEnd };
        });
        return copy;
      });
    }
    setSameTime(next);
  };

  const handleCancel = () => {
    const u = detectUniform(currentSchedule);
    const r = detectUniformRoom(currentSchedule);
    setDayStates(buildInitialState(currentSchedule));
    setSameTime(u.sameTime);
    setUniStart(u.uniStart);
    setUniEnd(u.uniEnd);
    setSameRoom(r.sameRoom);
    setUniRoom(r.uniRoom);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (enabledDays.length === 0) {
      toast.error(t.pickAtLeastOneDay);
      return;
    }
    // Validate times on the proposed schedule (covers uniform + per-day).
    for (const s of proposed) {
      if (s.startTime >= s.endTime) {
        const label = t.dayName[s.dayOfWeek] || "";
        toast.error(t.startBeforeEnd(label));
        return;
      }
    }
    // Conflicts are a soft warning — the manager can override intentionally.

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "classes", classId), { schedule: proposed });
      onUpdate(proposed);
      setIsEditing(false);
      toast.success(t.scheduleSaved);
    } catch (err) {
      console.error(err);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const sortedSchedule = sortSchedule(currentSchedule);

  const weeklyMinutes = currentSchedule.reduce((sum, e) => {
    const diff = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
    return sum + (diff > 0 ? diff : 0);
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyRemMin = weeklyMinutes % 60;

  const uniDuration = formatDuration(uniStart, uniEnd, t);
  const uniInvalid = sameTime && !uniDuration;
  const perDayInvalid = !sameTime && enabledDays.some((d) => !formatDuration(dayStates[d.dayOfWeek].startTime, dayStates[d.dayOfWeek].endTime, t));
  const canSave = enabledDays.length > 0 && !uniInvalid && !perDayInvalid;

  return (
    <div className="p-4 sm:p-6">
      {/* Card header: title (left) + actions (top-right) */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface">{t.headerTitle}</h3>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              {isEditing ? t.headerEditDesc : t.headerViewDesc}
            </p>
          </div>
        </div>

        {/* Top-right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && sortedSchedule.length > 0 && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant hover:bg-state-hover text-on-surface font-medium text-[13px] rounded-full transition-colors"
            >
              <Edit3 size={15} /> {t.edit}
            </button>
          )}
          {isEditing && (
            <>
              {currentSchedule.length > 0 && (
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover rounded-m3-md transition-colors disabled:opacity-50"
                >
                  {t.cancel}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !canSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-bold text-[14px] rounded-full transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-elev-1"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {t.save}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================= VIEW MODE ================= */}
      {!isEditing && (
        sortedSchedule.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center bg-surface-container-low rounded-m3-lg border border-dashed border-outline-variant">
            <div className="w-14 h-14 bg-surface-container-lowest rounded-full flex items-center justify-center border border-outline-variant mb-4">
              <CalendarX2 size={26} className="text-on-surface-variant" />
            </div>
            <h4 className="text-sm font-semibold text-on-surface">{t.emptyTitle}</h4>
            <p className="text-[13px] text-on-surface-variant mt-1.5 max-w-[260px]">
              {t.emptyDesc}
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-5 px-5 py-2.5 bg-primary text-on-primary font-semibold text-[13px] rounded-full transition-colors active:scale-[0.98] shadow-elev-1"
            >
              {t.addSchedule}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sortedSchedule.map((entry) => {
                const weekend = isWeekend(entry.dayOfWeek);
                const duration = formatDuration(entry.startTime, entry.endTime, t);
                return (
                  <div key={entry.dayOfWeek} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded-m3-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-m3-md flex items-center justify-center text-[14px] font-bold shrink-0 ${
                        weekend ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"
                      }`}>
                        {t.dayShort[entry.dayOfWeek]}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-on-surface truncate">{t.dayName[entry.dayOfWeek]}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {duration && (
                            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                              <Hourglass size={11} /> {duration}
                            </span>
                          )}
                          {entry.roomName && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${roomTheme(roomById.get(entry.roomId || "")?.color).soft} ${roomTheme(roomById.get(entry.roomId || "")?.color).text}`}>
                              <DoorOpen size={10} /> {entry.roomName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-low rounded-m3-sm shrink-0">
                      <Clock size={14} className="text-primary" />
                      <span className="text-[13px] font-bold text-on-surface tabular-nums">
                        {entry.startTime}<span className="text-on-surface-variant font-normal mx-0.5">–</span>{entry.endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-primary-container rounded-m3-lg">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-on-primary-container">
                <CalendarDays size={15} /> {t.lessonsPerWeek(sortedSchedule.length)}
              </span>
              {weeklyMinutes > 0 && (
                <span className="flex items-center gap-2 text-[13px] font-semibold text-on-primary-container">
                  <Hourglass size={15} /> {t.weeklyTotal(weeklyHours, weeklyRemMin)}
                </span>
              )}
            </div>
          </div>
        )
      )}

      {/* ================= EDIT MODE ================= */}
      {isEditing && (
        <div className="space-y-6">

          {/* Conflict warnings (soft — the manager can still save) */}
          {hasIssues && (
            <div className="rounded-m3-lg bg-warning-container p-4">
              <div className="flex items-center gap-2 text-on-warning-container font-bold text-[13px] mb-2">
                <AlertTriangle size={15} /> {t.conflictsTitle}
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-on-warning-container">
                {conflicts.roomClashes.map((c, i) => (
                  <li key={`r${i}`} className="flex items-start gap-1.5">
                    <DoorOpen size={13} className="mt-0.5 shrink-0" />
                    <span><b>{t.dayName[c.dayOfWeek]}</b> {c.startTime}–{c.endTime} · {t.roomBusyLine(c.roomName ?? "", c.otherClassTitle ?? "", c.otherStart, c.otherEnd)}</span>
                  </li>
                ))}
                {conflicts.teacherClashes.map((c, i) => (
                  <li key={`t${i}`} className="flex items-start gap-1.5">
                    <User size={13} className="mt-0.5 shrink-0" />
                    <span>{t.teacherBusy}: <b>{t.dayName[c.dayOfWeek]}</b> {c.startTime}–{c.endTime} · «{c.otherClassTitle}»</span>
                  </li>
                ))}
                {capacityWarnings.map((s, i) => {
                  const cap = s.roomId ? roomById.get(s.roomId)?.capacity : undefined;
                  return (
                    <li key={`c${i}`} className="flex items-start gap-1.5">
                      <User size={13} className="mt-0.5 shrink-0" />
                      <span>{t.capacityShort}: <b>{t.dayName[s.dayOfWeek]}</b> · «{s.roomName}» ({t.capacityDetail(studentCount, cap)})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — days */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center">1</span>
              <span className="text-[14px] font-semibold text-on-surface">{t.step1}</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const on = dayStates[d.dayOfWeek].enabled;
                const weekend = isWeekend(d.dayOfWeek);
                return (
                  <button
                    key={d.dayOfWeek}
                    type="button"
                    onClick={() => toggleDay(d.dayOfWeek)}
                    aria-pressed={on}
                    title={t.dayName[d.dayOfWeek]}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span className={`w-full aspect-square rounded-m3-lg flex items-center justify-center text-[14px] font-bold transition-all ${
                      on
                        ? weekend
                          ? "bg-error text-on-error shadow-elev-2 scale-105"
                          : "bg-primary text-on-primary shadow-elev-2 scale-105"
                        : "bg-surface-container-low text-on-surface-variant border border-outline-variant group-hover:border-primary group-hover:text-on-surface"
                    }`}>
                      {on ? <Check size={18} strokeWidth={3} /> : t.dayShort[d.dayOfWeek]}
                    </span>
                    <span className={`text-[10px] font-medium ${on ? (weekend ? "text-error" : "text-primary") : "text-on-surface-variant"}`}>
                      {t.dayShort[d.dayOfWeek]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="px-3 py-1.5 bg-primary-container text-on-primary-container text-[12px] font-semibold rounded-full transition-colors active:scale-95"
                >
                  {t.presets[p.key]}
                </button>
              ))}
              {enabledDays.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-on-surface-variant hover:text-on-error-container hover:bg-error-container text-[12px] font-semibold rounded-full transition-colors"
                >
                  <Trash2 size={13} /> {t.clear}
                </button>
              )}
            </div>

            {/* Live preview */}
            {enabledDays.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-surface-container-low rounded-m3-md">
                <span className="text-[12px] font-medium text-on-surface-variant mr-0.5">{t.selected}</span>
                {enabledDays.map((d) => (
                  <span key={d.dayOfWeek} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    isWeekend(d.dayOfWeek) ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"
                  }`}>
                    {t.dayShort[d.dayOfWeek]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — time */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center">2</span>
                <span className="text-[14px] font-semibold text-on-surface">{t.step2}</span>
              </div>
              <button
                type="button"
                onClick={toggleSameTime}
                role="switch"
                aria-checked={sameTime}
                className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant"
              >
                {t.sameTimeToggle}
                <span className={`relative w-9 h-5 rounded-full transition-colors ${sameTime ? "bg-primary" : "bg-surface-container-highest"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${sameTime ? "translate-x-4 bg-on-primary" : "bg-outline"}`} />
                </span>
              </button>
            </div>

            {enabledDays.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 bg-surface-container-low border border-dashed border-outline-variant rounded-m3-md text-[13px] text-on-surface-variant">
                <CalendarDays size={16} /> {t.pickDaysFirstLeft}
              </div>
            ) : sameTime ? (
              <div className="p-4 bg-surface-container-lowest border-2 border-outline-variant rounded-m3-lg">
                <div className="flex flex-wrap items-end gap-3">
                  <TimeSelect icon={Sunrise} tone="bg-primary-container text-on-primary-container" label={t.startLabel} value={uniStart} onChange={setUniStart} invalid={uniInvalid} t={t} />
                  <ArrowRight size={18} className="text-on-surface-variant mb-2.5 shrink-0" />
                  <TimeSelect icon={Sunset} tone="bg-error-container text-on-error-container" label={t.endLabel} value={uniEnd} onChange={setUniEnd} invalid={uniInvalid} t={t} />
                  <div className="ml-auto mb-1">
                    {uniInvalid ? (
                      <span className="text-[12px] font-medium text-error">{t.endLater}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary-container text-[12px] font-semibold rounded-full">
                        <Hourglass size={12} /> {t.eachLesson(uniDuration || "")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {enabledDays.map((d) => {
                  const st = dayStates[d.dayOfWeek];
                  const dur = formatDuration(st.startTime, st.endTime, t);
                  const invalid = !dur;
                  const weekend = isWeekend(d.dayOfWeek);
                  return (
                    <div key={d.dayOfWeek} className="p-3 bg-surface-container-lowest border-2 border-outline-variant rounded-m3-md">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className={`w-7 h-7 rounded-m3-sm flex items-center justify-center text-[11px] font-bold ${
                          weekend ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"
                        }`}>
                          {t.dayShort[d.dayOfWeek]}
                        </span>
                        <span className="text-[13px] font-semibold text-on-surface">{t.dayName[d.dayOfWeek]}</span>
                        {dur && (
                          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-on-surface-variant">
                            <Hourglass size={11} /> {dur}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        <TimeSelect icon={Sunrise} tone="bg-primary-container text-on-primary-container" label={t.startLabel} value={st.startTime} onChange={(v) => updateDayTime(d.dayOfWeek, "startTime", v)} invalid={invalid} t={t} />
                        <ArrowRight size={16} className="text-on-surface-variant mb-2.5 shrink-0" />
                        <TimeSelect icon={Sunset} tone="bg-error-container text-on-error-container" label={t.endLabel} value={st.endTime} onChange={(v) => updateDayTime(d.dayOfWeek, "endTime", v)} invalid={invalid} t={t} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* STEP 3 — room assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center">3</span>
                <span className="text-[14px] font-semibold text-on-surface">{t.step3} <span className="text-on-surface-variant font-normal">{t.optional}</span></span>
              </div>
              {enabledDays.length > 0 && activeRooms.length > 0 && (
                <button type="button" onClick={toggleSameRoom} role="switch" aria-checked={sameRoom}
                  className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant">
                  {t.sameRoomToggle}
                  <span className={`relative w-9 h-5 rounded-full transition-colors ${sameRoom ? "bg-primary" : "bg-surface-container-highest"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${sameRoom ? "translate-x-4 bg-on-primary" : "bg-outline"}`} />
                  </span>
                </button>
              )}
            </div>

            {activeRooms.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4 bg-surface-container-low border border-dashed border-outline-variant rounded-m3-md text-[13px] text-on-surface-variant">
                <DoorOpen size={16} className="text-on-surface-variant" /> {t.noRoomsYet}
                <Link href="/manager/rooms" className="font-semibold text-primary hover:underline">{t.addRoomLink}</Link>
              </div>
            ) : enabledDays.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4 bg-surface-container-low border border-dashed border-outline-variant rounded-m3-md text-[13px] text-on-surface-variant">
                <DoorOpen size={16} /> {t.pickDaysFirst}
              </div>
            ) : sameRoom ? (
              <div className="flex flex-wrap items-center gap-2">
                {renderRoomSelect(uniRoom, setUniRoom)}
                <button type="button" onClick={suggestFreeRoom}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-primary-container text-on-primary-container rounded-full text-[12.5px] font-semibold transition-colors shrink-0">
                  <Wand2 size={14} /> {t.suggestFreeRoom}
                </button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {enabledDays.map((d) => (
                  <div key={d.dayOfWeek} className="flex items-center gap-2 p-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-lg">
                    <span className="w-8 h-8 rounded-m3-sm flex items-center justify-center text-[11px] font-bold bg-surface-container text-on-surface-variant shrink-0">{t.dayShort[d.dayOfWeek]}</span>
                    {renderRoomSelect(dayStates[d.dayOfWeek].roomId || "", (v) => setDayRoom(d.dayOfWeek, v))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
