"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  Save, Loader2, User, Check, CheckCheck, Clock, X, Plus, CalendarX2, Search,
  ShieldCheck, Ban, CalendarOff, CalendarPlus, MoreVertical, MessageSquare, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  AttendanceStatus,
  AttendanceRecord,
  LessonStatus,
  ScheduleEntry,
} from "@/types/attendance";
import { getTodayKey, formatDateKey, parseDateKey } from "@/lib/dateUtils";
import { tallyStudent, type CenterSession, type StudentTally } from "@/services/attendanceService";

// The shared attendance spreadsheet used by BOTH the teacher and manager tabs.
// Data model: `center_attendance/{classId}_{date}` with a rich per-cell record.

interface Props {
  classId: string;
  centerId: string;
  studentIds: string[];
  /** uid of the teacher/manager doing the marking. */
  recordedBy: string;
  schedule: ScheduleEntry[];
  /** Edge-to-edge: drop the card rounding + side borders (full-bleed hosts). */
  flush?: boolean;
}

interface StudentRecord {
  id: string;
  displayName: string;
  username?: string;
}

// Per-date metadata we keep alongside the records map so a full-doc write
// preserves createdAt / lessonStatus.
interface LessonMeta {
  lessonStatus: LessonStatus;
  cancelReason?: string;
  createdAt?: Timestamp;
  exists: boolean; // did a Firestore doc already exist when loaded?
}

const PAST_DAYS = 31;
const FUTURE_DAYS = 31;
const AUTOSAVE_MS = 1000;

// Column geometry. On phones the frozen area (# + name) would eat the whole
// viewport — 44+208 leaves ~110px for dates on a 360px screen — so the compact
// mode drops the "#" column and shrinks the rest. Desktop values are unchanged.
const COLS = {
  wide:    { num: 44, name: 208, date: 80, tail: 64 },
  compact: { num: 0,  name: 146, date: 62, tail: 52 },
} as const;

const WEEKDAY_SHORT = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
const MONTH_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Color the attendance-% pill by band.
function rateBadgeClass(rate: number | null): string {
  if (rate === null) return "bg-slate-100 text-slate-400";
  if (rate >= 90) return "bg-emerald-100 text-emerald-700";
  if (rate >= 75) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

// Schedule-derived lesson dates across the ±window (chronological keys).
function buildScheduleDates(schedule: ScheduleEntry[], todayStr: string): string[] {
  const weekdays = new Set(schedule.map((s) => s.dayOfWeek));
  if (weekdays.size === 0) return [];
  const today = parseDateKey(todayStr);
  const start = new Date(today); start.setDate(start.getDate() - PAST_DAYS);
  const end = new Date(today); end.setDate(end.getDate() + FUTURE_DAYS);
  const dates: string[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 400) {
    if (weekdays.has(cur.getDay())) dates.push(formatDateKey(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return dates;
}

// Normalize a stored record: tolerate the legacy flat string shape ("present")
// as well as the new object shape, so a half-migrated collection never crashes.
function normalizeRecord(raw: unknown, fallbackBy: string): AttendanceRecord | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { status: raw as AttendanceStatus, method: "manual", markedBy: fallbackBy, markedAt: Timestamp.now() };
  }
  if (typeof raw === "object" && raw !== null && "status" in raw) {
    const r = raw as Partial<AttendanceRecord> & { status: AttendanceStatus };
    // Only include optional fields when present — Firestore rejects `undefined` on write,
    // and these records get re-saved as part of the day's full records map.
    const rec: AttendanceRecord = {
      status: r.status,
      method: r.method || "manual",
      markedBy: r.markedBy || fallbackBy,
      markedAt: r.markedAt instanceof Timestamp ? r.markedAt : Timestamp.now(),
    };
    if (r.note !== undefined && r.note !== null) rec.note = r.note;
    if (typeof r.confidence === "number") rec.confidence = r.confidence;
    return rec;
  }
  return null;
}

const STATUS: Record<AttendanceStatus, { label: string; solid: string; chip: string; dot: string; Icon: React.ElementType }> = {
  present: { label: "Keldi", solid: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/30", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", Icon: Check },
  late: { label: "Kech qoldi", solid: "bg-amber-400 hover:bg-amber-500 text-white shadow-sm shadow-amber-400/30", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", Icon: Clock },
  absent: { label: "Kelmadi", solid: "bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/30", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", Icon: X },
  excused: { label: "Sababli", solid: "bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/30", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500", Icon: ShieldCheck },
};
const STATUS_ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];

const LESSON_META: Record<LessonStatus, { label: string; Icon: React.ElementType }> = {
  held: { label: "Dars bo'ldi", Icon: Check },
  cancelled: { label: "Bekor qilindi", Icon: Ban },
  holiday: { label: "Bayram / dam", Icon: CalendarOff },
  makeup: { label: "Qo'shimcha dars", Icon: CalendarPlus },
};

const SCROLLBAR_CLASSES =
  "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 " +
  "[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]";

export default function AttendanceGrid({ classId, centerId, studentIds, recordedBy, schedule, flush }: Props) {
  const today = useMemo(() => getTodayKey(), []);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");

  // sessions[date][uid] = record ; meta[date] = lesson-level metadata
  const [sessions, setSessions] = useState<Record<string, Record<string, AttendanceRecord>>>({});
  const [meta, setMeta] = useState<Record<string, LessonMeta>>({});
  const [makeupDates, setMakeupDates] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Dates that changed since last successful save (date-level granularity).
  const [dirtyDates, setDirtyDates] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [menu, setMenu] = useState<{ date: string; studentId: string; x: number; y: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [headerMenu, setHeaderMenu] = useState<{ date: string; x: number; y: number } | null>(null);
  const [addingMakeup, setAddingMakeup] = useState(false);
  const [makeupInput, setMakeupInput] = useState(today);
  const [drawer, setDrawer] = useState<StudentRecord | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorThRef = useRef<HTMLTableCellElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phone layout (< 640px, matches Tailwind's sm). matchMedia, not a resize
  // listener, so it fires once per breakpoint crossing.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const col = compact ? COLS.compact : COLS.wide;
  const frozenWidth = col.num + col.name;

  const scheduleDates = useMemo(() => buildScheduleDates(schedule, today), [schedule, today]);

  // Union of schedule days + any persisted docs (incl. makeup outside schedule) + pending makeups.
  const lessonDates = useMemo(() => {
    const set = new Set<string>([...scheduleDates, ...Object.keys(meta), ...makeupDates]);
    return Array.from(set).sort();
  }, [scheduleDates, meta, makeupDates]);

  const anchorDate = useMemo(() => {
    if (lessonDates.length === 0) return undefined;
    let idx = lessonDates.findIndex((d) => d >= today);
    if (idx === -1) idx = lessonDates.length - 1;
    return lessonDates[Math.max(0, idx - 2)];
  }, [lessonDates, today]);

  const numberById = useMemo(() => {
    const m = new Map<string, number>();
    students.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [students]);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.displayName.toLowerCase().includes(q) || (s.username || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // Flatten local state into the analytics shape so we can reuse tallyStudent().
  const localSessions = useMemo<CenterSession[]>(() =>
    lessonDates.map((d) => ({
      id: `${classId}_${d}`,
      classId,
      centerId,
      date: d,
      weekday: parseDateKey(d).getDay(),
      lessonStatus: meta[d]?.lessonStatus || "held",
      records: Object.fromEntries(
        Object.entries(sessions[d] || {}).map(([uid, r]) => [uid, { status: r.status }])
      ),
    })),
  [lessonDates, sessions, meta, classId, centerId]);

  const tallies = useMemo(() => {
    const m = new Map<string, StudentTally>();
    students.forEach((s) => m.set(s.id, tallyStudent(localSessions, s.id, today)));
    return m;
  }, [students, localSessions, today]);

  // ── Fetch student profiles ─────────────────────────────────────────────────
  useEffect(() => {
    if (studentIds.length === 0) { setStudents([]); setLoadingStudents(false); return; }
    let mounted = true;
    (async () => {
      setLoadingStudents(true);
      try {
        const snaps = await Promise.all(studentIds.map((id) => getDoc(doc(db, "users", id))));
        const data: StudentRecord[] = snaps
          .filter((s) => s.exists())
          .map((s) => ({ id: s.id, displayName: s.data()?.displayName || "Noma'lum", username: s.data()?.username }));
        data.sort((a, b) => a.displayName.localeCompare(b.displayName, "uz", { sensitivity: "base" }));
        if (mounted) setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    })();
    return () => { mounted = false; };
  }, [studentIds]);

  // ── Fetch every session in the window with ONE query (was N getDocs) ────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingSessions(true);
      try {
        const start = new Date(parseDateKey(today)); start.setDate(start.getDate() - PAST_DAYS);
        const end = new Date(parseDateKey(today)); end.setDate(end.getDate() + FUTURE_DAYS);
        const startKey = formatDateKey(start);
        const endKey = formatDateKey(end);

        const qy = query(
          collection(db, "center_attendance"),
          where("classId", "==", classId),
          where("date", ">=", startKey),
          where("date", "<=", endKey)
        );
        const snap = await getDocs(qy);

        const sess: Record<string, Record<string, AttendanceRecord>> = {};
        const mt: Record<string, LessonMeta> = {};
        snap.forEach((d) => {
          const data = d.data();
          const dateKey = data.date as string;
          const recs: Record<string, AttendanceRecord> = {};
          const rawRecords = data.records || {};
          Object.keys(rawRecords).forEach((uid) => {
            const norm = normalizeRecord(rawRecords[uid], data.recordedBy || recordedBy);
            if (norm) recs[uid] = norm;
          });
          sess[dateKey] = recs;
          mt[dateKey] = {
            lessonStatus: (data.lessonStatus as LessonStatus) || "held",
            cancelReason: data.cancelReason,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
            exists: true,
          };
        });

        if (mounted) { setSessions(sess); setMeta(mt); setDirtyDates(new Set()); setSaveState("idle"); }
      } catch (err) {
        console.error(err);
        toast.error("Davomatni yuklashda xatolik.");
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    })();
    return () => { mounted = false; };
  }, [classId, today, recordedBy]);

  // Default scroll: anchor column flush against the frozen area.
  useEffect(() => {
    if (loadingSessions) return;
    const th = anchorThRef.current;
    const container = scrollRef.current;
    if (!th || !container) return;
    const thLeft = th.getBoundingClientRect().left;
    const containerLeft = container.getBoundingClientRect().left;
    container.scrollLeft += thLeft - containerLeft - frozenWidth;
  }, [loadingSessions, frozenWidth]);

  // Close popovers on scroll/resize.
  useEffect(() => {
    if (!menu && !headerMenu) return;
    const close = () => { setMenu(null); setHeaderMenu(null); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menu, headerMenu]);

  const markDirty = useCallback((date: string) => {
    setDirtyDates((prev) => { const next = new Set(prev); next.add(date); return next; });
    setSaveState("idle");
  }, []);

  const ensureMeta = useCallback((date: string) => {
    setMeta((prev) => prev[date] ? prev : { ...prev, [date]: { lessonStatus: "held", exists: false } });
  }, []);

  const setStatus = (date: string, studentId: string, status: AttendanceStatus, note?: string) => {
    ensureMeta(date);
    setSessions((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [studentId]: {
          status,
          method: "manual",
          markedBy: recordedBy,
          markedAt: Timestamp.now(),
          ...(note ? { note } : {}),
        },
      },
    }));
    markDirty(date);
  };

  const clearStatus = (date: string, studentId: string) => {
    setSessions((prev) => {
      const col = { ...(prev[date] || {}) };
      delete col[studentId];
      return { ...prev, [date]: col };
    });
    markDirty(date);
  };

  const markColumnAll = (date: string, status: AttendanceStatus) => {
    ensureMeta(date);
    setSessions((prev) => {
      const col = { ...(prev[date] || {}) };
      students.forEach((s) => { col[s.id] = { status, method: "manual", markedBy: recordedBy, markedAt: Timestamp.now() }; });
      return { ...prev, [date]: col };
    });
    markDirty(date);
  };

  const setLessonStatus = (date: string, lessonStatus: LessonStatus) => {
    setMeta((prev) => ({ ...prev, [date]: { ...(prev[date] || { exists: false }), lessonStatus } }));
    markDirty(date);
    setHeaderMenu(null);
  };

  const addMakeupDate = (dateKey: string) => {
    if (!dateKey) return;
    setMakeupDates((prev) => (prev.includes(dateKey) ? prev : [...prev, dateKey]));
    setMeta((prev) => prev[dateKey] ? prev : { ...prev, [dateKey]: { lessonStatus: "makeup", exists: false } });
    markDirty(dateKey);
    setAddingMakeup(false);
  };

  // ── Persistence: full-doc write per dirty date (state carries per-cell
  // markedAt/markedBy, so a full overwrite preserves them without merge). ──────
  const flushDates = useCallback(async (dates: string[]) => {
    if (dates.length === 0) return;
    setSaveState("saving");
    try {
      await Promise.all(dates.map((d) => {
        const m = meta[d] || { lessonStatus: "held" as LessonStatus, exists: false };
        const weekday = parseDateKey(d).getDay();
        const payload: Record<string, unknown> = {
          id: `${classId}_${d}`,
          classId,
          centerId,
          date: d,
          weekday,
          lessonStatus: m.lessonStatus,
          records: sessions[d] || {},
          recordedBy,
          createdAt: m.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (m.cancelReason) payload.cancelReason = m.cancelReason;
        return setDoc(doc(db, "center_attendance", `${classId}_${d}`), payload);
      }));
      // Mark saved dates as existing so future writes keep createdAt.
      setMeta((prev) => {
        const next = { ...prev };
        dates.forEach((d) => { if (next[d]) next[d] = { ...next[d], exists: true }; });
        return next;
      });
      setDirtyDates((prev) => {
        const next = new Set(prev);
        dates.forEach((d) => next.delete(d));
        return next;
      });
      setSaveState("saved");
    } catch (err) {
      console.error(err);
      setSaveState("error");
      toast.error("Saqlashda xatolik. Qayta urinilmoqda...");
    }
  }, [classId, centerId, recordedBy, sessions, meta]);

  // Debounced autosave whenever there are dirty dates.
  useEffect(() => {
    if (dirtyDates.size === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { flushDates(Array.from(dirtyDates)); }, AUTOSAVE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirtyDates, flushDates]);

  // Flush on unmount / tab close so nothing is lost mid-edit.
  useEffect(() => {
    const handler = () => { if (dirtyDates.size > 0) flushDates(Array.from(dirtyDates)); };
    window.addEventListener("beforeunload", handler);
    return () => { window.removeEventListener("beforeunload", handler); handler(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyDates]);

  const openMenu = (e: React.MouseEvent, date: string, studentId: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 216);
    setNoteDraft(sessions[date]?.[studentId]?.note || "");
    setMenu({ date, studentId, x: Math.max(8, x), y: rect.bottom + 6 });
  };

  const openHeaderMenu = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 200);
    setHeaderMenu({ date, x: Math.max(8, x), y: rect.bottom + 6 });
  };

  const handleCellClick = (e: React.MouseEvent, date: string, studentId: string) => {
    const current = sessions[date]?.[studentId];
    if (!current) setStatus(date, studentId, "present");
    else openMenu(e, date, studentId);
  };

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (schedule.length === 0 && makeupDates.length === 0 && Object.keys(meta).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4"><CalendarX2 size={26} /></div>
        <h3 className="text-sm font-semibold text-slate-700">Dars jadvali kiritilmagan</h3>
        <p className="text-[13px] text-slate-500 mt-1.5 max-w-[320px]">Bu guruh uchun hali dars jadvali belgilanmagan. Davomat kunlari jadval asosida ochiladi.</p>
      </div>
    );
  }
  if (loadingStudents || loadingSessions) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={28} /></div>;
  }
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><User size={24} /></div>
        <h3 className="text-sm font-semibold text-slate-700">O&apos;quvchilar yo&apos;q</h3>
        <p className="text-[13px] text-slate-400 mt-1">Bu guruhga hali o&apos;quvchi qo&apos;shilmagan.</p>
      </div>
    );
  }

  const saveLabel =
    saveState === "saving" ? "Saqlanmoqda..." :
    saveState === "saved" ? "Saqlandi" :
    saveState === "error" ? "Xatolik" :
    dirtyDates.size > 0 ? `Saqlash (${dirtyDates.size})` : "Saqlangan";

  return (
    <div className={`flex flex-col bg-white border-slate-200 overflow-hidden ${flush ? "border-y" : "border rounded-2xl"}`}>
      {/* Top bar: legend + search + save-state. On phones the search+save row
          comes first at full width; the legend wraps underneath. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-3 py-2 sm:py-1.5 border-b border-slate-100">
        <div className="order-2 sm:order-1 flex items-center gap-x-2.5 gap-y-1 flex-wrap">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
              <span className={`w-2 h-2 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label}
            </span>
          ))}
        </div>

        <div className="order-1 sm:order-2 flex w-full sm:w-auto items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchi qidirish..."
              className="w-full sm:w-56 pl-8 pr-7 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Tozalash"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Manual flush fallback + live autosave state */}
          <button
            onClick={() => flushDates(Array.from(dirtyDates))}
            disabled={saveState === "saving" || dirtyDates.size === 0}
            className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] disabled:cursor-not-allowed shadow-sm ${
              saveState === "error" ? "bg-rose-600 text-white" :
              dirtyDates.size > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30" :
              "bg-slate-900 text-white disabled:opacity-40"
            }`}
          >
            {saveState === "saving" ? <Loader2 size={16} className="animate-spin" /> : saveState === "saved" && dirtyDates.size === 0 ? <Check size={16} /> : <Save size={16} />}
            {saveLabel}
          </button>
        </div>
      </div>

      {/* Grid */}
      {/* Flush hosts give the grid the whole page, so size it off the viewport
          (dvh — phone URL bars) instead of a fixed 70%. */}
      <div ref={scrollRef} className={`overflow-auto ${flush ? "max-h-[calc(100dvh-200px)]" : "max-h-[70vh]"} ${SCROLLBAR_CLASSES}`}>
        <table className="border-separate border-spacing-0 w-full">
          <thead>
            <tr>
              {!compact && (
                <th className="sticky top-0 left-0 z-40 bg-slate-800 text-slate-300 text-[11px] font-bold text-center px-0 py-3"
                  style={{ width: col.num, minWidth: col.num }}>#</th>
              )}
              <th className="sticky top-0 z-40 bg-slate-800 text-slate-100 text-[11px] font-semibold uppercase tracking-wide text-left px-2 sm:px-3 py-3 border-r border-slate-700 shadow-[6px_0_12px_-6px_rgba(0,0,0,0.15)]"
                style={{ left: col.num, width: col.name, minWidth: col.name }}>
                O&apos;quvchi
              </th>
              {lessonDates.map((d) => {
                const dt = parseDateKey(d);
                const isToday = d === today;
                const isFuture = d > today;
                const isAnchor = d === anchorDate;
                const ls = meta[d]?.lessonStatus || "held";
                const inactive = ls === "cancelled" || ls === "holiday";
                const headBg = inactive ? "bg-slate-500" : isToday ? "bg-indigo-600" : isFuture ? "bg-slate-400" : ls === "makeup" ? "bg-violet-600" : "bg-slate-800";
                return (
                  <th key={d} ref={isAnchor ? anchorThRef : undefined}
                    style={{ width: col.date, minWidth: col.date }}
                    className={`sticky top-0 z-30 ${headBg} px-1 py-2.5 align-top border-l border-white/10`}>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-0.5 w-full justify-center relative">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{WEEKDAY_SHORT[dt.getDay()]}</span>
                        <button type="button" onClick={(e) => openHeaderMenu(e, d)} title="Dars holati"
                          className="absolute right-0 p-0.5 rounded text-white/60 hover:text-white hover:bg-white/15 transition-colors">
                          <MoreVertical size={12} />
                        </button>
                      </div>
                      <span className="text-[13.5px] font-bold tabular-nums text-white leading-tight">{dt.getDate()} {MONTH_SHORT[dt.getMonth()]}</span>

                      {inactive ? (
                        <span className="text-[9px] text-white/70 mt-0.5">{ls === "cancelled" ? "bekor" : "bayram"}</span>
                      ) : isFuture ? (
                        <span className="text-[9px] text-white/60 mt-0.5">{ls === "makeup" ? "qo'shimcha" : "kutilmoqda"}</span>
                      ) : (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <button type="button" onClick={() => markColumnAll(d, "present")} title="Barchasi keldi"
                            className="p-1 rounded-md text-white/70 hover:bg-emerald-500 hover:text-white transition-colors"><CheckCheck size={12} /></button>
                          <button type="button" onClick={() => markColumnAll(d, "absent")} title="Barchasi kelmadi"
                            className="p-1 rounded-md text-white/70 hover:bg-rose-500 hover:text-white transition-colors"><X size={12} /></button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Add makeup lesson */}
              <th className="sticky top-0 z-30 bg-slate-800 px-1 py-2.5 align-top border-l border-white/10"
                style={{ width: col.tail, minWidth: col.tail }}>
                {addingMakeup ? (
                  <div className="flex flex-col items-center gap-1">
                    <input type="date" value={makeupInput} onChange={(e) => setMakeupInput(e.target.value)}
                      className="w-[58px] text-[9px] rounded px-0.5 py-0.5 text-slate-800" />
                    <div className="flex gap-0.5">
                      <button onClick={() => addMakeupDate(makeupInput)} className="p-0.5 rounded bg-emerald-500 text-white"><Check size={11} /></button>
                      <button onClick={() => setAddingMakeup(false)} className="p-0.5 rounded bg-white/20 text-white"><X size={11} /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setMakeupInput(today); setAddingMakeup(true); }} title="Qo'shimcha dars qo'shish"
                    className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors mx-auto">
                    <CalendarPlus size={16} /><span className="text-[8.5px]">Dars</span>
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.length === 0 && (
              <tr><td colSpan={(compact ? 2 : 3) + lessonDates.length} className="py-10 text-center text-[13px] text-slate-400">&laquo;{search}&raquo; bo&apos;yicha o&apos;quvchi topilmadi</td></tr>
            )}
            {visibleStudents.map((student) => (
              <tr key={student.id} className="group">
                {!compact && (
                  <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-b border-slate-100 text-center transition-colors"
                    style={{ width: col.num, minWidth: col.num }}>
                    <span className="text-[12px] font-semibold text-slate-400 tabular-nums">{numberById.get(student.id)}</span>
                  </td>
                )}
                <td className="sticky z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 px-2 sm:px-3 py-2 transition-colors shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)]"
                  style={{ left: col.num, width: col.name, minWidth: col.name }}>
                  <button type="button" onClick={() => setDrawer(student)} className="flex items-center gap-2 sm:gap-2.5 w-full text-left group/name">
                    <span className="hidden sm:flex w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-[11px] items-center justify-center">{getInitials(student.displayName)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-900 truncate group-hover/name:text-indigo-600 transition-colors">{student.displayName}</p>
                      {student.username && <p className="text-[11px] text-slate-400 truncate">@{student.username}</p>}
                    </div>
                    {(() => {
                      const rate = tallies.get(student.id)?.rate ?? null;
                      return (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold tabular-nums ${rateBadgeClass(rate)}`}>
                          {rate === null ? "–" : `${rate}%`}
                        </span>
                      );
                    })()}
                  </button>
                </td>

                {lessonDates.map((d) => {
                  const rec = sessions[d]?.[student.id];
                  const isFuture = d > today;
                  const isToday = d === today;
                  const ls = meta[d]?.lessonStatus || "held";
                  const inactive = ls === "cancelled" || ls === "holiday";

                  return (
                    <td key={d} className={`border-b border-l border-slate-100 text-center px-1 py-1.5 ${isToday ? "bg-indigo-50/40" : ""} ${inactive ? "bg-slate-50" : ""}`}>
                      {inactive ? (
                        <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-slate-300"><span className="w-3 h-0.5 rounded-full bg-current" /></div>
                      ) : isFuture ? (
                        <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-current" /></div>
                      ) : rec ? (
                        <button type="button" onClick={(e) => handleCellClick(e, d, student.id)}
                          title={`${student.displayName} — ${STATUS[rec.status].label}${rec.note ? ` · ${rec.note}` : ""}`}
                          className={`relative w-9 h-9 mx-auto rounded-lg flex items-center justify-center transition-all active:scale-90 ${STATUS[rec.status].solid}`}>
                          {(() => { const Ico = STATUS[rec.status].Icon; return <Ico size={16} strokeWidth={2.75} />; })()}
                          {rec.note && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white border border-slate-300" />}
                        </button>
                      ) : (
                        <button type="button" onClick={(e) => handleCellClick(e, d, student.id)} title="Bosing — 'Keldi' deb belgilanadi"
                          className="w-9 h-9 mx-auto rounded-lg border border-dashed border-slate-200 text-slate-300 flex items-center justify-center transition-colors hover:border-emerald-300 hover:text-emerald-400 hover:bg-emerald-50/50">
                          <Plus size={15} />
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l border-slate-100" style={{ width: col.tail, minWidth: col.tail }} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell popover: change status, add a note, or clear */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 w-52 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/10 p-1.5" style={{ left: menu.x, top: menu.y }}>
            {STATUS_ORDER.map((s) => {
              const cfg = STATUS[s];
              const active = sessions[menu.date]?.[menu.studentId]?.status === s;
              const Ico = cfg.Icon;
              return (
                <button key={s} type="button"
                  onClick={() => { setStatus(menu.date, menu.studentId, s, noteDraft.trim() || undefined); setMenu(null); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${active ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.chip}`}><Ico size={13} strokeWidth={2.5} /></span>
                  <span className="flex-1 text-left">{cfg.label}</span>
                  {active && <Check size={15} className="text-slate-400" />}
                </button>
              );
            })}
            <div className="h-px bg-slate-100 my-1" />
            <div className="flex items-center gap-1.5 px-1.5 pb-1">
              <MessageSquare size={13} className="text-slate-400 shrink-0" />
              <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Izoh (sabab)..."
                className="flex-1 min-w-0 text-[12px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-indigo-400"
                onKeyDown={(e) => { if (e.key === "Enter") { const cur = sessions[menu.date]?.[menu.studentId]?.status || "present"; setStatus(menu.date, menu.studentId, cur, noteDraft.trim() || undefined); setMenu(null); } }} />
            </div>
            {sessions[menu.date]?.[menu.studentId] && (
              <button type="button" onClick={() => { clearStatus(menu.date, menu.studentId); setMenu(null); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                <span className="w-6 h-6 rounded-md flex items-center justify-center border border-dashed border-slate-200"><Trash2 size={12} /></span>
                Belgilanmagan
              </button>
            )}
          </div>
        </>
      )}

      {/* Header popover: lesson lifecycle */}
      {headerMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setHeaderMenu(null)} />
          <div className="fixed z-50 w-48 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/10 p-1.5" style={{ left: headerMenu.x, top: headerMenu.y }}>
            {(Object.keys(LESSON_META) as LessonStatus[]).map((ls) => {
              const cfg = LESSON_META[ls];
              const active = (meta[headerMenu.date]?.lessonStatus || "held") === ls;
              const Ico = cfg.Icon;
              return (
                <button key={ls} type="button" onClick={() => setLessonStatus(headerMenu.date, ls)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${active ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-100 text-slate-500"><Ico size={13} strokeWidth={2.5} /></span>
                  <span className="flex-1 text-left">{cfg.label}</span>
                  {active && <Check size={15} className="text-slate-400" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Per-student timeline drawer */}
      {drawer && (() => {
        const t = tallies.get(drawer.id);
        const rows = lessonDates
          .filter((d) => (meta[d]?.lessonStatus || "held") !== "cancelled" && (meta[d]?.lessonStatus || "held") !== "holiday" && d <= today)
          .reverse();
        return (
          <>
            <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={() => setDrawer(null)} />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[380px] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-[13px] flex items-center justify-center">{getInitials(drawer.displayName)}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 truncate">{drawer.displayName}</p>
                    {drawer.username && <p className="text-[12px] text-slate-400 truncate">@{drawer.username}</p>}
                  </div>
                </div>
                <button onClick={() => setDrawer(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={18} /></button>
              </div>

              {/* Stat summary */}
              <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b border-slate-100">
                <div className="text-center">
                  <p className={`text-[20px] font-black tabular-nums ${t?.rate === null || t?.rate === undefined ? "text-slate-300" : t.rate >= 90 ? "text-emerald-600" : t.rate >= 75 ? "text-amber-600" : "text-rose-600"}`}>{t?.rate === null || t?.rate === undefined ? "–" : `${t.rate}%`}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Davomat</p>
                </div>
                <div className="text-center"><p className="text-[20px] font-black text-emerald-600 tabular-nums">{(t?.present || 0) + (t?.late || 0)}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Keldi</p></div>
                <div className="text-center"><p className="text-[20px] font-black text-rose-600 tabular-nums">{t?.absent || 0}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Kelmadi</p></div>
                <div className="text-center"><p className="text-[20px] font-black text-sky-600 tabular-nums">{t?.excused || 0}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Sababli</p></div>
              </div>

              {/* Timeline */}
              <div className={`flex-1 overflow-auto px-3 py-2 ${SCROLLBAR_CLASSES}`}>
                {rows.length === 0 && <p className="text-center text-[13px] text-slate-400 py-10">Hozircha darslar yo&apos;q</p>}
                {rows.map((d) => {
                  const rec = sessions[d]?.[drawer.id];
                  const dt = parseDateKey(d);
                  const ls = meta[d]?.lessonStatus || "held";
                  return (
                    <div key={d} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50">
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{WEEKDAY_SHORT[dt.getDay()]}</p>
                        <p className="text-[13px] font-bold text-slate-700 tabular-nums leading-tight">{dt.getDate()} {MONTH_SHORT[dt.getMonth()]}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        {rec ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS[rec.status].chip}`}>
                              {(() => { const Ico = STATUS[rec.status].Icon; return <Ico size={11} strokeWidth={2.75} />; })()}
                              {STATUS[rec.status].label}
                            </span>
                            {ls === "makeup" && <span className="text-[10px] text-violet-500 font-semibold">qo&apos;shimcha</span>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium">belgilanmagan</span>
                        )}
                        {rec?.note && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{rec.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
