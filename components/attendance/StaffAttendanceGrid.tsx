"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Save, Loader2, Check, Clock, X, Plus, ChevronLeft, ChevronRight, Plane, Sun, MessageSquare, Trash2, UserCheck, ScanFace } from "lucide-react";
import toast from "react-hot-toast";
import type { StaffAttendanceStatus } from "@/types/attendance";
import { formatDateKey, getTodayKey } from "@/lib/dateUtils";
import { fetchStaffSessions, hoursBetween } from "@/services/attendanceService";

interface StaffMember { uid: string; name: string; }
interface Props {
  centerId: string;
  managerId: string;
  staff: StaffMember[];
  loadingStaff?: boolean;
}

interface StaffRecordLocal {
  status: StaffAttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
  method?: "manual" | "face";
}

const AUTOSAVE_MS = 1000;

const WEEKDAY_SHORT = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
const MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

const STATUS: Record<StaffAttendanceStatus, { label: string; solid: string; chip: string; dot: string; Icon: React.ElementType }> = {
  present: { label: "Keldi", solid: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/30", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", Icon: Check },
  late: { label: "Kech qoldi", solid: "bg-amber-400 hover:bg-amber-500 text-white shadow-sm shadow-amber-400/30", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", Icon: Clock },
  absent: { label: "Kelmadi", solid: "bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/30", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", Icon: X },
  leave: { label: "Ruxsat", solid: "bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/30", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500", Icon: Plane },
  holiday: { label: "Dam olish", solid: "bg-violet-500 hover:bg-violet-600 text-white shadow-sm shadow-violet-500/30", chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500", Icon: Sun },
};
const STATUS_ORDER: StaffAttendanceStatus[] = ["present", "late", "absent", "leave", "holiday"];

const SCROLLBAR =
  "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [scrollbar-width:thin]";

function getInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}
function docKey(uid: string, date: string) { return `${uid}_${date}`; }

export default function StaffAttendanceGrid({ centerId, managerId, staff, loadingStaff }: Props) {
  const today = useMemo(() => getTodayKey(), []);
  const [ym, setYm] = useState(() => { const d = new Date(today + "T00:00:00"); return { y: d.getFullYear(), m: d.getMonth() }; });

  const days = useMemo(() => {
    const count = new Date(ym.y, ym.m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => formatDateKey(new Date(ym.y, ym.m, i + 1)));
  }, [ym]);
  const monthStart = days[0];
  const monthEnd = days[days.length - 1];

  // sessions[uid][date] = record
  const [sessions, setSessions] = useState<Record<string, Record<string, StaffRecordLocal>>>({});
  const [createdAtByDoc, setCreatedAtByDoc] = useState<Record<string, Timestamp>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<string>>(new Set()); // set of docKey
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [menu, setMenu] = useState<{ uid: string; date: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<StaffRecordLocal | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the month's staff attendance.
  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    setLoading(true);
    fetchStaffSessions(centerId, monthStart, monthEnd)
      .then((rows) => {
        if (!mounted) return;
        const sess: Record<string, Record<string, StaffRecordLocal>> = {};
        const created: Record<string, Timestamp> = {};
        rows.forEach((r) => {
          (sess[r.staffUid] ||= {})[r.date] = { status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, note: r.note, method: (r as { method?: string }).method === "face" ? "face" : "manual" };
        });
        setSessions(sess);
        setCreatedAtByDoc(created);
        setDirty(new Set());
        setSaveState("idle");
      })
      .catch((e) => { console.error(e); toast.error("Xodimlar davomatini yuklashda xatolik."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [centerId, monthStart, monthEnd]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menu]);

  const markDirty = useCallback((uid: string, date: string) => {
    setDirty((prev) => { const n = new Set(prev); n.add(docKey(uid, date)); return n; });
    setSaveState("idle");
  }, []);

  const setRecord = (uid: string, date: string, rec: StaffRecordLocal | null) => {
    setSessions((prev) => {
      const col = { ...(prev[uid] || {}) };
      if (rec) col[date] = rec; else delete col[date];
      return { ...prev, [uid]: col };
    });
    markDirty(uid, date);
  };

  const staffName = useCallback((uid: string) => staff.find((s) => s.uid === uid)?.name || "Xodim", [staff]);

  const flush = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    setSaveState("saving");
    try {
      await Promise.all(keys.map((key) => {
        const [uid, date] = [key.slice(0, key.lastIndexOf("_")), key.slice(key.lastIndexOf("_") + 1)];
        const rec = sessions[uid]?.[date];
        const ref = doc(db, "center_staff_attendance", key);
        if (!rec) return deleteDoc(ref).catch(() => {});
        const weekday = new Date(date + "T00:00:00").getDay();
        const payload: Record<string, unknown> = {
          id: key, centerId, staffUid: uid, staffName: staffName(uid), date, weekday,
          status: rec.status, method: "manual", markedBy: managerId,
          createdAt: createdAtByDoc[key] || serverTimestamp(), updatedAt: serverTimestamp(),
        };
        if (rec.checkIn) payload.checkIn = rec.checkIn;
        if (rec.checkOut) payload.checkOut = rec.checkOut;
        const hrs = hoursBetween(rec.checkIn, rec.checkOut);
        if (hrs !== null) payload.hoursWorked = hrs;
        if (rec.note) payload.note = rec.note;
        return setDoc(ref, payload);
      }));
      setDirty((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; });
      setSaveState("saved");
    } catch (e) {
      console.error(e); setSaveState("error"); toast.error("Saqlashda xatolik.");
    }
  }, [sessions, centerId, managerId, createdAtByDoc, staffName]);

  useEffect(() => {
    if (dirty.size === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(Array.from(dirty)), AUTOSAVE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, flush]);

  const openMenu = (e: React.MouseEvent, uid: string, date: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 236);
    setDraft(sessions[uid]?.[date] ? { ...sessions[uid][date] } : { status: "present" });
    setMenu({ uid, date, x: Math.max(8, x), y: rect.bottom + 6 });
  };

  const handleCellClick = (e: React.MouseEvent, uid: string, date: string) => {
    if (date > today) return; // don't mark the future
    if (!sessions[uid]?.[date]) setRecord(uid, date, { status: "present" });
    else openMenu(e, uid, date);
  };

  const applyDraft = () => {
    if (!menu || !draft) return;
    setRecord(menu.uid, menu.date, draft);
    setMenu(null);
  };

  // Per-teacher monthly summary.
  const summaries = useMemo(() => {
    const m = new Map<string, { present: number; hours: number }>();
    staff.forEach((s) => {
      let present = 0, hours = 0;
      const col = sessions[s.uid] || {};
      Object.values(col).forEach((r) => {
        if (r.status === "present" || r.status === "late") present += 1;
        const h = hoursBetween(r.checkIn, r.checkOut);
        if (h) hours += h;
      });
      m.set(s.uid, { present, hours: Math.round(hours * 10) / 10 });
    });
    return m;
  }, [staff, sessions]);

  const goMonth = (delta: number) => setYm((p) => {
    const d = new Date(p.y, p.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const saveLabel =
    saveState === "saving" ? "Saqlanmoqda..." : saveState === "saved" ? "Saqlandi" :
    saveState === "error" ? "Xatolik" : dirty.size > 0 ? `Saqlash (${dirty.size})` : "Saqlangan";

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <button onClick={() => goMonth(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><ChevronLeft size={17} /></button>
          <span className="text-[14px] font-bold text-slate-800 min-w-[110px] text-center tabular-nums">{MONTHS_UZ[ym.m]} {ym.y}</span>
          <button onClick={() => goMonth(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"><ChevronRight size={17} /></button>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1 text-[10.5px] font-medium text-slate-500"><span className={`w-2 h-2 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label}</span>
          ))}
        </div>

        <button onClick={() => flush(Array.from(dirty))} disabled={saveState === "saving" || dirty.size === 0}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] disabled:cursor-not-allowed shadow-sm ${
            saveState === "error" ? "bg-rose-600 text-white" : dirty.size > 0 ? "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30" : "bg-slate-900 text-white disabled:opacity-40"
          }`}>
          {saveState === "saving" ? <Loader2 size={16} className="animate-spin" /> : saveState === "saved" && dirty.size === 0 ? <Check size={16} /> : <Save size={16} />}
          {saveLabel}
        </button>
      </div>

      {loadingStaff || loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-6">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><UserCheck size={24} /></div>
          <h3 className="text-sm font-semibold text-slate-700">Xodimlar yo&apos;q</h3>
          <p className="text-[13px] text-slate-400 mt-1">Markazingizga hali o&apos;qituvchi qo&apos;shilmagan.</p>
        </div>
      ) : (
        <div ref={scrollRef} className={`overflow-auto max-h-[70vh] ${SCROLLBAR}`}>
          <table className="border-separate border-spacing-0 w-full">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-40 bg-slate-800 text-slate-100 text-[11px] font-semibold uppercase tracking-wide text-left px-3 py-3 min-w-[200px] w-[200px] border-r border-slate-700 shadow-[6px_0_12px_-6px_rgba(0,0,0,0.15)]">Xodim</th>
                {days.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isToday = d === today;
                  const isSunday = dt.getDay() === 0;
                  return (
                    <th key={d} className={`sticky top-0 z-30 px-1 py-2 w-[42px] min-w-[42px] border-l border-white/10 ${isToday ? "bg-brand-600" : isSunday ? "bg-slate-600" : "bg-slate-800"}`}>
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[9px] font-semibold uppercase text-white/60">{WEEKDAY_SHORT[dt.getDay()]}</span>
                        <span className="text-[12px] font-bold tabular-nums text-white">{dt.getDate()}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="sticky top-0 z-30 bg-slate-800 text-slate-100 text-[10px] font-semibold uppercase tracking-wide text-center px-2 py-3 min-w-[92px] w-[92px] border-l border-white/10">Jami</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const sum = summaries.get(s.uid);
                return (
                  <tr key={s.uid} className="group">
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 px-3 py-2 min-w-[200px] w-[200px] transition-colors shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-800 font-bold text-[11px] flex items-center justify-center">{getInitials(s.name)}</span>
                        <p className="text-[13px] font-medium text-slate-900 truncate">{s.name}</p>
                      </div>
                    </td>
                    {days.map((d) => {
                      const rec = sessions[s.uid]?.[d];
                      const isFuture = d > today;
                      const isToday = d === today;
                      const isSunday = new Date(d + "T00:00:00").getDay() === 0;
                      return (
                        <td key={d} className={`border-b border-l border-slate-100 text-center px-0.5 py-1 ${isToday ? "bg-brand-50/40" : isSunday ? "bg-slate-50/60" : ""}`}>
                          {isFuture ? (
                            <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-slate-200"><span className="w-1 h-1 rounded-full bg-current" /></div>
                          ) : rec ? (
                            <button type="button" onClick={(e) => handleCellClick(e, s.uid, d)} title={`${STATUS[rec.status].label}${rec.checkIn ? ` · ${rec.checkIn}${rec.checkOut ? `–${rec.checkOut}` : ""}` : ""}${rec.note ? ` · ${rec.note}` : ""}`}
                              className={`relative w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all active:scale-90 ${STATUS[rec.status].solid}`}>
                              {(() => { const I = STATUS[rec.status].Icon; return <I size={15} strokeWidth={2.75} />; })()}
                              {rec.method === "face" && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center" title="Face ID"><ScanFace size={8} className="text-indigo-500" /></span>}
                              {rec.method !== "face" && (rec.checkIn || rec.note) && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white border border-slate-300" />}
                            </button>
                          ) : (
                            <button type="button" onClick={(e) => handleCellClick(e, s.uid, d)} title="Bosing — 'Keldi'"
                              className="w-8 h-8 mx-auto rounded-lg border border-dashed border-slate-200 text-slate-300 flex items-center justify-center hover:border-emerald-300 hover:text-emerald-400 hover:bg-emerald-50/50 transition-colors"><Plus size={13} /></button>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-slate-100 text-center px-2 py-1 min-w-[92px] w-[92px]">
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[12px] font-bold text-slate-800 tabular-nums">{sum?.present || 0} kun</span>
                        {(sum?.hours || 0) > 0 && <span className="text-[10.5px] text-slate-400 tabular-nums">{sum?.hours} soat</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell popover */}
      {menu && draft && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 w-56 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/10 p-1.5" style={{ left: menu.x, top: menu.y }}>
            {STATUS_ORDER.map((s) => {
              const cfg = STATUS[s]; const active = draft.status === s; const I = cfg.Icon;
              return (
                <button key={s} type="button" onClick={() => setDraft((d) => d ? { ...d, status: s } : d)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${active ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.chip}`}><I size={13} strokeWidth={2.5} /></span>
                  <span className="flex-1 text-left">{cfg.label}</span>
                  {active && <Check size={14} className="text-slate-400" />}
                </button>
              );
            })}
            <div className="h-px bg-slate-100 my-1.5" />
            <div className="flex items-center gap-1.5 px-1 pb-1.5">
              <Clock size={13} className="text-slate-400 shrink-0" />
              <input type="time" value={draft.checkIn || ""} onChange={(e) => setDraft((d) => d ? { ...d, checkIn: e.target.value || undefined } : d)}
                className="flex-1 min-w-0 text-[12px] px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-brand-600" />
              <span className="text-slate-300 text-[12px]">–</span>
              <input type="time" value={draft.checkOut || ""} onChange={(e) => setDraft((d) => d ? { ...d, checkOut: e.target.value || undefined } : d)}
                className="flex-1 min-w-0 text-[12px] px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-brand-600" />
            </div>
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <MessageSquare size={13} className="text-slate-400 shrink-0" />
              <input value={draft.note || ""} onChange={(e) => setDraft((d) => d ? { ...d, note: e.target.value || undefined } : d)} placeholder="Izoh..."
                className="flex-1 min-w-0 text-[12px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-brand-600"
                onKeyDown={(e) => { if (e.key === "Enter") applyDraft(); }} />
            </div>
            <div className="flex items-center gap-1.5 px-1 pt-1">
              <button onClick={applyDraft} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[12.5px] font-bold transition-colors"><Check size={14} /> Saqlash</button>
              {sessions[menu.uid]?.[menu.date] && (
                <button onClick={() => { setRecord(menu.uid, menu.date, null); setMenu(null); }} className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
