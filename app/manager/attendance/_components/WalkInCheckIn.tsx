"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, Loader2, X, Check, Clock, UserRound, CalendarX2, CalendarPlus,
  Phone, Users2, CheckCircle2, CircleDashed,
} from "lucide-react";
import toast from "react-hot-toast";
import type { AttendanceStatus } from "@/types/attendance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { fetchCenterSessions, type CenterSession } from "@/services/attendanceService";
import {
  buildCenterRoster, computeTodayLessons, boardStatusOf, checkInStudent,
  type RosterStudent, type TodayLesson, type TodayBoardStatus,
} from "@/services/checkInService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    loadError: "Ma'lumotlarni yuklashda xatolik.",
    saveError: "Saqlashda xatolik. Qayta urinib ko'ring.",
    markedToast: (name: string, n: number) => `${name} — ${n} ta dars belgilandi`,
    emptyTitle: "O'quvchilar yo'q",
    emptyDesc: "Markazingiz guruhlariga hali o'quvchi qo'shilmagan.",
    progressTitle: "Bugungi davomat",
    progress1: "Bugun darsi bor ",
    progress2: " o'quvchidan ",
    progress3: " tasi belgilandi",
    pendingLeft: (n: number) => `${n} ta qoldi`,
    searchPlaceholder: "O'quvchi ismini yozing...",
    clear: "Tozalash",
    filterAll: "Hammasi",
    filterPending: "Kutilmoqda",
    filterDone: "Belgilangan",
    notFound: (q: string) => `«${q}» bo'yicha o'quvchi topilmadi`,
    emptyList: "Bu ro'yxat bo'sh",
    groupCount: (n: number) => `${n} guruh`,
    noLessonTitle: "Bugun dars yo'q",
    noLessonDesc: "Bu o'quvchida bugun uchun rejalashtirilgan dars mavjud emas.",
    close: "Yopish",
    statusLabel: "Holat:",
    present: "Keldi",
    late: "Kech qoldi",
    makeup: "qo'shimcha",
    alreadyMarked: "belgilangan",
    markAs: (label: string) => `${label} deb belgilash`,
    lessonsSuffix: (n: number) => ` (${n} ta dars)`,
    rowDone: "Belgilandi",
    rowPending: (n: number) => `${n} dars · kutilmoqda`,
  },
  en: {
    loadError: "Failed to load data.",
    saveError: "Failed to save. Please try again.",
    markedToast: (name: string, n: number) => `${name} — ${n} lessons marked`,
    emptyTitle: "No students",
    emptyDesc: "No students have been added to your center's groups yet.",
    progressTitle: "Today's attendance",
    progress1: "Of ",
    progress2: " students with lessons today, ",
    progress3: " marked",
    pendingLeft: (n: number) => `${n} left`,
    searchPlaceholder: "Type a student's name...",
    clear: "Clear",
    filterAll: "All",
    filterPending: "Pending",
    filterDone: "Marked",
    notFound: (q: string) => `No students found for «${q}»`,
    emptyList: "This list is empty",
    groupCount: (n: number) => `${n} groups`,
    noLessonTitle: "No lessons today",
    noLessonDesc: "This student has no scheduled lessons for today.",
    close: "Close",
    statusLabel: "Status:",
    present: "Present",
    late: "Late",
    makeup: "make-up",
    alreadyMarked: "marked",
    markAs: (label: string) => `Mark as ${label.toLowerCase()}`,
    lessonsSuffix: (n: number) => ` (${n} lessons)`,
    rowDone: "Marked",
    rowPending: (n: number) => `${n} lessons · pending`,
  },
  ru: {
    loadError: "Ошибка при загрузке данных.",
    saveError: "Ошибка при сохранении. Попробуйте ещё раз.",
    markedToast: (name: string, n: number) => `${name} — отмечено занятий: ${n}`,
    emptyTitle: "Учеников нет",
    emptyDesc: "В группы вашего центра пока не добавлены ученики.",
    progressTitle: "Сегодняшняя посещаемость",
    progress1: "Из ",
    progress2: " учеников с занятиями сегодня отмечено ",
    progress3: "",
    pendingLeft: (n: number) => `осталось ${n}`,
    searchPlaceholder: "Введите имя ученика...",
    clear: "Очистить",
    filterAll: "Все",
    filterPending: "Ожидают",
    filterDone: "Отмечены",
    notFound: (q: string) => `По запросу «${q}» ученики не найдены`,
    emptyList: "Этот список пуст",
    groupCount: (n: number) => `${n} групп`,
    noLessonTitle: "Сегодня занятий нет",
    noLessonDesc: "У этого ученика нет запланированных занятий на сегодня.",
    close: "Закрыть",
    statusLabel: "Статус:",
    present: "Пришёл",
    late: "Опоздал",
    makeup: "доп. занятие",
    alreadyMarked: "отмечено",
    markAs: (label: string) => `Отметить: ${label}`,
    lessonsSuffix: (n: number) => ` (${n} занятий)`,
    rowDone: "Отмечен",
    rowPending: (n: number) => `${n} занятий · ожидает`,
  },
};
type WalkInT = typeof TRANSLATIONS.uz;

interface Props {
  centerId: string;
  classes: ClassData[];
  /** uid of the manager doing the marking. */
  markedBy: string;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Labels come from the TRANSLATIONS dict (t.present / t.late) — keyed by status.
const STATUS_UI: Record<"present" | "late", { chip: string; Icon: React.ElementType }> = {
  present: { chip: "bg-success-container text-on-success-container", Icon: Check },
  late: { chip: "bg-warning-container text-on-warning-container", Icon: Clock },
};

type Filter = "all" | "pending" | "done";

// Sort order on the board: students still needing marks float to the top.
const STATUS_RANK: Record<TodayBoardStatus, number> = { pending: 0, done: 1, none: 2 };

// Deterministic avatar tint so rows feel distinct at a glance.
const AVATAR_TINTS = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
];
function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

interface Enriched {
  student: RosterStudent;
  lessons: TodayLesson[];
  status: TodayBoardStatus;
}

function Avatar({ student, size = 40 }: { student: RosterStudent; size?: number }) {
  const cls = `shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold ${tintFor(student.uid)}`;
  const style = { width: size, height: size, fontSize: size * 0.34 };
  if (student.photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={student.photoURL} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    );
  }
  return <span className={cls} style={style}>{getInitials(student.displayName)}</span>;
}

export default function WalkInCheckIn({ centerId, classes, markedBy }: Props) {
  const { lang } = useManagerLanguage();
  const t: WalkInT = TRANSLATIONS[lang];
  const today = useMemo(() => getTodayKey(), []);
  const todayWeekday = useMemo(() => parseDateKey(today).getDay(), [today]);

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [sessionByClass, setSessionByClass] = useState<Map<string, CenterSession>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<RosterStudent | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [markStatus, setMarkStatus] = useState<"present" | "late">("present");
  const [saving, setSaving] = useState(false);

  // ── Load roster + today's sessions in parallel (one query for sessions). ─────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [r, sessions] = await Promise.all([
          buildCenterRoster(classes),
          fetchCenterSessions(centerId, today, today),
        ]);
        if (!mounted) return;
        setRoster(r);
        setSessionByClass(new Map(sessions.map((s) => [s.classId, s])));
      } catch (err) {
        console.error(err);
        if (mounted) toast.error(t.loadError);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [classes, centerId, today]);

  useEffect(() => { if (!loading) searchRef.current?.focus(); }, [loading]);

  // Enrich every student with today's lessons + a board status (all in-memory).
  const enriched = useMemo<Enriched[]>(() => {
    return roster.map((student) => {
      const lessons = computeTodayLessons(student, classes, sessionByClass, todayWeekday);
      return { student, lessons, status: boardStatusOf(lessons) };
    });
  }, [roster, classes, sessionByClass, todayWeekday]);

  const counts = useMemo(() => {
    let pending = 0, done = 0, none = 0;
    for (const e of enriched) {
      if (e.status === "pending") pending++;
      else if (e.status === "done") done++;
      else none++;
    }
    return { pending, done, none, withLesson: pending + done, total: enriched.length };
  }, [enriched]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((e) => {
        if (filter === "pending" && e.status !== "pending") return false;
        if (filter === "done" && e.status !== "done") return false;
        if (!q) return true;
        return e.student.displayName.toLowerCase().includes(q) || (e.student.username || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (r !== 0) return r;
        return a.student.displayName.localeCompare(b.student.displayName, "uz", { sensitivity: "base" });
      });
  }, [enriched, search, filter]);

  const dialogLessons = useMemo(
    () => (dialog ? computeTodayLessons(dialog, classes, sessionByClass, todayWeekday) : []),
    [dialog, classes, sessionByClass, todayWeekday]
  );

  const openDialog = useCallback((student: RosterStudent) => {
    const lessons = computeTodayLessons(student, classes, sessionByClass, todayWeekday);
    const init: Record<string, boolean> = {};
    lessons.forEach((l) => { init[l.classId] = l.currentStatus === null; });
    setChecked(init);
    setMarkStatus("present");
    setDialog(student);
  }, [classes, sessionByClass, todayWeekday]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const selectedLessons = useMemo(
    () => dialogLessons.filter((l) => checked[l.classId]),
    [dialogLessons, checked]
  );

  const submit = useCallback(async () => {
    if (!dialog || selectedLessons.length === 0) return;
    const student = dialog;
    setSaving(true);
    try {
      await Promise.all(
        selectedLessons.map((l) =>
          checkInStudent({
            classId: l.classId, centerId, uid: student.uid,
            status: markStatus as AttendanceStatus, markedBy, date: today, weekday: todayWeekday,
          })
        )
      );
      // Update local session map so the board reflects the marks instantly.
      setSessionByClass((prev) => {
        const next = new Map(prev);
        for (const l of selectedLessons) {
          const existing = next.get(l.classId);
          const records = { ...(existing?.records || {}), [student.uid]: { status: markStatus as AttendanceStatus } };
          next.set(l.classId, existing
            ? { ...existing, records }
            : { id: `${l.classId}_${today}`, classId: l.classId, centerId, date: today, weekday: todayWeekday, lessonStatus: "held", records });
        }
        return next;
      });
      toast.success(t.markedToast(student.displayName, selectedLessons.length));
      setDialog(null);
      searchRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  }, [dialog, selectedLessons, centerId, markStatus, markedBy, today, todayWeekday, t]);

  // Esc closes the dialog.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDialog(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={30} /></div>;
  }

  if (roster.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3"><UserRound size={26} /></div>
        <h3 className="text-[15px] font-semibold text-on-surface">{t.emptyTitle}</h3>
        <p className="text-sm text-on-surface-variant mt-1 max-w-[260px]">{t.emptyDesc}</p>
      </div>
    );
  }

  const pct = counts.withLesson > 0 ? Math.round((counts.done / counts.withLesson) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Progress summary */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-4 flex items-center gap-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--m3-surface-container-highest)" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--m3-success)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-on-surface tabular-nums">{pct}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-on-surface">{t.progressTitle}</p>
          <p className="text-[12.5px] text-on-surface-variant mt-0.5">
            {t.progress1}<b className="text-on-surface tabular-nums">{counts.withLesson}</b>{t.progress2}
            <b className="text-success tabular-nums">{counts.done}</b>{t.progress3}
          </p>
        </div>
        {counts.pending > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-container text-on-warning-container text-[12px] font-bold">
            <CircleDashed size={14} /> {t.pendingLeft(counts.pending)}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        <input
          ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-11 pr-10 py-3.5 text-[15px] bg-surface-container-lowest text-on-surface border border-outline-variant rounded-full outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} aria-label={t.clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-m3-md text-on-surface-variant hover:bg-state-hover hover:text-on-surface transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        {([
          { id: "all" as Filter, label: t.filterAll, n: counts.total },
          { id: "pending" as Filter, label: t.filterPending, n: counts.pending },
          { id: "done" as Filter, label: t.filterDone, n: counts.done },
        ]).map((f) => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-colors ${
                active ? "bg-primary text-on-primary" : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}>
              {f.label}
              <span className={`tabular-nums ${active ? "text-on-primary opacity-70" : "text-on-surface-variant"}`}>{f.n}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl overflow-hidden divide-y divide-outline-variant">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-on-surface-variant">
            {search ? t.notFound(search) : t.emptyList}
          </p>
        ) : (
          visible.map((e, i) => <StudentRow key={e.student.uid} n={i + 1} e={e} onOpen={() => openDialog(e.student)} />)
        )}
      </div>

      {/* ── Check-in dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={closeDialog} />
          <div className="relative w-full sm:max-w-md bg-surface-container-lowest rounded-t-m3-xl sm:rounded-m3-xl shadow-elev-3 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-outline-variant">
              <Avatar student={dialog} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-on-surface truncate">{dialog.displayName}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[12px] text-on-surface-variant">
                  {dialog.username && <span className="truncate">@{dialog.username}</span>}
                  {dialog.phone && <span className="inline-flex items-center gap-1 shrink-0"><Phone size={11} /> {dialog.phone}</span>}
                  <span className="inline-flex items-center gap-1 shrink-0"><Users2 size={11} /> {t.groupCount(dialog.classIds.length)}</span>
                </div>
              </div>
              <button onClick={closeDialog} className="w-8 h-8 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-state-hover hover:text-on-surface transition-colors"><X size={18} /></button>
            </div>

            {dialogLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-6">
                <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant mb-3"><CalendarX2 size={26} /></div>
                <h4 className="text-[15px] font-semibold text-on-surface">{t.noLessonTitle}</h4>
                <p className="text-[13px] text-on-surface-variant mt-1 max-w-[280px]">{t.noLessonDesc}</p>
                <button onClick={closeDialog} className="mt-4 px-5 py-2.5 rounded-m3-md bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[13px] font-bold transition-colors">{t.close}</button>
              </div>
            ) : (
              <>
                {/* Status toggle */}
                <div className="flex items-center gap-2 px-5 pt-4">
                  <span className="text-[12px] font-semibold text-on-surface-variant">{t.statusLabel}</span>
                  {(["present", "late"] as const).map((s) => {
                    const cfg = STATUS_UI[s]; const active = markStatus === s; const Ico = cfg.Icon;
                    return (
                      <button key={s} onClick={() => setMarkStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all ${
                          active ? cfg.chip : "bg-surface-container-low text-on-surface-variant hover:bg-state-hover"
                        }`}>
                        <Ico size={14} strokeWidth={2.5} /> {t[s]}
                      </button>
                    );
                  })}
                </div>

                {/* Lessons */}
                <div className="px-3 py-3 space-y-1.5 overflow-y-auto">
                  {dialogLessons.map((l) => {
                    const on = !!checked[l.classId];
                    return (
                      <button key={l.classId} onClick={() => setChecked((p) => ({ ...p, [l.classId]: !p[l.classId] }))}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-m3-lg border text-left transition-all ${
                          on ? "border-primary bg-t-primary-soft" : "border-outline-variant bg-surface-container-lowest hover:bg-state-hover"
                        }`}>
                        <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors ${on ? "bg-primary text-on-primary" : "border border-outline text-transparent"}`}>
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[14px] font-bold text-on-surface truncate">{l.title}</p>
                            {l.lessonStatus === "makeup" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-1.5 py-0.5 rounded-full"><CalendarPlus size={10} /> {t.makeup}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-on-surface-variant">
                            {l.time && <span className="tabular-nums font-medium">{l.time}</span>}
                            {l.teacherName && <span className="truncate">· {l.teacherName}</span>}
                          </div>
                        </div>
                        {l.currentStatus && (
                          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${l.currentStatus === "late" ? "bg-warning-container text-on-warning-container" : l.currentStatus === "absent" ? "bg-error-container text-on-error-container" : l.currentStatus === "excused" ? "bg-tertiary-container text-on-tertiary-container" : "bg-success-container text-on-success-container"}`}>
                            <CheckCircle2 size={11} /> {t.alreadyMarked}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Confirm */}
                <div className="px-5 pb-5 pt-1 border-t border-outline-variant">
                  <button onClick={submit} disabled={saving || selectedLessons.length === 0}
                    className="m3-interactive w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-on-primary font-bold text-[14px] transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-elev-1">
                    {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} strokeWidth={2.75} />}
                    {t.markAs(t[markStatus])}
                    {selectedLessons.length > 0 && t.lessonsSuffix(selectedLessons.length)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function StudentRow({ n, e, onOpen }: { n: number; e: Enriched; onOpen: () => void }) {
  const { lang } = useManagerLanguage();
  const t: WalkInT = TRANSLATIONS[lang];
  const { student, lessons, status } = e;
  const badge =
    status === "done" ? { cls: "bg-success-container text-on-success-container", Icon: CheckCircle2, label: t.rowDone } :
    status === "pending" ? { cls: "bg-warning-container text-on-warning-container", Icon: CircleDashed, label: t.rowPending(lessons.length) } :
    { cls: "bg-surface-container text-on-surface-variant", Icon: CalendarX2, label: t.noLessonTitle };
  const BIcon = badge.Icon;
  const noLesson = status === "none";

  return (
    <button onClick={onOpen} disabled={noLesson}
      className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left transition-colors group ${noLesson ? "opacity-60 cursor-default" : "hover:bg-state-hover"}`}>
      <span className="w-6 shrink-0 text-center text-[12px] font-bold text-on-surface-variant opacity-60 tabular-nums">{n}</span>
      <Avatar student={student} size={42} />
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-semibold text-on-surface truncate ${noLesson ? "" : "group-hover:text-primary"} transition-colors`}>{student.displayName}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[12px] text-on-surface-variant">
          {student.username && <span className="truncate">@{student.username}</span>}
          <span className="inline-flex items-center gap-1 shrink-0"><Users2 size={11} /> {student.classIds.length}</span>
        </div>
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}>
        <BIcon size={12} /> <span className="hidden sm:inline">{badge.label}</span>
      </span>
    </button>
  );
}
