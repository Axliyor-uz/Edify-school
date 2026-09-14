"use client";

import Link from "next/link";
import { School, ChevronRight, Lock } from "lucide-react";
import type { CenterDetailData } from "@/services/centerAdminService";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function GroupsTab({ data }: { data: CenterDetailData }) {
  const { classes } = data;

  const scheduleSummary = (schedule?: { dayOfWeek: number; startTime: string }[]) => {
    if (!schedule || schedule.length === 0) return "No schedule";
    const days = Array.from(new Set(schedule.map((s) => DAY_LABELS[s.dayOfWeek] ?? "?")));
    const time = schedule[0]?.startTime;
    return `${days.join(", ")}${time ? ` · ${time}` : ""}`;
  };

  const formatDate = (createdAt: any) => {
    const millis = createdAt?.toMillis ? createdAt.toMillis() : null;
    if (!millis) return "—";
    return new Date(millis).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
              <th className="p-5 pl-6">Group</th>
              <th className="p-5">Teacher</th>
              <th className="p-5 text-center">Students</th>
              <th className="p-5">Schedule</th>
              <th className="p-5 text-center">Created</th>
              <th className="p-5 text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-16 text-center text-slate-500 font-bold">
                  <School size={32} className="mx-auto text-slate-300 mb-3" />
                  No groups in this center yet.
                </td>
              </tr>
            ) : (
              classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-5 pl-6">
                    <p className="text-slate-900 font-bold text-[13px] flex items-center gap-2">
                      {cls.title}
                      {cls.isLocked && <Lock size={12} className="text-amber-500" />}
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold font-mono">Code: {cls.joinCode || "—"}</p>
                  </td>
                  <td className="p-5">
                    <p className="text-xs text-slate-600 font-bold">{cls.teacherName || "—"}</p>
                  </td>
                  <td className="p-5 text-center">
                    <span className="text-sm font-black text-indigo-600">{cls.studentIds?.length ?? 0}</span>
                  </td>
                  <td className="p-5">
                    <span className="text-xs text-slate-600 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                      {scheduleSummary(cls.schedule)}
                    </span>
                  </td>
                  <td className="p-5 text-center">
                    <span className="text-xs text-slate-500 font-bold">{formatDate(cls.createdAt)}</span>
                  </td>
                  <td className="p-5 text-right pr-6">
                    <Link
                      href={`/admin/classes/${cls.id}`}
                      className="inline-flex px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-600 hover:text-white transition-all items-center gap-2 text-[13px] opacity-0 group-hover:opacity-100"
                    >
                      View <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
