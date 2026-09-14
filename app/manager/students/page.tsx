"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, documentId, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { fetchCenterSessions } from "@/services/attendanceService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { Users, Loader2, Clock, CalendarCheck, CalendarX2, ChevronRight, Plus, UserPlus, Search, X, ArrowRight, ScanFace } from "lucide-react";
import { Button } from "@/components/manager-ui";
import FaceTerminalStatus from "@/components/attendance/FaceTerminalStatus";
import ManagerStudentInfoPanel from "./_components/ManagerStudentInfoPanel";
import CreateStudentModal from "./_components/CreateStudentModal";
import AddExistingStudentModal from "./_components/AddExistingStudentModal";
import SearchInput from "../_components/SearchInput";
import FilterSelect from "../_components/FilterSelect";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

type TodayStatus = "present" | "late" | "absent" | "unmarked" | "nolesson";
type AttendanceStatus = "present" | "late" | "absent";

const TRANSLATIONS = {
  uz: {
    weekdayShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    weekdayFull: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
    status: {
      present: "Keldi",
      late: "Kech qoldi",
      absent: "Kelmadi",
      unmarked: "Belgilanmagan",
      nolesson: "Bugun dars yo'q",
    } as Record<TodayStatus, string>,
    unknown: "Noma'lum",
    title: "O'quvchilar",
    subtitle: "Markazdagi barcha o'quvchilar, guruhlari va bugungi davomat",
    todayLine: (weekday: string, day: number) => `${weekday}, ${day}-kun`,
    addStudent: "O'quvchi qo'shish",
    statTotal: "Jami o'quvchi",
    statHasLesson: "Bugun darsi bor",
    statPresent: "Bugun keldi",
    statAbsent: "Bugun kelmadi",
    searchPlaceholder: "Ism yoki @username bo'yicha qidiring...",
    allGroups: "Barcha guruhlar",
    quickAll: "Hammasi",
    quickToday: "Bugun darsi bor",
    quickAbsent: "Kelmaganlar",
    emptyTitle: "O'quvchilar yo'q",
    emptyDesc: "«O'quvchi qo'shish» tugmasi orqali yangi hisob yarating yoki mavjudini qo'shing.",
    noResultsTitle: "Topilmadi",
    noResultsDesc: "Qidiruv yoki filtrlarga mos o'quvchi yo'q.",
    thStudent: "O'quvchi",
    thGroup: "Guruh",
    thDays: "Dars kunlari",
    thToday: "Bugun",
    noGroup: "Guruhsiz",
    noSchedule: "— jadval yo'q",
    chooserTitle: "O'quvchi qo'shish",
    createTitle: "Yangi hisob yaratish",
    createDesc: "Login va parol bilan tayyor hisob tuziladi",
    linkTitle: "Mavjud hisobni qo'shish",
    linkDesc: "Email yoki @username orqali topish — guruhsiz ham",
  },
  en: {
    weekdayShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    weekdayFull: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    status: {
      present: "Present",
      late: "Late",
      absent: "Absent",
      unmarked: "Not marked",
      nolesson: "No lesson today",
    } as Record<TodayStatus, string>,
    unknown: "Unknown",
    title: "Students",
    subtitle: "All students of the center, their groups and today's attendance",
    todayLine: (weekday: string, day: number) => `${weekday}, day ${day}`,
    addStudent: "Add student",
    statTotal: "Total students",
    statHasLesson: "Have a lesson today",
    statPresent: "Came today",
    statAbsent: "Absent today",
    searchPlaceholder: "Search by name or @username...",
    allGroups: "All groups",
    quickAll: "All",
    quickToday: "Lesson today",
    quickAbsent: "Absent",
    emptyTitle: "No students",
    emptyDesc: "Use the \"Add student\" button to create a new account or add an existing one.",
    noResultsTitle: "Not found",
    noResultsDesc: "No student matches the search or filters.",
    thStudent: "Student",
    thGroup: "Group",
    thDays: "Lesson days",
    thToday: "Today",
    noGroup: "No group",
    noSchedule: "— no schedule",
    chooserTitle: "Add student",
    createTitle: "Create a new account",
    createDesc: "A ready-made account with a login and password",
    linkTitle: "Add an existing account",
    linkDesc: "Find by email or @username — even without a group",
  },
  ru: {
    weekdayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    weekdayFull: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    status: {
      present: "Пришёл",
      late: "Опоздал",
      absent: "Не пришёл",
      unmarked: "Не отмечен",
      nolesson: "Сегодня нет занятий",
    } as Record<TodayStatus, string>,
    unknown: "Неизвестно",
    title: "Ученики",
    subtitle: "Все ученики центра, их группы и сегодняшняя посещаемость",
    todayLine: (weekday: string, day: number) => `${weekday}, ${day}-е число`,
    addStudent: "Добавить ученика",
    statTotal: "Всего учеников",
    statHasLesson: "Сегодня есть занятие",
    statPresent: "Сегодня пришли",
    statAbsent: "Сегодня не пришли",
    searchPlaceholder: "Поиск по имени или @username...",
    allGroups: "Все группы",
    quickAll: "Все",
    quickToday: "Сегодня занятие",
    quickAbsent: "Отсутствующие",
    emptyTitle: "Учеников нет",
    emptyDesc: "Нажмите «Добавить ученика», чтобы создать новый аккаунт или добавить существующий.",
    noResultsTitle: "Не найдено",
    noResultsDesc: "Нет учеников, соответствующих поиску или фильтрам.",
    thStudent: "Ученик",
    thGroup: "Группа",
    thDays: "Дни занятий",
    thToday: "Сегодня",
    noGroup: "Без группы",
    noSchedule: "— нет расписания",
    chooserTitle: "Добавить ученика",
    createTitle: "Создать новый аккаунт",
    createDesc: "Готовый аккаунт с логином и паролем",
    linkTitle: "Добавить существующий аккаунт",
    linkDesc: "Поиск по email или @username — можно и без группы",
  },
};
type T = typeof TRANSLATIONS.uz;

interface StudentRow {
  id: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  groups: { id: string; title: string }[];
  scheduleDays: number[];       // union of weekdays across their groups
  uniformTime: string | null;   // "14:00–15:30" if all lessons share it, else null
  todayStatus: TodayStatus;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const isWeekend = (d: number) => d === 0 || d === 6;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Status → tone classes (labels come from the language dict).
const STATUS_STYLE: Record<TodayStatus, { cls: string; dot: string }> = {
  present:  { cls: "bg-success-container text-on-success-container",  dot: "bg-success" },
  late:     { cls: "bg-warning-container text-on-warning-container",   dot: "bg-warning" },
  absent:   { cls: "bg-error-container text-on-error-container",     dot: "bg-error" },
  unmarked: { cls: "bg-surface-container-highest text-on-surface-variant",  dot: "bg-outline" },
  nolesson: { cls: "bg-surface-container text-on-surface-variant",   dot: "bg-outline-variant" },
};

export default function ManagerStudentsPage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, isLoading: loadingClasses, refetch } = useCenterClasses(centerId);

  // 🟢 Center roster links (center_students) — THE membership source. A linked
  // student appears even with zero groups; live so create/link flows show
  // up instantly.
  const [links, setLinks] = useState<{ studentId: string; studentName?: string }[] | null>(null);
  useEffect(() => {
    if (!centerId) return;
    const q = query(collection(db, "center_students"), where("centerId", "==", centerId));
    const unsub = onSnapshot(
      q,
      (snap) => setLinks(snap.docs.map((d) => ({ studentId: d.data().studentId, studentName: d.data().studentName }))),
      (err) => { console.error("center_students error:", err); setLinks([]); },
    );
    return () => unsub();
  }, [centerId]);

  const [profiles, setProfiles] = useState<Record<string, { displayName: string; username?: string; photoURL?: string }>>({});
  // todaySessions[classId][studentId] = status
  const [todaySessions, setTodaySessions] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);

  // Center time (Asia/Tashkent), not device-local — see ATTENDANCE.md rule #3.
  const today = useMemo(() => getTodayKey(), []);
  const todayWeekday = useMemo(() => parseDateKey(getTodayKey()).getDay(), []);

  // Fetch student profiles + today's attendance sessions once classes + links are known.
  useEffect(() => {
    if (loadingClasses || links === null) return;
    const linkIds = links.map((l) => l.studentId);
    if ((classes.length === 0 && linkIds.length === 0) || !centerId) {
      setProfiles({});
      setTodaySessions({});
      setLoadingExtra(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingExtra(true);

      // Profiles — chunked `in` queries (max 10 ids each). Kept in their own
      // try/catch so an attendance failure can never blank the student list.
      const profileMap: Record<string, { displayName: string; username?: string; photoURL?: string }> = {};
      try {
        const ids = [...new Set([...classes.flatMap((c) => c.studentIds || []), ...linkIds])];
        await Promise.all(
          chunk(ids, 10).map(async (part) => {
            if (part.length === 0) return;
            const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", part)));
            snap.docs.forEach((d) => {
              profileMap[d.id] = {
                displayName: d.data()?.displayName || t.unknown,
                username: d.data()?.username,
                photoURL: d.data()?.photoURL || undefined,
              };
            });
          })
        );
      } catch (err) {
        console.error("Profiles error:", err);
      }
      if (mounted) setProfiles(profileMap);

      // Today's sessions — ONE centerId+date list query instead of per-class
      // getDoc()s: the strict per-document GET rule denies docs with a
      // missing/stale centerId, while `allow list` only needs isAuth().
      try {
        const sessions = await fetchCenterSessions(centerId, today, today);
        const sessMap: Record<string, Record<string, AttendanceStatus>> = {};
        for (const s of sessions) {
          const statusMap: Record<string, AttendanceStatus> = {};
          Object.keys(s.records).forEach((uid) => {
            statusMap[uid] = s.records[uid].status as AttendanceStatus;
          });
          sessMap[s.classId] = statusMap;
        }
        if (mounted) setTodaySessions(sessMap);
      } catch (err) {
        console.error("Attendance error:", err);
      }

      if (mounted) setLoadingExtra(false);
    })();
    return () => { mounted = false; };
  }, [classes, loadingClasses, centerId, today, links]);

  // Lazy backfill: class-enrolled students who predate center_students get a
  // link doc once (idempotent, fire-and-forget) so the roster converges to
  // center_students as THE membership source.
  const backfilled = useRef(new Set<string>());
  useEffect(() => {
    if (!centerId || links === null) return;
    const linked = new Set(links.map((l) => l.studentId));
    for (const sid of new Set(classes.flatMap((c) => c.studentIds || []))) {
      if (linked.has(sid) || backfilled.current.has(sid)) continue;
      backfilled.current.add(sid);
      setDoc(doc(db, "center_students", `${centerId}_${sid}`), {
        centerId,
        studentId: sid,
        studentName: profiles[sid]?.displayName || "",
        source: "enrolled",
        addedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }, [centerId, links, classes, profiles]);

  // Build one row per student (A→Z): roster links first (class-free students
  // included), then class rosters merged on top.
  const rows = useMemo<StudentRow[]>(() => {
    const byStudent = new Map<string, StudentRow>();

    for (const l of links || []) {
      const prof = profiles[l.studentId];
      byStudent.set(l.studentId, {
        id: l.studentId,
        displayName: prof?.displayName || l.studentName || t.unknown,
        username: prof?.username,
        photoURL: prof?.photoURL,
        groups: [], scheduleDays: [], uniformTime: null, todayStatus: "nolesson",
      });
    }

    for (const c of classes) {
      for (const sid of c.studentIds || []) {
        let row = byStudent.get(sid);
        if (!row) {
          const prof = profiles[sid];
          if (!prof) continue;
          row = { id: sid, displayName: prof.displayName, username: prof.username, photoURL: prof.photoURL, groups: [], scheduleDays: [], uniformTime: null, todayStatus: "nolesson" };
          byStudent.set(sid, row);
        }
        row.groups.push({ id: c.id, title: c.title });
        for (const s of c.schedule || []) {
          if (!row.scheduleDays.includes(s.dayOfWeek)) row.scheduleDays.push(s.dayOfWeek);
        }
      }
    }

    // Resolve schedule ordering, uniform time, and today's status per student.
    for (const row of byStudent.values()) {
      row.scheduleDays.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));

      // Uniform time across all this student's group lessons.
      const times = new Set<string>();
      const todayGroups: string[] = [];
      for (const g of row.groups) {
        const cls = classes.find((c) => c.id === g.id);
        cls?.schedule?.forEach((s) => {
          times.add(`${s.startTime}–${s.endTime}`);
          if (s.dayOfWeek === todayWeekday) todayGroups.push(g.id);
        });
      }
      row.uniformTime = times.size === 1 ? [...times][0] : null;

      // Today's status — aggregate across every group meeting today (best status wins).
      if (todayGroups.length === 0) {
        row.todayStatus = "nolesson";
      } else {
        const seen = todayGroups.map((cid) => todaySessions[cid]?.[row.id]);
        if (seen.includes("present")) row.todayStatus = "present";
        else if (seen.includes("late")) row.todayStatus = "late";
        else if (seen.includes("absent")) row.todayStatus = "absent";
        else row.todayStatus = "unmarked";
      }
    }

    return [...byStudent.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "uz", { sensitivity: "base" }));
  }, [classes, profiles, todaySessions, todayWeekday, links]);

  // Student info dialog + add flows.
  const [viewingStudent, setViewingStudent] = useState<StudentRow | null>(null);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [quick, setQuick] = useState<"all" | "today" | "absent">("all");

  const groupOptions = useMemo(
    () => classes.map((c) => ({ value: c.id, label: c.title })).sort((a, b) => a.label.localeCompare(b.label)),
    [classes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.displayName.toLowerCase().includes(q) && !(r.username || "").toLowerCase().includes(q)) return false;
      if (groupFilter && !r.groups.some((g) => g.id === groupFilter)) return false;
      if (quick === "today" && r.todayStatus === "nolesson") return false;
      if (quick === "absent" && r.todayStatus !== "absent") return false;
      return true;
    });
  }, [rows, search, groupFilter, quick]);

  // ── Summary ──
  const haveLessonToday = rows.filter((r) => r.todayStatus !== "nolesson").length;
  const presentToday = rows.filter((r) => r.todayStatus === "present").length;
  const absentToday = rows.filter((r) => r.todayStatus === "absent").length;

  const loading = loadingClasses || loadingExtra;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block capitalize text-[13px] font-medium text-on-surface-variant">
            {t.todayLine(t.weekdayFull[todayWeekday], new Date().getDate())}
          </span>
          <FaceTerminalStatus />
          <Link
            href="/manager/face-config"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-bold text-on-surface-variant hover:bg-state-hover hover:text-primary transition-colors"
          >
            <ScanFace size={13} /> Face ID
          </Link>
          <Button onClick={() => setIsChooserOpen(true)} icon={<Plus size={18} strokeWidth={2.5} />}>
            {t.addStudent}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users size={16} />} tone="bg-primary-container text-on-primary-container" value={rows.length} label={t.statTotal} />
        <StatCard icon={<CalendarCheck size={16} />} tone="bg-tertiary-container text-on-tertiary-container" value={haveLessonToday} label={t.statHasLesson} />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-success" />} tone="bg-success-container" value={presentToday} label={t.statPresent} />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-error" />} tone="bg-error-container" value={absentToday} label={t.statAbsent} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />

        {classes.length > 1 && (
          <FilterSelect
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            allLabel={t.allGroups}
          />
        )}

        <div className="flex items-center gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-full">
          {([["all", t.quickAll], ["today", t.quickToday], ["absent", t.quickAbsent]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setQuick(key)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                quick === key ? "bg-primary text-on-primary shadow-elev-1" : "text-on-surface-variant hover:bg-state-hover hover:text-on-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={28} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title={t.emptyTitle} subtitle={t.emptyDesc} />
        ) : filtered.length === 0 ? (
          <EmptyState title={t.noResultsTitle} subtitle={t.noResultsDesc} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold uppercase tracking-wide border-b border-outline-variant">
                  <th className="py-3 pl-5 pr-2 w-10">#</th>
                  <th className="py-3 px-2">{t.thStudent}</th>
                  <th className="py-3 px-2">{t.thGroup}</th>
                  <th className="py-3 px-2">{t.thDays}</th>
                  <th className="py-3 px-2 pr-5 text-right">{t.thToday}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((r, i) => {
                  const st = STATUS_STYLE[r.todayStatus];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setViewingStudent(r)}
                      className="hover:bg-state-hover transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pl-5 pr-2 text-[12px] font-semibold text-on-surface-variant tabular-nums">{i + 1}</td>

                      {/* Student */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 shrink-0 rounded-full object-cover border border-outline-variant" />
                          ) : (
                            <span className="w-8 h-8 shrink-0 rounded-full bg-primary-container text-on-primary-container font-bold text-[11px] flex items-center justify-center">
                              {getInitials(r.displayName)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-on-surface truncate">{r.displayName}</p>
                            {r.username && <p className="text-[11px] text-on-surface-variant truncate">@{r.username}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Groups */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {r.groups.length === 0 && (
                            <span className="px-2.5 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-[11px] font-bold">
                              {t.noGroup}
                            </span>
                          )}
                          {r.groups.slice(0, 2).map((g) => (
                            <Link
                              key={g.id}
                              href={`/manager/attendance/${g.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold transition-colors max-w-[160px]"
                            >
                              <span className="truncate">{g.title}</span>
                              <ChevronRight size={11} className="shrink-0 opacity-60" />
                            </Link>
                          ))}
                          {r.groups.length > 2 && (
                            <span className="px-2.5 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-[11px] font-bold">+{r.groups.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Schedule days */}
                      <td className="py-2.5 px-2">
                        {r.scheduleDays.length === 0 ? (
                          <span className="text-[11px] text-on-surface-variant">{t.noSchedule}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {r.scheduleDays.map((d) => (
                                <span
                                  key={d}
                                  title={t.weekdayFull[d]}
                                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                    d === todayWeekday
                                      ? "bg-primary text-on-primary"
                                      : isWeekend(d)
                                      ? "bg-error-container text-on-error-container"
                                      : "bg-surface-container-highest text-on-surface-variant"
                                  }`}
                                >
                                  {t.weekdayShort[d]}
                                </span>
                              ))}
                            </div>
                            {r.uniformTime && (
                              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant tabular-nums">
                                <Clock size={11} /> {r.uniformTime}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Today status */}
                      <td className="py-2.5 px-2 pr-5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${st.cls}`}>
                          <span className={`w-2 h-2 rounded-full ${st.dot}`} /> {t.status[r.todayStatus]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add-method chooser: create a new account vs link an existing one */}
      {isChooserOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsChooserOpen(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 shadow-elev-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.chooserTitle}</h2>
              <button type="button" onClick={() => setIsChooserOpen(false)}
                className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="space-y-3">
              <button type="button"
                onClick={() => { setIsChooserOpen(false); setIsCreateOpen(true); }}
                className="w-full flex items-center gap-4 p-4 bg-primary-container rounded-m3-lg text-left transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 bg-primary rounded-m3-lg flex items-center justify-center text-on-primary shrink-0 shadow-elev-1">
                  <UserPlus size={22} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-on-primary-container">{t.createTitle}</p>
                  <p className="text-[12.5px] text-on-primary-container mt-0.5">{t.createDesc}</p>
                </div>
                <ArrowRight size={18} className="text-on-primary-container shrink-0" />
              </button>
              <button type="button"
                onClick={() => { setIsChooserOpen(false); setIsLinkOpen(true); }}
                className="w-full flex items-center gap-4 p-4 bg-surface-container-low hover:bg-state-hover border border-outline-variant rounded-m3-lg text-left transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 bg-surface-container-lowest border border-outline-variant rounded-m3-lg flex items-center justify-center text-on-surface-variant shrink-0">
                  <Search size={22} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-on-surface">{t.linkTitle}</p>
                  <p className="text-[12.5px] text-on-surface-variant mt-0.5">{t.linkDesc}</p>
                </div>
                <ArrowRight size={18} className="text-on-surface-variant shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <CreateStudentModal
          classes={classes}
          onClose={() => setIsCreateOpen(false)}
          onCreated={refetch}
        />
      )}

      {isLinkOpen && centerId && (
        <AddExistingStudentModal
          centerId={centerId}
          onClose={() => setIsLinkOpen(false)}
        />
      )}

      {/* Student Info Dialog */}
      {viewingStudent && (
        <ManagerStudentInfoPanel
          studentUid={viewingStudent.id}
          fallbackName={viewingStudent.displayName}
          centerId={centerId}
          classes={classes.filter((c) => (c.studentIds || []).includes(viewingStudent.id))}
          todayBadge={{ ...STATUS_STYLE[viewingStudent.todayStatus], label: t.status[viewingStudent.todayStatus] }}
          onPhotoChange={(url) =>
            setProfiles((prev) => ({
              ...prev,
              [viewingStudent.id]: { ...prev[viewingStudent.id], photoURL: url || undefined },
            }))
          }
          onRemoved={refetch}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold text-on-surface leading-none tabular-nums">{value}</p>
        <p className="text-[12px] text-on-surface-variant mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3">
        <CalendarX2 size={22} />
      </div>
      <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      <p className="text-[13px] text-on-surface-variant mt-1 max-w-[260px]">{subtitle}</p>
    </div>
  );
}
