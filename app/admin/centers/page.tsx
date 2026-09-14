"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft, Building2, ChevronRight, Loader2, Plus, Search,
  Users, School, GraduationCap, Archive, ShieldCheck, ShieldX
} from "lucide-react";
import {
  fetchAllCenters, centerStatusOf, toMillis,
  type CenterSummary, type CenterStatus
} from "@/services/centerAdminService";

const STATUS_BADGE: Record<CenterStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  suspended: { label: "Suspended", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CenterStatus>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setCenters(await fetchAllCenters());
      } catch (error) {
        console.error("Error fetching centers:", error);
        toast.error("Failed to load centers.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredCenters = useMemo(() => {
    const lowerQ = searchQuery.trim().toLowerCase();
    const result = centers.filter((c) => {
      if (statusFilter !== "all" && centerStatusOf(c) !== statusFilter) return false;
      if (!lowerQ) return true;
      const name = (c.name || "").toLowerCase();
      const slug = (c.slug || "").toLowerCase();
      const managerName = (c.manager?.displayName || "").toLowerCase();
      const managerEmail = (c.manager?.email || "").toLowerCase();
      return name.includes(lowerQ) || slug.includes(lowerQ) || managerName.includes(lowerQ) || managerEmail.includes(lowerQ);
    });
    // Pending first (they need admin action), then newest.
    return result.sort((a, b) => {
      const aPending = centerStatusOf(a) === "pending" ? 0 : 1;
      const bPending = centerStatusOf(b) === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  }, [searchQuery, statusFilter, centers]);

  const statusCounts = useMemo(() => {
    const counts = { all: centers.length, pending: 0, active: 0, suspended: 0 };
    centers.forEach((c) => { counts[centerStatusOf(c)]++; });
    return counts;
  }, [centers]);

  const handleSetStatus = async (center: CenterSummary, next: "active" | "suspended") => {
    setApprovingId(center.id);
    try {
      await updateDoc(doc(db, "centers", center.id), { status: next });
      setCenters((prev) => prev.map((c) => (c.id === center.id ? { ...c, status: next } : c)));
      toast.success(next === "active" ? `${center.name} activated` : `${center.name} deactivated`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status.");
    } finally {
      setApprovingId(null);
    }
  };

  const formatDate = (value?: any) => {
    const millis = toMillis(value);
    if (!millis) return "—";
    return new Date(millis).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-6 md:p-10">

      {/* HEADER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="relative z-10 flex-1">
          <Link href="/admin" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold mb-4 text-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Learning Centers</h1>
          <p className="text-slate-500 font-medium text-sm">
            Managing <strong className="text-slate-900">{filteredCenters.length}</strong> centers out of {centers.length} total.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 z-10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by center, manager, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400 placeholder:font-medium"
            />
          </div>
          <Link
            href="/admin/centers/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Center
          </Link>
        </div>
      </div>

      {/* STATUS FILTER PILLS */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "active", "suspended"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${
              statusFilter === key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {key === "all" ? "All" : STATUS_BADGE[key].label}
            <span className={`ml-2 text-xs font-black ${statusFilter === key ? "text-slate-300" : "text-slate-400"}`}>
              {statusCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* DATA TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-5 pl-6">Center</th>
                <th className="p-5">Manager</th>
                <th className="p-5 text-center">Scale</th>
                <th className="p-5 text-center">Created</th>
                <th className="p-5 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-500">
                    <Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" size={32} />
                    <span className="font-bold tracking-wide">Loading centers...</span>
                  </td>
                </tr>
              ) : filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500 font-bold">
                    {searchQuery ? `No centers found matching "${searchQuery}"` : "No centers registered yet."}
                  </td>
                </tr>
              ) : (
                filteredCenters.map((center) => {
                  const archived = center.adminStatus === "archived";
                  const status = centerStatusOf(center);
                  return (
                    <tr key={center.id} className={`hover:bg-slate-50/50 transition-colors group ${archived ? "opacity-50" : ""}`}>

                      {/* 1. Center name / slug */}
                      <td className="p-5 pl-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Building2 size={22} />
                          </div>
                          <div>
                            <p className="text-slate-900 font-bold text-[14px] mb-0.5 flex items-center gap-2">
                              {center.name || "Unnamed Center"}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${STATUS_BADGE[status].cls}`}>
                                {STATUS_BADGE[status].label}
                              </span>
                              {archived && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                  <Archive size={10} /> Archived
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 font-bold font-mono">/{center.slug || "no-slug"}</p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Manager */}
                      <td className="p-5">
                        {center.manager ? (
                          <div>
                            <p className="text-slate-900 font-bold text-[13px]">{center.manager.displayName || "Unknown"}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{center.manager.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-500 font-bold">No manager account</span>
                        )}
                      </td>

                      {/* 3. Counts */}
                      <td className="p-5">
                        <div className="flex items-center justify-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 w-fit mx-auto">
                          <div className="text-center">
                            <p className="text-slate-900 font-black text-lg leading-none mb-1">{center.teacherCount}</p>
                            <p className="text-slate-400 text-[9px] uppercase font-bold flex items-center justify-center gap-1"><Users size={10} /> Teachers</p>
                          </div>
                          <div className="w-px h-8 bg-slate-200"></div>
                          <div className="text-center">
                            <p className="text-slate-900 font-black text-lg leading-none mb-1">{center.groupCount}</p>
                            <p className="text-slate-400 text-[9px] uppercase font-bold flex items-center justify-center gap-1"><School size={10} /> Groups</p>
                          </div>
                          <div className="w-px h-8 bg-slate-200"></div>
                          <div className="text-center">
                            <p className="text-indigo-600 font-black text-lg leading-none mb-1">{center.studentCount}</p>
                            <p className="text-slate-400 text-[9px] uppercase font-bold flex items-center justify-center gap-1"><GraduationCap size={10} /> Students</p>
                          </div>
                        </div>
                      </td>

                      {/* 4. Created */}
                      <td className="p-5 text-center">
                        <span className="text-xs text-slate-600 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          {formatDate(center.createdAt)}
                        </span>
                      </td>

                      {/* 5. Action */}
                      <td className="p-5 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {status === "active" ? (
                            <button
                              onClick={() => handleSetStatus(center, "suspended")}
                              disabled={approvingId === center.id}
                              className="inline-flex px-4 py-2 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-600 hover:text-white transition-all items-center gap-2 text-[13px] shadow-sm disabled:opacity-50"
                            >
                              {approvingId === center.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />} Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetStatus(center, "active")}
                              disabled={approvingId === center.id}
                              className="inline-flex px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-600 hover:text-white transition-all items-center gap-2 text-[13px] shadow-sm disabled:opacity-50"
                            >
                              {approvingId === center.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                              {status === "pending" ? "Approve" : "Activate"}
                            </button>
                          )}
                          <Link
                            href={`/admin/centers/${center.id}`}
                            className="inline-flex px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-600 hover:text-white transition-all items-center gap-2 text-[13px] shadow-sm opacity-0 group-hover:opacity-100"
                          >
                            View Details <ChevronRight size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
